import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Hairline, ScreenHeader, SectionLabel } from "@/components/shared";
import { DateField } from "@/components/txn-composer";
import { LifePlanSetup, LifePlanSpendingStages } from "@/components/life-plan-setup";
import { ConfigFold, ConfigNumRow, Enter } from "@/components/retire-ux";
import { useRetirementHeadline } from "@/components/reports-retire";
import { money, todayISO } from "@/lib/format";
import { inflatedMonthly } from "@/lib/calc/retire-view";
import { ageFromBirthday } from "@/lib/calc/retirement";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT } from "@/store/ui";

export function RetirementSetupPage() {
  const t = useT();
  const head = useRetirementHeadline();
  const { accounts, base, pack, persist, rmMonthly, mortgage, life, mort } = head;
  const updateAccount = useApp((s) => s.updateAccount);
  const yearsToRetire = Math.max(0, base.retireAge - base.currentAge);
  const spendThen = inflatedMonthly(base.targetMonthly, yearsToRetire, base.inflation);
  const monthsLeft = Math.max(1, 12 - Number(todayISO().slice(5, 7)) + 1);
  const lockedNow = (life.inflows.accounts ?? [])
    .filter((a) => a.includeInRetirementProjection && a.status !== "closed")
    .reduce((s, a) => s + (a.currentBalance || 0), 0);

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.settingsTitle} backTo="/reports/retirement" />
      <p className="px-5 pb-1 text-xs leading-5 text-muted">{t.reports.setupStart}</p>
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.reports.assumptionsOne}</p>

      <Enter>
        <section className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
          <div className="px-4 pb-1 pt-3 text-[12px] font-medium text-muted">{t.reports.settingsSpendQ}</div>
          <ConfigNumRow label={t.reports.spendRetired} value={base.targetMonthly} money blankZero onCommit={(n) => persist({ targetMonthly: n })} />
          <p className="px-4 pb-1 text-[11px] leading-4 text-muted">{t.reports.goalsSpendHint}</p>
          <StepPct label={t.reports.inflation} value={base.inflation} onCommit={(n) => persist({ inflation: n })} />
          {base.targetMonthly > 0 ? (
            <p className="px-4 pb-3 text-[11px] leading-4 text-muted">
              {t.reports.spendThenMoney.replace("{amount}", money(spendThen, "HKD"))}
            </p>
          ) : (
            <div className="pb-2" />
          )}
          <Hairline />
          <div className="px-4 pb-1 pt-3 text-[12px] font-medium text-muted">{t.reports.settingsWhenQ}</div>
          <label className="flex min-h-11 items-center justify-between gap-3 px-4">
            <span className="text-sm">{t.reports.birthday}</span>
            <DateField
              value={base.birthday ?? ""}
              onChange={(value) => {
                const birthday = value || undefined;
                persist({ birthday, currentAge: birthday ? ageFromBirthday(birthday, todayISO()) : base.currentAge });
              }}
              className="justify-end"
            />
          </label>
          {!base.birthday ? (
            <p className="px-4 pb-2 text-[11px] leading-4 text-muted">
              {t.reports.birthdayYearEndHint.replace("{n}", String(monthsLeft))}
            </p>
          ) : null}
          {base.birthday ? (
            <div className="flex min-h-11 items-center justify-between px-4">
              <span className="text-sm">{t.reports.currentAge}</span>
              <span className="text-sm tabular-nums text-muted">{base.currentAge}</span>
            </div>
          ) : (
            <ConfigNumRow label={t.reports.currentAge} value={base.currentAge} onCommit={(n) => persist({ currentAge: n })} />
          )}
          <ConfigNumRow label={t.reports.retireAge} value={base.retireAge} onCommit={(n) => persist({ retireAge: n })} />
          <ConfigNumRow label={t.reports.deathAge} value={base.deathAge} onCommit={(n) => persist({ deathAge: n })} />
          <Hairline />
          <div className="px-4 pb-1 pt-3 text-[12px] font-medium text-muted">{t.reports.settingsNowQ}</div>
          <ConfigNumRow
            label={head.incomeSource === "ledger" ? t.reports.salaryTakeHome : t.reports.salaryNow}
            value={base.monthlyIncomeNow}
            money
            blankZero
            onCommit={(n) => persist({ monthlyIncomeNow: n })}
          />
          <p className="px-4 pb-2 text-[11px] leading-4 text-muted">
            {head.incomeSource === "ledger" ? t.reports.salaryTakeHomeHint : t.reports.salaryGrossHint}
          </p>
          <ConfigNumRow
            label={t.reports.spendNow}
            value={base.monthlySpendNow}
            money
            blankZero
            onCommit={(n) => persist({ monthlySpendNow: n })}
          />
          <p className="px-4 pb-2 text-[11px] leading-4 text-muted">{t.reports.spendNowHint}</p>
          {base.monthlyIncomeNow > 0 || base.monthlySpendNow > 0 ? (
            <p className="px-4 pb-3 text-[11px] leading-4 text-muted">
              {t.reports.saveBasis
                .replace("{amount}", money(head.saveMonthly, "HKD"))
                .replace("{basis}", head.saveSource === "manual" ? t.reports.basisManual : t.reports.basisLedger)}
            </p>
          ) : (
            <div className="pb-1" />
          )}
        </section>
      </Enter>

      <Enter delay>
        <LifePlanSpendingStages />
      </Enter>

      <Link
        to="/reports/retirement"
        className="tr-press mx-4 mb-3 flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent"
      >
        {t.reports.answersCta}
      </Link>

      <SectionLabel>{t.reports.setupAssetsTitle}</SectionLabel>
      <ConfigFold title={t.reports.assumptions} defaultOpen>
        <StepPct label={t.reports.preReturn} value={base.preReturn} onCommit={(n) => persist({ preReturn: n })} />
        <Hairline />
        <StepPct label={t.reports.postReturn} value={base.postReturn} onCommit={(n) => persist({ postReturn: n })} />
        <p className="px-4 pb-3 text-[11px] leading-4 text-muted">{t.reports.leaveDefaultsHint}</p>
        <p className="px-4 pb-3 text-[11px] leading-4 text-muted">
          {t.reports.sleeveOfficialRates
            .replace("{pre}", `${(base.preReturn * 100).toFixed(1)}%`)
            .replace("{post}", `${(base.postReturn * 100).toFixed(1)}%`)}
        </p>
        <p className="px-4 pb-3 text-[11px] leading-4 text-muted">{t.reports.sleeveRatesReference}</p>
      </ConfigFold>

      {mort.kind !== "none" ? (
        <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
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
          <p className="px-4 pb-2 text-[11px] leading-4 text-muted">
            {mort.kind === "clears-before"
              ? t.reports.mortgageClears.replace("{amount}", money(mort.owingNow, "HKD"))
              : mort.kind === "assumed-payoff"
                ? t.reports.mortgageAssume.replace("{amount}", money(mort.owingNow, "HKD"))
                : t.reports.mortgageOwing.replace("{amount}", money(mort.owingNow, "HKD"))}
          </p>
          <p className="px-4 pb-3 text-[11px] leading-4 text-muted">{t.reports.mortgageOfficialNote}</p>
        </div>
      ) : null}

      <SleeveCard
        cash={pack.cash}
        invest={pack.invest}
        locked={lockedNow}
        property={pack.property}
        preReturn={base.preReturn}
        postReturn={base.postReturn}
        propertyGrowth={life.resolved.assets.selfOccupiedPropertyGrowthRate}
      />

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

      <Link to="/more/retirement-accounts" className="tr-press mx-4 mb-3 flex min-h-11 items-center rounded-2xl bg-elevated px-4 text-sm">
        {t.reports.manageRa}
      </Link>

      <SectionLabel>{t.reports.setupAdvancedTitle}</SectionLabel>
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

      <ConfigFold title={t.reports.advancedPlan}>
        <LifePlanSetup />
      </ConfigFold>

      <AccessCard access={head.access} />
      <HousingCard plan={head.result.plan} mortgage={mortgage} housing={head.ctx.housingAfterPayoff} story={mort} />

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

