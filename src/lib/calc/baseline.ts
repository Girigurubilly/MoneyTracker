import type {
  Account,
  Currency,
  DepositLifecycle,
  FxRate,
  Holding,
  PlanChange,
  PlanFactStatus,
  PurposeAllocation,
  RetirementAccount,
  SpendCoverage,
  TimeSaving,
} from "../types.ts";
import { toHkd } from "./fx.ts";

export const BASELINE_SCHEMA = 1;
export const CALC_VERSION = "baseline-2026-10-25";

const LOCKED: DepositLifecycle[] = ["active", "matured_unconfirmed", "renewed"];

export type AccountReconcile = {
  id: string;
  reported: number;
  currency: Currency | Account["currency"];
  basis: NonNullable<Account["balanceBasis"]>;
  source: NonNullable<Account["balanceSource"]>;
  asOf: string | null;
  verified: boolean;
  included: { id: string; amount: number }[];
  includedTotal: number;
  available: number | null;
  difference: number | null;
  ownership: NonNullable<Account["ownership"]>;
  planningShare: number | null;
};

export function migrateAccount(account: Account): Account {
  return {
    ...account,
    balanceBasis: account.balanceBasis ?? "unverified",
    balanceSource: account.balanceSource ?? "unknown",
    verified: account.verified ?? false,
    ownership: account.ownership ?? "unknown",
  };
}

export function migrateDeposit(row: TimeSaving): TimeSaving {
  return {
    ...row,
    principalInclusion: row.principalInclusion ?? "unknown",
    renewal: row.renewal ?? "unknown",
    rateStatus: row.rateStatus ?? "unknown",
  };
}

export function migrateRetirement(row: RetirementAccount): RetirementAccount {
  return { ...row, ownership: row.ownership ?? "unknown" };
}

function includedDeposits(deposits: TimeSaving[], accountId: string): TimeSaving[] {
  return deposits.filter(
    (d) => d.accountId === accountId && d.principalInclusion === "included" && d.lifecycle != null && LOCKED.includes(d.lifecycle),
  );
}

export function reconcileAccount(account: Account, deposits: TimeSaving[]): AccountReconcile {
  const row = migrateAccount(account);
  const parts = includedDeposits(deposits.map(migrateDeposit), account.id);
  const includedTotal = parts.reduce((s, d) => s + d.amount, 0);
  const known = row.balanceBasis === "bank_total" || row.balanceBasis === "derived" || row.balanceBasis === "available";
  const relationshipsKnown = deposits.filter((d) => d.accountId === account.id).every((d) => d.principalInclusion && d.principalInclusion !== "unknown");
  let available: number | null = null;
  if (row.availableConfirmed != null) available = row.availableConfirmed;
  else if (row.verified && row.balanceBasis === "available") available = row.balance;
  else if (row.verified && known && relationshipsKnown && row.balanceBasis !== "unverified") {
    available = Math.max(0, row.balance - includedTotal);
  }
  const difference =
    available == null || !relationshipsKnown ? null : round2(row.balance - includedTotal - available);
  return {
    id: account.id,
    reported: account.balance,
    currency: account.currency,
    basis: row.balanceBasis ?? "unverified",
    source: row.balanceSource ?? "unknown",
    asOf: row.balanceAsOf ?? null,
    verified: Boolean(row.verified),
    included: parts.map((d) => ({ id: d.id, amount: d.amount })),
    includedTotal,
    available,
    difference,
    ownership: row.ownership ?? "unknown",
    planningShare: row.planningShare ?? null,
  };
}

export function countsOnce(account: Account, deposits: TimeSaving[]): { net: number; accessible: number } {
  const rec = reconcileAccount(account, deposits);
  const extra = deposits
    .filter((d) => d.accountId === account.id && d.principalInclusion === "excluded")
    .reduce((s, d) => s + d.amount, 0);
  return { net: account.balance + extra, accessible: rec.available ?? 0 };
}

