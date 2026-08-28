import type { Locale, MoneyUnit } from "@/lib/types";

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function money(
  amount: number,
  unit: MoneyUnit = "HKD",
  opts?: { sign?: boolean },
): string {
  if (unit === "MILES") {
    const n = Math.round(amount).toLocaleString("en-HK");
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

export function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
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
