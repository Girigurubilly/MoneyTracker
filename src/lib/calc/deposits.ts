import type { Category, Currency, FxRate, TimeSaving, Transaction, YearlyPlan } from "../types.ts";
import { toHkd } from "./fx.ts";
import { cashflowSide, roundMoney } from "./ledger.ts";

export const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTHS_ZH = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"] as const;

export const MONTHS_S = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function yearMonthKey(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

export function depositDayCount(startDate: string, endDate: string): number {
  const a = Date.parse(startDate);
  const b = Date.parse(endDate);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function suggestedInterest(amount: number, ratePct: number, startDate: string, endDate: string): number {
  const days = depositDayCount(startDate, endDate);
  if (!days || !amount || !ratePct) return 0;
  return roundMoney(amount * (ratePct / 100) * (days / 365));
}

export type DepositSummary = {
  depHKD: number;
  intHKD: number;
  realizedHKD: number;
  unrealizedThisYearHKD: number;
  unrealizedAfterYearHKD: number;
};

export function summarizeDeposits(list: TimeSaving[], today: string, rates: FxRate[]): DepositSummary {
  const year = today.slice(0, 4);
  let depHKD = 0;
  let intHKD = 0;
  let realizedHKD = 0;
  let unrealizedThisYearHKD = 0;
  let unrealizedAfterYearHKD = 0;
  for (const r of list) {
    const amt = toHkd(r.amount || 0, r.currency, rates);
    const interest = toHkd(r.interest || 0, r.currency, rates);
    const realized = !!r.endDate && r.endDate <= today;
    intHKD += interest;
    if (!realized) depHKD += amt;
    if (realized) realizedHKD += interest;
    else if ((r.endDate || "").slice(0, 4) === year) unrealizedThisYearHKD += interest;
    else unrealizedAfterYearHKD += interest;
  }
  return { depHKD, intHKD, realizedHKD, unrealizedThisYearHKD, unrealizedAfterYearHKD };
}

export function getMonthlyDepositInterest(list: TimeSaving[], year: number, month0: number, rates: FxRate[]): number {
  const key = yearMonthKey(year, month0);
  let total = 0;
  for (const ts of list) {
    if (!ts.endDate || !ts.endDate.startsWith(key)) continue;
    total += toHkd(ts.interest || 0, ts.currency, rates);
  }
  return total;
}

export function emptyYearlyPlan(id: string): YearlyPlan {
  return { id, salary: 0, other: 0, expense: 0 };
}

export function getYearlyPlan(plans: YearlyPlan[], year: number, month0: number): YearlyPlan {
  const id = yearMonthKey(year, month0);
  return plans.find((p) => p.id === id) ?? emptyYearlyPlan(id);
}

export function isSalaryCategory(cat: Category | undefined): boolean {
  if (!cat) return false;
  if (cat.id === "salary") return true;
  return /薪金|薪水|工資|工资|salary|payroll/i.test(`${cat.name} ${cat.nameZh}`);
}

export function isDepositInterestIncome(tx: Transaction, cat: Category | undefined): boolean {
  if (tx.type !== "income") return false;
  if (tx.depositId) return true;
  if (tx.categoryId === "interest-inc") return true;
  if (!cat) return false;
  return /利息收入|存款利息|定期利息|deposit interest|interest income|\binterest\b/i.test(`${cat.name} ${cat.nameZh}`);
}

export type MonthActuals = { salary: number; other: number; expense: number; interest: number };

export function monthActualsFromTxs(
  txs: Transaction[],
  categories: Category[],
  rates: FxRate[],
  year: number,
): Map<string, MonthActuals> {
  const map = new Map<string, MonthActuals>();
  const prefix = String(year);
  for (const tx of txs) {
    if (tx.planned) continue;
    if (!tx.date.startsWith(prefix)) continue;
    const side = cashflowSide(tx);
    if (side === "none") continue;
    const key = tx.date.slice(0, 7);
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    let row = map.get(key);
    if (!row) {
      row = { salary: 0, other: 0, expense: 0, interest: 0 };
      map.set(key, row);
    }
    if (side === "expense") {
      row.expense += hkd;
      continue;
    }
    const cat = categories.find((c) => c.id === tx.categoryId);
    if (isDepositInterestIncome(tx, cat)) {
      row.interest += hkd;
      continue;
    }
    if (isSalaryCategory(cat)) row.salary += hkd;
    else row.other += hkd;
  }
  return map;
}

export type YearlyMonthRow = {
  month0: number;
  id: string;
  salary: number;
  other: number;
  expense: number;
  depInt: number;
  income: number;
  saving: number;
  isCurrent: boolean;
  fromLedger: boolean;
};

export function yearlyProjection(
  plans: YearlyPlan[],
  deposits: TimeSaving[],
  rates: FxRate[],
  year: number,
  month0Now: number,
  txs: Transaction[] = [],
  categories: Category[] = [],
): {
  rows: YearlyMonthRow[];
  yearIncome: number;
  yearExpense: number;
  yearSaving: number;
  asOfIncome: number;
  asOfExpense: number;
  asOfSaving: number;
} {
  const actuals = monthActualsFromTxs(txs, categories, rates, year);
  let yearIncome = 0;
  let yearExpense = 0;
  let yearSaving = 0;
  let asOfIncome = 0;
  let asOfExpense = 0;
  let asOfSaving = 0;
  const rows = Array.from({ length: 12 }, (_, month0) => {
    const plan = getYearlyPlan(plans, year, month0);
    const fromLedger = month0 < month0Now;
    const actual = actuals.get(plan.id);
    const salary = fromLedger ? (actual?.salary ?? 0) : plan.salary || 0;
    const other = fromLedger ? (actual?.other ?? 0) : plan.other || 0;
    const expense = fromLedger ? (actual?.expense ?? 0) : plan.expense || 0;
    const depInt = fromLedger
      ? (actual?.interest ?? 0)
      : getMonthlyDepositInterest(deposits, year, month0, rates);
    const income = salary + other + depInt;
    const saving = income - expense;
    yearIncome += income;
    yearExpense += expense;
    yearSaving += saving;
    if (month0 <= month0Now) {
      asOfIncome += income;
      asOfExpense += expense;
      asOfSaving += saving;
    }
    return {
      month0,
      id: plan.id,
      salary,
      other,
      expense,
      depInt,
      income,
      saving,
      isCurrent: month0 === month0Now,
      fromLedger,
    };
  });
  return { rows, yearIncome, yearExpense, yearSaving, asOfIncome, asOfExpense, asOfSaving };
}

export function isFiatCurrency(value: string): value is Currency {
  return (
    value === "HKD" ||
    value === "USD" ||
    value === "JPY" ||
    value === "CNY" ||
    value === "TWD" ||
    value === "THB" ||
    value === "GBP" ||
    value === "EUR" ||
    value === "AUD" ||
    value === "SGD" ||
    value === "CHF" ||
    value === "MOP" ||
    value === "KRW" ||
    value === "CAD" ||
    value === "NZD" ||
    value === "INR"
  );
}
