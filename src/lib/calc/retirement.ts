import type { Account, Allowance, FxRate, Holding, Mortgage, OneOff, RetirementAccount, RetirementPhaseExpenseRule, TimeSaving, Transaction } from "../types.ts";
import { cashflowSide, inMonth } from "./ledger.ts";
import { toHkd } from "./fx.ts";
import { holdingsForAccount } from "../holdings.ts";
import { mortgageFlowForYear, mortgageSchedule } from "./mortgage.ts";
import { projectRetirementAccountYear, type RetirementAccountProjectionYear } from "./mpf.ts";

export type RetirementInputs = {
  currentAge: number;
  retireAge: number;
  deathAge: number;
  monthlyIncomeNow: number;
  monthlySpendNow: number;
  targetMonthly: number;
  preReturn: number;
  postReturn: number;
  inflation: number;
  travelInRetirement: number;
  reverseMortgageLtv?: number;
  fireSwr?: number;
  birthday?: string;
  emergencyReserve?: number;
  liquidityFloor?: number;
  desiredEndBuffer?: number;
  laterLifeAge?: number;
  payOffMortgageAtRetire?: boolean;
  phaseRules?: RetirementPhaseExpenseRule[];
};

export const DEFAULT_RETIREMENT_AGES = [52, 53, 54, 55, 56];

export type AssetSleeve = {
  id: string;
  label: string;
  amount: number;
  annualReturn: number;
  kind: "cash" | "invest" | "property";
  included: boolean;
};

export type RetirementCtx = {
  investableNow: number;
  mortgageMonthly: number;
  mortgagePayoffAge: number;
  housingAfterPayoff: number;
  oneOffs: OneOff[];
  allowances?: Allowance[];
  sleeves?: AssetSleeve[];
  propertyEquity?: number;
  reverseMortgageMonthly?: number;
  retirementAccounts?: RetirementAccount[];
  deposits?: TimeSaving[];
  mortgage?: Mortgage | null;
  today?: string;
  calendarYear?: number;
};

export type RetirementYearFlags = {
  isPreRetirement: boolean;
  isEarlyRetirement: boolean;
  hasAge65PlusIncome: boolean;
  isMortgageFree: boolean;
  isLaterLife: boolean;
};

export type RetirementReadinessStatus =
  | "funded"
  | "funded_with_low_buffer"
  | "bridge_risk"
  | "shortfall_projected"
  | "insufficient_data";

export type RetirementYearRow = {
  calendarYear: number;
  age: number;
  phaseLabel: string;
  flags: RetirementYearFlags;
  openingAccessible: number;
  openingLocked: number;
  openingMortgage: number;
  salary: number;
  depositInterest: number;
  dividendIncome: number;
  annuityIncome: number;
  mpfWithdrawal: number;
  employeeContribution: number;
  employerContribution: number;
  voluntaryContribution: number;
  essentialSpend: number;
  discretionarySpend: number;
  irregularSpend: number;
  healthcareSpend: number;
  housingSpend: number;
  travelSpend: number;
  mortgagePayment: number;
  mortgagePrincipal: number;
  mortgageInterest: number;
  portfolioWithdrawal: number;
  investmentReturn: number;
  closingAccessible: number;
  closingLocked: number;
  closingMortgage: number;
  milestones: string[];
  accounts: RetirementAccountProjectionYear[];
};

export type RetirementPlanResult = {
  years: RetirementYearRow[];
  series: { age: number; corpus: number; accessible: number; locked: number }[];
  depletes: boolean;
  depletionAge?: number;
  corpusAtRetire: number;
  lockedAtRetire: number;
  extraMonthly: number;
  requiredCorpus: number;
  minBridgeAccessible: number;
  bridgeYears: number;
  firstShortfallAge?: number;
  mortgageFreeAge?: number;
  status: RetirementReadinessStatus;
  statusWhy: string;
  earliestAccessAge: number;
};

export function savingsLast12Months(txs: Transaction[], rates: FxRate[], asOfMonth: string): {
  income: number;
  expense: number;
  monthlyIncome: number;
  monthlySpend: number;
  monthlySave: number;
} {
  const [y, m] = asOfMonth.split("-").map(Number);
  let income = 0;
  let expense = 0;
  for (let i = 0; i < 12; i++) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const tx of txs) {
      if (!inMonth(tx.date, key)) continue;
      const side = cashflowSide(tx);
      const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
      if (side === "income") income += hkd;
      if (side === "expense") expense += hkd;
    }
  }
  const monthlyIncome = income / 12;
  const monthlySpend = expense / 12;
  return { income, expense, monthlyIncome, monthlySpend, monthlySave: monthlyIncome - monthlySpend };
}

