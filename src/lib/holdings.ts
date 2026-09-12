import { convertAmount } from "./calc/fx.ts";
import type { Account, Currency, FxRate, Holding, HoldingMarket, HoldingSource } from "./types.ts";

export type ParsedHolding = Omit<Holding, "id">;

const SYMBOL_KEYS = ["symbol", "ticker", "代號", "股票代號", "code", "stock code", "underlying", "stock"];
const QTY_KEYS = ["quantity", "qty", "position", "shares", "股數", "持倉", "持倉數量", "數量", "持有"];
const PRICE_KEYS = ["mark price", "price", "last", "last price", "現價", "收市價", "市價", "最新價", "close"];
const NAME_KEYS = ["description", "name", "名稱", "股票名稱", "financial instrument", "listing"];
const CCY_KEYS = ["currency", "currencyprimary", "貨幣", "ccy"];
const VALUE_KEYS = ["position value", "market value", "市值", "value"];
const SKIP_SYMBOLS = new Set(["", "CASH", "USD", "HKD", "CNH", "CNY", "EUR", "GBP", "JPY", "TOTAL", "SYMBOL"]);

function norm(s: string): string {
  return s.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === "," || ch === "\t" || ch === ";") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((c) => c)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

function findCol(header: string[], aliases: string[]): number {
  const h = header.map(norm);
  for (const a of aliases) {
    const i = h.findIndex((x) => x === a || x.includes(a));
    if (i >= 0) return i;
  }
  return -1;
}

function detectSource(text: string): HoldingSource {
  const t = text.toLowerCase();
  if (t.includes("open positions") || t.includes("asset category") || t.includes("interactive brokers") || t.includes("conid") || t.includes("datadiscriminator")) return "ibkr";
  if (t.includes("aastocks") || t.includes("代號") || t.includes("持倉數量")) return "aastocks";
  return "manual";
}

export function detectMarket(symbol: string, currency?: string): HoldingMarket {
  const s = symbol.trim().toUpperCase();
  const core = s.replace(/\.HK$|\.HKG$|:HK$/i, "");
  if (/^\d{1,6}$/.test(core)) return "hk";
  if (currency === "HKD" && /^\d/.test(s)) return "hk";
  return "us";
}

export function normalizeSymbol(market: HoldingMarket, raw: string): string {
  let s = raw.trim().toUpperCase();
  s = s.replace(/^(SEHK|HKEX|NYSE|NASDAQ|AMEX)[:/]/, "");
  s = s.replace(/\.HK$|\.HKG$|:HK$|\.US$/, "");
  if (market === "hk") {
    const digits = s.replace(/\D/g, "").replace(/^0+/, "") || "0";
    return digits.padStart(4, "0");
  }
  return s.replace(/[^A-Z0-9.-]/g, "");
}

/** London-listed UCITS ETFs common on IBHK (Yahoo uses .L, not a US ticker). */
const LONDON_ETFS = new Set([
  "CSPX",
  "CSP1",
  "IWDA",
  "SWDA",
  "VWRA",
  "VWRP",
  "VUAA",
  "VUSA",
  "SWRD",
  "EIMI",
  "CNDX",
  "EQQQ",
  "ISF",
  "IUSA",
  "VWRL",
  "VHYL",
  "IUSN",
  "AGGU",
  "IGLN",
  "IDTL",
]);

export function isLondonEtf(symbol: string): boolean {
  const s = symbol.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
  const base = s.replace(/\.[A-Z]+$/, "");
  return s.endsWith(".L") || LONDON_ETFS.has(base);
}

export function yahooSymbol(market: HoldingMarket, symbol: string): string {
  const s = normalizeSymbol(market, symbol);
  if (market === "hk") return `${s}.HK`;
  if (s.endsWith(".L") || s.includes(".")) return s;
  if (LONDON_ETFS.has(s)) return `${s}.L`;
  return s;
}

export function yahooCandidates(market: HoldingMarket, symbol: string): string[] {
  const s = normalizeSymbol(market, symbol);
  const primary = yahooSymbol(market, symbol);
  if (market === "hk") return [primary];
  const extra = s.includes(".") ? [s, s.replace(/\.[A-Z]+$/, "")] : [s, `${s}.L`, `${s}.US`];
  return [...new Set([primary, ...extra])];
}

function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(String(raw).replace(/[, ]/g, "").replace(/%$/, ""));
  return Number.isFinite(n) ? n : 0;
}

function asCurrency(raw: string | undefined, market: HoldingMarket): Currency {
  const u = (raw ?? "").trim().toUpperCase();
  if (u === "USD" || u === "HKD" || u === "CNY" || u === "EUR" || u === "GBP" || u === "JPY" || u === "AUD" || u === "CAD" || u === "SGD" || u === "TWD") return u as Currency;
  return market === "hk" ? "HKD" : "USD";
}

