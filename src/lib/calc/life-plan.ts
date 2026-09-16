import type { RetirementLifePlan, LifePlanSpendingStage } from "../types.ts";
import { ageFromBirthday } from "./retirement.ts";

export type LifePathId = "stay" | "switch";
export type LifePhase = "current" | "lower" | "retired";

export type LifeYearRow = {
  calendarYear: number;
  age: number;
  phase: LifePhase;
  openingFinancial: number;
  income: number;
  living: number;
  mortgage: number;
  inheritProceeds: number;
  annuityBuy: number;
  annuityIncome: number;
  reverseMortgage: number;
  investmentReturn: number;
  closingFinancial: number;
  propertyHeld: number;
  notes: string[];
};

export type LifePathResult = {
  id: LifePathId;
  years: LifeYearRow[];
  series: { age: number; financial: number }[];
  retireAge: number | null;
  assetsAtRetire: number;
  terminalAssets: number;
  depletes: boolean;
  depletionAge?: number;
  minFinancial: number;
  dwzGap: number;
};

export type LifePlanResult = {
  ready: boolean;
  missing: string[];
  stay: LifePathResult | null;
  switch: LifePathResult | null;
};

export function emptyLifePlan(): RetirementLifePlan {
  return {
    id: "base",
    version: 1,
    personal: {
      dateOfBirth: null,
      planStartDate: null,
      planEndAge: null,
      targetTerminalFinancialAssets: null,
    },
    currentJob: {
      enabled: true,
      endDate: null,
      grossMonthlyIncome: null,
      actualMonthlySpending: null,
      monthlySavingsOverride: null,
      annualIncomeGrowthRate: null,
    },
    lowerStressJob: {
      enabled: true,
      startDate: null,
      endDate: null,
      grossMonthlyIncome: null,
      estimatedNetMonthlyIncomeOverride: null,
      annualIncomeGrowthRate: null,
      monthlyLivingCost: null,
      livingCostFollowsInflation: true,
    },
    retirement: {
      startDate: null,
      annualInvestmentReturn: null,
      annualInflationRate: null,
      returnMode: "nominal",
      cashReserveMonths: null,
    },
    spendingStages: [
      {
        id: "stage-1",
        label: "",
        startAge: null,
        endAge: null,
        monthlyLivingCostInTodayMoney: null,
        followsInflation: true,
        isEssential: true,
        notes: "",
      },
    ],
    mortgage: {
      enabled: false,
      outstandingBalance: null,
      monthlyPayment: null,
      endDate: null,
      annualInterestRate: null,
      paymentIncludedInCurrentSpending: true,
      paymentIncludedInRetirementLivingCost: false,
      earlyRepaymentPenaltyNotes: "",
    },
    assets: {
      financialAssets: null,
      selfOccupiedPropertyValue: null,
      selfOccupiedPropertyGrowthRate: null,
    },
    inheritedProperty: {
      enabled: false,
      expectedValue: null,
      expectedDate: null,
      annualGrowthRate: null,
      sell: false,
      sellDate: null,
      sellCostsRate: null,
    },
    publicAnnuity: {
      enabled: false,
      purchaseDate: null,
      purchaseAmount: null,
      useInheritedSaleProceeds: false,
      monthlyPayout: null,
      payoutStartAge: null,
      payoutYears: null,
    },
    reverseMortgage: {
      enabled: false,
      startAge: null,
      ltv: null,
      monthlyPayout: null,
    },
  };
}

/** Illustrative HK take-home: 5% MPF to $1,500 cap, then a simplified salaries-tax estimate. */
export function estimateHkNetMonthly(grossMonthly: number): number {
  if (!Number.isFinite(grossMonthly) || grossMonthly <= 0) return 0;
  const mpf = grossMonthly < 7100 ? 0 : Math.min(1500, grossMonthly * 0.05);
  const annualAssessable = Math.max(0, (grossMonthly - mpf) * 12 - 132_000);
  let progressive = 0;
  let rest = annualAssessable;
  const bands: [number, number][] = [
    [50_000, 0.02],
    [50_000, 0.06],
    [50_000, 0.1],
    [50_000, 0.14],
  ];
  for (const [width, rate] of bands) {
    const slice = Math.min(rest, width);
    progressive += slice * rate;
    rest -= slice;
  }
  progressive += rest * 0.17;
  const standard = annualAssessable * 0.15;
  const tax = Math.min(progressive, standard);
  return Math.max(0, grossMonthly - mpf - tax / 12);
}

