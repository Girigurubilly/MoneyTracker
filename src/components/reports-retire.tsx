import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { InfoButton, ScreenHeader } from "@/components/shared";
import { LifeYearList } from "@/components/life-year-list";
import { ReportAiSheet } from "@/components/report-ai-sheet";
import {
  Enter,
  StickyConclusionBar,
  useCountUp,
} from "@/components/retire-ux";
import { money, todayISO } from "@/lib/format";
import { toHkd } from "@/lib/calc/fx";
import { pickName } from "@/lib/i18n";
import { livingEssentials } from "@/lib/calc/budget";
import { isMortgageInterestCategory, isMortgagePrincipalCategory } from "@/lib/categories";
import { monthlyPayment, effectiveRate, remainingFromStart } from "@/lib/calc/mortgage";
import {
  firePlan,
  retirementSleeves,
  reverseMortgageMonthly,
  runRetirement,
  savingsLast12Months,
  sustainableMonthly,
  ageFromBirthday,
  type RetirementInputs,
} from "@/lib/calc/retirement";
import { monthKey } from "@/lib/calc/ledger";
import { earliestRetireTone, earliestSustainableRetireAge, emptyLifePlan, inheritanceAnnuityAccount, INHERIT_ANNUITY_ID, lifePlanFundingTarget, lifePlanMonthlyRoom, lifePlanTimeToTarget, resolveLifePlan, runLifePlan, type EarliestRetire, type NowGapTone, type TimeToTarget } from "@/lib/calc/life-plan";
import {
  accessBreakdown,
  enoughStory,
  goalsReady,
  mortgageStory,
  pickedFigure,
  pickedTarget,
} from "@/lib/calc/retire-view";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function useRetirementModel() {
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const txs = useApp((s) => s.transactions);
  const rec = useApp((s) => s.recurring);
  const cats = useApp((s) => s.categories);
  const ret = useApp((s) => s.retirement);
  const update = useApp((s) => s.updateRetirement);
  const allowances = useApp((s) => s.allowances);
  const oneOffs = useApp((s) => s.oneOffs);
  const mortgage = useApp((s) => s.mortgage);
  const deposits = useApp((s) => s.deposits);
  const retirementAccounts = useApp((s) => s.retirementAccounts);
  const holdings = useApp((s) => s.holdings);
  const avg = savingsLast12Months(txs, rates, monthKey(todayISO()));
  const born = ret?.birthday;
  const derivedAge = born ? ageFromBirthday(born, todayISO()) : ret?.currentAge ?? 0;
  const income = pickedFigure(ret?.monthlyIncomeNow, avg.monthlyIncome);
  const spend = pickedFigure(ret?.monthlySpendNow, avg.monthlySpend);
  const base: RetirementInputs = {
    currentAge: derivedAge,
    retireAge: ret?.retireAge ?? 65,
    deathAge: ret?.deathAge ?? 90,
    monthlyIncomeNow: income.amount,
    monthlySpendNow: spend.amount,
    targetMonthly: pickedTarget(ret?.targetMonthly),
    preReturn: ret?.preReturn ?? 0.05,
    postReturn: ret?.postReturn ?? 0.035,
    inflation: ret?.inflation ?? 0.025,
    travelInRetirement: ret?.travelInRetirement ?? 0,
    reverseMortgageLtv: ret?.reverseMortgageLtv ?? 0.4,
    fireSwr: ret?.fireSwr ?? 0.04,
    birthday: ret?.birthday,
    emergencyReserve: ret?.emergencyReserve ?? 0,
    liquidityFloor: ret?.liquidityFloor ?? 0,
    desiredEndBuffer: ret?.desiredEndBuffer ?? 0,
    laterLifeAge: ret?.laterLifeAge ?? 75,
    payOffMortgageAtRetire: ret?.payOffMortgageAtRetire ?? false,
  };
  const pack = retirementSleeves(accounts, rates, 0.02, base.preReturn, holdings);
  const yearsRetired = Math.max(1, base.deathAge - base.retireAge);
  const rmMonthly = reverseMortgageMonthly(pack.property, base.reverseMortgageLtv ?? 0, yearsRetired);
  const ctx = {
    investableNow: pack.cash + pack.invest,
    mortgageMonthly: mortgage ? monthlyPayment(mortgage.outstanding, effectiveRate(mortgage), mortgage.remainingMonths) : 0,
    mortgagePayoffAge: base.currentAge + Math.round((mortgage?.remainingMonths ?? 0) / 12),
    housingAfterPayoff: livingEssentials(
      rec.filter((r) => {
        if (!r.living) return false;
        const c = cats.find((x) => x.id === r.categoryId);
        return !c || (!isMortgagePrincipalCategory(c) && !isMortgageInterestCategory(c));
      }),
    ),
    oneOffs,
    allowances,
    sleeves: pack.sleeves,
    propertyEquity: pack.property,
    reverseMortgageMonthly: rmMonthly,
    retirementAccounts,
    deposits,
    mortgage,
    today: todayISO(),
  };
  const result = useMemo(() => runRetirement(base, ctx), [
    base.currentAge,
    base.retireAge,
    base.deathAge,
    base.monthlyIncomeNow,
    base.monthlySpendNow,
    base.targetMonthly,
    base.preReturn,
    base.postReturn,
    base.inflation,
    base.travelInRetirement,
    ctx.investableNow,
    ctx.mortgageMonthly,
    ctx.mortgagePayoffAge,
    ctx.housingAfterPayoff,
    oneOffs,
    allowances,
    holdings,
    pack.sleeves,
    retirementAccounts,
    deposits,
    mortgage,
    base.emergencyReserve,
    base.liquidityFloor,
    base.desiredEndBuffer,
    base.laterLifeAge,
    base.payOffMortgageAtRetire,
  ]);
  const sustain = useMemo(() => sustainableMonthly(base, ctx), [
    base.currentAge,
    base.retireAge,
    base.deathAge,
    base.monthlyIncomeNow,
    base.monthlySpendNow,
    base.preReturn,
    base.postReturn,
    base.inflation,
    base.travelInRetirement,
    ctx.investableNow,
    ctx.mortgageMonthly,
    ctx.mortgagePayoffAge,
    ctx.reverseMortgageMonthly,
    pack.sleeves,
    oneOffs,
    allowances,
    holdings,
  ]);
  const fire = useMemo(() => firePlan(base, ctx), [
    base.currentAge,
    base.retireAge,
    base.deathAge,
    base.monthlyIncomeNow,
    base.monthlySpendNow,
    base.targetMonthly,
    base.preReturn,
    base.travelInRetirement,
    base.fireSwr,
    ctx.investableNow,
    ctx.propertyEquity,
    pack.sleeves,
    holdings,
  ]);
  function persist(patch: Partial<RetirementInputs>) {
    void update({ ...base, ...patch, id: ret?.id ?? "base" });
  }
  const saveSource = income.source === "ledger" && spend.source === "ledger" ? "ledger" : "manual";
  const ready = goalsReady({ birthday: base.birthday, currentAge: base.currentAge, targetMonthly: base.targetMonthly });
  return {
    accounts,
    holdings,
    rates,
    avg,
    base,
    ctx,
    pack,
    result,
    sustain,
    fire,
    persist,
    rmMonthly,
    mortgage,
    incomeSource: income.source,
    spendSource: spend.source,
    saveMonthly: income.amount - spend.amount,
    saveSource,
    ready,
    updateAccount: useApp.getState().updateAccount,
  };
}

