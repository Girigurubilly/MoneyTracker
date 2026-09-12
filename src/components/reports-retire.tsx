import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Hairline, InfoButton, ProgressRing, ScreenHeader, SectionLabel, StatusChip } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { downloadBlob } from "@/lib/backup";
import { toHkd } from "@/lib/calc/fx";
import { pickName } from "@/lib/i18n";
import { livingEssentials } from "@/lib/calc/budget";
import { monthlyPayment, effectiveRate, remainingFromStart } from "@/lib/calc/mortgage";
import {
  compareRetirementAges,
  firePlan,
  retirementSleeves,
  retirementStatus,
  reverseMortgageMonthly,
  runRetirement,
  savingsLast12Months,
  sustainableMonthly,
  ageFromBirthday,
  type RetirementInputs,
  type RetirementReadinessStatus,
} from "@/lib/calc/retirement";
import { monthKey } from "@/lib/calc/ledger";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function useRetirementModel() {
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const txs = useApp((s) => s.transactions);
  const rec = useApp((s) => s.recurring);
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
    housingAfterPayoff: livingEssentials(rec.filter((r) => r.living && r.categoryId !== "mortgage-p" && r.categoryId !== "mortgage-i")),
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
  return { accounts, holdings, rates, avg, base, ctx, pack, result, sustain, fire, persist, rmMonthly, mortgage, updateAccount: useApp.getState().updateAccount };
}

