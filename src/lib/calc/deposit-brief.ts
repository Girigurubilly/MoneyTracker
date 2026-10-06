import type { Account, FxRate, TimeSaving } from "../types.ts";
import { toHkd } from "./fx.ts";

export type DepositBriefRow = {
  status: "active" | "matured";
  bank: string;
  account: string;
  currency: string;
  principal: number;
  rate: number;
  start: string;
  end: string;
  daysLeft: number | null;
  interest: number;
  principalHkd: number;
  interestHkd: number;
  weight: number;
};

export type DepositBrief = {
  asOf: string;
  rows: DepositBriefRow[];
  activeCount: number;
  maturedCount: number;
  activePrincipalHkd: number;
  interestToEarnHkd: number;
  realizedInterestHkd: number;
  unrealizedThisYearHkd: number;
  unrealizedAfterYearHkd: number;
  weightedRate: number | null;
  largestHkd: number;
  largestWeight: number;
  nextMaturity: string;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function dayDiff(from: string, to: string): number | null {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function accountName(accounts: Account[], id?: string): string {
  if (!id) return "";
  return accounts.find((a) => a.id === id)?.name ?? "";
}

export function buildDepositBrief(input: {
  today: string;
  deposits: TimeSaving[];
  accounts: Account[];
  rates: FxRate[];
}): DepositBrief {
  const year = input.today.slice(0, 4);
  const valued = input.deposits.map((d) => {
    const matured = !!d.endDate && d.endDate <= input.today;
    const principalHkd = toHkd(d.amount || 0, d.currency, input.rates);
    const interestHkd = toHkd(d.interest || 0, d.currency, input.rates);
    return { d, matured, principalHkd, interestHkd };
  });
  const active = valued.filter((r) => !r.matured);
  const activePrincipalHkd = active.reduce((s, r) => s + r.principalHkd, 0);
  const interestToEarnHkd = active.reduce((s, r) => s + r.interestHkd, 0);
  const realizedInterestHkd = valued.filter((r) => r.matured).reduce((s, r) => s + r.interestHkd, 0);
  const unrealizedThisYearHkd = active
    .filter((r) => (r.d.endDate || "").slice(0, 4) === year)
    .reduce((s, r) => s + r.interestHkd, 0);
  const rateWeight = active.reduce((s, r) => s + (r.d.rate || 0) * r.principalHkd, 0);
  const largest = active.reduce((best, r) => (r.principalHkd > best ? r.principalHkd : best), 0);
  const next = active
    .map((r) => r.d.endDate)
    .filter(Boolean)
    .sort()[0];
  const rows: DepositBriefRow[] = valued
    .map(({ d, matured, principalHkd, interestHkd }) => ({
      status: matured ? "matured" : "active",
      bank: d.bank || "",
      account: accountName(input.accounts, d.accountId),
      currency: d.currency,
      principal: round(d.amount || 0),
      rate: d.rate || 0,
      start: d.startDate || "",
      end: d.endDate || "",
      daysLeft: d.endDate ? dayDiff(input.today, d.endDate) : null,
      interest: round(d.interest || 0),
      principalHkd: round(principalHkd),
      interestHkd: round(interestHkd),
      weight: !matured && activePrincipalHkd > 0 ? principalHkd / activePrincipalHkd : 0,
    }))
    .sort((a, b) => a.end.localeCompare(b.end) || a.bank.localeCompare(b.bank));
  return {
    asOf: input.today,
    rows,
    activeCount: active.length,
    maturedCount: valued.length - active.length,
    activePrincipalHkd: round(activePrincipalHkd),
    interestToEarnHkd: round(interestToEarnHkd),
    realizedInterestHkd: round(realizedInterestHkd),
    unrealizedThisYearHkd: round(unrealizedThisYearHkd),
    unrealizedAfterYearHkd: round(interestToEarnHkd - unrealizedThisYearHkd),
    weightedRate: activePrincipalHkd > 0 ? rateWeight / activePrincipalHkd : null,
    largestHkd: round(largest),
    largestWeight: activePrincipalHkd > 0 ? largest / activePrincipalHkd : 0,
    nextMaturity: next || "",
  };
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function csv(s: string): string {
  const t = s.replace(/"/g, "'");
  return /[,\n]/.test(t) ? `"${t}"` : t;
}

function hkd(n: number): string {
  return String(Math.round(n));
}

export function renderDepositBriefMarkdown(b: DepositBrief): string {
  const active = b.rows.filter((r) => r.status === "active");
  const byYear = new Map<string, { count: number; principal: number; interest: number }>();
  for (const r of b.rows) {
    const year = (r.end || r.start).slice(0, 4) || "—";
    const cur = byYear.get(year) ?? { count: 0, principal: 0, interest: 0 };
    cur.count += 1;
    cur.principal += r.principalHkd;
    cur.interest += r.interestHkd;
    byYear.set(year, cur);
  }
  const byCcy = new Map<string, { count: number; native: number; principal: number; interest: number }>();
  for (const r of active) {
    const cur = byCcy.get(r.currency) ?? { count: 0, native: 0, principal: 0, interest: 0 };
    cur.count += 1;
    cur.native += r.principal;
    cur.principal += r.principalHkd;
    cur.interest += r.interestHkd;
    byCcy.set(r.currency, cur);
  }
  const byBank = new Map<string, { count: number; principal: number }>();
  for (const r of active) {
    const key = r.account || r.bank || "(unlinked)";
    const cur = byBank.get(key) ?? { count: 0, principal: 0 };
    cur.count += 1;
    cur.principal += r.principalHkd;
    byBank.set(key, cur);
  }
  const startMonth = b.asOf.slice(0, 7);
  const next12 = Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(startMonth, i);
    const hit = active.filter((r) => r.end.startsWith(month));
    return {
      month,
      count: hit.length,
      principal: hit.reduce((s, r) => s + r.principalHkd, 0),
      interest: hit.reduce((s, r) => s + r.interestHkd, 0),
    };
  });
  const lines = [
    "# HK Life Money — time deposits brief",
    `As of: ${b.asOf}`,
    "",
    "## Snapshot",
    `- Records: ${b.rows.length} (${b.activeCount} still placed, ${b.maturedCount} already matured)`,
    `- Active principal (HKD): ${hkd(b.activePrincipalHkd)}`,
    `- Interest still to earn on active deposits (HKD): ${hkd(b.interestToEarnHkd)}`,
    `- Interest already matured (HKD): ${hkd(b.realizedInterestHkd)}`,
    `- Of the interest still to earn, due this calendar year (HKD): ${hkd(b.unrealizedThisYearHkd)}`,
    `- Of the interest still to earn, due after this year (HKD): ${hkd(b.unrealizedAfterYearHkd)}`,
    `- Principal-weighted average rate on active deposits: ${b.weightedRate == null ? "n/a" : `${b.weightedRate.toFixed(2)}%`}`,
    `- Largest active deposit (HKD): ${hkd(b.largestHkd)} (${pct(b.largestWeight)} of active principal)`,
    `- Next maturity: ${b.nextMaturity || "none"}`,
    "",
    "## By maturity year",
    "year,count,principal_hkd,interest_hkd,principal_plus_interest_hkd",
    ...(byYear.size
      ? [...byYear.entries()]
          .sort((a, c) => a[0].localeCompare(c[0]))
          .map(([year, v]) => `${year},${v.count},${hkd(v.principal)},${hkd(v.interest)},${hkd(v.principal + v.interest)}`)
      : ["(none)"]),
    "",
    "## Active principal by currency",
    "currency,count,principal_native,principal_hkd,interest_hkd,weight",
    ...(byCcy.size
      ? [...byCcy.entries()]
          .sort((a, c) => c[1].principal - a[1].principal)
          .map(([ccy, v]) => `${ccy},${v.count},${round(v.native)},${hkd(v.principal)},${hkd(v.interest)},${pct(b.activePrincipalHkd > 0 ? v.principal / b.activePrincipalHkd : 0)}`)
      : ["(none)"]),
    "",
    "## Active principal by account",
    "account,count,principal_hkd,weight",
    ...(byBank.size
      ? [...byBank.entries()]
          .sort((a, c) => c[1].principal - a[1].principal)
          .map(([name, v]) => `${csv(name)},${v.count},${hkd(v.principal)},${pct(b.activePrincipalHkd > 0 ? v.principal / b.activePrincipalHkd : 0)}`)
      : ["(none)"]),
    "",
    "## Next 12 months (active deposits maturing)",
    "month,count,principal_hkd,interest_hkd",
    ...next12.map((m) => `${m.month},${m.count},${hkd(m.principal)},${hkd(m.interest)}`),
    "",
    "## Deposits",
    "status,bank,account,currency,principal,rate_pct,start,end,days_left,interest,principal_hkd,interest_hkd,weight_of_active",
    ...(b.rows.length
      ? b.rows.map((r) =>
          [
            r.status,
            csv(r.bank),
            csv(r.account),
            r.currency,
            r.principal,
            r.rate,
            r.start,
            r.end,
            r.daysLeft ?? "",
            r.interest,
            hkd(r.principalHkd),
            hkd(r.interestHkd),
            pct(r.weight),
          ].join(","),
        )
      : ["(none)"]),
    "",
    "## How to use with an LLM",
    "Paste this markdown together with: (1) Assets → Status for AI, (2) Reports → Retirement → Export for AI. Ask whether the maturity ladder covers the next 12–24 months of spending and the mortgage, what to do with each lump sum as it matures, whether the rate and currency mix still fit the retirement plan, and if one bank or one deposit is too large a share. Matured rows are history. Active principal is money still placed. Figures are a snapshot from this device, not advice.",
  ];
  return lines.join("\n");
}