function SleeveCard({
  cash,
  invest,
  locked,
  property,
  preReturn,
  postReturn,
  propertyGrowth,
}: {
  cash: number;
  invest: number;
  locked: number;
  property: number;
  preReturn: number;
  postReturn: number;
  propertyGrowth: number | null;
}) {
  const t = useT();
  const rows: { label: string; amount: number; note: string }[] = [
    { label: t.reports.sleeveCash, amount: cash, note: t.reports.sleeveOfficialRates.replace("{pre}", `${(preReturn * 100).toFixed(1)}%`).replace("{post}", `${(postReturn * 100).toFixed(1)}%`) },
    { label: t.reports.sleeveInvest, amount: invest, note: t.reports.sleeveOfficialRates.replace("{pre}", `${(preReturn * 100).toFixed(1)}%`).replace("{post}", `${(postReturn * 100).toFixed(1)}%`) },
    { label: t.reports.sleeveLocked, amount: locked, note: t.reports.sleeveLockedGrowth },
    {
      label: t.reports.sleeveProperty,
      amount: property,
      note:
        propertyGrowth != null
          ? t.reports.sleeveGrowth.replace("{rate}", `${(propertyGrowth * 100).toFixed(1)}%`)
          : t.reports.sleevePropertyGrowthNone,
    },
  ];
  return (
    <div className="mx-4 mb-3 rounded-2xl bg-elevated px-4 py-3">
      {rows.map((r, i) => (
        <div key={r.label} className={i ? "mt-2 border-t border-line pt-2" : undefined}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-muted">{r.label}</span>
            <span className="text-sm font-semibold tabular-nums">{money(r.amount, "HKD")}</span>
          </div>
          {i > 1 ? <p className="mt-0.5 text-[11px] leading-4 text-muted">{r.note}</p> : null}
        </div>
      ))}
      <p className="mt-2 text-[11px] leading-4 text-muted">
        {t.reports.sleeveOfficialRates.replace("{pre}", `${(preReturn * 100).toFixed(1)}%`).replace("{post}", `${(postReturn * 100).toFixed(1)}%`)}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-muted">{t.reports.sleevePropertyNote}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted">{t.reports.sleeveRatesReference}</p>
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
      <div className={cn("rt-fold border-t border-line", on && "rt-fold-open")}>
        <div className="rt-fold-inner">
          {rows.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted">{t.common.none}</p>
          ) : (
            rows.map((s, i) => (
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
            ))
          )}
        </div>
      </div>
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
  plan: ReturnType<typeof useRetirementHeadline>["result"]["plan"];
  mortgage: ReturnType<typeof useRetirementHeadline>["mortgage"];
  housing: number;
  story: ReturnType<typeof useRetirementHeadline>["mort"];
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
