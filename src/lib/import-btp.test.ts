import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryIdFromLabel, cleanCategoryLabel, convertBtp, isBtpFile } from "./import-btp.ts";
import { collapseRepeatedLabel, isMortgageSplitCategory, pickerGroups } from "./categories.ts";
import { groupSpendByParent, parentCategoryName, presetRange, rangeFlow } from "./derived.ts";
import type { Category, Transaction } from "./types.ts";

test("cleanCategoryLabel collapses repeated phrases", () => {
  assert.equal(cleanCategoryLabel("外出就餐 外出就餐"), "外出就餐");
  assert.equal(cleanCategoryLabel("利息收入 利息收入 利息收入"), "利息收入");
  assert.equal(cleanCategoryLabel("旅遊: 購物 旅遊: 購物"), "旅遊: 購物");
  assert.equal(cleanCategoryLabel("  購物  "), "購物");
  assert.equal(cleanCategoryLabel(""), "");
});

test("pickerGroups hides colon children from the main list", () => {
  const cats: Category[] = [
    { id: "p-food", name: "Food", nameZh: "飲食", theme: "living", kind: "expense", icon: "utensils" },
    { id: "dining", name: "Dining out", nameZh: "外出就餐", theme: "living", kind: "expense", icon: "utensils", parentId: "p-food" },
    { id: "groc", name: "Groceries", nameZh: "超市", theme: "living", kind: "expense", icon: "shopping", parentId: "p-food" },
    { id: "p-ent", name: "Entertainment", nameZh: "娛樂", theme: "other", kind: "expense", icon: "film" },
    { id: "ent", name: "Entertainment", nameZh: "娛樂", theme: "other", kind: "expense", icon: "film", parentId: "p-ent" },
    { id: "btp-travel", name: "旅遊", nameZh: "旅遊", theme: "travel", kind: "expense", icon: "plane" },
    { id: "btp-hotel", name: "旅遊: 住宿", nameZh: "旅遊: 住宿", theme: "travel", kind: "expense", icon: "tent" },
    { id: "btp-dup", name: "旅遊: 購物 旅遊: 購物", nameZh: "旅遊: 購物 旅遊: 購物", theme: "travel", kind: "expense", icon: "bag" },
    { id: "seed-travel", name: "Travel", nameZh: "旅遊", theme: "travel", kind: "expense", icon: "plane" },
  ];
  const groups = pickerGroups(cats, "expense");
  const names = groups.map((g) => g.parent.nameZh);
  assert.deepEqual([...names].sort(), ["娛樂", "旅遊", "飲食"].sort());
  const food = groups.find((g) => g.parent.nameZh === "飲食");
  assert.deepEqual(food?.children.map((c) => c.nameZh).sort(), ["外出就餐", "超市"]);
  const travel = groups.find((g) => g.parent.nameZh === "旅遊");
  assert.ok(travel);
  assert.deepEqual([...travel.children.map((c) => c.nameZh)].sort(), ["住宿", "購物"]);
  const ent = groups.find((g) => g.parent.nameZh === "娛樂");
  assert.equal(ent?.children.length, 0);
  assert.equal(collapseRepeatedLabel("旅遊: 入場費 旅遊: 購物"), "旅遊: 入場費");
});

test("mortgage split matches user-added 按揭 categories, not only seed ids", () => {
  const custom = {
    id: "cat-user-1",
    name: "Mortgage principal",
    nameZh: "按揭本金",
    parentId: "housing-custom",
  };
  const parent = { id: "housing-custom", name: "Housing", nameZh: "房屋" };
  assert.equal(isMortgageSplitCategory(custom, [parent, custom]), true);
  const interest = { id: "xyz", name: "Interest", nameZh: "按揭利息" };
  assert.equal(isMortgageSplitCategory(interest), true);
  const dining = { id: "dining", name: "Dining", nameZh: "外出就餐" };
  assert.equal(isMortgageSplitCategory(dining), false);
});


test("categoryIdFromLabel is stable", () => {
  assert.equal(categoryIdFromLabel("外出就餐"), categoryIdFromLabel("外出就餐"));
  assert.match(categoryIdFromLabel("外出就餐"), /^cat-/);
});

test("parentCategoryName splits on the first colon", () => {
  assert.equal(parentCategoryName("家庭和個人: 家用"), "家庭和個人");
  assert.equal(parentCategoryName("稅務: 薪俸稅"), "稅務");
  assert.equal(parentCategoryName("外出就餐"), "外出就餐");
});

test("groupSpendByParent merges child categories", () => {
  const grouped = groupSpendByParent([
    { id: "a", name: "家庭和個人: 家用", nameZh: "家庭和個人: 家用", value: 50000 },
    { id: "b", name: "家庭和個人: 剪髮", nameZh: "家庭和個人: 剪髮", value: 38752.25 },
    { id: "c", name: "外出就餐", nameZh: "外出就餐", value: 100 },
  ]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].nameZh, "家庭和個人");
  assert.equal(grouped[0].value, 88752.25);
  assert.equal(grouped[1].nameZh, "外出就餐");
});

test("presetRange thisYear is the full calendar year", () => {
  const r = presetRange("thisYear", "2026-08-23", []);
  assert.equal(r.from, "2026-01-01");
  assert.equal(r.to, "2026-12-31");
});

