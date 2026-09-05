import type { Account, Allowance, OneOff, Transaction, FxRate } from "../types.ts";
import { cashflowSide, inMonth } from "./ledger.ts";
import { toHkd } from "./fx.ts";

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
};

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
  const years = Math.max(1, inputs.deathAge - inputs.currentAge);
  const sleeves = (ctx.sleeves ?? []).filter((s) => s.kind !== "property" && s.included !== false).map((s) => ({ ...s }));
  let corpus = sleeves.length ? sleeves.reduce((s, x) => s + x.amount, 0) : ctx.investableNow;
  const series: { age: number; corpus: number }[] = [];
  let depletes = false;
  let depletionAge: number | undefined;
  let corpusAtRetire = corpus;
  const fallbackPre = inputs.preReturn;
  const fallbackPost = inputs.postReturn;
  const rm = ctx.reverseMortgageMonthly ?? 0;

  for (let i = 0; i <= years; i++) {
    const age = inputs.currentAge + i;
    const inf = (1 + inputs.inflation) ** i;
    const retired = age >= inputs.retireAge;

    if (sleeves.length) {
      for (const s of sleeves) {
        const r = s.annualReturn ?? (retired ? fallbackPost : fallbackPre);
        s.amount = s.amount * (1 + r);
      }
      corpus = sleeves.reduce((s, x) => s + x.amount, 0);
    } else {
      corpus = corpus * (1 + (retired ? fallbackPost : fallbackPre));
    }

    let inc = 0;
    let spend = 0;
    if (!retired) {
      inc += inputs.monthlyIncomeNow * 12 * inf;
      spend += inputs.monthlySpendNow * 12 * inf;
    } else {
      spend += inputs.targetMonthly * 12 * inf;
      spend += inputs.travelInRetirement * inf;
      if (age < ctx.mortgagePayoffAge) spend += ctx.mortgageMonthly * 12;
      else spend += ctx.housingAfterPayoff * 12;
      inc += rm * 12;
    }
    for (const a of ctx.allowances ?? []) {
      if (age < a.startAge) continue;
      if (a.endAge && age >= a.endAge) continue;
      inc += a.monthly * 12 * (a.inflationAdjusted ? inf : 1);
    }
    for (const o of ctx.oneOffs) {
      if (o.age === age) inc += o.amount;
    }
    const net = inc - spend;
    if (sleeves.length) {
      const total = sleeves.reduce((s, x) => s + Math.max(0, x.amount), 0);
      if (total > 0) {
        for (const s of sleeves) s.amount += net * (Math.max(0, s.amount) / total);
      } else if (sleeves[0]) {
        sleeves[0].amount += net;
      }
      corpus = sleeves.reduce((s, x) => s + x.amount, 0);
    } else {
      corpus += net;
    }
    if (age === inputs.retireAge) corpusAtRetire = corpus;
    series.push({ age, corpus });
    if (corpus < 0 && !depletes) {
      depletes = true;
      depletionAge = age;
    }
  }

  const extraMonthly = Math.max(0, inputs.monthlyIncomeNow - inputs.monthlySpendNow);
  return {
    series,
    depletes,
    corpusAtRetire,
    extraMonthly,
    requiredCorpus: corpusAtRetire,
    depletionAge,
  };
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
): { sleeves: AssetSleeve[]; cash: number; invest: number; property: number } {
  const sleeves: AssetSleeve[] = [];
  let cash = 0;
  let invest = 0;
  let property = 0;
  for (const a of accounts) {
    if (a.hidden || a.currency === "MILES") continue;
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