export function runRetirement(inputs: RetirementInputs, ctx: RetirementCtx) {
  const plan = runRetirementPlan(inputs, ctx);
  return {
    series: plan.series.map((s) => ({ age: s.age, corpus: s.corpus })),
    depletes: plan.depletes,
    corpusAtRetire: plan.corpusAtRetire,
    extraMonthly: plan.extraMonthly,
    requiredCorpus: plan.requiredCorpus,
    depletionAge: plan.depletionAge,
    plan,
  };
}

function phaseMultipliers(inputs: RetirementInputs, flags: RetirementYearFlags) {
  const rules = inputs.phaseRules ?? [];
  const pick = (phase: RetirementPhaseExpenseRule["phase"]) => rules.find((r) => r.phase === phase);
  const r =
    (flags.isLaterLife && pick("later_life")) ||
    (flags.hasAge65PlusIncome && pick("age_65_plus")) ||
    (flags.isEarlyRetirement && pick("early_retirement")) ||
    (flags.isPreRetirement && pick("pre_retirement")) ||
    undefined;
  const housing = flags.isMortgageFree ? pick("mortgage_free") : undefined;
  return {
    essential: r?.essentialSpendMultiplier ?? 1,
    discretionary: r?.discretionarySpendMultiplier ?? 1,
    travel: r?.travelSpendMultiplier ?? 1,
    healthcare: r?.healthcareSpendMultiplier ?? 1,
    irregular: r?.irregularSpendMultiplier ?? 1,
    housing: housing?.propertyMaintenanceMultiplier ?? r?.propertyMaintenanceMultiplier ?? 1,
  };
}

export function phaseLabel(flags: RetirementYearFlags): string {
  const life = flags.isPreRetirement
    ? "Pre-retirement"
    : flags.isLaterLife
      ? "Later life"
      : flags.hasAge65PlusIncome
        ? "Age 65+"
        : "Early retirement";
  return `${life} · ${flags.isMortgageFree ? "mortgage-free" : "mortgage active"}`;
}