test("convertBtp pairs transfers and skips incoming side", () => {
  const file = {
    app: "Budget Tracker Pro",
    exportedAt: "2026-08-23T00:00:00.000Z",
    budget: {
      monthly: { "2026-08": { budget: 62000, expenses: 100 } },
      regular: [{ id: "r1", name: "Mortgage", amount: 14155, day: 28 }],
    },
    ledger: {
      accounts: [
        { id: "a", name: "中銀", kind: "payment", currency: "HKD", balance: 0, mortgage: 0 },
        { id: "b", name: "Cash", kind: "payment", currency: "HKD", balance: 0, mortgage: 0 },
        {
          id: "p",
          name: "海欣花園",
          kind: "property",
          currency: "HKD",
          balance: 5940000,
          mortgage: 2912956.52,
        },
      ],
      rates: { USD: 0.127541, JPY: 20.25 },
      transactions: [
        {
          id: "1",
          iso: "2021-07-11",
          account: "中銀",
          category: "",
          description: "→ Cash",
          type: "transfer",
          currency: "HKD",
          amountOriginal: 400,
          amountHKD: 400,
        },
        {
          id: "2",
          iso: "2021-07-11",
          account: "Cash",
          category: "",
          description: "← 中銀",
          type: "transfer",
          currency: "HKD",
          amountOriginal: 400,
          amountHKD: 400,
        },
        {
          id: "3",
          iso: "2021-07-11",
          account: "Cash",
          category: "外出就餐 外出就餐",
          description: "壽司",
          type: "expense",
          currency: "HKD",
          amountOriginal: 215,
          amountHKD: 215,
        },
        {
          id: "4",
          iso: "2021-07-12",
          account: "中銀",
          category: "收入: 工資",
          description: "薪",
          type: "income",
          currency: "HKD",
          amountOriginal: 1000,
          amountHKD: 1000,
        },
      ],
    },
  };

  assert.equal(isBtpFile(file), true);
  const snap = convertBtp(file);
  assert.equal(snap.transactions.length, 3);
  assert.equal(snap.transactions.filter((t) => t.type === "transfer").length, 1);
  const xfer = snap.transactions.find((t) => t.type === "transfer");
  assert.equal(xfer?.accountId, "a");
  assert.equal(xfer?.toAccountId, "b");

  const dining = snap.categories.find((c) => c.name === "外出就餐");
  assert.ok(dining);
  assert.equal(dining?.kind, "expense");
  assert.equal(dining?.defaultAccountId, "b");

  const wage = snap.categories.find((c) => c.name.includes("工資"));
  assert.ok(wage);
  assert.equal(wage?.kind, "income");
  assert.equal(wage?.name, "工資");
  const parent = snap.categories.find((c) => c.id === wage?.parentId);
  assert.ok(parent);
  assert.equal(parent?.name, "收入");

  const cash = snap.accounts.find((a) => a.id === "b");
  const bank = snap.accounts.find((a) => a.id === "a");
  assert.equal(cash?.balance, 185);
  assert.equal(bank?.balance, 600);

  const property = snap.accounts.find((a) => a.id === "p");
  assert.equal(property?.balance, 5940000);
  const mortgage = snap.accounts.find((a) => a.id === "p-mortgage");
  assert.equal(mortgage?.balance, -2912956.52);

  const cap = snap.budgets.find((b) => b.id === "b-month-total");
  assert.equal(cap?.monthly, 62000);

  const usd = snap.fxRates.find((r) => r.currency === "USD");
  assert.ok(usd && Math.abs(usd.perHkd - 1 / 0.127541) < 0.0001);
});

test("convertBtp reads budget.transactions when ledger is empty", () => {
  const file = {
    app: "Budget Tracker Pro",
    budget: {
      accounts: [
        { id: "a", name: "Cash", kind: "payment", currency: "HKD", balance: 0, mortgage: 0 },
      ],
      transactions: [
        {
          id: "1",
          iso: "2026-01-02",
          account: "Cash",
          category: "稅務: 薪俸稅",
          description: "",
          type: "expense",
          currency: "HKD",
          amountOriginal: 100,
          amountHKD: 100,
        },
      ],
    },
  };
  assert.equal(isBtpFile(file), true);
  const snap = convertBtp(file);
  assert.equal(snap.transactions.length, 1);
  const parent = snap.categories.find((c) => c.name === "稅務" && !c.parentId);
  const child = snap.categories.find((c) => c.name === "薪俸稅");
  assert.ok(parent);
  assert.ok(child);
  assert.equal(child?.parentId, parent?.id);
  assert.equal(child?.defaultAccountId, "a");
});

test("presetRange and rangeFlow skip transfers", () => {
  const txs: Transaction[] = [
    { id: "1", type: "income", amount: 100, currency: "HKD", accountId: "a", date: "2026-08-01", payee: "s", payeeZh: "s" },
    { id: "2", type: "expense", amount: 40, currency: "HKD", accountId: "a", date: "2026-08-02", payee: "e", payeeZh: "e" },
    { id: "3", type: "transfer", amount: 25, currency: "HKD", accountId: "a", toAccountId: "b", date: "2026-08-03", payee: "t", payeeZh: "t" },
  ];
  const r = presetRange("thisMonth", "2026-08-23", txs);
  assert.equal(r.from, "2026-08-01");
  assert.equal(r.to, "2026-08-31");
  const flow = rangeFlow(txs, [{ currency: "HKD", perHkd: 1, asOf: "2026-08-23", source: "Base" }], r.from, r.to);
  assert.equal(flow.income, 100);
  assert.equal(flow.expense, 40);
});
