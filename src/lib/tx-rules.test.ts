import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTxRules, infersHousing } from "./tx-rules.ts";
import { housingTransactions } from "./calc/housing.ts";
import type { Account, Category, Transaction } from "./types.ts";

const cats: Category[] = [
  { id: "p-housing", name: "Housing", nameZh: "房屋", theme: "living", kind: "expense", icon: "home" },
  { id: "mortgage-p", name: "Mortgage principal", nameZh: "按揭本金", theme: "living", kind: "expense", icon: "home", parentId: "p-housing" },
  { id: "mortgage-i", name: "Mortgage interest", nameZh: "按揭利息", theme: "living", kind: "expense", icon: "home", parentId: "p-housing" },
  { id: "mgmt", name: "Management fee", nameZh: "管理費", theme: "living", kind: "expense", icon: "building", parentId: "p-housing" },
  { id: "dining", name: "Dining", nameZh: "外出就餐", theme: "living", kind: "expense", icon: "utensils" },
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
