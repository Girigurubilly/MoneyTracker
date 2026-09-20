import type { Category, FireSpendKind, FxRate, Transaction } from "../types.ts";
import { toHkd } from "./fx.ts";
import { cashflowSide } from "./ledger.ts";
import { periodCashflowPoints, type PeriodPreset } from "./period.ts";

const PRESET_LABEL: Record<PeriodPreset, string> = {
  "this-month": "this month",
  "last-month": "last month",
  "this-year": "this year",
  "last-year": "last year",
  all: "all time",
  custom: "custom range",
};

function roundHkd(n: number): number {
  return Math.round(n);
}

function daysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function payeeOf(tx: Transaction): string {
  return (tx.payee || tx.note || "").trim() || "(no payee)";
}

function catOf(categories: Category[], id?: string): Category | undefined {
  return id ? categories.find((c) => c.id === id) : undefined;
}

function parentOf(categories: Category[], cat: Category | undefined): Category | undefined {
  if (!cat) return undefined;
  return cat.parentId ? catOf(categories, cat.parentId) ?? cat : cat;
}

export type SpendBriefTxn = {
  date: string;
  payee: string;
  category: string;
  categoryZh: string;
  amount: number;
  currency: string;
  adhoc: boolean;
  recurring: boolean;
  note?: string;
};

export type SpendBriefLeaf = {
  id: string;
  name: string;
  nameZh: string;
  amount: number;
  share: number;
  count: number;
  avg: number;
  largest: SpendBriefTxn[];
};

export type SpendBriefCategory = SpendBriefLeaf & {
  theme: string;
  fireKind: FireSpendKind | "untagged";
  children: SpendBriefLeaf[];
};

export type SpendBrief = {
  generatedAt: string;
  today: string;
  from: string;
  to: string;
  preset: PeriodPreset;
  presetLabel: string;
  hideAdhoc: boolean;
  mergeParents: boolean;
  days: number;
  flow: {
    income: number;
    expense: number;
    net: number;
    savingsRate: number | null;
    dailySpend: number;
    dailyIncome: number;
    monthlySpend: number;
    monthlyIncome: number;
    txCountIncome: number;
    txCountExpense: number;
    avgExpenseTicket: number;
    medianExpenseTicket: number;
  };
  adhoc: {
    filterOn: boolean;
    excludedCount: number;
    excludedAmount: number;
    includedCount: number;
    includedAmount: number;
    shareOfSpendIfIncluded: number | null;
  };
  recurringSpend: { amount: number; count: number; share: number | null };
  oneOffSpend: { amount: number; count: number; share: number | null };
  themes: { theme: string; amount: number; share: number }[];
  fireKinds: { kind: string; amount: number; share: number }[];
  categories: SpendBriefCategory[];
  incomeCategories: SpendBriefCategory[];
  topExpenses: SpendBriefTxn[];
  topIncome: SpendBriefTxn[];
  payees: { name: string; amount: number; count: number; share: number }[];
  series: { key: string; income: number; expense: number; net: number }[];
  grain: "day" | "month";
};

type Agg = {
  id: string;
  name: string;
  nameZh: string;
  theme: string;
  fireKind: FireSpendKind | "untagged";
  parentId?: string;
  amount: number;
  count: number;
  txs: SpendBriefTxn[];
};

function emptyAgg(id: string, cat: Category | undefined, side: "income" | "expense"): Agg {
  const fallback = id.startsWith("uncat") ? (side === "income" ? "Other income" : "Other") : id;
  const fallbackZh = id.startsWith("uncat") ? "其他" : id;
  return {
    id,
    name: cat?.name ?? fallback,
    nameZh: cat?.nameZh ?? fallbackZh,
    theme: cat?.theme ?? "other",
    fireKind: cat?.fireSpendKind ?? "untagged",
    parentId: cat?.parentId,
    amount: 0,
    count: 0,
    txs: [],
  };
}

function toBriefTxn(tx: Transaction, cat: Category | undefined, hkd: number): SpendBriefTxn {
  return {
    date: tx.date,
    payee: payeeOf(tx),
    category: cat?.name ?? "Uncategorised",
    categoryZh: cat?.nameZh ?? "未分類",
    amount: roundHkd(hkd),
    currency: String(tx.currency),
    adhoc: Boolean(tx.adhoc),
    recurring: Boolean(tx.recurringId),
    note: tx.note,
  };
}