export function useLifePlanResult() {
  const stored = useApp((s) => s.lifePlan);
  const plan = stored ?? emptyLifePlan();
  const retirementAccounts = useApp((s) => s.retirementAccounts);
  const allowances = useApp((s) => s.allowances);
  const { base, pack, ctx, mortgage, incomeSource } = useRetirementModel();
  const shared = useMemo(() => {
    const pay = mortgage ? monthlyPayment(mortgage.outstanding, effectiveRate(mortgage), mortgage.remainingMonths) : 0;
    const months = mortgage ? remainingFromStart(mortgage, todayISO())?.remainingMonths ?? mortgage.remainingMonths : 0;
    const end = mortgage ? addMonths(todayISO(), months) : "";
    return {
      birthday: base.birthday,
      currentAge: base.currentAge,
      retireAge: base.retireAge,
      deathAge: base.deathAge,
      inflation: base.inflation,
      preReturn: base.preReturn,
      postReturn: base.postReturn,
      monthlyIncomeNow: base.monthlyIncomeNow,
      monthlySpendNow: base.monthlySpendNow,
      incomeIsNet: incomeSource === "ledger",
      targetMonthly: base.targetMonthly,
      reverseMortgageLtv: base.reverseMortgageLtv,
      investable: ctx.investableNow,
      property: pack.property,
      mortgage: mortgage
        ? { outstanding: mortgage.outstanding, monthlyPayment: mortgage.paymentOverride ?? pay, endDate: end, rate: effectiveRate(mortgage) }
        : null,
      today: todayISO(),
    };
  }, [base, pack.property, ctx.investableNow, mortgage, incomeSource]);
  const resolved = useMemo(() => resolveLifePlan(plan, shared), [plan, shared]);
  const inflows = useMemo(
    () => ({
      accounts: retirementAccounts,
      allowances,
      retireAge: base.retireAge,
      birthday: base.birthday,
      postJobMonthly: base.postRetireJobMonthly ?? 0,
      parentSupport:
        (base.parentSupportMonthly ?? 0) > 0
          ? {
              monthly: base.parentSupportMonthly ?? 0,
              years: base.parentSupportYears ?? 0,
              mode: (base.parentSupportMode === "reserve" ? "reserve" : "include") as "include" | "reserve",
            }
          : undefined,
    }),
    [retirementAccounts, allowances, base.retireAge, base.birthday, base.postRetireJobMonthly, base.parentSupportMonthly, base.parentSupportYears, base.parentSupportMode],
  );
  const result = useMemo(() => runLifePlan(resolved, todayISO(), inflows), [resolved, inflows]);
  const upsertAccount = useApp((s) => s.upsertRetirementAccount);
  const deleteAccount = useApp((s) => s.deleteRetirementAccount);
  useEffect(() => {
    const want = inheritanceAnnuityAccount(resolved);
    const existing = retirementAccounts.find((a) => a.id === INHERIT_ANNUITY_ID);
    if (!want) {
      if (existing) void deleteAccount(existing.id);
      return;
    }
    if (
      !existing ||
      existing.scheduledMonthlyIncome !== want.scheduledMonthlyIncome ||
      existing.scheduledIncomeStartAge !== want.scheduledIncomeStartAge ||
      existing.currentBalance !== want.currentBalance
    ) {
      void upsertAccount(want);
    }
  }, [resolved, retirementAccounts, upsertAccount, deleteAccount]);
  const earliest = useMemo(
    () => earliestSustainableRetireAge(plan, shared, todayISO(), inflows),
    [plan, shared, inflows],
  );
  return { plan, resolved, result, inflows, earliest };
}


