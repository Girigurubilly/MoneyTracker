import { yearlyProjection } from "./deposits.ts";
import { toHkd } from "./fx.ts";
import { holdingsForAccount, holdingMarketValue } from "../holdings.ts";
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

const PROMO_HINT = /marathon|馬拉松|promo savings|推廣儲蓄/i;

export function todayHkt(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function migrateBalanceBasis(accounts: Account[]): Account[] {
  return accounts.map((a) => {
    if (a.balanceBasis) return a;
    const basis: BalanceBasis = a.type === "investment" && (a.holdingSync || a.stockBook) ? "holdings_derived" : "unverified";
    return { ...a, balanceBasis: basis };
  });
}

export function extractPromoDeposits(deposits: TimeSaving[], existing: PromoSaving[], rates: FxRate[]): { deposits: TimeSaving[]; promo: PromoSaving[] } {
  const promo = [...existing];
  const keep: TimeSaving[] = [];
  for (const d of deposits) {
    if (!PROMO_HINT.test(`${d.bank} ${d.id}`)) {
      keep.push(d);
      continue;
    }
    const id = d.id.startsWith("promo-") ? d.id : `promo-${d.id}`;
    if (!promo.some((p) => p.id === id)) {
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
    proceeds_destination: null;
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
    rate_pa: number;
    rate_unit: "decimal_per_annum";
    remaining_months: number;
    payment_day: number;
    type: Mortgage["type"];
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
  annuities: { id: string; name: string; monthly_hkd: number; start_age: number }[];
  cashflow_period: {
    label: "MoneyTracker projection";
    note: string;
    year: number;
    income: number;
    expense: number;
    left: number;
    monthly_rows: { month: string; income: number; expense: number; left: number; status: "posted" | "projected" }[];
  };
  adhoc_payments: { id: string; date: string; amount: number; currency: string; paid_on: string | null; label: string }[];
  confirmed_facts: string[];
  open_gaps: string[];
  checks: { code: string; account_id?: string; detail: string }[];
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
}): FcBaseline {
  const asOf = input.asOf ?? todayHkt();
  const year = Number(asOf.slice(0, 4));
  const month0 = Number(asOf.slice(5, 7)) - 1;
  const nw = netWorthNow(input.accounts, input.rates, input.deposits, asOf);
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
  const yearRows = yearlyProjection(input.plans, input.deposits, input.rates, year, month0, input.txs, input.categories, input.monthCap, input.recurring, asOf);
  const checks = baselineChecks(input.accounts, input.holdings);
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
        currency: a.currency,
        fx_rate: fx ? fx.perHkd : a.currency === "HKD" ? 1 : null,
        fx_as_of: fx?.asOf ?? null,
        notes: a.notesZh || a.notes || null,
      };
    }),
    deposits: input.deposits.map((d) => ({
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
      proceeds_destination: null,
    })),
    promo_savings: input.promo.map((p) => ({
      id: p.id,
      account_id: p.accountId,
      residual_hkd: p.residualHkd,
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
      policy_note: POLICY,
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
            rate_pa: input.mortgage.rate,
            rate_unit: "decimal_per_annum" as const,
            remaining_months: input.mortgage.remainingMonths,
            payment_day: input.mortgage.paymentDay,
            type: input.mortgage.type,
          },
        ]
      : [],
    retirement_restricted,
    annuities: input.allowances
      .filter((a) => a.kind === "annuity")
      .map((a) => ({ id: a.id, name: a.labelZh || a.label, monthly_hkd: a.monthly, start_age: a.startAge })),
    cashflow_period: {
      label: "MoneyTracker projection",
      note: "left is income minus expense for this calendar year. Past months use posted transactions. The current and later months are the yearly projection. This is not Path A surplus_cons.",
      year,
      income: round(yearRows.yearIncome),
      expense: round(yearRows.yearExpense),
      left: round(yearRows.yearSaving),
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
    })),
    confirmed_facts: [
      "Headline net worth uses the same netWorthNow total as the assets page, including a time deposit only when its principal is not already inside the linked account balance.",
      "Promo savings are an arrangement on an existing account. They are not added again as assets.",
      "Cashflow left is income minus expense. surplus_cons is not calculated.",
    ],
    open_gaps: [
      "Deposit proceeds_destination is not stored.",
      ...checks.map((c) => c.detail),
    ],
    checks,
  };
}

export function baselineChecks(accounts: Account[], holdings: Holding[]): { code: string; account_id?: string; detail: string }[] {
  const checks: { code: string; account_id?: string; detail: string }[] = [];
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
    `- Time deposits: ${snap.deposits.length}`,
    `- Promo savings (not time deposits): ${snap.promo_savings.length}`,
    `- Holdings: ${snap.holdings.length}`,
    ``,
    snap.meta.balance_basis_note,
    ``,
    snap.cashflow_period.note,
    ``,
    `Year ${snap.cashflow_period.year} projection: income ${snap.cashflow_period.income}, expense ${snap.cashflow_period.expense}, left ${snap.cashflow_period.left}.`,
    ``,
  ];
  if (snap.checks.length) {
    lines.push(`## Checks`, ``);
    for (const c of snap.checks) lines.push(`- ${c.detail}`);
    lines.push(``);
  }
  return lines.join("\n");
}
