import type { Currency, FxRate, MoneyUnit } from "@/lib/types";
import { CURRENCIES } from "@/lib/types";

export function rateToHkd(
  currency: MoneyUnit,
  rates: FxRate[],
  override?: number,
): number {
  if (currency === "MILES") return 0;
  if (currency === "HKD") return 1;
  if (override && override > 0) return override;
  return rates.find((r) => r.currency === currency)?.perHkd ?? 1;
}

export function toHkd(
  amount: number,
  currency: MoneyUnit,
  rates: FxRate[],
  override?: number,
): number {
  return amount * rateToHkd(currency, rates, override);
}

export function parseFrankfurter(json: {
  date?: string;
  rates?: Record<string, number>;
}): FxRate[] {
  const asOf = json.date ?? new Date().toISOString().slice(0, 10);
  const rates = json.rates ?? {};
  const out: FxRate[] = [{ currency: "HKD", perHkd: 1, asOf, source: "Base" }];
  for (const c of CURRENCIES) {
    if (c === "HKD") continue;
    const hkdPerUnit = rates[c];
    if (!hkdPerUnit) continue;
    out.push({
      currency: c,
      perHkd: 1 / hkdPerUnit,
      asOf,
      source: "Frankfurter",
    });
  }
  return out;
}
