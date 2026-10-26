import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { travelSpendYtd, travelSpendYtdSplit, travelUnlinkedTxs, tripCashSpent, tripMoneySplit } from "./trips.ts";
import type { AdhocBudget, Transaction } from "../types.ts";

describe("trip spend", () => {
  it("counts an unpaid trip cost and skips one already posted", () => {
    const txs = [
      { id: "t", type: "expense", tripId: "osaka", amount: 100, currency: "HKD", date: "2026-04-02", planned: false },
      { id: "p", type: "expense", tripId: "osaka", amount: 30, currency: "HKD", date: "2026-04-04", planned: true },
    ] as Transaction[];
    const adhoc = [
      { id: "a", tripId: "osaka", amount: 40, currency: "HKD", date: "2026-04-03", month: "2026-04", label: "午餐", labelZh: "午餐" },
      { id: "b", tripId: "osaka", amount: 20, currency: "HKD", date: "2026-04-02", month: "2026-04", label: "已付", labelZh: "已付", paidOn: "2026-04-02" },
      { id: "c", tripId: "kyoto", amount: 9, currency: "HKD", date: "2026-04-04", month: "2026-04", label: "其他", labelZh: "其他" },
    ] as AdhocBudget[];
    assert.equal(tripCashSpent(txs, "osaka", [], adhoc), 170);
    assert.deepEqual(tripMoneySplit(txs, "osaka", [], adhoc), { paid: 100, scheduled: 70, total: 170 });
  });

  it("splits annual travel into linked vs unlinked travel-category", () => {
    const travelIds = new Set(["flights", "hotels", "souvenirs", "travel-meals"]);
    const txs = [
      { id: "a", type: "expense", amount: 1000, currency: "HKD", date: "2026-03-01", categoryId: "flights", planned: false },
      { id: "b", type: "expense", amount: 500, currency: "HKD", date: "2026-03-02", categoryId: "hotels", tripId: "t1", planned: false },
      { id: "c", type: "expense", amount: 200, currency: "HKD", date: "2026-03-03", categoryId: "dining", tripId: "t1", planned: false },
      { id: "d", type: "expense", amount: 50, currency: "HKD", date: "2026-03-04", categoryId: "flights", planned: true },
      { id: "e", type: "expense", amount: 80, currency: "HKD", date: "2025-12-01", categoryId: "flights", planned: false },
    ] as Transaction[];
    const split = travelSpendYtdSplit(txs, 2026, travelIds, []);
    assert.deepEqual(split, { linked: 700, unlinked: 1000, total: 1700 });
    assert.equal(travelSpendYtd(txs, 2026, travelIds, []), 1700);
    assert.deepEqual(
      travelUnlinkedTxs(txs, 2026, travelIds).map((tx) => tx.id),
      ["a"],
    );
  });
});