export type DepositView = {
  id: string;
  lifecycle: DepositLifecycle | "unknown";
  rate: number | null;
  rateLabel: string;
  principalStaysPut: boolean;
  principalBecomesCash: boolean;
  interestIncome: number;
  accessiblePrincipal: number;
  inferred: boolean;
};

export function viewDeposit(row: TimeSaving, today: string): DepositView {
  const d = migrateDeposit(row);
  const stated = d.lifecycle;
  const matured = Boolean(d.endDate) && d.endDate < today;
  let lifecycle: DepositView["lifecycle"] = stated ?? "unknown";
  let inferred = false;
  if (d.product === "term" && stated === "active" && matured) {
    lifecycle = "matured_unconfirmed";
    inferred = true;
  }
  const paid = lifecycle === "paid_out";
  const rate = d.rateStatus === "verified" ? d.rate : null;
  return {
    id: d.id,
    lifecycle,
    rate,
    rateLabel: rate == null ? "unknown" : `${rate}%`,
    principalStaysPut: !paid && lifecycle !== "closed_early",
    principalBecomesCash: paid,
    interestIncome: paid ? d.interest : 0,
    accessiblePrincipal: paid ? d.amount : 0,
    inferred,
  };
}

export type AccessBuckets = {
  totalCashAndDeposits: number;
  immediate: number;
  within30: number;
  within90: number;
  within180: number;
  within365: number;
  restricted: number;
  committed: number;
  unallocated: number;
};

export function accessibility(
  accounts: Account[],
  deposits: TimeSaving[],
  allocations: PurposeAllocation[],
  rates: FxRate[],
  today: string,
): AccessBuckets {
  let total = 0;
  let immediate = 0;
  let d30 = 0;
  let d90 = 0;
  let d180 = 0;
  let d365 = 0;
  let restricted = 0;
  for (const account of accounts) {
    if (account.currency === "MILES" || account.type === "miles") continue;
    if (!account.includeInNetWorth && account.balance < 0) continue;
    const hkd = toHkd(account.balance, account.currency, rates);
    if (hkd <= 0) continue;
    const basis = account.balanceBasis;
    const confirmedCash = account.verified && (basis === "bank_total" || basis === "available" || basis === "derived");
    if (confirmedCash) total += hkd;
    const rec = reconcileAccount(account, deposits);
    const now = toHkd(rec.available ?? 0, account.currency, rates);
    immediate += now;
    if (!confirmedCash || rec.available == null) restricted += hkd;
    else restricted += Math.max(0, hkd - now);
  }
  d30 += immediate;
  d90 += d30;
  d180 += d90;
  d365 += d180;
  const committed = allocations
    .filter((a) => a.status === "approved")
    .reduce((s, a) => s + toHkd(a.amount, a.currency, rates), 0);
  return {
    totalCashAndDeposits: round2(total),
    immediate: round2(immediate),
    within30: round2(d30),
    within90: round2(d90),
    within180: round2(d180),
    within365: round2(d365),
    restricted: round2(restricted),
    committed: round2(committed),
    unallocated: round2(Math.max(0, immediate - committed)),
  };
}

export function allocationClashes(rows: PurposeAllocation[]): { refId: string; allocated: number; limit: number }[] {
  const by = new Map<string, { sum: number; limit: number }>();
  for (const row of rows) {
    if (row.status === "superseded") continue;
    const key = `${row.refType}:${row.refId}`;
    const cur = by.get(key) ?? { sum: 0, limit: row.amount };
    cur.sum += row.amount;
    cur.limit = Math.max(cur.limit, row.amount);
    by.set(key, cur);
  }
  const out: { refId: string; allocated: number; limit: number }[] = [];
  for (const [refId, v] of by) {
    const approved = rows.filter((r) => `${r.refType}:${r.refId}` === refId && r.status !== "superseded");
    const cap = approved[0] ? Math.max(...approved.map((r) => r.amount)) : 0;
    const distinct = new Set(approved.map((r) => r.purpose));
    if (distinct.size > 1 && approved.reduce((s, r) => s + r.amount, 0) > cap + 0.001) {
      out.push({ refId, allocated: round2(v.sum), limit: cap });
    }
  }
  return out;
}

