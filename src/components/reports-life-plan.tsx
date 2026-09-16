import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Disclaimer, Hairline, ScreenHeader, SectionLabel } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { investableNow } from "@/lib/calc/networth";
import { monthlyPayment, effectiveRate, remainingFromStart } from "@/lib/calc/mortgage";
import { emptyLifePlan, mergeLifePlan, runLifePlan, type LifePathId, type LifePathResult } from "@/lib/calc/life-plan";
import type { LifePlanSpendingStage, RetirementLifePlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { newId, useApp } from "@/store/app";
import { useT } from "@/store/ui";

export function EarlyRetirementPlanPage() {
  const t = useT();
  const stored = useApp((s) => s.lifePlan);
  const update = useApp((s) => s.updateLifePlan);
  const plan = stored ?? emptyLifePlan();
  const result = useMemo(() => runLifePlan(plan, todayISO()), [plan]);
  const [path, setPath] = useState<LifePathId>("stay");
  const active = path === "switch" ? result.switch : result.stay;
  const chart = mergeSeries(result.stay, result.switch);

  function persist(next: RetirementLifePlan) {
    void update({ ...next, id: "base", version: 1 });
  }
  function patch(p: Partial<RetirementLifePlan>) {
    persist(mergeLifePlan(plan, p));
  }

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.lpTitle} backTo="/reports/retirement" />
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.reports.lpHint}</p>

      {result.ready ? (
        <>
          <div className="mx-4 mb-3 grid grid-cols-1 gap-2">
            {result.stay ? <PathCard title={t.reports.lpStay} row={result.stay} target={plan.personal.targetTerminalFinancialAssets} t={t} /> : null}
            {result.switch ? <PathCard title={t.reports.lpSwitch} row={result.switch} target={plan.personal.targetTerminalFinancialAssets} t={t} /> : null}
          </div>
          <SectionLabel>{t.reports.lpChart}</SectionLabel>
          <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated pt-2">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <XAxis dataKey="age" tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value, name) => [money(Number(value) || 0, "HKD"), name === "stay" ? t.reports.lpStay : t.reports.lpSwitch]}
                    labelFormatter={(age) => `${t.reports.atAge} ${age}`}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--color-line)", background: "var(--color-elevated)", fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="stay" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="switch" stroke="var(--color-income)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mx-4 mb-2 grid grid-cols-2 gap-2">
            <button type="button" className={cn("h-10 rounded-xl text-sm font-medium", path === "stay" ? "bg-accent text-on-accent" : "bg-elevated")} onClick={() => setPath("stay")}>
              {t.reports.lpStay}
            </button>
            <button type="button" className={cn("h-10 rounded-xl text-sm font-medium", path === "switch" ? "bg-accent text-on-accent" : "bg-elevated")} onClick={() => setPath("switch")}>
              {t.reports.lpSwitch}
            </button>
          </div>
          {active ? <YearList years={active.years} t={t} /> : null}
        </>
      ) : (
        <p className="mx-4 mb-3 rounded-2xl bg-elevated px-4 py-3 text-sm text-muted">{t.reports.lpNeedData}</p>
      )}

      <Setup plan={plan} patch={patch} persist={persist} />
      <Disclaimer>{t.reports.lpDisclaimer}</Disclaimer>
    </div>
  );
}

function PathCard({
  title,
  row,
  target,
  t,
}: {
  title: string;
  row: LifePathResult;
  target: number | null;
  t: ReturnType<typeof useT>;
}) {
  const gap = target == null ? null : row.dwzGap;
  return (
    <div className="rounded-2xl bg-elevated p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Mini k={t.reports.lpRetireAge} v={row.retireAge == null ? "—" : String(row.retireAge)} />
        <Mini k={t.reports.lpAtRetire} v={money(row.assetsAtRetire, "HKD")} />
        <Mini k={t.reports.lpTerminal} v={money(row.terminalAssets, "HKD")} />
        <Mini k={t.reports.lpDeplete} v={row.depletes ? `${t.reports.lpDeplete} ${row.depletionAge}` : t.reports.lpNever} danger={row.depletes} />
        <Mini k={t.reports.lpMin} v={money(row.minFinancial, "HKD")} />
        {gap != null ? <Mini k={t.reports.lpDwzGap} v={`${gap >= 0 ? t.reports.lpOver : t.reports.lpUnder} ${money(Math.abs(gap), "HKD")}`} danger={gap < 0} /> : null}
      </div>
    </div>
  );
}

