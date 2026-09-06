import type { Category } from "./types";

export type OctopusKind = "expense" | "topup";

export type OctopusDraft = {
  id: string;
  merchant: string;
  date: string;
  time?: string;
  amount: number;
  kind: OctopusKind;
  categoryId?: string;
  skip: boolean;
};

const SKIP_LINE =
  /餘額|交易紀錄|交易記錄|消費摘要|消費摘要|Main|HKD|選擇類型|^八達通$|記錄|摘要|^餘額/;

const DATE_RE = /(\d{4})[-/.年](\d{2})[-/.月](\d{2})日?(?:\s+(\d{2})[:：](\d{2}))?/;
const AMOUNT_RE = /(?:^|\s)([+＋\-−–—])\s*(\d{1,6}(?:[.,]\d{1,2})?)(?:\s|$)|(?:^|\s)(\d{1,6}[.,]\d{1,2})(?:\s|$)/;

function normalizeOcr(text: string): string {
  return text
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 48))
    .replace(/[：]/g, ":")
    .replace(/[．]/g, ".")
    .replace(/[，]/g, ",")
    .replace(/[－—–−]/g, "-")
    .replace(/[＋]/g, "+")
    .replace(/\u00a0/g, " ");
}

export const OCTOPUS_MERCHANTS = [
  "餐飲/會所",
  "港鐵",
  "九巴 / 龍運",
  "九巴",
  "龍運",
  "城巴",
  "新巴",
  "瑞幸咖啡香港運營有限公司",
  "瑞幸咖啡",
  "大快活",
  "百佳",
  "太興",
  "美心集團",
  "美心",
  "八達通卡有限公司",
  "大家樂",
  "麥當勞",
  "肯德基",
  "星巴克",
  "惠康",
  "萬寧",
  "7-Eleven",
  "便利店",
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : Math.min(prev + 1, dp[i] + 1, dp[i - 1] + 1);
      prev = tmp;
    }
  }
  return dp[m];
}

export function correctMerchant(raw: string, extra: string[] = []): string {
  const text = raw.replace(/\s+/g, "").replace(/[|]/g, "/");
  if (!text) return raw;
  const pool = [...OCTOPUS_MERCHANTS, ...extra];
  let best = raw;
  let score = Infinity;
  for (const name of pool) {
    const compact = name.replace(/\s+/g, "");
    if (text.includes(compact) || compact.includes(text)) return name;
    const d = levenshtein(text.slice(0, compact.length + 2), compact);
    const ratio = d / Math.max(compact.length, 1);
    if ((compact.length <= 3 && d <= 1) || (ratio < 0.34 && d < score)) {
      if (d < score) {
        score = d;
        best = name;
      }
    }
  }
  return best;
}

export function guessOctopusCategory(merchant: string, categories: Category[]): string | undefined {
  const m = merchant.toLowerCase();
  const rules: { re: RegExp; ids: string[] }[] = [
    { re: /港鐵|mtr|九巴|龍運|城巴|新巴|巴士|電車|tram|小巴|專線/, ids: ["mtr"] },
    { re: /餐飲|會所|大快活|太興|美心|咖啡|茶餐廳|mcdonald|麥當勞|kfc|肯德基|瑞幸|星巴克|大家樂|café|cafe|飲食/, ids: ["dining"] },
    { re: /百佳|惠康|超市|萬寧|屈臣|market|7-11|7eleven|便利/, ids: ["grocery", "shop"] },
  ];
  const want = rules.find((r) => r.re.test(m))?.ids ?? [];
  for (const id of want) {
    if (categories.some((c) => c.id === id && c.kind === "expense")) return id;
  }
  const byName = categories.find((c) => {
    if (c.kind !== "expense") return false;
    const n = `${c.name} ${c.nameZh}`.toLowerCase();
    return want.some((id) => n.includes(id)) || n.includes(merchant.slice(0, 2).toLowerCase());
  });
  return byName?.id ?? categories.find((c) => c.kind === "expense" && !c.parentId)?.id;
}

function isMerchant(line: string): boolean {
  if (!line) return false;
  if (SKIP_LINE.test(line)) return false;
  if (DATE_RE.test(line) && line.length < 22) return false;
  if (/^[-+]?[\d.,]+$/.test(line)) return false;
  return /[\u4e00-\u9fffA-Za-z]/.test(line);
}

function parseAmount(line: string): { sign: string; amount: number } | null {
  const m = line.replace(/,/g, "").replace(/HKD/gi, "").trim().match(AMOUNT_RE);
  if (!m) return null;
  const sign = m[1] === "+" ? "+" : m[1] ? "-" : "-";
  const raw = (m[2] ?? m[3] ?? "").replace(",", ".");
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return null;
  return { sign, amount };
}

