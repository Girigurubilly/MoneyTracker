import type { Account, AdhocBudget, Category, Currency, FxRate, PromoSaving, Recurring, TimeSaving, Transaction, YearlyPlan } from "../types.ts";
import { toHkd } from "./fx.ts";
import { cashflowSide, roundMoney } from "./ledger.ts";
import { hkdOfRegular, monthlyIncomeRegulars, regularChargedBy } from "./budget.ts";
import { marathonMonthlyInterest } from "./marathon.ts";

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

/** Active time deposits whose principal is not already inside the linked account balance. */
export function depositsOutsideBalances(deposits: TimeSaving[], accounts: Account[], rates: FxRate[], today: string): TimeSaving[] {
  const active = deposits.filter((d) => d.amount > 0 && (!d.endDate || d.endDate >= today));
  const cover = new Map<string, number>();
  for (const a of accounts) {
    if (a.hidden || a.currency === "MILES") continue;
    cover.set(a.id, (cover.get(a.id) ?? 0) + Math.max(0, toHkd(a.balance, a.currency, rates)));
  }
  const extra: TimeSaving[] = [];
  const sorted = [...active].sort((a, b) => toHkd(a.amount, a.currency, rates) - toHkd(b.amount, b.currency, rates));
  for (const d of sorted) {
    const hkd = Math.max(0, toHkd(d.amount, d.currency, rates));
    const left = d.accountId ? cover.get(d.accountId) : undefined;
    if (left != null && left + 0.5 >= hkd) cover.set(d.accountId, left - hkd);
    else extra.push(d);
  }
  return extra;
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

export function depositYearTotals(rows: TimeSaving[], rates: FxRate[]): { principal: number; interest: number; currency: Currency } {
  const currency = rows[0]?.currency ?? "HKD";
  if (rows.length && rows.every((r) => r.currency === currency)) {
    return {
      principal: rows.reduce((s, r) => s + (r.amount || 0), 0),
      interest: rows.reduce((s, r) => s + (r.interest || 0), 0),
      currency,
    };
  }
  return {
    principal: rows.reduce((s, r) => s + toHkd(r.amount || 0, r.currency, rates), 0),
    interest: rows.reduce((s, r) => s + toHkd(r.interest || 0, r.currency, rates), 0),
    currency: "HKD",
  };
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

/** Marathon interest paid on the 1st of `payMonth`, in HKD. Adjustments replace the estimate. */
export function promoInterestInMonth(promos: PromoSaving[], payMonth: string, rates: FxRate[]): number {
  let total = 0;
  for (const promo of promos) {
    if (!(promo.residualHkd > 0)) continue;
    const adjustments = new Map((promo.interestAdjustments ?? []).map((item) => [item.month, item.amount]));
    for (const month of marathonMonthlyInterest(promo.residualHkd, promo.rateSchedule)) {
      if (!month.date.startsWith(payMonth)) continue;
      const amount = adjustments.has(month.month) ? Number(adjustments.get(month.month)) : month.interest;
      if (amount > 0) total += toHkd(amount, promo.currency ?? "HKD", rates);
    }
  }
  return Math.round(total * 100) / 100;
}

function promoInterestAlreadyPosted(promo: PromoSaving, accrualMonth: string, txs: Transaction[], payMonth: string): boolean {
  return txs.some(
    (tx) =>
      !tx.planned &&
      tx.type === "income" &&
      tx.date.startsWith(payMonth) &&
      (tx.depositId === `${promo.id}:${accrualMonth}` || tx.promoId === promo.id),
  );
}

/** Add marathon interest that is not already inside posted 利息 for this month. */
export function promoInterestExtra(
  promos: PromoSaving[],
  txs: Transaction[],
  rates: FxRate[],
  payMonth: string,
): number {
  let total = 0;
  for (const promo of promos) {
    if (!(promo.residualHkd > 0)) continue;
    const adjustments = new Map((promo.interestAdjustments ?? []).map((item) => [item.month, item.amount]));
    for (const month of marathonMonthlyInterest(promo.residualHkd, promo.rateSchedule)) {
      if (!month.date.startsWith(payMonth)) continue;
      if (promoInterestAlreadyPosted(promo, month.month, txs, payMonth)) continue;
      const amount = adjustments.has(month.month) ? Number(adjustments.get(month.month)) : month.interest;
      if (amount > 0) total += toHkd(amount, promo.currency ?? "HKD", rates);
    }
  }
  return Math.round(total * 100) / 100;
}

export function emptyYearlyPlan(id: string): YearlyPlan {
  return { id, salary: 0, other: 0, expense: 0 };
}

export function getYearlyPlan(plans: YearlyPlan[], year: number, month0: number): YearlyPlan {
  const id = yearMonthKey(year, month0);
  return plans.find((p) => p.id === id) ?? emptyYearlyPlan(id);
}

/** Current-month yearly expected expense and Budget month cap share one number. Cap wins when set. */
export function linkedMonthSpendCap(budgetMonthly: number, planExpense: number): number {
  return budgetMonthly > 0 ? budgetMonthly : planExpense || 0;
}

export function isSalaryCategory(cat: Category | undefined): boolean {
  if (!cat) return false;
  if (cat.id === "salary") return true;
  return /薪金|薪水|工資|工资|salary|payroll/i.test(`${cat.name} ${cat.nameZh}`);
}

function incomeHaystack(tx: Transaction, cat: Category | undefined, categories: Category[]): string {
  const parent = cat?.parentId ? categories.find((c) => c.id === cat.parentId) : undefined;
  return [tx.categoryId, tx.payee, tx.payeeZh, cat?.id, cat?.name, cat?.nameZh, parent?.name, parent?.nameZh]
    .filter(Boolean)
    .join(" ");
}

export function isDepositInterestIncome(tx: Transaction, cat: Category | undefined, categories: Category[] = []): boolean {
  if (tx.type !== "income") return false;
  if (tx.depositId) return true;
  if (tx.categoryId === "interest-inc") return true;
  const hay = incomeHaystack(tx, cat, categories);
  if (/按揭|mortgage/i.test(hay)) return false;
  return /利息|interest income|deposit interest|\binterest\b/i.test(hay);
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
    const cat =
      categories.find((c) => c.id === tx.categoryId) ??
      categories.find((c) => c.name === tx.categoryId || c.nameZh === tx.categoryId);
    if (isDepositInterestIncome(tx, cat, categories)) {
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
  incomeLocked: boolean;
  otherLocked: boolean;
};

function regularIsSalary(r: Recurring, cat: Category | undefined): boolean {
  if (isSalaryCategory(cat)) return true;
  return /薪金|薪水|工資|工资|salary|payroll/i.test(`${r.label} ${r.labelZh}`);
}

function regularIsDepositInterest(r: Recurring, categories: Category[]): boolean {
  const cat = categories.find((c) => c.id === r.categoryId);
  const tx: Transaction = {
    id: r.id,
    type: "income",
    amount: r.amount,
    currency: r.currency === "MILES" ? "HKD" : r.currency,
    accountId: r.accountId,
    categoryId: r.categoryId,
    date: r.nextDate || "1970-01-01",
    payee: r.label,
    payeeZh: r.labelZh,
  };
  return isDepositInterestIncome(tx, cat, categories);
}

/** This month: posted 利息收入, plus time-deposit interest not already in those transactions. */
export function currentMonthDepositInterest(
  deposits: TimeSaving[],
  txs: Transaction[],
  categories: Category[],
  rates: FxRate[],
  month: string,
  postedInterest: number,
): number {
  let extra = 0;
  for (const d of deposits) {
    if (!d.endDate?.startsWith(month)) continue;
    if (depositAlreadyPosted(d, txs, categories, rates, month)) continue;
    extra += toHkd(d.interest || 0, d.currency, rates);
  }
  return postedInterest + extra;
}

function depositAlreadyPosted(
  d: TimeSaving,
  txs: Transaction[],
  categories: Category[],
  rates: FxRate[],
  month: string,
): boolean {
  const interestHkd = toHkd(d.interest || 0, d.currency, rates);
  for (const tx of txs) {
    if (tx.planned || tx.type !== "income" || !tx.date.startsWith(month)) continue;
    if (tx.depositId === d.id) return true;
    const cat =
      categories.find((c) => c.id === tx.categoryId) ??
      categories.find((c) => c.name === tx.categoryId || c.nameZh === tx.categoryId);
    if (!isDepositInterestIncome(tx, cat, categories)) continue;
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    const sameAmount = Math.abs(hkd - interestHkd) < 0.05;
    const hay = `${tx.payee} ${tx.payeeZh}`;
    const sameBank = Boolean(d.bank) && hay.includes(d.bank);
    if (sameAmount && (tx.date === d.endDate || sameBank)) return true;
  }
  return false;
}

export function upcomingIncomeSplit(
  recurring: Recurring[],
  txs: Transaction[],
  categories: Category[],
  rates: FxRate[],
  month: string,
  today: string,
): { salary: number; other: number } {
  if (!today.startsWith(month)) return { salary: 0, other: 0 };
  const posted = new Set(
    txs.filter((t) => !t.planned && t.recurringId && t.date.startsWith(month)).map((t) => t.recurringId as string),
  );
  let salary = 0;
  let other = 0;
  for (const r of monthlyIncomeRegulars(recurring)) {
    if (posted.has(r.id)) continue;
    if (regularChargedBy(r, today)) continue;
    if (regularIsDepositInterest(r, categories)) continue;
    const hkd = hkdOfRegular(r, rates);
    const cat = categories.find((c) => c.id === r.categoryId);
    if (regularIsSalary(r, cat)) salary += hkd;
    else other += hkd;
  }
  return { salary, other };
}

/** Future / planned months: other income from monthly regulars + planned income txs (not salary, not TD interest). */
export function plannedMonthOtherIncome(
  recurring: Recurring[],
  txs: Transaction[],
  categories: Category[],
  rates: FxRate[],
  year: number,
  month0: number,
): number {
  const month = yearMonthKey(year, month0);
  let other = 0;
  for (const r of monthlyIncomeRegulars(recurring)) {
    if (regularIsDepositInterest(r, categories)) continue;
    const cat = categories.find((c) => c.id === r.categoryId);
    if (regularIsSalary(r, cat)) continue;
    other += hkdOfRegular(r, rates);
  }
  for (const tx of txs) {
    if (!tx.planned || tx.type !== "income" || !tx.date.startsWith(month)) continue;
    const cat =
      categories.find((c) => c.id === tx.categoryId) ??
      categories.find((c) => c.name === tx.categoryId || c.nameZh === tx.categoryId);
    if (isSalaryCategory(cat)) continue;
    if (isDepositInterestIncome(tx, cat, categories)) continue;
    other += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
  }
  return other;
}


/** Future months: expense regulars + planned expense txs (adhoc reserved when no yearly cap). */
export function plannedMonthExpense(
  recurring: Recurring[],
  txs: Transaction[],
  rates: FxRate[],
  year: number,
  month0: number,
  adhoc: AdhocBudget[] = [],
  planExpense = 0,
): number {
  const month = yearMonthKey(year, month0);
  let total = 0;
  for (const r of recurring) {
    if (r.type !== "expense" || r.frequency !== "monthly") continue;
    // Full future month: count every monthly expense regular (same as income regulars).
    total += hkdOfRegular(r, rates);
  }
  for (const tx of txs) {
    if (!tx.planned || tx.type !== "expense" || !tx.date.startsWith(month)) continue;
    total += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
  }
  if (!(planExpense > 0)) {
    for (const a of adhoc) {
      if (a.month !== month) continue;
      const rem = Math.max(0, (a.amount || 0) - (a.spent || 0));
      total += rem;
    }
  }
  return Math.round(total * 100) / 100;
}

export function yearlyProjection(
  plans: YearlyPlan[],
  deposits: TimeSaving[],
  rates: FxRate[],
  year: number,
  month0Now: number,
  txs: Transaction[] = [],
  categories: Category[] = [],
  currentMonthCap = 0,
  recurring: Recurring[] = [],
  today = "",
  promos: PromoSaving[] = [],
  adhoc: AdhocBudget[] = [],
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
    const isCurrent = month0 === month0Now;
    const useActivity = fromLedger || (isCurrent && today.startsWith(plan.id));
    const actual = actuals.get(plan.id);
    const upcoming = useActivity && isCurrent ? upcomingIncomeSplit(recurring, txs, categories, rates, plan.id, today) : { salary: 0, other: 0 };
    const salary = useActivity ? (actual?.salary ?? 0) + upcoming.salary : plan.salary || 0;
    const other = useActivity
      ? (actual?.other ?? 0) + upcoming.other
      : plannedMonthOtherIncome(recurring, txs, categories, rates, year, month0);
    const planCap = plan.expense || 0;
    const regularAndPlanned = plannedMonthExpense(recurring, txs, rates, year, month0, adhoc, planCap);
    const plannedExpense =
      month0 === month0Now
        ? linkedMonthSpendCap(currentMonthCap, planCap)
        : planCap > 0
          ? Math.max(planCap, regularAndPlanned)
          : regularAndPlanned;
    const expense = fromLedger
      ? (actual?.expense ?? 0)
      : isCurrent && today.startsWith(plan.id)
        ? Math.max(actual?.expense ?? 0, plannedExpense)
        : plannedExpense;
    const depInt = fromLedger
      ? (actual?.interest ?? 0)
      : isCurrent && today.startsWith(plan.id)
        ? currentMonthDepositInterest(deposits, txs, categories, rates, plan.id, actual?.interest ?? 0) +
          promoInterestExtra(promos, txs, rates, plan.id)
        : getMonthlyDepositInterest(deposits, year, month0, rates) + promoInterestInMonth(promos, plan.id, rates);
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
      isCurrent,
      fromLedger,
      incomeLocked: useActivity,
      otherLocked: true,
    };
  });
  return { rows, yearIncome, yearExpense, yearSaving, asOfIncome, asOfExpense, asOfSaving };
}