export function RetirementPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const { accounts, holdings, rates, avg, base, ctx, pack, result, sustain, fire, persist, rmMonthly, mortgage } = useRetirementModel();
  const updateAccount = useApp((s) => s.updateAccount);
  const surplus = sustain - base.targetMonthly;
  const status = retirementStatus(result.depletes, sustain, base.targetMonthly, result.series);
  const [chartPoint, setChartPoint] = useState<{ age: number; corpus: number } | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  function exportBrief() {
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
      "",
      "## FIRE snapshot",
      `- FIRE number (HKD): ${Math.round(fire.fireNumber)}`,
      `- Investable now (HKD): ${Math.round(fire.current)}`,
      `- Property equity (HKD): ${Math.round(fire.property)}`,
      `- Gap (HKD): ${Math.round(Math.max(0, fire.fireNumber - fire.current))}`,
      `- Progress: ${(fire.progress * 100).toFixed(1)}%`,
      `- Earliest FIRE age: ${fire.reachable ? fire.fireAge : "not within horizon"}`,
      `- Corpus at retire age (HKD): ${Math.round(result.corpusAtRetire)}`,
      `- Sustainable monthly (HKD): ${Math.round(sustain)}`,
      `- Status: ${status}`,
      `- Depletes: ${result.depletes ? `yes${result.depletionAge ? ` at ${result.depletionAge}` : ""}` : "no"}`,
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
      ...result.series.map((s) => `${s.age},${Math.round(s.corpus)}`),
      "",
      "Use this brief to comment on FIRE feasibility, concentration risk in holdings, return assumptions, and whether the monthly target is sustainable.",
    ];
    downloadBlob(`hk-life-retirement-${todayISO()}.md`, lines.join("\n"), "text/markdown");
  }

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.reports.retirement}
        backTo="/reports"
        right={
          <div className="flex items-center gap-1">
            <button type="button" className="px-2 text-sm font-medium text-accent" onClick={exportBrief}>
              {t.reports.exportBrief}
            </button>
            <InfoButton k="retirement" />
          </div>
        }
      />
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-accent">{t.reports.fireTitle}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{money(fire.fireNumber, "HKD")}</div>
            <div className="mt-1 text-xs text-muted">
              {t.reports.fireAge}: {fire.reachable ? fire.fireAge : "—"}
              {base.birthday ? ` · ${t.reports.currentAge} ${base.currentAge}` : ""}
            </div>
          </div>
          <div className="relative shrink-0">
            <ProgressRing value={fire.progress} size={64} stroke={5} tone={fire.progress >= 1 ? "income" : fire.progress >= 0.6 ? "watch" : "expense"} />
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">
              {Math.round(Math.min(999, fire.progress * 100))}%
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-accent-soft px-3 py-2">
            <div className="text-[11px] text-accent">{t.reports.fireNow}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(fire.current, "HKD")}</div>
          </div>
          <div className="rounded-xl bg-expense-soft px-3 py-2">
            <div className="text-[11px] text-expense">{t.reports.fireGap}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(Math.max(0, fire.fireNumber - fire.current), "HKD")}</div>
          </div>
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.corpusAtRetire}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(result.corpusAtRetire, "HKD")}</div>
          </div>
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.surplus}</div>
            <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", surplus >= 0 ? "text-income" : "text-expense")}>{money(surplus, "HKD", { sign: true })}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{t.reports.avgSave12}: {money(avg.monthlySave, "HKD")}</span>
          <StatusChip status={status} />
        </div>
        {!fire.reachable ? <p className="mt-2 text-xs text-muted">{t.reports.fireUnreachable}</p> : null}
        {holdings.length ? (
          <p className="mt-2 text-xs text-muted">
            {t.prices.heldCount.replace("{n}", String(holdings.length))} · {money(pack.invest, "HKD")}
          </p>
        ) : null}
      </div>

      <SummaryStrip
        base={base}
        plan={result.plan}
        mortgage={mortgage}
        persist={persist}
      />
      <AgeCompare base={base} ctx={ctx} persist={persist} />
      <AccessCard plan={result.plan} cash={pack.cash} invest={pack.invest} reserve={base.emergencyReserve ?? 0} />
      <HousingCard plan={result.plan} mortgage={mortgage} housing={ctx.housingAfterPayoff} persist={persist} payOff={base.payOffMortgageAtRetire ?? false} />
      <div className="px-4 pb-3 space-y-2">
        <Link to="/reports/retirement/projection" className="flex h-11 items-center justify-center rounded-xl bg-elevated text-sm font-medium">
          {t.reports.annualProjection}
        </Link>
        <Link to="/more/retirement-accounts" className="flex h-11 items-center justify-center rounded-xl bg-elevated text-sm font-medium">
          {t.reports.manageRa}
        </Link>
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

      <button
        type="button"
        className="mx-4 mb-3 flex h-11 items-center justify-center gap-1 rounded-xl bg-elevated text-sm font-medium"
        onClick={() => setShowSetup((v) => !v)}
      >
        {showSetup ? t.reports.hideAssumptions : t.reports.showAssumptions}
        <ChevronDown className={cn("size-4 transition", showSetup && "rotate-180")} />
      </button>

      {showSetup ? (
        <>
      <SectionLabel>{t.reports.timeline}</SectionLabel>
      <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
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
        {base.birthday ? (
          <>
            <Hairline />
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm">{t.reports.currentAge}</span>
              <span className="text-sm tabular-nums text-muted">{base.currentAge}</span>
            </div>
          </>
        ) : (
          <>
            <Hairline />
            <NumRow label={t.reports.currentAge} value={base.currentAge} onCommit={(n) => persist({ currentAge: n })} />
          </>
        )}
        <Hairline />
        <NumRow label={t.reports.retireAge} value={base.retireAge} onCommit={(n) => persist({ retireAge: n })} />
        <Hairline />
        <NumRow label={t.reports.deathAge} value={base.deathAge} onCommit={(n) => persist({ deathAge: n })} />
      </div>

      <SectionLabel>{t.reports.assumptions}</SectionLabel>
      <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
        <NumRow label={t.reports.spendRetired} value={base.targetMonthly} money onCommit={(n) => persist({ targetMonthly: n })} />
        <Hairline />
        <NumRow label={t.reports.travelRetired} value={base.travelInRetirement} money onCommit={(n) => persist({ travelInRetirement: n })} />
        <Hairline />
        <NumRow label={`${t.reports.inflation} (%)`} value={+(base.inflation * 100).toFixed(2)} onCommit={(n) => persist({ inflation: n / 100 })} />
        <Hairline />
        <NumRow label={`${t.reports.fireSwr} (%)`} value={+((base.fireSwr ?? 0.04) * 100).toFixed(2)} onCommit={(n) => persist({ fireSwr: n / 100 })} />
        <Hairline />
        <NumRow label={`${t.reports.reverseLtv} (%)`} value={+((base.reverseMortgageLtv ?? 0) * 100).toFixed(2)} onCommit={(n) => persist({ reverseMortgageLtv: n / 100 })} />
        <Hairline />
        <NumRow label={t.reports.emergencyReserve} value={base.emergencyReserve ?? 0} money onCommit={(n) => persist({ emergencyReserve: n })} />
        <Hairline />
        <NumRow label={t.reports.liquidityFloor} value={base.liquidityFloor ?? 0} money onCommit={(n) => persist({ liquidityFloor: n })} />
        <Hairline />
        <NumRow label={t.reports.desiredBuffer} value={base.desiredEndBuffer ?? 0} money onCommit={(n) => persist({ desiredEndBuffer: n })} />
        <Hairline />
        <NumRow label={t.reports.laterLifeAge} value={base.laterLifeAge ?? 75} onCommit={(n) => persist({ laterLifeAge: n })} />
        <Hairline />
        <label className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm">
          {t.reports.payOffAtRetire}
          <input type="checkbox" checked={!!base.payOffMortgageAtRetire} onChange={(e) => persist({ payOffMortgageAtRetire: e.target.checked })} />
        </label>
      </div>

      <SectionLabel>{t.reports.propertiesOwned}</SectionLabel>
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
    </div>
  );
}