export function parseOctopusText(text: string, categories: Category[]): OctopusDraft[] {
  const raw = normalizeOcr(text)
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const rows: OctopusDraft[] = [];

  function push(merchant: string, date: string, time: string | undefined, sign: string, amount: number) {
    if (amount === 0) return;
    const name = correctMerchant(merchant.replace(DATE_RE, "").replace(AMOUNT_RE, "").trim() || "八達通");
    const kind: OctopusKind = sign === "+" || /八達通卡有限公司|增值|自動增值/.test(name) ? "topup" : "expense";
    const key = `${date}|${time ?? ""}|${name}|${amount}|${kind}`;
    if (rows.some((r) => r.id === key)) return;
    rows.push({
      id: key,
      merchant: name,
      date,
      time,
      amount,
      kind,
      categoryId: kind === "expense" ? guessOctopusCategory(name, categories) : undefined,
      skip: false,
    });
  }

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const dateM = line.match(DATE_RE);
    const amtHere = parseAmount(line);
    if (dateM && amtHere) {
      const date = `${dateM[1]}-${dateM[2]}-${dateM[3]}`;
      const time = dateM[4] ? `${dateM[4]}:${dateM[5]}` : undefined;
      const prev = raw[i - 1] && isMerchant(raw[i - 1]) ? raw[i - 1] : line;
      push(prev, date, time, amtHere.sign, amtHere.amount);
      continue;
    }
    if (dateM) {
      const date = `${dateM[1]}-${dateM[2]}-${dateM[3]}`;
      const time = dateM[4] ? `${dateM[4]}:${dateM[5]}` : undefined;
      const prev = raw[i - 1] && isMerchant(raw[i - 1]) ? raw[i - 1] : "";
      const next = raw[i + 1] ? parseAmount(raw[i + 1]) : null;
      if (next) {
        push(prev || "八達通", date, time, next.sign, next.amount);
        i += 1;
      }
      continue;
    }
    if (amtHere && raw[i - 1]) {
      const prevDate = raw[i - 1].match(DATE_RE);
      const merch = raw[i - 2] && isMerchant(raw[i - 2]) ? raw[i - 2] : raw[i - 1];
      if (prevDate) {
        push(merch, `${prevDate[1]}-${prevDate[2]}-${prevDate[3]}`, prevDate[4] ? `${prevDate[4]}:${prevDate[5]}` : undefined, amtHere.sign, amtHere.amount);
      }
    }
  }
  return rows;
}

export type OcrBox = { text: string; x0: number; y0: number; x1: number; y1: number };

export function parseOctopusBoxes(boxes: OcrBox[], pageWidth: number, categories: Category[], extraMerchants: string[] = []): OctopusDraft[] {
  const items = boxes
    .map((b) => ({ ...b, text: normalizeOcr(b.text).replace(/\s+/g, " ").trim() }))
    .filter((b) => b.text && !SKIP_LINE.test(b.text));
  items.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const bands: OcrBox[][] = [];
  for (const item of items) {
    const last = bands.at(-1);
    const mid = (item.y0 + item.y1) / 2;
    if (last) {
      const ref = last.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / last.length;
      if (Math.abs(mid - ref) < 28) {
        last.push(item);
        continue;
      }
    }
    bands.push([item]);
  }

  type PartialRow = { merchant?: string; date?: string; time?: string; sign?: string; amount?: number };
  const parts: PartialRow[] = [];
  for (const band of bands) {
    const text = band.map((b) => b.text).join(" ");
    const dateM = text.match(DATE_RE);
    const amt = parseAmount(text) ?? band.filter((b) => b.x0 > pageWidth * 0.62).map((b) => parseAmount(b.text)).find(Boolean) ?? null;
    const left = band
      .filter((b) => b.x1 < pageWidth * 0.72)
      .map((b) => b.text)
      .filter((t) => isMerchant(t) && !DATE_RE.test(t))
      .join(" ");
    const row: PartialRow = {};
    if (left) row.merchant = correctMerchant(left, extraMerchants);
    if (dateM) {
      row.date = `${dateM[1]}-${dateM[2]}-${dateM[3]}`;
      row.time = dateM[4] ? `${dateM[4]}:${dateM[5]}` : undefined;
    }
    if (amt) {
      row.sign = amt.sign;
      row.amount = amt.amount;
    }
    if (row.merchant || row.date || row.amount != null) parts.push(row);
  }

  const rows: OctopusDraft[] = [];
  for (let i = 0; i < parts.length; i++) {
    const cur = parts[i];
    const next = parts[i + 1];
    const prev = parts[i - 1];
    const merchant = cur.merchant || prev?.merchant;
    const date = cur.date || next?.date || prev?.date;
    const time = cur.time || next?.time || prev?.time;
    const amount = cur.amount ?? next?.amount;
    const sign = cur.sign ?? next?.sign ?? "-";
    if (!merchant || amount == null || amount === 0) continue;
    const kind: OctopusKind = sign === "+" || /八達通卡有限公司|增值|自動增值/.test(merchant) ? "topup" : "expense";
    const key = `${date ?? ""}|${time ?? ""}|${merchant}|${amount}|${kind}`;
    if (rows.some((r) => r.id === key)) continue;
    rows.push({
      id: key,
      merchant,
      date: date ?? "",
      time,
      amount,
      kind,
      categoryId: kind === "expense" ? guessOctopusCategory(merchant, categories) : undefined,
      skip: false,
    });
  }
  return rows;
}

export function mergeOctopusDrafts(...lists: OctopusDraft[][]): OctopusDraft[] {
  const out: OctopusDraft[] = [];
  for (const list of lists) {
    for (const row of list) {
      const same = out.find((r) => r.date === row.date && r.time === row.time && Math.abs(r.amount - row.amount) < 0.001);
      if (same) {
        if (same.merchant.length < row.merchant.length) same.merchant = row.merchant;
        continue;
      }
      out.push({ ...row });
    }
  }
  return out;
}

const SETTINGS_KEY = "hk-life-money-octopus";

export type OctopusSettings = {
  accountId?: string;
  fromAccountId?: string;
};

export function readOctopusSettings(): OctopusSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as OctopusSettings;
  } catch {
    return {};
  }
}

export function writeOctopusSettings(next: OctopusSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function suggestOctopusAccountId(accounts: { id: string; name: string; nameZh: string; type: string }[]): string | undefined {
  return accounts.find((a) => /八達通|octopus/i.test(`${a.name}${a.nameZh}`))?.id
    ?? accounts.find((a) => a.type === "ewallet")?.id;
}
