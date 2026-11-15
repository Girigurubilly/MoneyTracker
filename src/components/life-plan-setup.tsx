import { useState, type ReactNode } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { ConfigNullNum } from "@/components/retire-ux";
import { DateField } from "@/components/txn-composer";
import { emptyLifePlan, mergeLifePlan } from "@/lib/calc/life-plan";
import type { LifePlanSpendingStage, RetirementLifePlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { newId, useApp } from "@/store/app";
import { useT } from "@/store/ui";

export function LifePlanSetup() {
  const stored = useApp((s) => s.lifePlan);
  const update = useApp((s) => s.updateLifePlan);
  const plan = stored ?? emptyLifePlan();
  function persist(next: RetirementLifePlan) {
    void update({ ...next, id: "base", version: 1 });
  }
  function patch(p: Partial<RetirementLifePlan>) {
    persist(mergeLifePlan(plan, p));
  }
  return <Setup plan={plan} patch={patch} />;
}

export function LifePlanJobs() {
  const stored = useApp((s) => s.lifePlan);
  const update = useApp((s) => s.updateLifePlan);
  const plan = stored ?? emptyLifePlan();
  function persist(next: RetirementLifePlan) {
    void update({ ...next, id: "base", version: 1 });
  }
  function patch(p: Partial<RetirementLifePlan>) {
    persist(mergeLifePlan(plan, p));
  }
  const t = useT();
  return (
    <div className="mb-3 space-y-2">
      <JobFolds plan={plan} patch={patch} t={t} />
    </div>
  );
}

export function LifePlanSpendingStages() {
  const stored = useApp((s) => s.lifePlan);
  const update = useApp((s) => s.updateLifePlan);
  const plan = stored ?? emptyLifePlan();
  const t = useT();
  const stages = plan.spendingStages.filter((s) => !isPlaceholderStage(s));
  function persist(next: RetirementLifePlan) {
    void update({ ...next, id: "base", version: 1 });
  }
  return (
    <section className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
      <div className="px-4 pb-1 pt-3 text-[12px] font-medium text-muted">{t.reports.settingsStagesQ}</div>
      <p className="px-4 pb-2 text-[11px] leading-4 text-muted">{t.reports.settingsStagesHint}</p>
      {stages.map((s, i) => (
        <div key={s.id} className="border-t border-line">
          <div className="flex min-h-11 items-center justify-between px-4">
            <span className="text-xs text-muted">{i + 1}</span>
            <button type="button" className="tr-press grid size-11 place-items-center text-muted" onClick={() => persist({ ...plan, spendingStages: plan.spendingStages.filter((x) => x.id !== s.id) })}>
              <Trash2 className="size-4" />
            </button>
          </div>
          <TextRow label={t.reports.lpStageLabel} value={s.label} onChange={(label) => persist({ ...plan, spendingStages: plan.spendingStages.map((x) => (x.id === s.id ? { ...x, label } : x)) })} />
          <ConfigNullNum label={t.reports.lpStageStart} value={s.startAge} onCommit={(n) => persist({ ...plan, spendingStages: plan.spendingStages.map((x) => (x.id === s.id ? { ...x, startAge: n } : x)) })} />
          <ConfigNullNum label={t.reports.lpStageEnd} value={s.endAge} onCommit={(n) => persist({ ...plan, spendingStages: plan.spendingStages.map((x) => (x.id === s.id ? { ...x, endAge: n } : x)) })} />
          <ConfigNullNum label={t.reports.lpStageCost} value={s.monthlyLivingCostInTodayMoney} money onCommit={(n) => persist({ ...plan, spendingStages: plan.spendingStages.map((x) => (x.id === s.id ? { ...x, monthlyLivingCostInTodayMoney: n } : x)) })} />
          <Toggle label={t.reports.lpStageInflation} on={s.followsInflation} onChange={(on) => persist({ ...plan, spendingStages: plan.spendingStages.map((x) => (x.id === s.id ? { ...x, followsInflation: on } : x)) })} />
        </div>
      ))}
      <button
        type="button"
        className="tr-press m-4 flex h-11 w-[calc(100%-2rem)] items-center justify-center gap-1 rounded-xl bg-background text-sm font-medium"
        onClick={() => persist({ ...plan, spendingStages: [...plan.spendingStages.filter((s) => !isPlaceholderStage(s)), blankStage()] })}
      >
        <Plus className="size-4" />
        {t.reports.lpAddStage}
      </button>
    </section>
  );
}

function Setup({
  plan,
  patch,
}: {
  plan: RetirementLifePlan;
  patch: (p: Partial<RetirementLifePlan>) => void;
}) {
  const t = useT();
  return (
    <div className="mt-3 space-y-2">
      <Fold title={t.reports.lpPersonal} hint={t.reports.lpHintPersonal}>
        <ConfigNullNum label={t.reports.lpDwz} value={plan.personal.targetTerminalFinancialAssets} money onCommit={(n) => patch({ personal: { ...plan.personal, targetTerminalFinancialAssets: n } })} />
      </Fold>
      <Fold title={t.reports.lpMortgage} hint={t.reports.lpHintMortgage}>
        <Toggle label={t.reports.lpEnabled} on={plan.mortgage.enabled} onChange={(on) => patch({ mortgage: { ...plan.mortgage, enabled: on } })} />
        <p className="px-4 pb-3 text-[11px] leading-4 text-muted">{t.reports.lpMortgageRule}</p>
      </Fold>
      <Fold title={t.reports.lpInherit} hint={t.reports.lpHintInherit}>
        <Toggle label={t.reports.lpEnabled} on={plan.inheritedProperty.enabled} onChange={(on) => patch({ inheritedProperty: { ...plan.inheritedProperty, enabled: on } })} />
        <ConfigNullNum label={t.reports.lpInheritValue} value={plan.inheritedProperty.expectedValue} money onCommit={(n) => patch({ inheritedProperty: { ...plan.inheritedProperty, expectedValue: n } })} />
        <DateRow label={t.reports.lpInheritDate} value={plan.inheritedProperty.expectedDate} onChange={(v) => patch({ inheritedProperty: { ...plan.inheritedProperty, expectedDate: v } })} />
        <Toggle label={t.reports.lpSell} on={plan.inheritedProperty.sell} onChange={(on) => patch({ inheritedProperty: { ...plan.inheritedProperty, sell: on } })} />
        <DateRow label={t.reports.lpSellDate} value={plan.inheritedProperty.sellDate} onChange={(v) => patch({ inheritedProperty: { ...plan.inheritedProperty, sellDate: v } })} />
        <Toggle
          label={t.reports.lpBuyAnnuity}
          on={Boolean(plan.inheritedProperty.buyAnnuity)}
          onChange={(on) => patch({ inheritedProperty: { ...plan.inheritedProperty, buyAnnuity: on, sell: on ? true : plan.inheritedProperty.sell } })}
        />
        {plan.inheritedProperty.buyAnnuity ? (
          <>
            <p className="px-4 pb-2 text-[11px] leading-4 text-muted">{t.reports.lpNoteAnnuity}</p>
            <ConfigNullNum
              label={t.reports.lpAnnuityCap}
              value={plan.inheritedProperty.annuityPremium ?? null}
              money
              onCommit={(n) => patch({ inheritedProperty: { ...plan.inheritedProperty, annuityPremium: n == null ? null : Math.min(3_000_000, Math.max(0, n)) } })}
            />
            <ConfigNullNum
              label={t.reports.lpAnnuityPay}
              value={plan.inheritedProperty.annuityMonthly ?? null}
              money
              onCommit={(n) => patch({ inheritedProperty: { ...plan.inheritedProperty, annuityMonthly: n } })}
            />
            <ConfigNullNum
              label={t.reports.lpAnnuityStart}
              value={plan.inheritedProperty.annuityStartAge ?? null}
              onCommit={(n) => patch({ inheritedProperty: { ...plan.inheritedProperty, annuityStartAge: n } })}
            />
          </>
        ) : null}
      </Fold>
      <Fold title={t.reports.lpAnnuity} hint={t.reports.lpHintAnnuity}>
        <Toggle label={t.reports.lpEnabled} on={plan.publicAnnuity.enabled} onChange={(on) => patch({ publicAnnuity: { ...plan.publicAnnuity, enabled: on } })} />
        <ConfigNullNum label={t.reports.lpAnnuityAmt} value={plan.publicAnnuity.purchaseAmount} money onCommit={(n) => patch({ publicAnnuity: { ...plan.publicAnnuity, purchaseAmount: n } })} />
        <Toggle label={t.reports.lpAnnuityFromSale} on={plan.publicAnnuity.useInheritedSaleProceeds} onChange={(on) => patch({ publicAnnuity: { ...plan.publicAnnuity, useInheritedSaleProceeds: on } })} />
        <ConfigNullNum label={t.reports.lpAnnuityPay} value={plan.publicAnnuity.monthlyPayout} money onCommit={(n) => patch({ publicAnnuity: { ...plan.publicAnnuity, monthlyPayout: n } })} />
        <ConfigNullNum label={t.reports.lpAnnuityStart} value={plan.publicAnnuity.payoutStartAge} onCommit={(n) => patch({ publicAnnuity: { ...plan.publicAnnuity, payoutStartAge: n } })} />
      </Fold>
      <Fold title={t.reports.lpReverse} hint={t.reports.lpHintReverse}>
        <Toggle label={t.reports.lpEnabled} on={plan.reverseMortgage.enabled} onChange={(on) => patch({ reverseMortgage: { ...plan.reverseMortgage, enabled: on } })} />
        <ConfigNullNum label={t.reports.lpReverseAge} value={plan.reverseMortgage.startAge} onCommit={(n) => patch({ reverseMortgage: { ...plan.reverseMortgage, startAge: n } })} />
        <ConfigNullNum label={t.reports.lpReversePay} value={plan.reverseMortgage.monthlyPayout} money onCommit={(n) => patch({ reverseMortgage: { ...plan.reverseMortgage, monthlyPayout: n } })} />
      </Fold>
    </div>
  );
}

function JobFolds({
  plan,
  patch,
  t,
}: {
  plan: RetirementLifePlan;
  patch: (p: Partial<RetirementLifePlan>) => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <>
      <Fold title={t.reports.lpCurrentJob} open>
        <p className="px-4 pb-2 text-[11px] leading-4 text-muted">{t.reports.lpJobEndBlank}</p>
        <Toggle label={t.reports.lpEnabled} on={plan.currentJob.enabled} onChange={(on) => patch({ currentJob: { ...plan.currentJob, enabled: on } })} />
      </Fold>
      <Fold title={t.reports.lpLowerJob} open>
        <Toggle label={t.reports.lpEnabled} on={plan.lowerStressJob.enabled} onChange={(on) => patch({ lowerStressJob: { ...plan.lowerStressJob, enabled: on } })} />
        <DateRow label={t.reports.lpLowerStart} value={plan.lowerStressJob.startDate} onChange={(v) => patch({ lowerStressJob: { ...plan.lowerStressJob, startDate: v } })} />
        <DateRow label={t.reports.lpLowerEnd} value={plan.lowerStressJob.endDate} onChange={(v) => patch({ lowerStressJob: { ...plan.lowerStressJob, endDate: v } })} />
        <ConfigNullNum label={t.reports.lpGross} value={plan.lowerStressJob.grossMonthlyIncome} money onCommit={(n) => patch({ lowerStressJob: { ...plan.lowerStressJob, grossMonthlyIncome: n } })} />
        <ConfigNullNum label={t.reports.lpNetOverride} value={plan.lowerStressJob.estimatedNetMonthlyIncomeOverride} money onCommit={(n) => patch({ lowerStressJob: { ...plan.lowerStressJob, estimatedNetMonthlyIncomeOverride: n } })} />
        <ConfigNullNum label={t.reports.lpLowerLive} value={plan.lowerStressJob.monthlyLivingCost} money onCommit={(n) => patch({ lowerStressJob: { ...plan.lowerStressJob, monthlyLivingCost: n } })} />
      </Fold>
    </>
  );
}

function isPlaceholderStage(s: LifePlanSpendingStage) {
  return s.id === "stage-1" && !s.label && s.startAge == null && s.endAge == null && s.monthlyLivingCostInTodayMoney == null;
}

function blankStage(): LifePlanSpendingStage {
  return { id: newId(), label: "", startAge: null, endAge: null, monthlyLivingCostInTodayMoney: null, followsInflation: true, isEssential: true, notes: "" };
}

function Fold({ title, hint, children, open = false }: { title: string; hint?: string; children: ReactNode; open?: boolean }) {
  const [on, setOn] = useState(open);
  return (
    <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
      <button type="button" className="tr-press flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left" onClick={() => setOn(!on)}>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          {hint ? <span className="mt-0.5 block text-[11px] font-normal leading-4 text-muted">{hint}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition", on && "rotate-180")} />
      </button>
      <div className={cn("rt-fold border-t border-line", on && "rt-fold-open")}>
        <div className="rt-fold-inner">{children}</div>
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 px-4">
      <span className="text-sm">{label}</span>
      <input type="checkbox" className="size-4" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function DateRow({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 px-4">
      <span className="text-sm">{label}</span>
      <DateField value={value ?? ""} onChange={(next) => onChange(next || null)} className="justify-end" />
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

