import { yearlyProjection } from "./deposits.ts";
import { toHkd } from "./fx.ts";
import { holdingsForAccount, holdingMarketValue } from "../holdings.ts";
import { installmentOf } from "./housing.ts";
import { countsInNetWorth, netWorthNow } from "./networth.ts";
import type {
  Account,
  AdhocBudget,
  Allowance,
  BalanceBasis,
  Category,
  FxRate,
  Holding,
  Mortgage,
  PromoSaving,
  Recurring,
  RetirementAccount,
  TimeSaving,
  Transaction,
  YearlyPlan,
} from "../types.ts";

export const FC_CALCULATION_ID = "mt-fc-baseline-1";
export const FC_APP_VERSION = "hk-life-money";

export const BALANCE_BASIS: BalanceBasis[] = [
  "bank_total_incl_deposits",
  "available_ex_deposits",
  "holdings_derived",
  "unverified",
];

/** Product-name / bank / id patterns that mean promo savings, not a true time deposit. */
export const PROMO_HINT = /marathon|馬拉松|promo\s*savings|推廣儲蓄|優惠儲蓄|savings\s*promo|promo\s*rate/i;

export function todayHkt(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function promoInHkd(p: PromoSaving, rates: FxRate[]): number {
  return toHkd(p.residualHkd || 0, p.currency ?? "HKD", rates);
}

export function migrateBalanceBasis(accounts: Account[]): Account[] {
  return accounts.map((a) => {
    if (a.balanceBasis) return a;
    const basis: BalanceBasis = a.type === "investment" && (a.holdingSync || a.stockBook) ? "holdings_derived" : "unverified";
    return { ...a, balanceBasis: basis };
  });
}

function promoHaystack(d: TimeSaving, accounts: Account[] = []): string {
  const acc = accounts.find((a) => a.id === d.accountId);
  return [d.bank, d.id, d.proceedsDestination, acc?.name, acc?.nameZh, acc?.institution, acc?.notes, acc?.notesZh]
    .filter(Boolean)
    .join(" ");
}

export function looksLikePromoDeposit(d: TimeSaving, accounts: Account[] = []): boolean {
  return PROMO_HINT.test(promoHaystack(d, accounts));
}

export function extractPromoDeposits(
  deposits: TimeSaving[],
  existing: PromoSaving[],
  rates: FxRate[],
  accounts: Account[] = [],
): { deposits: TimeSaving[]; promo: PromoSaving[] } {
  const promo = [...existing];
  const keep: TimeSaving[] = [];
  for (const d of deposits) {
    if (!looksLikePromoDeposit(d, accounts)) {
      keep.push(d);
      continue;
    }
    const id = d.id.startsWith("promo-") ? d.id : `promo-${d.id}`;
    if (!promo.some((p) => p.id === id || (p.name && PROMO_HINT.test(p.name) && p.accountId === d.accountId))) {
      promo.push({
        id,
        accountId: d.accountId,
        residualHkd: round(toHkd(d.amount, d.currency, rates)),
        rateSchedule: [{ from: d.startDate, to: d.endDate, rate: d.rate }],
        arrangementEnd: d.endDate,
        accessibility: "unknown",
        distinctFromTd: true,
        name: d.bank,
        nameZh: d.bank,
      });
    }
  }
  return { deposits: keep, promo };
}

export const DEFAULT_CONFIRMED_FACTS = [
  "Headline net worth uses the same netWorthNow total as the assets page, including a time deposit only when its principal is not already inside the linked account balance.",
  "Promo savings are an arrangement on an existing account. They are not added again as assets.",
  "Cashflow left is income minus expense. surplus_cons is not calculated.",
];

export type FcBaseline = {
  meta: {
    snapshot_id: string;
    as_of: string;
    currency_base: "HKD";
    app_version: string;
    calculation_id: string;
    balance_basis_note: string;
    rate_note: string;
  };
  headline: { assets_total: number; liabilities_total: number; net_worth: number; mpf_orso_outside_headline: number };
  accounts: {
    id: string;
    name: string;
    institution: string | null;
    ownership: "sole" | "joint" | null;
    balance_hkd: number;
    balance_basis: BalanceBasis | null;
    planning_availability: Account["planningAvailability"] | null;
    currency: string;
    fx_rate: number | null;
    fx_as_of: string | null;
    notes: string | null;
  }[];
  deposits: {
    id: string;
    account_id: string;
    principal: number;
    currency: string;
    rate_pa: number;
    rate_unit: "percent_per_annum";
    start: string;
    maturity: string;
    status: "active" | "matured";
    interest_accrued_known: number | null;
    proceeds_destination: string | null;
  }[];
  promo_savings: {
    id: string;
    account_id: string;
    residual_hkd: number;
    rate_schedule: { from: string; to: string; rate: number }[];
    rate_unit: "percent_per_annum";
    arrangement_end: string;
    accessibility: PromoSaving["accessibility"];
    distinct_from_td: true;
    name: string | null;
  }[];
  holdings: {
    id: string;
    account_id: string | null;
    ticker: string;
    name: string;
    market: string;
    qty: number;
    market_value_hkd: number;
    cost_hkd: number | null;
    valuation_date: string | null;
    policy_note: string;
  }[];
  liabilities: {
    id: string;
    name: string;
    account_id: string;
    property_account_id: string | null;
    original_hkd: number;
    outstanding_hkd: number;
    monthly_payment: number | null;
    rate_pa: number;
    rate_unit: "decimal_per_annum";
    remaining_months: number;
    payment_day: number;
    type: Mortgage["type"];
    rate_linked_savings_account_id: string | null;
  }[];
  retirement_restricted: {
    id: string;
    name: string;
    type: string;
    balance_hkd: number;
    as_of: string | null;
    accessible_age: number | null;
    linked_account_id: string | null;
    in_headline: boolean;
  }[];
  annuities: {
    id: string;
    name: string;
    /** prepaid = premium/balance asset; income = monthly payout stream. */
    role: "prepaid" | "income";
    prepaid_balance_hkd: number | null;
    monthly_hkd: number | null;
    start_age: number | null;
    years: number | null;
    source: "allowance" | "retirement_account";
    kind: string;
  }[];
  cashflow_period: {
    label: "MoneyTracker projection";
    note: string;
    year: number;
    income: number;
    expense: number;
    left: number;
    is_path_a_surplus_cons: false;
    monthly_rows: { month: string; income: number; expense: number; left: number; status: "posted" | "projected" }[];
  };
  adhoc_payments: {
    id: string;
    date: string;
    amount: number;
    currency: string;
    paid_on: string | null;
    label: string;
    included_in_projection: boolean;
  }[];
  confirmed_facts: string[];
  open_gaps: string[];
  checks: { code: string; account_id?: string; detail: string; value?: number }[];
};

const BASIS_NOTE =
  "balance_basis says what the stored balance includes. bank_total_incl_deposits is not spendable cash. available_ex_deposits excludes linked time deposits. holdings_derived should match holding lines. unverified means the basis was not confirmed. A positive balance is not the same as accessible cash.";

const POLICY = "Market value is quantity times last price, converted to HKD with the stored FX rate. It is not a live quote.";

export function buildFcBaseline(input: {
  asOf?: string;
  accounts: Account[];
  deposits: TimeSaving[];
  promo: PromoSaving[];
  holdings: Holding[];
  mortgage: Mortgage | null;
  retirementAccounts: RetirementAccount[];
  allowances: Allowance[];
  adhoc: AdhocBudget[];
  rates: FxRate[];
  plans: YearlyPlan[];
  txs: Transaction[];
  categories: Category[];
  recurring: Recurring[];
  monthCap: number;
  /** Extra user-edited facts; merged after defaults (deduped). */
  confirmedFacts?: string[];
  /** Extra user-edited gaps; merged with auto gaps (deduped). */
  openGaps?: string[];
}): FcBaseline {
  const asOf = input.asOf ?? todayHkt();
  const year = Number(asOf.slice(0, 4));
  const month0 = Number(asOf.slice(5, 7)) - 1;
  // Always re-extract promo-like TDs so export is non-empty when Marathon exists as a TD.
  const split = extractPromoDeposits(input.deposits, input.promo, input.rates, input.accounts);
  const deposits = split.deposits;
  const promo = split.promo;
  const nw = netWorthNow(input.accounts, input.rates, deposits, asOf);
  const headlineIds = new Set(input.accounts.filter((a) => countsInNetWorth(a) && a.type === "mpf").map((a) => a.id));
  let outside = 0;
  const retirement_restricted: FcBaseline["retirement_restricted"] = input.retirementAccounts
    .filter((r) => r.type === "MPF" || r.type === "ORSO")
    .map((r) => {
      const linked = input.accounts.find((a) => a.id === r.linkedAccountId);
      const inHeadline = Boolean(linked && countsInNetWorth(linked));
      const balance_hkd = round(toHkd(r.currentBalance, r.currency, input.rates));
      if (!inHeadline) outside += balance_hkd;
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        balance_hkd,
        as_of: r.balanceAsOf || null,
        accessible_age: r.accessibleAge ?? null,
        linked_account_id: r.linkedAccountId ?? null,
        in_headline: inHeadline,
      };
    });
  for (const a of input.accounts) {
    if (a.type !== "mpf" || countsInNetWorth(a) || headlineIds.has(a.id)) continue;
    outside += toHkd(a.balance, a.currency, input.rates);
    retirement_restricted.push({
      id: a.id,
      name: a.nameZh || a.name,
      type: "MPF",
      balance_hkd: round(toHkd(a.balance, a.currency, input.rates)),
      as_of: null,
      accessible_age: null as number | null,
      linked_account_id: null,
      in_headline: false,
    });
  }
  const yearRows = yearlyProjection(input.plans, deposits, input.rates, year, month0, input.txs, input.categories, input.monthCap, input.recurring, asOf, promo);
  const checks = baselineChecks({
    accounts: input.accounts,
    holdings: input.holdings,
    deposits,
    promo,
    mortgage: input.mortgage,
    rates: input.rates,
    asOf,
  });
  const autoGaps = [
    ...checks.filter((c) => c.code !== "active_td_sum" && c.code !== "promo_residual").map((c) => c.detail),
  ];
  if (!deposits.some((d) => d.proceedsDestination)) {
    // only note if any deposit lacks destination when deposits exist
    if (deposits.length && deposits.every((d) => !d.proceedsDestination)) {
      autoGaps.push("No deposit has proceeds_destination set.");
    }
  }
  const confirmed_facts = dedupeLines([...(input.confirmedFacts?.length ? input.confirmedFacts : DEFAULT_CONFIRMED_FACTS)]);
  const open_gaps = dedupeLines([...(input.openGaps ?? []), ...autoGaps]);

  return {
    meta: {
      snapshot_id: `snap-${asOf}`,
      as_of: asOf,
      currency_base: "HKD",
      app_version: FC_APP_VERSION,
      calculation_id: FC_CALCULATION_ID,
      balance_basis_note: BASIS_NOTE,
      rate_note: "Time-deposit and promo rates are percent per year, as stored. Mortgage rate_pa is the decimal stored on the mortgage.",
    },
    headline: {
      assets_total: round(nw.assets),
      liabilities_total: round(nw.liab),
      net_worth: round(nw.net),
      mpf_orso_outside_headline: round(outside),
    },
    accounts: input.accounts.map((a) => {
      const fx = a.currency === "HKD" || a.currency === "MILES" ? undefined : input.rates.find((r) => r.currency === a.currency);
      return {
        id: a.id,
        name: a.nameZh || a.name,
        institution: a.institution ?? null,
        ownership: a.ownership ?? null,
        balance_hkd: round(toHkd(a.balance, a.currency, input.rates)),
        balance_basis: a.balanceBasis ?? null,
        planning_availability: a.planningAvailability ?? null,
        currency: a.currency,
        fx_rate: fx ? fx.perHkd : a.currency === "HKD" ? 1 : null,
        fx_as_of: fx?.asOf ?? null,
        notes: a.notesZh || a.notes || null,
      };
    }),
    deposits: deposits.map((d) => ({
      id: d.id,
      account_id: d.accountId,
      principal: d.amount,
      currency: d.currency,
      rate_pa: d.rate,
      rate_unit: "percent_per_annum" as const,
      start: d.startDate,
      maturity: d.endDate,
      status: d.endDate && d.endDate < asOf ? ("matured" as const) : ("active" as const),
      interest_accrued_known: d.interest ? d.interest : null,
      proceeds_destination: d.proceedsDestination ?? null,
    })),
    promo_savings: promo.map((p) => ({
      id: p.id,
      account_id: p.accountId,
      residual_hkd: p.currency && p.currency !== "HKD" ? round(promoInHkd(p, input.rates)) : p.residualHkd,
      rate_schedule: p.rateSchedule.map((s) => ({ from: s.from, to: s.to, rate: s.rate })),
      rate_unit: "percent_per_annum" as const,
      arrangement_end: p.arrangementEnd,
      accessibility: p.accessibility,
      distinct_from_td: true as const,
      name: p.nameZh || p.name || null,
    })),
    holdings: input.holdings.map((h) => ({
      id: h.id,
      account_id: h.accountId ?? null,
      ticker: h.symbol,
      name: h.name,
      market: h.market,
      qty: h.quantity,
      market_value_hkd: round(holdingMarketValue(h, "HKD", input.rates)),
      cost_hkd: h.avgCost == null ? null : round(toHkd(h.avgCost * h.quantity, h.currency, input.rates)),
      valuation_date: h.lastPriceAt ? h.lastPriceAt.slice(0, 10) : null,
      policy_note: (h.policyNote && h.policyNote.trim()) || POLICY,
    })),
    liabilities: input.mortgage
      ? [
          {
            id: input.mortgage.id,
            name: input.mortgage.nameZh || input.mortgage.name,
            account_id: input.mortgage.accountId,
            property_account_id: input.mortgage.propertyAccountId ?? null,
            original_hkd: input.mortgage.original,
            outstanding_hkd: input.mortgage.outstanding,
            monthly_payment: round(installmentOf(input.mortgage)),
            rate_pa: input.mortgage.rate,
            rate_unit: "decimal_per_annum" as const,
            remaining_months: input.mortgage.remainingMonths,
            payment_day: input.mortgage.paymentDay,
            type: input.mortgage.type,
            rate_linked_savings_account_id: input.mortgage.rateLinkedSavingsAccountId ?? null,
          },
        ]
      : [],
    retirement_restricted,
    annuities: [
      ...input.retirementAccounts
        .filter((r) => r.type === "ANNUITY" || r.type === "PENSION" || r.type === "QDAP")
        .flatMap((r) => {
          const rows: FcBaseline["annuities"] = [];
          const bal = round(toHkd(r.currentBalance, r.currency, input.rates));
          if (bal > 0) {
            rows.push({
              id: `${r.id}-prepaid`,
              name: r.name,
              role: "prepaid",
              prepaid_balance_hkd: bal,
              monthly_hkd: null,
              start_age: r.accessibleAge ?? null,
              years: r.scheduledIncomeYears ?? null,
              source: "retirement_account",
              kind: r.type,
            });
          }
          const monthly = r.scheduledMonthlyIncome ?? (r.scheduledAnnualIncome ? r.scheduledAnnualIncome / 12 : 0);
          if (monthly > 0) {
            rows.push({
              id: `${r.id}-income`,
              name: r.name,
              role: "income",
              prepaid_balance_hkd: null,
              monthly_hkd: round(toHkd(monthly, r.currency, input.rates)),
              start_age: r.scheduledIncomeStartAge ?? r.accessibleAge ?? null,
              years: r.scheduledIncomeYears ?? null,
              source: "retirement_account",
              kind: r.type,
            });
          }
          return rows;
        }),
      ...input.allowances
        .filter((a) => a.kind === "annuity")
        .map((a) => ({
          id: a.id,
          name: a.labelZh || a.label,
          role: "income" as const,
          prepaid_balance_hkd: null,
          monthly_hkd: a.monthly,
          start_age: a.startAge,
          years: a.payoutYears ?? (a.endAge != null ? a.endAge - a.startAge : null),
          source: "allowance" as const,
          kind: a.kind,
        })),
    ],
    cashflow_period: {
      label: "MoneyTracker projection",
      note: "left is income minus expense for this calendar year. Past months use posted transactions. The current and later months are the yearly projection. This is not Path A surplus_cons.",
      year,
      income: round(yearRows.yearIncome),
      expense: round(yearRows.yearExpense),
      left: round(yearRows.yearSaving),
      is_path_a_surplus_cons: false,
      monthly_rows: yearRows.rows.map((row) => ({
        month: row.id,
        income: round(row.income),
        expense: round(row.expense),
        left: round(row.saving),
        status: row.month0 < month0 ? ("posted" as const) : ("projected" as const),
      })),
    },
    adhoc_payments: input.adhoc.map((a) => ({
      id: a.id,
      date: a.date,
      amount: a.amount,
      currency: a.currency,
      paid_on: a.paidOn ?? null,
      label: a.labelZh || a.label,
      // Unpaid / future adhoc are expected in the yearly projection path; paid ones are already in ledger.
      included_in_projection: !a.paidOn,
    })),
    confirmed_facts,
    open_gaps,
    checks,
  };
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function baselineChecks(input: {
  accounts: Account[];
  holdings: Holding[];
  deposits?: TimeSaving[];
  promo?: PromoSaving[];
  mortgage?: Mortgage | null;
  rates?: FxRate[];
  asOf?: string;
}): { code: string; account_id?: string; detail: string; value?: number }[];
export function baselineChecks(
  accounts: Account[],
  holdings: Holding[],
): { code: string; account_id?: string; detail: string; value?: number }[];
export function baselineChecks(
  accountsOrInput: Account[] | {
    accounts: Account[];
    holdings: Holding[];
    deposits?: TimeSaving[];
    promo?: PromoSaving[];
    mortgage?: Mortgage | null;
    rates?: FxRate[];
    asOf?: string;
  },
  holdingsMaybe?: Holding[],
): { code: string; account_id?: string; detail: string; value?: number }[] {
  const input =
    Array.isArray(accountsOrInput)
      ? { accounts: accountsOrInput, holdings: holdingsMaybe ?? [], deposits: [] as TimeSaving[], promo: [] as PromoSaving[], mortgage: null, rates: [] as FxRate[], asOf: todayHkt() }
      : {
          deposits: [] as TimeSaving[],
          promo: [] as PromoSaving[],
          mortgage: null as Mortgage | null,
          rates: [] as FxRate[],
          asOf: todayHkt(),
          ...accountsOrInput,
        };
  const { accounts, holdings, deposits, promo, mortgage, rates, asOf } = input;
  const checks: { code: string; account_id?: string; detail: string; value?: number }[] = [];

  for (const a of accounts) {
    if (!a.balanceBasis) {
      checks.push({ code: "missing_balance_basis", account_id: a.id, detail: `${a.nameZh || a.name} has no balance basis.` });
    }
    if (a.balanceBasis === "holdings_derived" && holdingsForAccount(holdings, a).length === 0) {
      checks.push({
        code: "holdings_derived_empty",
        account_id: a.id,
        detail: `${a.nameZh || a.name} says the balance follows holdings, but no holding lines match it.`,
      });
    }
  }

  const activeTd = deposits.filter((d) => !d.endDate || d.endDate >= asOf);
  const activeTdSum = round(activeTd.reduce((s, d) => s + toHkd(d.amount, d.currency, rates), 0));
  checks.push({
    code: "active_td_sum",
    detail: `Active time-deposit principal sum: ${activeTdSum} HKD (${activeTd.length} rows).`,
    value: activeTdSum,
  });

  const promoResidual = round(promo.reduce((s, p) => s + promoInHkd(p, rates), 0));
  checks.push({
    code: "promo_residual",
    detail: `Promo savings residual sum: ${promoResidual} HKD (${promo.length} rows).`,
    value: promoResidual,
  });
  if (promoResidual === 0 && deposits.some((d) => looksLikePromoDeposit(d, accounts))) {
    checks.push({
      code: "promo_expected_but_empty",
      detail: "A deposit looks like a promo (e.g. Marathon) but promo_savings residual is 0 after extraction.",
    });
  }

  for (const a of accounts) {
    if (a.balanceBasis !== "bank_total_incl_deposits") continue;
    const bal = toHkd(a.balance, a.currency, rates);
    const td = activeTd.filter((d) => d.accountId === a.id).reduce((s, d) => s + toHkd(d.amount, d.currency, rates), 0);
    const pr = promo.filter((p) => p.accountId === a.id).reduce((s, p) => s + promoInHkd(p, rates), 0);
    const approx = round(bal - td - pr);
    checks.push({
      code: "bank_total_minus_td_promo",
      account_id: a.id,
      detail: `${a.nameZh || a.name}: bank_total ${round(bal)} − TD ${round(td)} − promo ${round(pr)} ≈ ${approx} HKD available.`,
      value: approx,
    });
    if (approx < -1) {
      checks.push({
        code: "bank_total_td_promo_overshoot",
        account_id: a.id,
        detail: `${a.nameZh || a.name}: TD+promo exceed bank_total by ${round(-approx)} HKD.`,
        value: approx,
      });
    }
  }

  const holdingsSum = round(holdings.reduce((s, h) => s + holdingMarketValue(h, "HKD", rates), 0));
  const investBal = round(
    accounts
      .filter((a) => a.type === "investment" && a.balanceBasis === "holdings_derived")
      .reduce((s, a) => s + toHkd(a.balance, a.currency, rates), 0),
  );
  checks.push({
    code: "holdings_sum_vs_investment",
    detail: `Holdings MV ${holdingsSum} HKD vs holdings_derived investment balances ${investBal} HKD (diff ${round(holdingsSum - investBal)}).`,
    value: round(holdingsSum - investBal),
  });
  if (Math.abs(holdingsSum - investBal) > 1 && accounts.some((a) => a.balanceBasis === "holdings_derived")) {
    checks.push({
      code: "holdings_investment_mismatch",
      detail: `Holdings market value and holdings_derived investment account balances differ by ${round(Math.abs(holdingsSum - investBal))} HKD.`,
      value: round(holdingsSum - investBal),
    });
  }

  if (mortgage) {
    const loanAcc = accounts.find((a) => a.id === mortgage.accountId);
    if (loanAcc) {
      const accBal = Math.abs(toHkd(loanAcc.balance, loanAcc.currency, rates));
      const diff = round(mortgage.outstanding - accBal);
      if (Math.abs(diff) > 1) {
        checks.push({
          code: "liability_unexplained_diff",
          account_id: loanAcc.id,
          detail: `Mortgage outstanding ${round(mortgage.outstanding)} vs linked account |balance| ${round(accBal)} (diff ${diff} HKD).`,
          value: diff,
        });
      }
    } else {
      checks.push({
        code: "liability_unexplained_diff",
        detail: `Mortgage outstanding ${round(mortgage.outstanding)} HKD has no matching loan account.`,
        value: mortgage.outstanding,
      });
    }
  }

  return checks;
}

export function renderFcBaselineMarkdown(snap: FcBaseline): string {
  const lines = [
    `# FC baseline ${snap.meta.snapshot_id}`,
    ``,
    `- As of: ${snap.meta.as_of} (Asia/Hong_Kong)`,
    `- Calculation: ${snap.meta.calculation_id}`,
    `- Assets: ${snap.headline.assets_total} HKD`,
    `- Liabilities: ${snap.headline.liabilities_total} HKD`,
    `- Net worth: ${snap.headline.net_worth} HKD`,
    `- MPF/ORSO outside the headline: ${snap.headline.mpf_orso_outside_headline} HKD`,
    `- Accounts: ${snap.accounts.length}`,
    `- Time deposits: ${snap.deposits.length}`,
    `- Promo savings (not time deposits): ${snap.promo_savings.length}`,
    `- Holdings: ${snap.holdings.length}`,
    `- Liabilities rows: ${snap.liabilities.length}`,
    `- Adhoc: ${snap.adhoc_payments.length}`,
    ``,
    snap.meta.balance_basis_note,
    ``,
    snap.cashflow_period.note,
    ``,
    `Year ${snap.cashflow_period.year} projection: income ${snap.cashflow_period.income}, expense ${snap.cashflow_period.expense}, left ${snap.cashflow_period.left} (is_path_a_surplus_cons=${snap.cashflow_period.is_path_a_surplus_cons}).`,
    ``,
  ];

  if (snap.deposits.length) {
    lines.push(`## Deposits`, ``, `| id | principal | rate% | maturity | proceeds |`, `| --- | ---: | ---: | --- | --- |`);
    for (const d of snap.deposits) {
      lines.push(`| ${d.id} | ${d.principal} ${d.currency} | ${d.rate_pa} | ${d.maturity} | ${d.proceeds_destination ?? "—"} |`);
    }
    lines.push(``);
  }

  if (snap.promo_savings.length) {
    lines.push(`## Promo savings`, ``, `| id | residual HKD | end | name |`, `| --- | ---: | --- | --- |`);
    for (const p of snap.promo_savings) {
      lines.push(`| ${p.id} | ${p.residual_hkd} | ${p.arrangement_end} | ${p.name ?? "—"} |`);
    }
    lines.push(``);
  } else {
    lines.push(`## Promo savings`, ``, `_None in this snapshot. If a Marathon-style promo exists, add it under Deposits → Promo, or name the TD so it matches the promo pattern._`, ``);
  }

  if (snap.holdings.length) {
    lines.push(`## Holdings`, ``, `| ticker | qty | MV HKD | cost HKD |`, `| --- | ---: | ---: | ---: |`);
    for (const h of snap.holdings) {
      lines.push(`| ${h.ticker} | ${h.qty} | ${h.market_value_hkd} | ${h.cost_hkd ?? "—"} |`);
    }
    lines.push(``);
  }

  if (snap.liabilities.length) {
    lines.push(`## Liabilities`, ``);
    for (const l of snap.liabilities) {
      lines.push(
        `- ${l.name}: outstanding ${l.outstanding_hkd} HKD, monthly ${l.monthly_payment ?? "—"}, rate ${l.rate_pa}` +
          (l.rate_linked_savings_account_id ? `, rate-linked savings ${l.rate_linked_savings_account_id}` : ""),
      );
    }
    lines.push(``);
  }

  if (snap.annuities.length) {
    lines.push(`## Annuities (prepaid vs income)`, ``);
    for (const a of snap.annuities) {
      if (a.role === "prepaid") {
        lines.push(`- [prepaid] ${a.name}: balance ${a.prepaid_balance_hkd} HKD (${a.kind})`);
      } else {
        lines.push(`- [income] ${a.name}: ${a.monthly_hkd} HKD/mo from age ${a.start_age ?? "—"} (${a.kind})`);
      }
    }
    lines.push(``);
  }

  if (snap.cashflow_period.monthly_rows.length) {
    lines.push(
      `## Cashflow months (${snap.cashflow_period.label}; is_path_a_surplus_cons=${snap.cashflow_period.is_path_a_surplus_cons})`,
      ``,
      `| month | income | expense | left | status |`,
      `| --- | ---: | ---: | ---: | --- |`,
    );
    for (const r of snap.cashflow_period.monthly_rows) {
      lines.push(`| ${r.month} | ${r.income} | ${r.expense} | ${r.left} | ${r.status} |`);
    }
    lines.push(``);
  }

  if (snap.adhoc_payments.length) {
    lines.push(`## Adhoc`, ``, `| date | amount | paid_on | label | in_projection |`, `| --- | ---: | --- | --- | --- |`);
    for (const a of snap.adhoc_payments) {
      lines.push(`| ${a.date} | ${a.amount} ${a.currency} | ${a.paid_on ?? "—"} | ${a.label} | ${a.included_in_projection} |`);
    }
    lines.push(``);
  }

  if (snap.confirmed_facts.length) {
    lines.push(`## Confirmed facts`, ``);
    for (const f of snap.confirmed_facts) lines.push(`- ${f}`);
    lines.push(``);
  }
  if (snap.open_gaps.length) {
    lines.push(`## Open gaps`, ``);
    for (const g of snap.open_gaps) lines.push(`- ${g}`);
    lines.push(``);
  }
  if (snap.checks.length) {
    lines.push(`## Checks`, ``);
    for (const c of snap.checks) lines.push(`- [${c.code}] ${c.detail}`);
    lines.push(``);
  }
  lines.push(`_Full machine-readable sections are in the companion \`.json\` (accounts, deposits, holdings, liabilities, …). Prefer pasting that JSON to 財務寶寶._`, ``);
  return lines.join("\n");
}
