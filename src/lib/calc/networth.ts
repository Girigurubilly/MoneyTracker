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
