import type { Account, FxRate, Transaction } from "../types.ts";
import { toHkd } from "./fx.ts";
import { applyDeltas, balanceDeltas } from "./ledger.ts";
import { todayISO } from "../format.ts";

export function netWorthNow(accounts: Account[], rates: FxRate[]): { assets: number; liab: number; net: number } {
  let assets = 0;
  let liab = 0;
  for (const a of accounts) {
    if (!a.includeInNetWorth || a.currency === "MILES") continue;
    const hkd = toHkd(a.balance, a.currency, rates);
    if (hkd >= 0) assets += hkd;
    else liab += -hkd;
  }
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

export function netWorthBreakdown(accounts: Account[], rates: FxRate[]): { assets: WorthRow[]; liabilities: WorthRow[] } {
  const assetMap = new Map<string, WorthRow>();
  const liabMap = new Map<string, WorthRow>();
  for (const a of accounts) {
    if (!a.includeInNetWorth || a.currency === "MILES") continue;
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
  const sort = (a: WorthRow, b: WorthRow) => b.amount - a.amount;
  return {
    assets: [...assetMap.values()].sort(sort),
    liabilities: [...liabMap.values()].sort(sort),
  };
}

/** Liquid / investable assets: property and the linked mortgage are excluded (PRD). */
export function investableNow(accounts: Account[], rates: FxRate[]): number {
  let n = 0;
  for (const a of accounts) {
    if (!a.includeInNetWorth || a.currency === "MILES") continue;
    if (a.type === "property" || a.type === "mortgage") continue;
    n += toHkd(a.balance, a.currency, rates);
  }
  return n;
}

export type WorthPoint = { date: string; net: number; assets: number; liab: number };

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

/** Reconstruct net worth at each day (short range) or month-end (longer range) by reversing posted txs. */
export function periodNetWorthPoints(
  accounts: Account[],
  txs: Transaction[],
  rates: FxRate[],
  from: string,
  to: string,
): WorthPoint[] {
  const today = todayISO();
  const end = to > today ? today : to;
  const start = from > end ? end : from;
  let accs = cloneAccounts(accounts);
  const posted = txs
    .filter((t) => !t.planned && t.type !== "miles")
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  for (const tx of posted) {
    if (tx.date > end) accs = applyDeltas(accs, balanceDeltas(tx, accs, rates), -1);
  }
  const span = (Date.parse(`${end}T12:00:00`) - Date.parse(`${start}T12:00:00`)) / 86_400_000;
  const points: WorthPoint[] = [];
  if (span <= 62) {
    const byDay = new Map<string, Transaction[]>();
    for (const tx of posted) {
      if (tx.date < start || tx.date > end) continue;
      const list = byDay.get(tx.date) ?? [];
      list.push(tx);
      byDay.set(tx.date, list);
    }
    for (let d = end; d >= start; d = addDays(d, -1)) {
      points.push({ date: d, ...netWorthNow(accs, rates) });
      for (const tx of byDay.get(d) ?? []) accs = applyDeltas(accs, balanceDeltas(tx, accs, rates), -1);
    }
  } else {
    const startYm = start.slice(0, 7);
    let ym = end.slice(0, 7);
    while (ym >= startYm) {
      const sample = ym === end.slice(0, 7) ? end : monthEnd(ym);
      points.push({ date: sample, ...netWorthNow(accs, rates) });
      for (const tx of posted) {
        if (!tx.date.startsWith(ym) || tx.date < start || tx.date > end) continue;
        accs = applyDeltas(accs, balanceDeltas(tx, accs, rates), -1);
      }
      ym = shiftYm(ym, -1);
    }
  }
  return points.reverse();
}
