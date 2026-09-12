import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blankRetirementAccount, contributionMonthsInYear, projectRetirementAccountYear } from "./mpf.ts";
import { mortgageFlowForYear, mortgageSchedule } from "./mortgage.ts";
import { compareRetirementAges, runRetirementPlan } from "./retirement.ts";
import type { RetirementAccount } from "../types.ts";

function mpf(partial: Partial<RetirementAccount> = {}): RetirementAccount {
  return {
    ...blankRetirementAccount("MPF", "2026-01-01T00:00:00.000Z"),
    id: "mpf-1",
    currentBalance: 500_000,
    employeeContributionAmount: 1500,
    employerContributionAmount: 1500,
    voluntaryContributionAmount: 500,
    expectedAnnualReturnRate: 0.05,
    annualFeeRate: 0.01,
    accessibleAge: 65,
    withdrawalStrategy: "annual_drawdown",
    plannedAnnualWithdrawal: 40_000,
    ...partial,
  };
}

describe("MPF/ORSO projection", () => {
  it("grows while locked and does not withdraw before access age", () => {
    const account = mpf();
    const row = projectRetirementAccountYear({
      account,
      openingBalance: 500_000,
      age: 54,
      calendarYear: 2026,
      yearsSinceStart: 0,
      retireAge: 65,
    });
    assert.equal(row.isAccessible, false);
    assert.equal(row.cashFlowAvailableToRetirementPlan, 0);
    assert.equal(row.withdrawal, 0);
    assert.ok(row.closingBalance > 500_000);
  });

  it("stops contributions at retirement and applies independent growth rates", () => {
    const account = mpf({
      employeeContributionGrowthRate: 0.1,
      employerContributionGrowthRate: 0,
      voluntaryContributionGrowthRate: 0.2,
    });
    const working = projectRetirementAccountYear({
      account,
      openingBalance: 100_000,
      age: 50,
      calendarYear: 2026,
      yearsSinceStart: 2,
      retireAge: 54,
    });
    assert.ok(working.employeeContribution > working.employerContribution);
    assert.ok(working.voluntaryContribution > 0);
    const retired = projectRetirementAccountYear({
      account,
      openingBalance: working.closingBalance,
      age: 55,
      calendarYear: 2031,
      yearsSinceStart: 5,
      retireAge: 54,
    });
    assert.equal(retired.totalContribution, 0);
  });

  it("pro-rates contributions in the retirement year", () => {
    const account = mpf();
    const months = contributionMonthsInYear(account, 2026, 54, 54, "1972-07-15");
    assert.equal(months, 6);
    const row = projectRetirementAccountYear({
      account,
      openingBalance: 100_000,
      age: 54,
      calendarYear: 2026,
      yearsSinceStart: 0,
      retireAge: 54,
      birthday: "1972-07-15",
    });
    assert.ok(row.employeeContribution < 1500 * 12);
    assert.ok(row.employeeContribution > 0);
  });

  it("honours an explicit contribution end date", () => {
    const account = mpf({ contributionEndDate: "2026-03-31" });
    const row = projectRetirementAccountYear({
      account,
      openingBalance: 100_000,
      age: 50,
      calendarYear: 2026,
      yearsSinceStart: 0,
      retireAge: 65,
    });
    assert.equal(row.employeeContribution, 1500 * 3);
  });

  it("starts drawdown only at access age and never goes negative", () => {
    const account = mpf({ plannedAnnualWithdrawal: 5_000_000, withdrawalStrategy: "annual_drawdown" });
    const row = projectRetirementAccountYear({
      account,
      openingBalance: 80_000,
      age: 65,
      calendarYear: 2037,
      yearsSinceStart: 11,
      retireAge: 54,
    });
    assert.equal(row.isAccessible, true);
    assert.ok(row.closingBalance >= 0);
    assert.ok(row.withdrawal <= 80_000 + row.totalContribution);
  });

  it("keeps two accounts with different access ages independent", () => {
    const a = runRetirementPlan(
      {
        currentAge: 54,
        retireAge: 54,
        deathAge: 70,
        monthlyIncomeNow: 0,
        monthlySpendNow: 0,
        targetMonthly: 0,
        preReturn: 0,
        postReturn: 0,
        inflation: 0,
        travelInRetirement: 0,
      },
      {
        investableNow: 100_000,
        mortgageMonthly: 0,
        mortgagePayoffAge: 54,
        housingAfterPayoff: 0,
        oneOffs: [],
        retirementAccounts: [
          mpf({ id: "early", accessibleAge: 60, currentBalance: 10_000, employeeContributionAmount: 0, employerContributionAmount: 0, voluntaryContributionAmount: 0, expectedAnnualReturnRate: 0, annualFeeRate: 0, withdrawalStrategy: "do_not_use_in_projection" }),
          mpf({ id: "late", accessibleAge: 65, currentBalance: 20_000, employeeContributionAmount: 0, employerContributionAmount: 0, voluntaryContributionAmount: 0, expectedAnnualReturnRate: 0, annualFeeRate: 0, withdrawalStrategy: "do_not_use_in_projection" }),
        ],
      },
    );
    const at60 = a.years.find((y) => y.age === 60)!;
    const early = at60.accounts.find((x) => x.retirementAccountId === "early")!;
    const late = at60.accounts.find((x) => x.retirementAccountId === "late")!;
    assert.equal(early.isAccessible, true);
    assert.equal(late.isAccessible, false);
    assert.equal(at60.closingLocked, 30_000);
    assert.equal(at60.closingAccessible, 100_000);
  });
});

