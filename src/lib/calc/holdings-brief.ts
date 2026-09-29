import { listingOf } from "../holdings.ts";
import type { Account, FxRate, Holding } from "../types.ts";
import { toHkd } from "./fx.ts";

export type HoldingsBriefRow = {
  listing: string;
  symbol: string;
  name: string;
  quantity: number;
  currency: string;
  lastPrice: number;
  pricedAt: string;
  avgCost: number | null;
  valueNative: number;
  valueHkd: number;
  costHkd: number | null;
  gainHkd: number | null;
  gainPct: number | null;
  weight: number;
  account: string;
};

export type HoldingsBrief = {
  asOf: string;
  rows: HoldingsBriefRow[];
  totalHkd: number;
  costHkd: number | null;
  gainHkd: number | null;
  missingPrice: number;
  stalePrice: number;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function accountName(accounts: Account[], id?: string): string {
  if (!id) return "";
  return accounts.find((a) => a.id === id)?.name ?? "";
}

export function buildHoldingsBrief(input: {
  today: string;
  holdings: Holding[];
  accounts: Account[];
  rates: FxRate[];
}): HoldingsBrief {
  const valued = input.holdings.map((h) => {
    const valueNative = h.quantity * (h.lastPrice || 0);
    const valueHkd = toHkd(valueNative, h.currency, input.rates);
    const costNative = h.avgCost != null && h.avgCost > 0 ? h.quantity * h.avgCost : null;
    const costHkd = costNative == null ? null : toHkd(costNative, h.currency, input.rates);
    return { h, valueNative, valueHkd, costHkd };
  });
  const totalHkd = valued.reduce((s, r) => s + r.valueHkd, 0);
  const costs = valued.filter((r) => r.costHkd != null);
  const costHkd = costs.length ? costs.reduce((s, r) => s + (r.costHkd ?? 0), 0) : null;
  const gainOnCost = costs.length ? costs.reduce((s, r) => s + (r.valueHkd - (r.costHkd ?? 0)), 0) : null;
  const rows: HoldingsBriefRow[] = valued
    .map(({ h, valueNative, valueHkd, costHkd: cost }) => ({
      listing: listingOf(h),
      symbol: h.symbol,
      name: h.name || h.symbol,
      quantity: h.quantity,
      currency: h.currency,
      lastPrice: h.lastPrice || 0,
      pricedAt: h.lastPriceAt ?? "",
      avgCost: h.avgCost ?? null,
      valueNative: round(valueNative),
      valueHkd: round(valueHkd),
      costHkd: cost == null ? null : round(cost),
      gainHkd: cost == null ? null : round(valueHkd - cost),
      gainPct: cost == null || cost === 0 ? null : (valueHkd - cost) / cost,
      weight: totalHkd > 0 ? valueHkd / totalHkd : 0,
      account: accountName(input.accounts, h.accountId),
    }))
    .sort((a, b) => b.valueHkd - a.valueHkd);
  const missingPrice = input.holdings.filter((h) => !h.lastPrice).length;
  const stalePrice = input.holdings.filter((h) => h.lastPrice && (!h.lastPriceAt || h.lastPriceAt.slice(0, 10) !== input.today)).length;
  return {
    asOf: input.today,
    rows,
    totalHkd: round(totalHkd),
    costHkd: costHkd == null ? null : round(costHkd),
    gainHkd: gainOnCost == null ? null : round(gainOnCost),
    missingPrice,
    stalePrice,
  };
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function csv(s: string): string {
  const t = s.replace(/"/g, "'");
  return /[,\n]/.test(t) ? `"${t}"` : t;
}

function sumBy(rows: HoldingsBriefRow[], key: (r: HoldingsBriefRow) => string): { key: string; hkd: number; weight: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(key(r), (map.get(key(r)) ?? 0) + r.valueHkd);
  const total = rows.reduce((s, r) => s + r.valueHkd, 0);
  return [...map.entries()]
    .map(([k, hkd]) => ({ key: k, hkd: round(hkd), weight: total > 0 ? hkd / total : 0 }))
    .sort((a, b) => b.hkd - a.hkd);
}

export function renderHoldingsBriefMarkdown(b: HoldingsBrief): string {
  const lines = [
    "# HK Life Money — stock holdings brief",
    `As of: ${b.asOf}`,
    "",
    "## Snapshot",
    `- Positions: ${b.rows.length}`,
    `- Market value (HKD): ${Math.round(b.totalHkd)}`,
    `- Cost basis known (HKD): ${b.costHkd == null ? "not recorded" : Math.round(b.costHkd)}`,
    `- Unrealised result on known cost (HKD): ${b.gainHkd == null ? "n/a" : Math.round(b.gainHkd)}`,
    `- Missing last price: ${b.missingPrice}`,
    `- Last price not from today: ${b.stalePrice}`,
    "",
    "## By listing",
    "listing,value_hkd,weight",
    ...sumBy(b.rows, (r) => r.listing).map((r) => `${r.key},${Math.round(r.hkd)},${pct(r.weight)}`),
    "",
    "## By price currency",
    "currency,value_hkd,weight",
    ...sumBy(b.rows, (r) => r.currency).map((r) => `${r.key},${Math.round(r.hkd)},${pct(r.weight)}`),
    "",
    "## Positions",
    "listing,symbol,name,quantity,currency,last_price,priced_at,avg_cost,value_native,value_hkd,cost_hkd,gain_hkd,gain_pct,weight,account",
    ...(b.rows.length
      ? b.rows.map((r) =>
          [
            r.listing,
            r.symbol,
            csv(r.name),
            r.quantity,
            r.currency,
            r.lastPrice,
            r.pricedAt,
            r.avgCost ?? "",
            r.valueNative,
            Math.round(r.valueHkd),
            r.costHkd == null ? "" : Math.round(r.costHkd),
            r.gainHkd == null ? "" : Math.round(r.gainHkd),
            r.gainPct == null ? "" : pct(r.gainPct),
            pct(r.weight),
            csv(r.account),
          ].join(","),
        )
      : ["(none)"]),
    "",
    "## How to use with an LLM",
    "Paste this file on its own, or with the asset-status and retirement briefs. Ask for: (1) concentration and single-name risk, (2) currency mix (HKD / USD / GBP) and whether the listing currency matches the economic exposure, (3) overlap between HK, US and LSE ETFs, (4) unrealised gain or loss where cost is known, (5) what is missing (no price, stale price, no cost). Figures are a snapshot from this device, not advice.",
  ];
  return lines.join("\n");
}