function takeLargest(txs: SpendBriefTxn[], n: number): SpendBriefTxn[] {
  return [...txs].sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date)).slice(0, n);
}

function leafOf(agg: Agg, parentTotal: number): SpendBriefLeaf {
  return {
    id: agg.id,
    name: agg.name,
    nameZh: agg.nameZh,
    amount: roundHkd(agg.amount),
    share: parentTotal > 0 ? agg.amount / parentTotal : 0,
    count: agg.count,
    avg: agg.count ? roundHkd(agg.amount / agg.count) : 0,
    largest: takeLargest(agg.txs, 3),
  };
}

function buildTree(leaves: Map<string, Agg>, parents: Map<string, Agg>, total: number): SpendBriefCategory[] {
  const rows: SpendBriefCategory[] = [];
  for (const p of parents.values()) {
    const kids = [...leaves.values()]
      .filter((l) => l.parentId === p.id)
      .sort((a, b) => b.amount - a.amount)
      .map((l) => leafOf(l, p.amount));
    rows.push({
      ...leafOf(p, total),
      theme: p.theme,
      fireKind: p.fireKind,
      children: kids,
    });
  }
  rows.sort((a, b) => b.amount - a.amount);
  return rows;
}

function accumulate(
  txs: Transaction[],
  categories: Category[],
  rates: FxRate[],
  from: string,
  to: string,
  side: "income" | "expense",
  hideAdhoc: boolean,
): { parents: Map<string, Agg>; leaves: Map<string, Agg>; listed: SpendBriefTxn[]; amounts: number[] } {
  const parents = new Map<string, Agg>();
  const leaves = new Map<string, Agg>();
  const listed: SpendBriefTxn[] = [];
  const amounts: number[] = [];
  for (const tx of txs) {
    if (tx.planned) continue;
    if (hideAdhoc && tx.adhoc) continue;
    if (tx.date < from || tx.date > to) continue;
    if (cashflowSide(tx) !== side) continue;
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    if (hkd <= 0) continue;
    const cat = catOf(categories, tx.categoryId);
    const parent = parentOf(categories, cat);
    const leafId = cat?.id ?? (side === "income" ? "uncat-in" : "uncat-out");
    const parentId = parent?.id ?? leafId;
    const row = toBriefTxn(tx, cat, hkd);
    listed.push(row);
    amounts.push(hkd);
    const leaf = leaves.get(leafId) ?? emptyAgg(leafId, cat, side);
    leaf.amount += hkd;
    leaf.count += 1;
    leaf.txs.push(row);
    leaves.set(leafId, leaf);
    const p = parents.get(parentId) ?? emptyAgg(parentId, parent ?? cat, side);
    p.amount += hkd;
    p.count += 1;
    p.txs.push(row);
    parents.set(parentId, p);
  }
  listed.sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date));
  return { parents, leaves, listed, amounts };
}

