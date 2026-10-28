import type { Account, AdhocBudget, Transaction, FxRate, Trip } from "../types.ts";
import { toHkd } from "./fx.ts";

export function isTripExpired(t: Trip, today: string): boolean {
  if (!t.end) return false;
  const plus = new Date(t.end);
  plus.setFullYear(plus.getFullYear() + 1);
  const iso = plus.toISOString().slice(0, 10);
  return iso < today;
}

export function isTripActive(t: Trip, today: string): boolean {
  if (t.status === "cancelled") return false;
  if (isTripExpired(t, today)) return false;
  return true;
}

export function tripMoneySplit(txs: Transaction[], tripId: string, rates: FxRate[], adhoc: AdhocBudget[] = []) {
  let paid = 0;
  let scheduled = 0;
  for (const tx of txs) {
    if (tx.tripId !== tripId || tx.type !== "expense") continue;
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    if (tx.planned) scheduled += hkd;
    else paid += hkd;
  }
  for (const row of adhoc) {
    if (row.tripId !== tripId || row.paidOn) continue;
    scheduled += Math.abs(toHkd(row.amount, row.currency, rates));
  }
  return { paid, scheduled, total: paid + scheduled };
}

export function tripCashSpent(txs: Transaction[], tripId: string, rates: FxRate[], adhoc: AdhocBudget[] = []): number {
  return tripMoneySplit(txs, tripId, rates, adhoc).total;
}

export function travelSpendYtd(
  txs: Transaction[],
  year: number,
  travelIds: Set<string>,
  rates: FxRate[],
): number {
  return travelSpendYtdSplit(txs, year, travelIds, rates).total;
}

/** Split annual travel into trip-linked vs travel-category with no trip. */
export function travelSpendYtdSplit(
  txs: Transaction[],
  year: number,
  travelIds: Set<string>,
  rates: FxRate[],
): { linked: number; unlinked: number; total: number } {
  let linked = 0;
  let unlinked = 0;
  const seen = new Set<string>();
  for (const tx of txs) {
    if (tx.planned || tx.type !== "expense") continue;
    if (!tx.date.startsWith(String(year))) continue;
    const travelCat = Boolean(tx.categoryId && travelIds.has(tx.categoryId));
    const onTrip = Boolean(tx.tripId);
    if (!travelCat && !onTrip) continue;
    if (seen.has(tx.id)) continue;
    seen.add(tx.id);
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    if (onTrip) linked += hkd;
    else unlinked += hkd;
  }
  return { linked, unlinked, total: linked + unlinked };
}

export function travelUnlinkedTxs(
  txs: Transaction[],
  year: number,
  travelIds: Set<string>,
): Transaction[] {
  return txs
    .filter(
      (tx) =>
        !tx.planned &&
        tx.type === "expense" &&
        tx.date.startsWith(String(year)) &&
        Boolean(tx.categoryId && travelIds.has(tx.categoryId)) &&
        !tx.tripId,
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function tripProgress(t: Trip, spent: number) {
  const remain = Math.max(0, t.cashBudget - t.cashSaved - spent);
  const months = Math.max(1, monthDiff(new Date().toISOString().slice(0, 10), t.start));
  const required = remain / months;
  const onTrack = t.monthlyCash >= required || remain === 0;
  return { remain, months, required, onTrack };
}

export function tripBudgetUsed(spent: number, budget: number): { remaining: number; pct: number } {
  const remaining = budget - spent;
  return { remaining, pct: budget > 0 ? spent / budget : 0 };
}

export function spendStatus(spent: number, budget: number): "on-track" | "watch" | "at-risk" {
  if (budget <= 0) return spent > 0 ? "watch" : "on-track";
  const r = spent / budget;
  if (r > 1) return "at-risk";
  if (r > 0.9) return "watch";
  return "on-track";
}

export function nextTrip(trips: Trip[], today: string): Trip | undefined {
  const active = trips.filter((t) => isTripActive(t, today));
  const upcoming = active.filter((t) => t.end >= today).sort((a, b) => a.start.localeCompare(b.start));
  if (upcoming[0]) return upcoming[0];
  return [...active].sort((a, b) => a.start.localeCompare(b.start))[0];
}

export function asiaMilesBalance(accounts: Account[]): number {
  return accounts.filter((a) => a.currency === "MILES").reduce((s, a) => s + a.balance, 0);
}

export function tripCoversDate(t: Trip, date: string): boolean {
  if (t.status === "cancelled") return false;
  return date >= t.start && date <= t.end;
}

export function tripForDate(trips: Trip[], date: string, current?: string): string | undefined {
  const hits = trips.filter((t) => tripCoversDate(t, date));
  if (current && hits.some((t) => t.id === current)) return current;
  return [...hits].sort((a, b) => a.end.localeCompare(b.end) || a.start.localeCompare(b.start))[0]?.id;
}

/**
 * Auto-link only travel-themed categories (and spend-like transfers with those cats).
 * Dining / other themes need an explicit trip pick (tripManual) — matches Travel page note.
 */
export function applyAutoTrip(tx: Transaction, trips: Trip[], travelCategoryIds?: Set<string>): Transaction {
  if (tx.tripManual) return tx;
  const eligible = tx.type === "expense" || (tx.type === "transfer" && tx.countsAsExpense);
  if (tx.planned || !eligible) {
    if (tx.tripId && !tx.tripManual) return { ...tx, tripId: undefined };
    return tx;
  }
  if (travelCategoryIds) {
    const travelCat = Boolean(tx.categoryId && travelCategoryIds.has(tx.categoryId));
    if (!travelCat) {
      if (tx.tripId && !tx.tripManual) return { ...tx, tripId: undefined };
      return tx;
    }
  }
  const id = tripForDate(trips, tx.date, tx.tripId);
  if (id === tx.tripId) return tx;
  return { ...tx, tripId: id };
}

export function patchAutoTrips(txs: Transaction[], trips: Trip[], travelCategoryIds?: Set<string>): Transaction[] {
  return txs.map((tx) => applyAutoTrip(tx, trips, travelCategoryIds));
}

/** Sum of cash budgets for trips overlapping a calendar year (cancelled excluded). */
export function tripBudgetsForYear(trips: Trip[], year: number): number {
  const y = String(year);
  let n = 0;
  for (const t of trips) {
    if (t.status === "cancelled") continue;
    if (!t.start || !t.end) continue;
    if (t.start.slice(0, 4) > y || t.end.slice(0, 4) < y) continue;
    n += Math.max(0, t.cashBudget || 0);
  }
  return n;
}

/** Prefer the annual travel budget; when unset, fall back to sum of trip cash budgets. */
export function effectiveAnnualTravelBudget(
  annual: number,
  trips: Trip[],
  year: number,
): { budget: number; fromTrips: boolean } {
  if (annual > 0) return { budget: annual, fromTrips: false };
  const fromTrips = tripBudgetsForYear(trips, year);
  return { budget: fromTrips, fromTrips: fromTrips > 0 };
}

export function tripLinkedTxs(txs: Transaction[], tripId: string): Transaction[] {
  return txs
    .filter((tx) => tx.tripId === tripId && !tx.planned)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function monthDiff(from: string, to: string): number {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}
