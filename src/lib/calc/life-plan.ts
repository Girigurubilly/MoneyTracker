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
      incomeIsNet: false,
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
      annualInvestmentReturnPre: null,
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
  /** Family support. Include adds it to spending for `years`. Reserve sets that lump aside up front. */
  parentSupport?: { monthly: number; years: number; mode: "include" | "reserve" };
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
  const grown = n(plan.currentJob.grossMonthlyIncome) * (1 + n(plan.currentJob.annualIncomeGrowthRate)) ** yearsFromStart;
  if (plan.currentJob.incomeIsNet) return grown;
  return estimateHkNetMonthly(grown);
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
  const retPost = n(plan.retirement.annualInvestmentReturn);
  const retPre = plan.retirement.annualInvestmentReturnPre != null
    ? n(plan.retirement.annualInvestmentReturnPre)
    : retPost;
  const mode = plan.retirement.returnMode;
  let financial = n(plan.assets.financialAssets);
  const support = inflows?.parentSupport;
  if (support && support.mode === "reserve" && support.monthly > 0 && support.years > 0) {
    financial -= support.monthly * 12 * support.years;
  }
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
  let retireOverride = false;
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
    if (shock?.financialAtRetire != null && !retireOverride && phase === "retired") {
      financial = Math.max(0, shock.financialAtRetire);
      retireOverride = true;
    }
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
    if (support && support.mode === "include" && support.monthly > 0 && support.years > 0 && i < support.years) {
      living += support.monthly * 12;
      livingMonthlyToday += support.monthly;
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

    const rate = phase === "retired" ? retPost : retPre;
    const investmentReturn = Math.max(0, financial) * rate * part;
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
  /** Replace opening usable assets on the first retired year (for funding-target search). */
  financialAtRetire?: number;
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
  const soft = shockedPlan.lowerStressJob;
  const softIncome =
    (soft.estimatedNetMonthlyIncomeOverride != null && soft.estimatedNetMonthlyIncomeOverride > 0) ||
    (soft.grossMonthlyIncome != null && soft.grossMonthlyIncome > 0);
  const sw =
    soft.enabled && Boolean(soft.startDate) && softIncome
      ? simulatePath(shockedPlan, "switch", asOf, inflows, shock)
      : null;
  return { ready: true, missing: [], stay, switch: sw };
}

/** How much retirement spending can rise, or must fall, and still last. Stages keep their own ages. */
export function lifePlanMonthlyRoom(
  plan: RetirementLifePlan,
  asOf = new Date().toISOString().slice(0, 10),
  inflows?: LifePlanInflows,
): { planned: number; sustainable: number; surplus: number } {
  const stay = runLifePlan(plan, asOf, inflows).stay;
  if (!stay || stay.retireAge == null) return { planned: 0, sustainable: 0, surplus: 0 };
  const retireAge = stay.retireAge;
  const planned = stay.years.find((y) => y.age >= retireAge)?.livingMonthlyToday ?? 0;
  const target = n(plan.personal.targetTerminalFinancialAssets);
  const meets = (delta: number) => {
    const trial = runLifePlan(shiftRetirementSpend(plan, retireAge, delta), asOf, inflows).stay;
    if (!trial || trial.depletes) return false;
    return trial.terminalAssets + 1 >= target;
  };
  if (meets(0)) {
    let lo = 0;
    let hi = Math.max(planned, 5_000);
    for (let i = 0; i < 12 && meets(hi) && hi < 1_000_000; i++) hi *= 2;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (meets(mid)) lo = mid;
      else hi = mid;
    }
    const surplus = Math.round(lo);
    return { planned, sustainable: Math.round(planned + surplus), surplus };
  }
  const floor = -Math.max(planned, 1);
  if (!meets(floor)) return { planned, sustainable: 0, surplus: -Math.round(planned) };
  let lo = floor;
  let hi = 0;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (meets(mid)) lo = mid;
    else hi = mid;
  }
  const surplus = Math.round(lo);
  return { planned, sustainable: Math.max(0, Math.round(planned + surplus)), surplus };
}


export type LifePlanFundingTarget = {
  ready: boolean;
  need: number;
  have: number;
  gap: number;
  retireAge: number | null;
  planEndAge: number;
};

/**
 * Usable (investable) assets required on retirement day so inflated spending
 * lasts through the plan-through age, with any end-of-plan buffer.
 * Property is not part of need or have.
 */
