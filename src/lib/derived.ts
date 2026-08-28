import type { AdhocBudget, Budget, Category, FxRate, Goal, Account, Recurring, Transaction, Locale } from "@/lib/types";
import { budgetActuals, dailySpendable, monthFlow, asOfForMonth, monthCashflowForecast } from "@/lib/calc/budget";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import { netWorthNow } from "@/lib/calc/networth";
import type { SnapshotRow as Snap } from "@/lib/idb";
import { parentCategoryName } from "@/lib/categories";
import { todayISO } from "@/lib/format";

export { parentCategoryName };

export function activityDates(txs: Transaction[]): Set<string> {
  const set = new Set<string>();
  for (const tx of txs) {
    if (!tx.planned) set.add(tx.date);
  }
  return set;
}

export function plannedIso(txs: Transaction[]): Set<string> {
  const set = new Set<string>();
  for (const tx of txs) {
    if (tx.planned) set.add(tx.date);
  }
  return set;
}

export function monthKeysBack(fromMonth: string, n: number): string[] {
  const [y, m] = fromMonth.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function monthKeysForward(fromMonth: string, n: number): string[] {
  const [y, m] = fromMonth.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(y, m - 1 + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function monthLabel(month: string, locale: Locale): string {
  const n = Number(month.slice(5));
  if (locale === "zh-HK") return `${n}月`;
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][n - 1] ?? month;
}

export function monthStats(
  txs: Transaction[],
  budgets: Budget[],
  categories: Category[],
  rates: FxRate[],
  isoDate: string,
  recurring: Recurring[] = [],
  adhoc: AdhocBudget[] = [],
) {
  const month = isoDate.slice(0, 7);
  const flow = monthFlow(txs, month, rates);
  const asOf = asOfForMonth(month, todayISO());
  const actuals = budgetActuals(budgets, txs, month, rates, categories, recurring, asOf, adhoc);
  const total = actuals.find((b) => b.id === MONTH_TOTAL_BUDGET_ID) ?? actuals.find((b) => !b.categoryId && !b.theme);
  const remainingBudget = total ? total.remaining : actuals.reduce((s, b) => s + b.remaining, 0);
  const remainingDisc = (total?.reserved ?? 0) + (total?.reservedAdhoc ?? 0) + (total?.projected ?? 0);
  const daily = dailySpendable(remainingBudget, asOf);
  return { month, flow, actuals, remainingBudget, remainingDisc, daily };
}

export function liveGoal(goals: Goal[], accounts: Account[], rates: FxRate[], snapshots: Snap[]): Goal | null {
  const base = goals[0];
  const nw = netWorthNow(accounts, rates);
  const sorted = [...snapshots].sort((a, b) => a.month.localeCompare(b.month));
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : sorted[0];
  const change30 = prev ? nw.net - prev.net : 0;
  if (base) return { ...base, current: nw.net, change30 };
  return { id: "nw", name: "Net worth", nameZh: "淨資產", current: nw.net, target: Math.max(nw.net, 1), currency: "HKD", change30 };
}

export function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function transactionsToCsv(txs: Transaction[]): string {
  const head = ["id", "date", "type", "amount", "currency", "accountId", "payee", "categoryId"];
  const lines = [head.join(",")];
  for (const tx of txs) {
    lines.push(
      [tx.id, tx.date, tx.type, String(tx.amount), tx.currency, tx.accountId, csvEscape(tx.payee), tx.categoryId ?? ""].join(","),
    );
  }
  return lines.join("\n");
}

export function cashflowSeries(
  txs: Transaction[],
  recurring: Recurring[],
  adhoc: AdhocBudget[],
  rates: FxRate[],
  fromMonth: string,
  n: number,
  today: string,
) {
  return monthKeysForward(fromMonth, n).map((month) => ({
    month,
    ...monthCashflowForecast(txs, recurring, adhoc, month, rates, today),
  }));
}
