import type { Account, Transaction, FxRate, Trip } from "../types.ts";
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

export function tripCashSpent(txs: Transaction[], tripId: string, rates: FxRate[]): number {
  let sum = 0;
  for (const tx of txs) {
    if (tx.planned || tx.tripId !== tripId || tx.type !== "expense") continue;
    sum += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
  }
  return sum;
}

export function travelSpendYtd(
  txs: Transaction[],
  year: number,
  travelIds: Set<string>,
  rates: FxRate[],
): number {
  let sum = 0;
  const seen = new Set<string>();
  for (const tx of txs) {
    if (tx.planned || tx.type !== "expense") continue;
    if (!tx.date.startsWith(String(year))) continue;
    const travelCat = tx.categoryId && travelIds.has(tx.categoryId);
    const trip = Boolean(tx.tripId);
    if (!travelCat && !trip) continue;
    if (seen.has(tx.id)) continue;
    seen.add(tx.id);
    sum += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
  }
  return sum;
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
