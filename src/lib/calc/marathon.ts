import { roundMoney } from "./ledger.ts";

/** Published SCB marathon bands. A starting point only — every date and rate stays editable. */
const SCB_BANDS = [
  { from: "2026-10-02", to: "2026-11-30", hkd: 2.8, usd: 3.3 },
  { from: "2026-12-01", to: "2027-01-03", hkd: 3, usd: 3.5 },
  { from: "2027-01-04", to: "2027-02-01", hkd: 3.2, usd: 3.6 },
] as const;

export type MarathonTier = {
  id: string;
  from: string;
  to: string;
  /** Annual rate in percent. 2.8 means 2.8%. */
  rate: number;
};

export function scbMarathonTiers(currency: "HKD" | "USD"): MarathonTier[] {
  return SCB_BANDS.map((row, i) => ({
    id: `tier-${i + 1}`,
    from: row.from,
    to: row.to,
    rate: currency === "USD" ? row.usd : row.hkd,
  }));
}

/** Inclusive day count. Abutting tiers (end date, then the next day) do not drop or double a day. */
export function inclusiveDays(from: string, to: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return 0;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function marathonTiersOverlap(tiers: { from: string; to: string }[]): boolean {
  const spans = tiers
    .filter((t) => t.from && t.to && t.to >= t.from)
    .map((t) => [t.from, t.to] as const)
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  for (let i = 1; i < spans.length; i++) {
    if (spans[i][0] <= spans[i - 1][1]) return true;
  }
  return false;
}

export type MarathonTierInterest = { id: string; days: number; interest: number };

export type MarathonMonthInterest = {
  month: string;
  /** Planned-income date: the 1st of the month after the accrual month. */
  date: string;
  days: number;
  interest: number;
};

function utcDayAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function utcMonthEnd(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function utcNextMonthFirst(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 10);
}

/** Split each tier across calendar months. Actual/365, inclusive days, rounded per slice.
 *  A full month is paid on the 1st of the next month. A promo that ends on the 1st
 *  of a month keeps that single day with the previous month and pays the day after.
 */
export function marathonMonthlyInterest(
  amount: number,
  tiers: { from: string; to: string; rate: number }[],
): MarathonMonthInterest[] {
  const buckets = new Map<string, { days: number; interest: number; end: string }>();
  for (const tier of tiers) {
    if (!tier.from || !tier.to || tier.to < tier.from || !(tier.rate > 0) || !(amount > 0)) continue;
    let cursor = tier.from;
    let guard = 0;
    while (cursor <= tier.to && guard < 36) {
      guard += 1;
      const sliceTo = utcMonthEnd(cursor) < tier.to ? utcMonthEnd(cursor) : tier.to;
      const days = inclusiveDays(cursor, sliceTo);
      const month = cursor.slice(0, 7);
      const interest = days > 0 ? roundMoney(amount * (tier.rate / 100) * (days / 365)) : 0;
      const prev = buckets.get(month);
      if (!prev) buckets.set(month, { days, interest, end: sliceTo });
      else {
        buckets.set(month, {
          days: prev.days + days,
          interest: roundMoney(prev.interest + interest),
          end: sliceTo > prev.end ? sliceTo : prev.end,
        });
      }
      const next = utcDayAfter(sliceTo);
      if (next <= cursor) break;
      cursor = next;
    }
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, row]) => ({ month, ...row }));
  const last = rows.at(-1);
  const prior = rows.at(-2);
  if (last && last.days === 1 && last.end.endsWith("-01")) {
    const pay = utcDayAfter(last.end);
    if (prior) {
      prior.days += last.days;
      prior.interest = roundMoney(prior.interest + last.interest);
      prior.end = last.end;
      rows.pop();
      return rows.map((row) => ({
        month: row.month,
        date: row === prior ? pay : utcNextMonthFirst(row.month),
        days: row.days,
        interest: row.interest,
      }));
    }
    return [{ month: last.month, date: pay, days: last.days, interest: last.interest }];
  }
  return rows.map((row) => ({
    month: row.month,
    date: utcNextMonthFirst(row.month),
    days: row.days,
    interest: row.interest,
  }));
}

/** Actual/365 on the stated balance. Each tier is inclusive. This does not post a transaction. */
export function marathonInterest(amount: number, tiers: MarathonTier[]): {
  total: number;
  rows: MarathonTierInterest[];
  overlap: boolean;
} {
  const rows = tiers.map((t) => {
    const days = inclusiveDays(t.from, t.to);
    const interest = days > 0 && amount > 0 && t.rate > 0 ? roundMoney(amount * (t.rate / 100) * (days / 365)) : 0;
    return { id: t.id, days, interest };
  });
  return {
    total: roundMoney(rows.reduce((sum, row) => sum + row.interest, 0)),
    rows,
    overlap: marathonTiersOverlap(tiers),
  };
}