export function RetirementProjectionPage() {
  const t = useT();
  const { result } = useRetirementModel();
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.annualProjection} backTo="/reports/retirement" />
      <YearTable years={result.plan.years} />
    </div>
  );
}

function statusLabel(status: RetirementReadinessStatus, t: ReturnType<typeof useT>) {
  if (status === "funded") return t.reports.funded;
  if (status === "funded_with_low_buffer") return t.reports.fundedLow;
  if (status === "bridge_risk") return t.reports.statusBridge;
  if (status === "shortfall_projected") return t.reports.statusShort;
  return t.reports.statusData;
}

function SummaryStrip({
  base,
  plan,
  mortgage,
  persist,
}: {
  base: RetirementInputs;
  plan: NonNullable<ReturnType<typeof runRetirement>["plan"]>;
  mortgage: ReturnType<typeof useApp.getState>["mortgage"];
  persist: (p: Partial<RetirementInputs>) => void;
}) {
  const t = useT();
  const retireYear = new Date().getFullYear() + Math.max(0, base.retireAge - base.currentAge);
  const left = mortgage ? remainingFromStart(mortgage, todayISO()) : null;
  const mFree = plan.mortgageFreeAge;
  const bridgeTone = plan.status === "bridge_risk" ? t.reports.bridgeRisk : plan.minBridgeAccessible < (base.liquidityFloor || 1) ? t.reports.bridgeLow : t.reports.bridgeHealthy;
  const cards = [
    { id: "age", k: t.reports.retireAgeCard, v: String(base.retireAge), s: `${retireYear} · ${t.reports.compareAges}` },
    { id: "access", k: t.reports.accessibleAtRetire, v: money(plan.corpusAtRetire, "HKD"), s: t.reports.lessReserve },
    { id: "lock", k: t.reports.lockedAtRetire, v: money(plan.lockedAtRetire, "HKD"), s: t.reports.lockedUntil.replace("{age}", String(plan.earliestAccessAge)) },
    { id: "bridge", k: t.reports.earlyBridge, v: `${plan.bridgeYears}y`, s: `${bridgeTone} · ${money(plan.minBridgeAccessible, "HKD")}` },
    { id: "mort", k: t.reports.mortgageStatus, v: mFree && mFree <= base.retireAge ? t.reports.mortgageFree : t.reports.mortgageActive, s: t.reports.mortgageEnds.replace("{age}", String(mFree ?? "—")) },
    { id: "stat", k: t.reports.retireStatus, v: statusLabel(plan.status, t), s: plan.statusWhy },
  ];
  return (
    <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
      {cards.map((c) => (
        <a key={c.id} href={`#retire-${c.id === "age" ? "compare" : c.id === "mort" ? "house" : c.id === "access" || c.id === "lock" ? "access" : c.id === "bridge" ? "compare" : "years"}`} className="rounded-2xl bg-elevated px-3 py-2.5">
          <div className="text-[11px] text-muted">{c.k}</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{c.v}</div>
          <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted">{c.s}</div>
        </a>
      ))}
      <button type="button" className="col-span-2 hidden" onClick={() => persist({ retireAge: base.retireAge })} />
      {left ? <span className="hidden">{left.remainingMonths}</span> : null}
    </div>
  );
}

