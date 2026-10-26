import { FLEX_COMFORT, FLEX_FLOOR, type FireSpendLevels } from "./fire-plan.ts";

/**
 * Scale category core/flex so they add up to the typed retirement spend.
 * Tags only allocate that total. They never replace it.
 * Work and irregular stay informational.
 * Empty tags → the whole typed amount is flexible retirement spend.
 * A missing target → base 0, so a tiny tagged subset cannot look "on track".
 */
export function allocateTypedSpend(levels: FireSpendLevels, targetMonthly: number): FireSpendLevels {
  const target = Number.isFinite(targetMonthly) ? Math.max(0, targetMonthly) : 0;
  const tagged = Math.max(0, levels.core) + Math.max(0, levels.flex);
  let core = 0;
  let flex = 0;
  if (target > 0 && tagged > 0) {
    const scale = target / tagged;
    core = Math.max(0, levels.core) * scale;
    flex = Math.max(0, levels.flex) * scale;
  } else if (target > 0) {
    flex = target;
  }
  return {
    work: levels.work,
    irregular: levels.irregular,
    core,
    flex,
    base: core + flex,
    floor: core + flex * FLEX_FLOOR,
    comfort: core + flex * FLEX_COMFORT,
  };
}

export type FigureSource = "manual" | "ledger";

/** A stored 0 means "not typed", so the model may use the ledger. The label must match. */
export function pickedFigure(stored: number | null | undefined, ledger: number): { amount: number; source: FigureSource } {
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return { amount: stored, source: "manual" };
  }
  return { amount: Number.isFinite(ledger) ? Math.max(0, ledger) : 0, source: "ledger" };
}

/** Typed retirement spend. Never filled in from a ledger average. */
export function pickedTarget(stored: number | null | undefined): number {
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) return stored;
  return 0;
}

export function goalsReady(opts: { birthday?: string; currentAge: number; targetMonthly: number }): boolean {
  const hasAge = Boolean(opts.birthday) || (Number.isFinite(opts.currentAge) && opts.currentAge > 0);
  return hasAge && opts.targetMonthly > 0;
}

export type EnoughKind = "setup" | "enough" | "short";

export function enoughStory(opts: {
  ready: boolean;
  hasPath: boolean;
  depletes: boolean;
  plannedMonthly: number;
  surplusMonthly: number;
  planEndAge: number;
}): { kind: EnoughKind; gap: number; planEndAge: number; planned: number } {
  const planned = opts.plannedMonthly > 0 ? opts.plannedMonthly : 0;
  if (!opts.ready || !opts.hasPath || planned <= 0) {
    return { kind: "setup", gap: 0, planEndAge: opts.planEndAge, planned };
  }
  if (opts.depletes || opts.surplusMonthly < 0) {
    return { kind: "short", gap: opts.surplusMonthly, planEndAge: opts.planEndAge, planned };
  }
  return { kind: "enough", gap: opts.surplusMonthly, planEndAge: opts.planEndAge, planned };
}

export type MortgageStoryKind = "none" | "owing" | "clears-before" | "assumed-payoff";

/**
 * Outstanding principal is never "paid off".
 * A payoff toggle does not pass the gate while a balance would still exist at retire age.
 * The account projection deducts that lump; the life-plan path does not.
 */
export function mortgageStory(opts: {
  outstanding: number;
  remainingMonths: number;
  yearsToRetire: number;
  payOffAtRetire: boolean;
}): {
  kind: MortgageStoryKind;
  owingNow: number;
  paidOffNow: boolean;
  gate: "pass" | "fail" | "need";
  payoffCashInAccountProjection: boolean;
  payoffCashInLifePath: false;
} {
  const owing = Number.isFinite(opts.outstanding) ? Math.max(0, opts.outstanding) : 0;
  if (owing < 1) {
    return {
      kind: "none",
      owingNow: 0,
      paidOffNow: true,
      gate: "pass",
      payoffCashInAccountProjection: false,
      payoffCashInLifePath: false,
    };
  }
  const yearsLeft = opts.remainingMonths > 0 ? opts.remainingMonths / 12 : 999;
  const clearsBefore = yearsLeft <= Math.max(0, opts.yearsToRetire) + 0.05;
  if (clearsBefore) {
    return {
      kind: "clears-before",
      owingNow: owing,
      paidOffNow: false,
      gate: "pass",
      payoffCashInAccountProjection: false,
      payoffCashInLifePath: false,
    };
  }
  if (opts.payOffAtRetire) {
    return {
      kind: "assumed-payoff",
      owingNow: owing,
      paidOffNow: false,
      gate: "fail",
      payoffCashInAccountProjection: true,
      payoffCashInLifePath: false,
    };
  }
  return {
    kind: "owing",
    owingNow: owing,
    paidOffNow: false,
    gate: "fail",
    payoffCashInAccountProjection: false,
    payoffCashInLifePath: false,
  };
}

