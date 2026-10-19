import type { Currency, MoneyUnit } from "./types.ts";
import { CURRENCIES } from "./types.ts";

export const PLANNER_URL = "https://girigurubilly.github.io/TripPlanner/";
export const MONEY_URL = "https://girigurubilly.github.io/MoneyTracker/";

export type TripSpendItem = {
  date: string;
  label: string;
  amount: number;
  currency: string;
};

export type TripSpendProposal = {
  v: 1;
  trip: string;
  tripId: string;
  items: TripSpendItem[];
};

export function plannerTripUrl(trip: {
  id: string;
  name: string;
  nameZh: string;
  destination: string;
  start: string;
  end: string;
}): string {
  const q = new URLSearchParams({
    money: trip.id,
    start: trip.start,
    end: trip.end,
    name: (trip.nameZh || trip.name).slice(0, 80),
    dest: trip.destination.slice(0, 80),
  });
  return `${PLANNER_URL}?${q.toString()}`;
}

export function encodeProposal(body: TripSpendProposal): string {
  const json = JSON.stringify(body);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeProposal(token: string): TripSpendProposal | null {
  try {
    const pad = token.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(pad + "===".slice((pad.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes)) as Partial<TripSpendProposal>;
    if (json.v !== 1 || !Array.isArray(json.items)) return null;
    const items: TripSpendItem[] = [];
    for (const row of json.items) {
      if (!row || typeof row !== "object") continue;
      const date = String(row.date || "");
      const label = String(row.label || "").trim().slice(0, 80);
      const amount = Number(row.amount);
      const currency = String(row.currency || "HKD");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !label || !Number.isFinite(amount) || amount <= 0) continue;
      items.push({ date, label, amount, currency });
      if (items.length >= 20) break;
    }
    if (!items.length) return null;
    return { v: 1, trip: String(json.trip || "").slice(0, 80), tripId: String(json.tripId || "").slice(0, 80), items };
  } catch {
    return null;
  }
}

/** Read `#proposal=` once. Returns null when the hash is not a proposal. */
export function proposalFromHash(hash: string): TripSpendProposal | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const q = new URLSearchParams(raw);
  const token = q.get("proposal");
  if (!token) return null;
  return decodeProposal(token);
}

export function asMoneyCurrency(code: string): MoneyUnit {
  return (CURRENCIES as string[]).includes(code) ? (code as Currency) : "HKD";
}
