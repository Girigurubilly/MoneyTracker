import type { Account, FxRate, TimeSaving, Transaction } from "../types.ts";
import { groupForType } from "../types.ts";
import { toHkd } from "./fx.ts";
import { applyDeltas, balanceDeltas } from "./ledger.ts";
import { depositsOutsideBalances } from "./deposits.ts";
import { todayISO } from "../format.ts";

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

export type WorthPoint = { date: string; net: number; assets: number; liab: number; flow: number };

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

/** Reconstruct net worth from posted income, expenses and transfers.
 *
 * Prefer frozen monthly snapshots for past months when available so the chart
 * is not presented as a pure back-solve of today's balances. The latest point
 * (today / current month) always uses live balances.
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
  const liveSnap = (date: string): WorthPoint => ({ date, ...netWorthNow(accs, rates, deposits, date), flow: 0 });
  const pointFor = (date: string, preferSnap: boolean): WorthPoint => {
    const ym = date.slice(0, 7);
    if (preferSnap && ym < currentYm) {
      const frozen = byMonth.get(ym);
      if (frozen) return { date, net: frozen.net, assets: frozen.assets, liab: frozen.liab, flow: 0 };
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
