import type { Account, Category } from "./types";

export type ApplePayDraft = {
  id: string;
  amount: number;
  currency: "HKD";
  payee: string;
  date: string;
  time?: string;
  cardHint: string;
  accountId?: string;
  categoryId?: string;
  skip: boolean;
  raw: string;
};

function normalize(text: string): string {
  return text
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 48))
    .replace(/[：]/g, ":")
    .replace(/[．]/g, ".")
    .replace(/[，]/g, ",")
    .replace(/[＄$]/g, "$")
    .replace(/\u00a0/g, " ");
}

const SKIP = /狀態|已批核|總計|聯絡|報告|銀包|地圖|不正確|無法識別|尋求協助|提出爭議|使用「地圖」|改善準確|南區|香葉道|海洋奇觀|港島南岸|莎莎|Eco|黃竹坑|DONKI|廣東道|健身徑|滾球|科學館|富豪|龍堡|華嫂|加連威|彌敦|山林道|支賬|交易詳情|商戶類別|聲明|僅供參考|以上資訊|信用卡組織|^由$|^簡述$/;

const MAP_JUNK = /DONKI|Apple\s|廣東道|健身徑|滾球|科學館|富豪|龍堡|華嫂|國際$/;
const DATE_OR_TIME = /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|上午|下午|\d{4}\s*年/;

function parseMoney(text: string): number {
  const m = text.match(/HK\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i)
    ?? text.match(/HKD\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i);
  if (!m) return 0;
  return Number(m[1].replace(/,/g, ""));
}

function cjkCount(s: string): number {
  return (s.match(/[\u4e00-\u9fff]/g) ?? []).length;
}

