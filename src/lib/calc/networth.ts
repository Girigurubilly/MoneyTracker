import type { Account, FxRate, TimeSaving, Transaction } from "../types.ts";
import { groupForType } from "../types.ts";
import { toHkd } from "./fx.ts";
import { applyDeltas, balanceDeltas, cashflowSide } from "./ledger.ts";
import { depositsOutsideBalances } from "./deposits.ts";
import { todayISO } from "../format.ts";
import { inPeriod } from "./period.ts";

export function countsInNetWorth(a: Account): boolean {
  if (a.currency === "MILES" || a.type === "miles") return false;
  if (groupForType(a.type) === "cash") return true;
  return Boolean(a.includeInNetWorth);
}

function outsideDepositHkd(accounts: Account[], rates: FxRate[], deposits: TimeSaving[], asOf: string): number {
  const cover = accounts.map((a) => (a.hidden ? { ...a, hidden: false } : a));
  return depositsOutsideBalances(deposits, cover, rates, asOf).reduce((sum, row) => sum + Math.max(0, toHkd(row.amount, row.currency, rates)), 0);
}

export function netWorthNow(
  accounts: Account[],
  rates: FxRate[],
  deposits: TimeSaving[] = [],
  asOf = todayISO(),
): { assets: number; liab: number; net: number } {
  let assets = 0;
  let liab = 0;
  for (const a of accounts) {
    if (!countsInNetWorth(a)) continue;
    const hkd = toHkd(a.balance, a.currency, rates);
    if (hkd >= 0) assets += hkd;
    else liab += -hkd;
  }
  assets += outsideDepositHkd(accounts, rates, deposits, asOf);
  return { assets, liab, net: assets - liab };
}

export type WorthRow = {
  id: string;
  label: string;
  labelZh: string;
  group: Account["group"];
  type: Account["type"];
  amount: number;
  accounts: Account[];
};

export function netWorthBreakdown(
  accounts: Account[],
  rates: FxRate[],
  deposits: TimeSaving[] = [],
  asOf = todayISO(),
): { assets: WorthRow[]; liabilities: WorthRow[] } {
  const assetMap = new Map<string, WorthRow>();
  const liabMap = new Map<string, WorthRow>();
  for (const a of accounts) {
    if (!countsInNetWorth(a)) continue;
    const hkd = toHkd(a.balance, a.currency, rates);
    if (hkd === 0) continue;
    const side = hkd >= 0 ? assetMap : liabMap;
    const key = `${a.group}:${a.type}`;
    const row = side.get(key) ?? {
      id: key,
      label: a.name,
      labelZh: a.nameZh || a.name,
      group: a.group,
      type: a.type,
      amount: 0,
      accounts: [],
    };
    row.amount += Math.abs(hkd);
    row.accounts.push(a);
    side.set(key, row);
  }
  const extra = outsideDepositHkd(accounts, rates, deposits, asOf);
  if (extra > 0) {
    assetMap.set("deposits", {
      id: "deposits",
      label: "Time deposits",
      labelZh: "定期存款",
      group: "cash",
      type: "savings",
      amount: extra,
      accounts: [],
    });
  }
  const sort = (a: WorthRow, b: WorthRow) => b.amount - a.amount;
  return {
    assets: [...assetMap.values()].sort(sort),
    liabilities: [...liabMap.values()].sort(sort),
  };
}

/** Liquid / investable assets: property and the linked mortgage are excluded (PRD). */
export function investableNow(accounts: Account[], rates: FxRate[], deposits: TimeSaving[] = [], asOf = todayISO()): number {
  let n = 0;
  for (const a of accounts) {
    if (!countsInNetWorth(a)) continue;
    if (a.type === "property" || a.type === "mortgage") continue;
    n += toHkd(a.balance, a.currency, rates);
  }
  return n + outsideDepositHkd(accounts, rates, deposits, asOf);
}

export type WorthPointSource = "snapshot" | "reconstructed" | "live";

export type WorthPoint = {
  date: string;
  net: number;
  assets: number;
  liab: number;
  /** Δ net vs previous point (not posted cash flow). */
  flow: number;
  source: WorthPointSource;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
}

function shiftYm(ym: string, dir: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function cloneAccounts(accounts: Account[]): Account[] {
  return accounts.map((a) => ({ ...a }));
}

export type WorthSnapshot = { month: string; net: number; assets: number; liab: number };

/** Posted income − spend-like outflows in [from, to]. Plain transfers ignored. */
export function periodPostedCashflow(
  txs: Transaction[],
  rates: FxRate[],
  from: string,
  to: string,
): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.planned) continue;
    if (!inPeriod(tx.date, from, to)) continue;
    const side = cashflowSide(tx);
    if (side === "none") continue;
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    if (side === "income") income += hkd;
    else expense += hkd;
  }
  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    net: Math.round((income - expense) * 100) / 100,
  };
}

