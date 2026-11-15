import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dateAtAge, emptyLifePlan, estimateHkNetMonthly, inheritanceAnnuityAccount, lifePlanFundingTarget, lifePlanMissing, lifePlanMonthlyRoom, lifePlanSwitchSavingsPace, lifePlanTimeToTarget, nowGapTone, resolveLifePlan, runLifePlan } from "./life-plan.ts";
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

describe("FIRE inputs on the same path", () => {
  it("includes parent support while it lasts, and sets a reserve aside", () => {
    const base = runLifePlan(filled(), "2026-01-01");
    const withParents = runLifePlan(filled(), "2026-01-01", { parentSupport: { monthly: 5_000, years: 2, mode: "include" } });
    assert.ok(withParents.stay && base.stay);
    assert.ok(withParents.stay.years[0].living > base.stay.years[0].living);
    assert.equal(withParents.stay.years[3].living, base.stay.years[3].living);
    const reserved = runLifePlan(filled(), "2026-01-01", { parentSupport: { monthly: 5_000, years: 10, mode: "reserve" } });
    assert.equal(reserved.stay?.years[0].openingFinancial, 2_000_000 - 5_000 * 12 * 10);
  });

  it("adds part-time income only after retirement", () => {
    const plain = runLifePlan(filled(), "2026-01-01");
    const job = runLifePlan(filled(), "2026-01-01", { postJobMonthly: 8_000 });
    const retired = job.stay?.years.find((y) => y.phase === "retired");
    const same = plain.stay?.years.find((y) => y.age === retired?.age);
    assert.ok(retired && same);
    assert.ok(retired.income >= same.income + 8_000 * 12 * (retired.months / 12) - 1);
  });
});

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
      preReturn: 0.05,
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
    assert.equal(resolved.retirement.annualInvestmentReturn, 0.03);
    assert.equal(resolved.retirement.annualInvestmentReturnPre, 0.05);
    assert.equal(lifePlanMissing(resolved).length, 0);
  });

  it("runs from shared age when birthday is blank", () => {
    const resolved = resolveLifePlan(emptyLifePlan(), {
      currentAge: 40,
      retireAge: 65,
      deathAge: 90,
      inflation: 0.025,
      preReturn: 0.05,
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
      preReturn: 0.05,
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
      preReturn: 0.05,
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

function simplePlan(): RetirementLifePlan {
  const p = emptyLifePlan();
  p.personal.dateOfBirth = "1980-01-01";
  p.personal.planStartDate = "2026-01-01";
  p.personal.planEndAge = 85;
  p.currentJob.endDate = "2045-12-31";
  p.currentJob.grossMonthlyIncome = 40_000;
  p.currentJob.actualMonthlySpending = 30_000;
  p.currentJob.incomeIsNet = true;
  p.currentJob.monthlySavingsOverride = 10_000;
  p.lowerStressJob.enabled = false;
  p.retirement.startDate = "2045-12-31";
  p.retirement.annualInvestmentReturn = 0.035;
  p.retirement.annualInvestmentReturnPre = 0.05;
  p.retirement.annualInflationRate = 0.025;
  p.retirement.returnMode = "nominal";
  p.assets.financialAssets = 2_000_000;
  p.spendingStages = [
    {
      id: "retire",
      label: "Retirement",
      startAge: 65,
      endAge: 120,
      monthlyLivingCostInTodayMoney: 25_000,
      followsInflation: true,
      isEssential: true,
      notes: "",
    },
  ];
  return p;
}

describe("lifePlanFundingTarget", () => {
  it("returns need, have and gap in usable assets at retirement", () => {
    const row = lifePlanFundingTarget(simplePlan(), "2026-01-01");
    assert.equal(row.ready, true);
    assert.ok(row.need > 0);
    assert.ok(row.have > 0);
    assert.equal(row.gap, row.have - row.need);
    assert.equal(row.retireAge, 65);
    assert.equal(row.planEndAge, 85);
  });

  it("raises need when inflation is higher", () => {
    const base = simplePlan();
    const low = lifePlanFundingTarget(base, "2026-01-01");
    const high = simplePlan();
    high.retirement.annualInflationRate = 0.05;
    const up = lifePlanFundingTarget(high, "2026-01-01");
    assert.ok(up.need > low.need);
  });

  it("raises need when the plan runs longer", () => {
    const shorter = simplePlan();
    shorter.personal.planEndAge = 80;
    shorter.spendingStages[0].endAge = 80;
    const longer = simplePlan();
    longer.personal.planEndAge = 95;
    longer.spendingStages[0].endAge = 95;
    const a = lifePlanFundingTarget(shorter, "2026-01-01");
    const b = lifePlanFundingTarget(longer, "2026-01-01");
    assert.ok(b.need > a.need);
  });

  it("does not include self-occupied property in need or have", () => {
    const plain = lifePlanFundingTarget(simplePlan(), "2026-01-01");
    const withHome = simplePlan();
    withHome.assets.selfOccupiedPropertyValue = 50_000_000;
    withHome.assets.selfOccupiedPropertyGrowthRate = 0.025;
    const row = lifePlanFundingTarget(withHome, "2026-01-01");
    assert.ok(Math.abs(row.have - plain.have) < 2);
    assert.ok(Math.abs(row.need - plain.need) < 2);
    assert.ok(row.have < 50_000_000);
    assert.ok(row.need < 50_000_000);
  });
});

describe("pre- and post-retirement returns", () => {
  it("uses the pre-retirement rate while working and the post rate after", () => {
    const p = emptyLifePlan();
    p.personal.dateOfBirth = "1980-01-01";
    p.personal.planStartDate = "2026-01-01";
    p.personal.planEndAge = 70;
    p.currentJob.endDate = "2028-12-31";
    p.currentJob.grossMonthlyIncome = 20_000;
    p.currentJob.actualMonthlySpending = 20_000;
    p.currentJob.incomeIsNet = true;
    p.currentJob.monthlySavingsOverride = 0;
    p.lowerStressJob.enabled = false;
    p.retirement.startDate = "2028-12-31";
    p.retirement.annualInvestmentReturn = 0;
    p.retirement.annualInvestmentReturnPre = 0.1;
    p.retirement.annualInflationRate = 0;
    p.assets.financialAssets = 1_000_000;
    p.spendingStages = [
      {
        id: "r",
        label: "",
        startAge: 48,
        endAge: 120,
        monthlyLivingCostInTodayMoney: 0,
        followsInflation: false,
        isEssential: true,
        notes: "",
      },
    ];
    const r = runLifePlan(p, "2026-01-01");
    assert.ok(r.stay);
    const work = r.stay.years.filter((y) => y.phase === "current");
    const retired = r.stay.years.filter((y) => y.phase === "retired");
    assert.ok(work.length >= 1);
    assert.ok(retired.length >= 1);
    for (const y of work) {
      if (y.openingFinancial > 0 && y.months === 12) {
        assert.ok(Math.abs(y.investmentReturn / y.openingFinancial - 0.1) < 0.0001);
      }
    }
    for (const y of retired) {
      if (y.months === 12) {
        assert.ok(Math.abs(y.investmentReturn) < 1);
      }
    }
  });
});

describe("ledger take-home is not taxed twice", () => {
  it("keeps a net income figure as-is", () => {
    const p = filled();
    p.currentJob.grossMonthlyIncome = 80_000;
    p.currentJob.incomeIsNet = true;
    p.currentJob.annualIncomeGrowthRate = 0;
    const r = runLifePlan(p, "2026-01-01");
    const year = r.stay!.years.find((y) => y.phase === "current" && y.months === 12);
    assert.ok(year);
    assert.equal(year.income, 80_000 * 12);
  });
});

describe("lifePlanTimeToTarget", () => {
  const base = {
    need: 3_000_000,
    investableNow: 1_000_000,
    monthlyIncome: 40_000,
    monthlySpend: 25_000,
    preReturn: 0.05,
    currentAge: 40,
    retireAge: 65,
    planEndAge: 90,
    asOf: "2026-01-01",
  };

  it("reaches the target before planned retirement with positive savings", () => {
    const row = lifePlanTimeToTarget(base);
    assert.equal(row.kind, "on-track");
    assert.equal(row.monthlySave, 15_000);
    assert.ok(row.years != null && row.years > 0);
    assert.ok(row.age != null && row.age <= 65);
    assert.equal(row.age, 40 + row.years!);
    assert.equal(row.calendarYear, 2026 + row.years!);
    // Sanity: 1M growing at 5% plus 180k/year should beat 3M well before 25 years.
    assert.ok(row.years! < 25);
  });

  it("reports insufficient velocity when saving is zero or negative and growth cannot catch up", () => {
    const zero = lifePlanTimeToTarget({ ...base, monthlyIncome: 20_000, monthlySpend: 20_000, preReturn: 0 });
    assert.equal(zero.kind, "negative");
    assert.equal(zero.monthlySave, 0);
    assert.equal(zero.years, null);
    const neg = lifePlanTimeToTarget({ ...base, monthlyIncome: 10_000, monthlySpend: 25_000, preReturn: 0 });
    assert.equal(neg.kind, "negative");
    assert.ok(neg.monthlySave < 0);
  });

  it("is already funded when today's usable assets meet the need", () => {
    const row = lifePlanTimeToTarget({ ...base, investableNow: 3_000_000 });
    assert.equal(row.kind, "already");
    assert.equal(row.years, 0);
    assert.equal(row.age, 40);
    assert.equal(row.calendarYear, 2026);
  });

  it("reaches the target after the planned retire age when savings are thin", () => {
    const row = lifePlanTimeToTarget({
      ...base,
      need: 3_000_000,
      investableNow: 500_000,
      monthlyIncome: 32_000,
      monthlySpend: 30_000,
      preReturn: 0.03,
    });
    assert.equal(row.kind, "after-retire");
    assert.ok(row.age != null && row.age > 65);
    assert.ok(row.age! <= 90);
  });

  it("does not invent a date when income and spending are both missing", () => {
    const row = lifePlanTimeToTarget({ ...base, monthlyIncome: 0, monthlySpend: 0 });
    assert.equal(row.kind, "unknown-velocity");
    assert.equal(row.years, null);
    assert.equal(row.age, null);
  });

  it("says the target is never reached inside the plan if savings cannot catch up", () => {
    const row = lifePlanTimeToTarget({
      ...base,
      need: 20_000_000,
      investableNow: 100_000,
      monthlyIncome: 21_000,
      monthlySpend: 20_000,
      preReturn: 0.01,
      planEndAge: 70,
    });
    assert.equal(row.kind, "never");
    assert.equal(row.years, null);
  });

  it("uses a short first year when the birthday is mid-year", () => {
    const mid = lifePlanTimeToTarget({
      ...base,
      need: 1_000_000 + 15_000 * 3,
      investableNow: 1_000_000,
      preReturn: 0,
      currentAge: 40,
      retireAge: 48,
      birthday: "1986-06-15",
      asOf: "2026-03-15",
    });
    // 3 months until the next birthday: that short year is enough, so not a full 12 months.
    assert.equal(mid.kind, "on-track");
    assert.ok(mid.years != null && mid.years < 0.5);
    assert.ok(mid.age != null && mid.age < 41);
    assert.equal(mid.calendarYear, 2026);

    const fullYear = lifePlanTimeToTarget({
      ...base,
      need: 1_000_000 + 15_000 * 3,
      investableNow: 1_000_000,
      preReturn: 0,
      currentAge: 40,
      retireAge: 48,
      asOf: "2026-03-15",
    });
    // No birthday: the first step is still a full 12 months of saving.
    assert.equal(fullYear.kind, "on-track");
    assert.equal(fullYear.years, 1);
    assert.equal(fullYear.age, 41);
  });

  it("compares on-track vs after-retire against the stated retire age", () => {
    const onTrack = lifePlanTimeToTarget({
      ...base,
      need: 1_000_000 + 15_000 * 12 * 6,
      investableNow: 1_000_000,
      preReturn: 0,
      currentAge: 40,
      retireAge: 48,
      asOf: "2026-01-01",
    });
    assert.equal(onTrack.kind, "on-track");
    assert.equal(onTrack.years, 6);
    assert.equal(onTrack.age, 46);
    assert.ok(onTrack.age! <= 48);

    const late = lifePlanTimeToTarget({
      ...base,
      need: 1_000_000 + 15_000 * 12 * 10,
      investableNow: 1_000_000,
      preReturn: 0,
      currentAge: 40,
      retireAge: 48,
      asOf: "2026-01-01",
    });
    assert.equal(late.kind, "after-retire");
    assert.equal(late.years, 10);
    assert.equal(late.age, 50);
    assert.ok(late.age! > 48);
  });

  it("treats an on-track remaining amount as accumulating, not a late miss", () => {
    assert.equal(nowGapTone(800_000, "on-track"), "accumulating");
    assert.equal(nowGapTone(0, "on-track"), "over");
    assert.equal(nowGapTone(-10, "already"), "over");
    assert.equal(nowGapTone(800_000, "after-retire"), "late");
    assert.equal(nowGapTone(800_000, "never"), "late");
    assert.equal(nowGapTone(800_000, "negative"), "late");
    assert.equal(nowGapTone(800_000, "unknown-velocity"), "accumulating");
  });
});


describe("lifePlanSwitchSavingsPace", () => {
  const base = {
    need: 3_000_000,
    investableNow: 1_000_000,
    preReturn: 0.05,
    currentAge: 40,
    retireAge: 65,
    planEndAge: 90,
    asOf: "2026-01-01",
  };

  it("uses net override and living cost as the switch-path savings pace", () => {
    const plan = emptyLifePlan();
    plan.lowerStressJob.estimatedNetMonthlyIncomeOverride = 30_000;
    plan.lowerStressJob.monthlyLivingCost = 22_000;
    const pace = lifePlanSwitchSavingsPace(plan);
    assert.equal(pace.monthlyIncome, 30_000);
    assert.equal(pace.monthlySpend, 22_000);
    const row = lifePlanTimeToTarget({ ...base, ...pace });
    assert.equal(row.monthlySave, 8_000);
    assert.equal(row.kind, "on-track");
    assert.ok(row.years != null && row.years > 0);
  });

  it("estimates take-home from gross when no net override is set", () => {
    const plan = emptyLifePlan();
    plan.lowerStressJob.grossMonthlyIncome = 50_000;
    plan.lowerStressJob.monthlyLivingCost = 20_000;
    const pace = lifePlanSwitchSavingsPace(plan);
    assert.equal(pace.monthlyIncome, estimateHkNetMonthly(50_000));
    assert.ok(pace.monthlyIncome > 0 && pace.monthlyIncome < 50_000);
    assert.equal(pace.monthlySpend, 20_000);
  });

  it("does not invent a date when switch income and spend are both missing", () => {
    const plan = emptyLifePlan();
    const pace = lifePlanSwitchSavingsPace(plan);
    assert.equal(pace.monthlyIncome, 0);
    assert.equal(pace.monthlySpend, 0);
    const row = lifePlanTimeToTarget({ ...base, ...pace });
    assert.equal(row.kind, "unknown-velocity");
    assert.equal(row.years, null);
    assert.equal(row.age, null);
  });
});


describe("official retire age and birthday-accurate dates", () => {
  const shared = {
    birthday: "1980-06-15",
    currentAge: 46,
    retireAge: 48,
    deathAge: 90,
    inflation: 0.02,
    preReturn: 0.05,
    postReturn: 0.03,
    monthlyIncomeNow: 80_000,
    monthlySpendNow: 40_000,
    targetMonthly: 25_000,
    investable: 2_000_000,
    property: 0,
    mortgage: null as null,
    today: "2026-11-15",
  };

  it("returns the birthday they turn that age, not year-end", () => {
    assert.equal(dateAtAge("1980-06-15", 48, "2026-11-15", 46), "2028-06-15");
    assert.equal(dateAtAge("1984-01-01", 50, "2026-01-01", 42), "2034-01-01");
    assert.equal(dateAtAge(undefined, 65, "2026-09-16", 40), "2051-01-01");
  });

  it("lets the stated retire age win over a stale earlier job-end date", () => {
    const stored = filled();
    stored.personal.dateOfBirth = "1980-06-15";
    stored.currentJob.endDate = "2026-12-31"; // would mark retired at 46
    stored.retirement.startDate = "2026-12-31";
    stored.lowerStressJob.startDate = "2027-01-01";
    stored.lowerStressJob.endDate = "2028-06-15";
    const resolved = resolveLifePlan(stored, shared);
    assert.equal(resolved.currentJob.endDate, "2028-06-15");
    assert.equal(resolved.retirement.startDate, "2028-06-15");
    // Switch-path dates stay on the switch path only.
    assert.equal(resolved.lowerStressJob.startDate, "2027-01-01");
    assert.equal(resolved.lowerStressJob.endDate, "2028-06-15");
    const years = runLifePlan(resolved, shared.today).stay!.years;
    const firstRetired = years.find((y) => y.phase === "retired");
    assert.ok(firstRetired);
    assert.equal(firstRetired.age, 48);
    assert.ok(years.filter((y) => y.phase === "retired").every((y) => y.age >= 48));
    const at46 = years.find((y) => y.age === 46);
    const at47 = years.find((y) => y.age === 47);
    assert.ok(at46 && at46.phase !== "retired");
    assert.ok(at47 && at47.phase !== "retired");
  });
});
