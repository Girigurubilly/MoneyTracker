import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  depositDayCount,
  getMonthlyDepositInterest,
  suggestedInterest,
  summarizeDeposits,
  yearlyProjection,
  yearMonthKey,
} from "./deposits.ts";
import type { FxRate, TimeSaving } from "../types.ts";

const rates: FxRate[] = [
  { currency: "USD", perHkd: 7.8, asOf: "2026-09-01", source: "test" },
];

const dep = (partial: Partial<TimeSaving> & Pick<TimeSaving, "id" | "endDate">): TimeSaving => ({
  bank: "HSBC",
  startDate: "2026-01-01",
  rate: 4,
  currency: "HKD",
  amount: 100000,
  interest: 1000,
  accountId: "cash",
  ...partial,
});

describe("deposits", () => {
  it("counts inclusive-exclusive calendar days between ISO dates", () => {
    assert.equal(depositDayCount("2026-03-15", "2026-12-15"), 275);
    assert.equal(depositDayCount("2026-01-01", "2026-01-01"), 0);
  });

  it("suggests simple interest on a 365-day year", () => {
    assert.equal(suggestedInterest(200000, 3.8, "2026-03-15", "2026-12-15"), 5726.03);
  });

  it("summarizes active vs realized interest in HKD", () => {
    const list = [
      dep({ id: "open", endDate: "2026-12-01", amount: 100000, interest: 2000 }),
      dep({ id: "done", endDate: "2026-06-01", amount: 50000, interest: 500 }),
      dep({ id: "usd", endDate: "2027-03-01", currency: "USD", amount: 1000, interest: 10 }),
    ];
    const s = summarizeDeposits(list, "2026-09-03", rates);
    assert.equal(s.depHKD, 100000 + 7800);
    assert.equal(s.intHKD, 2000 + 500 + 78);
    assert.equal(s.realizedHKD, 500);
    assert.equal(s.unrealizedThisYearHKD, 2000);
    assert.equal(s.unrealizedAfterYearHKD, 78);
  });

  it("attributes maturity-month interest in HKD for any currency", () => {
    const list = [
      dep({ id: "hkd", endDate: "2026-12-15", interest: 100 }),
      dep({ id: "usd", endDate: "2026-12-20", currency: "USD", interest: 10 }),
      dep({ id: "other", endDate: "2026-11-01", interest: 999 }),
    ];
    assert.equal(getMonthlyDepositInterest(list, 2026, 11, rates), 100 + 78);
    assert.equal(yearMonthKey(2026, 11), "2026-12");
  });

  it("builds a 12-month yearly projection with as-of-now totals", () => {
    const plans = [
      { id: "2026-01", salary: 10000, other: 0, expense: 4000 },
      { id: "2026-09", salary: 10000, other: 500, expense: 4000 },
    ];
    const list = [dep({ id: "d", endDate: "2026-09-20", interest: 200 })];
    const y = yearlyProjection(plans, list, rates, 2026, 8);
    assert.equal(y.rows.length, 12);
    assert.equal(y.rows[8].income, 10700);
    assert.equal(y.rows[8].saving, 6700);
    assert.equal(y.rows[8].isCurrent, true);
    assert.equal(y.yearIncome, 10000 + 10700);
    assert.equal(y.asOfIncome, 10000 + 10700);
    assert.equal(y.asOfExpense, 8000);
  });
});