/** Full-year projection vs last calendar year posted totals (for 今年對去年 projected tab). */
export function yearProjectionCompare(
  plans: YearlyPlan[],
  deposits: TimeSaving[],
  rates: FxRate[],
  txs: Transaction[],
  categories: Category[],
  recurring: Recurring[],
  today: string,
  currentMonthCap = 0,
  promos: PromoSaving[] = [],
  adhoc: AdhocBudget[] = [],
): {
  year: number;
  lastYear: number;
  thisIncome: number;
  thisExpense: number;
  thisSaving: number;
  lastIncome: number;
  lastExpense: number;
  lastSaving: number;
  thisSalary: number;
  thisOther: number;
  thisDepInt: number;
  lastSalary: number;
  lastOther: number;
  lastInterest: number;
  rows: {
    id: string;
    name: string;
    nameZh: string;
    thisYear: number;
    lastYear: number;
    delta: number;
    pct: number | null;
  }[];
} {
  const year = Number(today.slice(0, 4));
  const month0 = Number(today.slice(5, 7)) - 1;
  const proj = yearlyProjection(
    plans,
    deposits,
    rates,
    year,
    month0,
    txs,
    categories,
    currentMonthCap,
    recurring,
    today,
    promos,
    adhoc,
  );
  const lastActuals = monthActualsFromTxs(txs, categories, rates, year - 1);
  let lastSalary = 0;
  let lastOther = 0;
  let lastInterest = 0;
  let lastExpense = 0;
  for (const row of lastActuals.values()) {
    lastSalary += row.salary;
    lastOther += row.other;
    lastInterest += row.interest;
    lastExpense += row.expense;
  }
  const thisSalary = proj.rows.reduce((s, r) => s + r.salary, 0);
  const thisOther = proj.rows.reduce((s, r) => s + r.other, 0);
  const thisDepInt = proj.rows.reduce((s, r) => s + r.depInt, 0);
  const thisIncome = proj.yearIncome;
  const thisExpense = proj.yearExpense;
  const thisSaving = proj.yearSaving;
  const lastIncome = lastSalary + lastOther + lastInterest;
  const lastSaving = lastIncome - lastExpense;

  function row(
    id: string,
    name: string,
    nameZh: string,
    thisY: number,
    lastY: number,
  ) {
    return {
      id,
      name,
      nameZh,
      thisYear: thisY,
      lastYear: lastY,
      delta: thisY - lastY,
      pct: lastY > 0 ? (thisY - lastY) / lastY : thisY > 0 ? null : 0,
    };
  }

  const rows = [
    row("salary", "Salary", "薪金", thisSalary, lastSalary),
    row("other", "Other income", "其他收入", thisOther, lastOther),
    row("dep-int", "Deposit interest", "存款利息", thisDepInt, lastInterest),
    row("expense", "Expected expense", "預期開支", thisExpense, lastExpense),
    row("saving", "Saving", "儲蓄", thisSaving, lastSaving),
  ];

  return {
    year,
    lastYear: year - 1,
    thisIncome,
    thisExpense,
    thisSaving,
    lastIncome,
    lastExpense,
    lastSaving,
    thisSalary,
    thisOther,
    thisDepInt,
    lastSalary,
    lastOther,
    lastInterest,
    rows,
  };
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