export type WorthMove = {
  from: WorthPoint;
  to: WorthPoint;
  deltaNet: number;
  deltaAssets: number;
  deltaLiab: number;
};

/** Largest |Δ net| between adjacent points (skips the opening point's zero flow). */
export function largestWorthMove(points: WorthPoint[]): WorthMove | null {
  let best: WorthMove | null = null;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const deltaNet = Math.round((to.net - from.net) * 100) / 100;
    const move: WorthMove = {
      from,
      to,
      deltaNet,
      deltaAssets: Math.round((to.assets - from.assets) * 100) / 100,
      deltaLiab: Math.round((to.liab - from.liab) * 100) / 100,
    };
    if (!best || Math.abs(move.deltaNet) > Math.abs(best.deltaNet)) best = move;
  }
  return best;
}

export function worthMoveIsCliff(move: WorthMove | null, lastNet: number): boolean {
  if (!move) return false;
  const floor = Math.max(100_000, Math.abs(lastNet) * 0.02);
  return Math.abs(move.deltaNet) >= floor;
}

/** Reconstruct net worth from posted income, expenses and transfers.
 *
 * Prefer frozen monthly snapshots for past months when available so the chart
 * is not presented as a pure back-solve of today's balances. The latest point
 * (today / current month) always uses live balances. Each point carries a
 * `source` so the UI can flag snapshot vs reconstructed vs live.
 */
export function periodNetWorthPoints(
  accounts: Account[],
  txs: Transaction[],
  rates: FxRate[],
  from: string,
  to: string,
  deposits: TimeSaving[] = [],
  snapshots: WorthSnapshot[] = [],
): WorthPoint[] {
  const today = todayISO();
  const end = to > today ? today : to;
  const start = from > end ? end : from;
  const currentYm = today.slice(0, 7);
  const byMonth = new Map(snapshots.map((s) => [s.month, s]));
  let accs = cloneAccounts(accounts);
  const posted = txs
    .filter((t) => !t.planned && (t.type === "income" || t.type === "expense" || t.type === "transfer"))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  for (const tx of posted) {
    if (tx.date > end) accs = applyDeltas(accs, balanceDeltas(tx, accs, rates), -1);
  }
  const span = (Date.parse(`${end}T12:00:00`) - Date.parse(`${start}T12:00:00`)) / 86_400_000;
  const points: WorthPoint[] = [];
  const tagLive = (date: string): WorthPointSource => (date >= today ? "live" : "reconstructed");
  const liveSnap = (date: string): WorthPoint => ({
    date,
    ...netWorthNow(accs, rates, deposits, date),
    flow: 0,
    source: tagLive(date),
  });
  const pointFor = (date: string, preferSnap: boolean): WorthPoint => {
    const ym = date.slice(0, 7);
    if (preferSnap && ym < currentYm) {
      const frozen = byMonth.get(ym);
      if (frozen) return { date, net: frozen.net, assets: frozen.assets, liab: frozen.liab, flow: 0, source: "snapshot" };
    }
    return liveSnap(date);
  };
  if (span <= 62) {
    const byDay = new Map<string, Transaction[]>();
    for (const tx of posted) {
      if (tx.date < start || tx.date > end) continue;
      const list = byDay.get(tx.date) ?? [];
      list.push(tx);
      byDay.set(tx.date, list);
    }
    for (let d = end; d >= start; d = addDays(d, -1)) {
      // Daily series stays live so intra-month flow matches the ledger.
      points.push(liveSnap(d));
      for (const tx of byDay.get(d) ?? []) accs = applyDeltas(accs, balanceDeltas(tx, accs, rates), -1);
    }
  } else {
    const startYm = start.slice(0, 7);
    let ym = end.slice(0, 7);
    while (ym >= startYm) {
      const sample = ym === end.slice(0, 7) ? end : monthEnd(ym);
      if (sample >= start) points.push(pointFor(sample, ym !== currentYm));
      for (const tx of posted) {
        if (!tx.date.startsWith(ym) || tx.date < start || tx.date > end) continue;
        accs = applyDeltas(accs, balanceDeltas(tx, accs, rates), -1);
      }
      ym = shiftYm(ym, -1);
    }
  }
  points.push(pointFor(addDays(start, -1), true));
  const ordered = points.reverse();
  return ordered.map((p, i) => ({
    ...p,
    flow: i === 0 ? 0 : Math.round((p.net - ordered[i - 1].net) * 100) / 100,
  }));
}
