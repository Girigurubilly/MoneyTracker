import { normalizeSymbol, yahooSymbol } from "./holdings.ts";
import type { HoldingMarket } from "./types.ts";

export type QuoteHit = { price: number; name?: string; prevClose?: number };

function keyOf(market: HoldingMarket, symbol: string): string {
  return `${market}:${normalizeSymbol(market, symbol)}`;
}

async function pull(url: string, ms = 9000): Promise<string> {
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

function tencentCode(market: HoldingMarket, symbol: string): string {
  const s = normalizeSymbol(market, symbol);
  if (market === "hk") return `r_hk${s.padStart(5, "0")}`;
  return `us${s}`;
}

function parseTencentPayload(raw: string): QuoteHit | undefined {
  const p = raw.replace(/^"|"$/g, "").split("~");
  const name = (p[1] ?? "").trim();
  const price = Number(p[3]);
  if (!(price > 0)) return undefined;
  const prev = Number(p[4]);
  return {
    price,
    name: name && name !== "0" ? name : undefined,
    prevClose: prev > 0 ? prev : undefined,
  };
}

function loadTencentScript(codes: string[]): Promise<Map<string, QuoteHit>> {
  if (typeof document === "undefined" || !codes.length) return Promise.resolve(new Map());
  return new Promise((resolve) => {
    const el = document.createElement("script");
    el.charset = "gbk";
    el.src = `https://qt.gtimg.cn/q=${codes.join(",")}`;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const out = new Map<string, QuoteHit>();
      const w = window as unknown as Record<string, unknown>;
      for (const c of codes) {
        const val = w[`v_${c}`];
        if (typeof val === "string") {
          const hit = parseTencentPayload(val);
          if (hit) out.set(c, hit);
        }
        try {
          delete w[`v_${c}`];
        } catch {
          /* ignore */
        }
      }
      el.remove();
      resolve(out);
    };
    el.onload = finish;
    el.onerror = () => {
      el.remove();
      resolve(new Map());
    };
    setTimeout(finish, 9000);
    document.head.appendChild(el);
  });
}

function parseYahooQuote(text: string): Map<string, QuoteHit> {
  const out = new Map<string, QuoteHit>();
  try {
    const data = JSON.parse(text) as {
      quoteResponse?: {
        result?: { symbol?: string; shortName?: string; longName?: string; regularMarketPrice?: number; regularMarketPreviousClose?: number }[];
      };
      chart?: { result?: { meta?: { symbol?: string; shortName?: string; regularMarketPrice?: number; previousClose?: number; instrumentName?: string } }[] };
    };
    for (const row of data.quoteResponse?.result ?? []) {
      const price = row.regularMarketPrice;
      if (!(typeof price === "number" && price > 0) || !row.symbol) continue;
      out.set(row.symbol.toUpperCase(), {
        price,
        name: row.shortName || row.longName,
        prevClose: row.regularMarketPreviousClose,
      });
    }
    const meta = data.chart?.result?.[0]?.meta;
    if (meta?.symbol && typeof meta.regularMarketPrice === "number" && meta.regularMarketPrice > 0) {
      out.set(meta.symbol.toUpperCase(), {
        price: meta.regularMarketPrice,
        name: meta.shortName || meta.instrumentName,
        prevClose: meta.previousClose,
      });
    }
  } catch {
    /* ignore */
  }
  return out;
}

async function yahooBatch(symbols: string[]): Promise<Map<string, QuoteHit>> {
  if (!symbols.length) return new Map();
  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}&fields=shortName,longName,regularMarketPrice,regularMarketPreviousClose,symbol`;
  const urls = [
    yahooUrl,
    `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`,
  ];
  for (const url of urls) {
    try {
      const map = parseYahooQuote(await pull(url, 10000));
      if (map.size) return map;
    } catch {
      /* try next */
    }
  }
  return new Map();
}

function parseEastmoney(text: string): QuoteHit[] {
  try {
    const data = JSON.parse(text) as { data?: { diff?: { f2?: number; f12?: string; f14?: string; f18?: number }[] } };
    const out: QuoteHit[] = [];
    for (const row of data.data?.diff ?? []) {
      const price = Number(row.f2);
      if (!(price > 0)) continue;
      out.push({ price, name: row.f14, prevClose: Number(row.f18) || undefined });
    }
    return out;
  } catch {
    return [];
  }
}

async function eastmoneyBatch(rows: { market: HoldingMarket; symbol: string }[]): Promise<Map<string, QuoteHit>> {
  const secids = rows
    .map((r) => {
      const s = normalizeSymbol(r.market, r.symbol);
      if (r.market === "hk") return `116.${s.padStart(5, "0")}`;
      return `105.${s}`;
    })
    .join(",");
  if (!secids) return new Map();
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f12,f14,f18&secids=${encodeURIComponent(secids)}`;
  try {
    const hits = parseEastmoney(await pull(url));
    const out = new Map<string, QuoteHit>();
    rows.forEach((r, i) => {
      const hit = hits[i];
      if (hit) out.set(keyOf(r.market, r.symbol), hit);
    });
    if (out.size) return out;
  } catch {
    /* ignore */
  }
  return new Map();
}

