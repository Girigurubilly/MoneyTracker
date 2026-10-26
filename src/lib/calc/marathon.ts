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
