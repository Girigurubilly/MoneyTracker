import type { Category, FxRate, Transaction } from "../types.ts";
import { cashflowSide } from "./ledger.ts";
import { toHkd } from "./fx.ts";

export type PeriodPreset = "this-month" | "last-month" | "this-year" | "last-year" | "all" | "custom";
export type PeriodTab = "expense" | "income" | "both";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDay(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function periodRange(
  preset: PeriodPreset,
  today: string,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (preset === "this-month") return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
  if (preset === "last-month") {
    const d = new Date(y, m - 2, 1);
    const yy = d.getFullYear();
    const mm = d.getMonth() + 1;
    return { from: `${yy}-${pad(mm)}-01`, to: `${yy}-${pad(mm)}-${pad(lastDay(yy, mm))}` };
  }
  if (preset === "this-year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  if (preset === "last-year") return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  if (preset === "all") return { from: "1970-01-01", to: "2099-12-31" };
  return {
    from: customFrom && customFrom <= (customTo ?? customFrom) ? customFrom : (customTo ?? today),
    to: customTo && customTo >= (customFrom ?? customTo) ? customTo : (customFrom ?? today),
  };
}

export function inPeriod(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

export type PeriodRow = {
  id: string;
  name: string;
  nameZh: string;
  value: number;
  colorIndex: number;
};

export function periodCategoryTotals(
  txs: Transaction[],
  categories: Category[],
  rates: FxRate[],
  from: string,
  to: string,
  tab: PeriodTab,
  mergeParents: boolean,
): { rows: PeriodRow[]; expense: number; income: number } {
  const sums = new Map<string, number>();
  let expense = 0;
  let income = 0;
  for (const tx of txs) {
    if (tx.planned) continue;
    if (!inPeriod(tx.date, from, to)) continue;
    const side = cashflowSide(tx);
    if (side === "none") continue;
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    if (side === "expense") expense += hkd;
    if (side === "income") income += hkd;
    if (tab === "expense" && side !== "expense") continue;
    if (tab === "income" && side !== "income") continue;
    const cat = categories.find((c) => c.id === tx.categoryId);
    let id = cat?.id ?? (side === "income" ? "uncat-in" : "uncat-out");
    if (mergeParents && cat) id = cat.parentId ?? cat.id;
    const signed = tab === "both" && side === "income" ? hkd : hkd;
    sums.set(id, (sums.get(id) ?? 0) + signed);
  }
  const rows: PeriodRow[] = [];
  for (const [id, value] of sums) {
    if (value <= 0) continue;
    const cat = categories.find((c) => c.id === id);
    rows.push({
      id,
      name: cat?.name ?? (id.startsWith("uncat") ? "Other" : id),
      nameZh: cat?.nameZh ?? (id.startsWith("uncat") ? "其他" : id),
      value,
      colorIndex: 0,
    });
  }
  rows.sort((a, b) => b.value - a.value);
  rows.forEach((r, i) => {
    r.colorIndex = i % 8;
  });
  return { rows, expense, income };
}
