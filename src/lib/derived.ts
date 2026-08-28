import type {
  Account,
  AdhocBudget,
  Budget,
  Category,
  FxRate,
  Goal,
  Locale,
  Recurring,
  Transaction,
} from "@/lib/types";
import { budgetActuals, dailySpendable, monthFlow, asOfForMonth, isExpenseRegular } from "@/lib/calc/budget";
import { cashflowSide, inMonth, isSpendLike } from "@/lib/calc/ledger";
import { toHkd } from "@/lib/calc/fx";
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

export function txsOn(txs: Transaction[], iso: string): Transaction[] {
  return txs.filter((t) => t.date === iso);
}

export function groupByDate(rows: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const r of rows) {
    const list = map.get(r.date) ?? [];
    list.push(r);
    map.set(r.date, list);
  }
  return [...map.entries()];
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

export function lastMonthsFlow(
  txs: Transaction[],
  rates: FxRate[],
  fromMonth: string,
  n: number,
  locale: Locale,
): { month: string; income: number; expense: number }[] {
  return monthKeysBack(fromMonth, n).map((key) => {
    const flow = monthFlow(txs, key, rates);
    return { month: monthLabel(key, locale), income: flow.income, expense: flow.expense };
  });
}

export function categorySpend(
  txs: Transaction[],
  rates: FxRate[],
  month: string,
  categories: Category[],
): { id: string; name: string; nameZh: string; value: number }[] {
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (cashflowSide(tx) !== "expense" || !inMonth(tx.date, month)) continue;
    const id = tx.categoryId ?? "other";
    map.set(id, (map.get(id) ?? 0) + Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd)));
  }
  return [...map.entries()]
    .map(([id, value]) => {
      const cat = categories.find((c) => c.id === id);
      return {
        id,
        name: cat?.name ?? id,
        nameZh: cat?.nameZh ?? id,
        value,
      };
    })
    .sort((a, b) => b.value - a.value);
}

function amountInMonth(r: Recurring, month: string): number {
  if (r.frequency === "monthly") return r.amount;
  if (r.frequency === "weekly") return r.amount * 4;
  if (r.frequency === "quarterly") {
    const m = Number(month.slice(5));
    return [1, 4, 7, 10].includes(m) ? r.amount : 0;
  }
  if (r.frequency === "yearly") return r.nextDate.slice(5, 7) === month.slice(5) ? r.amount : 0;
  return 0;
}

export function forecastFromRecurring(
  recurring: Recurring[],
  fromMonth: string,
  n: number,
  locale: Locale,
  txs: Transaction[] = [],
  rates: FxRate[] = [],
): { month: string; inflow: number; outflow: number }[] {
  return monthKeysForward(fromMonth, n).map((key) => {
    let inflow = 0;
    let outflow = 0;
    const counted = new Set<string>();
    for (const tx of txs) {
      if (!inMonth(tx.date, key)) continue;
      if (tx.type === "miles") continue;
      if (tx.type === "transfer" && !isSpendLike(tx)) continue;
      const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
      if (tx.type === "income") inflow += hkd;
      else outflow += hkd;
      if (tx.recurringId) counted.add(tx.recurringId);
    }
    for (const r of recurring) {
      if (counted.has(r.id)) continue;
      const amt = amountInMonth(r, key);
      if (!amt) continue;
      const hkd = Math.abs(toHkd(amt, r.currency, rates));
      if (r.type === "income") inflow += hkd;
      else if (isExpenseRegular(r)) outflow += hkd;
    }
    return { month: monthLabel(key, locale), inflow, outflow };
  });
}


export function rangeFlow(
  txs: Transaction[],
  rates: FxRate[],
  from: string,
  to: string,
): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.date < from || tx.date > to) continue;
    const side = cashflowSide(tx);
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    if (side === "income") income += hkd;
    if (side === "expense") expense += hkd;
  }
  return { income, expense, net: income - expense };
}

export function rangeCategorySpend(
  txs: Transaction[],
  rates: FxRate[],
  categories: Category[],
  from: string,
  to: string,
  kind: "expense" | "income",
): { id: string; name: string; nameZh: string; value: number }[] {
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (tx.date < from || tx.date > to) continue;
    if (cashflowSide(tx) !== kind) continue;
    const id = tx.categoryId ?? "_none";
    map.set(id, (map.get(id) ?? 0) + Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd)));
  }
  return [...map.entries()]
    .map(([id, value]) => {
      if (id === "_none") return { id, name: "Uncategorised", nameZh: "未分類", value };
      const cat = categories.find((c) => c.id === id);
      return { id, name: cat?.name ?? id, nameZh: cat?.nameZh ?? id, value };
    })
    .sort((a, b) => b.value - a.value);
}

