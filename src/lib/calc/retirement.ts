import type { Allowance, OneOff, Transaction, FxRate } from "../types";
import { cashflowSide, inMonth } from "./ledger";
import { toHkd } from "./fx";

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

export function savingsLast12Months(txs: Transaction[], rates: FxRate[], asOfMonth: string): {
  income: number;
  expense: number;
  monthlyIncome: number;
  monthlySpend: number;
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
  return { income, expense, monthlyIncome: income / 12, monthlySpend: expense / 12 };
}

export function runRetirement(
  inputs: RetirementInputs,
  ctx: {
    investableNow: number;
    mortgageMonthly: number;
    mortgagePayoffAge: number;
    housingAfterPayoff: number;
    oneOffs: OneOff[];
    allowances?: Allowance[];
  },
) {
  const years = Math.max(1, inputs.deathAge - inputs.currentAge);
  const preYears = Math.max(0, inputs.retireAge - inputs.currentAge);
  let corpus = ctx.investableNow;
  const series: { age: number; corpus: number }[] = [];
  let depletes = false;
  let extraMonthly = 0;

  function yearSpend(age: number, yearsFromNow: number) {
    const inf = (1 + inputs.inflation) ** yearsFromNow;
    let spend = inputs.targetMonthly * 12 * inf;
    spend += inputs.travelInRetirement * inf;
    if (age < ctx.mortgagePayoffAge) spend += ctx.mortgageMonthly * 12;
    else spend += ctx.housingAfterPayoff * 12;
    return spend;
  }

  function yearIncome(age: number, yearsFromNow: number) {
    const inf = (1 + inputs.inflation) ** yearsFromNow;
    let inc = 0;
    if (age < inputs.retireAge) inc += inputs.monthlyIncomeNow * 12 * inf;
    for (const a of ctx.allowances ?? []) {
      if (age < a.startAge) continue;
      if (a.endAge && age >= a.endAge) continue;
      inc += a.monthly * 12 * (a.inflationAdjusted ? inf : 1);
    }
    for (const o of ctx.oneOffs) {
      if (o.age === age) inc += o.amount;
    }
    return inc;
  }

  for (let i = 0; i <= years; i++) {
    const age = inputs.currentAge + i;
    const ret = age >= inputs.retireAge;
    const r = ret ? inputs.postReturn : inputs.preReturn;
    const spend = yearSpend(age, i);
    const inc = yearIncome(age, i);
    corpus = corpus * (1 + r) + inc - spend;
    if (age < inputs.retireAge) {
      const save = Math.max(0, inputs.monthlyIncomeNow * 12 - inputs.monthlySpendNow * 12);
      extraMonthly = save / 12;
    }
    series.push({ age, corpus });
    if (corpus < 0) depletes = true;
  }

  const requiredCorpus = series.find((s) => s.age === inputs.retireAge)?.corpus ?? corpus;
  return {
    series,
    depletes,
    corpusAtRetire: requiredCorpus,
    extraMonthly,
    requiredCorpus,
  };
}
