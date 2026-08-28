import type { Transaction, FxRate, Trip } from "../types";
import { toHkd } from "./fx";

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

function monthDiff(from: string, to: string): number {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}
