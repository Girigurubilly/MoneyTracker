import type { Currency, Locale, MoneyUnit } from "./types";

const PREFIX: Record<string, string> = {
  HKD: "HK$",
  USD: "US$",
  JPY: "¥",
  CNY: "CN¥",
  TWD: "NT$",
  GBP: "£",
  THB: "฿",
  EUR: "€",
  AUD: "A$",
  SGD: "S$",
  CHF: "CHF ",
  MOP: "MOP$",
  KRW: "₩",
  CAD: "C$",
  NZD: "NZ$",
  INR: "₹",
};

export function money(
  amount: number,
  currency: MoneyUnit = "HKD",
  opts: { sign?: boolean; compact?: boolean } = {},
): string {
  if (currency === "MILES") {
    const n = Math.round(amount).toLocaleString("en-HK");
    return opts.sign && amount > 0 ? `+${n}` : n;
  }
  const abs = Math.abs(amount);
  const decimals = currency === "JPY" || currency === "KRW" ? 0 : 2;
  let body: string;
  if (opts.compact && abs >= 1_000_000) {
    body = `${(abs / 1_000_000).toFixed(2)}M`;
  } else if (opts.compact && abs >= 10_000) {
    body = `${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  } else {
    body = abs.toLocaleString("en-HK", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  const prefix = PREFIX[currency] ?? `${currency} `;
  const signed =
    opts.sign === false
      ? `${prefix}${body}`
      : amount < 0
        ? `−${prefix}${body}`
        : opts.sign
          ? `+${prefix}${body}`
          : `${prefix}${body}`;
  return signed;
}

export function miles(n: number, locale: Locale): string {
  const v = Math.round(n).toLocaleString("en-HK");
  return locale === "zh-HK" ? `${v} 里` : `${v} miles`;
}

export function monthTitle(isoDate: string, locale: Locale): string {
  const d = parseISO(isoDate);
  if (locale === "zh-HK") {
    return `${d.getMonth() + 1}月 ${d.getFullYear()}`;
  }
  return d.toLocaleDateString("en-HK", { month: "long", year: "numeric" });
}

export function weekdayLabels(locale: Locale, firstDay: 0 | 1): string[] {
  const zh = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const src = locale === "zh-HK" ? zh : en;
  return firstDay === 1 ? [...src.slice(1), src[0]] : src;
}

export function dayCellLabel(day: number, locale: Locale): string {
  return locale === "zh-HK" ? `${day}日` : String(day);
}

export function shortDate(iso: string, locale: Locale): string {
  const d = parseISO(iso);
  if (locale === "zh-HK") {
    return `${d.getMonth() + 1}月 ${d.getDate()}`;
  }
  return d.toLocaleDateString("en-HK", { month: "short", day: "numeric" });
}

export function longDate(iso: string, locale: Locale): string {
  const d = parseISO(iso);
  if (locale === "zh-HK") {
    const weeks = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 週${weeks[d.getDay()]}`;
  }
  return d.toLocaleDateString("en-HK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function shiftMonth(iso: string, delta: number): string {
  const d = parseISO(iso);
  const day = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return toISO(next);
}

export function monthGrid(
  iso: string,
  firstDay: 0 | 1,
): ({ iso: string; day: number } | null)[] {
  const d = parseISO(iso);
  const y = d.getFullYear();
  const m = d.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const startWeekday = new Date(y, m, 1).getDay();
  let pad = startWeekday - firstDay;
  if (pad < 0) pad += 7;
  const cells: ({ iso: string; day: number } | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let day = 1; day <= last; day++) {
    cells.push({ iso: toISO(new Date(y, m, day)), day });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function ratePct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export const currencyMeta: Record<Currency, { label: string; labelZh: string }> = {
  HKD: { label: "Hong Kong Dollar", labelZh: "港元" },
  USD: { label: "US Dollar", labelZh: "美元" },
  JPY: { label: "Japanese Yen", labelZh: "日圓" },
  CNY: { label: "Chinese Yuan", labelZh: "人民幣" },
  TWD: { label: "New Taiwan Dollar", labelZh: "新台幣" },
  THB: { label: "Thai Baht", labelZh: "泰銖" },
  GBP: { label: "British Pound", labelZh: "英鎊" },
  EUR: { label: "Euro", labelZh: "歐元" },
  AUD: { label: "Australian Dollar", labelZh: "澳元" },
  SGD: { label: "Singapore Dollar", labelZh: "新加坡元" },
  CHF: { label: "Swiss Franc", labelZh: "瑞士法郎" },
  MOP: { label: "Macanese Pataca", labelZh: "澳門元" },
  KRW: { label: "Korean Won", labelZh: "韓圓" },
  CAD: { label: "Canadian Dollar", labelZh: "加元" },
  NZD: { label: "New Zealand Dollar", labelZh: "紐西蘭元" },
  INR: { label: "Indian Rupee", labelZh: "印度盧比" },
};
