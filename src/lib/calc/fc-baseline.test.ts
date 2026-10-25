import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Account, FxRate, Holding, TimeSaving } from "../types.ts";
import { baselineChecks, buildFcBaseline, extractPromoDeposits, migrateBalanceBasis } from "./fc-baseline.ts";

const rates: FxRate[] = [{ currency: "HKD", perHkd: 1, asOf: "2026-10-25", source: "test" }];

const bank: Account = {
  id: "bank",
  name: "Savings",
  nameZh: "儲蓄",
  type: "savings",
  currency: "HKD",
  balance: 220000,
  includeInNetWorth: true,
  group: "cash",
  balanceBasis: "bank_total_incl_deposits",
  ownership: "sole",
};
const broker: Account = {
  id: "broker",
  name: "Broker",
  nameZh: "證券",
  type: "investment",
  currency: "HKD",
  balance: 2000,
  includeInNetWorth: true,
  group: "assets",
  balanceBasis: "holdings_derived",
  holdingSync: true,
};

const deposit: TimeSaving = {
  id: "dep-1",
  bank: "Hang Seng",
  startDate: "2026-03-15",
  endDate: "2026-12-15",
  rate: 3.8,
  currency: "HKD",
  amount: 200000,
  interest: 100,
  accountId: "bank",
};

const holding: Holding = {
  id: "h1",
  symbol: "2800",
  name: "Tracker",
  market: "hk",
  source: "manual",
  quantity: 100,
  currency: "HKD",
  lastPrice: 20,
  avgCost: 18,
  lastPriceAt: "2026-10-25T00:00:00.000Z",
  accountId: "broker",
};

const KEYS = [
  "meta",
  "headline",
  "accounts",
  "deposits",
  "promo_savings",
  "holdings",
  "liabilities",
  "retirement_restricted",
  "annuities",
  "cashflow_period",
  "adhoc_payments",
  "confirmed_facts",
  "open_gaps",
  "checks",
] as const;

describe("fc baseline", () => {
  it("exports the required sections and keeps promo distinct from a time deposit", () => {
    const snap = buildFcBaseline({
      asOf: "2026-10-25",
      accounts: [bank, broker],
      deposits: [deposit],
      promo: [
        {
          id: "promo-marathon",
          accountId: "bank",
          residualHkd: 20000,
          rateSchedule: [{ from: "2026-01-01", to: "2026-12-31", rate: 4 }],
          arrangementEnd: "2026-12-31",
          accessibility: "restricted",
          distinctFromTd: true,
        },
      ],
      holdings: [holding],
      mortgage: null,
      retirementAccounts: [],
      allowances: [],
      adhoc: [],
      rates,
      plans: [],
      txs: [],
      categories: [],
      recurring: [],
      monthCap: 0,
    });
    for (const key of KEYS) assert.ok(key in snap, key);
    assert.equal(snap.meta.snapshot_id, "snap-2026-10-25");
    assert.equal(snap.meta.currency_base, "HKD");
    assert.equal(snap.deposits.some((d) => d.id === "dep-1"), true);
    assert.equal(snap.promo_savings.some((p) => p.id === "promo-marathon" && p.distinct_from_td === true), true);
    assert.equal(snap.deposits.some((d) => d.id === "promo-marathon"), false);
    const line = snap.holdings[0];
    assert.equal(line?.ticker, "2800");
    assert.equal(line?.qty, 100);
    assert.equal(line?.market_value_hkd, 2000);
    assert.equal(line?.cost_hkd, 1800);
    assert.equal("surplus_cons" in snap.cashflow_period, false);
    assert.equal(snap.cashflow_period.label, "MoneyTracker projection");
    assert.equal(snap.cashflow_period.monthly_rows.length, 12);
    assert.match(snap.meta.balance_basis_note, /not the same as accessible cash/);
  });

  it("moves a marathon deposit into promo savings and leaves a normal deposit", () => {
    const marathon: TimeSaving = {
      id: "td-marathon",
      bank: "SCB Marathon",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      rate: 4,
      currency: "HKD",
      amount: 1000,
      interest: 20,
      accountId: "bank",
    };
    const split = extractPromoDeposits([deposit, marathon], [], rates);
    assert.deepEqual(split.deposits.map((d) => d.id), ["dep-1"]);
    assert.equal(split.promo[0]?.id, "promo-td-marathon");
    assert.equal(split.promo[0]?.distinctFromTd, true);
    assert.equal(split.promo[0]?.residualHkd, 1000);
    assert.notEqual(split.promo[0]?.arrangementEnd, deposit.endDate);
  });

  it("leaves cost empty when average cost was not entered", () => {
    const snap = buildFcBaseline({
      asOf: "2026-10-25",
      accounts: [broker],
      deposits: [],
      promo: [],
      holdings: [{ ...holding, avgCost: undefined }],
      mortgage: null,
      retirementAccounts: [],
      allowances: [],
      adhoc: [],
      rates,
      plans: [],
      txs: [],
      categories: [],
      recurring: [],
      monthCap: 0,
    });
    assert.equal(snap.holdings[0]?.cost_hkd, null);
    assert.equal(snap.holdings[0]?.ticker, "2800");
  });

  it("does not invent an accessible basis, and warns when derived holdings are missing", () => {
    const missing = { id: "x", name: "X", nameZh: "甲", type: "savings", currency: "HKD", balance: 1, includeInNetWorth: true, group: "cash" } as Account;
    const emptyBook: Account = {
      id: "book",
      name: "Book",
      nameZh: "證券",
      type: "investment",
      currency: "HKD",
      balance: 1,
      includeInNetWorth: true,
      group: "assets",
      balanceBasis: "holdings_derived",
      holdingSync: true,
      stockBook: "us",
    };
    assert.equal(migrateBalanceBasis([missing])[0]?.balanceBasis, "unverified");
    const checks = baselineChecks([emptyBook], [holding]);
    assert.equal(checks.some((c) => c.code === "holdings_derived_empty" && c.account_id === "book"), true);
    const missingCheck = baselineChecks([missing], []);
    assert.equal(missingCheck.some((c) => c.code === "missing_balance_basis"), true);
  });
});