export function lifePlanMissing(plan: RetirementLifePlan): string[] {
  const missing: string[] = [];
  if (!plan.personal.dateOfBirth) missing.push("dateOfBirth");
  if (!plan.personal.planEndAge) missing.push("planEndAge");
  if (plan.assets.financialAssets == null) missing.push("financialAssets");
  if (plan.retirement.annualInvestmentReturn == null) missing.push("annualInvestmentReturn");
  if (plan.retirement.annualInflationRate == null) missing.push("annualInflationRate");
  const stayOk = plan.currentJob.enabled && Boolean(plan.currentJob.endDate || plan.retirement.startDate);
  const switchOk =
    plan.lowerStressJob.enabled && Boolean(plan.lowerStressJob.startDate) && Boolean(plan.lowerStressJob.endDate || plan.retirement.startDate);
  if (!stayOk && !switchOk) missing.push("pathDates");
  return missing;
}

function n(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function isoYear(iso: string | null | undefined, fallback: number): number {
  if (!iso) return fallback;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : fallback;
}

function inflate(today: number, rate: number, years: number, follows: boolean, mode: "nominal" | "real"): number {
  if (!follows || mode === "real") return today;
  return today * (1 + rate) ** years;
}

function stageSpend(stages: LifePlanSpendingStage[], age: number): { monthly: number; follows: boolean } | null {
  const hit = stages.find((s) => {
    if (s.monthlyLivingCostInTodayMoney == null) return false;
    const a0 = s.startAge ?? 0;
    const a1 = s.endAge ?? 200;
    return age >= a0 && age <= a1;
  });
  if (!hit || hit.monthlyLivingCostInTodayMoney == null) return null;
  return { monthly: hit.monthlyLivingCostInTodayMoney, follows: hit.followsInflation };
}

function phaseFor(path: LifePathId, plan: RetirementLifePlan, yearEnd: string): LifePhase {
  if (path === "stay") {
    const end = plan.currentJob.endDate || plan.retirement.startDate;
    if (end && yearEnd < end) return "current";
    return "retired";
  }
  const start = plan.lowerStressJob.startDate;
  const end = plan.lowerStressJob.endDate || plan.retirement.startDate;
  if (start && yearEnd < start) return "current";
  if (end && yearEnd < end) return "lower";
  if (!start) return "retired";
  return "retired";
}

function netCurrent(plan: RetirementLifePlan, yearsFromStart: number): number {
  const gross = n(plan.currentJob.grossMonthlyIncome) * (1 + n(plan.currentJob.annualIncomeGrowthRate)) ** yearsFromStart;
  return estimateHkNetMonthly(gross);
}

function netLower(plan: RetirementLifePlan, yearsFromStart: number): number {
  if (plan.lowerStressJob.estimatedNetMonthlyIncomeOverride != null) {
    return n(plan.lowerStressJob.estimatedNetMonthlyIncomeOverride) * (1 + n(plan.lowerStressJob.annualIncomeGrowthRate)) ** yearsFromStart;
  }
  const gross = n(plan.lowerStressJob.grossMonthlyIncome) * (1 + n(plan.lowerStressJob.annualIncomeGrowthRate)) ** yearsFromStart;
  return estimateHkNetMonthly(gross);
}

function simulatePath(plan: RetirementLifePlan, path: LifePathId, asOf: string): LifePathResult {
  const dob = plan.personal.dateOfBirth!;
  const startIso = plan.personal.planStartDate || asOf;
  const startYear = isoYear(startIso, Number(asOf.slice(0, 4)));
  const startAge = ageFromBirthday(dob, `${startYear}-12-31`);
  const endAge = plan.personal.planEndAge!;
  const inf = n(plan.retirement.annualInflationRate);
  const ret = n(plan.retirement.annualInvestmentReturn);
  const mode = plan.retirement.returnMode;
  let financial = n(plan.assets.financialAssets);
  let home = n(plan.assets.selfOccupiedPropertyValue);
  let inheritedHeld = 0;
  let inheritedSold = false;
  let annuityBought = false;
  const years: LifeYearRow[] = [];
  let depletes = false;
  let depletionAge: number | undefined;
  let minFinancial = financial;
  let assetsAtRetire = financial;
  let retireAge: number | null = null;
  const target = plan.personal.targetTerminalFinancialAssets;

  for (let age = startAge; age <= endAge; age++) {
    const calendarYear = startYear + (age - startAge);
    const yearEnd = `${calendarYear}-12-31`;
    const i = age - startAge;
    const phase = phaseFor(path, plan, yearEnd);
    const opening = financial;
    const notes: string[] = [];
    let income = 0;
    let living = 0;
    if (phase === "current") {
      const net = netCurrent(plan, i);
      const netAnnual = net * 12;
      if (plan.currentJob.monthlySavingsOverride != null) {
        income = netAnnual;
        living = netAnnual - plan.currentJob.monthlySavingsOverride * 12;
      } else {
        income = netAnnual;
        living = n(plan.currentJob.actualMonthlySpending) * 12;
      }
    } else if (phase === "lower") {
      income = netLower(plan, i) * 12;
      living = inflate(n(plan.lowerStressJob.monthlyLivingCost) * 12, inf, i, plan.lowerStressJob.livingCostFollowsInflation, mode);
    } else {
      const st = stageSpend(plan.spendingStages, age);
      living = st ? inflate(st.monthly * 12, inf, i, st.follows, mode) : 0;
      if (!st) notes.push("No retirement spending stage for this age.");
    }

    let mortgagePay = 0;
    if (plan.mortgage.enabled && plan.mortgage.monthlyPayment) {
      const ended = plan.mortgage.endDate ? yearEnd > plan.mortgage.endDate : false;
      if (!ended) {
        const included =
          (phase === "current" && plan.mortgage.paymentIncludedInCurrentSpending) ||
          (phase === "retired" && plan.mortgage.paymentIncludedInRetirementLivingCost);
        if (!included) mortgagePay = n(plan.mortgage.monthlyPayment) * 12;
      }
    }

    let inheritProceeds = 0;
    let annuityBuy = 0;
    if (plan.inheritedProperty.enabled && plan.inheritedProperty.expectedDate) {
      const y = isoYear(plan.inheritedProperty.expectedDate, 0);
      if (calendarYear === y && inheritedHeld === 0 && !inheritedSold) {
        inheritedHeld = n(plan.inheritedProperty.expectedValue);
        notes.push("Inherited property received.");
      }
    }
    if (inheritedHeld > 0) inheritedHeld *= 1 + n(plan.inheritedProperty.annualGrowthRate);
    if (plan.inheritedProperty.enabled && plan.inheritedProperty.sell && plan.inheritedProperty.sellDate) {
      const sy = isoYear(plan.inheritedProperty.sellDate, 0);
      if (calendarYear === sy && !inheritedSold) {
        inheritProceeds = inheritedHeld * (1 - n(plan.inheritedProperty.sellCostsRate));
        inheritedHeld = 0;
        inheritedSold = true;
        notes.push("Inherited property sold.");
        if (plan.publicAnnuity.enabled && plan.publicAnnuity.useInheritedSaleProceeds) {
          const buy = plan.publicAnnuity.purchaseAmount != null ? Math.min(n(plan.publicAnnuity.purchaseAmount), inheritProceeds) : inheritProceeds;
          annuityBuy = buy;
          inheritProceeds -= buy;
          annuityBought = true;
          notes.push("Public annuity purchased from sale proceeds.");
        }
      }
    }

    if (plan.publicAnnuity.enabled && !plan.publicAnnuity.useInheritedSaleProceeds && plan.publicAnnuity.purchaseDate) {
      const py = isoYear(plan.publicAnnuity.purchaseDate, 0);
      if (calendarYear === py && !annuityBought) {
        annuityBuy = n(plan.publicAnnuity.purchaseAmount);
        annuityBought = true;
        notes.push("Public annuity purchased.");
      }
    }

    let annuityIncome = 0;
    if (plan.publicAnnuity.enabled && annuityBought && plan.publicAnnuity.monthlyPayout) {
      const startA = plan.publicAnnuity.payoutStartAge ?? age;
      const years = plan.publicAnnuity.payoutYears;
      const within = age >= startA && (years == null || years === 0 || age < startA + years);
      if (within) annuityIncome = n(plan.publicAnnuity.monthlyPayout) * 12;
    }

    home *= 1 + n(plan.assets.selfOccupiedPropertyGrowthRate);
    let reverseMortgage = 0;
    if (plan.reverseMortgage.enabled && plan.reverseMortgage.startAge != null && age >= plan.reverseMortgage.startAge) {
      if (plan.reverseMortgage.monthlyPayout != null) reverseMortgage = n(plan.reverseMortgage.monthlyPayout) * 12;
      else if (plan.reverseMortgage.ltv && home > 0) {
        const left = Math.max(1, endAge - age + 1);
        reverseMortgage = (home * n(plan.reverseMortgage.ltv)) / left;
      }
    }

    const investmentReturn = financial * ret;
    financial = financial + investmentReturn + income + inheritProceeds + annuityIncome + reverseMortgage - living - mortgagePay - annuityBuy;
    if (financial < minFinancial) minFinancial = financial;
    if (financial < 0 && !depletes) {
      depletes = true;
      depletionAge = age;
    }
    if (i === 0 && plan.retirement.cashReserveMonths) {
      const need = n(plan.retirement.cashReserveMonths) * (living / 12 || n(plan.currentJob.actualMonthlySpending));
      if (opening < need) notes.push("Cash reserve is below the chosen number of months.");
    }
    if (phase === "retired" && retireAge == null) {
      retireAge = age;
      assetsAtRetire = opening;
    }
    years.push({
      calendarYear,
      age,
      phase,
      openingFinancial: opening,
      income,
      living,
      mortgage: mortgagePay,
      inheritProceeds,
      annuityBuy,
      annuityIncome,
      reverseMortgage,
      investmentReturn,
      closingFinancial: financial,
      propertyHeld: home + inheritedHeld,
      notes,
    });
  }

  const terminal = years.length ? years[years.length - 1].closingFinancial : financial;
  return {
    id: path,
    years,
    series: years.map((y) => ({ age: y.age, financial: y.closingFinancial })),
    retireAge,
    assetsAtRetire,
    terminalAssets: terminal,
    depletes,
    depletionAge,
    minFinancial,
    dwzGap: (target == null ? 0 : terminal - target),
  };
}

export function runLifePlan(plan: RetirementLifePlan, asOf = new Date().toISOString().slice(0, 10)): LifePlanResult {
  const missing = lifePlanMissing(plan);
  if (missing.length) return { ready: false, missing, stay: null, switch: null };
  const stay = plan.currentJob.enabled ? simulatePath(plan, "stay", asOf) : null;
  const sw = plan.lowerStressJob.enabled ? simulatePath(plan, "switch", asOf) : null;
  return { ready: true, missing: [], stay, switch: sw };
}

export function mergeLifePlan(base: RetirementLifePlan, patch: Partial<RetirementLifePlan>): RetirementLifePlan {
  return {
    ...base,
    ...patch,
    version: 1,
    id: base.id || "base",
    personal: { ...base.personal, ...(patch.personal ?? {}) },
    currentJob: { ...base.currentJob, ...(patch.currentJob ?? {}) },
    lowerStressJob: { ...base.lowerStressJob, ...(patch.lowerStressJob ?? {}) },
    retirement: { ...base.retirement, ...(patch.retirement ?? {}) },
    spendingStages: patch.spendingStages ?? base.spendingStages,
    mortgage: { ...base.mortgage, ...(patch.mortgage ?? {}) },
    assets: { ...base.assets, ...(patch.assets ?? {}) },
    inheritedProperty: { ...base.inheritedProperty, ...(patch.inheritedProperty ?? {}) },
    publicAnnuity: { ...base.publicAnnuity, ...(patch.publicAnnuity ?? {}) },
    reverseMortgage: { ...base.reverseMortgage, ...(patch.reverseMortgage ?? {}) },
  };
}
