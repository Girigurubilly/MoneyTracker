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

export type TripPlanLink = {
  v: 1;
  tripId: string;
  bookId: string;
  title: string;
};

export function plannerTripUrl(
  trip: {
    id: string;
    name: string;
    nameZh: string;
    destination: string;
    start: string;
    end: string;
    plannerId?: string;
  },
  opts?: { pick?: boolean },
): string {
  const q = new URLSearchParams({
    money: trip.id,
    start: trip.start,
    end: trip.end,
    name: (trip.nameZh || trip.name).slice(0, 80),
    dest: trip.destination.slice(0, 80),
  });
  if (trip.plannerId) q.set("book", trip.plannerId);
  if (opts?.pick) q.set("pick", "1");
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
    const json = JSON.parse(decodeToken(token)) as Partial<TripSpendProposal>;
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

export function proposalFromHash(hash: string): TripSpendProposal | null {
  const token = hashParam(hash, "proposal");
  if (!token) return null;
  return decodeProposal(token);
}

export function linkFromHash(hash: string): TripPlanLink | null {
  const token = hashParam(hash, "link");
  if (!token) return null;
  try {
    const json = JSON.parse(decodeToken(token)) as Partial<TripPlanLink>;
    const tripId = String(json.tripId || "").trim();
    const bookId = String(json.bookId || "").trim();
    if (json.v !== 1 || !tripId || !bookId) return null;
    return { v: 1, tripId: tripId.slice(0, 80), bookId: bookId.slice(0, 80), title: String(json.title || "").slice(0, 80) };
  } catch {
    return null;
  }
}

function hashParam(hash: string, key: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw).get(key) || "";
}

function decodeToken(token: string): string {
  const pad = token.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "===".slice((pad.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function asMoneyCurrency(code: string): MoneyUnit {
  return (CURRENCIES as string[]).includes(code) ? (code as Currency) : "HKD";
}