function formatTime(ampm?: string, hh?: string, mm?: string): string | undefined {
  if (!hh || !mm) return undefined;
  let h = Number(hh);
  if (ampm === "下午" && h < 12) h += 12;
  if (ampm === "上午" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${mm}`;
}

function parseDate(raw: string): { date: string; time?: string } {
  const cn = raw.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (cn) return { date: `${cn[1]}-${cn[2].padStart(2, "0")}-${cn[3].padStart(2, "0")}` };
  const dateM =
    raw.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s*(上午|下午)?\s*(\d{1,2})[:：](\d{2}))?/) ??
    raw.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?:\s*(上午|下午)?\s*(\d{1,2})[:：](\d{2}))?/);
  if (!dateM) return { date: "" };
  if (dateM[1].length === 4) {
    return { date: `${dateM[1]}-${dateM[2].padStart(2, "0")}-${dateM[3].padStart(2, "0")}`, time: formatTime(dateM[4], dateM[5], dateM[6]) };
  }
  return { date: `${dateM[3]}-${dateM[2].padStart(2, "0")}-${dateM[1].padStart(2, "0")}`, time: formatTime(dateM[4], dateM[5], dateM[6]) };
}

function extractPayee(lines: string[]): string {
  const briefIdx = lines.findIndex((l) => l === "簡述");
  if (briefIdx >= 0) {
    const next = lines.slice(briefIdx + 1).find((l) => !SKIP.test(l) && /[A-Za-z\u4e00-\u9fff]/.test(l) && !DATE_OR_TIME.test(l));
    if (next) return next.replace(/\s+/g, " ").trim();
  }
  const amountIdx = lines.findIndex((l) => /HK\$|HKD/i.test(l));
  const hasCjk = lines.some((l) => cjkCount(l) >= 3);
  const scored = lines
    .map((line, i) => {
      if (SKIP.test(line) || MAP_JUNK.test(line)) return { line, i, score: -99 };
      if (/HK\$|HKD\s*\d|信用卡|Credit Card|Visa|Mastercard|UnionPay|萬事達|國泰/i.test(line)) return { line, i, score: -99 };
      if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line) || DATE_OR_TIME.test(line)) return { line, i, score: -99 };
      if (!/[\u4e00-\u9fffA-Za-z]/.test(line) || line.length < 2) return { line, i, score: -99 };
      if (hasCjk && cjkCount(line) === 0) return { line, i, score: -99 };
      let score = 1 + cjkCount(line);
      if (/[\u4e00-\u9fff]{3,}/.test(line)) score += 6;
      if (/飯店|餐廳|火鍋|茶|咖啡|超市|商場|公園|Park|店/.test(line)) score += 4;
      if (/[,，]/.test(line) && /[\u4e00-\u9fff]/.test(line)) score += 4;
      if (amountIdx >= 0 && i === amountIdx + 1) score += 6;
      if (amountIdx >= 0 && i > amountIdx && i <= amountIdx + 3) score += 2;
      const stem = line.split(/[,，]/)[0].trim();
      if (stem.length >= 3 && lines.some((other, j) => j !== i && other.includes(stem))) score += 3;
      return { line, i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const best = scored[0];
  if (!best) return "";
  const next = lines[best.i + 1];
  if (
    next &&
    !SKIP.test(next) &&
    !MAP_JUNK.test(next) &&
    !DATE_OR_TIME.test(next) &&
    cjkCount(next) >= 2 &&
    !best.line.includes(next)
  ) {
    return `${best.line}, ${next}`;
  }
  return best.line;
}

export function parseApplePayText(text: string, accounts: Account[], categories: Category[]): ApplePayDraft | null {
  const raw = normalize(text);
  const lines = raw
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const amount = parseMoney(raw);
  const { date, time } = parseDate(raw);
  const payee = extractPayee(lines);
  const categoryHint = lines.find((l) => /商戶類別|Lodging|Hotels|Utilities|Telecommunication|住宿|電訊|公用/.test(l)) ?? "";
  const cardHint =
    lines.find((l) => /信用卡|Credit Card|Visa|Mastercard|萬事達|國泰|渣打|UnionPay|滙豐|恒生|中銀|HSBC|Hang Seng|Standard Chartered|\*\d{4}/i.test(l) && !/聯絡|報告/.test(l)) ?? "";

  if (!amount && !payee) return null;
  return {
    id: `${date}|${payee}|${amount}`,
    amount,
    currency: "HKD",
    payee: payee.trim(),
    date,
    time,
    cardHint,
    accountId: matchAccount(cardHint, accounts),
    categoryId: guessCategory(`${payee} ${categoryHint}`, categories),
    skip: false,
    raw,
  };
}

function guessCategory(merchant: string, categories: Category[]): string | undefined {
  const m = merchant.toLowerCase();
  const want = /hotel|lodging|住宿|度假|motel|resort/.test(m)
    ? ["hotels"]
    : /telecom|電訊|寬頻|流動|hutchison|autopay|utilities|公用/.test(m)
      ? ["internet"]
      : /park|ocean|海洋公園|娛樂/.test(m)
        ? ["entertainment"]
        : /飯店|火鍋|餐廳|餐|咖啡|cafe|dining/.test(m)
          ? ["dining"]
          : /mtr|港鐵|巴士/.test(m)
            ? ["mtr"]
            : [];
  for (const id of want) {
    if (categories.some((c) => c.id === id)) return id;
  }
  return categories.find((c) => c.kind === "expense" && !c.parentId)?.id;
}

export function matchAccount(hint: string, accounts: Account[]): string | undefined {
  if (!hint) return undefined;
  const h = hint.toLowerCase();
  const last4 = hint.match(/\*(\d{4})/)?.[1];
  const scored = accounts
    .filter((a) => !a.hidden)
    .map((a) => {
      const n = `${a.name} ${a.nameZh}`.toLowerCase();
      let score = 0;
      if (/hsbc|滙豐/.test(h) && /hsbc|滙豐/.test(n)) score += 3;
      if (/hang seng|恒生/.test(h) && /hang seng|恒生/.test(n)) score += 3;
      if (/standard chartered|渣打/.test(h) && /渣打|standard/.test(n)) score += 3;
      if (/國泰|cathay/.test(h) && /國泰|cathay/.test(n)) score += 4;
      if (/萬事達|mastercard/.test(h) && /萬事達|master/.test(n)) score += 2;
      if (/boc|中銀|bank of china/.test(h) && /中銀|boc/.test(n)) score += 3;
      if (/red/.test(h) && /red/.test(n)) score += 2;
      if (/visa/.test(h) && /visa/.test(n)) score += 1;
      if (/credit|信用卡|萬事達卡/.test(h) && (a.type === "credit" || /credit|信用卡/.test(n))) score += 2;
      if (last4 && n.includes(last4)) score += 3;
      if (n && h.includes(n.replace(/\s+/g, ""))) score += 4;
      return { id: a.id, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score > 0 ? scored[0].id : accounts.find((a) => a.type === "credit" && !a.hidden)?.id;
}
