import type { Account, FxRate } from "@/lib/types";
import { toHkd } from "./fx";
import { roundMoney } from "./ledger";

export function netWorthNow(accounts: Account[], rates: FxRate[]) {
  let assets = 0;
  let liab = 0;
  for (const a of accounts) {
    if (!a.includeInNetWorth || a.currency === "MILES") continue;
    const hkd = toHkd(a.balance, a.currency, rates);
    if (hkd >= 0) assets += hkd;
    else liab += -hkd;
  }
  return {
    assets: roundMoney(assets),
    liab: roundMoney(liab),
    net: roundMoney(assets - liab),
  };
}

export function investableNow(accounts: Account[], rates: FxRate[]) {
  let sum = 0;
  for (const a of accounts) {
    if (!a.includeInNetWorth || a.currency === "MILES") continue;
    if (a.type === "property" || a.type === "mortgage") continue;
    const hkd = toHkd(a.balance, a.currency, rates);
    if (hkd > 0) sum += hkd;
  }
  return roundMoney(sum);
}
