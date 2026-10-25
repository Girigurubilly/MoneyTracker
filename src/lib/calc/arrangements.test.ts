import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Account, Mortgage, ProductArrangement } from "../types.ts";
import { buildDiscussionSnapshot } from "./baseline.ts";
import { allocationClashesAgainst } from "./baseline.ts";
import { assetsAddedByArrangements, interestEstimate, reconcileParent, reviewArrangements } from "./arrangements.ts";

function parent(balance = 100_000): Account {
  return {
    id: "bank",
    name: "Bank",
    nameZh: "銀行",
    type: "savings",
    currency: "HKD",
    balance,
    includeInNetWorth: true,
    group: "cash",
    balanceBasis: "bank_total",
    verified: true,
  };
}

function mortgage(partial: Partial<Mortgage> = {}): Mortgage {
  return {
    id: "loan",
    name: "Mortgage",
    nameZh: "按揭",
    accountId: "loan-acct",
    original: 1_000_000,
    outstanding: 400_000,
    rate: 0.02,
    remainingMonths: 120,
    paymentDay: 1,
    type: "fixed",
    ...partial,
  };
}

function promo(partial: Partial<ProductArrangement> = {}): ProductArrangement {
  return {
    id: "promo",
    kind: "promotional_savings",
    structure: "marathon",
    name: "Promotional savings",
    parentAccountId: "bank",
    attributedBalance: 36_500,
    countsInParent: "included",
    currency: "HKD",
    startDate: "2026-01-01",
    rateSchedule: [{ id: "s1", from: "2026-01-01", to: "2026-06-30", annualRate: 0.01, status: "verified" }],
    rateExpiry: "2026-06-30",
    withdrawal: { note: "recorded by the user", status: "verified" },
    interestCreditDates: ["2026-06-30"],
    postPromoRate: null,
    postPromoStatus: "unknown",
    eligible: { note: "up to the cap", status: "verified", minimumBalance: null, cap: 36_500, capStatus: "verified", newFundsOnly: false },
    dayCount: "actual/365",
    mortgageId: null,
    rateSource: "schedule",
    mortgageSpread: null,
    mortgageSpreadStatus: "unknown",
    capBasis: "stated",
    capGroup: "",
    capAllocation: null,
    capAllocationStatus: "unknown",
    excessRate: null,
    excessRateStatus: "unknown",
    terms: [],
    dailyBalances: [],
    termsVerifiedAt: "2026-01-01",
    termsStatus: "verified",
    reviewBy: null,
    ...partial,
  };
}