export function lifePlanFundingTarget(
  plan: RetirementLifePlan,
  asOf = new Date().toISOString().slice(0, 10),
  inflows?: LifePlanInflows,
): LifePlanFundingTarget {
  const planEndAge = n(plan.personal.planEndAge);
  const stay = runLifePlan(plan, asOf, inflows).stay;
  if (!stay || stay.retireAge == null) {
    return { ready: false, need: 0, have: 0, gap: 0, retireAge: null, planEndAge };
  }
  const have = Math.max(0, Math.round(stay.assetsAtRetire));
  const buffer = n(plan.personal.targetTerminalFinancialAssets);
  const meets = (amount: number) => {
    const trial = runLifePlan(plan, asOf, inflows, { financialAtRetire: Math.max(0, amount) }).stay;
    if (!trial || trial.depletes) return false;
    return trial.terminalAssets + 1 >= buffer;
  };
  const need = Math.round(searchNeedAtRetire(meets, buffer, n(plan.assets.financialAssets)));
  return { ready: true, need, have, gap: have - need, retireAge: stay.retireAge, planEndAge };
}

function searchNeedAtRetire(meets: (amount: number) => boolean, buffer: number, seed: number): number {
  if (meets(0)) return 0;
  let lo = 0;
  let hi = Math.max(1_000_000, buffer * 2, seed * 2, 10_000);
  for (let i = 0; i < 16 && !meets(hi) && hi < 5_000_000_000; i++) hi *= 2;
  if (!meets(hi)) return hi;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (meets(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}


export type TimeToTargetKind = "already" | "unknown-velocity" | "on-track" | "after-retire" | "never" | "negative";

export type TimeToTarget = {
  kind: TimeToTargetKind;
  monthlySave: number;
  years: number | null;
  age: number | null;
  calendarYear: number | null;
};

export type NowGapTone = "over" | "accumulating" | "late";

/** Colour for today's remaining amount. On-track remaining is not a failure. */
export function nowGapTone(nowGap: number, kind: TimeToTargetKind | null | undefined): NowGapTone {
  if (nowGap <= 0) return "over";
  if (kind === "after-retire" || kind === "never" || kind === "negative") return "late";
  return "accumulating";
}

export type EarliestRetireKind = "already" | "found" | "never" | "unknown";
export type EarliestVsPlanned = "earlier" | "same" | "later" | "none";

export type EarliestRetire = {
  kind: EarliestRetireKind;
  age: number | null;
  plannedAge: number;
  planEndAge: number;
  vsPlanned: EarliestVsPlanned;
};

/** Colour for today's remaining amount when the official earliest-retire age is known. */
export function earliestRetireTone(nowGap: number, row: EarliestRetire | null | undefined): NowGapTone {
  if (nowGap <= 0) return "over";
  if (!row || row.kind === "never" || row.kind === "unknown" || row.vsPlanned === "later") return "late";
  return "accumulating";
}

function pathLastsThrough(plan: RetirementLifePlan, asOf: string, inflows?: LifePlanInflows): boolean {
  const stay = runLifePlan(plan, asOf, inflows).stay;
  if (!stay) return false;
  const buffer = n(plan.personal.targetTerminalFinancialAssets);
  return !stay.depletes && stay.terminalAssets + 1 >= buffer;
}

/**
 * Earliest age at which retiring (and then spending the official living costs)
 * still lasts through the plan-through age, using the same year-by-year path
 * as the official need / have / lasts-to answer. The stated retire age in
 * Settings is only the comparison, not an input that changes this age.
 */
export function earliestSustainableRetireAge(
  plan: RetirementLifePlan,
  shared: LifePlanShared,
  asOf = shared.today,
  inflows?: LifePlanInflows,
): EarliestRetire {
  const plannedAge = Number.isFinite(shared.retireAge) ? Math.round(shared.retireAge) : 0;
  const planEndAge = plan.personal.planEndAge ?? shared.deathAge;
  const blank = (kind: EarliestRetireKind): EarliestRetire => ({
    kind,
    age: null,
    plannedAge,
    planEndAge: Number.isFinite(planEndAge) ? planEndAge : 0,
    vsPlanned: "none",
  });
  if (!Number.isFinite(plannedAge) || !Number.isFinite(planEndAge)) return blank("unknown");
  const startAge = Math.max(0, Math.floor(shared.currentAge));
  const lastAge = Math.max(startAge, Math.floor(planEndAge));
  for (let age = startAge; age <= lastAge; age++) {
    const resolved = resolveLifePlan(plan, { ...shared, retireAge: age });
    const trialInflows = inflows ? { ...inflows, retireAge: age } : { retireAge: age };
    if (!pathLastsThrough(resolved, asOf, trialInflows)) continue;
    const kind: EarliestRetireKind = age <= startAge ? "already" : "found";
    const vsPlanned: EarliestVsPlanned =
      age < plannedAge ? "earlier" : age === plannedAge ? "same" : "later";
    return { kind, age, plannedAge, planEndAge, vsPlanned };
  }
  return blank("never");
}

function addMonthsIso(iso: string, months: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setMonth(d.getMonth() + Math.max(0, Math.round(months)));
  return d.toISOString().slice(0, 10);
}

/**
 * When today's usable assets, grown at the official pre-retire return and
 * topped up by current monthly saving (take-home minus spending now), first
 * reach the official retirement-day funding need.
 *
 * `need` is treated as a fixed then-money target (the amount required on
 * retirement day, with inflation already baked in). The projection is a
 * simple nominal growth of today's pot — a prompt for "how long at this
 * pace", not a second full life-plan path.
 *
 * If a birthday is set, the current incomplete year only counts the months
 * until the next birthday. If income and spending now are both zero,
 * velocity is unknown and no date is invented.
 */
export function lifePlanTimeToTarget(opts: {
  need: number;
  investableNow: number;
  monthlyIncome: number;
  monthlySpend: number;
  preReturn: number;
  currentAge: number;
  retireAge: number;
  planEndAge: number;
  asOf?: string;
  birthday?: string;
}): TimeToTarget {
  const need = Math.max(0, Number.isFinite(opts.need) ? opts.need : 0);
  const pot0 = Math.max(0, Number.isFinite(opts.investableNow) ? opts.investableNow : 0);
  const income = Number.isFinite(opts.monthlyIncome) ? opts.monthlyIncome : 0;
  const spend = Number.isFinite(opts.monthlySpend) ? opts.monthlySpend : 0;
  const monthlySave = income - spend;
  const currentAge = Number.isFinite(opts.currentAge) ? opts.currentAge : 0;
  const retireAge = Number.isFinite(opts.retireAge) ? opts.retireAge : currentAge;
  const planEndAge = Number.isFinite(opts.planEndAge) && opts.planEndAge > currentAge ? opts.planEndAge : currentAge;
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const startYear = Number(asOf.slice(0, 4));
  const year0 = Number.isFinite(startYear) ? startYear : 2026;

  const empty: TimeToTarget = { kind: "already", monthlySave, years: 0, age: currentAge, calendarYear: year0 };
  if (need <= 0 || pot0 + 1 >= need) return empty;

  const velocityKnown = income > 0 || spend > 0;
  if (!velocityKnown) {
    return { kind: "unknown-velocity", monthlySave, years: null, age: null, calendarYear: null };
  }

  const r = Number.isFinite(opts.preReturn) ? Math.max(0, opts.preReturn) : 0;
  const capYears = Math.max(0, planEndAge - currentAge);
  const capMonths = Math.max(0, Math.round(capYears * 12));
  const birthday = opts.birthday?.slice(0, 10);
  const firstMonths = birthday && /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? monthsUntilNextBirthday(birthday, asOf) : 12;

  const grow = (pot: number, months: number) => pot * (1 + r) ** (months / 12) + monthlySave * months;

  let pot = pot0;
  let monthsTotal = 0;
  const stepOnce = (months: number) => {
    pot = grow(pot, months);
    monthsTotal += months;
    if (!Number.isFinite(pot)) {
      pot = Number.POSITIVE_INFINITY;
      monthsTotal = capMonths;
    }
  };

  if (firstMonths > 0 && capMonths > 0) stepOnce(Math.min(firstMonths, capMonths));
  while (pot + 1 < need && monthsTotal < capMonths) {
    stepOnce(Math.min(12, capMonths - monthsTotal));
  }
  const reached = pot + 1 >= need;
  if (!reached) {
    return {
      kind: monthlySave <= 0 ? "negative" : "never",
      monthlySave,
      years: null,
      age: null,
      calendarYear: null,
    };
  }
  const years = monthsTotal / 12;
  const age = currentAge + years;
  const kind: TimeToTargetKind = age <= retireAge ? "on-track" : "after-retire";
  const endDate = addMonthsIso(asOf, monthsTotal);
  const calendarYear = Number(endDate.slice(0, 4));
  return { kind, monthlySave, years, age, calendarYear: Number.isFinite(calendarYear) ? calendarYear : year0 };
}

/**
 * Take-home and spending used for a job-switch time-to-target check.
 * Same 實收 − 開支 idea as the official stay path: net override if set,
 * otherwise an estimated take-home from gross; living cost if set.
 * Both missing/zero means velocity is unknown (no invented date).
 */
export function lifePlanSwitchSavingsPace(plan: RetirementLifePlan): {
  monthlyIncome: number;
  monthlySpend: number;
} {
  const job = plan.lowerStressJob;
  const monthlyIncome =
    job.estimatedNetMonthlyIncomeOverride != null
      ? n(job.estimatedNetMonthlyIncomeOverride)
      : job.grossMonthlyIncome != null && job.grossMonthlyIncome > 0
        ? estimateHkNetMonthly(job.grossMonthlyIncome)
        : 0;
  const monthlySpend = job.monthlyLivingCost != null ? n(job.monthlyLivingCost) : 0;
  return { monthlyIncome, monthlySpend };
}

function shiftRetirementSpend(plan: RetirementLifePlan, retireAge: number, delta: number): RetirementLifePlan {
  const stages = plan.spendingStages.flatMap((s) => {
    if (s.monthlyLivingCostInTodayMoney == null || s.startAge == null || s.endAge == null) return [s];
    const start = Math.min(s.startAge, s.endAge);
    const stop = Math.max(s.startAge, s.endAge);
    const bumped = { ...s, monthlyLivingCostInTodayMoney: Math.max(0, s.monthlyLivingCostInTodayMoney + delta) };
    if (stop < retireAge) return [s];
    if (start >= retireAge) return [bumped];
    return [
      { ...s, endAge: retireAge - 1 },
      { ...bumped, id: `${s.id}-shift`, startAge: retireAge },
    ];
  });
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
      annualInvestmentReturnPre:
        shock.returnDelta != null
          ? Math.max(0, n(plan.retirement.annualInvestmentReturnPre ?? plan.retirement.annualInvestmentReturn) + shock.returnDelta)
          : plan.retirement.annualInvestmentReturnPre,
      annualInflationRate: shock.inflation ?? plan.retirement.annualInflationRate,
    },
  };
}

