import type {
  Account,
  ArrangementInclusion,
  ArrangementTerm,
  CapBasis,
  Mortgage,
  ProductArrangement,
  RateSource,
  RateStep,
  TermStatus,
} from "../types.ts";
import { effectiveRate } from "./mortgage.ts";

export type InterestQuality = "daily" | "estimate" | "unavailable";

export type InterestEstimate = {
  amount: number | null;
  quality: InterestQuality;
  reason: string;
  method: "actual/365" | null;
  savingsInterest: number | null;
  mortgageInterestExpense: null;
  postsTransaction: false;
  principalMovement: 0;
  mortgagePrincipalDelta: 0;
};

export type ArrangementAlertCode =
  | "promo-expired"
  | "rate-expiry-unknown"
  | "terms-unverified"
  | "terms-stale"
  | "terms-overlap"
  | "cap-breach"
  | "cap-unknown"
  | "cap-mismatch"
  | "cap-allocation-unknown"
  | "rate-unknown"
  | "inclusion-unknown"
  | "balance-unknown"
  | "parent-short"
  | "child-in-net-worth"
  | "eligibility-unknown";

export type ArrangementAlert = {
  arrangementId: string;
  code: ArrangementAlertCode;
  detail?: string;
};

export type ParentReconcile = {
  parentId: string;
  extraAssets: 0;
  includedSum: number | null;
  difference: number | null;
  unknownIds: string[];
};

export type ArrangementView = {
  id: string;
  kind: ProductArrangement["kind"];
  structure: ProductArrangement["structure"];
  name: string;
  parentAccountId: string;
  childAccountId: string | null;
  attributedBalance: number | null;
  countsInParent: ArrangementInclusion;
  currency: ProductArrangement["currency"];
  rateExpiry: string | null;
  rateLabel: string;
  postPromoRate: number | null;
  postPromoStatus: TermStatus;
  withdrawalStatus: TermStatus;
  creditDates: string[];
  schedule: { from: string; to: string | null; rate: number | null; status: TermStatus }[];
  termsVerifiedAt: string | null;
  termsStatus: TermStatus;
  reviewBy: string | null;
  capLabel: string;
  extraAssets: 0;
  principalMatures: false;
  interest: InterestEstimate;
  alerts: ArrangementAlertCode[];
};

const NONE: InterestEstimate = {
  amount: null,
  quality: "unavailable",
  reason: "not-requested",
  method: null,
  savingsInterest: null,
  mortgageInterestExpense: null,
  postsTransaction: false,
  principalMovement: 0,
  mortgagePrincipalDelta: 0,
};

export function assetsAddedByArrangements(_rows: ProductArrangement[]): 0 {
  return 0;
}

export function blankArrangement(kind: ProductArrangement["kind"], parentAccountId: string, id: string): ProductArrangement {
  return {
    id,
    kind,
    structure: kind === "promotional_savings" ? "marathon" : "generic",
    name: "",
    parentAccountId,
    attributedBalance: null,
    countsInParent: "unknown",
    currency: "HKD",
    startDate: null,
    rateSchedule: [],
    rateExpiry: null,
    withdrawal: { note: "", status: "unknown" },
    interestCreditDates: [],
    postPromoRate: null,
    postPromoStatus: "unknown",
    eligible: { note: "", status: "unknown", minimumBalance: null, cap: null, capStatus: "unknown", newFundsOnly: null },
    dayCount: "unknown",
    mortgageId: null,
    rateSource: "unknown",
    mortgageSpread: null,
    mortgageSpreadStatus: "unknown",
    capBasis: "unknown",
    capGroup: "",
    capAllocation: null,
    capAllocationStatus: "unknown",
    excessRate: null,
    excessRateStatus: "unknown",
    terms: [],
    dailyBalances: [],
    termsVerifiedAt: null,
    termsStatus: "unknown",
    reviewBy: null,
  };
}