type VelocityCopy = {
  velocityAlready: string;
  velocityNeedIncome: string;
  velocityOnTrack: string;
  velocityAtRetire: string;
  velocityAfterRetire: string;
  velocityNegative: string;
  velocityNever: string;
  stickyEtaYears: string;
  stickyEtaLate: string;
  stickyEtaAlready: string;
  stickyEtaShort: string;
};


export function earliestStoryKind(row: EarliestRetire | null | undefined, ready: boolean): "enough" | "short" | "setup" {
  if (!ready || !row || row.kind === "unknown") return "setup";
  if (row.kind === "never") return "short";
  return "enough";
}

export function earliestStickyText(
  copy: { stickyEarliest: string; stickyEarliestAlready: string; stickyEarliestNever: string },
  row: EarliestRetire | null | undefined,
): string | undefined {
  if (!row || row.kind === "unknown") return undefined;
  if (row.kind === "already") return copy.stickyEarliestAlready;
  if (row.kind === "never") return copy.stickyEarliestNever.replace("{end}", String(row.planEndAge));
  if (row.age != null) return copy.stickyEarliest.replace("{age}", String(row.age));
  return undefined;
}

export function earliestVsText(
  copy: { earliestVsEarlier: string; earliestVsSame: string; earliestVsLater: string },
  row: EarliestRetire | null | undefined,
): string | undefined {
  if (!row || row.vsPlanned === "none") return undefined;
  const template = row.vsPlanned === "earlier" ? copy.earliestVsEarlier : row.vsPlanned === "same" ? copy.earliestVsSame : copy.earliestVsLater;
  return template.replace("{retire}", String(row.plannedAge));
}

