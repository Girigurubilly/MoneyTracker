import type { FxRate, Transaction, Trip } from "@/lib/types";
import { toHkd } from "./fx";
import { cashflowSide } from "./ledger";

export type TripProgress = {
  cashLeft: number;
  milesLeft: number;
  monthsLeft: number;
  requiredCashMonthly: number;
  requiredMilesMonthly: number;
  cashStatus: "on-track" | "watch" | "at-risk";
  milesStatus: "on-track" | "watch" | "at-risk";
  spent: number;
  usedRatio: number;
};

export function monthsBetween(fromISO: string, toISO: string): number {
  const [fy, fm] = fromISO.split("-").map(Number);
  const [ty, tm] = toISO.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function isTripActive(trip: Trip, todayISO: string): boolean {
  if (trip.status === "cancelled" || trip.status === "completed") return false;
  const end = trip.end || trip.start;
  return end >= todayISO;
}

export function activeTrips(trips: Trip[], todayISO: string, keepId?: string): Trip[] {
  return trips
    .filter((t) => t.id === keepId || isTripActive(t, todayISO))
    .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

export function tripCashSpent(txs: Transaction[], rates: FxRate[], tripId: string): number {
  let sum = 0;
  for (const tx of txs) {
    if (tx.tripId !== tripId) continue;
    if (cashflowSide(tx) !== "expense") continue;
    sum += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
  }
  return sum;
}

export function tripProgress(trip: Trip, todayISO: string, spent?: number): TripProgress {
  const used = spent ?? trip.cashSaved;
  const cashLeft = Math.max(0, trip.cashBudget - used);
  const milesLeft = Math.max(0, trip.milesTarget - trip.milesSaved);
  const monthsLeft = Math.max(0, monthsBetween(todayISO, trip.start));
  const denom = Math.max(1, monthsLeft);
  const requiredCashMonthly = cashLeft / denom;
  const requiredMilesMonthly = milesLeft / denom;
  const usedRatio = trip.cashBudget > 0 ? used / trip.cashBudget : used > 0 ? 1 : 0;
  const spendStatus: TripProgress["cashStatus"] =
    usedRatio >= 1.1 ? "at-risk" : usedRatio >= 1 ? "watch" : "on-track";
  return {
    cashLeft,
    milesLeft,
    monthsLeft,
    requiredCashMonthly,
    requiredMilesMonthly,
    cashStatus: spent != null ? spendStatus : statusFor(cashLeft, trip.monthlyCash, monthsLeft),
    milesStatus: statusFor(milesLeft, trip.monthlyMiles, monthsLeft),
    spent: used,
    usedRatio,
  };
}

function statusFor(
  left: number,
  planned: number,
  monthsLeft: number,
): "on-track" | "watch" | "at-risk" {
  if (left <= 0) return "on-track";
  if (monthsLeft <= 0) return "at-risk";
  const projected = planned * monthsLeft;
  if (projected >= left) return "on-track";
  if (projected >= left * 0.85) return "watch";
  return "at-risk";
}

export function travelSpendYtd(
  txs: Transaction[],
  year: number,
  travelCategoryIds: Set<string>,
): number {
  const prefix = `${year}-`;
  let sum = 0;
  const seen = new Set<string>();
  for (const tx of txs) {
    if (tx.planned || tx.type !== "expense") continue;
    if (!tx.date.startsWith(prefix)) continue;
    const travelCat = tx.categoryId ? travelCategoryIds.has(tx.categoryId) : false;
    const linked = Boolean(tx.tripId);
    if (!travelCat && !linked) continue;
    if (seen.has(tx.id)) continue;
    seen.add(tx.id);
    sum += Math.abs(tx.amount);
  }
  return sum;
}