export function migrateArrangement(row: ProductArrangement): ProductArrangement {
  const blank = blankArrangement(row.kind, row.parentAccountId, row.id);
  return {
    ...blank,
    ...row,
    structure: row.structure ?? blank.structure,
    countsInParent: row.countsInParent ?? "unknown",
    withdrawal: { ...blank.withdrawal, ...row.withdrawal },
    eligible: { ...blank.eligible, ...row.eligible },
    rateSchedule: row.rateSchedule ?? [],
    interestCreditDates: row.interestCreditDates ?? [],
    terms: row.terms ?? [],
    dailyBalances: row.dailyBalances ?? [],
    postPromoStatus: row.postPromoStatus ?? "unknown",
    dayCount: row.dayCount ?? "unknown",
    rateSource: row.rateSource ?? "unknown",
    mortgageSpreadStatus: row.mortgageSpreadStatus ?? "unknown",
    capBasis: row.capBasis ?? "unknown",
    capAllocationStatus: row.capAllocationStatus ?? "unknown",
    excessRateStatus: row.excessRateStatus ?? "unknown",
    termsStatus: row.termsStatus ?? "unknown",
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dates(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return out;
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function covers(from: string, to: string | null, day: string): boolean {
  if (day < from) return false;
  if (to && day > to) return false;
  return true;
}

function stepsOn(steps: RateStep[], day: string): RateStep[] {
  return steps.filter((s) => s.status === "verified" && s.annualRate != null && covers(s.from, s.to, day));
}

function termsOn(terms: ArrangementTerm[], day: string): ArrangementTerm[] {
  return terms.filter((t) => covers(t.from, t.to, day));
}

export function reconcileParent(parent: Account, rows: ProductArrangement[]): ParentReconcile {
  const mine = rows.filter((r) => r.parentAccountId === parent.id);
  const unknownIds = mine.filter((r) => r.countsInParent === "unknown" || r.attributedBalance == null).map((r) => r.id);
  if (unknownIds.length) return { parentId: parent.id, extraAssets: 0, includedSum: null, difference: null, unknownIds };
  const includedSum = round2(mine.filter((r) => r.countsInParent === "included").reduce((s, r) => s + (r.attributedBalance ?? 0), 0));
  return { parentId: parent.id, extraAssets: 0, includedSum, difference: round2(parent.balance - includedSum), unknownIds: [] };
}

function mortgageOf(rows: Mortgage[], id: string | null): Mortgage | undefined {
  if (!id) return undefined;
  return rows.find((m) => m.id === id);
}

function resolvedCap(row: ProductArrangement, mortgages: Mortgage[], day: string): number | null {
  if (row.kind === "promotional_savings") {
    if (row.eligible.capStatus !== "verified" || row.eligible.cap == null) return null;
    return row.eligible.cap;
  }
  const hit = termsOn(row.terms, day);
  if (hit.length !== 1) {
    if (row.terms.length) return null;
    if (row.termsStatus !== "verified") return null;
    return capFrom(row.capBasis, row.eligible.cap, row.eligible.capStatus, mortgageOf(mortgages, row.mortgageId));
  }
  const term = hit[0];
  if (!term.verifiedAt) return null;
  return capFrom(term.capBasis, term.cap, term.capStatus, mortgageOf(mortgages, row.mortgageId));
}

function capFrom(basis: CapBasis, stated: number | null, status: TermStatus, mortgage: Mortgage | undefined): number | null {
  if (basis === "unknown") return null;
  if (basis === "stated") return status === "verified" && stated != null ? stated : null;
  if (!mortgage) return null;
  return mortgage.outstanding;
}

function rateOn(row: ProductArrangement, mortgages: Mortgage[], day: string): number | null {
  if (row.kind === "promotional_savings") {
    if (row.rateExpiry && day > row.rateExpiry) {
      return row.postPromoStatus === "verified" && row.postPromoRate != null ? row.postPromoRate : null;
    }
    const steps = stepsOn(row.rateSchedule, day);
    if (steps.length !== 1) return null;
    return steps[0].annualRate;
  }
  const terms = termsOn(row.terms, day);
  if (terms.length > 1) return null;
  const term = terms[0];
  const source: RateSource = term ? term.rateSource : row.termsStatus === "verified" ? row.rateSource : "unknown";
  const spread = term ? term.spread : row.mortgageSpread;
  const spreadStatus = term ? term.spreadStatus : row.mortgageSpreadStatus;
  if (source === "schedule") {
    const steps = stepsOn(row.rateSchedule, day);
    return steps.length === 1 ? steps[0].annualRate : null;
  }
  if (source !== "mortgage" || spreadStatus !== "verified" || spread == null) return null;
  const mortgage = mortgageOf(mortgages, row.mortgageId);
  if (!mortgage || (term && !term.verifiedAt) || (!term && row.termsStatus !== "verified")) return null;
  return effectiveRate(mortgage) + spread;
}

function excessOn(row: ProductArrangement, day: string): number | null | "blocked" {
  if (row.kind === "mortgage_linked_savings" && row.terms.length) {
    const terms = termsOn(row.terms, day);
    if (terms.length !== 1 || !terms[0].verifiedAt) return "blocked";
    return terms[0].excessRateStatus === "verified" ? terms[0].excessRate : "blocked";
  }
  if (row.excessRateStatus !== "verified") return "blocked";
  return row.excessRate;
}

function sliceInterest(balance: number, cap: number | null, rate: number, excess: number | null | "blocked"): number | null {
  if (cap == null) return null;
  const eligible = Math.min(balance, cap);
  if (balance > cap) {
    if (excess === "blocked" || excess == null) return null;
    return eligible * rate + (balance - cap) * excess;
  }
  return eligible * rate;
}

export function interestEstimate(
  row: ProductArrangement,
  mortgages: Mortgage[],
  period: { from: string; to: string } | null,
): InterestEstimate {
  const base: InterestEstimate = { ...NONE, reason: "missing-period" };
  if (!period) return base;
  const days = dates(period.from, period.to);
  if (!days.length) return { ...base, reason: "empty-period" };
  if (row.dayCount !== "actual/365") return { ...base, reason: "day-count-unknown" };
  if (row.kind === "promotional_savings" && row.eligible.status !== "verified") return { ...base, reason: "eligibility-unknown" };
  if (row.kind === "promotional_savings" && row.eligible.newFundsOnly !== false) return { ...base, reason: "new-funds-unknown" };
  const history = new Map(row.dailyBalances.map((p) => [p.date, p]));
  const complete = days.every((d) => history.get(d)?.reliable);
  const useDaily = complete;
  if (!useDaily && row.attributedBalance == null) return { ...base, reason: "balance-unknown" };
  let total = 0;
  for (const day of days) {
    const balance = useDaily ? history.get(day)!.balance : row.attributedBalance!;
    const rate = rateOn(row, mortgages, day);
    if (rate == null) return { ...base, reason: "rate-unknown" };
    const cap = resolvedCap(row, mortgages, day);
    const excess = excessOn(row, day);
    const dayAmount = sliceInterest(balance, cap, rate, excess);
    if (dayAmount == null) return { ...base, reason: cap == null ? "cap-unknown" : "excess-unknown" };
    total += dayAmount / 365;
  }
  const amount = round2(total);
  return {
    amount,
    quality: useDaily ? "daily" : "estimate",
    reason: useDaily ? "daily-history" : "point-balance",
    method: "actual/365",
    savingsInterest: amount,
    mortgageInterestExpense: null,
    postsTransaction: false,
    principalMovement: 0,
    mortgagePrincipalDelta: 0,
  };
}

export function arrangementAlerts(
  rows: ProductArrangement[],
  accounts: Account[],
  mortgages: Mortgage[],
  asOf: string,
): ArrangementAlert[] {
  const alerts: ArrangementAlert[] = [];
  for (const row of rows) {
    if (row.countsInParent === "unknown") alerts.push({ arrangementId: row.id, code: "inclusion-unknown" });
    if (row.attributedBalance == null) alerts.push({ arrangementId: row.id, code: "balance-unknown" });
    if (row.termsStatus !== "verified" || !row.termsVerifiedAt) alerts.push({ arrangementId: row.id, code: "terms-unverified" });
    if (row.reviewBy && row.reviewBy < asOf) alerts.push({ arrangementId: row.id, code: "terms-stale" });
    if (row.kind === "promotional_savings" && !row.rateExpiry) alerts.push({ arrangementId: row.id, code: "rate-expiry-unknown" });
    if (row.kind === "promotional_savings" && row.rateExpiry && row.rateExpiry <= asOf) alerts.push({ arrangementId: row.id, code: "promo-expired" });
    if (row.kind === "promotional_savings" && row.eligible.status !== "verified") alerts.push({ arrangementId: row.id, code: "eligibility-unknown" });
    const cap = resolvedCap(row, mortgages, asOf);
    if (cap == null && !row.capGroup) alerts.push({ arrangementId: row.id, code: "cap-unknown" });
    if (cap != null && row.attributedBalance != null && row.attributedBalance > cap) alerts.push({ arrangementId: row.id, code: "cap-breach" });
    if (rateOn(row, mortgages, asOf) == null) alerts.push({ arrangementId: row.id, code: "rate-unknown" });
    const terms = termsOn(row.terms, asOf);
    if (terms.length > 1) alerts.push({ arrangementId: row.id, code: "terms-overlap" });
    const child = row.childAccountId ? accounts.find((a) => a.id === row.childAccountId) : undefined;
    if (child?.includeInNetWorth && row.countsInParent === "included") alerts.push({ arrangementId: row.id, code: "child-in-net-worth" });
  }
  const groups = new Map<string, ProductArrangement[]>();
  for (const row of rows) {
    if (!row.capGroup) continue;
    groups.set(row.capGroup, [...(groups.get(row.capGroup) ?? []), row]);
  }
  for (const [group, members] of groups) {
    const caps = members.map((m) => resolvedCap(m, mortgages, asOf));
    if (caps.some((c) => c == null)) {
      for (const m of members) alerts.push({ arrangementId: m.id, code: "cap-unknown", detail: group });
      continue;
    }
    if (caps.some((c) => c !== caps[0])) {
      for (const m of members) alerts.push({ arrangementId: m.id, code: "cap-mismatch", detail: group });
      continue;
    }
    if (members.some((m) => m.capAllocationStatus !== "verified" || m.capAllocation == null)) {
      for (const m of members) {
        if (m.capAllocationStatus !== "verified" || m.capAllocation == null) alerts.push({ arrangementId: m.id, code: "cap-allocation-unknown", detail: group });
      }
      continue;
    }
    const sum = members.reduce((s, m) => s + (m.capAllocation ?? 0), 0);
    if (sum > (caps[0] ?? 0)) {
      for (const m of members) alerts.push({ arrangementId: m.id, code: "cap-breach", detail: group });
    }
  }
  const parents = new Set(rows.map((r) => r.parentAccountId));
  for (const id of parents) {
    const parent = accounts.find((a) => a.id === id);
    if (!parent) continue;
    const rec = reconcileParent(parent, rows);
    if (rec.difference != null && rec.difference < 0) {
      for (const row of rows.filter((r) => r.parentAccountId === id)) alerts.push({ arrangementId: row.id, code: "parent-short" });
    }
  }
  return alerts;
}

export function reviewArrangements(input: {
  arrangements: ProductArrangement[];
  accounts: Account[];
  mortgages?: Mortgage[];
  asOf: string;
  period?: { from: string; to: string } | null;
}): { views: ArrangementView[]; alerts: ArrangementAlert[]; extraAssets: 0 } {
  const rows = input.arrangements.map(migrateArrangement);
  const mortgages = input.mortgages ?? [];
  const alerts = arrangementAlerts(rows, input.accounts, mortgages, input.asOf);
  const views = rows.map((row) => {
    const interest = interestEstimate(row, mortgages, input.period ?? null);
    const cap = resolvedCap(row, mortgages, input.asOf);
    const rate = rateOn(row, mortgages, input.asOf);
    return {
      id: row.id,
      kind: row.kind,
      structure: row.structure,
      name: row.name,
      parentAccountId: row.parentAccountId,
      childAccountId: row.childAccountId ?? null,
      attributedBalance: row.attributedBalance,
      countsInParent: row.countsInParent,
      currency: row.currency,
      rateExpiry: row.rateExpiry,
      rateLabel: rate == null ? "unknown" : String(rate),
      postPromoRate: row.postPromoRate,
      postPromoStatus: row.postPromoStatus,
      withdrawalStatus: row.withdrawal.status,
      creditDates: row.interestCreditDates,
      schedule: row.rateSchedule.map((s) => ({ from: s.from, to: s.to, rate: s.annualRate, status: s.status })),
      termsVerifiedAt: row.termsVerifiedAt,
      termsStatus: row.termsStatus,
      reviewBy: row.reviewBy,
      capLabel: cap == null ? "unknown" : String(cap),
      extraAssets: 0 as const,
      principalMatures: false as const,
      interest,
      alerts: alerts.filter((a) => a.arrangementId === row.id).map((a) => a.code),
    };
  });
  return { views, alerts, extraAssets: 0 };
}
