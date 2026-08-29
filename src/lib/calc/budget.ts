import type { AdhocBudget, Budget, Category, Recurring, Transaction, FxRate } from "../types.ts";
import { MONTH_TOTAL_BUDGET_ID } from "../types.ts";
import { cashflowSide, inMonth, isSpendLike } from "./ledger.ts";
import { toHkd } from "./fx.ts";

export function spentInMonth(
  txs: Transaction[],
  month: string,
  rates: FxRate[],
  opts?: { categoryId?: string; theme?: Category["theme"]; categories?: Category[] },
): number {
  const themeIds = new Set(
    opts?.theme && opts.categories
      ? opts.categories.filter((c) => c.theme === opts.theme && c.kind === "expense").map((c) => c.id)
      : [],
  );
  let sum = 0;
  for (const tx of txs) {
    if (cashflowSide(tx) !== "expense") continue;
    if (!inMonth(tx.date, month)) continue;
    if (opts?.categoryId && tx.categoryId !== opts.categoryId) continue;
    if (opts?.theme && tx.categoryId && !themeIds.has(tx.categoryId)) continue;
    sum += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
  }
  return sum;
}

export function monthFlow(
  txs: Transaction[],
  month: string,
  rates: FxRate[],
): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (!inMonth(tx.date, month)) continue;
    const side = cashflowSide(tx);
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    if (side === "income") income += hkd;
    if (side === "expense") expense += hkd;
  }
  return { income, expense, net: income - expense };
}

export function chargedDayOf(r: Recurring): number {
  if (r.chargedDay && r.chargedDay >= 1 && r.chargedDay <= 28) return r.chargedDay;
  const d = Number(r.nextDate.slice(8, 10));
  return Number.isFinite(d) && d >= 1 ? Math.min(28, d) : 1;
}

export function isExpenseRegular(r: Recurring): boolean {
  return r.type === "expense" || (r.type === "transfer" && Boolean(r.countsAsExpense));
}

export function monthlyExpenseRegulars(recurring: Recurring[]): Recurring[] {
  return recurring.filter((r) => isExpenseRegular(r) && r.frequency === "monthly");
}

export function monthlyIncomeRegulars(recurring: Recurring[]): Recurring[] {
  return recurring.filter((r) => r.type === "income" && r.frequency === "monthly");
}

export function regularChargedBy(r: Recurring, asOfIso: string): boolean {
  const day = Number(asOfIso.slice(8, 10));
  if (!Number.isFinite(day) || day <= 0) return false;
  return chargedDayOf(r) <= day;
}

export function reservedRegulars(recurring: Recurring[], rates: FxRate[], asOfIso: string): number {
  let sum = 0;
  for (const r of monthlyExpenseRegulars(recurring)) {
    if (regularChargedBy(r, asOfIso)) continue;
    sum += Math.abs(toHkd(r.amount, r.currency, rates));
  }
  return sum;
}

export function realizedRegulars(recurring: Recurring[], rates: FxRate[], asOfIso: string): number {
  let sum = 0;
  for (const r of monthlyExpenseRegulars(recurring)) {
    if (!regularChargedBy(r, asOfIso)) continue;
    sum += Math.abs(toHkd(r.amount, r.currency, rates));
  }
  return sum;
}

