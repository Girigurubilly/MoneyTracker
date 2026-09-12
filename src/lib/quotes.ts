import { normalizeSymbol, yahooSymbol } from "./holdings.ts";
import type { HoldingMarket } from "./types.ts";

export type QuoteHit = { price: number; name?: string };

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
  return { price, name: name && name !== "0" ? name : undefined };
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
        result?: { symbol?: string; shortName?: string; longName?: string; regularMarketPrice?: number }[];
      };
      chart?: { result?: { meta?: { symbol?: string; shortName?: string; regularMarketPrice?: number; instrumentName?: string } }[] };
    };
    for (const row of data.quoteResponse?.result ?? []) {
      const price = row.regularMarketPrice;
      if (!(typeof price === "number" && price > 0) || !row.symbol) continue;
      out.set(row.symbol.toUpperCase(), { price, name: row.shortName || row.longName });
    }
    const meta = data.chart?.result?.[0]?.meta;
    if (meta?.symbol && typeof meta.regularMarketPrice === "number" && meta.regularMarketPrice > 0) {
      out.set(meta.symbol.toUpperCase(), { price: meta.regularMarketPrice, name: meta.shortName || meta.instrumentName });
    }
  } catch {
    /* ignore */
  }
  return out;
}

async function yahooBatch(symbols: string[]): Promise<Map<string, QuoteHit>> {
  if (!symbols.length) return new Map();
  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}&fields=shortName,longName,regularMarketPrice,symbol`;
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
    const data = JSON.parse(text) as { data?: { diff?: { f2?: number; f12?: string; f14?: string }[] } };
    const out: QuoteHit[] = [];
    for (const row of data.data?.diff ?? []) {
      const price = Number(row.f2);
      if (!(price > 0)) continue;
      out.push({ price, name: row.f14 });
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
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f12,f14&secids=${encodeURIComponent(secids)}`;
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

/** @deprecated price-only wrapper */
export async function fetchHoldingPrices(rows: { market: HoldingMarket; symbol: string }[]): Promise<Map<string, number>> {
  const quotes = await fetchHoldingQuotes(rows);
  const out = new Map<string, number>();
  for (const [k, v] of quotes) out.set(k, v.price);
  return out;
}