function Mini({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <div className="text-[11px] text-muted">{k}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", danger && "text-expense")}>{v}</div>
    </div>
  );
}

function YearList({ years, t }: { years: LifePathResult["years"]; t: ReturnType<typeof useT> }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mb-3">
      <SectionLabel>{t.reports.lpYears}</SectionLabel>
      <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
        {years.map((y, i) => (
          <div key={y.age}>
            {i > 0 ? <Hairline /> : null}
            <button type="button" className="flex w-full items-start justify-between gap-2 px-4 py-2.5 text-left" onClick={() => setOpen(open === y.age ? null : y.age)}>
              <div>
                <div className="text-sm font-medium">
                  {y.calendarYear} · {t.reports.atAge} {y.age}
                </div>
                <div className="text-[11px] text-muted">{phaseLabel(y.phase, t)}</div>
              </div>
              <div className="text-right text-xs tabular-nums">{money(y.closingFinancial, "HKD")}</div>
            </button>
            {open === y.age ? (
              <div className="space-y-1 px-4 pb-3 text-[11px] text-muted">
                <Amt k={t.reports.openingAcc} n={y.openingFinancial} />
                <Amt k={t.reports.salary} n={y.income} />
                <Amt k={t.reports.lpStageCost} n={y.living} />
                <Amt k={t.reports.lpMonthlyPay} n={y.mortgage} />
                <Amt k={t.reports.lpInherit} n={y.inheritProceeds} />
                <Amt k={t.reports.lpAnnuity} n={y.annuityIncome} />
                <Amt k={t.reports.lpReverse} n={y.reverseMortgage} />
                <Amt k={t.reports.closingAcc} n={y.closingFinancial} />
                {y.notes.map((n) => (
                  <p key={n}>{n}</p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Amt({ k, n }: { k: string; n: number }) {
  if (!n) return null;
  return (
    <div className="flex justify-between gap-2">
      <span>{k}</span>
      <span className="tabular-nums">{money(n, "HKD")}</span>
    </div>
  );
}

function phaseLabel(phase: string, t: ReturnType<typeof useT>) {
  if (phase === "lower") return t.reports.lpPhaseLower;
  if (phase === "retired") return t.reports.lpPhaseRetired;
  return t.reports.lpPhaseCurrent;
}

function mergeSeries(stay: LifePathResult | null, sw: LifePathResult | null) {
  const ages = new Set<number>();
  stay?.series.forEach((s) => ages.add(s.age));
  sw?.series.forEach((s) => ages.add(s.age));
  const stayMap = new Map(stay?.series.map((s) => [s.age, s.financial]));
  const swMap = new Map(sw?.series.map((s) => [s.age, s.financial]));
  return [...ages]
    .sort((a, b) => a - b)
    .map((age) => ({ age, stay: stayMap.get(age), switch: swMap.get(age) }));
}

function Setup({
  plan,
  patch,
  persist,
}: {
  plan: RetirementLifePlan;
  patch: (p: Partial<RetirementLifePlan>) => void;
  persist: (p: RetirementLifePlan) => void;
}) {
  const t = useT();
  const ret = useApp((s) => s.retirement);
  const mortgage = useApp((s) => s.mortgage);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);

  return (
    <div className="space-y-2">
      <Fold title={t.reports.lpPersonal} open>
        <DateRow label={t.reports.lpDob} value={plan.personal.dateOfBirth} onChange={(v) => patch({ personal: { ...plan.personal, dateOfBirth: v } })} />
        <DateRow label={t.reports.lpStart} value={plan.personal.planStartDate} onChange={(v) => patch({ personal: { ...plan.personal, planStartDate: v } })} />
        <NullNum label={t.reports.lpEndAge} value={plan.personal.planEndAge} onCommit={(n) => patch({ personal: { ...plan.personal, planEndAge: n } })} />
        <NullNum label={t.reports.lpDwz} value={plan.personal.targetTerminalFinancialAssets} money onCommit={(n) => patch({ personal: { ...plan.personal, targetTerminalFinancialAssets: n } })} />
        <p className="px-4 pb-3 text-[11px] text-muted">{t.reports.lpDwzHint}</p>
        {ret?.birthday ? (
          <button type="button" className="mx-4 mb-3 h-10 rounded-xl bg-background px-3 text-xs font-medium" onClick={() => patch({ personal: { ...plan.personal, dateOfBirth: ret.birthday ?? null } })}>
            {t.reports.lpCopyBirthday}
          </button>
        ) : null}
      </Fold>

      <Fold title={t.reports.lpCurrentJob}>
        <Toggle label={t.reports.lpEnabled} on={plan.currentJob.enabled} onChange={(on) => patch({ currentJob: { ...plan.currentJob, enabled: on } })} />
        <DateRow label={t.reports.lpJobEnd} value={plan.currentJob.endDate} onChange={(v) => patch({ currentJob: { ...plan.currentJob, endDate: v } })} />
        <NullNum label={t.reports.lpGross} value={plan.currentJob.grossMonthlyIncome} money onCommit={(n) => patch({ currentJob: { ...plan.currentJob, grossMonthlyIncome: n } })} />
        <NullNum label={t.reports.lpSpendNow} value={plan.currentJob.actualMonthlySpending} money onCommit={(n) => patch({ currentJob: { ...plan.currentJob, actualMonthlySpending: n } })} />
        <NullNum label={t.reports.lpSaveOverride} value={plan.currentJob.monthlySavingsOverride} money onCommit={(n) => patch({ currentJob: { ...plan.currentJob, monthlySavingsOverride: n } })} />
        <p className="px-4 pb-2 text-[11px] text-muted">{t.reports.lpSaveHint}</p>
        <NullNum label={t.reports.lpIncomeGrowth} value={pctView(plan.currentJob.annualIncomeGrowthRate)} onCommit={(n) => patch({ currentJob: { ...plan.currentJob, annualIncomeGrowthRate: n == null ? null : n / 100 } })} />
      </Fold>

      <Fold title={t.reports.lpLowerJob}>
        <Toggle label={t.reports.lpEnabled} on={plan.lowerStressJob.enabled} onChange={(on) => patch({ lowerStressJob: { ...plan.lowerStressJob, enabled: on } })} />
        <DateRow label={t.reports.lpLowerStart} value={plan.lowerStressJob.startDate} onChange={(v) => patch({ lowerStressJob: { ...plan.lowerStressJob, startDate: v } })} />
        <DateRow label={t.reports.lpLowerEnd} value={plan.lowerStressJob.endDate} onChange={(v) => patch({ lowerStressJob: { ...plan.lowerStressJob, endDate: v } })} />
        <NullNum label={t.reports.lpGross} value={plan.lowerStressJob.grossMonthlyIncome} money onCommit={(n) => patch({ lowerStressJob: { ...plan.lowerStressJob, grossMonthlyIncome: n } })} />
        <NullNum label={t.reports.lpNetOverride} value={plan.lowerStressJob.estimatedNetMonthlyIncomeOverride} money onCommit={(n) => patch({ lowerStressJob: { ...plan.lowerStressJob, estimatedNetMonthlyIncomeOverride: n } })} />
        <p className="px-4 pb-2 text-[11px] text-muted">{t.reports.lpNetHint}</p>
        <NullNum label={t.reports.lpIncomeGrowth} value={pctView(plan.lowerStressJob.annualIncomeGrowthRate)} onCommit={(n) => patch({ lowerStressJob: { ...plan.lowerStressJob, annualIncomeGrowthRate: n == null ? null : n / 100 } })} />
        <NullNum label={t.reports.lpLowerLive} value={plan.lowerStressJob.monthlyLivingCost} money onCommit={(n) => patch({ lowerStressJob: { ...plan.lowerStressJob, monthlyLivingCost: n } })} />
        <Toggle label={t.reports.lpLiveInflate} on={plan.lowerStressJob.livingCostFollowsInflation} onChange={(on) => patch({ lowerStressJob: { ...plan.lowerStressJob, livingCostFollowsInflation: on } })} />
      </Fold>

      <Fold title={t.reports.lpRetireAssumptions}>
        <DateRow label={t.reports.lpRetireStart} value={plan.retirement.startDate} onChange={(v) => patch({ retirement: { ...plan.retirement, startDate: v } })} />
        <NullNum label={t.reports.lpReturn} value={pctView(plan.retirement.annualInvestmentReturn)} onCommit={(n) => patch({ retirement: { ...plan.retirement, annualInvestmentReturn: n == null ? null : n / 100 } })} />
        <NullNum label={t.reports.lpInflation} value={pctView(plan.retirement.annualInflationRate)} onCommit={(n) => patch({ retirement: { ...plan.retirement, annualInflationRate: n == null ? null : n / 100 } })} />
        <div className="grid grid-cols-2 gap-2 px-4 py-2">
          <button type="button" className={cn("h-10 rounded-xl text-xs font-medium", plan.retirement.returnMode === "nominal" ? "bg-accent text-on-accent" : "bg-background")} onClick={() => patch({ retirement: { ...plan.retirement, returnMode: "nominal" } })}>
            {t.reports.lpNominal}
          </button>
          <button type="button" className={cn("h-10 rounded-xl text-xs font-medium", plan.retirement.returnMode === "real" ? "bg-accent text-on-accent" : "bg-background")} onClick={() => patch({ retirement: { ...plan.retirement, returnMode: "real" } })}>
            {t.reports.lpReal}
          </button>
        </div>
        <NullNum label={t.reports.lpReserveMonths} value={plan.retirement.cashReserveMonths} onCommit={(n) => patch({ retirement: { ...plan.retirement, cashReserveMonths: n } })} />
      </Fold>

      <Fold title={t.reports.lpStages}>
        <p className="px-4 pb-2 text-[11px] text-muted">{t.reports.lpStageHint}</p>
        {plan.spendingStages.map((s, i) => (
          <div key={s.id} className="border-t border-line">
            <div className="flex items-center justify-between px-4 pt-2">
              <span className="text-xs text-muted">{i + 1}</span>
              <button
                type="button"
                className="p-2 text-muted"
                onClick={() => persist({ ...plan, spendingStages: plan.spendingStages.filter((x) => x.id !== s.id) })}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <TextRow label={t.reports.lpStageLabel} value={s.label} onChange={(label) => persist({ ...plan, spendingStages: plan.spendingStages.map((x) => (x.id === s.id ? { ...x, label } : x)) })} />
            <NullNum label={t.reports.lpStageStart} value={s.startAge} onCommit={(n) => persist({ ...plan, spendingStages: plan.spendingStages.map((x) => (x.id === s.id ? { ...x, startAge: n } : x)) })} />
            <NullNum label={t.reports.lpStageEnd} value={s.endAge} onCommit={(n) => persist({ ...plan, spendingStages: plan.spendingStages.map((x) => (x.id === s.id ? { ...x, endAge: n } : x)) })} />
            <NullNum label={t.reports.lpStageCost} value={s.monthlyLivingCostInTodayMoney} money onCommit={(n) => persist({ ...plan, spendingStages: plan.spendingStages.map((x) => (x.id === s.id ? { ...x, monthlyLivingCostInTodayMoney: n } : x)) })} />
            <Toggle label={t.reports.lpLiveInflate} on={s.followsInflation} onChange={(on) => persist({ ...plan, spendingStages: plan.spendingStages.map((x) => (x.id === s.id ? { ...x, followsInflation: on } : x)) })} />
          </div>
        ))}
        <button
          type="button"
          className="m-4 flex h-11 w-[calc(100%-2rem)] items-center justify-center gap-1 rounded-xl bg-background text-sm font-medium"
          onClick={() => persist({ ...plan, spendingStages: [...plan.spendingStages, blankStage()] })}
        >
          <Plus className="size-4" />
          {t.reports.lpAddStage}
        </button>
      </Fold>

      <Fold title={t.reports.lpMortgage}>
        <Toggle label={t.reports.lpEnabled} on={plan.mortgage.enabled} onChange={(on) => patch({ mortgage: { ...plan.mortgage, enabled: on } })} />
        <NullNum label={t.reports.lpOutstanding} value={plan.mortgage.outstandingBalance} money onCommit={(n) => patch({ mortgage: { ...plan.mortgage, outstandingBalance: n } })} />
        <NullNum label={t.reports.lpMonthlyPay} value={plan.mortgage.monthlyPayment} money onCommit={(n) => patch({ mortgage: { ...plan.mortgage, monthlyPayment: n } })} />
        <DateRow label={t.reports.lpMortgageEnd} value={plan.mortgage.endDate} onChange={(v) => patch({ mortgage: { ...plan.mortgage, endDate: v } })} />
        <NullNum label={t.reports.lpMortgageRate} value={pctView(plan.mortgage.annualInterestRate)} onCommit={(n) => patch({ mortgage: { ...plan.mortgage, annualInterestRate: n == null ? null : n / 100 } })} />
        <Toggle label={t.reports.lpPayInCurrent} on={plan.mortgage.paymentIncludedInCurrentSpending} onChange={(on) => patch({ mortgage: { ...plan.mortgage, paymentIncludedInCurrentSpending: on } })} />
        <Toggle label={t.reports.lpPayInRetire} on={plan.mortgage.paymentIncludedInRetirementLivingCost} onChange={(on) => patch({ mortgage: { ...plan.mortgage, paymentIncludedInRetirementLivingCost: on } })} />
        <TextRow label={t.reports.lpPenalty} value={plan.mortgage.earlyRepaymentPenaltyNotes} onChange={(earlyRepaymentPenaltyNotes) => patch({ mortgage: { ...plan.mortgage, earlyRepaymentPenaltyNotes } })} />
        {mortgage ? (
          <button
            type="button"
            className="mx-4 mb-3 h-10 rounded-xl bg-background px-3 text-xs font-medium"
            onClick={() => {
              const pay = monthlyPayment(mortgage.outstanding, effectiveRate(mortgage), mortgage.remainingMonths);
              const left = remainingFromStart(mortgage, todayISO());
              const months = left?.remainingMonths ?? mortgage.remainingMonths;
              const end = addMonths(todayISO(), months);
              patch({
                mortgage: {
                  ...plan.mortgage,
                  enabled: true,
                  outstandingBalance: mortgage.outstanding,
                  monthlyPayment: mortgage.paymentOverride ?? pay,
                  annualInterestRate: effectiveRate(mortgage),
                  endDate: end,
                },
              });
            }}
          >
            {t.reports.lpCopyMortgage}
          </button>
        ) : null}
      </Fold>

      <Fold title={t.reports.lpAssets}>
        <NullNum label={t.reports.lpFinancial} value={plan.assets.financialAssets} money onCommit={(n) => patch({ assets: { ...plan.assets, financialAssets: n } })} />
        <NullNum label={t.reports.lpHome} value={plan.assets.selfOccupiedPropertyValue} money onCommit={(n) => patch({ assets: { ...plan.assets, selfOccupiedPropertyValue: n } })} />
        <NullNum label={t.reports.lpHomeGrowth} value={pctView(plan.assets.selfOccupiedPropertyGrowthRate)} onCommit={(n) => patch({ assets: { ...plan.assets, selfOccupiedPropertyGrowthRate: n == null ? null : n / 100 } })} />
        <button type="button" className="mx-4 mb-3 h-10 rounded-xl bg-background px-3 text-xs font-medium" onClick={() => patch({ assets: { ...plan.assets, financialAssets: investableNow(accounts, rates) } })}>
          {t.reports.lpCopyAssets}
        </button>
      </Fold>

      <Fold title={t.reports.lpInherit}>
        <Toggle label={t.reports.lpEnabled} on={plan.inheritedProperty.enabled} onChange={(on) => patch({ inheritedProperty: { ...plan.inheritedProperty, enabled: on } })} />
        <NullNum label={t.reports.lpInheritValue} value={plan.inheritedProperty.expectedValue} money onCommit={(n) => patch({ inheritedProperty: { ...plan.inheritedProperty, expectedValue: n } })} />
        <DateRow label={t.reports.lpInheritDate} value={plan.inheritedProperty.expectedDate} onChange={(v) => patch({ inheritedProperty: { ...plan.inheritedProperty, expectedDate: v } })} />
        <NullNum label={t.reports.lpInheritGrowth} value={pctView(plan.inheritedProperty.annualGrowthRate)} onCommit={(n) => patch({ inheritedProperty: { ...plan.inheritedProperty, annualGrowthRate: n == null ? null : n / 100 } })} />
        <Toggle label={t.reports.lpSell} on={plan.inheritedProperty.sell} onChange={(on) => patch({ inheritedProperty: { ...plan.inheritedProperty, sell: on } })} />
        <DateRow label={t.reports.lpSellDate} value={plan.inheritedProperty.sellDate} onChange={(v) => patch({ inheritedProperty: { ...plan.inheritedProperty, sellDate: v } })} />
        <NullNum label={t.reports.lpSellCost} value={pctView(plan.inheritedProperty.sellCostsRate)} onCommit={(n) => patch({ inheritedProperty: { ...plan.inheritedProperty, sellCostsRate: n == null ? null : n / 100 } })} />
      </Fold>

      <Fold title={t.reports.lpAnnuity}>
        <Toggle label={t.reports.lpEnabled} on={plan.publicAnnuity.enabled} onChange={(on) => patch({ publicAnnuity: { ...plan.publicAnnuity, enabled: on } })} />
        <DateRow label={t.reports.lpAnnuityDate} value={plan.publicAnnuity.purchaseDate} onChange={(v) => patch({ publicAnnuity: { ...plan.publicAnnuity, purchaseDate: v } })} />
        <NullNum label={t.reports.lpAnnuityAmt} value={plan.publicAnnuity.purchaseAmount} money onCommit={(n) => patch({ publicAnnuity: { ...plan.publicAnnuity, purchaseAmount: n } })} />
        <Toggle label={t.reports.lpAnnuityFromSale} on={plan.publicAnnuity.useInheritedSaleProceeds} onChange={(on) => patch({ publicAnnuity: { ...plan.publicAnnuity, useInheritedSaleProceeds: on } })} />
        <NullNum label={t.reports.lpAnnuityPay} value={plan.publicAnnuity.monthlyPayout} money onCommit={(n) => patch({ publicAnnuity: { ...plan.publicAnnuity, monthlyPayout: n } })} />
        <NullNum label={t.reports.lpAnnuityStart} value={plan.publicAnnuity.payoutStartAge} onCommit={(n) => patch({ publicAnnuity: { ...plan.publicAnnuity, payoutStartAge: n } })} />
        <NullNum label={t.reports.lpAnnuityYears} value={plan.publicAnnuity.payoutYears} onCommit={(n) => patch({ publicAnnuity: { ...plan.publicAnnuity, payoutYears: n } })} />
      </Fold>

      <Fold title={t.reports.lpReverse}>
        <Toggle label={t.reports.lpEnabled} on={plan.reverseMortgage.enabled} onChange={(on) => patch({ reverseMortgage: { ...plan.reverseMortgage, enabled: on } })} />
        <NullNum label={t.reports.lpReverseAge} value={plan.reverseMortgage.startAge} onCommit={(n) => patch({ reverseMortgage: { ...plan.reverseMortgage, startAge: n } })} />
        <NullNum label={t.reports.lpReverseLtv} value={pctView(plan.reverseMortgage.ltv)} onCommit={(n) => patch({ reverseMortgage: { ...plan.reverseMortgage, ltv: n == null ? null : n / 100 } })} />
        <NullNum label={t.reports.lpReversePay} value={plan.reverseMortgage.monthlyPayout} money onCommit={(n) => patch({ reverseMortgage: { ...plan.reverseMortgage, monthlyPayout: n } })} />
        <p className="px-4 pb-3 text-[11px] text-muted">{t.reports.lpReverseHint}</p>
      </Fold>
    </div>
  );
}

function blankStage(): LifePlanSpendingStage {
  return {
    id: newId(),
    label: "",
    startAge: null,
    endAge: null,
    monthlyLivingCostInTodayMoney: null,
    followsInflation: true,
    isEssential: true,
    notes: "",
  };
}

function pctView(v: number | null): number | null {
  return v == null ? null : +(v * 100).toFixed(2);
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + Math.max(0, Math.round(months)));
  return d.toISOString().slice(0, 10);
}

function Fold({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  const [on, setOn] = useState(open);
  return (
    <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
      <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOn(!on)}>
        <span className="text-sm font-medium">{title}</span>
        <ChevronDown className={cn("size-4 text-muted transition", on && "rotate-180")} />
      </button>
      {on ? <div className="border-t border-line">{children}</div> : null}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm">{label}</span>
      <input type="checkbox" className="size-4" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function DateRow({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm">{label}</span>
      <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="h-8 rounded-md bg-background px-2 text-sm outline-none" />
    </label>
  );
}

function TextRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="shrink-0 text-sm">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md bg-background px-2 text-right text-sm outline-none" />
    </label>
  );
}

function NullNum({
  label,
  value,
  onCommit,
  money: asMoney,
}: {
  label: string;
  value: number | null;
  onCommit: (n: number | null) => void;
  money?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value == null ? "" : String(value));
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      onClick={() => {
        setRaw(value == null ? "" : String(value));
        setEditing(true);
      }}
    >
      <span className="text-sm">{label}</span>
      {editing ? (
        <input
          autoFocus
          inputMode="decimal"
          value={raw}
          className="h-8 w-32 rounded-md bg-background px-2 text-right text-sm tabular-nums outline-none"
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const t = raw.trim();
            if (!t) onCommit(null);
            else {
              const n = Number(t);
              if (Number.isFinite(n)) onCommit(n);
            }
          }}
        />
      ) : (
        <span className="text-sm tabular-nums text-muted">{value == null ? "—" : asMoney ? money(value, "HKD") : value}</span>
      )}
    </button>
  );
}
