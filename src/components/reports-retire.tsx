import { useMemo, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Hairline, InfoButton, ProgressRing, ScreenHeader, SectionLabel, StatusChip } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { livingEssentials } from "@/lib/calc/budget";
import { monthlyPayment, effectiveRate } from "@/lib/calc/mortgage";
import {
  firePlan,
  retirementSleeves,
  retirementStatus,
  reverseMortgageMonthly,
  runRetirement,
  savingsLast12Months,
  sustainableMonthly,
  ageFromBirthday,
  type RetirementInputs,
} from "@/lib/calc/retirement";
import { monthKey } from "@/lib/calc/ledger";
import type { Allowance } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function RetirementPage() {
  const t = useT();
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const txs = useApp((s) => s.transactions);
  const rec = useApp((s) => s.recurring);
  const ret = useApp((s) => s.retirement);
  const update = useApp((s) => s.updateRetirement);
  const allowances = useApp((s) => s.allowances);
  const oneOffs = useApp((s) => s.oneOffs);
  const mortgage = useApp((s) => s.mortgage);
  const updateAccount = useApp((s) => s.updateAccount);
  const avg = savingsLast12Months(txs, rates, monthKey(todayISO()));
  const born = ret?.birthday;
  const derivedAge = born ? ageFromBirthday(born, todayISO()) : ret?.currentAge ?? 40;
  const base: RetirementInputs = {
    currentAge: derivedAge,
    retireAge: ret?.retireAge ?? 65,
    deathAge: ret?.deathAge ?? 90,
    monthlyIncomeNow: ret?.monthlyIncomeNow || avg.monthlyIncome,
    monthlySpendNow: ret?.monthlySpendNow || avg.monthlySpend,
    targetMonthly: ret?.targetMonthly ?? avg.monthlySpend,
    preReturn: ret?.preReturn ?? 0.05,
    postReturn: ret?.postReturn ?? 0.035,
    inflation: ret?.inflation ?? 0.025,
    travelInRetirement: ret?.travelInRetirement ?? 0,
    reverseMortgageLtv: ret?.reverseMortgageLtv ?? 0.4,
    fireSwr: ret?.fireSwr ?? 0.04,
    birthday: ret?.birthday,
  };
  const pack = retirementSleeves(accounts, rates, 0.02, base.preReturn);
  const yearsRetired = Math.max(1, base.deathAge - base.retireAge);
  const rmMonthly = reverseMortgageMonthly(pack.property, base.reverseMortgageLtv ?? 0, yearsRetired);
  const ctx = {
    investableNow: pack.cash + pack.invest,
    mortgageMonthly: mortgage ? monthlyPayment(mortgage.outstanding, effectiveRate(mortgage), mortgage.remainingMonths) : 0,
    mortgagePayoffAge: base.currentAge + Math.round((mortgage?.remainingMonths ?? 0) / 12),
    housingAfterPayoff: livingEssentials(rec.filter((r) => r.living && r.categoryId !== "mortgage-p" && r.categoryId !== "mortgage-i")),
    oneOffs,
    allowances,
    sleeves: pack.sleeves,
    propertyEquity: pack.property,
    reverseMortgageMonthly: rmMonthly,
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
  ]);
  const surplus = sustain - base.targetMonthly;
  const status = retirementStatus(result.depletes, sustain, base.targetMonthly, result.series);
  const [chartPoint, setChartPoint] = useState<{ age: number; corpus: number } | null>(null);

  function persist(patch: Partial<RetirementInputs>) {
    void update({ ...base, ...patch, id: ret?.id ?? "base" });
  }

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.retirement} backTo="/reports" right={<InfoButton k="retirement" />} />
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-accent">{t.reports.fireTitle}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{money(fire.fireNumber, "HKD")}</div>
            <div className="mt-1 text-xs text-muted">{t.reports.fireNumber}</div>
          </div>
          <div className="relative shrink-0">
            <ProgressRing value={fire.progress} size={64} stroke={5} tone={fire.progress >= 1 ? "income" : fire.progress >= 0.6 ? "watch" : "expense"} />
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">
              {Math.round(Math.min(999, fire.progress * 100))}%
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-accent-soft px-3 py-2">
            <div className="text-[11px] text-accent">{t.reports.fireNow}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(fire.current, "HKD")}</div>
          </div>
          <div className="rounded-xl bg-expense-soft px-3 py-2">
            <div className="text-[11px] text-expense">{t.reports.fireGap}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(Math.max(0, fire.fireNumber - fire.current), "HKD")}</div>
          </div>
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.cashAccounts}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(pack.cash, "HKD")}</div>
          </div>
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.investAccounts}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(pack.invest, "HKD")}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>{t.reports.fireAge}: {fire.reachable ? fire.fireAge : "—"}</span>
          <span>{t.reports.fireYears}: {fire.reachable ? fire.years : "—"}</span>
        </div>
        {!fire.reachable ? <p className="mt-2 text-xs text-muted">{t.reports.fireUnreachable}</p> : null}
      </div>

      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-muted">{t.reports.corpusAtRetire}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{money(result.corpusAtRetire, "HKD")}</div>
          </div>
          <StatusChip status={status} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-[11px] text-muted">{t.reports.avgSave12}</div>
            <div className="mt-0.5 font-semibold tabular-nums">{money(avg.monthlySave, "HKD")}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">{t.reports.surplus}</div>
            <div className={cn("mt-0.5 font-semibold tabular-nums", surplus >= 0 ? "text-income" : "text-expense")}>
              {money(surplus, "HKD", { sign: true })}
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>{t.reports.assetsByAge}</SectionLabel>
      <div className="mx-4 mb-1 overflow-hidden rounded-2xl bg-elevated pt-2">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={result.series.map((s) => ({ ...s, fire: fire.fireNumber }))}
              margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
              onMouseMove={(state) => {
                const p = state?.activePayload?.[0]?.payload as { age?: number; corpus?: number } | undefined;
                if (p && typeof p.age === "number") setChartPoint({ age: p.age, corpus: p.corpus ?? 0 });
              }}
              onMouseLeave={() => setChartPoint(null)}
            >
              <XAxis dataKey="age" tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} interval={1} />
              <ReferenceLine y={fire.fireNumber} stroke="var(--color-accent)" strokeDasharray="4 4" />
              {fire.reachable ? <ReferenceLine x={fire.fireAge} stroke="var(--color-income)" strokeDasharray="3 3" /> : null}
              <Tooltip
                cursor={{ stroke: "var(--color-accent)", strokeWidth: 1 }}
                formatter={(value, name) => [
                  money(Number(value) || 0, "HKD"),
                  name === "fire" ? t.reports.fireNumber : t.reports.corpusAtRetire,
                ]}
                labelFormatter={(age) => `${t.reports.atAge} ${age}`}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-elevated)",
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="fire" stroke="transparent" fill="transparent" />
              <Area type="monotone" dataKey="corpus" stroke="var(--color-accent)" fill="var(--color-accent-soft)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="px-4 pb-3 text-center text-xs text-muted">
          {chartPoint
            ? `${t.reports.atAge} ${chartPoint.age} · ${money(chartPoint.corpus, "HKD")}${fire.fireNumber ? ` · FIRE ${money(fire.fireNumber, "HKD")}` : ""}`
            : t.reports.chartTapHint}
        </p>
      </div>

      <SectionLabel>{t.reports.timeline}</SectionLabel>
      <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-sm">{t.reports.birthday}</span>
          <input
            type="date"
            value={base.birthday ?? ""}
            onChange={(e) => {
              const birthday = e.target.value || undefined;
              persist({ birthday, currentAge: birthday ? ageFromBirthday(birthday, todayISO()) : base.currentAge });
            }}
            className="h-10 bg-transparent text-sm text-accent outline-none"
          />
        </div>
        <Hairline />
        <NumRow label={t.reports.currentAge} value={base.currentAge} onCommit={(n) => persist({ currentAge: n, birthday: undefined })} />
        <Hairline />
        <NumRow label={t.reports.retireAge} value={base.retireAge} onCommit={(n) => persist({ retireAge: n })} />
        <Hairline />
        <NumRow label={t.reports.deathAge} value={base.deathAge} onCommit={(n) => persist({ deathAge: n })} />
      </div>

      <SectionLabel>{t.reports.assumptions}</SectionLabel>
      <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
        <NumRow label={t.reports.salaryNow} value={base.monthlyIncomeNow} money onCommit={(n) => persist({ monthlyIncomeNow: n })} />
        <Hairline />
        <NumRow label={t.reports.spendNow} value={base.monthlySpendNow} money onCommit={(n) => persist({ monthlySpendNow: n })} />
        <Hairline />
        <NumRow label={t.reports.spendRetired} value={base.targetMonthly} money onCommit={(n) => persist({ targetMonthly: n })} />
        <Hairline />
        <NumRow label={`${t.reports.preReturn} (%)`} value={+(base.preReturn * 100).toFixed(2)} onCommit={(n) => persist({ preReturn: n / 100 })} />
        <Hairline />
        <NumRow label={`${t.reports.postReturn} (%)`} value={+(base.postReturn * 100).toFixed(2)} onCommit={(n) => persist({ postReturn: n / 100 })} />
        <Hairline />
        <NumRow label={`${t.reports.inflation} (%)`} value={+(base.inflation * 100).toFixed(2)} onCommit={(n) => persist({ inflation: n / 100 })} />
        <Hairline />
        <NumRow label={`${t.reports.fireSwr} (%)`} value={+((base.fireSwr ?? 0.04) * 100).toFixed(2)} onCommit={(n) => persist({ fireSwr: n / 100 })} />
        <Hairline />
        <NumRow label={`${t.reports.reverseLtv} (%)`} value={+((base.reverseMortgageLtv ?? 0) * 100).toFixed(2)} onCommit={(n) => persist({ reverseMortgageLtv: n / 100 })} />
        <Hairline />
        <NumRow label={t.reports.travelRetired} value={base.travelInRetirement} money onCommit={(n) => persist({ travelInRetirement: n })} />
      </div>

      <SectionLabel>{t.reports.propertiesOwned}</SectionLabel>
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="text-xs text-muted">{t.reports.propertyEquity}</div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{money(pack.property, "HKD")}</div>
        <div className="mt-3 text-xs text-muted">{t.reports.reverseMonthly}</div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{money(rmMonthly, "HKD")}</div>
      </div>
      {pack.sleeves.filter((s) => s.kind === "property").length ? (
        <div className="mx-4 mt-3 overflow-hidden rounded-xl bg-elevated">
          {pack.sleeves
            .filter((s) => s.kind === "property")
            .map((s, i) => (
              <div key={s.id}>
                {i > 0 ? <Hairline /> : null}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{s.label}</div>
                    <div className="text-xs tabular-nums text-muted">{money(s.amount, "HKD")}</div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <p className="px-5 pt-2 text-xs text-muted">{t.common.none}</p>
      )}

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
        rows={pack.sleeves.filter((s) => s.kind === "invest")}
        onSave={(id, annualReturn) => {
          const acc = accounts.find((a) => a.id === id);
          if (acc) void updateAccount({ ...acc, expectedReturn: annualReturn });
        }}
        onToggle={(id, included) => {
          const acc = accounts.find((a) => a.id === id);
          if (acc) void updateAccount({ ...acc, retireInclude: included });
        }}
      />

      <AllowanceSection />

      <p className="px-5 py-4 text-xs leading-relaxed text-faint">{t.reports.disclaimer}</p>
    </div>
  );
}

function NumRow({
  label,
  value,
  onCommit,
  money: asMoney,
  blankZero,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  money?: boolean;
  blankZero?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value));
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      onClick={() => {
        setRaw(String(value));
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
            const n = Number(raw);
            if (Number.isFinite(n)) onCommit(n);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-sm tabular-nums text-muted">
          {blankZero && !value ? "—" : asMoney ? money(value, "HKD") : value}
        </span>
      )}
    </button>
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
  return (
    <>
      <SectionLabel>{title}</SectionLabel>
      {rows.length === 0 ? (
        <p className="px-5 pb-2 text-xs text-muted">{t.common.none}</p>
      ) : (
        <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
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
                <NumRow
                  label={`${t.reports.expectedReturn} (%)`}
                  value={+(s.annualReturn * 100).toFixed(2)}
                  onCommit={(n) => onSave(s.id, n / 100)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function kindLabel(kind: Allowance["kind"], t: ReturnType<typeof useT>): string {
  if (kind === "oaa") return t.reports.oaa;
  if (kind === "annuity") return t.reports.annuity;
  return t.reports.addAllowance;
}

function AllowanceSection() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rows = useApp((s) => s.allowances);
  const add = useApp((s) => s.addAllowance);
  const update = useApp((s) => s.updateAllowance);
  const del = useApp((s) => s.deleteAllowance);
  const hasOaa = rows.some((a) => a.kind === "oaa");
  const hasAnnuity = rows.some((a) => a.kind === "annuity");

  function seed(kind: "oaa" | "annuity" | "other") {
    if (kind === "oaa") {
      void add({
        id: newId(),
        label: "Old Age Allowance",
        labelZh: "生果金",
        monthly: 1620,
        startAge: 70,
        kind: "oaa",
        inflationAdjusted: true,
      });
      return;
    }
    if (kind === "annuity") {
      void add({
        id: newId(),
        label: "Annuity",
        labelZh: "年金",
        monthly: 0,
        startAge: 65,
        kind: "annuity",
        inflationAdjusted: false,
      });
      return;
    }
    void add({
      id: newId(),
      label: "Other retirement income",
      labelZh: "其他退休收入",
      monthly: 0,
      startAge: 65,
      kind: "other",
      inflationAdjusted: false,
    });
  }

  return (
    <>
      <SectionLabel>{t.reports.hkIncome}</SectionLabel>
      {rows.length === 0 ? (
        <p className="px-5 pb-2 text-xs text-muted">{t.reports.hkIncome}</p>
      ) : (
        <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
          {rows.map((a, i) => (
            <div key={a.id}>
              {i > 0 ? <Hairline /> : null}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{kindLabel(a.kind, t)}</div>
                    <div className="text-xs text-muted">{pickName(locale, a.label, a.labelZh)}</div>
                  </div>
                  <button type="button" className="h-11 px-2 text-sm text-expense" onClick={() => void del(a.id)}>
                    {t.tx.delete}
                  </button>
                </div>
                <NumRow
                  label={t.reports.allowanceMonthly}
                  value={a.monthly}
                  money
                  onCommit={(n) => void update({ ...a, monthly: n })}
                />
                <NumRow label={t.reports.startAge} value={a.startAge} onCommit={(n) => void update({ ...a, startAge: n })} />
                <NumRow
                  label={t.reports.endAge}
                  value={a.endAge ?? 0}
                  blankZero
                  onCommit={(n) => void update({ ...a, endAge: n > 0 ? n : undefined })}
                />
                <label className="flex items-center gap-2 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={a.inflationAdjusted}
                    onChange={(e) => void update({ ...a, inflationAdjusted: e.target.checked })}
                  />
                  {t.reports.inflationAdj}
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mx-4 mt-3 flex flex-col gap-2">
        {!hasOaa ? (
          <button type="button" className="h-11 rounded-xl bg-elevated text-sm font-medium" onClick={() => seed("oaa")}>
            {t.reports.addOaa}
          </button>
        ) : null}
        {!hasAnnuity ? (
          <button type="button" className="h-11 rounded-xl bg-elevated text-sm font-medium" onClick={() => seed("annuity")}>
            {t.reports.addAnnuity}
          </button>
        ) : null}
        <button type="button" className="h-11 rounded-xl bg-elevated text-sm" onClick={() => seed("other")}>
          {t.reports.addAllowance}
        </button>
      </div>
    </>
  );
}