export function totalExpenseRegulars(recurring: Recurring[], rates: FxRate[]): number {
  return monthlyExpenseRegulars(recurring).reduce((s, r) => s + hkdOfRegular(r, rates), 0);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthEndIso(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function chargedIso(month: string, day: number): string {
  const last = daysInMonth(month);
  const d = Math.min(Math.max(1, day), last);
  return `${month}-${String(d).padStart(2, "0")}`;
}

export function plannedAdhocSpend(txs: Transaction[], month: string, rates: FxRate[]): number {
  let sum = 0;
  for (const tx of txs) {
    if (!tx.planned || !isSpendLike(tx)) continue;
    if (tx.recurringId) continue;
    if (!inMonth(tx.date, month)) continue;
    sum += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
  }
  return sum;
}

export function adhocForMonth(rows: AdhocBudget[], month: string): AdhocBudget[] {
  return rows.filter((a) => a.month === month || a.date.startsWith(month));
}

export function adhocChargedBy(a: AdhocBudget, asOfIso: string): boolean {
  return a.date <= asOfIso;
}

export function adhocTotal(rows: AdhocBudget[], month: string, rates: FxRate[]): number {
  let sum = 0;
  for (const a of adhocForMonth(rows, month)) {
    sum += Math.abs(toHkd(a.amount, a.currency, rates));
  }
  return sum;
}

export function reservedAdhoc(rows: AdhocBudget[], month: string, rates: FxRate[], asOfIso: string): number {
  let sum = 0;
  for (const a of adhocForMonth(rows, month)) {
    if (adhocChargedBy(a, asOfIso)) continue;
    sum += Math.abs(toHkd(a.amount, a.currency, rates));
  }
  return sum;
}

export function realizedAdhoc(rows: AdhocBudget[], month: string, rates: FxRate[], asOfIso: string): number {
  let sum = 0;
  for (const a of adhocForMonth(rows, month)) {
    if (!adhocChargedBy(a, asOfIso)) continue;
    sum += Math.abs(toHkd(a.amount, a.currency, rates));
  }
  return sum;
}

/** 已實現非定期 = 本月已花費 − 已實現每月定期 − 本月臨時 */
export function realizedNonRegularSpend(spent: number, realizedRegularsAmt: number, adhocAmt: number): number {
  return Math.max(0, spent - realizedRegularsAmt - adhocAmt);
}

export function asOfForMonth(month: string, today: string): string {
  const tm = today.slice(0, 7);
  if (month < tm) return monthEndIso(month);
  if (month > tm) return `${month}-01`;
  return today;
}

/** MoneyProExtend liveMonthly: nonRegSoFar / day */
export function avgDailyNonRegular(nonRegSoFar: number, asOfIso: string): number {
  const day = Number(asOfIso.slice(8, 10));
  if (!Number.isFinite(day) || day <= 0) return 0;
  return nonRegSoFar / day;
}

/** Remaining-days projection after today: dailyNonReg × (dim − day). Last day = 0. */
export function projectedNonRegularRemain(nonRegSoFar: number, asOfIso: string): number {
  const day = Number(asOfIso.slice(8, 10));
  const last = daysInMonth(asOfIso.slice(0, 7));
  if (!Number.isFinite(day) || day <= 0) return 0;
  const remainingDays = Math.max(0, last - day);
  if (remainingDays === 0) return 0;
  return avgDailyNonRegular(nonRegSoFar, asOfIso) * remainingDays;
}

/** PROJECTED NON-REGULAR (FULL MONTH) = dailyNonReg × days in month */
export function projectedNonRegularFull(nonRegSoFar: number, asOfIso: string): number {
  const last = daysInMonth(asOfIso.slice(0, 7));
  return avgDailyNonRegular(nonRegSoFar, asOfIso) * last;
}

/** @deprecated remaining-days only; prefer projectedNonRegularFull / Remain */
export function projectedNonRegular(spent: number, realized: number, asOfIso: string): number {
  return projectedNonRegularRemain(Math.max(0, spent - realized), asOfIso);
}

export function upcomingExpenseRegulars(recurring: Recurring[], asOfIso: string): Recurring[] {
  return monthlyExpenseRegulars(recurring)
    .filter((r) => !regularChargedBy(r, asOfIso))
    .sort((a, b) => chargedDayOf(a) - chargedDayOf(b) || a.label.localeCompare(b.label));
}

/** Match this month's spend-like txs to monthly expense regulars without double-counting. */
export function coverRegulars(
  regulars: Recurring[],
  txs: Transaction[],
  opts?: { matchCategory?: boolean },
): { covered: { regular: Recurring; txs: Transaction[] }[]; uncovered: Recurring[] } {
  const matchCategory = opts?.matchCategory !== false;
  const used = new Set<string>();
  const covered: { regular: Recurring; txs: Transaction[] }[] = [];
  const uncovered: Recurring[] = [];
  for (const r of regulars) {
    const byId = txs.filter((tx) => tx.recurringId === r.id && !used.has(tx.id));
    if (byId.length) {
      for (const tx of byId) used.add(tx.id);
      covered.push({ regular: r, txs: byId });
      continue;
    }
    if (matchCategory && r.categoryId) {
      const hit = txs.find((tx) => !used.has(tx.id) && tx.categoryId === r.categoryId);
      if (hit) {
        used.add(hit.id);
        covered.push({ regular: r, txs: [hit] });
        continue;
      }
    }
    uncovered.push(r);
  }
  return { covered, uncovered };
}

export function coverExpenseRegulars(
  recurring: Recurring[],
  txs: Transaction[],
  month: string,
): { covered: { regular: Recurring; txs: Transaction[] }[]; uncovered: Recurring[] } {
  return coverRegulars(
    monthlyExpenseRegulars(recurring),
    txs.filter((tx) => inMonth(tx.date, month) && isSpendLike(tx)),
  );
}

/** Ad-hoc holds are realised only when a posted spend matches the same category. */
export function coverAdhoc(
  rows: AdhocBudget[],
  txs: Transaction[],
  usedTxIds?: Set<string>,
): { covered: AdhocBudget[]; uncovered: AdhocBudget[] } {
  const used = usedTxIds ?? new Set<string>();
  const covered: AdhocBudget[] = [];
  const uncovered: AdhocBudget[] = [];
  for (const a of rows) {
    if (a.categoryId) {
      const hit = txs.find((tx) => !used.has(tx.id) && tx.categoryId === a.categoryId);
      if (hit) {
        used.add(hit.id);
        covered.push(a);
        continue;
      }
    }
    uncovered.push(a);
  }
  return { covered, uncovered };
}

export function hkdOfAdhoc(a: AdhocBudget, rates: FxRate[]): number {
  return Math.abs(toHkd(a.amount, a.currency, rates));
}


export function forecastTone(ratio: number): "income" | "watch" | "expense" {
  if (!Number.isFinite(ratio) || ratio < 0.96) return "income";
  if (ratio <= 1) return "watch";
  return "expense";
}

export function livingEssentials(recurring: Recurring[]): number {
  return monthlyExpenseRegulars(recurring)
    .filter((r) => r.living)
    .reduce((s, r) => s + r.amount, 0);
}

export function inferLivingRegular(r: Recurring, categories: { id: string; parentId?: string }[]): boolean {
  if (r.living) return true;
  const hay = `${r.label} ${r.labelZh} ${r.categoryId ?? ""}`;
  if (/按揭|mortgage|管理費|management fee|差餉|地租|rates|水電|utility|家居保險|住宅/i.test(hay)) {
    return true;
  }
  const cat = categories.find((c) => c.id === r.categoryId);
  return Boolean(cat && (cat.parentId === "p-housing" || cat.id === "p-housing"));
}

export function hkdOfRegular(r: Recurring, rates: FxRate[]): number {
  return Math.abs(toHkd(r.amount, r.currency, rates));
}

/**
 * Cash-flow forecast for one month.
 * Income = realized + still-scheduled income in that month.
 * Expense (current month) = realized + uncharged monthly regulars + uncharged 本月臨時.
 * Expense (future) = monthly expense regulars. Past = realized only.
 */
export function monthCashflowForecast(
  txs: Transaction[],
  recurring: Recurring[],
  adhoc: AdhocBudget[],
  month: string,
  rates: FxRate[],
  today: string,
): { income: number; expense: number; net: number } {
  const posted = monthFlow(txs, month, rates);
  const current = month === today.slice(0, 7);
  const future = month > today.slice(0, 7);
  const asOf = asOfForMonth(month, today);

  let schedIncome = 0;
  for (const r of monthlyIncomeRegulars(recurring)) {
    if (current && regularChargedBy(r, asOf)) continue;
    if (!current && !future) continue;
    schedIncome += hkdOfRegular(r, rates);
  }

  let schedExpense = 0;
  if (current) {
    schedExpense = reservedRegulars(recurring, rates, asOf) + reservedAdhoc(adhoc, month, rates, asOf);
  } else if (future) {
    for (const r of monthlyExpenseRegulars(recurring)) schedExpense += hkdOfRegular(r, rates);
  }

  const income = posted.income + schedIncome;
  const expense = posted.expense + schedExpense;
  return { income, expense, net: income - expense };
}

/**
 * Cap card formulas:
 *   reserved (已預留) = monthly expense regulars + this-month ad-hoc with no matching posted txn
 *                       (past due still counts if nothing has posted)
 *   realized (hidden) = those same items that do have a matching posted txn
 *   avgDaily          = (spent − realized) / day of month
 *   dailyAllowed      = (cap − spent − reserved) / days after today
 *   projected (全月)  = (spent − realized) + avgDaily × remaining days
 *   headline          = spent + reserved + avgDaily × remaining days
 */
export function budgetActuals(
  budgets: Budget[],
  txs: Transaction[],
  month: string,
  rates: FxRate[],
  categories: Category[],
  recurring: Recurring[] = [],
  asOfIso?: string,
  adhocRows: AdhocBudget[] = [],
): (Budget & {
  spent: number;
  remaining: number;
  ratio: number;
  reserved: number;
  reservedAdhoc: number;
  realized: number;
  projected: number;
  projectedRemain: number;
  avgDaily: number;
  dailyAllowed: number;
  daysRemaining: number;
  nonRegular: number;
  adhoc: number;
  expected: number;
})[] {
  const asOf = asOfIso ?? monthEndIso(month);
  const postedSpend = txs.filter((tx) => inMonth(tx.date, month) && isSpendLike(tx) && !tx.planned);
  const cover = coverRegulars(monthlyExpenseRegulars(recurring), postedSpend, { matchCategory: false });
  const used = new Set(cover.covered.flatMap((row) => row.txs.map((tx) => tx.id)));
  const adhocCover = coverAdhoc(adhocForMonth(adhocRows, month), postedSpend, used);
  const reservedReg = cover.uncovered.reduce((s, r) => s + hkdOfRegular(r, rates), 0);
  const reservedA = adhocCover.uncovered.reduce((s, a) => s + hkdOfAdhoc(a, rates), 0);
  const realizedReg = cover.covered.reduce((s, row) => s + hkdOfRegular(row.regular, rates), 0);
  const realizedA = adhocCover.covered.reduce((s, a) => s + hkdOfAdhoc(a, rates), 0);
  const realized = realizedReg + realizedA;
  const adhoc = adhocTotal(adhocRows, month, rates);
  return budgets.map((b) => {
    const unscoped = !b.categoryId && !b.theme;
    const isMonth = unscoped && b.id === MONTH_TOTAL_BUDGET_ID;
    const spent = unscoped
      ? isMonth
        ? spentInMonth(txs, month, rates)
        : 0
      : spentInMonth(txs, month, rates, {
          categoryId: b.categoryId,
          theme: b.theme,
          categories,
        });
    const hold = isMonth ? reservedReg + reservedA : 0;
    const paceBase = isMonth ? spent - realized : 0;
    const avgDaily = isMonth ? avgDailyNonRegular(paceBase, asOf) : 0;
    const projectedRemain = isMonth ? projectedNonRegularRemain(paceBase, asOf) : 0;
    const projected = isMonth ? paceBase + projectedRemain : 0;
    const expected = isMonth ? spent + hold + projectedRemain : spent;
    const remaining = isMonth ? b.monthly - spent - hold : b.monthly - spent;
    const allowed = isMonth ? dailySpendable(remaining, asOf) : { daysLeft: 0, daily: 0 };
    return {
      ...b,
      spent,
      reserved: isMonth ? reservedReg : 0,
      reservedAdhoc: isMonth ? reservedA : 0,
      adhoc: isMonth ? adhoc : 0,
      realized: isMonth ? realized : 0,
      nonRegular: paceBase,
      avgDaily,
      projected,
      projectedRemain,
      dailyAllowed: allowed.daily,
      daysRemaining: allowed.daysLeft,
      remaining,
      expected,
      ratio: b.monthly > 0 ? expected / b.monthly : 0,
    };
  });
}

export function dailySpendable(remainingAmt: number, isoDate: string): { daysLeft: number; daily: number } {
  const last = daysInMonth(isoDate.slice(0, 7));
  const day = Number(isoDate.slice(8, 10));
  const daysLeft = Math.max(0, last - day);
  if (daysLeft === 0) return { daysLeft: 0, daily: remainingAmt };
  return { daysLeft, daily: remainingAmt / daysLeft };
}

export function essentialCommitments(recurring: Recurring[], budgets: Budget[], categories: Category[]): number {
  const rec = recurring.filter((r) => r.essential && isExpenseRegular(r)).reduce((s, r) => s + r.amount, 0);
  const catEssential = new Set(categories.filter((c) => c.essential).map((c) => c.id));
  const bud = budgets
    .filter((b) => b.categoryId && catEssential.has(b.categoryId))
    .reduce((s, b) => s + b.monthly, 0);
  return Math.max(rec, bud);
}
