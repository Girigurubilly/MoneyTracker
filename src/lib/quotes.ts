import { yahooSymbol } from "./holdings.ts";
import type { HoldingMarket } from "./types.ts";

async function pull(url: string, ms = 8000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseYahooChart(text: string): number | undefined {
  try {
    const data = JSON.parse(text) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
    };
    const n = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof n === "number" && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

function parseStooq(text: string): number | undefined {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return undefined;
  const header = lines[0]!.split(",");
  const close = header.findIndex((h) => h.trim().toLowerCase() === "close");
  const cells = lines[1]!.split(",");
  const n = Number(cells[close >= 0 ? close : 6]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function quoteOne(market: HoldingMarket, symbol: string): Promise<number | undefined> {
  const y = yahooSymbol(market, symbol);
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=1d&range=1d`;
  try {
    const n = parseYahooChart(await pull(yahooUrl));
    if (n) return n;
  } catch {
    /* cors or network */
  }
  try {
    const n = parseYahooChart(await pull(`https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`, 12000));
    if (n) return n;
  } catch {
    /* proxy down */
  }
  const stooqSym = market === "hk" ? `${y.replace(".HK", "").replace(/^0+/, "") || "0"}.hk` : `${symbol.toLowerCase()}.us`;
  try {
    const n = parseStooq(await pull(`https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcv&h&e=csv`));
    if (n) return n;
  } catch {
    /* ignore */
  }
  return undefined;
}

export async function fetchHoldingPrices(
  rows: { market: HoldingMarket; symbol: string }[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const uniq = new Map<string, { market: HoldingMarket; symbol: string }>();
  for (const r of rows) uniq.set(`${r.market}:${r.symbol}`, r);
  const list = [...uniq.values()];
  const batch = 4;
  for (let i = 0; i < list.length; i += batch) {
    const slice = list.slice(i, i + batch);
    const got = await Promise.all(slice.map(async (r) => ({ r, n: await quoteOne(r.market, r.symbol) })));
    for (const { r, n } of got) {
      if (n) out.set(`${r.market}:${r.symbol}`, n);
    }
  }
  return out;
}
