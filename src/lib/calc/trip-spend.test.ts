import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAutoTrip, effectiveAnnualTravelBudget, travelSpendYtd, travelSpendYtdSplit, travelUnlinkedTxs, tripCashSpent, tripDayIndex, tripDaySpent, tripMoneySplit } from "./trips.ts";
import type { AdhocBudget, Transaction, Trip } from "../types.ts";

describe("trip spend", () => {
  it("sums posted trip expense for one day only", () => {
    const txs = [
      { id: "a", type: "expense", tripId: "osaka", amount: 100, currency: "HKD", date: "2026-04-02", planned: false },
      { id: "b", type: "expense", tripId: "osaka", amount: 30, currency: "HKD", date: "2026-04-02", planned: true },
      { id: "c", type: "expense", tripId: "kyoto", amount: 7, currency: "HKD", date: "2026-04-02", planned: false },
      { id: "d", type: "income", tripId: "osaka", amount: 5, currency: "HKD", date: "2026-04-02", planned: false },
      { id: "e", type: "expense", tripId: "osaka", amount: 9, currency: "HKD", date: "2026-04-03", planned: false },
    ] as Transaction[];
    assert.equal(tripDaySpent(txs, "osaka", "2026-04-02", []), 100);
  });

  it("indexes trip days inclusively", () => {
    assert.deepEqual(tripDayIndex({ start: "2026-03-30", end: "2026-04-02" }, "2026-04-01"), { day: 3, total: 4 });
    assert.deepEqual(tripDayIndex({ start: "2026-04-02", end: "2026-04-02" }, "2026-04-02"), { day: 1, total: 1 });
  });

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

  it("auto-links only travel-themed categories inside trip dates", () => {
    const trips = [{ id: "t1", name: "Osaka", nameZh: "大阪", start: "2026-04-01", end: "2026-04-05", cashBudget: 5000, status: "planning" }] as Trip[];
    const travelIds = new Set(["flights", "hotels"]);
    const flight = {
      id: "f", type: "expense", amount: 100, currency: "HKD", date: "2026-04-02", categoryId: "flights", planned: false,
    } as Transaction;
    const dinner = {
      id: "d", type: "expense", amount: 80, currency: "HKD", date: "2026-04-02", categoryId: "dining", planned: false,
    } as Transaction;
    assert.equal(applyAutoTrip(flight, trips, travelIds).tripId, "t1");
    assert.equal(applyAutoTrip(dinner, trips, travelIds).tripId, undefined);
    // Without the allow-list, legacy behaviour still date-matches (callers must pass ids).
    assert.equal(applyAutoTrip(dinner, trips).tripId, "t1");
  });

  it("falls back to trip cash budgets when annual travel budget is unset", () => {
    const trips = [
      { id: "a", name: "A", nameZh: "A", start: "2026-03-01", end: "2026-03-05", cashBudget: 3000, status: "planning" },
      { id: "b", name: "B", nameZh: "B", start: "2026-08-01", end: "2026-08-10", cashBudget: 2000, status: "planning" },
      { id: "c", name: "C", nameZh: "C", start: "2025-12-01", end: "2025-12-05", cashBudget: 9000, status: "planning" },
    ] as Trip[];
    assert.deepEqual(effectiveAnnualTravelBudget(0, trips, 2026), { budget: 5000, fromTrips: true });
    assert.deepEqual(effectiveAnnualTravelBudget(12000, trips, 2026), { budget: 12000, fromTrips: false });
  });
});