describe("product arrangements", () => {
  it("does not add an asset when an arrangement is attached", () => {
    const account = parent();
    const row = promo();
    const snap = buildDiscussionSnapshot({ asOf: "2026-03-01", accounts: [account], deposits: [], arrangements: [row] });
    assert.equal(assetsAddedByArrangements([row]), 0);
    assert.equal(snap.position.assets, 100_000);
    assert.equal(snap.arrangements[0].extraAssets, 0);
    assert.equal(snap.arrangements[0].principalMatures, false);
    assert.equal(snap.arrangements[0].interest.postsTransaction, false);
  });

  it("reconciles several arrangements inside one parent without counting them twice", () => {
    const account = parent(100);
    const a = promo({ id: "a", attributedBalance: 60, eligible: { ...promo().eligible, cap: 60 } });
    const b = promo({ id: "b", attributedBalance: 40, eligible: { ...promo().eligible, cap: 40 } });
    const rec = reconcileParent(account, [a, b]);
    assert.equal(rec.includedSum, 100);
    assert.equal(rec.difference, 0);
    assert.equal(rec.extraAssets, 0);
    const snap = buildDiscussionSnapshot({ asOf: "2026-03-01", accounts: [account], deposits: [], arrangements: [a, b] });
    assert.equal(snap.position.assets, 100);
  });

  it("treats rate expiry as a rate change, not a principal payout", () => {
    const account = parent();
    const before = account.balance;
    const row = promo();
    const reviewed = reviewArrangements({ arrangements: [row], accounts: [account], asOf: "2026-07-01" });
    assert.equal(account.balance, before);
    assert.ok(reviewed.alerts.some((a) => a.code === "promo-expired"));
    assert.equal(reviewed.views[0].rateLabel, "unknown");
    assert.equal(reviewed.extraAssets, 0);
    const estimate = interestEstimate(row, [], { from: "2026-07-01", to: "2026-07-01" });
    assert.equal(estimate.amount, null);
    assert.equal(estimate.principalMovement, 0);
    assert.equal(estimate.quality, "unavailable");
  });

  it("does not assume an unverified post-promotion rate or an unknown eligibility", () => {
    const unknown = promo({
      eligible: { note: "", status: "unknown", minimumBalance: null, cap: null, capStatus: "unknown", newFundsOnly: null },
      termsStatus: "unknown",
      termsVerifiedAt: null,
    });
    const estimate = interestEstimate(unknown, [], { from: "2026-03-01", to: "2026-03-01" });
    assert.equal(estimate.amount, null);
    assert.notEqual(estimate.amount, 0);
    const reviewed = reviewArrangements({ arrangements: [unknown], accounts: [parent()], asOf: "2026-03-01" });
    assert.ok(reviewed.alerts.some((a) => a.code === "eligibility-unknown"));
    assert.ok(reviewed.alerts.some((a) => a.code === "cap-unknown"));
  });

  it("updates a mortgage-linked estimate when the loan rate or balance changes, without posting either", () => {
    const loan = mortgage({ outstanding: 100_000, rate: 0.02 });
    const row = promo({
      id: "offset",
      kind: "mortgage_linked_savings",
      structure: "generic",
      mortgageId: "loan",
      rateSource: "mortgage",
      mortgageSpread: 0,
      mortgageSpreadStatus: "verified",
      capBasis: "mortgage_outstanding",
      terms: [
        {
          id: "t1",
          from: "2026-01-01",
          to: "2026-12-31",
          rateSource: "mortgage",
          spread: 0,
          spreadStatus: "verified",
          cap: null,
          capStatus: "unknown",
          capBasis: "mortgage_outstanding",
          excessRate: null,
          excessRateStatus: "unknown",
          verifiedAt: "2026-01-01",
        },
      ],
    });
    const first = interestEstimate(row, [loan], { from: "2026-03-01", to: "2026-03-01" });
    assert.equal(first.quality, "estimate");
    assert.equal(first.savingsInterest, 2);
    assert.equal(first.mortgageInterestExpense, null);
    assert.equal(first.mortgagePrincipalDelta, 0);
    const later = mortgage({ outstanding: 10_000, rate: 0.04 });
    const second = interestEstimate(row, [later], { from: "2026-03-01", to: "2026-03-01" });
    assert.equal(second.amount, null);
    assert.equal(loan.outstanding, 100_000);
    const withExcess = {
      ...row,
      terms: [{ ...row.terms[0], excessRate: 0, excessRateStatus: "verified" as const }],
    };
    const third = interestEstimate(withExcess, [later], { from: "2026-03-01", to: "2026-03-01" });
    assert.equal(third.savingsInterest, 1.1);
    assert.equal(later.outstanding, 10_000);
  });

  it("flags a cap breach and a shared-cap clash without moving balances", () => {
    const account = parent(80_000);
    const over = promo({ attributedBalance: 50_000, eligible: { ...promo().eligible, cap: 40_000 } });
    const one = reviewArrangements({ arrangements: [over], accounts: [account], asOf: "2026-03-01" });
    assert.ok(one.alerts.some((a) => a.code === "cap-breach"));
    assert.equal(account.balance, 80_000);
    const left = promo({
      id: "left",
      capGroup: "shared",
      capAllocation: 60,
      capAllocationStatus: "verified",
      attributedBalance: 60,
      eligible: { ...promo().eligible, cap: 100 },
    });
    const right = promo({
      id: "right",
      parentAccountId: "other",
      capGroup: "shared",
      capAllocation: 50,
      capAllocationStatus: "verified",
      attributedBalance: 50,
      eligible: { ...promo().eligible, cap: 100 },
    });
    const other = parent(50);
    other.id = "other";
    const shared = reviewArrangements({ arrangements: [left, right], accounts: [account, other], asOf: "2026-03-01" });
    assert.ok(shared.alerts.some((a) => a.code === "cap-breach" && a.detail === "shared"));
    assert.equal(shared.extraAssets, 0);
  });

  it("uses daily history only when every day is reliable, otherwise labels a point estimate", () => {
    const row = promo({
      dailyBalances: [{ date: "2026-03-01", balance: 36_500, reliable: true }],
    });
    const daily = interestEstimate(row, [], { from: "2026-03-01", to: "2026-03-01" });
    assert.equal(daily.quality, "daily");
    assert.equal(daily.savingsInterest, 1);
    const gap = promo({
      dailyBalances: [{ date: "2026-03-01", balance: 36_500, reliable: true }],
    });
    const mixed = interestEstimate(gap, [], { from: "2026-03-01", to: "2026-03-02" });
    assert.equal(mixed.quality, "estimate");
    const noCount = promo({ dayCount: "unknown" });
    assert.equal(interestEstimate(noCount, [], { from: "2026-03-01", to: "2026-03-01" }).amount, null);
  });

  it("warns when a child account is already in net worth and still adds nothing", () => {
    const account = parent(100);
    const child: Account = { ...parent(40), id: "child", name: "Child" };
    const row = promo({ attributedBalance: 40, childAccountId: "child", countsInParent: "included" });
    const snap = buildDiscussionSnapshot({
      asOf: "2026-03-01",
      accounts: [account, child],
      deposits: [],
      arrangements: [row],
    });
    assert.equal(snap.position.assets, 140);
    assert.ok(snap.warnings.some((w) => w.includes("child-in-net-worth")));
    assert.equal(snap.arrangements[0].extraAssets, 0);
  });

  it("keeps arrangements out of purpose allocations", () => {
    const clashes = allocationClashesAgainst([], [{ refType: "account", refId: "bank", amount: 100 }]);
    assert.equal(clashes.length, 0);
    assert.equal(assetsAddedByArrangements([promo()]), 0);
  });
});
