import type {
  Account,
  Category,
  FireSpendKind,
  FxRate,
  Holding,
  Mortgage,
  Recurring,
  RetirementAccount,
  TimeSaving,
  Transaction,
} from "../types.ts";
import { toHkd } from "./fx.ts";
import { cashflowSide, inMonth } from "./ledger.ts";
import { isExpenseRegular } from "./budget.ts";
import { investableNow as accountInvestable } from "./networth.ts";
import type { RetirementInputs } from "./retirement.ts";

export const FIRE_SWR_BASE = 0.035;
export const FIRE_SWR_COMFORT = 0.0325;
export const FLEX_FLOOR = 0.7;
export const FLEX_COMFORT = 1.3;
export const LIQUIDITY_MONTHS = 30;
export const STABLE_MONTHS = 78;

export type FireSpendRow = {
  id: string;
  name: string;
  nameZh: string;
  monthly: number;
  kind: FireSpendKind;
  inferred: boolean;
};

export type FireSpendLevels = {
  work: number;
  core: number;
  flex: number;
  irregular: number;
  base: number;
  floor: number;
  comfort: number;
};

export type FireTargets = {
  floor: number;
  base: number;
  comfort: number;
};

export type FireBucketId = "liquidity" | "stable" | "growth";

export type FireBucket = {
  id: FireBucketId;
  amount: number;
  target: number;
  gap: number;
};

export type FirePathPoint = { age: number; corpus: number };

export type FirePathResult = {
  series: FirePathPoint[];
  corpusAtRetire: number;
  firstYearSwr: number;
  depletes: boolean;
  depletionAge?: number;
  corpusAt80: number;
};

export type FireStressId = "bear" | "lowReturn" | "highInflation" | "longevity";

export type FireStressRow = {
  id: FireStressId;
  depletes: boolean;
  depletionAge?: number;
  corpusAt80: number;
};

export type FireGateId =
  | "mortgage"
  | "fireNumber"
  | "liquidity"
  | "parents"
  | "concentration"
  | "flexCut"
  | "stress";

export type FireGateStatus = "pass" | "fail" | "need";

export type FireGate = { id: FireGateId; status: FireGateStatus };

export function inferFireSpendKind(cat: Category | undefined, categories: Category[]): FireSpendKind {
  if (!cat) return "flex";
  if (cat.fireSpendKind) return cat.fireSpendKind;
  const blob = `${cat.id} ${cat.name} ${cat.nameZh} ${cat.icon}`.toLowerCase();
  if (
    cat.id.includes("mortgage") ||
    /薪俸稅|salaries tax|mpf-vol|voluntary mpf|payroll tax|income tax/.test(blob)
  ) {
    return "work";
  }
  if (
    cat.adhocDefault ||
    cat.icon === "wrench" ||
    cat.icon === "stethoscope" ||
    cat.icon === "pill" ||
    /醫療|維修|家電|hospital|repair|appliance|medical/.test(blob)
  ) {
    return "irregular";
  }
  if (
    cat.essential ||
    /管理費|差餉|地租|保費|保險|父母|家用|mgmt|management fee|rates|insurance|parent|allowance/.test(blob)
  ) {
    return "core";
  }
  if (cat.parentId) {
    const parent = categories.find((c) => c.id === cat.parentId);
    if (parent) return inferFireSpendKind({ ...parent, fireSpendKind: parent.fireSpendKind }, categories);
  }
  return "flex";
}

export function monthlySpendByCategory(
  txs: Transaction[],
  categories: Category[],
  rec: Recurring[],
  rates: FxRate[],
  asOfMonth: string,
): FireSpendRow[] {
  const [y, m] = asOfMonth.split("-").map(Number);
  const sums = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const tx of txs) {
      if (tx.planned) continue;
      if (cashflowSide(tx) !== "expense") continue;
      if (!inMonth(tx.date, key)) continue;
      const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
      const id = tx.categoryId || "uncat";
      sums.set(id, (sums.get(id) ?? 0) + hkd);
    }
  }
  for (const [id, total] of sums) sums.set(id, total / 12);

  for (const r of rec) {
    if (!isExpenseRegular(r) || r.frequency !== "monthly") continue;
    const id = r.categoryId || `rec-${r.id}`;
    if ((sums.get(id) ?? 0) > 0) continue;
    sums.set(id, Math.abs(toHkd(r.amount, r.currency, rates)));
  }

  const rows: FireSpendRow[] = [];
  for (const [id, monthly] of sums) {
    if (monthly <= 0) continue;
    const cat = categories.find((c) => c.id === id);
    const inferred = !cat?.fireSpendKind;
    rows.push({
      id,
      name: cat?.name ?? (id.startsWith("rec-") ? rec.find((r) => `rec-${r.id}` === id)?.label ?? "Other" : "Other"),
      nameZh: cat?.nameZh ?? (id.startsWith("rec-") ? rec.find((r) => `rec-${r.id}` === id)?.labelZh ?? "其他" : "其他"),
      monthly,
      kind: inferFireSpendKind(cat, categories),
      inferred,
    });
  }
  rows.sort((a, b) => b.monthly - a.monthly);
  return rows;
}

