import { isLondonEtf, normalizeSymbol, yahooSymbol } from "./holdings.ts";
import type { HoldingMarket } from "./types.ts";

export type QuoteHit = { price: number; name?: string; prevClose?: number };

export function quoteKey(market: HoldingMarket, symbol: string): string {
  return `${market}:${normalizeSymbol(market, symbol)}`;
}

async function pull(url: string, ms = 4000): Promise<string> {
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

async function pullFirst(urls: string[], ms = 4000): Promise<string> {
  return await Promise.any(urls.map((u) => pull(u, ms)));
}

function tencentCode(market: HoldingMarket, symbol: string): string {
  const s = normalizeSymbol(market, symbol);
  const base = s.replace(/\.[A-Z]+$/, "");
  if (market === "hk") return `r_hk${s.padStart(5, "0")}`;
  if (isLondonEtf(s)) return `uk${base}`;
  if (s.includes(".")) return "";
  if (/^[A-Z]{1,5}$/.test(s)) return `us${s}`;
  return "";
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
    setTimeout(finish, 4000);
    document.head.appendChild(el);
  });
}

function parseYahooChart(text: string): { hit?: QuoteHit; closes: ClosePt[] } {
  try {
    const data = JSON.parse(text) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
          meta?: { symbol?: string; shortName?: string; regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number };
        }[];
      };
    };
    const r = data.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const closesRaw = r?.indicators?.quote?.[0]?.close ?? [];
    const closes: ClosePt[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closesRaw[i];
      if (typeof c === "number" && c > 0) closes.push({ date: new Date(ts[i]! * 1000).toISOString().slice(0, 10), close: c });
    }
    const price = r?.meta?.regularMarketPrice ?? closes[closes.length - 1]?.close;
    const prev = r?.meta?.previousClose ?? r?.meta?.chartPreviousClose ?? closes[closes.length - 2]?.close;
    const hit =
      typeof price === "number" && price > 0
        ? { price, name: r?.meta?.shortName, prevClose: typeof prev === "number" && prev > 0 ? prev : undefined }
        : undefined;
    return { hit, closes };
  } catch {
    return { closes: [] };
  }
}

function yahooChartUrls(symbol: string, range: string): string[] {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  return [u, `https://corsproxy.io/?${encodeURIComponent(u)}`];
}

async function yahooChart(symbol: string, range: string): Promise<{ hit?: QuoteHit; closes: ClosePt[] }> {
  try {
    return parseYahooChart(await pullFirst(yahooChartUrls(symbol, range), 4000));
  } catch {
    return { closes: [] };
  }
}

async function yahooCharts(symbols: string[], range: string): Promise<Map<string, QuoteHit>> {
  const out = new Map<string, QuoteHit>();
  const conc = 6;
  for (let i = 0; i < symbols.length; i += conc) {
    const slice = symbols.slice(i, i + conc);
    const got = await Promise.all(slice.map(async (s) => ({ s, ...(await yahooChart(s, range)) })));
    for (const row of got) {
      if (row.hit) out.set(row.s.toUpperCase(), row.hit);
    }
  }
  return out;
}

