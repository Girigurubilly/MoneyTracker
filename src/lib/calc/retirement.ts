import type { Allowance, OneOff, Transaction, FxRate } from "../types.ts";
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
};

export type RetirementCtx = {
  investableNow: number;
  mortgageMonthly: number;
  mortgagePayoffAge: number;
  housingAfterPayoff: number;
  oneOffs: OneOff[];
  allowances?: Allowance[];
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
  let corpus = ctx.investableNow;
  const series: { age: number; corpus: number }[] = [];
  let depletes = false;
  let depletionAge: number | undefined;
  let corpusAtRetire = corpus;

  for (let i = 0; i <= years; i++) {
    const age = inputs.currentAge + i;
    const inf = (1 + inputs.inflation) ** i;
    const retired = age >= inputs.retireAge;
    const r = retired ? inputs.postReturn : inputs.preReturn;
    corpus = corpus * (1 + r);

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
    }
    for (const a of ctx.allowances ?? []) {
      if (age < a.startAge) continue;
      if (a.endAge && age >= a.endAge) continue;
      inc += a.monthly * 12 * (a.inflationAdjusted ? inf : 1);
    }
    for (const o of ctx.oneOffs) {
      if (o.age === age) inc += o.amount;
    }
    corpus += inc - spend;
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