export function runRetirementPlan(inputs: RetirementInputs, ctx: RetirementCtx): RetirementPlanResult {
  const years = Math.max(1, inputs.deathAge - inputs.currentAge);
  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const startYear = ctx.calendarYear ?? Number(today.slice(0, 4));
  const accounts = (ctx.retirementAccounts ?? []).filter((a) => a.includeInRetirementProjection && a.status !== "closed");
  const linked = new Set(accounts.map((a) => a.linkedAccountId).filter(Boolean) as string[]);
  const sleeves = (ctx.sleeves ?? [])
    .filter((s) => s.kind !== "property" && s.included !== false && !linked.has(s.id))
    .map((s) => ({ ...s }));
  let accessible = sleeves.length ? sleeves.reduce((s, x) => s + x.amount, 0) : ctx.investableNow;
  const balances = new Map(accounts.map((a) => [a.id, a.currentBalance]));
  const lumpDone = new Set<string>();
  const mRows = ctx.mortgage ? mortgageSchedule(ctx.mortgage, today) : [];
  const fallbackPre = inputs.preReturn;
  const fallbackPost = inputs.postReturn;
  const rm = ctx.reverseMortgageMonthly ?? 0;
  const later = inputs.laterLifeAge ?? 75;
  const earliestAccess = accounts.length ? Math.min(...accounts.map((a) => a.accessibleAge)) : 65;
  const rows: RetirementYearRow[] = [];
  let depletes = false;
  let depletionAge: number | undefined;
  let firstShortfallAge: number | undefined;
  let corpusAtRetire = accessible;
  let lockedAtRetire = accounts.reduce((s, a) => s + a.currentBalance, 0);
  let mortgageFreeAge: number | undefined;
  let paidOffThisPlan = false;

  for (let i = 0; i <= years; i++) {
    const age = inputs.currentAge + i;
    const calendarYear = startYear + i;
    const inf = (1 + inputs.inflation) ** i;
    const retired = age >= inputs.retireAge;
    const mFlow = mortgageFlowForYear(mRows, calendarYear, ctx.mortgage?.outstanding ?? 0);
    if (inputs.payOffMortgageAtRetire && age === inputs.retireAge && !paidOffThisPlan && mFlow.opening > 0) {
      accessible -= mFlow.opening;
      paidOffThisPlan = true;
    }
    const mortgageCleared = paidOffThisPlan || (inputs.payOffMortgageAtRetire && age >= inputs.retireAge);
    const mortgagePayment = mortgageCleared ? 0 : mFlow.payment;
    const mortgagePrincipal = mortgageCleared ? 0 : mFlow.principalPaid;
    const mortgageInterest = mortgageCleared ? 0 : mFlow.interestPaid;
    const closingMortgage = mortgageCleared ? 0 : mFlow.remainingAtEnd;
    if (closingMortgage < 0.5 && mortgageFreeAge === undefined) mortgageFreeAge = age;
    const flags: RetirementYearFlags = {
      isPreRetirement: !retired,
      isEarlyRetirement: retired && age < earliestAccess,
      hasAge65PlusIncome: age >= 65 || (retired && age >= earliestAccess),
      isMortgageFree: closingMortgage < 0.5,
      isLaterLife: age >= later,
    };
    const mul = phaseMultipliers(inputs, flags);
    const openingAccessible = accessible;
    const openingLocked = [...balances.values()].reduce((s, n) => s + n, 0);
    const openingMortgage = mortgageCleared ? 0 : mFlow.opening;

    const rate = retired ? fallbackPost : fallbackPre;
    let investmentReturn = 0;
    if (sleeves.length) {
      for (const s of sleeves) {
        const r = s.annualReturn ?? rate;
        const before = s.amount;
        s.amount = s.amount * (1 + r);
        investmentReturn += s.amount - before;
      }
      accessible = sleeves.reduce((s, x) => s + x.amount, 0);
    } else {
      investmentReturn = accessible * rate;
      accessible = accessible * (1 + rate);
    }

    const accYears: RetirementAccountProjectionYear[] = [];
    let employeeContribution = 0;
    let employerContribution = 0;
    let voluntaryContribution = 0;
    let mpfWithdrawal = 0;
    for (const acc of accounts) {
      const row = projectRetirementAccountYear({
        account: acc,
        openingBalance: balances.get(acc.id) ?? 0,
        age,
        calendarYear,
        yearsSinceStart: i,
        retireAge: inputs.retireAge,
        birthday: inputs.birthday,
        alreadyLumpSum: lumpDone.has(acc.id),
      });
      if (row.notes.includes("lump sum at access")) lumpDone.add(acc.id);
      balances.set(acc.id, row.closingBalance);
      accYears.push(row);
      employeeContribution += row.employeeContribution;
      employerContribution += row.employerContribution;
      voluntaryContribution += row.voluntaryContribution;
      mpfWithdrawal += row.cashFlowAvailableToRetirementPlan;
    }
    const closingLocked = [...balances.values()].reduce((s, n) => s + n, 0);

    let salary = 0;
    let essentialSpend = 0;
    let travelSpend = 0;
    let housingSpend = 0;
    if (!retired) {
      salary = inputs.monthlyIncomeNow * 12 * inf;
      essentialSpend = inputs.monthlySpendNow * 12 * inf * mul.essential;
    } else {
      essentialSpend = inputs.targetMonthly * 12 * inf * mul.essential;
      travelSpend = inputs.travelInRetirement * inf * mul.travel;
      housingSpend = ctx.housingAfterPayoff * 12 * inf * mul.housing;
    }
    const healthcareSpend = retired ? essentialSpend * 0 : 0;
    const discretionarySpend = 0;
    const irregularSpend = 0;
    let annuityIncome = rm * 12;
    for (const a of ctx.allowances ?? []) {
      if (age < a.startAge) continue;
      if (a.endAge && age >= a.endAge) continue;
      annuityIncome += a.monthly * 12 * (a.inflationAdjusted ? inf : 1);
    }
    let oneOff = 0;
    for (const o of ctx.oneOffs) {
      if (o.age === age) oneOff += o.amount;
    }
    let depositInterest = 0;
    for (const d of ctx.deposits ?? []) {
      if ((d.endDate || "").startsWith(String(calendarYear))) depositInterest += d.interest || 0;
    }
    const dividendIncome = 0;
    const inc = salary + annuityIncome + mpfWithdrawal + depositInterest + dividendIncome + oneOff;
    const spend = essentialSpend + travelSpend + housingSpend + healthcareSpend + discretionarySpend + irregularSpend + (retired ? mortgagePayment : 0);
    const net = inc - spend;
    const beforeNet = accessible;
    if (sleeves.length) {
      const total = sleeves.reduce((s, x) => s + Math.max(0, x.amount), 0);
      if (total > 0) {
        for (const s of sleeves) s.amount += net * (Math.max(0, s.amount) / total);
      } else if (sleeves[0]) sleeves[0].amount += net;
      accessible = sleeves.reduce((s, x) => s + x.amount, 0);
    } else {
      accessible += net;
    }
    const portfolioWithdrawal = net < 0 ? Math.min(-net, Math.max(0, beforeNet)) : 0;
    const milestones: string[] = [];
    if (age === inputs.retireAge) milestones.push(`Retirement at age ${age}`);
    if (mFlow.paidOffMonth) milestones.push(`Mortgage paid off in ${mFlow.paidOffMonth}`);
    if (inputs.payOffMortgageAtRetire && age === inputs.retireAge) milestones.push("Pay off mortgage at retirement");
    for (const r of accYears) {
      if (r.isAccessible && r.age === r.age && r.notes.includes("lump sum at access")) {
        milestones.push(`${r.retirementAccountId} accessible`);
      }
    }

    const row: RetirementYearRow = {
      calendarYear,
      age,
      phaseLabel: phaseLabel(flags),
      flags,
      openingAccessible,
      openingLocked,
      openingMortgage,
      salary,
      depositInterest,
      dividendIncome,
      annuityIncome,
      mpfWithdrawal,
      employeeContribution,
      employerContribution,
      voluntaryContribution,
      essentialSpend,
      discretionarySpend,
      irregularSpend,
      healthcareSpend,
      housingSpend,
      travelSpend,
      mortgagePayment: retired ? mortgagePayment : 0,
      mortgagePrincipal: retired ? mortgagePrincipal : 0,
      mortgageInterest: retired ? mortgageInterest : 0,
      portfolioWithdrawal,
      investmentReturn,
      closingAccessible: accessible,
      closingLocked,
      closingMortgage,
      milestones,
      accounts: accYears,
    };
    rows.push(row);
    if (age === inputs.retireAge) {
      corpusAtRetire = accessible - (inputs.emergencyReserve ?? 0);
      lockedAtRetire = closingLocked;
    }
    if (accessible < 0 && !depletes) {
      depletes = true;
      depletionAge = age;
      firstShortfallAge = age;
    }
  }

  const bridgeYears = Math.max(0, earliestAccess - inputs.retireAge);
  const bridgeRows = rows.filter((r) => r.age >= inputs.retireAge && r.age < earliestAccess);
  const minBridgeAccessible = bridgeRows.length ? Math.min(...bridgeRows.map((r) => r.closingAccessible)) : rows.find((r) => r.age === inputs.retireAge)?.closingAccessible ?? accessible;
  const endAccessible = rows[rows.length - 1]?.closingAccessible ?? 0;
  const liquidity = inputs.liquidityFloor ?? 0;
  const buffer = inputs.desiredEndBuffer ?? 0;
  let status: RetirementReadinessStatus = "funded";
  let statusWhy = "Funded under current assumptions.";
  if (inputs.currentAge <= 0 && !inputs.birthday) {
    status = "insufficient_data";
    statusWhy = "Add a birthday or current age to project.";
  } else if (depletes) {
    status = "shortfall_projected";
    statusWhy = `Projected accessible-asset shortfall at age ${firstShortfallAge} before the plan ends. Locked MPF/ORSO is not used to cover this.`;
  } else if (bridgeYears > 0 && minBridgeAccessible < liquidity) {
    status = "bridge_risk";
    statusWhy = `No projected shortfall, but accessible bridge assets fall below your liquidity floor at some point before access age ${earliestAccess}.`;
  } else if (endAccessible < buffer) {
    status = "funded_with_low_buffer";
    statusWhy = "Funded, but end-of-plan accessible assets are below your desired buffer.";
  }

  return {
    years: rows,
    series: rows.map((r) => ({ age: r.age, corpus: r.closingAccessible, accessible: r.closingAccessible, locked: r.closingLocked })),
    depletes,
    depletionAge,
    corpusAtRetire,
    lockedAtRetire,
    extraMonthly: Math.max(0, inputs.monthlyIncomeNow - inputs.monthlySpendNow),
    requiredCorpus: corpusAtRetire,
    minBridgeAccessible,
    bridgeYears,
    firstShortfallAge,
    mortgageFreeAge,
    status,
    statusWhy,
    earliestAccessAge: earliestAccess,
  };
}