function parseEastmoney(text: string): { code: string; hit: QuoteHit }[] {
  try {
    const data = JSON.parse(text) as { data?: { diff?: { f2?: number; f12?: string; f14?: string; f18?: number }[] } };
    const out: { code: string; hit: QuoteHit }[] = [];
    for (const row of data.data?.diff ?? []) {
      const price = Number(row.f2);
      if (!(price > 0)) continue;
      out.push({
        code: String(row.f12 ?? "").toUpperCase(),
        hit: { price, name: row.f14, prevClose: Number(row.f18) || undefined },
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function eastmoneyHk(rows: { market: HoldingMarket; symbol: string }[]): Promise<Map<string, QuoteHit>> {
  const hk = rows.filter((r) => r.market === "hk");
  if (!hk.length) return new Map();
  const secids = hk.map((r) => `116.${normalizeSymbol(r.market, r.symbol).padStart(5, "0")}`).join(",");
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f12,f14,f18&secids=${encodeURIComponent(secids)}`;
  try {
    const hits = parseEastmoney(await pull(url, 4000));
    const byCode = new Map(hits.map((h) => [h.code, h.hit]));
    const out = new Map<string, QuoteHit>();
    for (const r of hk) {
      const s = normalizeSymbol(r.market, r.symbol);
      const hit = byCode.get(s) ?? byCode.get(s.padStart(5, "0")) ?? byCode.get(s.replace(/^0+/, ""));
      if (hit) out.set(quoteKey(r.market, r.symbol), hit);
    }
    return out;
  } catch {
    return new Map();
  }
}

export async function fetchHoldingQuotes(
  rows: { market: HoldingMarket; symbol: string }[],
): Promise<Map<string, QuoteHit>> {
  const uniq = new Map<string, { market: HoldingMarket; symbol: string }>();
  for (const r of rows) uniq.set(quoteKey(r.market, r.symbol), { market: r.market, symbol: normalizeSymbol(r.market, r.symbol) });
  const list = [...uniq.values()];
  const out = new Map<string, QuoteHit>();

  const codes = list.map((r) => tencentCode(r.market, r.symbol)).filter(Boolean);
  const tencent = await loadTencentScript(codes);
  for (const r of list) {
    const code = tencentCode(r.market, r.symbol);
    const hit = code ? tencent.get(code) : undefined;
    if (hit) out.set(quoteKey(r.market, r.symbol), hit);
  }

  const missing = list.filter((r) => !out.has(quoteKey(r.market, r.symbol)));
  if (missing.some((r) => r.market === "hk")) {
    const em = await eastmoneyHk(missing);
    for (const [k, v] of em) if (!out.has(k)) out.set(k, v);
  }

  const still = list.filter((r) => !out.has(quoteKey(r.market, r.symbol)));
  if (still.length) {
    const ymap = await yahooCharts(
      still.map((r) => yahooSymbol(r.market, r.symbol)),
      "5d",
    );
    for (const r of still) {
      const hit = ymap.get(yahooSymbol(r.market, r.symbol).toUpperCase());
      if (hit) out.set(quoteKey(r.market, r.symbol), hit);
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
  const { closes } = await yahooChart(y, yahooRange(range));
  if (closes.length) return closes;
  if (market !== "hk") return [];
  const s = normalizeSymbol(market, symbol);
  const em = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(`116.${s.padStart(5, "0")}`)}&klt=101&fqt=1&lmt=320&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58`;
  try {
    return parseEastKline(await pull(em, 4000));
  } catch {
    return [];
  }
}

const moveCache = new Map<string, { at: number; data: Map<string, PriceMove> }>();

export async function fetchHoldingMoves(
  rows: { market: HoldingMarket; symbol: string }[],
  range: PriceRange,
): Promise<Map<string, PriceMove>> {
  const uniq = new Map<string, { market: HoldingMarket; symbol: string }>();
  for (const r of rows) uniq.set(quoteKey(r.market, r.symbol), { market: r.market, symbol: normalizeSymbol(r.market, r.symbol) });
  const list = [...uniq.values()];
  const cacheKey = `${range}:${list.map((r) => quoteKey(r.market, r.symbol)).sort().join(",")}`;
  const cached = moveCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.data;

  const out = new Map<string, PriceMove>();
  const quotes = await fetchHoldingQuotes(list);
  for (const r of list) {
    const hit = quotes.get(quoteKey(r.market, r.symbol));
    if (!hit) continue;
    const start = hit.prevClose && hit.prevClose > 0 ? hit.prevClose : hit.price;
    out.set(quoteKey(r.market, r.symbol), {
      last: hit.price,
      start,
      change: hit.price - start,
      pct: start ? (hit.price - start) / start : 0,
      name: hit.name,
    });
  }

  if (range !== "1d") {
    const from = rangeStartIso(range);
    const missing = list;
    const conc = 6;
    for (let i = 0; i < missing.length; i += conc) {
      const slice = missing.slice(i, i + conc);
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
        const live = out.get(quoteKey(r.market, r.symbol))?.last ?? last;
        out.set(quoteKey(r.market, r.symbol), {
          last: live,
          start,
          change: live - start,
          pct: start ? (live - start) / start : 0,
        });
      }
    }
  }

  moveCache.set(cacheKey, { at: Date.now(), data: out });
  return out;
}