export function fireSpendLevels(rows: FireSpendRow[], parentMonthly = 0, parentMode: "include" | "reserve" = "include"): FireSpendLevels {
  let work = 0;
  let core = 0;
  let flex = 0;
  let irregular = 0;
  for (const r of rows) {
    if (r.kind === "work") work += r.monthly;
    else if (r.kind === "core") core += r.monthly;
    else if (r.kind === "irregular") irregular += r.monthly;
    else flex += r.monthly;
  }
  if (parentMode === "include" && parentMonthly > 0) core += parentMonthly;
  const base = core + flex;
  return {
    work,
    core,
    flex,
    irregular,
    base,
    floor: core + flex * FLEX_FLOOR,
    comfort: core + flex * FLEX_COMFORT,
  };
}

export function fireTargets(levels: FireSpendLevels): FireTargets {
  return {
    floor: levels.floor > 0 ? (levels.floor * 12) / FIRE_SWR_BASE : 0,
    base: levels.base > 0 ? (levels.base * 12) / FIRE_SWR_BASE : 0,
    comfort: levels.comfort > 0 ? (levels.comfort * 12) / FIRE_SWR_COMFORT : 0,
  };
}

export function classifyAccountBucket(a: Account): FireBucketId | "skip" {
  if (a.hidden || a.currency === "MILES") return "skip";
  if (a.type === "property" || a.type === "mortgage" || a.type === "loan" || a.type === "credit" || a.type === "miles") return "skip";
  if (a.type === "investment" || a.type === "mpf") return "growth";
  return "liquidity";
}

export function fireBuckets(opts: {
  accounts: Account[];
  rates: FxRate[];
  deposits: TimeSaving[];
  holdings: Holding[];
  retirementAccounts: RetirementAccount[];
  coreMonthly: number;
  baseMonthly: number;
  today: string;
}): FireBucket[] {
  let liquidity = 0;
  let stable = 0;
  let growth = 0;
  for (const a of opts.accounts) {
    const bucket = classifyAccountBucket(a);
    if (bucket === "skip") continue;
    const amt = Math.max(0, toHkd(a.balance, a.currency, opts.rates));
    if (bucket === "growth") growth += amt;
    else liquidity += amt;
  }
  for (const d of opts.deposits) {
    if (d.endDate && d.endDate < opts.today) continue;
    liquidity += Math.max(0, toHkd(d.amount, d.currency, opts.rates));
  }
  for (const ra of opts.retirementAccounts) {
    if (ra.status === "closed") continue;
    const amt = Math.max(0, ra.currentBalance);
    if (ra.type === "ANNUITY" || ra.type === "PENSION" || ra.type === "QDAP") stable += amt;
    else growth += amt;
  }
  const liqTarget = opts.coreMonthly * LIQUIDITY_MONTHS;
  const stableTarget = opts.baseMonthly * STABLE_MONTHS;
  return [
    { id: "liquidity", amount: liquidity, target: liqTarget, gap: liqTarget - liquidity },
    { id: "stable", amount: stable, target: stableTarget, gap: stableTarget - stable },
    { id: "growth", amount: growth, target: 0, gap: 0 },
  ];
}

export function parentLiability(monthly: number, years: number): number {
  if (monthly <= 0 || years <= 0) return 0;
  return monthly * 12 * years;
}

export function simulateFirePath(opts: {
  currentAge: number;
  retireAge: number;
  deathAge: number;
  investable: number;
  monthlySave: number;
  preReturn: number;
  postReturn: number;
  inflation: number;
  monthlySpend: number;
  postJobMonthly?: number;
  shockAtRetire?: number;
}): FirePathResult {
  const {
    currentAge,
    retireAge,
    deathAge,
    investable,
    monthlySave,
    preReturn,
    postReturn,
    inflation,
    monthlySpend,
    postJobMonthly = 0,
    shockAtRetire = 0,
  } = opts;
  let corpus = Math.max(0, investable);
  const series: FirePathPoint[] = [{ age: currentAge, corpus }];
  let corpusAtRetire = corpus;
  let firstYearSwr = 0;
  let depletes = false;
  let depletionAge: number | undefined;
  let corpusAt80 = corpus;
  const years = Math.max(0, deathAge - currentAge);
  for (let i = 1; i <= years; i++) {
    const age = currentAge + i;
    const inf = (1 + inflation) ** i;
    const retired = age >= retireAge;
    if (age === retireAge && shockAtRetire) corpus *= 1 + shockAtRetire;
    corpus = corpus * (1 + (retired ? postReturn : preReturn));
    if (!retired) {
      corpus += monthlySave * 12 * inf;
    } else {
      corpus += postJobMonthly * 12 * inf;
      corpus -= monthlySpend * 12 * inf;
    }
    if (age === retireAge) {
      corpusAtRetire = corpus + monthlySpend * 12 * inf;
      firstYearSwr = corpusAtRetire > 0 ? (monthlySpend * 12 * inf) / corpusAtRetire : 0;
    }
    if (age === 80) corpusAt80 = corpus;
    series.push({ age, corpus });
    if (corpus < 0 && !depletes) {
      depletes = true;
      depletionAge = age;
    }
  }
  if (deathAge < 80) corpusAt80 = series[series.length - 1]?.corpus ?? corpus;
  return { series, corpusAtRetire, firstYearSwr, depletes, depletionAge, corpusAt80 };
}

