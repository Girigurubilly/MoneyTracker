import type { Budget, Category, Recurring, Transaction, FxRate } from "../types.ts";
import { MONTH_TOTAL_BUDGET_ID } from "../types.ts";
import { cashflowSide, inMonth } from "./ledger.ts";
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

export function monthlyExpenseRegulars(recurring: Recurring[]): Recurring[] {
  return recurring.filter((r) => r.type === "expense" && r.frequency === "monthly");
}

/** True when this regular’s charged day has arrived as of `asOfIso` (passed or today). */
export function regularChargedBy(r: Recurring, asOfIso: string): boolean {
  const day = Number(asOfIso.slice(8, 10));
  if (!Number.isFinite(day) || day <= 0) return false;
  return chargedDayOf(r) <= day;
}

/** Monthly regulars whose charged day is still after `asOfIso` — reserved from remaining budget. */
export function reservedRegulars(
  recurring: Recurring[],
  rates: FxRate[],
  asOfIso: string,
): number {
  let sum = 0;
  for (const r of monthlyExpenseRegulars(recurring)) {
    if (regularChargedBy(r, asOfIso)) continue;
    sum += Math.abs(toHkd(r.amount, r.currency, rates));
  }
  return sum;
}

/** Monthly regulars already deducted — charged day has passed or is today. */
export function realizedRegulars(
  recurring: Recurring[],
  rates: FxRate[],
  asOfIso: string,
): number {
  let sum = 0;
  for (const r of monthlyExpenseRegulars(recurring)) {
    if (!regularChargedBy(r, asOfIso)) continue;
    sum += Math.abs(toHkd(r.amount, r.currency, rates));
  }
  return sum;
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

/** This-month planned expenses that are not linked to a monthly regular. */
export function plannedAdhocSpend(
  txs: Transaction[],
  month: string,
  rates: FxRate[],
): number {
  let sum = 0;
  for (const tx of txs) {
    if (!tx.planned || tx.type !== "expense") continue;
    if (tx.recurringId) continue;
    if (!inMonth(tx.date, month)) continue;
    sum += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
  }
  return sum;
}

/** Use today when `month` is the current month; last day if past; 1st if future. */
export function asOfForMonth(month: string, today: string): string {
  const tm = today.slice(0, 7);
  if (month < tm) return monthEndIso(month);
  if (month > tm) return `${month}-01`;
  return today;
}

/**
 * Pace of non-regular spend so far, applied to the remaining days of the month.
 * (spent − realized regulars) / day-of-month × remaining days.
 */
export function projectedNonRegular(spent: number, realized: number, asOfIso: string): number {
  const day = Number(asOfIso.slice(8, 10));
  const last = daysInMonth(asOfIso.slice(0, 7));
  if (!Number.isFinite(day) || day <= 0) return 0;
  const remainingDays = Math.max(0, last - day);
  if (remainingDays === 0) return 0;
  const nonRegular = Math.max(0, spent - realized);
  return (nonRegular / day) * remainingDays;
}

/** Monthly expense regulars whose charged day is still after `asOfIso`, soonest first. */
export function upcomingExpenseRegulars(recurring: Recurring[], asOfIso: string): Recurring[] {
  return monthlyExpenseRegulars(recurring)
    .filter((r) => !regularChargedBy(r, asOfIso))
    .sort((a, b) => chargedDayOf(a) - chargedDayOf(b) || a.label.localeCompare(b.label));
}

export function forecastTone(ratio: number): "income" | "watch" | "expense" {
  if (!Number.isFinite(ratio) || ratio <= 1) return "income";
  if (ratio <= 1.1) return "watch";
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

export function budgetActuals(
  budgets: Budget[],
  txs: Transaction[],
  month: string,
  rates: FxRate[],
  categories: Category[],
  recurring: Recurring[] = [],
  asOfIso?: string,
): (Budget & {
  spent: number;
  remaining: number;
  ratio: number;
  reserved: number;
  realized: number;
  projected: number;
  adhoc: number;
})[] {
  const asOf = asOfIso ?? monthEndIso(month);
  const reserved = reservedRegulars(recurring, rates, asOf);
  const realized = realizedRegulars(recurring, rates, asOf);
  const adhoc = plannedAdhocSpend(txs, month, rates);
  return budgets.map((b) => {
    const unscoped = !b.categoryId && !b.theme;
    const spent = unscoped
      ? b.id === MONTH_TOTAL_BUDGET_ID
        ? spentInMonth(txs, month, rates)
        : 0
      : spentInMonth(txs, month, rates, {
          categoryId: b.categoryId,
          theme: b.theme,
          categories,
        });
    const hold = unscoped && b.id === MONTH_TOTAL_BUDGET_ID ? reserved + adhoc : 0;
    const realizedAmt = unscoped && b.id === MONTH_TOTAL_BUDGET_ID ? realized : 0;
    const projected =
      unscoped && b.id === MONTH_TOTAL_BUDGET_ID ? projectedNonRegular(spent, realizedAmt, asOf) : 0;
    const remaining = b.monthly - spent - hold;
    return {
      ...b,
      spent,
      reserved: unscoped && b.id === MONTH_TOTAL_BUDGET_ID ? reserved : 0,
      adhoc: unscoped && b.id === MONTH_TOTAL_BUDGET_ID ? adhoc : 0,
      realized: realizedAmt,
      projected,
      remaining,
      ratio: b.monthly > 0 ? (spent + hold + projected) / b.monthly : 0,
    };
  });
}

export function dailySpendable(
  remainingDisc: number,
  isoDate: string,
): { daysLeft: number; daily: number } {
  const [y, m] = isoDate.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const day = Number(isoDate.slice(8, 10));
  const daysLeft = Math.max(1, last - day + 1);
  return { daysLeft, daily: remainingDisc / daysLeft };
}

export function essentialCommitments(
  recurring: Recurring[],
  budgets: Budget[],
  categories: Category[],
): number {
  const rec = recurring
    .filter((r) => r.essential && r.type === "expense")
    .reduce((s, r) => s + r.amount, 0);
  const catEssential = new Set(categories.filter((c) => c.essential).map((c) => c.id));
  const bud = budgets
    .filter((b) => b.categoryId && catEssential.has(b.categoryId))
    .reduce((s, b) => s + b.monthly, 0);
  return Math.max(rec, bud);
}
