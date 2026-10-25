import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Account, PurposeAllocation, RetirementAccount, TimeSaving } from "../types.ts";
import {
  acceptChange,
  allocatableSurplus,
  allocationClashesAgainst,
  buildDiscussionSnapshot,
  countsOnce,
  migrateAccount,
  migrateDeposit,
  renderDiscussionJson,
  renderDiscussionMarkdown,
  retirementOnce,
  viewDeposit,
} from "./baseline.ts";
import { emptyLifePlan, employedMonthsInYear, estimateHkNetMonthly, mortgageMonthsInYear, runLifePlan, unemployedMonthsInYear } from "./life-plan.ts";

function bank(partial: Partial<Account> = {}): Account {
  return {
    id: "bank",
    name: "Salary",
    nameZh: "出糧",
    type: "current",
    currency: "HKD",
    balance: 100_000,
    includeInNetWorth: true,
    group: "cash",
    balanceBasis: "bank_total",
    verified: true,
    balanceAsOf: "2026-10-01",
    balanceSource: "statement",
    ...partial,
  };
}

function deposit(partial: Partial<TimeSaving> = {}): TimeSaving {
  return {
    id: "td",
    bank: "SC",
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    rate: 3,
    currency: "HKD",
    amount: 100_000,
    interest: 3_000,
    accountId: "bank",
    principalInclusion: "included",
    lifecycle: "active",
    rateStatus: "verified",
    product: "term",
    ...partial,
  };
}

describe("reconciled baseline", () => {
  it("A. counts a fully invested bank balance once and not as cash you can spend", () => {
    const row = countsOnce(bank(), [deposit()]);
    assert.equal(row.net, 100_000);
    assert.equal(row.accessible, 0);
  });

  it("B. keeps matured principal locked until payout, and records interest once", () => {
    const waiting = viewDeposit(deposit({ endDate: "2026-01-15", lifecycle: "active" }), "2026-02-01");
    assert.equal(waiting.lifecycle, "matured_unconfirmed");
    assert.equal(waiting.principalBecomesCash, false);
    assert.equal(waiting.interestIncome, 0);
    const paid = viewDeposit(deposit({ lifecycle: "paid_out", interest: 3_000 }), "2026-02-01");
    assert.equal(paid.principalBecomesCash, true);
    assert.equal(paid.accessiblePrincipal, 100_000);
    assert.equal(paid.interestIncome, 3_000);
  });

  it("C. changes a promotional rate without moving the principal", () => {
    const row = viewDeposit(
      deposit({ product: "promotional", promoEnds: "2026-06-01", postPromoRate: 0.5, rateStatus: "unknown", lifecycle: "active" }),
      "2026-07-01",
    );
    assert.equal(row.lifecycle, "active");
    assert.equal(row.rate, 0.5);
    assert.equal(row.principalStaysPut, true);
    assert.equal(row.principalBecomesCash, false);
  });

  it("D. leaves only surplus after bills, tax and reserves, without subtracting them twice", () => {
    const once = allocatableSurplus({
      salary: 50_000,
      bills: 20_000,
      cardPayments: 4_000,
      tax: 3_000,
      operatingNeed: 8_000,
      approvedReserves: 5_000,
      cardAlreadyInBills: true,
      taxAlreadyInBills: true,
    });
    const twice = allocatableSurplus({
      salary: 50_000,
      bills: 20_000,
      cardPayments: 4_000,
      tax: 3_000,
      operatingNeed: 8_000,
      approvedReserves: 5_000,
    });
    assert.equal(once, 17_000);
    assert.equal(twice, 10_000);
  });

  it("E. flags the same funds allocated to two purposes", () => {
    const rows: PurposeAllocation[] = [
      { id: "a", purpose: "tax", amount: 60, currency: "HKD", refType: "account", refId: "bank", availableBy: "2026-12-01", status: "approved", updatedAt: "2026-10-01" },
      { id: "b", purpose: "career", amount: 60, currency: "HKD", refType: "account", refId: "bank", availableBy: "2026-12-01", status: "approved", updatedAt: "2026-10-01" },
    ];
    const clashes = allocationClashesAgainst(rows, [{ refType: "account", refId: "bank", amount: 100 }]);
    assert.equal(clashes.length, 1);
    assert.equal(clashes[0].allocated, 120);
  });

  it("F. includes a linked retirement balance once and still shows the access age", () => {
    const retirement = {
      id: "mpf",
      name: "MPF",
      type: "MPF",
      currency: "HKD",
      currentBalance: 80_000,
      balanceAsOf: "2026-10-01",
      status: "active",
      accessibleAge: 65,
      accessRule: "age_based",
      contributionFrequency: "monthly",
      employeeContributionAmount: 0,
      employerContributionAmount: 0,
      voluntaryContributionAmount: 0,
      employeeContributionGrowthRate: 0,
      employerContributionGrowthRate: 0,
      voluntaryContributionGrowthRate: 0,
      expectedAnnualReturnRate: 0,
      withdrawalStrategy: "do_not_use_in_projection",
      includeInRetirementProjection: true,
      representedByAccountId: "mpf-acct",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    } satisfies RetirementAccount;
    const account = bank({ id: "mpf-acct", type: "mpf", group: "assets", balance: 80_000 });
    const row = retirementOnce([account], [retirement]);
    assert.equal(row.additional, 0);
    assert.equal(row.restricted[0].included, true);
    assert.equal(row.restricted[0].accessAge, 65);
  });

  it("I. writes the same totals in markdown and json and keeps unknowns", () => {
    const snap = buildDiscussionSnapshot({
      asOf: "2026-10-25",
      accounts: [bank({ verified: false, balanceBasis: undefined })],
      deposits: [deposit({ principalInclusion: undefined, rateStatus: undefined, rate: 0 })],
    });
    const md = renderDiscussionMarkdown(snap);
    const parsed = JSON.parse(renderDiscussionJson(snap)) as typeof snap;
    assert.equal(parsed.position.net, snap.position.net);
    assert.match(md, new RegExp(String(snap.position.net)));
    assert.ok(snap.warnings.some((w) => w.startsWith("inclusion-unknown")));
    assert.equal(snap.deposits[0].rateLabel, "unknown");
  });

  it("J. migrates legacy rows without inventing a confirmed fact", () => {
    const legacy = bank({ balanceBasis: undefined, verified: undefined, planningShare: undefined, availableConfirmed: undefined });
    const next = migrateAccount(legacy);
    assert.equal(next.balanceBasis, "unverified");
    assert.equal(next.verified, false);
    assert.equal(next.planningShare, undefined);
    assert.equal(next.availableConfirmed, undefined);
    assert.equal(next.balance, legacy.balance);
    const dep = migrateDeposit(deposit({ lifecycle: undefined, principalInclusion: undefined, rate: 0, rateStatus: undefined }));
    assert.equal(dep.principalInclusion, "unknown");
    assert.equal(dep.rateStatus, "unknown");
  });

  it("does not let a proposal replace an approved decision", () => {
    const approved = {
      id: "spend",
      version: 1,
      effectiveDate: "2026-01-01",
      source: "user",
      previous: "",
      next: "40000",
      description: "retirement spending",
      status: "approved" as const,
    };
    const proposal = { ...approved, version: 2, next: "90000", status: "proposal" as const };
    assert.equal(acceptChange([approved], proposal).length, 1);
    assert.equal(acceptChange([approved], proposal)[0].status, "approved");
  });
});