export function allocationClashesAgainst(
  rows: PurposeAllocation[],
  funds: { refType: PurposeAllocation["refType"]; refId: string; amount: number }[],
): { refId: string; allocated: number; limit: number }[] {
  const caps = new Map(funds.map((f) => [`${f.refType}:${f.refId}`, f.amount]));
  const sums = new Map<string, number>();
  for (const row of rows) {
    if (row.status === "superseded") continue;
    const key = `${row.refType}:${row.refId}`;
    sums.set(key, (sums.get(key) ?? 0) + row.amount);
  }
  const out: { refId: string; allocated: number; limit: number }[] = [];
  for (const [key, sum] of sums) {
    const limit = caps.get(key);
    if (limit == null) continue;
    if (sum > limit + 0.001) out.push({ refId: key, allocated: round2(sum), limit });
  }
  return out;
}

export type SurplusInput = {
  salary: number;
  otherIncome?: number;
  bills: number;
  cardPayments: number;
  tax: number;
  operatingNeed: number;
  approvedReserves: number;
  cardAlreadyInBills?: boolean;
  taxAlreadyInBills?: boolean;
};

export function allocatableSurplus(input: SurplusInput): number {
  const cards = input.cardAlreadyInBills ? 0 : input.cardPayments;
  const tax = input.taxAlreadyInBills ? 0 : input.tax;
  return round2(input.salary + (input.otherIncome ?? 0) - input.bills - cards - tax - input.operatingNeed - input.approvedReserves);
}

export type CalendarRow = {
  month: string;
  opening: number;
  income: number;
  bills: number;
  principalUnlocked: number;
  interest: number;
  newDeposits: number;
  contributions: number;
  closing: number;
  lockedShortfall: number;
};

export function liquidityCalendar(input: {
  opening: number;
  months: {
    month: string;
    income?: number;
    bills?: number;
    interest?: number;
    newDeposits?: number;
    contributions?: number;
    unlockPrincipal?: number;
    lockedUntilAfter?: number;
  }[];
}): CalendarRow[] {
  let cash = input.opening;
  return input.months.map((m) => {
    const income = m.income ?? 0;
    const bills = m.bills ?? 0;
    const interest = m.interest ?? 0;
    const unlocked = m.unlockPrincipal ?? 0;
    const fresh = m.newDeposits ?? 0;
    const contrib = m.contributions ?? 0;
    const opening = cash;
    cash = cash + income + interest + unlocked - bills - fresh - contrib;
    const lockedShortfall = (m.lockedUntilAfter ?? 0) > 0 && opening + income + interest < bills ? bills - (opening + income + interest) : 0;
    return {
      month: m.month,
      opening: round2(opening),
      income,
      bills,
      principalUnlocked: unlocked,
      interest,
      newDeposits: fresh,
      contributions: contrib,
      closing: round2(cash),
      lockedShortfall: round2(lockedShortfall),
    };
  });
}

export function retirementOnce(
  accounts: Account[],
  rows: RetirementAccount[],
): { included: number; additional: number; restricted: { id: string; accessAge: number; included: boolean }[] } {
  let included = 0;
  let additional = 0;
  const restricted = rows.map((row) => {
    const link = row.representedByAccountId || row.linkedAccountId;
    const headline = link ? accounts.find((a) => a.id === link && a.includeInNetWorth) : undefined;
    const amount = row.ownership === "joint" && row.planningShare != null ? row.currentBalance * row.planningShare : row.currentBalance;
    if (headline) included += headline.currency === row.currency ? Math.min(headline.balance, amount) : amount;
    else additional += amount;
    return { id: row.id, accessAge: row.accessibleAge, included: Boolean(headline) };
  });
  return { included, additional, restricted };
}

