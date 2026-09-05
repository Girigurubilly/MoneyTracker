import type { Account, FxRate } from "../types.ts";
import { toHkd } from "./fx.ts";

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