export function parseHoldingsFile(text: string): { source: HoldingSource; rows: ParsedHolding[] } {
  const source = detectSource(text);
  const table = parseCsv(text);
  if (!table.length) return { source, rows: [] };
  let headerIdx = table.findIndex((r) => findCol(r, SYMBOL_KEYS) >= 0 && findCol(r, QTY_KEYS) >= 0);
  if (headerIdx < 0) headerIdx = table.findIndex((r) => findCol(r, SYMBOL_KEYS) >= 0);
  if (headerIdx < 0) return { source, rows: [] };
  const header = table[headerIdx]!;
  const iSym = findCol(header, SYMBOL_KEYS);
  const iQty = findCol(header, QTY_KEYS);
  const iPrice = findCol(header, PRICE_KEYS);
  const iName = findCol(header, NAME_KEYS);
  const iCcy = findCol(header, CCY_KEYS);
  const iVal = findCol(header, VALUE_KEYS);
  const rows: ParsedHolding[] = [];
  for (const r of table.slice(headerIdx + 1)) {
    if (r.some((c) => ["header", "total", "datadiscriminator", "subtotal"].includes(norm(c)))) continue;
    const rawSym = (r[iSym] ?? "").trim();
    if (!rawSym || SKIP_SYMBOLS.has(rawSym.toUpperCase())) continue;
    if (/^(open positions|asset category|financial)/i.test(rawSym)) continue;
    const ccyHint = iCcy >= 0 ? r[iCcy] : "";
    const market = detectMarket(rawSym, ccyHint);
    const symbol = normalizeSymbol(market, rawSym);
    if (!symbol) continue;
    const quantity = parseNum(iQty >= 0 ? r[iQty] : "0");
    if (!quantity) continue;
    let lastPrice = parseNum(iPrice >= 0 ? r[iPrice] : "0");
    const value = parseNum(iVal >= 0 ? r[iVal] : "0");
    if (!lastPrice && value && quantity) lastPrice = value / quantity;
    rows.push({
      symbol,
      name: (iName >= 0 ? r[iName] : "") || symbol,
      market,
      source,
      quantity,
      currency: asCurrency(ccyHint, market),
      lastPrice,
    });
  }
  const byKey = new Map<string, ParsedHolding>();
  for (const row of rows) {
    const k = `${row.market}:${row.symbol}`;
    const prev = byKey.get(k);
    if (!prev) byKey.set(k, row);
    else byKey.set(k, { ...prev, quantity: prev.quantity + row.quantity, lastPrice: row.lastPrice || prev.lastPrice });
  }
  return { source, rows: [...byKey.values()] };
}

export function mergeHoldings(existing: Holding[], incoming: ParsedHolding[], accountId?: string): Holding[] {
  const next = [...existing];
  for (const row of incoming) {
    const i = next.findIndex((h) => h.market === row.market && h.symbol === row.symbol);
    if (i >= 0) {
      const prev = next[i]!;
      next[i] = {
        ...prev,
        ...row,
        id: prev.id,
        name: row.name && row.name !== row.symbol ? row.name : prev.name,
        accountId: accountId ?? prev.accountId,
        lastPrice: row.lastPrice || prev.lastPrice,
        lastPriceAt: row.lastPrice ? new Date().toISOString() : prev.lastPriceAt,
      };
    } else {
      next.push({
        ...row,
        id: `h-${row.market}-${row.symbol}-${Math.random().toString(36).slice(2, 8)}`,
        accountId,
        lastPriceAt: row.lastPrice ? new Date().toISOString() : undefined,
      });
    }
  }
  return next;
}

export function holdingsForAccount(holdings: Holding[], account: Account): Holding[] {
  const assigned = holdings.filter((h) => h.accountId === account.id);
  if (assigned.length) return assigned;
  if (!account.stockBook) return [];
  const unassigned = holdings.filter((h) => !h.accountId);
  if (account.stockBook === "all") return unassigned;
  return unassigned.filter((h) => h.market === account.stockBook);
}

export function holdingMarketValue(h: Holding, accountCcy: Currency, rates: FxRate[]): number {
  return convertAmount(h.quantity * (h.lastPrice || 0), h.currency, accountCcy, rates);
}

export function accountHoldingValue(holdings: Holding[], account: Account, rates: FxRate[]): number {
  return holdingsForAccount(holdings, account).reduce((s, h) => s + holdingMarketValue(h, account.currency === "MILES" ? "HKD" : account.currency, rates), 0);
}

export function applyHoldingBalances(accounts: Account[], holdings: Holding[], rates: FxRate[]): Account[] {
  return accounts.map((a) => {
    if (a.type !== "investment" || a.holdingSync === false) return a;
    if (!a.stockBook && !holdings.some((h) => h.accountId === a.id)) return a;
    const value = accountHoldingValue(holdings, a, rates);
    if (Math.abs(value - a.balance) < 0.005) return a;
    return { ...a, balance: Math.round(value * 100) / 100 };
  });
}

export function sortHoldings<T extends { name: string; symbol: string }>(rows: T[]): T[] {
  return sortHoldingsBySymbol(rows, "asc");
}

export function sortHoldingsBySymbol<T extends { symbol: string }>(rows: T[], dir: "asc" | "desc"): T[] {
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => m * a.symbol.localeCompare(b.symbol, "en", { numeric: true }));
}

export function holdingTitle(h: { market: string; name: string; symbol: string }): string {
  if (h.market === "us") return h.symbol;
  return h.name && h.name !== h.symbol ? h.name : h.symbol;
}