export function acceptChange(current: PlanChange[], incoming: PlanChange): PlanChange[] {
  if (incoming.status === "proposal") {
    const approved = current.find((c) => c.id === incoming.id && c.status === "approved");
    if (approved) return current;
  }
  return [...current.filter((c) => c.id !== incoming.id), incoming];
}

export type DiscussionSnapshot = {
  schema: number;
  calc: string;
  id: string;
  asOf: string;
  position: { assets: number; liabilities: number; net: number };
  accounts: AccountReconcile[];
  deposits: DepositView[];
  access: AccessBuckets;
  allocations: PurposeAllocation[];
  clashes: { refId: string; allocated: number; limit: number }[];
  retirement: ReturnType<typeof retirementOnce>;
  assumptions: PlanChange[];
  warnings: string[];
  coverage: SpendCoverage;
  maskNames: boolean;
};

export function buildDiscussionSnapshot(input: {
  asOf: string;
  accounts: Account[];
  deposits: TimeSaving[];
  holdings?: Holding[];
  retirement?: RetirementAccount[];
  allocations?: PurposeAllocation[];
  changes?: PlanChange[];
  rates?: FxRate[];
  coverage?: SpendCoverage;
  maskNames?: boolean;
  id?: string;
}): DiscussionSnapshot {
  const accounts = input.accounts.map(migrateAccount);
  const deposits = input.deposits.map(migrateDeposit);
  const rates = input.rates ?? [];
  const allocations = input.allocations ?? [];
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    if (!a.includeInNetWorth || a.currency === "MILES") continue;
    const hkd = toHkd(a.balance, a.currency, rates);
    if (hkd >= 0) assets += hkd;
    else liabilities += -hkd;
  }
  for (const d of deposits) {
    if (d.principalInclusion === "excluded") assets += toHkd(d.amount, d.currency, rates);
  }
  const warnings: string[] = [];
  for (const a of accounts) {
    if ((a.balanceBasis ?? "unverified") === "unverified" && a.balance) warnings.push(`unverified-balance:${a.id}`);
    if (a.ownership === "joint" && a.planningShare == null) warnings.push(`joint-share-unknown:${a.id}`);
  }
  for (const d of deposits) {
    if ((d.principalInclusion ?? "unknown") === "unknown") warnings.push(`inclusion-unknown:${d.id}`);
    if ((d.rateStatus ?? "unknown") === "unknown") warnings.push(`rate-unknown:${d.id}`);
  }
  const coverage = input.coverage ?? {
    mortgage: null,
    tax: null,
    parentalSupport: null,
    insurance: null,
    travel: null,
    irregular: null,
  };
  for (const [key, value] of Object.entries(coverage)) {
    if (value == null) warnings.push(`spend-coverage-unknown:${key}`);
  }
  return {
    schema: BASELINE_SCHEMA,
    calc: CALC_VERSION,
    id: input.id ?? `snap-${input.asOf}`,
    asOf: input.asOf,
    position: { assets: round2(assets), liabilities: round2(liabilities), net: round2(assets - liabilities) },
    accounts: accounts.map((a) => reconcileAccount(a, deposits)),
    deposits: deposits.map((d) => viewDeposit(d, input.asOf)),
    access: accessibility(accounts, deposits, allocations, rates, input.asOf),
    allocations,
    clashes: allocationClashesAgainst(
      allocations,
      fundsFor(accounts, deposits),
    ),
    retirement: retirementOnce(accounts, (input.retirement ?? []).map(migrateRetirement)),
    assumptions: input.changes ?? [],
    warnings,
    coverage,
    maskNames: Boolean(input.maskNames),
  };
}

function fundsFor(accounts: Account[], deposits: TimeSaving[]) {
  return [
    ...accounts.map((a) => ({ refType: "account" as const, refId: a.id, amount: Math.max(0, reconcileAccount(a, deposits).available ?? a.balance) })),
    ...deposits.map((d) => ({ refType: "deposit" as const, refId: d.id, amount: d.amount })),
  ];
}

