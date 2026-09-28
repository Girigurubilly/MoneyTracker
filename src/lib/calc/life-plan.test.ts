import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyLifePlan, estimateHkNetMonthly, inheritanceAnnuityAccount, lifePlanMissing, lifePlanMonthlyRoom, resolveLifePlan, runLifePlan } from "./life-plan.ts";
import { applyAnnuityTerms, blankRetirementAccount } from "./mpf.ts";
import type { Allowance, RetirementLifePlan } from "../types.ts";

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

  it("adds the inheritance sale to financial assets and keeps at most 3 million for the annuity", () => {
    const plain = filled();
    const sold = filled();
    sold.inheritedProperty.enabled = true;
    sold.inheritedProperty.expectedValue = 5_000_000;
    sold.inheritedProperty.expectedDate = "2030-01-01";
    sold.inheritedProperty.annualGrowthRate = 0;
    sold.inheritedProperty.sellCostsRate = 0;
    sold.inheritedProperty.sell = true;
    sold.inheritedProperty.sellDate = "2030-01-01";
    sold.inheritedProperty.buyAnnuity = true;
    sold.inheritedProperty.annuityPremium = 9_000_000;
    sold.inheritedProperty.annuityMonthly = 10_000;
    sold.inheritedProperty.annuityStartAge = 46;
    const base = runLifePlan(plain, "2026-01-01");
    const r = runLifePlan(sold, "2026-01-01");
    const y = r.stay!.years.find((row) => row.calendarYear === 2030);
    const y0 = base.stay!.years.find((row) => row.calendarYear === 2030);
    assert.ok(y && y0);
    assert.equal(y.inheritStated, 5_000_000);
    assert.equal(y.inheritProceeds, 5_000_000);
    assert.equal(y.annuityBuy, 3_000_000);
    assert.equal(y.annuityIncome, 120_000);
    assert.equal(Math.round(y.closingFinancial - y0.closingFinancial), 2_000_000 + 120_000);
  });

  it("sells a 6 million inheritance, keeps 3 million after the annuity, and adds that to the lump sum", () => {
    const plain = filled();
    const sold = filled();
    sold.inheritedProperty.enabled = true;
    sold.inheritedProperty.expectedValue = 6_000_000;
    sold.inheritedProperty.expectedDate = "2050-09-17";
    sold.inheritedProperty.sell = true;
    sold.inheritedProperty.sellDate = "2050-10-16";
    sold.publicAnnuity.enabled = true;
    sold.publicAnnuity.purchaseAmount = 3_000_000;
    sold.publicAnnuity.useInheritedSaleProceeds = true;
    sold.publicAnnuity.monthlyPayout = 15_000;
    sold.publicAnnuity.payoutStartAge = 66;
    const base = runLifePlan(plain, "2026-01-01");
    const r = runLifePlan(sold, "2026-01-01");
    const y = r.stay!.years.find((row) => row.calendarYear === 2050);
    const y0 = base.stay!.years.find((row) => row.calendarYear === 2050);
    assert.ok(y && y0);
    assert.equal(y.age, 66);
    assert.equal(y.inheritProceeds, 6_000_000);
    assert.equal(y.annuityBuy, 3_000_000);
    assert.equal(y.inheritKept, 3_000_000);
    assert.equal(y.annuityIncome, 180_000);
    assert.equal(Math.round(y.closingFinancial - y0.closingFinancial), 3_000_000 + 180_000);
    assert.equal(r.stay!.series.find((row) => row.age === 66)?.financial, y.closingFinancial);
  });

  it("does not count the future inheritance annuity as money already held", () => {
    const p = filled();
    p.publicAnnuity.enabled = true;
    p.publicAnnuity.purchaseAmount = 3_000_000;
    p.publicAnnuity.useInheritedSaleProceeds = true;
    p.publicAnnuity.monthlyPayout = 15_000;
    p.publicAnnuity.payoutStartAge = 66;
    p.inheritedProperty.enabled = true;
    p.inheritedProperty.sell = true;
    const acc = inheritanceAnnuityAccount(p);
    assert.ok(acc);
    assert.equal(acc.currentBalance, 0);
    acc.currentBalance = 3_000_000;
    const y = runLifePlan(p, "2026-01-01", { accounts: [acc] }).stay!.years.find((row) => row.calendarYear === 2037);
    assert.ok(y);
    assert.equal(y.lockedBalance, 0);
    assert.equal(Math.round(y.closingFinancial), Math.round(y.openingFinancial + y.investmentReturn + y.income + y.pensionIncome + y.allowanceIncome + y.annuityIncome + y.inheritKept + y.reverseMortgage - y.living - y.mortgage));
  });

  it("does not charge investment return after the lump sum is gone", () => {
    const p = filled();
    p.assets.financialAssets = 0;
    p.currentJob.endDate = "2025-12-31";
    p.retirement.annualInvestmentReturn = 0.03;
    p.retirement.annualInflationRate = 0;
    p.spendingStages[0].monthlyLivingCostInTodayMoney = 10_000;
    p.spendingStages[0].followsInflation = false;
    const years = runLifePlan(p, "2026-01-01").stay!.years;
    assert.equal(years[0].investmentReturn, 0);
    assert.ok(years[0].closingFinancial < 0);
    assert.ok(years[1].openingFinancial < 0);
    assert.equal(years[1].investmentReturn, 0);
  });

  it("counts the current age only until the next birthday", () => {
    const p = filled();
    p.personal.dateOfBirth = "1984-06-15";
    p.assets.financialAssets = 1_000_000;
    p.retirement.annualInvestmentReturn = 0.12;
    const first = runLifePlan(p, "2026-09-28").stay!.years[0];
    const second = runLifePlan(p, "2026-09-28").stay!.years[1];
    assert.equal(first.months, 8);
    assert.equal(first.living, 40_000 * 8);
    assert.equal(first.investmentReturn, 80_000);
    assert.equal(second.months, 12);
    assert.equal(second.livingMonthlyToday, 40_000);
  });

  it("measures the monthly surplus against the same stay path", () => {
    const rich = filled();
    rich.spendingStages[0].monthlyLivingCostInTodayMoney = 5_000;
    const room = lifePlanMonthlyRoom(rich, "2026-01-01");
    assert.equal(room.planned, 5_000);
    assert.ok(room.sustainable > 5_000, String(room.sustainable));
    assert.ok(room.surplus > 0);

    const poor = filled();
    poor.assets.financialAssets = 0;
    poor.currentJob.grossMonthlyIncome = 0;
    poor.currentJob.actualMonthlySpending = 0;
    poor.spendingStages[0].monthlyLivingCostInTodayMoney = 80_000;
    const gap = lifePlanMonthlyRoom(poor, "2026-01-01");
    assert.equal(gap.planned, 80_000);
    assert.ok(gap.surplus < 0, String(gap.surplus));
  });

  it("keeps unsold future inheritance visible without treating it as cash", () => {
    const plain = filled();
    const held = filled();
    held.inheritedProperty.enabled = true;
    held.inheritedProperty.expectedValue = 2_000_000;
    held.inheritedProperty.expectedDate = "2032-01-01";
    held.inheritedProperty.annualGrowthRate = 0;
    held.inheritedProperty.sell = false;
    const base = runLifePlan(plain, "2026-01-01");
    const r = runLifePlan(held, "2026-01-01");
    const y = r.stay!.years.find((row) => row.calendarYear === 2032);
    const y0 = base.stay!.years.find((row) => row.calendarYear === 2032);
    assert.ok(y && y0);
    assert.equal(y.inheritedHeld, 2_000_000);
    assert.equal(y.inheritProceeds, 0);
    assert.equal(Math.round(y.closingFinancial), Math.round(y0.closingFinancial));
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

  it("fills blank plan fields from the shared retirement profile", () => {
    const resolved = resolveLifePlan(emptyLifePlan(), {
      birthday: "1984-06-01",
      currentAge: 42,
      retireAge: 50,
      deathAge: 85,
      inflation: 0.025,
      postReturn: 0.03,
      monthlyIncomeNow: 70_000,
      monthlySpendNow: 35_000,
      targetMonthly: 28_000,
      investable: 3_000_000,
      property: 6_000_000,
      reverseMortgageLtv: 0.4,
      mortgage: { outstanding: 1_000_000, monthlyPayment: 12_000, endDate: "2035-01-01", rate: 0.03 },
      today: "2026-01-01",
    });
    assert.equal(resolved.personal.dateOfBirth, "1984-06-01");
    assert.equal(resolved.personal.planEndAge, 85);
    assert.equal(resolved.currentJob.grossMonthlyIncome, 70_000);
    assert.equal(resolved.currentJob.actualMonthlySpending, 35_000);
    assert.equal(resolved.spendingStages[0]?.monthlyLivingCostInTodayMoney, 28_000);
    assert.equal(resolved.mortgage.paymentIncludedInCurrentSpending, true);
    assert.equal(resolved.mortgage.paymentIncludedInRetirementLivingCost, false);
    assert.equal(resolved.assets.financialAssets, 3_000_000);
    assert.equal(resolved.mortgage.monthlyPayment, 12_000);
    assert.equal(resolved.retirement.annualInflationRate, 0.025);
    assert.equal(lifePlanMissing(resolved).length, 0);
  });

  it("runs from shared age when birthday is blank", () => {
    const resolved = resolveLifePlan(emptyLifePlan(), {
      currentAge: 40,
      retireAge: 65,
      deathAge: 90,
      inflation: 0.025,
      postReturn: 0.035,
      monthlyIncomeNow: 72_000,
      monthlySpendNow: 28_000,
      targetMonthly: 25_000,
      investable: 2_000_000,
      property: 6_000_000,
      mortgage: null,
      today: "2026-09-16",
    });
    const r = runLifePlan(resolved, "2026-09-16");
    assert.equal(r.ready, true);
    assert.equal(r.stay?.retireAge, 65);
    assert.equal(r.switch, null);
  });

  it("uses current spending before retirement and retirement spending plus the mortgage after", () => {
    const stored = filled();
    stored.currentJob.actualMonthlySpending = 90_000;
    stored.spendingStages = [];
    stored.mortgage.enabled = true;
    stored.mortgage.paymentIncludedInCurrentSpending = false;
    stored.mortgage.paymentIncludedInRetirementLivingCost = true;
    const resolved = resolveLifePlan(stored, {
      currentAge: 40,
      retireAge: 45,
      deathAge: 90,
      inflation: 0.025,
      postReturn: 0.035,
      monthlyIncomeNow: 72_000,
      monthlySpendNow: 28_000,
      targetMonthly: 25_000,
      investable: 2_000_000,
      property: 6_000_000,
      mortgage: { outstanding: 1_000_000, monthlyPayment: 10_000, endDate: "2040-01-01", rate: 0.03 },
      today: "2026-09-16",
    });
    const r = runLifePlan(resolved, "2026-09-16");
    const working = r.stay!.years.find((y) => y.phase === "current");
    const retired = r.stay!.years.find((y) => y.phase === "retired");
    assert.ok(working && retired);
    assert.equal(working.livingMonthlyToday, 28_000);
    assert.equal(working.mortgage, 0);
    assert.equal(retired.livingMonthlyToday, 25_000);
    assert.equal(retired.mortgage, 120_000);
  });

  it("uses a spending stage for the ages it names and the retirement default outside them", () => {
    const stored = filled();
    stored.currentJob.endDate = "2030-12-31";
    stored.personal.planEndAge = 90;
    stored.spendingStages = [
      {
        id: "late",
        label: "",
        startAge: 71,
        endAge: 85,
        monthlyLivingCostInTodayMoney: 18_000,
        followsInflation: true,
        isEssential: true,
        notes: "",
      },
      {
        id: "blank-ages",
        label: "",
        startAge: null,
        endAge: null,
        monthlyLivingCostInTodayMoney: 99_000,
        followsInflation: true,
        isEssential: true,
        notes: "",
      },
    ];
    const resolved = resolveLifePlan(stored, {
      currentAge: 42,
      retireAge: 47,
      deathAge: 90,
      inflation: 0,
      postReturn: 0.03,
      monthlyIncomeNow: 80_000,
      monthlySpendNow: 40_000,
      targetMonthly: 25_000,
      investable: 2_000_000,
      property: 0,
      mortgage: null,
      today: "2026-01-01",
    });
    const years = runLifePlan(resolved, "2026-01-01").stay!.years;
    const at = (age: number) => years.find((y) => y.age === age);
    assert.equal(at(70)?.livingMonthlyToday, 25_000);
    assert.equal(at(71)?.livingMonthlyToday, 18_000);
    assert.equal(at(85)?.livingMonthlyToday, 18_000);
    assert.equal(at(86)?.livingMonthlyToday, 25_000);
  });

  it("includes ORSO, annuity and old age allowance cashflow", () => {
    const p = filled();
    const orso = blankRetirementAccount("ORSO");
    orso.currentBalance = 400_000;
    orso.accessibleAge = 65;
    orso.withdrawalStrategy = "lump_sum";
    orso.expectedAnnualReturnRate = 0;
    orso.employeeContributionAmount = 0;
    orso.employerContributionAmount = 0;
    const annuity = applyAnnuityTerms(blankRetirementAccount("ANNUITY"), 5_000, 0, 65);
    const oaa: Allowance = {
      id: "oaa",
      label: "Old Age Allowance",
      labelZh: "生果金",
      monthly: 1_620,
      startAge: 70,
      kind: "oaa",
      inflationAdjusted: false,
    };
    const plain = runLifePlan(p, "2026-01-01");
    const withIn = runLifePlan(p, "2026-01-01", { accounts: [orso, annuity], allowances: [oaa] });
    const y70 = withIn.stay!.years.find((y) => y.age === 70);
    const y70plain = plain.stay!.years.find((y) => y.age === 70);
    assert.ok(y70 && y70plain);
    assert.equal(y70.allowanceIncome, 1_620 * 12);
    assert.ok(y70.pensionIncome >= 5_000 * 12);
    assert.ok(y70.closingFinancial > y70plain.closingFinancial);
  });
});
