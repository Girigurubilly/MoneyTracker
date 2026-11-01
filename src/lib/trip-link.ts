import type { Currency, MoneyUnit, Trip } from "./types.ts";
import { CURRENCIES } from "./types.ts";

export const PLANNER_URL = "https://girigurubilly.github.io/TripPlanner/";
export const MONEY_URL = "https://girigurubilly.github.io/MoneyTracker/";

export type TripSpendItem = {
  date: string;
  label: string;
  amount: number;
  currency: string;
  /** Planner hint: meal | ride | hotel | sight | other — not a Money category id. */
  category?: string;
  /** Optional HH:mm from the meal/event; sheet should not use wall-clock now. */
  time?: string;
  /** Stable planner item key (bookId:dayId:kind:entry). Used to skip duplicates and show ✓ in the planner. */
  key?: string;
};

export type TripSpendProposal = {
  v: 1;
  trip: string;
  tripId: string;
  bookId?: string;
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
  opts?: { pick?: boolean; day?: string },
): string {
  const q = new URLSearchParams({
    money: trip.id,
    start: trip.start,
    end: trip.end,
    name: (trip.nameZh || trip.name).slice(0, 80),
    dest: trip.destination.slice(0, 80),
  });
  if (trip.plannerId) q.set("book", trip.plannerId);
  if (opts?.day && /^\d{4}-\d{2}-\d{2}$/.test(opts.day)) q.set("day", opts.day);
  if (opts?.pick) q.set("pick", "1");
  return `${PLANNER_URL}?${q.toString()}`;
}

/** All non-cancelled trips covering a date, planner-linked first, then latest start. */
export function tripsCovering(trips: Trip[], iso: string): Trip[] {
  const hits = trips.filter((trip) => trip.status !== "cancelled" && trip.start <= iso && iso <= trip.end);
  hits.sort((a, b) => Number(Boolean(b.plannerId)) - Number(Boolean(a.plannerId)) || b.start.localeCompare(a.start));
  return hits;
}

export function tripCovering(trips: Trip[], iso: string): Trip | undefined {
  return tripsCovering(trips, iso)[0];
}

export function carriedTrip(
  trips: Trip[],
  proposal: { trip: string; tripId: string; bookId?: string; items: { date: string }[] },
): Trip | undefined {
  const alive = trips.filter((trip) => trip.status !== "cancelled");
  const remembered = rememberedMoneyId(proposal.bookId || "");
  const byId = alive.find((trip) => trip.id === proposal.tripId || trip.id === remembered);
  if (byId) return byId;
  const book = proposal.bookId || "";
  const byBook = alive.find((trip) => trip.plannerId && (trip.plannerId === book || trip.plannerId === proposal.tripId));
  if (byBook) return byBook;
  const title = proposal.trip.trim().toLowerCase();
  const named = alive.filter((trip) => {
    const fields = [trip.name, trip.nameZh, trip.destination, trip.plannerTitle || ""].map((value) => value.toLowerCase()).filter(Boolean);
    return Boolean(title) && fields.some((name) => name === title || name.includes(title) || title.includes(name));
  });
  const covers = (trip: Trip) => proposal.items.some((item) => trip.start <= item.date && item.date <= trip.end);
  const namedOnDate = named.filter(covers);
  if (namedOnDate.length === 1) return namedOnDate[0];
  if (named.length === 1) return named[0];
  const covering = alive.filter(covers);
  if (covering.length === 1) return covering[0];
  if (namedOnDate.length > 1) return namedOnDate[0];
  return undefined;
}

function rememberedMoneyId(bookId: string): string {
  if (!bookId || typeof localStorage === "undefined") return "";
  try {
    const parsed = JSON.parse(localStorage.getItem("tripbook-money-links") || "{}") as Record<string, string>;
    return Object.entries(parsed).find(([, book]) => book === bookId)?.[0] || "";
  } catch {
    return "";
  }
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !label || !Number.isFinite(amount) || amount < 0) continue;
      const category = String((row as { category?: string }).category || "").trim().slice(0, 24);
      const timeRaw = String((row as { time?: string }).time || "").trim();
      const time = /^\d{2}:\d{2}$/.test(timeRaw) ? timeRaw : "";
      const key = cleanItemKey((row as { key?: string }).key);
      items.push({
        date,
        label,
        amount,
        currency,
        ...(category ? { category } : {}),
        ...(time ? { time } : {}),
        ...(key ? { key } : {}),
      });
      if (items.length >= 20) break;
    }
    if (!items.length) return null;
    const bookId = String(json.bookId || "").trim().slice(0, 80);
    return {
      v: 1,
      trip: String(json.trip || "").slice(0, 80),
      tripId: String(json.tripId || "").slice(0, 80),
      ...(bookId ? { bookId } : {}),
      items,
    };
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