const AI_RULES = [
  "Do not double-count an asset that is linked inside an account balance.",
  "Do not treat a proposal as an approved decision.",
  "Do not fill in unknown facts. Say that they are unknown.",
  "State any assumption you change.",
  "Separate a calculated result from a recommendation.",
  "Do not apply an unemployment gap, a mid-year mortgage stop, or any other what-if unless that scenario is stored as an assumption.",
  "A past maturity date is not proof that cash was received.",
  "A current-account name does not mean the whole balance is free to spend.",
  "Joint balances are not entirely available unless a share was confirmed.",
];

export function renderDiscussionMarkdown(s: DiscussionSnapshot): string {
  const lines = [
    `# Financial discussion pack`,
    ``,
    `- Snapshot: ${s.id}`,
    `- Schema: ${s.schema}`,
    `- Calculation: ${s.calc}`,
    `- Date: ${s.asOf}`,
    ``,
    `## Instructions for an assistant`,
    ...AI_RULES.map((r) => `- ${r}`),
    ``,
    `## Position`,
    `- Assets: ${s.position.assets}`,
    `- Liabilities: ${s.position.liabilities}`,
    `- Net: ${s.position.net}`,
    ``,
    `## Accounts`,
    ...s.accounts.map(
      (a) =>
        `- ${s.maskNames ? a.id : a.id} reported ${a.reported} ${a.currency}; basis ${a.basis}; included ${a.includedTotal}; available ${a.available ?? "unknown"}; difference ${a.difference ?? "unknown"}; verified ${a.verified}; as of ${a.asOf ?? "unknown"}; source ${a.source}`,
    ),
    ``,
    `## Deposits`,
    ...s.deposits.map((d) => `- ${d.id} ${d.lifecycle}${d.inferred ? " (inferred, not a saved status)" : ""}; rate ${d.rateLabel}; principal stays ${d.principalStaysPut}; interest income ${d.interestIncome}`),
    ``,
    `## Access`,
    `- Cash and deposits: ${s.access.totalCashAndDeposits}`,
    `- Accessible now: ${s.access.immediate}`,
    `- Within 30/90/180/365: ${s.access.within30} / ${s.access.within90} / ${s.access.within180} / ${s.access.within365}`,
    `- Restricted: ${s.access.restricted}`,
    `- Committed: ${s.access.committed}`,
    `- Unallocated: ${s.access.unallocated}`,
    ``,
    `## Allocations`,
    ...(s.allocations.length ? s.allocations.map((a) => `- ${a.id} ${a.status} ${a.purpose} ${a.amount} ${a.currency} on ${a.refType}:${a.refId} by ${a.availableBy}`) : ["- none"]),
    ...(s.clashes.length ? s.clashes.map((c) => `- OVER ${c.refId}: ${c.allocated} > ${c.limit}`) : []),
    ``,
    `## Retirement links`,
    ...s.retirement.restricted.map((r) => `- ${r.id} access age ${r.accessAge}; already in an account: ${r.included}`),
    ``,
    `## Assumptions and decisions`,
    ...(s.assumptions.length
      ? s.assumptions.map((c) => `- v${c.version} ${c.status} ${c.effectiveDate}: ${c.description} (${c.previous} -> ${c.next}) source ${c.source}`)
      : ["- none"]),
    ``,
    `## Spending coverage (null means unknown)`,
    ...Object.entries(s.coverage).map(([k, v]) => `- ${k}: ${v == null ? "unknown" : v}`),
    ``,
    `## Unresolved`,
    ...(s.warnings.length ? s.warnings.map((w) => `- ${w}`) : ["- none"]),
    ``,
  ];
  return lines.join("\n");
}

export function renderDiscussionJson(s: DiscussionSnapshot): string {
  return JSON.stringify(s, null, 2);
}

export function isProposalStatus(status: PlanFactStatus): boolean {
  return status === "proposal";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