export function groupSpendByParent(
  rows: { id: string; name: string; nameZh: string; value: number }[],
  categories: Category[] = [],
): { id: string; name: string; nameZh: string; value: number }[] {
  const map = new Map<string, { id: string; name: string; nameZh: string; value: number }>();
  for (const row of rows) {
    const cat = categories.find((c) => c.id === row.id);
    const parent = cat?.parentId ? categories.find((c) => c.id === cat.parentId) : undefined;
    const name = parent?.name ?? parentCategoryName(row.name);
    const nameZh = parent?.nameZh ?? parentCategoryName(row.nameZh);
    const id = parent?.id ?? `p-${nameZh || name}`;
    const prev = map.get(id);
    if (prev) prev.value += row.value;
    else map.set(id, { id, name, nameZh, value: row.value });
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export type RangePreset = "thisMonth" | "lastMonth" | "thisYear" | "lastYear" | "allTime" | "custom";

export function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 0).getDate();
  return `${ym}-${String(d).padStart(2, "0")}`;
}

export function presetRange(
  preset: RangePreset,
  today: string,
  txs: Transaction[],
  custom?: { from: string; to: string },
): { from: string; to: string } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (preset === "thisMonth") {
    const key = today.slice(0, 7);
    return { from: `${key}-01`, to: lastDayOfMonth(key) };
  }
  if (preset === "lastMonth") {
    const d = new Date(y, m - 2, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { from: `${key}-01`, to: lastDayOfMonth(key) };
  }
  if (preset === "thisYear") return { from: `${y}-01-01`, to: `${y}-12-31` };
  if (preset === "lastYear") return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  if (preset === "allTime") {
    if (!txs.length) return { from: today, to: today };
    let min = txs[0].date;
    let max = txs[0].date;
    for (const tx of txs) {
      if (tx.date < min) min = tx.date;
      if (tx.date > max) max = tx.date;
    }
    return { from: min, to: max };
  }
  return { from: custom?.from || today, to: custom?.to || today };
}

export function withOtherCategory(
  rows: { id: string; name: string; nameZh: string; value: number }[],
  other: { name: string; nameZh: string },
  limit = 8,
): { id: string; name: string; nameZh: string; value: number }[] {
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((s, r) => s + r.value, 0);
  return [...head, { id: "_other", name: other.name, nameZh: other.nameZh, value: rest }];
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
  const total = actuals.find((b) => !b.categoryId && !b.theme && b.monthly > 0);
  const remainingBudget = total ? total.remaining : actuals.reduce((s, b) => s + b.remaining, 0);
  const remainingDisc =
    (total?.reserved ?? 0) + (total?.adhoc ?? 0) + (total?.projected ?? 0);
  const daily = dailySpendable(remainingBudget, asOf);
  return { month, flow, actuals, remainingBudget, remainingDisc, daily };
}

export function liveGoal(
  goals: Goal[],
  accounts: Account[],
  rates: FxRate[],
  snapshots: Snap[],
): Goal | null {
  const base = goals[0];
  const nw = netWorthNow(accounts, rates);
  const sorted = [...snapshots].sort((a, b) => a.month.localeCompare(b.month));
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : sorted[0];
  const change30 = prev ? nw.net - prev.net : 0;
  if (base) return { ...base, current: nw.net, change30 };
  return {
    id: "nw",
    name: "Net worth",
    nameZh: "淨資產",
    current: nw.net,
    target: Math.max(nw.net, 1),
    currency: "HKD",
    change30,
  };
}

export function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function transactionsToCsv(txs: Transaction[]): string {
  const header = "date,amount,currency,type,account,toAccount,category,payee,note,tripId";
  const lines = txs.map((tx) =>
    [
      tx.date,
      String(tx.type === "expense" ? -Math.abs(tx.amount) : tx.amount),
      tx.currency,
      tx.type,
      tx.accountId,
      tx.toAccountId ?? "",
      tx.categoryId ?? "",
      csvEscape(tx.payee),
      csvEscape(tx.note ?? ""),
      tx.tripId ?? "",
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
