import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adhocFromTx, findPairedAdhoc, findPairedTx, txFromAdhoc } from "./adhoc-link.ts";
import type { AdhocBudget, Transaction } from "./types.ts";

function tx(partial: Partial<Transaction> & Pick<Transaction, "id">): Transaction {
  return {
    type: "expense",
    amount: 80,
    currency: "HKD",
    accountId: "cash",
    date: "2026-11-15",
    payee: "Lunch",
    payeeZh: "午餐",
    adhoc: true,
    ...partial,
  };
}

function hold(partial: Partial<AdhocBudget> & Pick<AdhocBudget, "id">): AdhocBudget {
  return {
    label: "Lunch",
    labelZh: "午餐",
    amount: 80,
    currency: "HKD",
    month: "2026-11",
    date: "2026-11-15",
    ...partial,
  };
}

describe("adhoc pairing", () => {
  it("renaming an expense still finds the one-off from the previous label", () => {
    const before = tx({ id: "t1" });
    const renamed = tx({ id: "t1", payee: "Late lunch", payeeZh: "遲午餐" });
    const row = hold({ id: "a1" });
    const hit = findPairedAdhoc([row], renamed, before);
    assert.equal(hit?.id, "a1");
    const next = adhocFromTx(renamed, hit, "2026-11-15");
    assert.equal(next.label, "Late lunch");
    assert.equal(next.labelZh, "遲午餐");
    assert.equal(next.txId, "t1");
    assert.equal(next.paidOn, "2026-11-15");
  });

  it("turning a normal expense into a one-off does not steal an unrelated row", () => {
    const before = tx({ id: "t1", adhoc: false, payee: "Lunch", payeeZh: "午餐" });
    const now = tx({ id: "t1", adhoc: true });
    const row = hold({ id: "a1" });
    assert.equal(findPairedAdhoc([row], now, before), undefined);
    const created = adhocFromTx(now, undefined, "2026-11-15");
    assert.equal(created.label, "Lunch");
    assert.notEqual(created.id, "a1");
  });

  it("renaming a one-off still finds the expense from the previous label", () => {
    const row = hold({ id: "a1", label: "Coffee", labelZh: "咖啡" });
    const before = hold({ id: "a1" });
    const expense = tx({ id: "t1" });
    const hit = findPairedTx([expense], row, before);
    assert.equal(hit?.id, "t1");
    const next = txFromAdhoc(hit!, row);
    assert.equal(next.payee, "Coffee");
    assert.equal(next.payeeZh, "咖啡");
    assert.equal(next.adhocId, "a1");
  });

  it("a normal expense does not pair with a same-name one-off", () => {
    const expense = tx({ id: "t1", adhoc: false });
    assert.equal(findPairedAdhoc([hold({ id: "a1" })], expense), undefined);
  });
  it("a future one-off stays unpaid until that day", () => {
    const future = tx({ id: "t1", date: "2026-11-20", planned: true });
    const row = adhocFromTx(future, undefined, "2026-11-15");
    assert.equal(row.paidOn, undefined);
    assert.equal(row.date, "2026-11-20");
  });
});
