import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTxRules, infersAdhoc, infersHousing } from "./tx-rules.ts";
import { housingTransactions } from "./calc/housing.ts";
import type { Account, Category, Transaction } from "./types.ts";

const cats: Category[] = [
  { id: "p-housing", name: "Housing", nameZh: "房屋", theme: "living", kind: "expense", icon: "home" },
  { id: "mortgage-p", name: "Mortgage principal", nameZh: "按揭本金", theme: "living", kind: "expense", icon: "home", parentId: "p-housing" },
  { id: "mortgage-i", name: "Mortgage interest", nameZh: "按揭利息", theme: "living", kind: "expense", icon: "home", parentId: "p-housing" },
  { id: "mgmt", name: "Management fee", nameZh: "管理費", theme: "living", kind: "expense", icon: "building", parentId: "p-housing" },
  { id: "dining", name: "Dining", nameZh: "外出就餐", theme: "living", kind: "expense", icon: "utensils" },
  { id: "p-gadget", name: "Gadgets", nameZh: "電子", theme: "living", kind: "expense", icon: "phone", adhocDefault: true },
  { id: "phone", name: "Phone", nameZh: "手機", theme: "living", kind: "expense", icon: "phone", parentId: "p-gadget" },
  { id: "repair", name: "Repair", nameZh: "維修", theme: "living", kind: "expense", icon: "phone", parentId: "p-gadget", adhocDefault: false },
];

const accounts: Account[] = [
  { id: "cash", name: "Cash", nameZh: "現金", type: "cash", currency: "HKD", balance: 10000, includeInNetWorth: true, group: "cash" },
  { id: "mortgage", name: "Mortgage", nameZh: "按揭", type: "mortgage", currency: "HKD", balance: -200000, includeInNetWorth: true, group: "housing" },
];

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "type" | "amount" | "date">): Transaction {
  return {
    currency: "HKD",
    accountId: "cash",
    payee: partial.payee ?? partial.id,
    payeeZh: partial.payeeZh ?? partial.payee ?? partial.id,
    ...partial,
  };
}

describe("applyTxRules", () => {
  it("turns 本金 into a spend-like transfer to the loan", () => {
    const next = applyTxRules(
      {
        type: "expense",
        amount: 9600,
        accountId: "cash",
        categoryId: "mortgage-p",
      },
      { categories: cats, accounts },
    );
    assert.equal(next.type, "transfer");
    assert.equal(next.countsAsExpense, true);
    assert.equal(next.toAccountId, "mortgage");
    assert.equal(next.destAmount, 9600);
    assert.equal(next.housing, true);
  });

  it("keeps an explicit housing:false on principal", () => {
    const next = applyTxRules(
      {
        type: "expense",
        amount: 100,
        accountId: "cash",
        categoryId: "mortgage-p",
        housing: false,
      },
      { categories: cats, accounts },
    );
    assert.equal(next.type, "transfer");
    assert.equal(next.housing, false);
  });

  it("tags mortgage interest as housing expense", () => {
    const next = applyTxRules(
      {
        type: "expense",
        amount: 4980,
        accountId: "cash",
        categoryId: "mortgage-i",
      },
      { categories: cats, accounts },
    );
    assert.equal(next.type, "expense");
    assert.equal(next.housing, true);
    assert.equal(next.toAccountId, undefined);
  });

  it("does not infer housing on dining", () => {
    assert.equal(infersHousing("dining", cats), false);
    const next = applyTxRules(
      { type: "expense", amount: 80, accountId: "cash", categoryId: "dining" },
      { categories: cats, accounts },
    );
    assert.equal(next.housing, undefined);
    assert.equal(next.type, "expense");
  });

  it("inherits ad-hoc default from the category, with child override", () => {
    assert.equal(infersAdhoc("p-gadget", cats), true);
    assert.equal(infersAdhoc("phone", cats), true);
    assert.equal(infersAdhoc("repair", cats), false);
    assert.equal(infersAdhoc("dining", cats), false);
    const tagged = applyTxRules({ type: "expense", amount: 800, accountId: "cash", categoryId: "phone" }, { categories: cats, accounts });
    assert.equal(tagged.adhoc, true);
    const off = applyTxRules({ type: "expense", amount: 80, accountId: "cash", categoryId: "phone", adhoc: false }, { categories: cats, accounts });
    assert.equal(off.adhoc, false);
  });
});

describe("housingTransactions flag", () => {
  const rows: Transaction[] = [
    tx({ id: "p", type: "transfer", amount: 9600, date: "2026-08-01", categoryId: "mortgage-p", countsAsExpense: true, housing: true, toAccountId: "mortgage" }),
    tx({ id: "dine", type: "expense", amount: 50, date: "2026-08-02", categoryId: "dining", housing: true }),
    tx({ id: "mgmt-off", type: "expense", amount: 2180, date: "2026-08-03", categoryId: "mgmt", housing: false }),
    tx({ id: "mgmt", type: "expense", amount: 2180, date: "2026-08-04", categoryId: "mgmt" }),
  ];

  it("includes flagged spend and category housing, excludes housing:false", () => {
    const got = housingTransactions(rows, cats, "2026-08-01", "2026-08-31").map((t) => t.id);
    assert.deepEqual(got, ["mgmt", "dine", "p"]);
  });
});