export function compareRetirementAges(inputs: RetirementInputs, ctx: RetirementCtx, ages = DEFAULT_RETIREMENT_AGES) {
  return ages.map((retireAge) => {
    const plan = runRetirementPlan({ ...inputs, retireAge }, ctx);
    const workYears = Math.max(0, retireAge - inputs.currentAge);
    return {
      retireAge,
      workYears,
      accessibleAtRetire: plan.corpusAtRetire,
      lockedAtRetire: plan.lockedAtRetire,
      bridgeYears: plan.bridgeYears,
      mortgageFreeAge: plan.mortgageFreeAge,
      firstShortfallAge: plan.firstShortfallAge,
      minBridgeAccessible: plan.minBridgeAccessible,
      endAccessible: plan.years[plan.years.length - 1]?.closingAccessible ?? 0,
      endTotal:
        (plan.years[plan.years.length - 1]?.closingAccessible ?? 0) + (plan.years[plan.years.length - 1]?.closingLocked ?? 0),
      status: plan.status,
      statusWhy: plan.statusWhy,
      plan,
    };
  });
}

export function firePlan(inputs: RetirementInputs, ctx: RetirementCtx) {
  const swr = inputs.fireSwr && inputs.fireSwr > 0 ? inputs.fireSwr : 0.04;
  const annualNeed = inputs.targetMonthly * 12 + (inputs.travelInRetirement || 0);
  const fireNumber = swr > 0 ? annualNeed / swr : 0;
  const current = (ctx.sleeves ?? []).filter((s) => s.kind !== "property" && s.included !== false).reduce((s, x) => s + x.amount, 0) || ctx.investableNow;
  const property = ctx.propertyEquity ?? 0;
  const used = (ctx.sleeves ?? []).filter((s) => s.kind !== "property" && s.included !== false);
  const r = weightedSleeveReturn(used, inputs.preReturn);
  const annualSave = Math.max(0, inputs.monthlyIncomeNow - inputs.monthlySpendNow) * 12;
  let corpus = current;
  let years = 0;
  const cap = Math.max(0, inputs.deathAge - inputs.currentAge);
  while (fireNumber > 0 && corpus < fireNumber && years < cap) {
    corpus = corpus * (1 + r) + annualSave;
    years += 1;
  }
  return {
    swr,
    annualNeed,
    fireNumber,
    current,
    property,
    progress: fireNumber > 0 ? current / fireNumber : 0,
    years,
    fireAge: inputs.currentAge + years,
    reachable: fireNumber <= 0 || corpus >= fireNumber,
  };
}