describe("mortgage in retirement", () => {
  const loan = {
    outstanding: 120_000,
    rate: 0,
    type: "fixed",
    remainingMonths: 24,
    paymentDay: 1,
    startDate: "2026-01-01",
    termYears: 2,
  };

  it("pays until payoff then zero, principal + interest = payment", () => {
    const rows = mortgageSchedule(loan, "2026-01-01");
    assert.equal(rows.length, 24);
    for (const r of rows) {
      assert.ok(Math.abs(r.payment - r.principalPaid - r.interestPaid) < 0.01);
    }
    const y1 = mortgageFlowForYear(rows, 2026, 120_000);
    const y3 = mortgageFlowForYear(rows, 2028, 0);
    assert.ok(y1.payment > 0);
    assert.equal(y3.payment, 0);
    assert.ok(y1.paidOffMonth === undefined);
  });

  it("stops mortgage cash after payoff-at-retirement", () => {
    const plan = runRetirementPlan(
      {
        currentAge: 54,
        retireAge: 54,
        deathAge: 58,
        monthlyIncomeNow: 0,
        monthlySpendNow: 0,
        targetMonthly: 0,
        preReturn: 0,
        postReturn: 0,
        inflation: 0,
        travelInRetirement: 0,
        payOffMortgageAtRetire: true,
      },
      {
        investableNow: 500_000,
        mortgageMonthly: 5000,
        mortgagePayoffAge: 56,
        housingAfterPayoff: 1000,
        oneOffs: [],
        mortgage: {
          id: "m",
          name: "m",
          nameZh: "m",
          accountId: "loan",
          original: 120_000,
          outstanding: 120_000,
          rate: 0,
          remainingMonths: 24,
          paymentDay: 1,
          type: "fixed",
          startDate: "2026-01-01",
          termYears: 2,
        },
        today: "2026-01-01",
        calendarYear: 2026,
      },
    );
    assert.equal(plan.years[0]?.mortgagePayment, 0);
    assert.ok(plan.years[0]!.closingAccessible < 500_000);
    assert.ok(plan.years.every((y) => y.housingSpend > 0));
  });
});

describe("age comparison", () => {
  it("later retirement shortens the bridge and uses the same engine", () => {
    const inputs = {
      currentAge: 50,
      retireAge: 54,
      deathAge: 70,
      monthlyIncomeNow: 20_000,
      monthlySpendNow: 10_000,
      targetMonthly: 10_000,
      preReturn: 0,
      postReturn: 0,
      inflation: 0,
      travelInRetirement: 0,
      liquidityFloor: 1,
    };
    const ctx = {
      investableNow: 800_000,
      mortgageMonthly: 0,
      mortgagePayoffAge: 50,
      housingAfterPayoff: 0,
      oneOffs: [] as { id: string; label: string; labelZh: string; amount: number; age: number }[],
      retirementAccounts: [mpf({ currentBalance: 200_000, employeeContributionAmount: 0, employerContributionAmount: 0, voluntaryContributionAmount: 0, expectedAnnualReturnRate: 0, annualFeeRate: 0, withdrawalStrategy: "do_not_use_in_projection" })],
    };
    const rows = compareRetirementAges(inputs, ctx, [52, 56]);
    assert.equal(rows[0]!.bridgeYears, 13);
    assert.equal(rows[1]!.bridgeYears, 9);
    assert.ok(rows[1]!.accessibleAtRetire > rows[0]!.accessibleAtRetire);
    assert.equal(rows[0]!.lockedAtRetire, 200_000);
    assert.equal(rows[0]!.plan.years.find((y) => y.age === 60)?.mpfWithdrawal ?? 0, 0);
  });
});
