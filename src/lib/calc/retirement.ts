import { roundMoney } from "./ledger";
import { monthFlow } from "./budget";
import type { Allowance, FxRate, OneOff, Transaction } from "@/lib/types";

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
  extraHealth?: number;
};

export type RetirementContext = {
  investableNow: number;
  mortgageMonthly: number;
  mortgagePayoffAge: number;
  housingAfterPayoff: number;
  allowances: Allowance[];
  oneOffs: OneOff[];
  /** If set, used as pre-retirement monthly saving instead of income − spend. */
  monthlySaving?: number;
};

export type YearPoint = { age: number; assets: number; phase: "pre" | "post" };

export type RetirementResult = {
  series: YearPoint[];
  corpusAtRetire: number;
  requiredCorpus: number;
  gap: number;
  sustainableMonthly: number;
  extraMonthlySaving: number;
  depletes: boolean;
  depletionAge?: number;
  lasts: boolean;
  status: "on-track" | "watch" | "at-risk";
  invalid?: string;
};

function realRate(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

function oneOffAt(age: number, items: OneOff[]): number {
  return items
    .filter((o) => o.age === age)
    .reduce((s, o) => s + (o.direction === "in" ? o.amount : -o.amount), 0);
}

function allowanceAt(age: number, items: Allowance[]): number {
  return items
    .filter((a) => age >= a.startAge)
    .reduce((s, a) => s + a.monthly * 12, 0);
}

export function projectPath(
  inputs: RetirementInputs,
  ctx: RetirementContext,
  spendMonthly = inputs.targetMonthly,
): { series: YearPoint[]; corpusAtRetire: number; depletes: boolean; depletionAge?: number } {
  const pre = realRate(inputs.preReturn, inputs.inflation);
  const post = realRate(inputs.postReturn, inputs.inflation);
  let assets = ctx.investableNow;
  const series: YearPoint[] = [{ age: inputs.currentAge, assets, phase: "pre" }];
  let corpusAtRetire = assets;
  let depletes = false;
  let depletionAge: number | undefined;

  for (let age = inputs.currentAge; age < inputs.deathAge; age++) {
    const retiring = age >= inputs.retireAge;
    if (age === inputs.retireAge) corpusAtRetire = assets;
    const r = retiring ? post : pre;
    assets *= 1 + r;
    if (!retiring) {
      const assumed = inputs.monthlyIncomeNow * 12 - inputs.monthlySpendNow * 12;
      const saving = ctx.monthlySaving != null ? ctx.monthlySaving * 12 : assumed;
      assets += saving;
    } else {
      assets -= spendMonthly * 12;
      assets -= inputs.travelInRetirement;
      assets -= inputs.extraHealth ?? 0;
      assets += allowanceAt(age, ctx.allowances);
    }
    assets += oneOffAt(age + 1, ctx.oneOffs);
    if (assets < 0 && !depletes) {
      depletes = true;
      depletionAge = age + 1;
      assets = 0;
    }
    series.push({
      age: age + 1,
      assets: roundMoney(assets, 0),
      phase: age + 1 >= inputs.retireAge ? "post" : "pre",
    });
  }
  if (inputs.retireAge >= inputs.deathAge) corpusAtRetire = assets;
  return { series, corpusAtRetire: roundMoney(corpusAtRetire, 0), depletes, depletionAge };
}

export function requiredCorpus(inputs: RetirementInputs, ctx: RetirementContext): number {
  const years = Math.max(1, inputs.deathAge - inputs.retireAge);
  const post = realRate(inputs.postReturn, inputs.inflation);
  let need = 0;
  for (let i = years; i >= 1; i--) {
    const age = inputs.retireAge + i - 1;
    const spend =
      inputs.targetMonthly * 12 +
      inputs.travelInRetirement +
      (inputs.extraHealth ?? 0) -
      allowanceAt(age, ctx.allowances) -
      oneOffAt(age, ctx.oneOffs);
    need = (need + spend) / (1 + post);
  }
  return roundMoney(Math.max(0, need), 0);
}

export function sustainableMonthly(inputs: RetirementInputs, ctx: RetirementContext): number {
  let lo = 0;
  let hi = Math.max(inputs.targetMonthly * 3, 5000);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const path = projectPath(inputs, ctx, mid);
    if (path.depletes) hi = mid;
    else lo = mid;
  }
  return roundMoney(lo, 0);
}

export function extraMonthlySaving(
  gap: number,
  yearsToRetire: number,
  preReturn: number,
  inflation: number,
): number {
  if (gap >= 0) return 0;
  const need = -gap;
  const n = Math.max(1, yearsToRetire) * 12;
  const r = realRate(preReturn, inflation) / 12;
  if (Math.abs(r) < 1e-8) return roundMoney(need / n);
  const pmt = (need * r) / ((1 + r) ** n - 1);
  return roundMoney(pmt);
}

export function runRetirement(inputs: RetirementInputs, ctx: RetirementContext): RetirementResult {
  if (inputs.retireAge <= inputs.currentAge) {
    return emptyResult("Retirement age must be after current age.");
  }
  if (inputs.deathAge <= inputs.retireAge) {
    return emptyResult("Expected lifespan must be after retirement age.");
  }
  const path = projectPath(inputs, ctx);
  const required = requiredCorpus(inputs, ctx);
  const gap = roundMoney(path.corpusAtRetire - required, 0);
  const sustainable = sustainableMonthly(inputs, ctx);
  const extra = extraMonthlySaving(
    gap,
    inputs.retireAge - inputs.currentAge,
    inputs.preReturn,
    inputs.inflation,
  );
  const ratio = required > 0 ? path.corpusAtRetire / required : 1;
  const status: RetirementResult["status"] =
    path.depletes || ratio < 0.9 ? "at-risk" : ratio < 1.05 ? "watch" : "on-track";
  return {
    series: path.series,
    corpusAtRetire: path.corpusAtRetire,
    requiredCorpus: required,
    gap,
    sustainableMonthly: sustainable,
    extraMonthlySaving: extra,
    depletes: path.depletes,
    depletionAge: path.depletionAge,
    lasts: !path.depletes,
    status,
  };
}

function emptyResult(invalid: string): RetirementResult {
  return {
    series: [],
    corpusAtRetire: 0,
    requiredCorpus: 0,
    gap: 0,
    sustainableMonthly: 0,
    extraMonthlySaving: 0,
    depletes: true,
    lasts: false,
    status: "at-risk",
    invalid,
  };
}

/** Average monthly saving (income − expense) over the last 12 calendar months including `asOfIso`. */
export function savingsLast12Months(
  txs: Transaction[],
  rates: FxRate[],
  asOfIso: string,
): { income: number; expense: number; net: number; monthly: number; months: number } {
  const [y, m] = asOfIso.slice(0, 7).split("-").map(Number);
  let income = 0;
  let expense = 0;
  for (let i = 11; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const flow = monthFlow(txs, key, rates);
    income += flow.income;
    expense += flow.expense;
  }
  const net = income - expense;
  return { income, expense, net, monthly: net / 12, months: 12 };
}