function AgeCompare({
  base,
  ctx,
  persist,
}: {
  base: RetirementInputs;
  ctx: Parameters<typeof compareRetirementAges>[1];
  persist: (p: Partial<RetirementInputs>) => void;
}) {
  const t = useT();
  const rows = useMemo(() => compareRetirementAges(base, ctx), [base, ctx]);
  return (
    <div id="retire-compare" className="mb-3">
      <SectionLabel>{t.reports.readinessByAge}</SectionLabel>
      <div className="mx-4 overflow-x-auto rounded-2xl bg-elevated">
        <table className="min-w-[36rem] text-left text-xs">
          <thead>
            <tr className="text-muted">
              <th className="px-3 py-2 font-medium">{t.reports.retireAge}</th>
              <th className="px-3 py-2 font-medium">{t.reports.workYears}</th>
              <th className="px-3 py-2 font-medium">{t.reports.accessibleAtRetire}</th>
              <th className="px-3 py-2 font-medium">{t.reports.lockedAtRetire}</th>
              <th className="px-3 py-2 font-medium">{t.reports.bridgeYears}</th>
              <th className="px-3 py-2 font-medium">{t.reports.firstShortfall}</th>
              <th className="px-3 py-2 font-medium">{t.reports.assetsAtEnd}</th>
              <th className="px-3 py-2 font-medium">{t.reports.retireStatus}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.retireAge} className={cn("border-t border-line", r.retireAge === base.retireAge && "bg-accent-soft")}>
                <td className="px-3 py-2">
                  <button type="button" className="font-semibold text-accent" onClick={() => persist({ retireAge: r.retireAge })}>
                    {r.retireAge}
                  </button>
                </td>
                <td className="px-3 py-2 tabular-nums">{r.workYears}</td>
                <td className="px-3 py-2 tabular-nums">{money(r.accessibleAtRetire, "HKD")}</td>
                <td className="px-3 py-2 tabular-nums">{money(r.lockedAtRetire, "HKD")}</td>
                <td className="px-3 py-2 tabular-nums">{r.bridgeYears}</td>
                <td className="px-3 py-2 tabular-nums">{r.firstShortfallAge ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{money(r.endTotal, "HKD")}</td>
                <td className="px-3 py-2">{statusLabel(r.status, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccessCard({
  plan,
  cash,
  invest,
  reserve,
}: {
  plan: NonNullable<ReturnType<typeof runRetirement>["plan"]>;
  cash: number;
  invest: number;
  reserve: number;
}) {
  const t = useT();
  return (
    <div id="retire-access" className="mb-3">
      <SectionLabel>{t.reports.accessibility}</SectionLabel>
      <div className="mx-4 rounded-2xl bg-elevated p-4">
        <div className="text-xs font-medium">{t.reports.accessSpend}</div>
        <RowAmt label={t.reports.cashDeposits} value={cash} />
        <RowAmt label={t.reports.liquidStocks} value={invest} />
        <RowAmt label={t.reports.lessReserve} value={-reserve} />
        <RowAmt label={t.reports.accessibleAtRetire} value={plan.corpusAtRetire} bold />
        <div className="mt-3 text-xs font-medium">{t.reports.lockedLater}</div>
        <RowAmt label={t.reports.lockedUntil.replace("{age}", String(plan.earliestAccessAge))} value={plan.lockedAtRetire} />
        <p className="mt-2 text-[11px] leading-4 text-muted">{plan.statusWhy}</p>
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
  persist,
  payOff,
}: {
  plan: NonNullable<ReturnType<typeof runRetirement>["plan"]>;
  mortgage: ReturnType<typeof useApp.getState>["mortgage"];
  housing: number;
  persist: (p: Partial<RetirementInputs>) => void;
  payOff: boolean;
}) {
  const t = useT();
  const atRetire = plan.years.find((y) => y.age === plan.years.find((x) => x.milestones.some((m) => m.startsWith("Retirement")))?.age) ?? plan.years.find((y) => y.flags.isEarlyRetirement || !y.flags.isPreRetirement);
  const retireRow = plan.years.find((y) => !y.flags.isPreRetirement);
  return (
    <div id="retire-house" className="mb-3">
      <SectionLabel>{t.reports.housingTimeline}</SectionLabel>
      <div className="mx-4 rounded-2xl bg-elevated p-4">
        <RowAmt label={t.reports.mortgageAtRetire} value={retireRow?.openingMortgage ?? 0} />
        <RowAmt label={t.reports.mortgagePayAtRetire} value={(retireRow?.mortgagePayment ?? 0) / 12} />
        <RowAmt label={t.reports.housingAfter} value={housing} />
        <label className="mt-3 flex items-center justify-between text-sm">
          {t.reports.payOffAtRetire}
          <input type="checkbox" checked={payOff} onChange={(e) => persist({ payOffMortgageAtRetire: e.target.checked })} />
        </label>
        <div className="mt-3 space-y-1">
          {plan.years.filter((y) => !y.flags.isPreRetirement).slice(0, 8).map((y) => (
            <div key={y.age} className="flex justify-between text-[11px] text-muted">
              <span>{t.reports.atAge} {y.age}</span>
              <span className="tabular-nums">{money(y.mortgagePayment, "HKD")}</span>
            </div>
          ))}
        </div>
        {mortgage ? <p className="mt-2 text-[11px] text-muted">{mortgage.nameZh || mortgage.name}</p> : null}
        {atRetire ? null : null}
      </div>
    </div>
  );
}

function YearTable({ years }: { years: NonNullable<ReturnType<typeof runRetirement>["plan"]>["years"] }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div id="retire-years" className="mb-3">
      <SectionLabel>{t.reports.annualProjection}</SectionLabel>
      <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
        {years.map((y, i) => (
          <div key={y.age}>
            {i > 0 ? <Hairline /> : null}
            <button type="button" className="flex w-full items-start justify-between gap-2 px-4 py-2.5 text-left" onClick={() => setOpen(open === y.age ? null : y.age)}>
              <div>
                <div className="text-sm font-medium">{y.calendarYear} · {t.reports.atAge} {y.age}</div>
                <div className="text-[11px] text-muted">{y.phaseLabel}</div>
              </div>
              <div className="text-right text-xs tabular-nums">
                <div>{money(y.closingAccessible, "HKD")}</div>
                <div className="text-muted">{money(y.closingLocked, "HKD")}</div>
              </div>
            </button>
            {open === y.age ? (
              <div className="space-y-1 px-4 pb-3 text-[11px] text-muted">
                <RowAmt label={t.reports.openingAcc} value={y.openingAccessible} />
                <RowAmt label={t.reports.openingLock} value={y.openingLocked} />
                <RowAmt label={t.reports.salary} value={y.salary} />
                <RowAmt label="MPF/ORSO" value={y.mpfWithdrawal} />
                <RowAmt label={t.reports.housingAfter} value={y.housingSpend + y.mortgagePayment} />
                <RowAmt label={t.reports.closingAcc} value={y.closingAccessible} />
                <RowAmt label={t.reports.closingLock} value={y.closingLocked} />
                {y.milestones.map((m) => (
                  <p key={m}>{m}</p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
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


