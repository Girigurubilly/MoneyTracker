import type { Locale, MoneyUnit } from "@/lib/types";

/** Calendar day on the phone clock (system timezone), never UTC. */
export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function clockNow(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** A planned row is due once its date and time have arrived. No time means the start of that day. */
export function plannedIsDue(date: string, time: string | undefined, now = new Date()): boolean {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return false;
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime() <= now.getTime();
}

const ZH_WEEK = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const EN_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function whenDayLabel(iso: string, today: string, locale: "en" | "zh-HK"): string {
  if (iso === today) return locale === "zh-HK" ? "今天" : "Today";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const week = locale === "zh-HK" ? ZH_WEEK[date.getDay()] : EN_WEEK[date.getDay()];
  return locale === "zh-HK" ? `${m}月${d}日 ${week}` : `${d} ${EN_WEEK[date.getDay()]} ${m}`;
}

export function whenStamp(iso: string, time: string, locale: "en" | "zh-HK"): string {
  const [y, m, d] = iso.split("-");
  const [H, M] = time.split(":").map(Number);
  const hour = Number.isFinite(H) ? H : 0;
  const minute = Number.isFinite(M) ? M : 0;
  const h12 = hour % 12 || 12;
  const mm = String(minute).padStart(2, "0");
  if (locale === "zh-HK") {
    const ap = hour < 12 ? "上午" : "下午";
    return `${Number(d)}/${Number(m)}/${y} ${ap}${h12}:${mm}`;
  }
  const ap = hour < 12 ? "AM" : "PM";
  return `${Number(d)}/${Number(m)}/${y} ${h12}:${mm} ${ap}`;
}

export function to12h(time: string): { ap: 0 | 1; hour: number; minute: number } {
  const [H, M] = time.split(":").map(Number);
  const hour24 = Number.isFinite(H) ? H : 0;
  return { ap: hour24 < 12 ? 0 : 1, hour: hour24 % 12 || 12, minute: Number.isFinite(M) ? M : 0 };
}

export function from12h(ap: 0 | 1, hour: number, minute: number): string {
  const h12 = Math.min(12, Math.max(1, hour));
  const hour24 = ap === 0 ? h12 % 12 : (h12 % 12) + 12;
  return `${String(hour24).padStart(2, "0")}:${String(Math.min(59, Math.max(0, minute))).padStart(2, "0")}`;
}

export function money(
  amount: number,
  unit: MoneyUnit = "HKD",
  opts?: { sign?: boolean },
): string {
  if (unit === "MILES") {
    const n = Math.abs(Math.round(amount)).toLocaleString("en-HK");
    if (amount < 0) return `−${n}`;
    return opts?.sign && amount > 0 ? `+${n}` : n;
  }
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: unit === "HKD" ? "HKD" : unit,
    minimumFractionDigits: unit === "JPY" || unit === "KRW" ? 0 : 2,
    maximumFractionDigits: unit === "JPY" || unit === "KRW" ? 0 : 2,
  }).format(abs);
  if (opts?.sign) {
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `−${formatted}`;
  }
  if (amount < 0 && !opts?.sign) return `−${formatted}`;
  return formatted;
}

const AMOUNT_UNIT: Record<string, string> = {
  HKD: "HK$",
  USD: "US$",
  CNY: "CN¥",
  JPY: "JP¥",
  GBP: "£",
  EUR: "€",
  TWD: "NT$",
  SGD: "S$",
  AUD: "A$",
  MOP: "MOP$",
  THB: "฿",
  CHF: "CHF",
  KRW: "₩",
  CAD: "C$",
  NZD: "NZ$",
  INR: "₹",
};

function groupDigits(raw: string): string {
  const neg = raw.startsWith("-");
  const body = neg ? raw.slice(1) : raw;
  const keepDot = body.endsWith(".");
  const [int, frac] = body.split(".");
  const grouped = (int || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const tail = frac ? `.${frac}` : keepDot ? "." : "";
  return `${neg ? "-" : ""}${grouped}${tail}`;
}

/** Thousands separators while typing. Plain numbers also show the currency. */
export function formatTypingAmount(raw: string | undefined, currency = "HKD"): string {
  const unit = AMOUNT_UNIT[currency] ?? (currency === "MILES" ? "" : currency);
  const s = (raw ?? "").replace(/,/g, "").trim();
  const rest = s.startsWith("-") ? s.slice(1) : s;
  const expr = /[+\-*/]/.test(rest);
  if (!s || s === "-" || s === "0") return unit ? `0 / ${unit}` : "0";
  if (expr) return s.replace(/\d*\.?\d+/g, (n) => (n ? groupDigits(n) : n));
  const shown = groupDigits(s);
  return unit ? `${shown} / ${unit}` : shown;
}

export function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

export function compactHkd(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}HK$${(abs / 1_000_000).toFixed(2)}M`;
  return money(amount, "HKD");
}


export function dateRangeLabel(start: string, end: string, locale: Locale): string {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  if (!ys || !ms || !ds || !ye || !me || !de) return `${start} → ${end}`;
  if (locale === "zh-HK") {
    if (ys === ye) return `${ms}月${ds}日 → ${me}月${de}日`;
    return `${ys}年${ms}月${ds}日 → ${ye}年${me}月${de}日`;
  }
  if (ys === ye) return `${ds}/${ms} → ${de}/${me}`;
  return `${ds}/${ms}/${ys} → ${de}/${me}/${ye}`;
}

export function shortDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  if (locale === "zh-HK") return `${y}年${m}月${d}日`;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function mdLabel(iso: string, locale: Locale): string {
  const [, m, d] = iso.split("-").map(Number);
  if (locale === "zh-HK") return `${m}月 ${d}`;
  return `${m}/${d}`;
}

export function milesLabel(n: number, locale: Locale): string {
  const v = Math.round(n).toLocaleString("en-HK");
  return locale === "zh-HK" ? `${v} 里` : `${v} miles`;
}

export function monthTitle(iso: string, locale: Locale): string {
  const [y, m] = iso.split("-").map(Number);
  if (locale === "zh-HK") return `${m}月 ${y}`;
  return new Date(y, m - 1, 1).toLocaleDateString("en-HK", { month: "short", year: "numeric" });
}

export function longDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (locale === "zh-HK") {
    const wk = ["日", "一", "二", "三", "四", "五", "六"][dt.getDay()];
    return `${y}年${m}月${d}日 週${wk}`;
  }
  return dt.toLocaleDateString("en-HK", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export function shiftMonth(iso: string, dir: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + dir, Math.min(d, 28));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function weekdayLabels(locale: Locale, firstDay: 0 | 1): string[] {
  const zh = ["日", "一", "二", "三", "四", "五", "六"];
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const src = locale === "zh-HK" ? zh : en;
  return firstDay === 1 ? [...src.slice(1), src[0]] : src;
}

export function monthGrid(iso: string, firstDay: 0 | 1): ({ iso: string; day: number } | null)[] {
  const [y, m] = iso.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0).getDate();
  let pad = first.getDay();
  if (firstDay === 1) pad = (pad + 6) % 7;
  const cells: ({ iso: string; day: number } | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= last; d++) {
    cells.push({
      iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
    });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}
