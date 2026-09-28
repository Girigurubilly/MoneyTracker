import type { Allowance, RetirementAccount, RetirementLifePlan, LifePlanSpendingStage } from "../types.ts";
import { ageFromBirthday } from "./retirement.ts";
import { applyAnnuityTerms, blankRetirementAccount, projectRetirementAccountYear } from "./mpf.ts";

export const INHERIT_ANNUITY_ID = "ra-inherit-annuity";
export const INHERIT_ANNUITY_CAP = 3_000_000;
export type LifePathId = "stay" | "switch";
export type LifePhase = "current" | "lower" | "retired";

export type LifeYearRow = {
  calendarYear: number;
  age: number;
  phase: LifePhase;
  openingFinancial: number;
  income: number;
  living: number;
  /** Monthly living cost in today's money. `living / 12` is that year's inflated amount. */
  livingMonthlyToday: number;
  mortgage: number;
  inheritProceeds: number;
  inheritedHeld: number;
  inheritStated: number;
  inheritKept: number;
  annuityBuy: number;
  annuityIncome: number;
  pensionIncome: number;
  allowanceIncome: number;
  reverseMortgage: number;
  investmentReturn: number;
  closingFinancial: number;
  propertyHeld: number;
  lockedBalance: number;
  /** Months counted in this row. The current age uses the months left until the next birthday. */
  months: number;
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

export type LifePlanInflows = {
  accounts?: RetirementAccount[];
  allowances?: Allowance[];
  retireAge?: number;
  birthday?: string;
  postJobMonthly?: number;
};

function allowanceForAge(rows: Allowance[] | undefined, age: number, yearsFromStart: number, inflation: number, mode: "nominal" | "real"): number {
  let sum = 0;
  for (const a of rows ?? []) {
    if (age < a.startAge) continue;
    if (a.payoutYears != null && a.payoutYears > 0 && age >= a.startAge + a.payoutYears) continue;
    if (a.endAge != null && age >= a.endAge) continue;
    const grown = a.inflationAdjusted && mode !== "real" ? (1 + inflation) ** yearsFromStart : 1;
    sum += a.monthly * 12 * grown;
  }
  return sum;
}

function monthsUntilNextBirthday(birthday: string, today: string): number {
  const [, bm, bd] = birthday.split("-").map(Number);
  const [ty, tm, td] = today.slice(0, 10).split("-").map(Number);
  if (!bm || !bd || !ty || !tm || !td) return 12;
  let year = ty;
  if (tm > bm || (tm === bm && td >= bd)) year += 1;
  let months = (year - ty) * 12 + (bm - tm);
  if (td > bd) months -= 1;
  if (months < 1) return 1;
  return Math.min(12, months);
}

function n(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function inheritanceAnnuityAccount(plan: RetirementLifePlan, now = new Date().toISOString()): import("../types.ts").RetirementAccount | null {
  const p = plan.inheritedProperty;
  const fromNew = Boolean(p.enabled && p.sell && p.buyAnnuity);
  const fromOld = Boolean(plan.publicAnnuity.enabled && plan.publicAnnuity.useInheritedSaleProceeds);
  if (!fromNew && !fromOld) return null;
  const premium = Math.min(INHERIT_ANNUITY_CAP, Math.max(0, n(fromNew ? p.annuityPremium : plan.publicAnnuity.purchaseAmount)));
  const monthly = n(fromNew ? p.annuityMonthly : plan.publicAnnuity.monthlyPayout);
  if (premium <= 0 || monthly <= 0) return null;
  const start = (fromNew ? p.annuityStartAge : plan.publicAnnuity.payoutStartAge) ?? 65;
  return {
    ...applyAnnuityTerms(blankRetirementAccount("ANNUITY", now), monthly, 0, start),
    id: INHERIT_ANNUITY_ID,
    name: "遺產年金",
    currentBalance: 0,
  };
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
    if (s.monthlyLivingCostInTodayMoney == null || s.startAge == null || s.endAge == null) return false;
    const a0 = Math.min(s.startAge, s.endAge);
    const a1 = Math.max(s.startAge, s.endAge);
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

function pathRetireAge(plan: RetirementLifePlan, path: LifePathId, startYear: number, startAge: number, endAge: number): number {
  for (let age = startAge; age <= endAge; age++) {
    const calendarYear = startYear + (age - startAge);
    if (phaseFor(path, plan, `${calendarYear}-12-31`) === "retired") return age;
  }
  return endAge + 1;
}

function simulatePath(plan: RetirementLifePlan, path: LifePathId, asOf: string, inflows?: LifePlanInflows, shock?: LifePlanShock): LifePathResult {
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
  let shocked = false;
  const target = plan.personal.targetTerminalFinancialAssets;
  const accounts = (inflows?.accounts ?? []).filter((a) => a.includeInRetirementProjection && a.status !== "closed");
  const balances = new Map(accounts.map((a) => [a.id, n(a.currentBalance)]));
  const lumpDone = new Set<string>();
  const birthday = plan.personal.dateOfBirth || inflows?.birthday;
  const jobRetireAge = pathRetireAge(plan, path, startYear, startAge, endAge);

  for (let age = startAge; age <= endAge; age++) {
    const calendarYear = startYear + (age - startAge);
    const yearEnd = `${calendarYear}-12-31`;
    const i = age - startAge;
    const phase = phaseFor(path, plan, yearEnd);
    if (shock?.shockAtRetire && !shocked && phase === "retired") {
      financial *= 1 + shock.shockAtRetire;
      shocked = true;
    }
    const opening = financial;
    const notes: string[] = [];
    let income = 0;
    let living = 0;
    let livingMonthlyToday = 0;
    if (phase === "current") {
      const net = netCurrent(plan, i);
      const netAnnual = net * 12;
      if (plan.currentJob.monthlySavingsOverride != null) {
        income = netAnnual;
        living = netAnnual - plan.currentJob.monthlySavingsOverride * 12;
        livingMonthlyToday = living / 12;
      } else {
        income = netAnnual;
        livingMonthlyToday = n(plan.currentJob.actualMonthlySpending);
        living = livingMonthlyToday * 12;
      }
    } else if (phase === "lower") {
      income = netLower(plan, i) * 12;
      livingMonthlyToday = n(plan.lowerStressJob.monthlyLivingCost);
      living = inflate(livingMonthlyToday * 12, inf, i, plan.lowerStressJob.livingCostFollowsInflation, mode);
    } else {
      const st = stageSpend(plan.spendingStages, age);
      livingMonthlyToday = st?.monthly ?? 0;
      living = st ? inflate(livingMonthlyToday * 12, inf, i, st.follows, mode) : 0;
      if (!st) notes.push("No retirement spending stage for this age.");
      income += Math.max(0, n(inflows?.postJobMonthly)) * 12;
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
    let inheritStated = 0;
    let annuityBuy = 0;
    const fromInherit = Boolean(plan.inheritedProperty.buyAnnuity);
    if (plan.inheritedProperty.enabled && plan.inheritedProperty.expectedDate && inheritedHeld === 0 && !inheritedSold) {
      const y = isoYear(plan.inheritedProperty.expectedDate, 0);
      if (calendarYear === y || (i === 0 && y < startYear)) {
        const yearsLate = Math.max(0, calendarYear - y);
        inheritedHeld = n(plan.inheritedProperty.expectedValue) * (1 + n(plan.inheritedProperty.annualGrowthRate)) ** yearsLate;
        notes.push(yearsLate > 0 ? "inherit-already" : "inherit-received");
      }
    }
    if (inheritedHeld > 0) inheritedHeld *= 1 + n(plan.inheritedProperty.annualGrowthRate);
    if (plan.inheritedProperty.enabled && plan.inheritedProperty.sell && plan.inheritedProperty.sellDate) {
      const sy = isoYear(plan.inheritedProperty.sellDate, 0);
      if (calendarYear === sy && !inheritedSold) {
        inheritStated = n(plan.inheritedProperty.expectedValue);
        inheritProceeds = inheritStated;
        inheritedHeld = 0;
        inheritedSold = true;
        notes.push("inherit-sold");
        if (fromInherit) {
          const asked = Math.min(INHERIT_ANNUITY_CAP, Math.max(0, n(plan.inheritedProperty.annuityPremium)));
          annuityBuy = Math.min(asked, inheritProceeds);
          if (annuityBuy > 0) {
            annuityBought = true;
            notes.push("inherit-annuity");
          }
        } else if (plan.publicAnnuity.enabled && plan.publicAnnuity.useInheritedSaleProceeds) {
          const buy = plan.publicAnnuity.purchaseAmount != null ? Math.min(n(plan.publicAnnuity.purchaseAmount), inheritProceeds) : inheritProceeds;
          annuityBuy = buy;
          if (annuityBuy > 0) notes.push("inherit-annuity");
          annuityBought = true;
        }
      }
    }

    if (!fromInherit && plan.publicAnnuity.enabled && !plan.publicAnnuity.useInheritedSaleProceeds && plan.publicAnnuity.purchaseDate) {
      const py = isoYear(plan.publicAnnuity.purchaseDate, 0);
      if (calendarYear === py && !annuityBought) {
        annuityBuy = n(plan.publicAnnuity.purchaseAmount);
        annuityBought = true;
        notes.push("annuity-bought");
      }
    }

    let annuityIncome = 0;
    if (fromInherit) {
      const startA = plan.inheritedProperty.annuityStartAge ?? age;
      const monthly = n(plan.inheritedProperty.annuityMonthly);
      if (annuityBought && age >= startA && monthly > 0) annuityIncome = monthly * 12;
    } else if (plan.publicAnnuity.enabled && annuityBought && plan.publicAnnuity.monthlyPayout) {
      const startA = plan.publicAnnuity.payoutStartAge ?? age;
      const years = plan.publicAnnuity.payoutYears;
      const within = age >= startA && (years == null || years === 0 || age < startA + years);
      if (within) annuityIncome = n(plan.publicAnnuity.monthlyPayout) * 12;
    }

    let pensionIncome = 0;
    for (const acc of accounts) {
      if (acc.id === INHERIT_ANNUITY_ID) continue;
      const row = projectRetirementAccountYear({
        account: acc,
        openingBalance: balances.get(acc.id) ?? 0,
        age,
        calendarYear,
        yearsSinceStart: i,
        retireAge: jobRetireAge,
        birthday: birthday ?? undefined,
        alreadyLumpSum: lumpDone.has(acc.id),
      });
      if (row.notes.includes("lump sum at access")) lumpDone.add(acc.id);
      balances.set(acc.id, row.closingBalance);
      pensionIncome += row.cashFlowAvailableToRetirementPlan;
    }
    let allowanceIncome = allowanceForAge(inflows?.allowances, age, i, inf, mode);
    const lockedBalance = [...balances.entries()].reduce((s, [id, v]) => (id === INHERIT_ANNUITY_ID ? s : s + v), 0);

    home *= 1 + n(plan.assets.selfOccupiedPropertyGrowthRate);
    let reverseMortgage = 0;
    if (plan.reverseMortgage.enabled && plan.reverseMortgage.startAge != null && age >= plan.reverseMortgage.startAge) {
      if (plan.reverseMortgage.monthlyPayout != null) reverseMortgage = n(plan.reverseMortgage.monthlyPayout) * 12;
      else if (plan.reverseMortgage.ltv && home > 0) {
        const left = Math.max(1, endAge - age + 1);
        reverseMortgage = (home * n(plan.reverseMortgage.ltv)) / left;
      }
    }

    const months = i === 0 ? monthsUntilNextBirthday(dob, asOf) : 12;
    const part = months / 12;
    if (part !== 1) {
      income *= part;
      living *= part;
      mortgagePay *= part;
      annuityIncome *= part;
      pensionIncome *= part;
      allowanceIncome *= part;
      reverseMortgage *= part;
    }

    const investmentReturn = Math.max(0, financial) * ret * part;
    const inheritKept = Math.max(0, inheritProceeds - annuityBuy);
    financial = financial + investmentReturn + income + inheritKept + annuityIncome + pensionIncome + allowanceIncome + reverseMortgage - living - mortgagePay;
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
      livingMonthlyToday,
      mortgage: mortgagePay,
      inheritProceeds,
      inheritedHeld,
      inheritStated,
      inheritKept,
      annuityBuy,
      annuityIncome,
      pensionIncome,
      allowanceIncome,
      reverseMortgage,
      investmentReturn,
      closingFinancial: financial,
      propertyHeld: home + inheritedHeld,
      lockedBalance,
      months,
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

export type LifePlanShock = {
  returnDelta?: number;
  inflation?: number;
  endAge?: number;
  shockAtRetire?: number;
};

export function runLifePlan(
  plan: RetirementLifePlan,
  asOf = new Date().toISOString().slice(0, 10),
  inflows?: LifePlanInflows,
  shock?: LifePlanShock,
): LifePlanResult {
  const shockedPlan = shock ? applyLifeShock(plan, shock) : plan;
  const missing = lifePlanMissing(shockedPlan);
  if (missing.length) return { ready: false, missing, stay: null, switch: null };
  const stay = shockedPlan.currentJob.enabled ? simulatePath(shockedPlan, "stay", asOf, inflows, shock) : null;
  const sw = shockedPlan.lowerStressJob.enabled && Boolean(shockedPlan.lowerStressJob.startDate) ? simulatePath(shockedPlan, "switch", asOf, inflows, shock) : null;
  return { ready: true, missing: [], stay, switch: sw };
}

/** Flat retirement living cost, in today's HKD, that the stay path can still carry. */
export function lifePlanMonthlyRoom(
  plan: RetirementLifePlan,
  asOf = new Date().toISOString().slice(0, 10),
  inflows?: LifePlanInflows,
): { planned: number; sustainable: number; surplus: number } {
  const stay = runLifePlan(plan, asOf, inflows).stay;
  if (!stay) return { planned: 0, sustainable: 0, surplus: 0 };
  const retireAge = stay.retireAge;
  const planned = stay.years.find((y) => y.age >= retireAge)?.livingMonthlyToday ?? 0;
  const target = n(plan.personal.targetTerminalFinancialAssets);
  const ok = (monthly: number) => {
    const trial = runLifePlan(withRetirementSpend(plan, retireAge, monthly), asOf, inflows).stay;
    if (!trial || trial.depletes) return false;
    return trial.terminalAssets + 1 >= target;
  };
  if (!ok(0)) return { planned, sustainable: 0, surplus: -planned };
  let lo = 0;
  let hi = Math.max(planned * 2, 10_000);
  for (let i = 0; i < 14 && ok(hi) && hi < 2_000_000; i++) hi *= 2;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  const sustainable = Math.round(lo);
  return { planned, sustainable, surplus: sustainable - Math.round(planned) };
}

function withRetirementSpend(plan: RetirementLifePlan, retireAge: number, monthly: number): RetirementLifePlan {
  const end = plan.personal.planEndAge ?? 120;
  const stages = plan.spendingStages.flatMap((s) => {
    const start = s.startAge ?? 0;
    const stop = s.endAge ?? 200;
    if (stop < retireAge) return [s];
    if (start >= retireAge) return [{ ...s, monthlyLivingCostInTodayMoney: monthly }];
    return [
      { ...s, endAge: retireAge - 1 },
      { ...s, id: `${s.id}-room`, startAge: retireAge, monthlyLivingCostInTodayMoney: monthly },
    ];
  });
  if (!stages.some((s) => (s.startAge ?? 0) >= retireAge && s.monthlyLivingCostInTodayMoney != null)) {
    stages.push({
      id: "room",
      label: "",
      startAge: retireAge,
      endAge: end,
      monthlyLivingCostInTodayMoney: monthly,
      followsInflation: true,
      isEssential: true,
      notes: "",
    });
  }
  return { ...plan, spendingStages: stages };
}

function applyLifeShock(plan: RetirementLifePlan, shock: LifePlanShock): RetirementLifePlan {
  return {
    ...plan,
    personal: { ...plan.personal, planEndAge: shock.endAge ?? plan.personal.planEndAge },
    retirement: {
      ...plan.retirement,
      annualInvestmentReturn:
        shock.returnDelta != null ? Math.max(0, n(plan.retirement.annualInvestmentReturn) + shock.returnDelta) : plan.retirement.annualInvestmentReturn,
      annualInflationRate: shock.inflation ?? plan.retirement.annualInflationRate,
    },
  };
}

export function dateAtAge(dob: string | null | undefined, age: number, today: string, currentAge: number): string {
  if (dob && /^\d{4}/.test(dob)) return `${Number(dob.slice(0, 4)) + age}-12-31`;
  const y = Number(today.slice(0, 4)) + (age - currentAge);
  return `${y}-12-31`;
}

function impliedBirthday(today: string, currentAge: number): string {
  const y = Number(today.slice(0, 4)) - currentAge;
  return `${Number.isFinite(y) ? y : 1980}-01-01`;
}

export type LifePlanShared = {
  birthday?: string;
  currentAge: number;
  retireAge: number;
  deathAge: number;
  inflation: number;
  postReturn: number;
  monthlyIncomeNow: number;
  monthlySpendNow: number;
  targetMonthly: number;
  reverseMortgageLtv?: number;
  investable: number;
  property: number;
  mortgage: {
    outstanding: number;
    monthlyPayment: number;
    endDate: string;
    rate: number;
  } | null;
  today: string;
};

/** Fill blank life-plan fields from the shared retirement profile. Spending follows that profile. */
export function resolveLifePlan(plan: RetirementLifePlan, shared: LifePlanShared): RetirementLifePlan {
  const retireDate = dateAtAge(shared.birthday, shared.retireAge, shared.today, shared.currentAge);
  const spendNow = shared.monthlySpendNow || plan.currentJob.actualMonthlySpending;
  const retireSpend = shared.targetMonthly || null;
  const specific = plan.spendingStages.filter(
    (s) => s.id !== "from-profile" && s.monthlyLivingCostInTodayMoney != null && s.startAge != null && s.endAge != null,
  );
  const stages = [
    ...specific,
    ...(retireSpend
      ? [
          {
            id: "from-profile",
            label: "",
            startAge: shared.retireAge,
            endAge: shared.deathAge,
            monthlyLivingCostInTodayMoney: retireSpend,
            followsInflation: true,
            isEssential: true,
            notes: "",
          },
        ]
      : []),
  ];
  const mort = plan.mortgage;
  const sharedMort = shared.mortgage;
  return mergeLifePlan(plan, {
    personal: {
      dateOfBirth: plan.personal.dateOfBirth || shared.birthday || impliedBirthday(shared.today, shared.currentAge),
      planStartDate: plan.personal.planStartDate || shared.today,
      planEndAge: plan.personal.planEndAge ?? shared.deathAge,
      targetTerminalFinancialAssets: plan.personal.targetTerminalFinancialAssets,
    },
    currentJob: {
      ...plan.currentJob,
      endDate: plan.currentJob.endDate || retireDate,
      grossMonthlyIncome: plan.currentJob.grossMonthlyIncome ?? (shared.monthlyIncomeNow || null),
      actualMonthlySpending: spendNow,
      monthlySavingsOverride: null,
    },
    retirement: {
      ...plan.retirement,
      startDate: plan.retirement.startDate || retireDate,
      annualInvestmentReturn: plan.retirement.annualInvestmentReturn ?? shared.postReturn,
      annualInflationRate: plan.retirement.annualInflationRate ?? shared.inflation,
    },
    spendingStages: stages,
    assets: {
      financialAssets: plan.assets.financialAssets ?? shared.investable,
      selfOccupiedPropertyValue: plan.assets.selfOccupiedPropertyValue ?? (shared.property || null),
      selfOccupiedPropertyGrowthRate: plan.assets.selfOccupiedPropertyGrowthRate,
    },
    mortgage: {
      ...mort,
      enabled: mort.enabled,
      outstandingBalance: mort.outstandingBalance ?? sharedMort?.outstanding ?? null,
      monthlyPayment: mort.monthlyPayment ?? sharedMort?.monthlyPayment ?? null,
      endDate: mort.endDate || sharedMort?.endDate || null,
      annualInterestRate: mort.annualInterestRate ?? sharedMort?.rate ?? null,
      paymentIncludedInCurrentSpending: true,
      paymentIncludedInRetirementLivingCost: false,
    },
    reverseMortgage: {
      ...plan.reverseMortgage,
      ltv: plan.reverseMortgage.ltv ?? shared.reverseMortgageLtv ?? null,
    },
  });
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