export function buildSpendBrief(input: {
  today?: string;
  from: string;
  to: string;
  preset: PeriodPreset;
  hideAdhoc: boolean;
  mergeParents?: boolean;
  txs: Transaction[];
  categories: Category[];
  rates: FxRate[];
}): SpendBrief {
  const today = input.today ?? input.to;
  const from = input.from;
  const to = input.to;
  const hideAdhoc = input.hideAdhoc;
  const days = daysInclusive(from, to);
  const months = days / 30.4375;

  let adhocCount = 0;
  let adhocAmount = 0;
  let includedAdhocCount = 0;
  let includedAdhocAmount = 0;
  let allExpense = 0;
  for (const tx of input.txs) {
    if (tx.planned) continue;
    if (tx.date < from || tx.date > to) continue;
    if (cashflowSide(tx) !== "expense") continue;
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, input.rates, tx.fxToHkd));
    allExpense += hkd;
    if (!tx.adhoc) continue;
    adhocCount += 1;
    adhocAmount += hkd;
    if (!hideAdhoc) {
      includedAdhocCount += 1;
      includedAdhocAmount += hkd;
    }
  }

  const exp = accumulate(input.txs, input.categories, input.rates, from, to, "expense", hideAdhoc);
  const inc = accumulate(input.txs, input.categories, input.rates, from, to, "income", false);
  const expense = exp.amounts.reduce((s, n) => s + n, 0);
  const income = inc.amounts.reduce((s, n) => s + n, 0);
  const net = income - expense;
  const categories = buildTree(exp.leaves, exp.parents, expense);
  const incomeCategories = buildTree(inc.leaves, inc.parents, income);

  let recAmt = 0;
  let recCount = 0;
  for (const row of exp.listed) {
    if (!row.recurring) continue;
    recAmt += row.amount;
    recCount += 1;
  }
  const oneAmt = expense - recAmt;
  const oneCount = exp.listed.length - recCount;

  const themeMap = new Map<string, number>();
  const fireMap = new Map<string, number>();
  for (const c of categories) {
    themeMap.set(c.theme, (themeMap.get(c.theme) ?? 0) + c.amount);
    fireMap.set(c.fireKind, (fireMap.get(c.fireKind) ?? 0) + c.amount);
  }
  const themes = [...themeMap.entries()]
    .map(([theme, amount]) => ({ theme, amount: roundHkd(amount), share: expense > 0 ? amount / expense : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const fireKinds = [...fireMap.entries()]
    .map(([kind, amount]) => ({ kind, amount: roundHkd(amount), share: expense > 0 ? amount / expense : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const payeeMap = new Map<string, { amount: number; count: number }>();
  for (const row of exp.listed) {
    const cur = payeeMap.get(row.payee) ?? { amount: 0, count: 0 };
    cur.amount += row.amount;
    cur.count += 1;
    payeeMap.set(row.payee, cur);
  }
  const payees = [...payeeMap.entries()]
    .map(([name, v]) => ({ name, amount: roundHkd(v.amount), count: v.count, share: expense > 0 ? v.amount / expense : 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const flow = periodCashflowPoints(input.txs, input.rates, from, to, hideAdhoc);
  let series = flow.points.map((p) => ({
    key: p.key,
    income: roundHkd(p.income),
    expense: roundHkd(p.expense),
    net: roundHkd(p.net),
  }));
  if (flow.grain === "month") {
    const filled: typeof series = [];
    const map = new Map(series.map((p) => [p.key, p]));
    let y = Number(from.slice(0, 4));
    let m = Number(from.slice(5, 7));
    const ey = Number(to.slice(0, 4));
    const em = Number(to.slice(5, 7));
    while (y < ey || (y === ey && m <= em)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      filled.push(map.get(key) ?? { key, income: 0, expense: 0, net: 0 });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    series = filled;
  }

  return {
    generatedAt: new Date().toISOString(),
    today,
    from,
    to,
    preset: input.preset,
    presetLabel: PRESET_LABEL[input.preset],
    hideAdhoc,
    mergeParents: input.mergeParents ?? true,
    days,
    flow: {
      income: roundHkd(income),
      expense: roundHkd(expense),
      net: roundHkd(net),
      savingsRate: income > 0 ? net / income : null,
      dailySpend: roundHkd(expense / days),
      dailyIncome: roundHkd(income / days),
      monthlySpend: roundHkd(expense / Math.max(months, 1 / 30)),
      monthlyIncome: roundHkd(income / Math.max(months, 1 / 30)),
      txCountIncome: inc.listed.length,
      txCountExpense: exp.listed.length,
      avgExpenseTicket: exp.listed.length ? roundHkd(expense / exp.listed.length) : 0,
      medianExpenseTicket: roundHkd(median(exp.amounts)),
    },
    adhoc: {
      filterOn: hideAdhoc,
      excludedCount: hideAdhoc ? adhocCount : 0,
      excludedAmount: roundHkd(hideAdhoc ? adhocAmount : 0),
      includedCount: includedAdhocCount,
      includedAmount: roundHkd(includedAdhocAmount),
      shareOfSpendIfIncluded: allExpense > 0 ? adhocAmount / allExpense : null,
    },
    recurringSpend: {
      amount: roundHkd(recAmt),
      count: recCount,
      share: expense > 0 ? recAmt / expense : null,
    },
    oneOffSpend: {
      amount: roundHkd(oneAmt),
      count: oneCount,
      share: expense > 0 ? oneAmt / expense : null,
    },
    themes,
    fireKinds,
    categories,
    incomeCategories,
    topExpenses: exp.listed.slice(0, 10),
    topIncome: inc.listed.slice(0, 8),
    payees,
    series,
    grain: flow.grain,
  };
}

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return `${(n * 100).toFixed(1)}%`;
}

function csv(s: string): string {
  const t = s.replace(/"/g, "'");
  return /[,\n]/.test(t) ? `"${t}"` : t;
}

function insights(b: SpendBrief): string[] {
  const f = b.flow;
  const lines: string[] = [];
  lines.push(
    `Window ${b.from} → ${b.to} (${b.presetLabel}, ${b.days} days). Income HKD ${f.income.toLocaleString("en-HK")}, spend HKD ${f.expense.toLocaleString("en-HK")}, net HKD ${f.net.toLocaleString("en-HK")} (savings rate ${pct(f.savingsRate)}).`,
  );
  if (b.hideAdhoc) {
    lines.push(
      `“Hide ad-hoc / 唔計臨時大額” is ON. ${b.adhoc.excludedCount} ad-hoc expense(s) totalling HKD ${b.adhoc.excludedAmount.toLocaleString("en-HK")} are excluded from every figure below (${pct(b.adhoc.shareOfSpendIfIncluded)} of unfiltered spend).`,
    );
  } else if (b.adhoc.includedCount) {
    lines.push(
      `Ad-hoc / 臨時大額 spend is included: ${b.adhoc.includedCount} tx(s), HKD ${b.adhoc.includedAmount.toLocaleString("en-HK")} (${pct(b.adhoc.shareOfSpendIfIncluded)} of spend).`,
    );
  } else {
    lines.push("No ad-hoc / 臨時大額 expenses in this window.");
  }
  lines.push(
    `Pace: about HKD ${f.dailySpend.toLocaleString("en-HK")} spend/day, HKD ${f.monthlySpend.toLocaleString("en-HK")} / 30.4-day month. ${f.txCountExpense} expense txs (avg ticket ${f.avgExpenseTicket.toLocaleString("en-HK")}, median ${f.medianExpenseTicket.toLocaleString("en-HK")}).`,
  );
  const top = b.categories[0];
  if (top) {
    lines.push(`Largest spend group is ${top.name} / ${top.nameZh} at ${pct(top.share)} (HKD ${top.amount.toLocaleString("en-HK")}).`);
  }
  if (b.topExpenses[0]) {
    const x = b.topExpenses[0];
    lines.push(
      `Single largest expense: ${x.date} ${x.payee} ${x.category} HKD ${x.amount.toLocaleString("en-HK")}${x.adhoc ? " (ad-hoc)" : ""}.`,
    );
  }
  if (b.payees[0] && b.payees[0].share >= 0.15) {
    lines.push(`Payee concentration: ${b.payees[0].name} is ${pct(b.payees[0].share)} of spend.`);
  }
  if (b.themes[0]) {
    lines.push(`Life-theme mix: ${b.themes.map((t) => `${t.theme} ${pct(t.share)}`).join(", ")}.`);
  }
  return lines;
}

function txnLine(x: SpendBriefTxn): string {
  const flag = x.adhoc ? " adhoc" : x.recurring ? " recurring" : "";
  return `- ${x.date} ${csv(x.payee)} · ${x.category} / ${x.categoryZh} · HKD ${x.amount}${flag}`;
}

function catBlock(c: SpendBriefCategory, heading: string): string[] {
  const lines = [
    `### ${c.name} / ${c.nameZh} — HKD ${c.amount} (${pct(c.share)}, ${c.count} tx, avg ${c.avg}, theme ${c.theme}, FIRE ${c.fireKind})`,
    "Largest in this group:",
    ...(c.largest.length ? c.largest.map(txnLine) : ["- (none)"]),
  ];
  if (c.children.length) {
    lines.push("Children:");
    for (const k of c.children) {
      lines.push(`- ${k.name} / ${k.nameZh}: HKD ${k.amount} (${pct(k.share)}, ${k.count} tx)`);
      for (const x of k.largest) lines.push(`  ${txnLine(x)}`);
    }
  }
  return [heading ? "" : "", ...lines].slice(heading ? 0 : 1);
}

export function renderSpendBriefMarkdown(b: SpendBrief): string {
  const lines = [
    "# HK Life Money — period income & expense brief",
    `Generated: ${b.generatedAt}`,
    `As of: ${b.today} (HKD). Window: ${b.from} → ${b.to} (${b.presetLabel}, ${b.days} days).`,
    `Filters: hide ad-hoc / 唔計臨時大額 = ${b.hideAdhoc ? "ON" : "OFF"}. Parent groups ${b.mergeParents ? "merged on screen" : "shown as leaves on screen"}; this file always lists parent groups plus children.`,
    "",
    "Planning illustration from on-device ledger data. Combine with the asset-status export and the retirement / FIRE export. Not advice.",
    "",
    "## Headline insights",
    ...insights(b).map((s) => `- ${s}`),
    "",
    "## Money flow",
    `- Income: ${b.flow.income} (${b.flow.txCountIncome} txs)`,
    `- Spend: ${b.flow.expense} (${b.flow.txCountExpense} txs)`,
    `- Net: ${b.flow.net}`,
    `- Savings rate: ${pct(b.flow.savingsRate)}`,
    `- Daily spend / income: ${b.flow.dailySpend} / ${b.flow.dailyIncome}`,
    `- Monthly pace (30.4-day month): spend ${b.flow.monthlySpend}, income ${b.flow.monthlyIncome}`,
    `- Average expense ticket: ${b.flow.avgExpenseTicket}`,
    `- Median expense ticket: ${b.flow.medianExpenseTicket}`,
    `- Recurring-linked spend: ${b.recurringSpend.amount} (${b.recurringSpend.count} txs, ${pct(b.recurringSpend.share)})`,
    `- One-off spend: ${b.oneOffSpend.amount} (${b.oneOffSpend.count} txs, ${pct(b.oneOffSpend.share)})`,
    `- Ad-hoc excluded: ${b.adhoc.excludedCount} txs, ${b.adhoc.excludedAmount}`,
    `- Ad-hoc included: ${b.adhoc.includedCount} txs, ${b.adhoc.includedAmount} (${pct(b.adhoc.shareOfSpendIfIncluded)} of unfiltered spend)`,
    "",
    `## ${b.grain === "day" ? "Daily" : "Monthly"} cash movement`,
    "key,income,spend,net",
    ...b.series.map((p) => `${p.key},${p.income},${p.expense},${p.net}`),
    "",
    "## Spend mix by parent category",
    "name,name_zh,amount_hkd,share,count,avg,theme,fire_kind",
    ...(b.categories.length
      ? b.categories.map(
          (c) =>
            `${csv(c.name)},${csv(c.nameZh)},${c.amount},${pct(c.share)},${c.count},${c.avg},${c.theme},${c.fireKind}`,
        )
      : ["(none)"]),
    "",
    "## Biggest spending per category",
  ];
  if (!b.categories.length) lines.push("(none)");
  for (const c of b.categories) lines.push(...catBlock(c, "cat"));
  lines.push(
    "",
    "## Income mix",
    "name,name_zh,amount_hkd,share,count",
    ...(b.incomeCategories.length
      ? b.incomeCategories.map((c) => `${csv(c.name)},${csv(c.nameZh)},${c.amount},${pct(c.share)},${c.count}`)
      : ["(none)"]),
  );
  if (b.incomeCategories.length) {
    lines.push("", "## Largest income items per category");
    for (const c of b.incomeCategories) lines.push(...catBlock(c, "inc"));
  }
  lines.push(
    "",
    "## Top expenses in window",
    ...(b.topExpenses.length ? b.topExpenses.map(txnLine) : ["(none)"]),
    "",
    "## Top income in window",
    ...(b.topIncome.length ? b.topIncome.map(txnLine) : ["(none)"]),
    "",
    "## Top payees / merchants (spend)",
    "payee,amount_hkd,count,share",
    ...(b.payees.length ? b.payees.map((p) => `${csv(p.name)},${p.amount},${p.count},${pct(p.share)}`) : ["(none)"]),
    "",
    "## Life-theme mix",
    ...(b.themes.length ? b.themes.map((t) => `- ${t.theme}: ${t.amount} (${pct(t.share)})`) : ["(none)"]),
    "",
    "## FIRE spend-kind mix (from category tags)",
    ...(b.fireKinds.length ? b.fireKinds.map((t) => `- ${t.kind}: ${t.amount} (${pct(t.share)})`) : ["(none)"]),
    "",
    "## How to use with an LLM",
    "Paste this markdown together with: (1) Assets → Status for AI, (2) Reports → Retirement → Export for AI. Ask for: whether this period’s saving rate is enough for the retirement target, which categories are flexible vs core, whether ad-hoc spikes distort the picture, and a concrete next-month allocation. Treat figures as an illustration from this device only.",
  );
  return lines.join("\n");
}