export function weightedSleeveReturn(sleeves: AssetSleeve[], fallback: number): number {
  const total = sleeves.reduce((s, x) => s + Math.max(0, x.amount), 0);
  if (total <= 0) return fallback;
  return sleeves.reduce((s, x) => s + Math.max(0, x.amount) * (x.annualReturn ?? fallback), 0) / total;
}

export function retirementSleeves(
  accounts: Account[],
  rates: FxRate[],
  fallbackCash: number,
  fallbackInvest: number,
  holdings: Holding[] = [],
): { sleeves: AssetSleeve[]; cash: number; invest: number; property: number } {
  const sleeves: AssetSleeve[] = [];
  let cash = 0;
  let invest = 0;
  let property = 0;
  const covered = new Set<string>();
  const usedHoldings = new Set<string>();

  for (const a of accounts) {
    if (a.hidden || a.currency === "MILES") continue;
    const rows = holdingsForAccount(holdings, a);
    if (!rows.length) continue;
    covered.add(a.id);
    const included = a.retireInclude !== false;
    const annualReturn = typeof a.expectedReturn === "number" ? a.expectedReturn : fallbackInvest;
    let heldHkd = 0;
    for (const h of rows) {
      usedHoldings.add(h.id);
      const amount = toHkd(h.quantity * (h.lastPrice || 0), h.currency, rates);
      heldHkd += amount;
      sleeves.push({
        id: `hold-${h.id}`,
        label: h.name && h.name !== h.symbol ? `${h.name} (${h.symbol})` : h.symbol,
        amount,
        annualReturn,
        kind: "invest",
        included,
      });
      if (included) invest += amount;
    }
    const leftover = toHkd(a.balance, a.currency, rates) - heldHkd;
    if (leftover > 1) {
      sleeves.push({
        id: a.id,
        label: a.nameZh || a.name,
        amount: leftover,
        annualReturn,
        kind: "invest",
        included,
      });
      if (included) invest += leftover;
    }
  }

  for (const h of holdings) {
    if (usedHoldings.has(h.id)) continue;
    const amount = toHkd(h.quantity * (h.lastPrice || 0), h.currency, rates);
    sleeves.push({
      id: `hold-${h.id}`,
      label: h.name && h.name !== h.symbol ? `${h.name} (${h.symbol})` : h.symbol,
      amount,
      annualReturn: fallbackInvest,
      kind: "invest",
      included: true,
    });
    invest += amount;
  }

  for (const a of accounts) {
    if (a.hidden || a.currency === "MILES" || covered.has(a.id)) continue;
    const amount = toHkd(a.balance, a.currency, rates);
    const group = a.group || (a.type === "property" || a.type === "mortgage" ? "housing" : a.type === "investment" || a.type === "mpf" || a.type === "other_asset" ? "assets" : a.type === "credit" || a.type === "loan" ? "credit" : a.type === "miles" ? "loyalty" : "cash");
    if (group === "housing" && a.type !== "mortgage" && a.type !== "loan") {
      property += Math.max(0, amount);
      sleeves.push({
        id: a.id,
        label: a.nameZh || a.name,
        amount: Math.max(0, amount),
        annualReturn: typeof a.expectedReturn === "number" ? a.expectedReturn : 0,
        kind: "property",
        included: a.retireInclude !== false,
      });
      continue;
    }
    if (group === "credit" || group === "loyalty" || a.type === "mortgage" || a.type === "loan") continue;
    const kind: AssetSleeve["kind"] = group === "assets" ? "invest" : "cash";
    const annualReturn = typeof a.expectedReturn === "number" ? a.expectedReturn : kind === "cash" ? fallbackCash : fallbackInvest;
    const included = a.retireInclude !== false;
    if (included) {
      if (kind === "cash") cash += amount;
      else invest += amount;
    }
    sleeves.push({ id: a.id, label: a.nameZh || a.name, amount, annualReturn, kind, included });
  }
  return { sleeves, cash, invest, property };
}

