import type { Account, Category } from "./types";

export type ApplePayDraft = {
  amount: number;
  currency: "HKD";
  payee: string;
  date: string;
  time?: string;
  cardHint: string;
  accountId?: string;
  categoryId?: string;
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

const SKIP = /狀態|已批核|總計|聯絡|報告|銀包|地圖|不正確|無法識別|尋求協助|提出爭議|使用「地圖」|改善準確|南區|香葉道|海洋奇觀|港島南岸|莎莎|Eco Trai|黃竹坑/;

function extractPayee(lines: string[]): string {
  const scored = lines
    .map((line, i) => {
      if (SKIP.test(line)) return { line, i, score: -99 };
      if (/HK\$|HKD\s*\d|信用卡|Credit Card|Visa|Mastercard|UnionPay/i.test(line)) return { line, i, score: -99 };
      if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line)) return { line, i, score: -99 };
      if (!/[\u4e00-\u9fffA-Za-z]/.test(line) || line.length < 3) return { line, i, score: -99 };
      let score = 1;
      if (/[A-Za-z]{3,}/.test(line)) score += 3;
      if (/\d{4,}/.test(line)) score += 2;
      if (/[,，]/.test(line) && /[\u4e00-\u9fff]/.test(line)) score += 3;
      if (i <= 4) score += 2;
      const dup = lines.filter((other) => other !== line && (other.includes(line) || line.includes(other.split(/[,，]/)[0].trim()))).length;
      if (dup) score += 2;
      return { line, i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const best = scored[0];
  if (!best) return "";
  const next = lines[best.i + 1];
  if (next && !SKIP.test(next) && /^[\u4e00-\u9fff]{2,12}$/.test(next) && !best.line.includes(next)) {
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

  const amountM = raw.match(/HK\$?\s*([0-9]{1,7}(?:\.[0-9]{1,2})?)/i) ?? raw.match(/HKD\s*([0-9]{1,7}(?:\.[0-9]{1,2})?)/i);
  const amount = amountM ? Number(amountM[1]) : 0;

  const dateM =
    raw.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s*(上午|下午)?\s*(\d{1,2})[:：](\d{2}))?/) ??
    raw.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?:\s*(上午|下午)?\s*(\d{1,2})[:：](\d{2}))?/);
  let date = "";
  let time: string | undefined;
  if (dateM) {
    if (dateM[1].length === 4) {
      date = `${dateM[1]}-${dateM[2].padStart(2, "0")}-${dateM[3].padStart(2, "0")}`;
      time = formatTime(dateM[4], dateM[5], dateM[6]);
    } else {
      date = `${dateM[3]}-${dateM[2].padStart(2, "0")}-${dateM[1].padStart(2, "0")}`;
      time = formatTime(dateM[4], dateM[5], dateM[6]);
    }
  }

  const payee = extractPayee(lines);

  const cardHint =
    lines.find((l) => /信用卡|Credit Card|Visa|Mastercard|UnionPay|滙豐|恒生|渣打|中銀|HSBC|Hang Seng/i.test(l) && !/聯絡|報告/.test(l)) ?? "";

  if (!amount && !payee) return null;
  return {
    amount,
    currency: "HKD",
    payee: payee.trim(),
    date,
    time,
    cardHint,
    accountId: matchAccount(cardHint, accounts),
    categoryId: guessCategory(payee, categories),
    raw,
  };
}

function formatTime(ampm?: string, hh?: string, mm?: string): string | undefined {
  if (!hh || !mm) return undefined;
  let h = Number(hh);
  if (ampm === "下午" && h < 12) h += 12;
  if (ampm === "上午" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${mm}`;
}

function guessCategory(merchant: string, categories: Category[]): string | undefined {
  const m = merchant.toLowerCase();
  const want = /park|ocean|海洋公園|娛樂/.test(m)
    ? ["entertainment"]
    : /餐|咖啡|cafe|dining/.test(m)
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
  const scored = accounts
    .filter((a) => !a.hidden)
    .map((a) => {
      const n = `${a.name} ${a.nameZh}`.toLowerCase();
      let score = 0;
      if (/hsbc|滙豐/.test(h) && /hsbc|滙豐/.test(n)) score += 3;
      if (/hang seng|恒生/.test(h) && /hang seng|恒生/.test(n)) score += 3;
      if (/standard chartered|渣打/.test(h) && /渣打|standard/.test(n)) score += 3;
      if (/boc|中銀|bank of china/.test(h) && /中銀|boc/.test(n)) score += 3;
      if (/red/.test(h) && /red/.test(n)) score += 2;
      if (/visa/.test(h) && /visa/.test(n)) score += 1;
      if (/master/.test(h) && /master/.test(n)) score += 1;
      if (/credit|信用卡/.test(h) && (a.type === "credit" || /credit|信用卡/.test(n))) score += 2;
      if (n && h.includes(n.replace(/\s+/g, ""))) score += 4;
      return { id: a.id, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score > 0 ? scored[0].id : accounts.find((a) => a.type === "credit" && !a.hidden)?.id;
}
