import type { Account, FxRate } from "../types";
import { toHkd } from "./fx";

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