/** Calendar date they turn `age`: the birthday in that year, or 1 Jan when no birthday is set. */
export function dateAtAge(dob: string | null | undefined, age: number, today: string, currentAge: number): string {
  const nAge = Number.isFinite(age) ? Math.round(age) : 0;
  const iso = dob?.slice(0, 10) ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${Number(iso.slice(0, 4)) + nAge}-${iso.slice(5, 10)}`;
  const y = Number(today.slice(0, 4)) + (nAge - currentAge);
  return `${Number.isFinite(y) ? y : Number(today.slice(0, 4))}-01-01`;
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
  preReturn: number;
  postReturn: number;
  monthlyIncomeNow: number;
  monthlySpendNow: number;
  incomeIsNet?: boolean;
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

/** Fill blank life-plan fields from the shared retirement profile. Spending follows that profile.
 *  Official stay-path birthday, plan start, job-end and retirement-start always follow the
 *  shared profile (Settings retire age and birthday, starting today). A stale stored
 *  birthday or date must not win, or yearly ages will not match the stated retire age.
 *  Switch-path dates are left as stored.
 */
export function resolveLifePlan(plan: RetirementLifePlan, shared: LifePlanShared): RetirementLifePlan {
  const dob = shared.birthday || plan.personal.dateOfBirth;
  const retireDate = dateAtAge(dob, shared.retireAge, shared.today, shared.currentAge);
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
      dateOfBirth: shared.birthday || plan.personal.dateOfBirth || impliedBirthday(shared.today, shared.currentAge),
      planStartDate: shared.today,
      planEndAge: plan.personal.planEndAge ?? shared.deathAge,
      targetTerminalFinancialAssets: plan.personal.targetTerminalFinancialAssets,
    },
    currentJob: {
      ...plan.currentJob,
      endDate: retireDate,
      grossMonthlyIncome: plan.currentJob.grossMonthlyIncome ?? (shared.monthlyIncomeNow || null),
      actualMonthlySpending: spendNow,
      monthlySavingsOverride: null,
      incomeIsNet: shared.incomeIsNet ?? plan.currentJob.incomeIsNet ?? false,
    },
    retirement: {
      ...plan.retirement,
      startDate: retireDate,
      annualInvestmentReturn: plan.retirement.annualInvestmentReturn ?? shared.postReturn,
      annualInvestmentReturnPre: plan.retirement.annualInvestmentReturnPre ?? shared.preReturn,
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