export function runFireStress(base: Parameters<typeof simulateFirePath>[0]): FireStressRow[] {
  const specs: { id: FireStressId; patch: Partial<typeof base> }[] = [
    { id: "bear", patch: { shockAtRetire: -0.3 } },
    { id: "lowReturn", patch: { postReturn: Math.max(0, base.postReturn - 0.01) } },
    { id: "highInflation", patch: { inflation: 0.035 } },
    { id: "longevity", patch: { deathAge: Math.max(base.deathAge, 95) } },
  ];
  return specs.map((s) => {
    const r = simulateFirePath({ ...base, ...s.patch });
    return { id: s.id, depletes: r.depletes, depletionAge: r.depletionAge, corpusAt80: r.corpusAt80 };
  });
}

export function largestHoldingShare(holdings: Holding[], rates: FxRate[], investable: number): number | null {
  if (!holdings.length || investable <= 0) return null;
  let max = 0;
  for (const h of holdings) {
    const v = Math.abs(toHkd(h.quantity * (h.lastPrice || 0), h.currency, rates));
    if (v > max) max = v;
  }
  return max / investable;
}

export function fireGates(opts: {
  mortgage: Mortgage | null;
  currentAge: number;
  retireAge: number;
  payOffMortgageAtRetire: boolean;
  investable: number;
  baseTarget: number;
  liquidity: number;
  coreMonthly: number;
  parentMonthly: number;
  parentYears: number | undefined;
  parentMode: "include" | "reserve";
  parentLiability: number;
  concentration: number | null;
  acceptedFlexCut: boolean;
  stress: FireStressRow[];
}): FireGate[] {
  const yearsToRetire = Math.max(0, opts.retireAge - opts.currentAge);
  const mort = opts.mortgage;
  const mortLeft = mort ? (mort.remainingMonths ?? 0) / 12 : 0;
  const mortgageOk = !mort || mort.outstanding < 1 || opts.payOffMortgageAtRetire || mortLeft <= yearsToRetire + 0.05;
  const parentsSet = opts.parentYears !== undefined || opts.parentMonthly > 0;
  const parentsOk = !parentsSet
    ? "need"
    : opts.parentMonthly <= 0
      ? "pass"
      : opts.parentMode === "include"
        ? "pass"
        : opts.liquidity >= opts.parentLiability
          ? "pass"
          : "fail";
  const conc = opts.concentration;
  return [
    { id: "mortgage", status: mortgageOk ? "pass" : "fail" },
    { id: "fireNumber", status: opts.investable >= opts.baseTarget && opts.baseTarget > 0 ? "pass" : opts.baseTarget <= 0 ? "need" : "fail" },
    {
      id: "liquidity",
      status: opts.coreMonthly <= 0 ? "need" : opts.liquidity >= opts.coreMonthly * 24 ? "pass" : "fail",
    },
    { id: "parents", status: parentsOk },
    { id: "concentration", status: conc == null ? "need" : conc < 0.05 ? "pass" : "fail" },
    { id: "flexCut", status: opts.acceptedFlexCut ? "pass" : "fail" },
    { id: "stress", status: opts.stress.every((s) => !s.depletes) ? "pass" : "fail" },
  ];
}

export function fireInvestable(accounts: Account[], rates: FxRate[], retirementAccounts: RetirementAccount[] = []): number {
  let n = accountInvestable(accounts, rates);
  for (const ra of retirementAccounts) {
    if (ra.status === "closed" || ra.linkedAccountId) continue;
    n += Math.max(0, ra.currentBalance);
  }
  return n;
}

export function fireInputsFromRetirement(ret: RetirementInputs | null, derivedAge: number): {
  currentAge: number;
  retireAge: number;
  deathAge: number;
  preReturn: number;
  postReturn: number;
  inflation: number;
} {
  return {
    currentAge: derivedAge || ret?.currentAge || 42,
    retireAge: ret?.retireAge ?? 50,
    deathAge: ret?.deathAge ?? 85,
    preReturn: ret?.preReturn ?? 0.05,
    postReturn: ret?.postReturn ?? 0.03,
    inflation: ret?.inflation ?? 0.025,
  };
}
