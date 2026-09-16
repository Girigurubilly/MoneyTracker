import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyLifePlan, estimateHkNetMonthly, lifePlanMissing, runLifePlan } from "./life-plan.ts";
import type { RetirementLifePlan } from "../types.ts";

function filled(): RetirementLifePlan {
  const p = emptyLifePlan();
  p.personal.dateOfBirth = "1984-01-01";
  p.personal.planStartDate = "2026-01-01";
  p.personal.planEndAge = 85;
  p.personal.targetTerminalFinancialAssets = 500_000;
  p.currentJob.endDate = "2034-12-31";
  p.currentJob.grossMonthlyIncome = 80_000;
  p.currentJob.actualMonthlySpending = 40_000;
  p.lowerStressJob.startDate = "2027-01-01";
  p.lowerStressJob.endDate = "2036-12-31";
  p.lowerStressJob.grossMonthlyIncome = 40_000;
  p.lowerStressJob.monthlyLivingCost = 28_000;
  p.retirement.annualInvestmentReturn = 0.04;
  p.retirement.annualInflationRate = 0.02;
  p.retirement.returnMode = "nominal";
  p.assets.financialAssets = 2_000_000;
  p.spendingStages = [
    {
      id: "s1",
      label: "Active retirement",
      startAge: 0,
      endAge: 74,
      monthlyLivingCostInTodayMoney: 30_000,
      followsInflation: true,
      isEssential: false,
      notes: "",
    },
    {
      id: "s2",
      label: "Later life",
      startAge: 75,
      endAge: 120,
      monthlyLivingCostInTodayMoney: 22_000,
      followsInflation: true,
      isEssential: true,
      notes: "",
    },
  ];
  return p;
}

describe("empty life plan", () => {
  it("has no hardcoded money values", () => {
    const p = emptyLifePlan();
    assert.equal(p.currentJob.grossMonthlyIncome, null);
    assert.equal(p.assets.financialAssets, null);
    assert.equal(p.mortgage.outstandingBalance, null);
    assert.equal(p.personal.targetTerminalFinancialAssets, null);
    assert.ok(lifePlanMissing(p).length > 0);
    const r = runLifePlan(p, "2026-01-01");
    assert.equal(r.ready, false);
    assert.equal(r.stay, null);
  });
});

describe("HK net estimate", () => {
  it("is below gross after MPF and tax", () => {
    const net = estimateHkNetMonthly(80_000);
    assert.ok(net > 50_000 && net < 80_000);
  });
  it("skips MPF below 7100", () => {
    assert.equal(estimateHkNetMonthly(6000), 6000);
  });
});

describe("two-path simulation", () => {
  it("switch path leaves the current job earlier than stay", () => {
    const r = runLifePlan(filled(), "2026-01-01");
    assert.equal(r.ready, true);
    assert.ok(r.stay && r.switch);
    const stayRetire = r.stay.retireAge!;
    const switchRetire = r.switch.retireAge!;
    assert.ok(switchRetire > stayRetire, "lower-stress job delays full retirement vs leaving at current-job end");
    assert.equal(r.stay.years[0].phase, "current");
    const switchLower = r.switch.years.find((y) => y.phase === "lower");
    assert.ok(switchLower);
  });

  it("applies a later-life spending cut", () => {
    const r = runLifePlan(filled(), "2026-01-01");
    const later = r.stay!.years.find((y) => y.age === 75);
    const before = r.stay!.years.find((y) => y.age === 74);
    assert.ok(later && before);
    assert.ok(later.living < before.living);
  });

  it("ends mortgage cashflow after the end date", () => {
    const p = filled();
    p.mortgage.enabled = true;
    p.mortgage.monthlyPayment = 14_000;
    p.mortgage.endDate = "2028-12-31";
    p.mortgage.paymentIncludedInCurrentSpending = false;
    p.mortgage.paymentIncludedInRetirementLivingCost = false;
    const r = runLifePlan(p, "2026-01-01");
    const y2028 = r.stay!.years.find((y) => y.calendarYear === 2028);
    const y2029 = r.stay!.years.find((y) => y.calendarYear === 2029);
    assert.ok((y2028?.mortgage ?? 0) > 0);
    assert.equal(y2029?.mortgage ?? -1, 0);
  });

  it("credits inherited sale proceeds and can buy an annuity", () => {
    const p = filled();
    p.inheritedProperty.enabled = true;
    p.inheritedProperty.expectedValue = 4_000_000;
    p.inheritedProperty.expectedDate = "2030-06-01";
    p.inheritedProperty.sell = true;
    p.inheritedProperty.sellDate = "2030-06-01";
    p.inheritedProperty.sellCostsRate = 0.05;
    p.publicAnnuity.enabled = true;
    p.publicAnnuity.useInheritedSaleProceeds = true;
    p.publicAnnuity.purchaseAmount = 1_000_000;
    p.publicAnnuity.monthlyPayout = 5_000;
    p.publicAnnuity.payoutStartAge = 60;
    p.publicAnnuity.payoutYears = 10;
    const r = runLifePlan(p, "2026-01-01");
    const y = r.stay!.years.find((row) => row.calendarYear === 2030);
    assert.ok(y);
    assert.ok(y.inheritProceeds > 2_500_000);
    assert.equal(y.annuityBuy, 1_000_000);
    const pay = r.stay!.years.find((row) => row.age === 60);
    assert.ok((pay?.annuityIncome ?? 0) > 0);
  });

  it("adds reverse-mortgage income from the start age", () => {
    const p = filled();
    p.assets.selfOccupiedPropertyValue = 6_000_000;
    p.reverseMortgage.enabled = true;
    p.reverseMortgage.startAge = 60;
    p.reverseMortgage.monthlyPayout = 8_000;
    const r = runLifePlan(p, "2026-01-01");
    const before = r.stay!.years.find((y) => y.age === 59);
    const after = r.stay!.years.find((y) => y.age === 60);
    assert.equal(before?.reverseMortgage ?? -1, 0);
    assert.equal(after?.reverseMortgage, 96_000);
  });

  it("reports a DWZ gap against the terminal target", () => {
    const r = runLifePlan(filled(), "2026-01-01");
    assert.equal(typeof r.stay!.dwzGap, "number");
    assert.equal(r.stay!.dwzGap, r.stay!.terminalAssets - 500_000);
  });
});
