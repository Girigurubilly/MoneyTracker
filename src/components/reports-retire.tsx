import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Hairline, InfoButton, ScreenHeader, SectionLabel } from "@/components/shared";
import { LifeYearList } from "@/components/life-year-list";
import { LifePlanSetup } from "@/components/life-plan-setup";
import { ReportAiSheet } from "@/components/report-ai-sheet";
import {
  ChartScrubLabel,
  ConfigFold,
  ConfigNumRow,
  Enter,
  formatAxisWan,
  RetireAgeSlider,
  ScenarioChips,
  StickyConclusionBar,
  type ScenarioId,
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
import { emptyLifePlan, inheritanceAnnuityAccount, INHERIT_ANNUITY_ID, lifePlanMonthlyRoom, resolveLifePlan, runLifePlan } from "@/lib/calc/life-plan";
import {
  accessBreakdown,
  corpusAgeLabels,
  enoughStory,
  goalsReady,
  inflatedMonthly,
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
  const { base, pack, ctx, mortgage } = useRetirementModel();
  const resolved = useMemo(() => {
    const pay = mortgage ? monthlyPayment(mortgage.outstanding, effectiveRate(mortgage), mortgage.remainingMonths) : 0;
    const months = mortgage ? remainingFromStart(mortgage, todayISO())?.remainingMonths ?? mortgage.remainingMonths : 0;
    const end = mortgage ? addMonths(todayISO(), months) : "";
    return resolveLifePlan(plan, {
      birthday: base.birthday,
      currentAge: base.currentAge,
      retireAge: base.retireAge,
      deathAge: base.deathAge,
      inflation: base.inflation,
      postReturn: base.postReturn,
      monthlyIncomeNow: base.monthlyIncomeNow,
      monthlySpendNow: base.monthlySpendNow,
      targetMonthly: base.targetMonthly,
      reverseMortgageLtv: base.reverseMortgageLtv,
      investable: ctx.investableNow,
      property: pack.property,
      mortgage: mortgage
        ? { outstanding: mortgage.outstanding, monthlyPayment: mortgage.paymentOverride ?? pay, endDate: end, rate: effectiveRate(mortgage) }
        : null,
      today: todayISO(),
    });
  }, [plan, base, pack.property, ctx.investableNow, mortgage]);
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
  return { plan, resolved, result, inflows };
}

export function useRetirementHeadline() {
  const model = useRetirementModel();
  const life = useLifePlanResult();
  const room = useMemo(() => lifePlanMonthlyRoom(life.resolved, todayISO(), life.inflows), [life.resolved, life.inflows]);
  const planEndAge = life.result.stay?.years[life.result.stay.years.length - 1]?.age ?? model.base.deathAge;
  const story = enoughStory({
    ready: model.ready,
    hasPath: Boolean(life.result.stay),
    depletes: Boolean(life.result.stay?.depletes),
    plannedMonthly: model.base.targetMonthly,
    surplusMonthly: room.surplus,
    planEndAge,
  });
  const yearsToRetire = Math.max(0, model.base.retireAge - model.base.currentAge);
  const mort = mortgageStory({
    outstanding: model.mortgage?.outstanding ?? 0,
    remainingMonths: model.mortgage?.remainingMonths ?? 0,
    yearsToRetire,
    payOffAtRetire: Boolean(model.base.payOffMortgageAtRetire),
  });
  return {
    ...model,
    life,
    room,
    story,
    mort,
    planEndAge,
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
  const { base, story } = head;
  const verdict =
    story.kind === "enough" ? t.reports.verdictEnough : story.kind === "short" ? t.reports.verdictShort : t.reports.verdictSetup;
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
              <span className={story.kind === "enough" ? "text-income" : "text-expense"}>{verdict}</span>
              {" · "}
              <span className={cn("tabular-nums", story.gap < 0 ? "text-expense" : "text-income")}>
                {money(story.gap, "HKD", { sign: true })}
              </span>
              {" · "}
              {t.reports.retireAge} {base.retireAge}
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

function SetupGuide({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const total = 4;
  const titles = [t.reports.guideWhen, t.reports.guideNow, t.reports.guideAfter, t.reports.guideRates];
  const bodies = [t.reports.guideWhenBody, t.reports.guideNowBody, t.reports.guideAfterBody, t.reports.guideRatesBody];
  const last = step >= total;
  return (
    <div className="mx-4 mb-3 rounded-2xl bg-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium">{last ? t.reports.guideDone : titles[step]}</div>
        <button type="button" className="shrink-0 text-xs font-medium text-accent" onClick={onClose}>
          {t.reports.guideHide}
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-muted">{t.reports.guideNoDup}</p>
      <div className="mt-1 text-[11px] text-muted">
        {last ? t.reports.guideDoneBody : t.reports.guideOf.replace("{n}", String(step + 1)).replace("{total}", String(total))}
      </div>
      {last ? null : <p className="mt-2 text-xs leading-5 text-muted">{bodies[step]}</p>}
      <div className="mt-3 flex gap-2">
        {step > 0 ? (
          <button type="button" className="h-11 flex-1 rounded-xl bg-background text-sm font-medium" onClick={() => setStep((n) => Math.max(0, n - 1))}>
            {t.reports.guideBack}
          </button>
        ) : (
          <span className="flex-1" />
        )}
        {last ? (
          <button type="button" className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={onClose}>
            {t.reports.guideFinish}
          </button>
        ) : (
          <button type="button" className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => setStep((n) => n + 1)}>
            {t.reports.guideNext}
          </button>
        )}
      </div>
    </div>
  );
}

export function RetirementPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const head = useRetirementHeadline();
  const { accounts, holdings, rates, base, ctx, pack, result, fire, persist, rmMonthly, mortgage, life, story, mort, planEndAge, investable } = head;
  const years = life.result.stay?.years ?? [];
  const chartData = years.map((y) => ({ age: y.age, corpus: y.closingFinancial, kept: y.inheritKept }));
  const saleYear = years.find((y) => y.inheritKept > 0);
  const updateAccount = useApp((s) => s.updateAccount);
  const corpusAtRetire = head.corpusAtRetire ?? 0;
  const [chartPoint, setChartPoint] = useState<{ age: number; corpus: number } | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draftAge, setDraftAge] = useState(base.retireAge);
  const [dragging, setDragging] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId | null>(null);
  const [exportMd, setExportMd] = useState<string | null>(null);
  const swrLabel = `${((base.fireSwr ?? 0.04) * 100).toFixed(1)}%`;
  const verdict =
    story.kind === "enough" ? t.reports.verdictEnough : story.kind === "short" ? t.reports.verdictShort : t.reports.verdictSetup;
  const sentence =
    story.kind === "enough"
      ? t.reports.enoughLine.replace("{plan}", money(story.planned, "HKD")).replace("{age}", String(planEndAge))
      : story.kind === "short"
        ? t.reports.shortLine
            .replace("{plan}", money(story.planned, "HKD"))
            .replace("{gap}", money(Math.abs(story.gap), "HKD"))
            .replace("{age}", String(planEndAge))
        : t.reports.setupLine;
  const ages = corpusAgeLabels(draftAge);
  const yearsToRetire = Math.max(0, draftAge - base.currentAge);
  const spendThen = inflatedMonthly(base.targetMonthly, yearsToRetire, base.inflation);
  const monthsLeft = Math.max(1, 12 - Number(todayISO().slice(5, 7)) + 1);
  const partTimeReady = (base.postRetireJobMonthly ?? 0) > 0;
  const shownGap = useCountUp(story.gap, dragging, 320);

  useEffect(() => {
    if (!dragging && scenario == null) setDraftAge(base.retireAge);
  }, [base.retireAge, dragging, scenario]);

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
      `- Retire spend gap (HKD / month, today’s dollars): ${Math.round(story.gap)}`,
      `- Investable now (HKD): ${Math.round(investable)}`,
      `- Property, not invested (HKD): ${Math.round(pack.property)}`,
      `- Plan through age: ${planEndAge}`,
      `- Assets on the path at retire age (HKD): ${story.kind === "setup" ? "n/a" : Math.round(corpusAtRetire)}`,
      `- Depletes before plan end: ${life.result.stay?.depletes ? `yes${life.result.stay.depletionAge ? ` at ${life.result.stay.depletionAge}` : ""}` : story.kind === "setup" ? "n/a" : "no"}`,
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

  function applyDraftAge() {
    persist({ retireAge: draftAge });
    setScenario(null);
  }

  function cancelDraft() {
    setDraftAge(base.retireAge);
    setScenario(null);
  }

  function pickScenario(id: ScenarioId) {
    setScenario(id);
    if (id === "keep65") setDraftAge(65);
    else if (id === "retire55") setDraftAge(55);
    else if (id === "part60") setDraftAge(60);
  }

  function applyScenario() {
    if (scenario === "part60" && !partTimeReady) return;
    persist({ retireAge: draftAge });
    setScenario(null);
  }

  const scrubLabel = chartPoint
    ? ChartScrubLabel({
        age: chartPoint.age,
        retireAge: draftAge,
        corpus: chartPoint.corpus,
        locale,
        workingLabel: t.reports.chartPhaseWorking,
        retiredLabel: t.reports.chartPhaseRetired,
        ageEndLabel: t.reports.chartAgeEnd,
      })
    : null;

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
      <StickyConclusionBar
        kind={story.kind}
        verdict={verdict}
        retireAge={draftAge}
        gap={story.kind === "setup" ? 0 : story.gap}
        planEndAge={planEndAge}
        dragging={dragging}
      />
      <Enter>
        <section className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
          <div className="px-4 pt-3 text-sm font-medium">{t.reports.goalsTitle}</div>
          <label className="flex min-h-11 items-center justify-between gap-3 px-4">
            <span className="text-sm">{t.reports.birthday}</span>
            <input
              type="date"
              value={base.birthday ?? ""}
              onChange={(e) => {
                const birthday = e.target.value || undefined;
                persist({ birthday, currentAge: birthday ? ageFromBirthday(birthday, todayISO()) : base.currentAge });
              }}
              className="h-11 max-w-[11.5rem] bg-transparent text-right text-sm text-accent outline-none"
            />
          </label>
          {!base.birthday ? (
            <p className="px-4 pb-2 text-[11px] leading-4 text-muted">
              {t.reports.birthdayYearEndHint.replace("{n}", String(monthsLeft))}
            </p>
          ) : null}
          <Hairline />
          {base.birthday ? (
            <div className="flex min-h-11 items-center justify-between px-4">
              <span className="text-sm">{t.reports.currentAge}</span>
              <span className="text-sm tabular-nums text-muted">{base.currentAge}</span>
            </div>
          ) : (
            <ConfigNumRow label={t.reports.currentAge} value={base.currentAge} onCommit={(n) => persist({ currentAge: n })} />
          )}
          <Hairline />
          <ConfigNumRow label={t.reports.deathAge} value={base.deathAge} onCommit={(n) => persist({ deathAge: n })} />
          <Hairline />
          <ConfigNumRow label={t.reports.spendRetired} value={base.targetMonthly} money blankZero onCommit={(n) => persist({ targetMonthly: n })} />
          <p className="px-4 pb-1 text-[11px] leading-4 text-muted">{t.reports.goalsSpendHint}</p>
          {story.kind !== "setup" && base.targetMonthly > 0 ? (
            <p className="px-4 pb-3 text-[11px] leading-4 text-muted">
              {t.reports.spendThenMoney.replace("{amount}", money(spendThen, "HKD"))}
            </p>
          ) : (
            <div className="pb-2" />
          )}
          <Hairline />
          <div className="grid grid-cols-2 gap-2 p-3">
            <button
              type="button"
              className={cn("h-11 rounded-xl text-xs font-medium", !base.payOffMortgageAtRetire ? "bg-accent text-on-accent" : "bg-background")}
              onClick={() => persist({ payOffMortgageAtRetire: false })}
            >
              {t.reports.mortgageModePay}
            </button>
            <button
              type="button"
              className={cn("h-11 rounded-xl text-xs font-medium", base.payOffMortgageAtRetire ? "bg-accent text-on-accent" : "bg-background")}
              onClick={() => persist({ payOffMortgageAtRetire: true })}
            >
              {t.reports.mortgageModeLump}
            </button>
          </div>
          <p className="px-4 pb-3 text-[11px] leading-4 text-muted">
            {mort.kind === "none"
              ? t.reports.mortgageNone
              : mort.kind === "clears-before"
                ? t.reports.mortgageClears.replace("{amount}", money(mort.owingNow, "HKD"))
                : mort.kind === "assumed-payoff"
                  ? t.reports.mortgageAssume.replace("{amount}", money(mort.owingNow, "HKD"))
                  : t.reports.mortgageOwing.replace("{amount}", money(mort.owingNow, "HKD"))}
          </p>
        </section>
      </Enter>
      <SectionLabel>{t.reports.readinessByAge}</SectionLabel>
      <p className="px-5 pb-2 text-[11px] leading-4 text-muted">{t.reports.ageSliderHint}</p>
      <RetireAgeSlider
        value={draftAge}
        committed={base.retireAge}
        onDraft={setDraftAge}
        onDragChange={setDragging}
        onApply={applyDraftAge}
        onCancel={cancelDraft}
      />
      <ScenarioChips
        active={scenario}
        partTimeReady={partTimeReady}
        onPick={pickScenario}
        onApply={applyScenario}
        onCancel={cancelDraft}
      />
      {guideOpen ? (
        <SetupGuide onClose={() => setGuideOpen(false)} />
      ) : (
        <button type="button" className="mx-4 mb-3 flex h-11 w-[calc(100%-2rem)] items-center justify-center rounded-xl bg-elevated text-sm font-medium text-accent" onClick={() => setGuideOpen(true)}>
          {t.reports.guideOpen}
        </button>
      )}
      <Enter delay>
        <section className="mx-4 mb-3 rounded-2xl bg-elevated p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">{t.reports.resultTitle}</div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                story.kind === "enough" && "bg-success-soft text-income",
                story.kind === "short" && "bg-expense-soft text-expense",
                story.kind === "setup" && "bg-background text-muted",
              )}
            >
              {verdict}
            </span>
          </div>
          <p className="mt-2 text-sm leading-5">{sentence}</p>
          {story.kind === "setup" ? null : (
            <>
              <div className="mt-3 text-[11px] text-muted">{t.reports.surplus}</div>
              <div className={cn("text-2xl font-semibold tabular-nums", shownGap < 0 ? "text-expense" : "text-income")}>
                {money(shownGap, "HKD", { sign: true })}
              </div>
              <p className="mt-1 text-[11px] leading-4 text-muted">{t.reports.surplusHint}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-background px-3 py-2">
                  <div className="text-[11px] text-muted">{t.reports.spendRetired}</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(base.targetMonthly, "HKD")}</div>
                </div>
                <div className="rounded-xl bg-background px-3 py-2">
                  <div className="text-[11px] text-muted">{t.reports.investableNow}</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(investable, "HKD")}</div>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-muted">{t.reports.investableHint}</p>
              <div className="mt-2 text-[11px] text-muted">
                {t.reports.corpusAtRetireAge
                  .replace("{end}", String(ages.endWorkingAge))
                  .replace("{start}", String(ages.startRetireAge))}
                : {money(corpusAtRetire, "HKD")}
              </div>
              <p className="mt-1 text-[11px] leading-4 text-muted">{t.reports.corpusOnPathHintChart}</p>
              {pack.property > 0 ? (
                <div className="mt-2 text-[11px] text-muted">
                  {t.reports.propertyAside}: {money(pack.property, "HKD")}
                </div>
              ) : null}
              {chartData.length ? (
                <div className="rt-chart-draw mt-3 h-40 overflow-hidden rounded-xl bg-background pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      onMouseMove={(state) => {
                        const p = state?.activePayload?.[0]?.payload as { age?: number; corpus?: number } | undefined;
                        if (p && typeof p.age === "number") setChartPoint({ age: p.age, corpus: p.corpus ?? 0 });
                      }}
                      onMouseLeave={() => setChartPoint(null)}
                    >
                      <XAxis
                        dataKey="age"
                        tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        minTickGap={28}
                      />
                      <YAxis
                        width={36}
                        tick={{ fontSize: 9, fill: "var(--color-muted)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatAxisWan(Number(v), locale)}
                      />
                      <ReferenceLine
                        x={draftAge}
                        stroke="var(--color-accent)"
                        strokeDasharray="4 3"
                        className="rt-ref-line"
                      />
                      {saleYear ? <ReferenceDot x={saleYear.age} y={saleYear.closingFinancial} r={3} fill="var(--color-accent)" stroke="none" /> : null}
                      <Tooltip content={() => null} cursor={{ stroke: "var(--color-accent)", strokeWidth: 1 }} />
                      <Area type="monotone" dataKey="corpus" stroke="var(--color-accent)" fill="var(--color-accent-soft)" strokeWidth={2} dot={false} isAnimationActive animationDuration={500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
              <p className="mt-1 text-center text-[11px] text-muted">
                {scrubLabel ?? t.reports.chartTapHint}
              </p>
              <div className="mt-3 rounded-xl bg-background px-3 py-2">
                <div className="text-[11px] text-muted">{t.reports.fireReference.replace("{swr}", swrLabel)}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(fire.fireNumber, "HKD")}</div>
                <p className="mt-1 text-[11px] leading-4 text-muted">{t.reports.fireReferenceHint}</p>
                {(base.travelInRetirement || 0) > 0 ? (
                  <p className="mt-1 text-[11px] leading-4 text-muted">
                    {t.reports.fireReferenceTravel.replace("{travel}", money(base.travelInRetirement, "HKD"))}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </section>
      </Enter>
      <SectionLabel>{t.reports.scenarios}</SectionLabel>
      <div className="mx-4 mb-3 grid grid-cols-1 gap-2">
        <Link to="/reports/retirement/plan" className="tr-press rounded-2xl bg-elevated px-4 py-3 text-sm">
          <div className="font-medium">{t.reports.scenarioFire}</div>
          <div className="mt-0.5 text-[11px] text-muted">{t.reports.firePlan}</div>
        </Link>
        <Link to="/reports/retirement/early-retirement" className="tr-press rounded-2xl bg-elevated px-4 py-3 text-sm">
          <div className="font-medium">{t.reports.scenarioEarly}</div>
          <div className="mt-0.5 text-[11px] text-muted">{t.reports.lpTitle}</div>
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/reports/retirement/projection" className="tr-press flex min-h-11 items-center justify-center rounded-2xl bg-elevated px-2 text-center text-sm font-medium">
            {t.reports.scenarioYears}
          </Link>
          <Link to="/more/retirement-accounts" className="tr-press flex min-h-11 items-center justify-center rounded-2xl bg-elevated px-2 text-center text-sm font-medium">
            {t.reports.manageRa}
          </Link>
        </div>
      </div>
      <button
        type="button"
        className="tr-press mx-4 mb-3 flex h-11 items-center justify-center gap-1 rounded-xl bg-elevated text-sm font-medium"
        onClick={() => setDetailsOpen((v) => !v)}
      >
        {detailsOpen ? t.reports.detailsHide : t.reports.detailsOpen}
        <ChevronDown className={cn("size-4 transition", detailsOpen && "rotate-180")} />
      </button>
      {detailsOpen ? (
        <>
          <SectionLabel>{t.reports.assetsByAge}</SectionLabel>
          <div className="mx-4 mb-1 overflow-hidden rounded-2xl bg-elevated pt-2">
            <div className="rt-chart-draw h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                  onMouseMove={(state) => {
                    const p = state?.activePayload?.[0]?.payload as { age?: number; corpus?: number } | undefined;
                    if (p && typeof p.age === "number") setChartPoint({ age: p.age, corpus: p.corpus ?? 0 });
                  }}
                  onMouseLeave={() => setChartPoint(null)}
                >
                  <XAxis dataKey="age" tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
                  <YAxis width={40} tick={{ fontSize: 9, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxisWan(Number(v), locale)} />
                  <ReferenceLine x={draftAge} stroke="var(--color-accent)" strokeDasharray="4 3" className="rt-ref-line" />
                  {saleYear ? <ReferenceDot x={saleYear.age} y={saleYear.closingFinancial} r={4} fill="var(--color-accent)" stroke="none" /> : null}
                  <Tooltip content={() => null} cursor={{ stroke: "var(--color-accent)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="corpus" name={t.reports.lpAssetsLine} stroke="var(--color-accent)" fill="var(--color-accent-soft)" strokeWidth={2} dot={false} isAnimationActive animationDuration={500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="px-4 pb-3 text-center text-xs text-muted">
              {scrubLabel ?? (saleYear ? `${saleYear.calendarYear} · ${t.reports.lpInheritKept} ${money(saleYear.inheritKept, "HKD")}` : t.reports.chartTapHint)}
            </p>
          </div>
          <AccessCard access={head.access} />
          <HousingCard plan={result.plan} mortgage={mortgage} housing={ctx.housingAfterPayoff} story={mort} />
        </>
      ) : null}
      <button
        type="button"
        className="tr-press mx-4 mb-3 flex h-11 items-center justify-center gap-1 rounded-xl bg-elevated text-sm font-medium"
        onClick={() => setShowSetup((v) => !v)}
      >
        {showSetup ? t.reports.hideAssumptions : t.reports.assumptionsOneLine}
        <ChevronDown className={cn("size-4 transition", showSetup && "rotate-180")} />
      </button>
      {showSetup ? (
        <>
          <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
            <ConfigNumRow label={t.reports.salaryNow} value={base.monthlyIncomeNow} money onCommit={(n) => persist({ monthlyIncomeNow: n })} />
            <Hairline />
            <SpendSlider
              label={t.reports.spendNow}
              value={base.monthlySpendNow}
              onCommit={(n) => persist({ monthlySpendNow: n })}
            />
            <p className="px-4 pb-3 text-[11px] leading-4 text-muted">
              {t.reports.saveBasis
                .replace("{amount}", money(head.saveMonthly, "HKD"))
                .replace("{basis}", head.saveSource === "manual" ? t.reports.basisManual : t.reports.basisLedger)}
            </p>
          </div>
          <p className="px-5 pb-2 text-[11px] leading-4 text-muted">{t.reports.setupEnough}</p>

          <ConfigFold title={t.reports.assumptions}>
            <StepPct label={t.reports.inflation} value={base.inflation} onCommit={(n) => persist({ inflation: n })} />
            <Hairline />
            <StepPct label={t.reports.preReturn} value={base.preReturn} onCommit={(n) => persist({ preReturn: n })} />
            <Hairline />
            <StepPct label={t.reports.postReturn} value={base.postReturn} onCommit={(n) => persist({ postReturn: n })} />
            <p className="px-4 pb-3 text-[11px] leading-4 text-muted">{t.reports.leaveDefaultsHint}</p>
          </ConfigFold>

          <ConfigFold title={t.reports.retireAdvanced}>
            <ConfigNumRow label={t.reports.travelRetired} value={base.travelInRetirement} money onCommit={(n) => persist({ travelInRetirement: n })} />
            <Hairline />
            <ConfigNumRow label={`${t.reports.fireSwr} (%)`} value={+((base.fireSwr ?? 0.04) * 100).toFixed(2)} onCommit={(n) => persist({ fireSwr: n / 100 })} />
            <Hairline />
            <ConfigNumRow label={`${t.reports.reverseLtv} (%)`} value={+((base.reverseMortgageLtv ?? 0) * 100).toFixed(2)} onCommit={(n) => persist({ reverseMortgageLtv: n / 100 })} />
            <Hairline />
            <ConfigNumRow label={t.reports.emergencyReserve} value={base.emergencyReserve ?? 0} money onCommit={(n) => persist({ emergencyReserve: n })} />
            <Hairline />
            <ConfigNumRow label={t.reports.liquidityFloor} value={base.liquidityFloor ?? 0} money onCommit={(n) => persist({ liquidityFloor: n })} />
            <Hairline />
            <ConfigNumRow label={t.reports.desiredBuffer} value={base.desiredEndBuffer ?? 0} money onCommit={(n) => persist({ desiredEndBuffer: n })} />
            <Hairline />
            <ConfigNumRow label={t.reports.laterLifeAge} value={base.laterLifeAge ?? 75} onCommit={(n) => persist({ laterLifeAge: n })} />
          </ConfigFold>

          <LifePlanSetup />

      <SectionLabel>{t.reports.setupAccounts}</SectionLabel>
      <p className="px-5 pb-2 text-[11px] leading-4 text-muted">{t.reports.setupAccountsHint}</p>
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-success-soft px-3 py-2">
            <div className="text-[11px] text-income">{t.reports.propertyEquity}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(pack.property, "HKD")}</div>
          </div>
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.reverseMonthly}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(rmMonthly, "HKD")}</div>
          </div>
        </div>
        {pack.sleeves.filter((s) => s.kind === "property").map((s) => (
          <div key={s.id} className="mt-2 flex items-center justify-between text-sm">
            <span className="truncate text-muted">{s.label}</span>
            <span className="tabular-nums">{money(s.amount, "HKD")}</span>
          </div>
        ))}
      </div>

      <SleeveReturns
        title={t.reports.cashAccounts}
        rows={pack.sleeves.filter((s) => s.kind === "cash")}
        onSave={(id, annualReturn) => {
          const acc = accounts.find((a) => a.id === id);
          if (acc) void updateAccount({ ...acc, expectedReturn: annualReturn });
        }}
        onToggle={(id, included) => {
          const acc = accounts.find((a) => a.id === id);
          if (acc) void updateAccount({ ...acc, retireInclude: included });
        }}
      />
      <SleeveReturns
        title={t.reports.investAccounts}
        rows={pack.sleeves.filter((s) => s.kind === "invest" && !s.id.startsWith("hold-"))}
        onSave={(id, annualReturn) => {
          const acc = accounts.find((a) => a.id === id);
          if (acc) void updateAccount({ ...acc, expectedReturn: annualReturn });
        }}
        onToggle={(id, included) => {
          const acc = accounts.find((a) => a.id === id);
          if (acc) void updateAccount({ ...acc, retireInclude: included });
        }}
      />

        </>
      ) : null}

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

export function RetirementProjectionPage() {
  const t = useT();
  const { result } = useLifePlanResult();
  const { base } = useRetirementModel();
  const years = result.stay?.years ?? [];
  const sale = years.find((y) => y.inheritProceeds > 0);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.annualProjection} backTo="/reports/retirement" />
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.reports.lpProjectionHint}</p>
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

function AccessCard({ access }: { access: { accessible: number; locked: number; total: number } }) {
  const t = useT();
  return (
    <div id="retire-access" className="mb-3">
      <SectionLabel>{t.reports.accessibility}</SectionLabel>
      <div className="mx-4 rounded-2xl bg-elevated p-4">
        <RowAmt label={t.reports.accessibleAtRetire} value={access.accessible} />
        <RowAmt label={t.reports.lockedAtRetire} value={access.locked} />
        <RowAmt label={t.reports.accessTotal} value={access.total} bold />
        <p className="mt-2 text-[11px] leading-4 text-muted">{t.reports.accessModelNote}</p>
      </div>
    </div>
  );
}

function RowAmt({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={cn("mt-1 flex items-center justify-between text-xs", bold && "text-sm font-semibold")}>
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{money(value, "HKD")}</span>
    </div>
  );
}

function HousingCard({
  plan,
  mortgage,
  housing,
  story,
}: {
  plan: NonNullable<ReturnType<typeof runRetirement>["plan"]>;
  mortgage: ReturnType<typeof useApp.getState>["mortgage"];
  housing: number;
  story: ReturnType<typeof mortgageStory>;
}) {
  const t = useT();
  const retireRow = plan.years.find((y) => !y.flags.isPreRetirement);
  const projectedLeft = story.kind === "assumed-payoff" || story.kind === "none" ? null : (retireRow?.openingMortgage ?? 0);
  const note =
    story.kind === "none"
      ? t.reports.mortgageNone
      : story.kind === "clears-before"
        ? t.reports.mortgageClears.replace("{amount}", money(story.owingNow, "HKD"))
        : story.kind === "assumed-payoff"
          ? t.reports.mortgageAssume.replace("{amount}", money(story.owingNow, "HKD"))
          : t.reports.mortgageOwing.replace("{amount}", money(story.owingNow, "HKD"));
  return (
    <div id="retire-house" className="mb-3">
      <SectionLabel>{t.reports.housingTimeline}</SectionLabel>
      <div className="mx-4 rounded-2xl bg-elevated p-4">
        <p className="text-[11px] leading-4 text-muted">{note}</p>
        <p className="mt-1 text-[11px] leading-4 text-muted">{t.reports.mortgageModePay} / {t.reports.mortgageModeLump}</p>
        <RowAmt label={t.reports.outstanding} value={story.owingNow} bold />
        {projectedLeft != null ? <RowAmt label={t.reports.mortgageAtRetire} value={projectedLeft} /> : null}
        <RowAmt label={t.reports.housingAfter} value={housing} />
        {mortgage ? <p className="mt-2 text-[11px] text-muted">{mortgage.nameZh || mortgage.name}</p> : null}
      </div>
    </div>
  );
}

function SpendSlider({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const stepped = Math.round(value / 1000) * 1000;
  return (
    <div className="px-3 py-2.5">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="text-sm tabular-nums text-muted">{money(value, "HKD")}</span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(80_000, stepped + 20_000)}
        step={1000}
        value={Math.min(Math.max(0, stepped), Math.max(80_000, stepped + 20_000))}
        className="mt-1 w-full accent-[var(--color-accent)]"
        onChange={(e) => onCommit(Number(e.target.value))}
      />
    </div>
  );
}

function StepPct({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const pct = +(value * 100).toFixed(2);
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 px-3 py-2.5">
      <span className="text-sm">{label} (%)</span>
      <div className="flex items-center gap-1">
        <button type="button" className="tr-press grid size-9 place-items-center rounded-lg bg-background text-sm font-medium" onClick={() => onCommit(Math.max(0, +(value - 0.005).toFixed(4)))}>
          −
        </button>
        <span className="min-w-[3.5rem] text-center text-sm tabular-nums">{pct}</span>
        <button type="button" className="tr-press grid size-9 place-items-center rounded-lg bg-background text-sm font-medium" onClick={() => onCommit(+(value + 0.005).toFixed(4))}>
          +
        </button>
      </div>
    </div>
  );
}


function SleeveReturns({
  title,
  rows,
  onSave,
  onToggle,
}: {
  title: string;
  rows: { id: string; label: string; amount: number; annualReturn: number; included: boolean }[];
  onSave: (id: string, annualReturn: number) => void;
  onToggle: (id: string, included: boolean) => void;
}) {
  const t = useT();
  const [on, setOn] = useState(false);
  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
      <button type="button" className="tr-press flex min-h-11 w-full items-center justify-between px-4 text-left" onClick={() => setOn(!on)}>
        <span className="text-sm font-medium">{title}</span>
        <ChevronDown className={cn("size-4 text-muted transition", on && "rotate-180")} />
      </button>
      {on ? (
        rows.length === 0 ? (
          <div className="rt-fold border-t border-line"><p className="rt-fold-inner px-4 py-3 text-xs text-muted">{t.common.none}</p></div>
        ) : (
          <div className="rt-fold border-t border-line"><div className="rt-fold-inner">
            {rows.map((s, i) => (
              <div key={s.id} className={s.included ? "" : "opacity-50"}>
                {i > 0 ? <Hairline /> : null}
                <div className="px-4 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{s.label}</div>
                      <div className="text-xs tabular-nums text-muted">{money(s.amount, "HKD")}</div>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" checked={s.included} onChange={(e) => onToggle(s.id, e.target.checked)} />
                      {t.reports.includeInPlan}
                    </label>
                  </div>
                  <ConfigNumRow
                    label={`${t.reports.expectedReturn} (%)`}
                    value={+(s.annualReturn * 100).toFixed(2)}
                    onCommit={(n) => onSave(s.id, n / 100)}
                  />
                </div>
              </div>
            ))}
          </div></div>
        )
      ) : null}
    </div>
  );
}