export async function fetchHoldingQuotes(
  rows: { market: HoldingMarket; symbol: string }[],
): Promise<Map<string, QuoteHit>> {
  const uniq = new Map<string, { market: HoldingMarket; symbol: string }>();
  for (const r of rows) uniq.set(keyOf(r.market, r.symbol), { market: r.market, symbol: normalizeSymbol(r.market, r.symbol) });
  const list = [...uniq.values()];
  const out = new Map<string, QuoteHit>();

  const codes = list.map((r) => tencentCode(r.market, r.symbol));
  const tencent = await loadTencentScript(codes);
  for (const r of list) {
    const hit = tencent.get(tencentCode(r.market, r.symbol));
    if (hit) out.set(keyOf(r.market, r.symbol), hit);
  }

  const missing = list.filter((r) => !out.has(keyOf(r.market, r.symbol)));
  if (missing.length) {
    const em = await eastmoneyBatch(missing);
    for (const [k, v] of em) if (!out.has(k)) out.set(k, v);
  }

  const still = list.filter((r) => !out.has(keyOf(r.market, r.symbol)));
  if (still.length) {
    const ymap = await yahooBatch(still.map((r) => yahooSymbol(r.market, r.symbol)));
    for (const r of still) {
      const hit = ymap.get(yahooSymbol(r.market, r.symbol).toUpperCase()) ?? ymap.get(r.symbol.toUpperCase());
      if (hit) out.set(keyOf(r.market, r.symbol), hit);
    }
  }

  return out;
}

export async function fetchHoldingPrices(rows: { market: HoldingMarket; symbol: string }[]): Promise<Map<string, number>> {
  const quotes = await fetchHoldingQuotes(rows);
  const out = new Map<string, number>();
  for (const [k, v] of quotes) out.set(k, v.price);
  return out;
}

export type PriceRange = "1d" | "1w" | "1m" | "3m" | "6m" | "1y" | "ytd";

export type PriceMove = { last: number; start: number; change: number; pct: number; name?: string };

export function rangeStartIso(range: PriceRange, today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (range === "1d") d.setDate(d.getDate() - 1);
  else if (range === "1w") d.setDate(d.getDate() - 7);
  else if (range === "1m") d.setMonth(d.getMonth() - 1);
  else if (range === "3m") d.setMonth(d.getMonth() - 3);
  else if (range === "6m") d.setMonth(d.getMonth() - 6);
  else if (range === "1y") d.setFullYear(d.getFullYear() - 1);
  else d.setMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

function yahooRange(range: PriceRange): string {
  if (range === "1d") return "5d";
  if (range === "1w") return "1mo";
  if (range === "1m") return "3mo";
  if (range === "3m") return "6mo";
  if (range === "6m" || range === "ytd") return "1y";
  return "2y";
}

type ClosePt = { date: string; close: number };

function parseYahooCloses(text: string): ClosePt[] {
  try {
    const data = JSON.parse(text) as {
      chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
    };
    const r = data.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const closes = r?.indicators?.quote?.[0]?.close ?? [];
    const out: ClosePt[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (typeof c === "number" && c > 0) {
        out.push({ date: new Date(ts[i]! * 1000).toISOString().slice(0, 10), close: c });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function parseEastKline(text: string): ClosePt[] {
  try {
    const data = JSON.parse(text) as { data?: { klines?: string[] } };
    const out: ClosePt[] = [];
    for (const line of data.data?.klines ?? []) {
      const [date, , close] = line.split(",");
      const n = Number(close);
      if (date && n > 0) out.push({ date, close: n });
    }
    return out;
  } catch {
    return [];
  }
}

function closeOnOrBefore(points: ClosePt[], iso: string): number | undefined {
  let last: number | undefined;
  for (const p of points) {
    if (p.date <= iso) last = p.close;
    else break;
  }
  return last ?? points[0]?.close;
}

async function historyFor(market: HoldingMarket, symbol: string, range: PriceRange): Promise<ClosePt[]> {
  const y = yahooSymbol(market, symbol);
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=1d&range=${yahooRange(range)}`;
  for (const url of [yahooUrl, `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`, `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`]) {
    try {
      const pts = parseYahooCloses(await pull(url, 10000));
      if (pts.length) return pts;
    } catch {
      /* next */
    }
  }
  const s = normalizeSymbol(market, symbol);
  const secid = market === "hk" ? `116.${s.padStart(5, "0")}` : `105.${s}`;
  const em = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&klt=101&fqt=1&lmt=320&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58`;
  try {
    const pts = parseEastKline(await pull(em, 10000));
    if (pts.length) return pts;
  } catch {
    /* ignore */
  }
  return [];
}

export async function fetchHoldingMoves(
  rows: { market: HoldingMarket; symbol: string }[],
  range: PriceRange,
): Promise<Map<string, PriceMove>> {
  const out = new Map<string, PriceMove>();
  const uniq = new Map<string, { market: HoldingMarket; symbol: string }>();
  for (const r of rows) uniq.set(keyOf(r.market, r.symbol), { market: r.market, symbol: normalizeSymbol(r.market, r.symbol) });
  const list = [...uniq.values()];

  if (range === "1d") {
    const quotes = await fetchHoldingQuotes(list);
    for (const r of list) {
      const hit = quotes.get(keyOf(r.market, r.symbol));
      if (!hit) continue;
      const start = hit.prevClose && hit.prevClose > 0 ? hit.prevClose : hit.price;
      out.set(keyOf(r.market, r.symbol), {
        last: hit.price,
        start,
        change: hit.price - start,
        pct: start ? (hit.price - start) / start : 0,
        name: hit.name,
      });
    }
    return out;
  }

  const from = rangeStartIso(range);
  const batch = 3;
  for (let i = 0; i < list.length; i += batch) {
    const slice = list.slice(i, i + batch);
    const got = await Promise.all(
      slice.map(async (r) => {
        const pts = await historyFor(r.market, r.symbol, range);
        const last = pts[pts.length - 1]?.close;
        const start = last != null ? closeOnOrBefore(pts, from) : undefined;
        return { r, last, start };
      }),
    );
    for (const { r, last, start } of got) {
      if (!last || !start) continue;
      out.set(keyOf(r.market, r.symbol), {
        last,
        start,
        change: last - start,
        pct: start ? (last - start) / start : 0,
      });
    }
  }
  return out;
}