export function accessBreakdown(accessible: number, locked: number): { accessible: number; locked: number; total: number } {
  return { accessible, locked, total: accessible + locked };
}

export function suggestMpfFromRecurring(opts: {
  recurring: { categoryId?: string; amount: number; frequency: string }[];
  categories: { id: string; name: string; nameZh: string }[];
  hasRetirementAccount: boolean;
}): { monthly: number } | null {
  if (opts.hasRetirementAccount) return null;
  let monthly = 0;
  for (const r of opts.recurring) {
    if (r.frequency !== "monthly" || !(r.amount > 0)) continue;
    const cat = opts.categories.find((c) => c.id === r.categoryId);
    const blob = `${r.categoryId ?? ""} ${cat?.name ?? ""} ${cat?.nameZh ?? ""}`.toLowerCase();
    if (/mpf|強積金|orso/.test(blob)) monthly += Math.abs(r.amount);
  }
  if (monthly <= 0) return null;
  return { monthly };
}

export function annuityClash(
  accounts: { id: string; type: string }[],
  allowances: { kind: string }[],
): boolean {
  const payout = accounts.filter(
    (a) => a.id !== "ra-inherit-annuity" && (a.type === "ANNUITY" || a.type === "PENSION" || a.type === "QDAP"),
  );
  const inherit = accounts.some((a) => a.id === "ra-inherit-annuity");
  const fromAllowance = allowances.some((a) => a.kind === "annuity");
  if (inherit && payout.length > 0) return true;
  if (fromAllowance && (payout.length > 0 || inherit)) return true;
  return payout.length > 1;
}

/** Inflate today's HKD monthly figure to then-money after `years`. */
export function inflatedMonthly(todayMonthly: number, years: number, inflation: number): number {
  const y = Number.isFinite(years) ? Math.max(0, years) : 0;
  const r = Number.isFinite(inflation) ? inflation : 0;
  const base = Number.isFinite(todayMonthly) ? Math.max(0, todayMonthly) : 0;
  return base * Math.pow(1 + r, y);
}

/**
 * Detect an assets-page MPF/ORSO balance when no retirement-account row exists yet.
 * Prefer contributing a balance into the plan over forcing an all-zero empty state.
 */
export function suggestMpfFromAssets(opts: {
  accounts: { type: string; balance: number; name?: string; nameZh?: string }[];
  hasRetirementAccount: boolean;
}): { balance: number; name: string } | null {
  if (opts.hasRetirementAccount) return null;
  let balance = 0;
  let name = "MPF";
  for (const a of opts.accounts) {
    const blob = `${a.type} ${a.name ?? ""} ${a.nameZh ?? ""}`.toLowerCase();
    if (a.type === "mpf" || /mpf|強積金|orso/.test(blob)) {
      if (a.balance > balance) {
        balance = a.balance;
        name = a.nameZh || a.name || "MPF";
      }
    }
  }
  if (!(balance > 0)) return null;
  return { balance, name };
}

/** Age labels for the path corpus: end of (retireAge-1) / start of retireAge. */
export function corpusAgeLabels(retireAge: number): { endWorkingAge: number; startRetireAge: number } {
  const start = Number.isFinite(retireAge) ? Math.round(retireAge) : 65;
  return { endWorkingAge: Math.max(0, start - 1), startRetireAge: start };
}
