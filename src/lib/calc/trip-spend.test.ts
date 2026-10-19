import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tripCashSpent } from "./trips.ts";
import type { AdhocBudget, Transaction } from "../types.ts";

describe("trip spend", () => {
  it("counts an unpaid trip cost and skips one already posted", () => {
    const txs = [{ id: "t", type: "expense", tripId: "osaka", amount: 100, currency: "HKD", date: "2026-04-02", planned: false }] as Transaction[];
    const adhoc = [
      { id: "a", tripId: "osaka", amount: 40, currency: "HKD", date: "2026-04-03", month: "2026-04", label: "午餐", labelZh: "午餐" },
      { id: "b", tripId: "osaka", amount: 20, currency: "HKD", date: "2026-04-02", month: "2026-04", label: "已付", labelZh: "已付", paidOn: "2026-04-02" },
      { id: "c", tripId: "kyoto", amount: 9, currency: "HKD", date: "2026-04-04", month: "2026-04", label: "其他", labelZh: "其他" },
    ] as AdhocBudget[];
    assert.equal(tripCashSpent(txs, "osaka", [], adhoc), 140);
  });
});