export function formatEtaYears(years: number): string {
  const r = Math.round(years * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function gapToneClass(tone: NowGapTone): string {
  if (tone === "over") return "text-income";
  if (tone === "late") return "text-expense";
  return "text-muted";
}

export function timeToTargetSticky(copy: VelocityCopy, eta: TimeToTarget | null | undefined): string | undefined {
  if (!eta) return undefined;
  if (eta.kind === "already") return copy.stickyEtaAlready;
  if (eta.kind === "on-track" && eta.years != null && eta.age != null) {
    return copy.stickyEtaYears.replace("{years}", formatEtaYears(eta.years)).replace("{age}", String(Math.round(eta.age)));
  }
  if (eta.kind === "after-retire" && eta.years != null && eta.age != null) {
    return copy.stickyEtaLate.replace("{years}", formatEtaYears(eta.years)).replace("{age}", String(Math.round(eta.age)));
  }
  if (eta.kind === "negative" || eta.kind === "never") return copy.stickyEtaShort;
  return undefined;
}

export function timeToTargetLine(
  copy: VelocityCopy,
  eta: TimeToTarget | null | undefined,
  retireAge: number,
  planEndAge: number,
): string | undefined {
  if (!eta) return undefined;
  const save = money(Math.abs(eta.monthlySave), "HKD");
  if (eta.kind === "already") return copy.velocityAlready;
  if (eta.kind === "unknown-velocity") return copy.velocityNeedIncome;
  if (eta.kind === "on-track" && eta.years != null && eta.age != null) {
    if (Math.round(eta.age) === retireAge) {
      return copy.velocityAtRetire.replace("{save}", save).replace("{retire}", String(retireAge));
    }
    return copy.velocityOnTrack
      .replace("{save}", save)
      .replace("{years}", formatEtaYears(eta.years))
      .replace("{age}", String(Math.round(eta.age)))
      .replace("{retire}", String(retireAge));
  }
  if (eta.kind === "after-retire" && eta.years != null && eta.age != null) {
    return copy.velocityAfterRetire
      .replace("{save}", save)
      .replace("{years}", formatEtaYears(eta.years))
      .replace("{age}", String(Math.round(eta.age)))
      .replace("{retire}", String(retireAge));
  }
  if (eta.kind === "negative") return copy.velocityNegative;
  if (eta.kind === "never") return copy.velocityNever.replace("{save}", save).replace("{end}", String(planEndAge));
  return undefined;
}

export function useRetirementHeadline() {
  const model = useRetirementModel();
  const life = useLifePlanResult();
  const room = useMemo(() => lifePlanMonthlyRoom(life.resolved, todayISO(), life.inflows), [life.resolved, life.inflows]);
  const plannedFunding = useMemo(() => lifePlanFundingTarget(life.resolved, todayISO(), life.inflows), [life.resolved, life.inflows]);
  const funding = life.earliest.funding?.ready ? life.earliest.funding : plannedFunding;
  const officialFunding = life.earliest.kind === "never" || life.earliest.kind === "unknown" ? null : life.earliest.funding?.ready ? life.earliest.funding : null;
  const planEndAge = life.result.stay?.years[life.result.stay.years.length - 1]?.age ?? model.base.deathAge;
  const story = enoughStory({
    ready: model.ready,
    hasPath: Boolean(life.result.stay),
    depletes: life.earliest.kind === "never",
    plannedMonthly: model.base.targetMonthly,
    surplusMonthly: room.surplus,
    fundingGap: (officialFunding ?? funding).ready ? (officialFunding ?? funding).gap : undefined,
    planEndAge,
  });
  const yearsToRetire = Math.max(0, model.base.retireAge - model.base.currentAge);
  const mort = mortgageStory({
    outstanding: model.mortgage?.outstanding ?? 0,
    remainingMonths: model.mortgage?.remainingMonths ?? 0,
    yearsToRetire,
    payOffAtRetire: Boolean(model.base.payOffMortgageAtRetire),
  });
  const timeToTarget = useMemo(() => {
    if (!plannedFunding.ready || !model.ready) return null;
    return lifePlanTimeToTarget({
      need: plannedFunding.need,
      investableNow: model.ctx.investableNow,
      monthlyIncome: model.base.monthlyIncomeNow,
      monthlySpend: model.base.monthlySpendNow,
      preReturn: model.base.preReturn,
      currentAge: model.base.currentAge,
      retireAge: model.base.retireAge,
      planEndAge,
      asOf: todayISO(),
      birthday: model.base.birthday,
    });
  }, [plannedFunding, model.ready, model.ctx.investableNow, model.base, planEndAge]);
  return {
    ...model,
    life,
    room,
    funding,
    plannedFunding,
    officialFunding,
    story,
    mort,
    planEndAge,
    timeToTarget,
    earliest: life.earliest,
    corpusAtRetire: life.result.stay?.assetsAtRetire ?? null,
    investable: model.ctx.investableNow,
    access: accessBreakdown(model.result.plan.corpusAtRetire, model.result.plan.lockedAtRetire),
  };
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + Math.max(0, Math.round(months)));
  return d.toISOString().slice(0, 10);
}

export function SharedRetirementStrip() {
  const t = useT();
  const head = useRetirementHeadline();
  const { base, story, funding, investable, earliest, planEndAge } = head;
  const nowGap = funding.ready ? funding.need - investable : 0;
  const gapTone = earliestRetireTone(nowGap, earliest);
  const etaText = earliestVsText(t.reports, earliest);
  const verdict =
    earliestStickyText(t.reports, earliest)
    ?? (story.kind === "enough"
      ? t.reports.verdictEnoughUntil.replace("{age}", String(planEndAge))
      : story.kind === "short"
        ? t.reports.verdictShortUntil.replace("{age}", String(planEndAge))
        : t.reports.verdictSetup);
  const stripKind = earliestStoryKind(earliest, story.kind !== "setup" && funding.ready);
  return (
    <Link to="/reports/retirement" className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-elevated p-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-accent">{t.reports.sharedProfile}</div>
        <div className="mt-1 truncate text-sm">
          {story.kind === "setup" ? (
            <>
              {base.currentAge} · {t.reports.retireAge} {base.retireAge} · {t.reports.deathAge} {base.deathAge}
            </>
          ) : (
            <>
              <span className={stripKind === "enough" ? "text-income" : "text-expense"}>{verdict}</span>
              {etaText ? (
                <>
                  {" · "}
                  {etaText}
                </>
              ) : null}
            </>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] leading-4 text-muted">
          {money(base.targetMonthly, "HKD")} · {(base.inflation * 100).toFixed(1)}% · {(base.preReturn * 100).toFixed(1)}% / {(base.postReturn * 100).toFixed(1)}%
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-accent">
        {t.reports.sharedEdit}
        <ChevronRight className="size-4" />
      </span>
    </Link>
  );
}

export function OfficialAnswerCard({
  fundingReady,
  need,
  investable,
  nowGap,
  nowGapLabel,
  gapTone,
  verdict,
  verdictKind,
  velocityLine,
  pathHaveLine,
  earliest,
  dragging = false,
  compact = false,
}: {
  fundingReady: boolean;
  need: number;
  investable: number;
  nowGap: number;
  nowGapLabel: string;
  gapTone: NowGapTone;
  verdict: string;
  verdictKind: "enough" | "short" | "setup";
  velocityLine?: string;
  pathHaveLine?: string;
  earliest?: EarliestRetire | null;
  dragging?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const shownNowGap = useCountUp(fundingReady ? nowGap : 0, dragging, 320);
  if (!fundingReady || verdictKind === "setup") return null;
  const ageKind = earliest ? earliestStoryKind(earliest, true) : verdictKind;
  const vs = earliestVsText(t.reports, earliest);
  const end = String(earliest?.planEndAge ?? "");
  const officialAge = earliest?.age;
  const showOfficialFunding = Boolean(earliest && officialAge != null && fundingReady);
  return (
    <section className={cn(compact ? "p-3 pt-1" : "mx-4 mb-3 rounded-2xl bg-elevated p-4")}>
      {earliest ? (
        <div>
          <div className="text-sm font-medium">{t.reports.earliestRetireLabel}</div>
          {earliest.kind === "never" || earliest.kind === "unknown" ? (
            <p className={cn("mt-2 font-semibold leading-6 text-expense", compact ? "text-base" : "text-lg")}>
              {t.reports.earliestRetireNever.replace("{end}", end)}
            </p>
          ) : earliest.kind === "already" ? (
            <>
              <div className={cn("mt-1 font-semibold tabular-nums text-income", compact ? "text-4xl" : "text-5xl")}>{earliest.age}</div>
              <p className="mt-2 text-sm leading-5">{t.reports.earliestRetireAlready.replace("{end}", end)}</p>
            </>
          ) : (
            <>
              <div className={cn("mt-1 font-semibold tabular-nums", ageKind === "short" ? "text-expense" : "text-income", compact ? "text-4xl" : "text-5xl")}>
                {earliest.age}
              </div>
              <p className="mt-2 text-sm leading-5 text-muted">{t.reports.earliestRetireSub.replace("{end}", end)}</p>
            </>
          )}
          {vs ? <p className="mt-1 text-sm leading-5">{vs}</p> : null}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">{t.reports.statusTitle}</div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              verdictKind === "enough" && "bg-success-soft text-income",
              verdictKind === "short" && "bg-expense-soft text-expense",
            )}
          >
            {verdict}
          </span>
        </div>
      )}
      {earliest && !showOfficialFunding ? null : (
      <div className={cn(earliest ? "mt-4 border-t border-line pt-3" : "mt-3")}>
        {officialAge != null ? (
          <div className="mb-3 text-[11px] font-medium text-muted">{t.reports.officialPathHint.replace("{retire}", String(officialAge))}</div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.fundingNeed}</div>
            <div className={cn("mt-0.5 font-semibold tabular-nums", compact ? "text-lg" : "text-xl")}>{money(need, "HKD")}</div>
          </div>
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.nowHave}</div>
            <div className={cn("mt-0.5 font-semibold tabular-nums", compact ? "text-lg" : "text-xl")}>{money(investable, "HKD")}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[11px] text-muted">{t.reports.nowGapLabel}</div>
          <div className={cn("font-semibold tabular-nums", gapToneClass(gapTone), compact ? "text-xl" : "text-2xl")}>
            {nowGapLabel} {money(Math.abs(shownNowGap), "HKD")}
          </div>
          <p className="mt-1 text-[11px] leading-4 text-muted">{t.reports.nowGapHint}</p>
        </div>
        {earliest ? null : velocityLine ? <p className="mt-3 text-sm leading-5">{velocityLine}</p> : null}
        {earliest ? null : <p className="mt-2 text-[11px] leading-4 text-muted">{t.reports.velocityPaceHint}</p>}
        {pathHaveLine ? <p className="mt-2 text-[11px] leading-4 text-muted">{pathHaveLine}</p> : null}
      </div>
      )}
    </section>
  );
}

export function RetirementPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const head = useRetirementHeadline();
  const { accounts, holdings, rates, base, pack, fire, story, planEndAge, investable, funding, earliest } = head;
  const [exportMd, setExportMd] = useState<string | null>(null);
  const swrLabel = `${((base.fireSwr ?? 0.04) * 100).toFixed(1)}%`;
  const planVerdict =
    story.kind === "enough"
      ? t.reports.verdictEnoughUntil.replace("{age}", String(planEndAge))
      : story.kind === "short"
        ? t.reports.verdictShortUntil.replace("{age}", String(planEndAge))
        : t.reports.verdictSetup;
  const fundingLabel = funding.gap < 0 ? t.reports.fundingGapShort : t.reports.fundingGapExtra;
  const nowGap = funding.ready ? funding.need - investable : 0;
  const nowGapLabel = nowGap > 0 ? t.reports.nowGapShort : t.reports.nowGapOver;
  const gapTone = earliestRetireTone(nowGap, earliest);
  const etaText = earliestVsText(t.reports, earliest);
  const ageKind = earliestStoryKind(earliest, story.kind !== "setup" && funding.ready);
  const ageVerdict = earliestStickyText(t.reports, earliest) ?? planVerdict;
  const pathHaveLine = t.reports.pathHaveLine
    .replace("{have}", money(funding.have, "HKD"))
    .replace("{gapLabel}", fundingLabel)
    .replace("{gap}", money(Math.abs(funding.gap), "HKD"));
  const corpusAtRetire = head.corpusAtRetire ?? 0;
  const years = head.life.result.stay?.years ?? [];

  function buildExport(): string {
    const acctName = (id?: string) => {
      const a = accounts.find((x) => x.id === id);
      return a ? pickName(locale, a.name, a.nameZh) : "—";
    };
    const lines = [
      "# HK Life Money — retirement brief",
      `Generated: ${new Date().toISOString()}`,
      "",
      "## Profile",
      `- Current age: ${base.currentAge}${base.birthday ? ` (birthday ${base.birthday})` : ""}`,
      `- Retire age: ${base.retireAge}`,
      `- Plan to: ${base.deathAge}`,
      `- Monthly income now (HKD): ${Math.round(base.monthlyIncomeNow)}`,
      `- Monthly spend now (HKD): ${Math.round(base.monthlySpendNow)}`,
      `- Target monthly spend in retirement (HKD): ${Math.round(base.targetMonthly)}`,
      `- Inflation: ${(base.inflation * 100).toFixed(2)}%`,
      `- Expected return before retire: ${(base.preReturn * 100).toFixed(2)}%`,
      `- Expected return after retire: ${(base.postReturn * 100).toFixed(2)}%`,
      `- FIRE withdrawal rate: ${((base.fireSwr ?? 0.04) * 100).toFixed(2)}%`,
      `- Reverse mortgage LTV: ${((base.reverseMortgageLtv ?? 0) * 100).toFixed(1)}%`,
      `- Income basis: ${head.incomeSource}`,
      `- Spend-now basis: ${head.spendSource}`,
      `- Saving now (HKD / month): ${Math.round(head.saveMonthly)} (${head.saveSource})`,
      "",
      "## Official result",
      `- Verdict: ${story.kind}`,
      `- Typed retirement spend (HKD / month): ${Math.round(base.targetMonthly)}`,
      `- Needed on retirement day (HKD, usable assets): ${story.kind === "setup" || !funding.ready ? "n/a" : Math.round(funding.need)}`,
      `- Expected on retirement day (HKD, usable assets): ${story.kind === "setup" || !funding.ready ? "n/a" : Math.round(funding.have)}`,
      `- Funding gap (HKD, have minus need): ${story.kind === "setup" || !funding.ready ? "n/a" : Math.round(funding.gap)}`,
      `- Monthly room (HKD / month, today’s dollars): ${Math.round(story.surplusMonthly)}`,
      `- Usable assets now (HKD): ${Math.round(investable)}`,
      `- Gap from today vs retirement-day need (HKD): ${story.kind === "setup" || !funding.ready ? "n/a" : Math.round(funding.need - investable)}`,
      `- Earliest sustainable retire age: ${earliest ? `${earliest.kind}${earliest.age != null ? ` at ${earliest.age} (planned ${earliest.plannedAge}, vs ${earliest.vsPlanned})` : ""}` : "n/a"}`,
      `- Home, not living costs (HKD): ${Math.round(pack.property)}`,
      `- Plan through age: ${planEndAge}`,
      `- Assets on the path at retire age (HKD): ${story.kind === "setup" ? "n/a" : Math.round(corpusAtRetire)}`,
      `- Depletes before plan end: ${head.life.result.stay?.depletes ? `yes${head.life.result.stay.depletionAge ? ` at ${head.life.result.stay.depletionAge}` : ""}` : story.kind === "setup" ? "n/a" : "no"}`,
      "",
      "## Reference only (not the official yes/no)",
      `- ${swrLabel} withdrawal number (HKD): ${Math.round(fire.fireNumber)}`,
      `- Annual travel budget in FIRE number (HKD): ${Math.round(base.travelInRetirement || 0)}`,
      `- Account-projection accessible at retire (HKD): ${Math.round(head.access.accessible)}`,
      `- Account-projection locked at retire (HKD): ${Math.round(head.access.locked)}`,
      `- Account-projection total (HKD): ${Math.round(head.access.total)}`,
      "",
      "## Holdings (marked to market)",
      "market,symbol,name,quantity,price,currency,value_hkd,account",
      ...holdings.map((h) =>
        [
          h.market,
          h.symbol,
          `"${(h.name || h.symbol).replace(/"/g, "'")}"`,
          h.quantity,
          h.lastPrice,
          h.currency,
          Math.round(toHkd(h.quantity * (h.lastPrice || 0), h.currency, rates)),
          acctName(h.accountId),
        ].join(","),
      ),
      holdings.length ? "" : "(none)",
      "",
      "## Forecast sleeves",
      "label,kind,amount_hkd,annual_return_pct,included",
      ...pack.sleeves.map((s) =>
        [`"${s.label.replace(/"/g, "'")}"`, s.kind, Math.round(s.amount), ((s.annualReturn ?? 0) * 100).toFixed(2), s.included ? "yes" : "no"].join(","),
      ),
      "",
      "## Corpus by age (HKD)",
      "age,corpus",
      ...years.map((s) => `${s.age},${Math.round(s.closingFinancial)}`),
      "",
      "Use this brief to comment on FIRE feasibility, concentration risk in holdings, return assumptions, and whether the monthly target is sustainable.",
    ];
    return lines.join("\n");
  }

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.reports.retirement}
        backTo="/reports"
        right={
          <div className="flex items-center gap-1">
            <button type="button" className="px-2 text-sm font-medium text-accent" onClick={() => setExportMd(buildExport())}>
              {t.reports.exportBrief}
            </button>
            <InfoButton k="retirement" />
          </div>
        }
      />
      {story.kind === "setup" ? null : (
        <StickyConclusionBar
          kind={ageKind}
          verdict={ageVerdict}
          gapTone={gapTone}
          etaText={etaText}
          dragging={false}
        />
      )}
      <p className="mx-4 mb-3 text-[12px] leading-5 text-muted">{t.reports.pagePurpose}</p>

      {story.kind === "setup" || !funding.ready ? (
        <Enter>
          <section className="mx-4 mb-3 rounded-2xl bg-elevated p-4">
            <p className="text-sm leading-5">{t.reports.setupEmpty}</p>
            <p className="mt-1 text-[11px] leading-4 text-muted">{t.reports.setupLine}</p>
            <Link
              to="/reports/retirement/setup"
              className="tr-press mt-3 flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent"
            >
              {t.reports.setupCta}
            </Link>
          </section>
        </Enter>
      ) : (
        <>
          <Enter>
            <OfficialAnswerCard
              fundingReady={funding.ready}
              need={funding.need}
              investable={investable}
              nowGap={nowGap}
              nowGapLabel={nowGapLabel}
              gapTone={gapTone}
              verdict={planVerdict}
              verdictKind={story.kind}
              pathHaveLine={pathHaveLine}
              earliest={earliest}
            />
          </Enter>
          <Link
            to="/reports/retirement/setup"
            className="tr-press mx-4 mb-3 flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent"
          >
            {t.reports.settingsAdjust}
          </Link>
        </>
      )}

      <div className="mx-4 mb-3 space-y-1">
        <QuietLink to="/reports/retirement/setup" label={t.reports.settingsTitle} />
        <QuietLink to="/reports/retirement/projection" label={t.reports.scenarioYears} />
        <QuietLink to="/reports/retirement/early-retirement" label={t.reports.linkWhatIf} />
        <QuietLink to="/reports/retirement/plan" label={t.reports.linkFireRef} />
      </div>

      <p className="px-5 py-4 text-xs leading-relaxed text-faint">{t.reports.disclaimer}</p>
      {exportMd ? (
        <ReportAiSheet
          title={t.reports.exportPreview}
          hint={t.reports.exportBrief}
          filename={`hk-life-retirement-${todayISO()}.md`}
          markdown={exportMd}
          onClose={() => setExportMd(null)}
        />
      ) : null}
    </div>
  );
}