describe("monthly employment and mortgage", () => {
  it("G. leaves six months without salary when work ends in July and resumes in January", () => {
    assert.equal(unemployedMonthsInYear(2026, "2026-07-01", "2027-01-01"), 6);
    assert.equal(employedMonthsInYear(2026, "2026-07-01", null), 6);
    const plan = emptyLifePlan();
    plan.personal.dateOfBirth = "1980-01-15";
    plan.personal.planStartDate = "2025-01-15";
    plan.personal.planEndAge = 47;
    plan.assets.financialAssets = 0;
    plan.retirement.annualInvestmentReturn = 0;
    plan.retirement.annualInflationRate = 0;
    plan.currentJob.endDate = "2026-07-01";
    plan.currentJob.grossMonthlyIncome = 30_000;
    plan.currentJob.actualMonthlySpending = 10_000;
    plan.lowerStressJob.enabled = false;
    const year = runLifePlan(plan, "2025-01-15").stay?.years.find((y) => y.calendarYear === 2026);
    assert.equal(year?.income, estimateHkNetMonthly(30_000) * 6);
  });

  it("H. stops mortgage payments in the month the loan ends", () => {
    assert.equal(mortgageMonthsInYear(2026, "2026-06-30"), 6);
    assert.equal(mortgageMonthsInYear(2035, "2035-01-01"), 0);
    const plan = emptyLifePlan();
    plan.personal.dateOfBirth = "1980-01-15";
    plan.personal.planStartDate = "2025-01-15";
    plan.personal.planEndAge = 47;
    plan.assets.financialAssets = 0;
    plan.retirement.annualInvestmentReturn = 0;
    plan.retirement.annualInflationRate = 0;
    plan.currentJob.endDate = "2030-12-31";
    plan.currentJob.grossMonthlyIncome = 0;
    plan.mortgage.enabled = true;
    plan.mortgage.monthlyPayment = 1_000;
    plan.mortgage.endDate = "2026-06-30";
    plan.mortgage.paymentIncludedInCurrentSpending = false;
    const year = runLifePlan(plan, "2025-01-15").stay?.years.find((y) => y.calendarYear === 2026);
    assert.equal(year?.mortgage, 6_000);
  });
});
