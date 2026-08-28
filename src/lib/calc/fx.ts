import type { Currency, FxRate, MoneyUnit } from "../types.ts";
import { CURRENCIES } from "../types.ts";

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

/** Frankfurter `from=HKD` quotes units of C per 1 HKD. Convert to HKD per 1 C. */
export function parseFrankfurter(json: {
  date?: string;
  rates?: Record<string, number>;
}): FxRate[] {
  return parseHkdQuote(json, "Frankfurter");
}

export function parseHkdQuote(
  json: { date?: string; time_last_update_utc?: string; rates?: Record<string, number> },
  source: string,
): FxRate[] {
  const asOf =
    json.date ??
    (json.time_last_update_utc
      ? new Date(json.time_last_update_utc).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10));
  const rates = json.rates ?? {};
  const out: FxRate[] = [{ currency: "HKD", perHkd: 1, asOf, source: "Base" }];
  for (const c of CURRENCIES) {
    if (c === "HKD") continue;
    const unitsPerHkd = rates[c];
    if (!unitsPerHkd || unitsPerHkd <= 0) continue;
    out.push({
      currency: c,
      perHkd: 1 / unitsPerHkd,
      asOf,
      source,
    });
  }
  return out;
}

/** Frankfurter `from=EUR` cross: 1 C in HKD = HKD-per-EUR / C-per-EUR. */
export function parseEurCross(json: { date?: string; rates?: Record<string, number> }): FxRate[] {
  const rates = json.rates ?? {};
  const hkdPerEur = rates.HKD;
  if (!hkdPerEur || hkdPerEur <= 0) return [];
  const asOf = json.date ?? new Date().toISOString().slice(0, 10);
  const out: FxRate[] = [{ currency: "HKD", perHkd: 1, asOf, source: "Base" }];
  for (const c of CURRENCIES) {
    if (c === "HKD") continue;
    if (c === "EUR") {
      out.push({ currency: c, perHkd: hkdPerEur, asOf, source: "Frankfurter" });
      continue;
    }
    const unitsPerEur = rates[c];
    if (!unitsPerEur || unitsPerEur <= 0) continue;
    out.push({
      currency: c,
      perHkd: hkdPerEur / unitsPerEur,
      asOf,
      source: "Frankfurter",
    });
  }
  return out;
}

export function mergeRates(prev: FxRate[], next: FxRate[]): FxRate[] {
  const map = new Map<Currency, FxRate>();
  for (const r of prev) map.set(r.currency, r);
  for (const r of next) map.set(r.currency, r);
  const asOf = next.find((r) => r.currency === "HKD")?.asOf ?? next[0]?.asOf;
  map.set("HKD", { currency: "HKD", perHkd: 1, asOf: asOf ?? new Date().toISOString().slice(0, 10), source: "Base" });
  return CURRENCIES.map((c) => map.get(c)).filter((r): r is FxRate => Boolean(r));
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`fx ${res.status}`);
  return res.json();
}

export async function fetchLiveFx(prev: FxRate[]): Promise<FxRate[]> {
  try {
    const json = (await fetchJson("https://api.frankfurter.dev/v1/latest?from=HKD")) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const rows = parseHkdQuote(json, "Frankfurter");
    if (rows.length > 1) return mergeRates(prev, rows);
  } catch {
    /* try EUR cross */
  }
  try {
    const json = (await fetchJson("https://api.frankfurter.dev/v1/latest?from=EUR")) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const rows = parseEurCross(json);
    if (rows.length > 1) return mergeRates(prev, rows);
  } catch {
    /* try open ER */
  }
  const json = (await fetchJson("https://open.er-api.com/v6/latest/HKD")) as {
    result?: string;
    time_last_update_utc?: string;
    rates?: Record<string, number>;
  };
  if (json.result && json.result !== "success") throw new Error("fx");
  const rows = parseHkdQuote(json, "ExchangeRate-API");
  if (rows.length <= 1) throw new Error("fx");
  return mergeRates(prev, rows);
}