function QuietLink({ to, label }: { to: "/reports/retirement/setup" | "/reports/retirement/projection" | "/reports/retirement/early-retirement" | "/reports/retirement/plan"; label: string }) {
  return (
    <Link to={to} className="tr-press flex min-h-11 items-center justify-between rounded-xl px-3 text-sm text-muted">
      {label}
      <ChevronRight className="size-4 text-faint" />
    </Link>
  );
}

export function RetirementProjectionPage() {
  const t = useT();
  const head = useRetirementHeadline();
  const { result } = head.life;
  const { base } = head;
  const years = result.stay?.years ?? [];
  const sale = years.find((y) => y.inheritProceeds > 0);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.annualProjection} backTo="/reports/retirement" />
      <p className="px-5 pb-3 text-xs leading-5 text-muted">
        {t.reports.plannedPathHint.replace("{retire}", String(base.retireAge))}。{t.reports.lpProjectionHint}
      </p>
      {sale ? (
        <Enter>
        <div className="mx-4 mb-3 rounded-2xl bg-elevated p-4 text-sm">
          <div className="font-medium">
            {sale.calendarYear} · {t.reports.atAge} {sale.age}
          </div>
          <div className="mt-2 space-y-1 text-[12px]">
            <Row k={t.reports.openingAcc} n={sale.openingFinancial} />
            <Row k={t.reports.lpInheritSold} n={sale.inheritProceeds} />
            <Row k={t.reports.lpInheritPremium} n={sale.annuityBuy} />
            <Row k={t.reports.lpInheritKept} n={sale.inheritKept} />
            <Row k={t.reports.closingAcc} n={sale.closingFinancial} />
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted">
            {t.reports.lpWithoutInherit} {money(sale.closingFinancial - sale.inheritKept, "HKD")}
          </p>
        </div>
        </Enter>
      ) : null}
      {result.ready && years.length ? (
        <Enter delay>
        <LifeYearList years={years} focusAge={base.retireAge} />
        </Enter>
      ) : (
        <p className="mx-4 rounded-2xl bg-elevated px-4 py-3 text-sm text-muted">{t.reports.lpNeedData}</p>
      )}
    </div>
  );
}

function Row({ k, n }: { k: string; n: number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="tabular-nums">{money(n, "HKD")}</span>
    </div>
  );
}
