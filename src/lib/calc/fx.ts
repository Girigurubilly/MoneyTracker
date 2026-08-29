import type { Currency, FxRate, MoneyUnit } from "../types.ts";

export function toHkd(amount: number, currency: MoneyUnit, rates: FxRate[], override?: number): number {
  if (currency === "MILES" || currency === "HKD") return amount;
  if (override && override > 0) return amount * override;
  const row = rates.find((r) => r.currency === currency);
  return amount * (row?.perHkd ?? 1);
}

export function parseFrankfurter(data: { date?: string; rates?: Record<string, number> }): FxRate[] {
  return parseHkdBaseRates(data.rates ?? {}, data.date ?? new Date().toISOString().slice(0, 10), "frankfurter.dev");
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

export function parseErApi(data: {
  time_last_update_utc?: string;
  time_last_update_unix?: number;
  date?: string;
  rates?: Record<string, number>;
}): FxRate[] {
  const asOf = data.date
    ?? (data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString().slice(0, 10) : undefined)
    ?? new Date().toISOString().slice(0, 10);
  return parseHkdBaseRates(data.rates ?? {}, asOf, "open.er-api.com");
}

function parseHkdBaseRates(rates: Record<string, number>, asOf: string, source: string): FxRate[] {
  const out: FxRate[] = [];
  for (const [currency, perUnit] of Object.entries(rates)) {
    if (!perUnit || currency === "HKD") continue;
    out.push({
      currency: currency as Currency,
      perHkd: 1 / perUnit,
      asOf,
      source,
    });
  }
  return out;
}

export function mergeRates(prev: FxRate[], next: FxRate[]): FxRate[] {
  const map = new Map(prev.map((r) => [r.currency, r]));
  for (const r of next) map.set(r.currency, r);
  return [...map.values()];
}

async function pullJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fx");
  return res.json();
}

export async function fetchLiveFx(current: FxRate[]): Promise<FxRate[]> {
  const frank = await pullJson("https://api.frankfurter.dev/v1/latest?from=HKD")
    .then((data) => parseFrankfurter(data as { date?: string; rates?: Record<string, number> }))
    .catch(() => []);
  const pulled =
    frank.length > 0
      ? frank
      : await pullJson("https://open.er-api.com/v6/latest/HKD")
          .then((data) => parseErApi(data as { time_last_update_utc?: string; rates?: Record<string, number> }))
          .catch(() => []);
  if (!pulled.length) throw new Error("fx");
  return mergeRates(current, pulled);
}