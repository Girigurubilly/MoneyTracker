import type {
  Account,
  AccountType,
  Category,
  FxRate,
  Holding,
  Mortgage,
  Recurring,
  RetirementAccount,
  TimeSaving,
  Transaction,
} from "../types.ts";
import { ACCOUNT_TYPE_OPTIONS } from "../types.ts";
import { toHkd } from "./fx.ts";
import { cashflowSide } from "./ledger.ts";
import { monthFlow } from "./budget.ts";
import { investableNow, netWorthNow, periodNetWorthPoints } from "./networth.ts";
import { todayISO } from "../format.ts";

const LIQUID_TYPES = new Set<AccountType>(["cash", "current", "savings", "ewallet", "fx", "debit"]);

function roundHkd(n: number): number {
  return Math.round(n);
}

function typeLabel(type: AccountType): string {
  return ACCOUNT_TYPE_OPTIONS.find((o) => o.id === type)?.en ?? type;
}

function sleeveOf(type: AccountType): "liquid" | "invest" | "mpf" | "property" | "credit" | "loan" | "mortgage" | "other" {
  if (LIQUID_TYPES.has(type)) return "liquid";
  if (type === "investment" || type === "other_asset") return "invest";
  if (type === "mpf") return "mpf";
  if (type === "property") return "property";
  if (type === "credit") return "credit";
  if (type === "loan") return "loan";
  if (type === "mortgage") return "mortgage";
  return "other";
}

function parentBucket(tx: Transaction, categories: Category[]): { id: string; name: string; nameZh: string } {
  const c = categories.find((x) => x.id === tx.categoryId);
  if (!c) return { id: "uncat", name: "Uncategorised", nameZh: "未分類" };
  const p = c.parentId ? categories.find((x) => x.id === c.parentId) : undefined;
  const top = p ?? c;
  return { id: top.id, name: top.name, nameZh: top.nameZh };
}

