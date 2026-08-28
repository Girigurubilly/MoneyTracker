import type { Currency, FxRate, MoneyUnit } from "../types.ts";

export function toHkd(amount: number, currency: MoneyUnit, rates: FxRate[], override?: number): number {
  if (currency === "MILES" || currency === "HKD") return amount;
  if (override && override > 0) return amount * override;
  const row = rates.find((r) => r.currency === currency);
  return amount * (row?.perHkd ?? 1);
}

export function parseFrankfurter(data: { date?: string; rates?: Record<string, number> }): FxRate[] {
  const asOf = data.date ?? new Date().toISOString().slice(0, 10);
  const rates = data.rates ?? {};
  const out: FxRate[] = [];
  for (const [currency, perUnit] of Object.entries(rates)) {
    if (!perUnit) continue;
    out.push({
      currency: currency as Currency,
      perHkd: 1 / perUnit,
      asOf,
      source: "frankfurter.dev",
    });
  }
  return out;
}

export function parseEurCross(data: { date?: string; rates?: Record<string, number> }): FxRate[] {
  const asOf = data.date ?? new Date().toISOString().slice(0, 10);
  const hkd = data.rates?.HKD;
  if (!hkd) return [];
  const out: FxRate[] = [];
  for (const [currency, eur] of Object.entries(data.rates ?? {})) {
    if (currency === "HKD" || !eur) continue;
    out.push({
      currency: currency as Currency,
      perHkd: hkd / eur,
      asOf,
      source: "frankfurter.dev",
    });
  }
  return out;
}

export function mergeRates(prev: FxRate[], next: FxRate[]): FxRate[] {
  const map = new Map(prev.map((r) => [r.currency, r]));
  for (const r of next) map.set(r.currency, r);
  return [...map.values()];
}

export async function fetchLiveFx(current: FxRate[]): Promise<FxRate[]> {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?from=HKD");
    if (!res.ok) throw new Error("fx");
    const data = (await res.json()) as { date?: string; rates?: Record<string, number> };
    return mergeRates(current, parseFrankfurter(data));
  } catch {
    return current;
  }
}