/**
 * Today or earlier → a real expense charged to the account.
 * Later → a scheduled one-off (hold) in that item's month.
 */
export function proposalAction(date: string, today: string): "post" | "schedule" {
  return date <= today ? "post" : "schedule";
}

export function cleanItemKey(raw: unknown): string {
  const key = String(raw ?? "").trim().slice(0, 160);
  return /^[^\s]{3,160}$/.test(key) ? key : "";
}

/**
 * Shared contract with TripPlanner (same origin: girigurubilly.github.io).
 * MoneyTracker owns this key and rewrites it from its ledger (rows carrying `plannerKey`).
 * Value: { v: 1, keys: string[], at: ISO }. TripPlanner only reads it to show ✓ 已記,
 * and listens for the `storage` event to update live.
 */
export const LOGGED_KEYS_STORAGE = "money-trip-logged";

export function loggedPlannerKeys(rows: { plannerKey?: string }[]): string[] {
  const set = new Set<string>();
  for (const row of rows) if (row.plannerKey) set.add(row.plannerKey);
  return [...set].sort();
}

export function publishLoggedKeys(keys: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    const prev = JSON.parse(localStorage.getItem(LOGGED_KEYS_STORAGE) || "{}") as { keys?: string[] };
    if (Array.isArray(prev.keys) && prev.keys.join("\n") === keys.join("\n")) return;
    localStorage.setItem(LOGGED_KEYS_STORAGE, JSON.stringify({ v: 1, keys, at: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
}

/** Survives the onboarding redirect, which drops the URL hash. */
const PENDING_HASH = "money-pending-trip-hash";

export function isTripHash(hash: string): boolean {
  return Boolean(hashParam(hash, "proposal") || hashParam(hash, "link"));
}

export function stashTripHash(hash: string): void {
  if (!isTripHash(hash)) return;
  try {
    sessionStorage.setItem(PENDING_HASH, hash);
  } catch {
    /* ignore */
  }
}

/** Live hash first, else the one stashed before onboarding. */
export function pendingTripHash(): string {
  if (typeof window === "undefined") return "";
  if (isTripHash(window.location.hash)) return window.location.hash;
  try {
    return sessionStorage.getItem(PENDING_HASH) || "";
  } catch {
    return "";
  }
}

/** Drop the live hash; `keepStash` leaves the session copy until the sheet is handled (survives remounts). */
export function clearTripHash(kind: "proposal" | "link", keepStash = false): void {
  if (!keepStash) {
    try {
      const stashed = sessionStorage.getItem(PENDING_HASH) || "";
      if (hashParam(stashed, kind)) sessionStorage.removeItem(PENDING_HASH);
    } catch {
      /* ignore */
    }
  }
  if (hashParam(window.location.hash, kind)) {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }
}

/** Ping other MoneyTracker tabs (e.g. after a planner link) so they reload trips. */
export const MONEY_CHANNEL = "money-tracker-sync";

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


/** Map planner spend hints to a Money expense category id when possible. */
export function categoryFromSpendHint(hint: string | undefined, categories: { id: string; kind: string; name: string; nameZh: string; theme?: string }[], fallback = ""): string {
  if (!hint) return fallback;
  const expense = categories.filter((c) => c.kind === "expense");
  const byId = (id: string) => expense.find((c) => c.id === id)?.id || "";
  const byRe = (...needles: RegExp[]) =>
    expense.find((c) => needles.some((re) => re.test(`${c.name} ${c.nameZh} ${c.id}`)))?.id || "";
  switch (hint) {
    case "meal":
      return byId("travel-meals") || byId("dining") || byRe(/旅途用餐|dining|飲食|就餐|餐飲|food/i) || fallback;
    case "ride":
      return byId("mtr") || byRe(/transit|交通|鐵路|地鐵|mtr|巴士|公車/i) || fallback;
    case "hotel":
      return byId("hotels") || byRe(/hotel|住宿|酒店/i) || fallback;
    case "sight":
      return byId("souvenirs") || byRe(/景點|門票|souvenir|觀光/i) || fallback;
    default:
      return fallback;
  }
}

export function asMoneyCurrency(code: string): MoneyUnit {
  return (CURRENCIES as string[]).includes(code) ? (code as Currency) : "HKD";
}