export function reverseMortgageMonthly(propertyEquity: number, ltv: number, years: number): number {
  if (propertyEquity <= 0 || ltv <= 0 || years <= 0) return 0;
  return (propertyEquity * ltv) / (years * 12);
}

export function ageFromBirthday(birthday: string, today: string): number {
  const [y, m, d] = birthday.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!y || !m || !ty) return 0;
  let age = ty - y;
  if (tm < m || (tm === m && td < (d || 1))) age -= 1;
  return Math.max(0, Math.min(120, age));
}

export function sustainableMonthly(inputs: RetirementInputs, ctx: RetirementCtx): number {
  let lo = 0;
  let hi = Math.max(inputs.targetMonthly * 2, 10_000);
  for (let i = 0; i < 14; i++) {
    const trial = runRetirement({ ...inputs, targetMonthly: hi }, ctx);
    const last = trial.series[trial.series.length - 1]?.corpus ?? 0;
    if (last < 0 || trial.depletes) break;
    hi *= 2;
    if (hi > 5_000_000) break;
  }
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    const trial = runRetirement({ ...inputs, targetMonthly: mid }, ctx);
    const last = trial.series[trial.series.length - 1]?.corpus ?? 0;
    if (!trial.depletes && last >= 0) lo = mid;
    else hi = mid;
  }
  return Math.max(0, lo);
}

export function retirementStatus(
  depletes: boolean,
  sustainable: number,
  target: number,
  series: { corpus: number }[],
): "on-track" | "watch" | "at-risk" {
  if (depletes) return "at-risk";
  if (target > 0 && sustainable < 0.95 * target) return "watch";
  const last = series[series.length - 1]?.corpus ?? 0;
  const peak = series.reduce((m, s) => Math.max(m, s.corpus), 0);
  if (peak > 0 && last < 0.08 * peak) return "watch";
  return "on-track";
}