function mixTotals(
  txs: Transaction[],
  categories: Category[],
  rates: FxRate[],
  from: string,
  to: string,
  side: "income" | "expense",
  limit = 8,
): { name: string; nameZh: string; amount: number; share: number }[] {
  const map = new Map<string, { name: string; nameZh: string; amount: number }>();
  let total = 0;
  for (const tx of txs) {
    if (cashflowSide(tx) !== side) continue;
    if (tx.date < from || tx.date > to) continue;
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    total += hkd;
    const b = parentBucket(tx, categories);
    const row = map.get(b.id) ?? { name: b.name, nameZh: b.nameZh, amount: 0 };
    row.amount += hkd;
    map.set(b.id, row);
  }
  return [...map.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((r) => ({ ...r, amount: roundHkd(r.amount), share: total > 0 ? r.amount / total : 0 }));
}

function monthKeysBack(fromMonth: string, n: number): string[] {
  const [y, m] = fromMonth.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export type AssetBriefMonth = {
  month: string;
  income: number;
  expense: number;
  cashflow: number;
  netWorth: number;
  assets: number;
  liab: number;
  nwChange: number;
};

export type AssetBriefAccount = {
  name: string;
  nameZh: string;
  type: AccountType;
  group: Account["group"];
  currency: string;
  balance: number;
  hkd: number;
  includeInNetWorth: boolean;
  hidden: boolean;
};

export type AssetBrief = {
  generatedAt: string;
  today: string;
  from: string;
  to: string;
  position: {
    net: number;
    assets: number;
    liab: number;
    investable: number;
    liquid: number;
    investments: number;
    mpf: number;
    property: number;
    credit: number;
    loans: number;
    mortgage: number;
    excludedHkd: number;
    debtToAssets: number | null;
    liquidRunwayMonths: number | null;
  };
  flow12: {
    income: number;
    expense: number;
    net: number;
    monthlyIncome: number;
    monthlySpend: number;
    monthlySave: number;
    savingsRate: number | null;
    surplusMonths: number;
    deficitMonths: number;
    bestMonth: string;
    worstMonth: string;
    avgNwChange: number;
  };
  months: AssetBriefMonth[];
  spendMix: { name: string; nameZh: string; amount: number; share: number }[];
  incomeMix: { name: string; nameZh: string; amount: number; share: number }[];
  accounts: AssetBriefAccount[];
  holdings: { market: string; symbol: string; name: string; valueHkd: number; shareOfHoldings: number }[];
  deposits: { bank: string; amount: number; currency: string; hkd: number; endDate: string; rate: number }[];
  retirementAccounts: { name: string; type: string; balance: number; status: string; accessAge: number }[];
  mortgage: { outstanding: number; remainingMonths: number; rate: number } | null;
  recurringMonthly: { income: number; expense: number };
};

export function buildAssetBrief(input: {
  today?: string;
  accounts: Account[];
  rates: FxRate[];
  txs: Transaction[];
  categories: Category[];
  holdings?: Holding[];
  deposits?: TimeSaving[];
  retirementAccounts?: RetirementAccount[];
  mortgage?: Mortgage | null;
  recurring?: Recurring[];
}): AssetBrief {
  const today = input.today ?? todayISO();
  const month = today.slice(0, 7);
  const monthsKeys = monthKeysBack(month, 12);
  const from = `${monthsKeys[0]}-01`;
  const to = today;
  const nw = netWorthNow(input.accounts, input.rates);
  const sleeves = {
    liquid: 0,
    invest: 0,
    mpf: 0,
    property: 0,
    credit: 0,
    loan: 0,
    mortgage: 0,
    other: 0,
  };
  let excludedHkd = 0;
  const accounts: AssetBriefAccount[] = input.accounts.map((a) => {
    const hkd = toHkd(a.balance, a.currency, input.rates);
    if (!a.includeInNetWorth || a.currency === "MILES") {
      if (a.currency !== "MILES") excludedHkd += hkd;
    } else {
      const s = sleeveOf(a.type);
      if (hkd >= 0) {
        if (s === "liquid" || s === "invest" || s === "mpf" || s === "property" || s === "other") sleeves[s] += hkd;
      } else {
        if (s === "credit" || s === "loan" || s === "mortgage") sleeves[s] += -hkd;
        else if (s === "liquid") sleeves.credit += -hkd;
      }
    }
    return {
      name: a.name,
      nameZh: a.nameZh || a.name,
      type: a.type,
      group: a.group,
      currency: a.currency,
      balance: a.balance,
      hkd: roundHkd(hkd),
      includeInNetWorth: a.includeInNetWorth && a.currency !== "MILES",
      hidden: Boolean(a.hidden),
    };
  });
  accounts.sort((a, b) => Math.abs(b.hkd) - Math.abs(a.hkd));

  const worthPts = periodNetWorthPoints(input.accounts, input.txs, input.rates, from, to);
  const worthByMonth = new Map<string, (typeof worthPts)[number]>();
  for (const p of worthPts) worthByMonth.set(p.date.slice(0, 7), p);

  const months: AssetBriefMonth[] = [];
  let prevNet: number | null = null;
  for (const key of monthsKeys) {
    const flow = monthFlow(input.txs, key, input.rates);
    const pt = worthByMonth.get(key);
    const netWorth = pt?.net ?? nw.net;
    const nwChange = prevNet == null ? 0 : netWorth - prevNet;
    months.push({
      month: key,
      income: roundHkd(flow.income),
      expense: roundHkd(flow.expense),
      cashflow: roundHkd(flow.net),
      netWorth: roundHkd(netWorth),
      assets: roundHkd(pt?.assets ?? nw.assets),
      liab: roundHkd(pt?.liab ?? nw.liab),
      nwChange: roundHkd(nwChange),
    });
    prevNet = netWorth;
  }

  const income = months.reduce((s, m) => s + m.income, 0);
  const expense = months.reduce((s, m) => s + m.expense, 0);
  const net = income - expense;
  const monthlyIncome = income / 12;
  const monthlySpend = expense / 12;
  const monthlySave = monthlyIncome - monthlySpend;
  const surplusMonths = months.filter((m) => m.cashflow > 0).length;
  const deficitMonths = months.filter((m) => m.cashflow < 0).length;
  const best = months.reduce((a, b) => (b.cashflow > a.cashflow ? b : a), months[0]);
  const worst = months.reduce((a, b) => (b.cashflow < a.cashflow ? b : a), months[0]);
  const nwDeltas = months.slice(1).map((m) => m.nwChange);
  const avgNwChange = nwDeltas.length ? nwDeltas.reduce((s, n) => s + n, 0) / nwDeltas.length : 0;

  const holdingRows = (input.holdings ?? []).map((h) => ({
    market: h.market,
    symbol: h.symbol,
    name: h.name || h.symbol,
    valueHkd: toHkd(h.quantity * (h.lastPrice || 0), h.currency, input.rates),
  }));
  const holdTotal = holdingRows.reduce((s, h) => s + h.valueHkd, 0);
  const holdings = holdingRows
    .sort((a, b) => b.valueHkd - a.valueHkd)
    .slice(0, 12)
    .map((h) => ({
      ...h,
      valueHkd: roundHkd(h.valueHkd),
      shareOfHoldings: holdTotal > 0 ? h.valueHkd / holdTotal : 0,
    }));

  let recIncome = 0;
  let recExpense = 0;
  for (const r of input.recurring ?? []) {
    if (r.frequency !== "monthly") continue;
    const hkd = Math.abs(toHkd(r.amount, r.currency, input.rates));
    if (r.type === "income") recIncome += hkd;
    else recExpense += hkd;
  }

  const m = input.mortgage;
  return {
    generatedAt: new Date().toISOString(),
    today,
    from,
    to,
    position: {
      net: roundHkd(nw.net),
      assets: roundHkd(nw.assets),
      liab: roundHkd(nw.liab),
      investable: roundHkd(investableNow(input.accounts, input.rates)),
      liquid: roundHkd(sleeves.liquid),
      investments: roundHkd(sleeves.invest),
      mpf: roundHkd(sleeves.mpf),
      property: roundHkd(sleeves.property),
      credit: roundHkd(sleeves.credit),
      loans: roundHkd(sleeves.loan),
      mortgage: roundHkd(sleeves.mortgage),
      excludedHkd: roundHkd(excludedHkd),
      debtToAssets: nw.assets > 0 ? nw.liab / nw.assets : null,
      liquidRunwayMonths: monthlySpend > 0 ? sleeves.liquid / monthlySpend : null,
    },
    flow12: {
      income: roundHkd(income),
      expense: roundHkd(expense),
      net: roundHkd(net),
      monthlyIncome: roundHkd(monthlyIncome),
      monthlySpend: roundHkd(monthlySpend),
      monthlySave: roundHkd(monthlySave),
      savingsRate: monthlyIncome > 0 ? monthlySave / monthlyIncome : null,
      surplusMonths,
      deficitMonths,
      bestMonth: best?.month ?? month,
      worstMonth: worst?.month ?? month,
      avgNwChange: roundHkd(avgNwChange),
    },
    months,
    spendMix: mixTotals(input.txs, input.categories, input.rates, from, to, "expense"),
    incomeMix: mixTotals(input.txs, input.categories, input.rates, from, to, "income"),
    accounts,
    holdings,
    deposits: (input.deposits ?? []).map((d) => ({
      bank: d.bank,
      amount: d.amount,
      currency: d.currency,
      hkd: roundHkd(toHkd(d.amount, d.currency, input.rates)),
      endDate: d.endDate,
      rate: d.rate,
    })),
    retirementAccounts: (input.retirementAccounts ?? [])
      .filter((ra) => ra.status !== "closed")
      .map((ra) => ({
        name: ra.name,
        type: ra.type,
        balance: roundHkd(ra.currentBalance),
        status: ra.status,
        accessAge: ra.accessibleAge,
      })),
    mortgage: m
      ? { outstanding: roundHkd(m.outstanding), remainingMonths: m.remainingMonths, rate: m.rate }
      : null,
    recurringMonthly: { income: roundHkd(recIncome), expense: roundHkd(recExpense) },
  };
}

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return `${(n * 100).toFixed(1)}%`;
}

function insights(b: AssetBrief): string[] {
  const p = b.position;
  const f = b.flow12;
  const lines: string[] = [];
  lines.push(
    `Net worth is HKD ${p.net.toLocaleString("en-HK")} (assets ${p.assets.toLocaleString("en-HK")} − liabilities ${p.liab.toLocaleString("en-HK")}).`,
  );
  if (p.assets > 0) {
    lines.push(
      `Mix of included assets: liquid ${pct(p.liquid / p.assets)}, investments ${pct(p.investments / p.assets)}, MPF ${pct(p.mpf / p.assets)}, property ${pct(p.property / p.assets)}.`,
    );
  }
  if (p.debtToAssets != null) lines.push(`Debt-to-assets ${pct(p.debtToAssets)}.`);
  if (p.liquidRunwayMonths != null) {
    lines.push(`Liquid cash covers about ${p.liquidRunwayMonths.toFixed(1)} months of the last-12-month average spend.`);
  }
  lines.push(
    `Last 12 months cash flow: income ${f.income.toLocaleString("en-HK")}, spend ${f.expense.toLocaleString("en-HK")}, net ${f.net.toLocaleString("en-HK")} (savings rate ${pct(f.savingsRate)}). ${f.surplusMonths} surplus months, ${f.deficitMonths} deficit months.`,
  );
  lines.push(
    `Average month-on-month net-worth change HKD ${f.avgNwChange.toLocaleString("en-HK")}. Best cash-flow month ${f.bestMonth}, weakest ${f.worstMonth}.`,
  );
  const topAcct = b.accounts.find((a) => a.includeInNetWorth && a.hkd > 0);
  if (topAcct && p.assets > 0) {
    lines.push(
      `Largest included asset account is ${topAcct.name} (${pct(topAcct.hkd / p.assets)} of assets).`,
    );
  }
  if (b.holdings[0]) {
    lines.push(
      `Largest holding ${b.holdings[0].symbol} is ${pct(b.holdings[0].shareOfHoldings)} of listed holdings market value.`,
    );
  }
  const cfSum = b.months.reduce((s, m) => s + m.cashflow, 0);
  const nwSum = b.months.slice(1).reduce((s, m) => s + m.nwChange, 0);
  if (Math.abs(cfSum - nwSum) > 1000) {
    lines.push(
      `Cash-flow net (${roundHkd(cfSum)}) differs from reconstructed net-worth change (${roundHkd(nwSum)}). Transfers, excluded accounts, FX, holdings marks or manual balances can explain the gap — do not treat them as the same series.`,
    );
  }
  return lines;
}

export function renderAssetBriefMarkdown(b: AssetBrief): string {
  const lines = [
    "# HK Life Money — current assets & cash-flow brief",
    `Generated: ${b.generatedAt}`,
    `As of: ${b.today} (HKD). Window: ${b.from} → ${b.to} (12 calendar months).`,
    "",
    "Planning illustration from on-device ledger data. Combine this file with the retirement / FIRE export for a full picture. Not advice.",
    "",
    "## Headline insights",
    ...insights(b).map((s) => `- ${s}`),
    "",
    "## Current position (HKD)",
    `- Net worth: ${b.position.net}`,
    `- Assets: ${b.position.assets}`,
    `- Liabilities: ${b.position.liab}`,
    `- Investable (ex property & linked mortgage): ${b.position.investable}`,
    `- Liquid (cash, bank, e-wallet, FX, debit): ${b.position.liquid}`,
    `- Investments: ${b.position.investments}`,
    `- MPF / locked on asset list: ${b.position.mpf}`,
    `- Property: ${b.position.property}`,
    `- Credit cards: ${b.position.credit}`,
    `- Loans: ${b.position.loans}`,
    `- Mortgage balance (accounts): ${b.position.mortgage}`,
    `- Excluded from net worth (still listed): ${b.position.excludedHkd}`,
    `- Debt-to-assets: ${pct(b.position.debtToAssets)}`,
    `- Liquid runway (months of avg spend): ${b.position.liquidRunwayMonths == null ? "n/a" : b.position.liquidRunwayMonths.toFixed(1)}`,
    "",
    "## Last 12 months cash flow (posted income − posted spend)",
    `- Income: ${b.flow12.income}`,
    `- Spend: ${b.flow12.expense}`,
    `- Net saved: ${b.flow12.net}`,
    `- Average monthly income: ${b.flow12.monthlyIncome}`,
    `- Average monthly spend: ${b.flow12.monthlySpend}`,
    `- Average monthly saving: ${b.flow12.monthlySave}`,
    `- Savings rate: ${pct(b.flow12.savingsRate)}`,
    `- Recurring monthly income (scheduled): ${b.recurringMonthly.income}`,
    `- Recurring monthly spend (scheduled): ${b.recurringMonthly.expense}`,
    "",
    "## Monthly cash movement and net-worth increment",
    "month,income,spend,cashflow_net,net_worth,nw_change,assets,liabilities",
    ...b.months.map(
      (m) => `${m.month},${m.income},${m.expense},${m.cashflow},${m.netWorth},${m.nwChange},${m.assets},${m.liab}`,
    ),
    "",
    "cashflow_net is posted income minus posted spend (transfers ignored). nw_change is reconstructed net worth versus the previous month-end. First-month nw_change is 0 by definition.",
    "",
    "## Income mix (12 months, parent category)",
    "name,name_zh,amount_hkd,share",
    ...(b.incomeMix.length
      ? b.incomeMix.map((r) => `${csv(r.name)},${csv(r.nameZh)},${r.amount},${pct(r.share)}`)
      : ["(none)"]),
    "",
    "## Spend mix (12 months, parent category)",
    "name,name_zh,amount_hkd,share",
    ...(b.spendMix.length
      ? b.spendMix.map((r) => `${csv(r.name)},${csv(r.nameZh)},${r.amount},${pct(r.share)}`)
      : ["(none)"]),
    "",
    "## Accounts",
    "name,name_zh,type,group,currency,balance_native,value_hkd,in_net_worth,hidden",
    ...b.accounts.map(
      (a) =>
        `${csv(a.name)},${csv(a.nameZh)},${typeLabel(a.type)},${a.group},${a.currency},${a.balance},${a.hkd},${a.includeInNetWorth ? "yes" : "no"},${a.hidden ? "yes" : "no"}`,
    ),
    "",
    "## Holdings (marked to market)",
    "market,symbol,name,value_hkd,share_of_holdings",
    ...(b.holdings.length
      ? b.holdings.map((h) => `${h.market},${h.symbol},${csv(h.name)},${h.valueHkd},${pct(h.shareOfHoldings)}`)
      : ["(none)"]),
    "",
    "## Time deposits",
    "bank,amount,currency,value_hkd,end,rate",
    ...(b.deposits.length
      ? b.deposits.map((d) => `${csv(d.bank)},${d.amount},${d.currency},${d.hkd},${d.endDate},${d.rate}`)
      : ["(none)"]),
    "",
    "## Retirement accounts (MPF / ORSO / annuity)",
    "name,type,balance,status,access_age",
    ...(b.retirementAccounts.length
      ? b.retirementAccounts.map((r) => `${csv(r.name)},${r.type},${r.balance},${r.status},${r.accessAge}`)
      : ["(none)"]),
    "",
    "## Mortgage record",
    b.mortgage
      ? `- Outstanding: ${b.mortgage.outstanding}; remaining months: ${b.mortgage.remainingMonths}; rate: ${b.mortgage.rate}`
      : "(none)",
    "",
    "## How to use with an LLM",
    "Paste this markdown together with the retirement / FIRE brief from Reports → Retirement → Export for AI. Ask for: (1) whether the last-12-month saving rate can fund the retirement target, (2) liquidity vs investment mix, (3) concentration and debt, (4) a monthly saving / allocation recommendation. Treat figures as an illustration from this device only.",
  ];
  return lines.join("\n");
}

function csv(s: string): string {
  const t = s.replace(/"/g, "'");
  return /[,\n]/.test(t) ? `"${t}"` : t;
}
