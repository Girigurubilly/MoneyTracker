import { useMemo, useState } from "react";
import { Check, ChevronDown, TriangleAlert, X } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ScreenHeader, SectionLabel } from "@/components/shared";
import { SharedRetirementStrip, useRetirementModel } from "@/components/reports-retire";
import { money, pct, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { monthKey } from "@/lib/calc/ledger";
import {
  fireBuckets,
  fireGates,
  fireInvestable,
  fireSpendLevels,
  fireTargets,
  largestHoldingShare,
  monthlySpendByCategory,
  parentLiability,
  runFireStress,
  simulateFirePath,
  type FireStressId,
} from "@/lib/calc/fire-plan";
import { cn } from "@/lib/utils";
import type { FireSpendKind } from "@/lib/types";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

const KINDS: FireSpendKind[] = ["work", "core", "flex", "irregular"];

export function FirePlanPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const txs = useApp((s) => s.transactions);
  const rec = useApp((s) => s.recurring);
  const rates = useApp((s) => s.fxRates);
  const updateCategory = useApp((s) => s.updateCategory);
  const deposits = useApp((s) => s.deposits);
  const holdings = useApp((s) => s.holdings);
  const retirementAccounts = useApp((s) => s.retirementAccounts);
  const { base, persist, avg, mortgage } = useRetirementModel();
  const currentAge = base.currentAge;
  const retireAge = base.retireAge;
  const deathAge = base.deathAge;
  const preReturn = base.preReturn;
  const postReturn = base.postReturn;
  const inflation = base.inflation;
  const parentMonthly = base.parentSupportMonthly ?? 0;
  const parentYears = base.parentSupportYears;
  const parentMode = base.parentSupportMode === "reserve" ? "reserve" : "include";
  const jobAfter = base.postRetireJobMonthly ?? 0;
  const impliedSave = base.monthlyIncomeNow - base.monthlySpendNow;
  const monthlySave = base.monthlySaveOverride ?? (impliedSave || avg.monthlySave);
  const acceptedFlexCut = Boolean(base.acceptedFlexCut);

  const rows = useMemo(
    () => monthlySpendByCategory(txs, categories, rec, rates, monthKey(todayISO())),
    [txs, categories, rec, rates],
  );
  const levels = fireSpendLevels(rows, parentMonthly, parentMode);
  const targets = fireTargets(levels);
  const investable = fireInvestable(accounts, rates, retirementAccounts);
  const buckets = fireBuckets({
    accounts,
    rates,
    deposits,
    holdings,
    retirementAccounts,
    coreMonthly: levels.core,
    baseMonthly: levels.base,
    today: todayISO(),
  });
  const familyTotal = parentLiability(parentMonthly, parentYears ?? 0);
  const liq = buckets.find((b) => b.id === "liquidity")?.amount ?? 0;

  const pathOpts = {
    currentAge,
    retireAge,
    deathAge,
    investable,
    monthlySave,
    preReturn,
    postReturn,
    inflation,
    postJobMonthly: jobAfter,
  };
  const [stressOn, setStressOn] = useState<FireStressId | null>(null);
  const [showTags, setShowTags] = useState(false);
  const stressPatch =
    stressOn === "bear"
      ? { shockAtRetire: -0.3 }
      : stressOn === "lowReturn"
        ? { postReturn: Math.max(0, postReturn - 0.01) }
        : stressOn === "highInflation"
          ? { inflation: 0.035 }
          : stressOn === "longevity"
            ? { deathAge: Math.max(deathAge, 95) }
            : {};
  const floorPath = simulateFirePath({ ...pathOpts, ...stressPatch, monthlySpend: levels.floor });
  const basePath = simulateFirePath({ ...pathOpts, ...stressPatch, monthlySpend: levels.base });
  const comfortPath = simulateFirePath({ ...pathOpts, ...stressPatch, monthlySpend: levels.comfort });
  const chart = basePath.series.map((s, i) => ({
    age: s.age,
    floor: floorPath.series[i]?.corpus ?? 0,
    base: s.corpus,
    comfort: comfortPath.series[i]?.corpus ?? 0,
  }));
  const stress = runFireStress({ ...pathOpts, monthlySpend: levels.base });
  const conc = largestHoldingShare(holdings, rates, investable);
  const gates = fireGates({
    mortgage,
    currentAge,
    retireAge,
    payOffMortgageAtRetire: Boolean(base.payOffMortgageAtRetire),
    investable,
    baseTarget: targets.base,
    liquidity: liq,
    coreMonthly: levels.core,
    parentMonthly,
    parentYears,
    parentMode,
    parentLiability: familyTotal,
    concentration: conc,
    acceptedFlexCut,
    stress,
  });

  function setKind(id: string, kind: FireSpendKind) {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    void updateCategory({ ...cat, fireSpendKind: kind });
  }

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.firePlan} backTo="/reports/retirement" />
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.reports.firePlanHint}</p>
      <SharedRetirementStrip />

      <SectionLabel>{t.reports.fireSpendEngine}</SectionLabel>
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
        <div className="grid grid-cols-2 gap-2 p-3">
          <MiniStat label={t.reports.fireAfterFloor} value={levels.floor} />
          <MiniStat label={t.reports.fireAfterBase} value={levels.base} accent />
          <MiniStat label={t.reports.fireAfterComfort} value={levels.comfort} />
          <MiniStat label={t.reports.fireKindWork} value={levels.work} muted />
        </div>
        <p className="px-4 pb-2 text-[11px] leading-4 text-muted">
          {t.reports.fireKindWorkHint}
        </p>
        <button type="button" className="flex min-h-11 w-full items-center justify-between px-4 text-sm" onClick={() => setShowTags(!showTags)}>
          {t.reports.fireSpendEngine}
          <ChevronDown className={cn("size-4 text-muted transition", showTags && "rotate-180")} />
        </button>
        {showTags
          ? rows.map((r) => (
          <div key={r.id} className="border-t border-line px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm">{pickName(locale, r.name, r.nameZh)}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{money(r.monthly, "HKD")}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={!categories.some((c) => c.id === r.id)}
                  onClick={() => setKind(r.id, k)}
                  className={cn(
                    "h-8 rounded-full px-2.5 text-[11px] font-medium",
                    r.kind === k ? "bg-accent text-on-accent" : "bg-background text-muted",
                  )}
                >
                  {kindLabel(k, t)}
                </button>
              ))}
            </div>
          </div>
        ))
          : null}
      </div>

      <SectionLabel>{t.reports.fireThree}</SectionLabel>
      <div className="mx-4 mb-3 grid grid-cols-1 gap-2">
        <TargetCard title={t.reports.fireTargetFloor} swr="3.5%" amount={targets.floor} now={investable} t={t} />
        <TargetCard title={t.reports.fireTargetBase} swr="3.5%" amount={targets.base} now={investable} t={t} highlight />
        <TargetCard title={t.reports.fireTargetComfort} swr="3.25%" amount={targets.comfort} now={investable} t={t} />
      </div>

      <SectionLabel>{t.reports.fireBucketsTitle}</SectionLabel>
      <div className="mx-4 mb-3 space-y-2">
        {buckets.map((b) => (
          <div key={b.id} className="rounded-2xl bg-elevated p-4">
            <div className="text-sm font-medium">
              {b.id === "liquidity" ? t.reports.fireBucketLiq : b.id === "stable" ? t.reports.fireBucketStable : t.reports.fireBucketGrowth}
            </div>
            <p className="mt-0.5 text-[11px] leading-4 text-muted">
              {b.id === "liquidity" ? t.reports.fireBucketLiqHint : b.id === "stable" ? t.reports.fireBucketStableHint : t.reports.fireBucketGrowthHint}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label={t.reports.fireNowAmt} value={b.amount} />
              {b.id === "growth" ? (
                <MiniStat label={t.reports.fireTargetAmt} value={0} muted />
              ) : (
                <MiniStat label={t.reports.fireTargetAmt} value={b.target} />
              )}
              {b.id === "growth" ? (
                <div className="rounded-xl bg-background px-3 py-2">
                  <div className="text-[11px] text-muted">—</div>
                  <div className="mt-0.5 text-sm font-semibold">—</div>
                </div>
              ) : (
                <MiniStat label={b.gap > 0 ? t.reports.fireGapAmt : t.reports.fireOverAmt} value={Math.abs(b.gap)} danger={b.gap > 0} />
              )}
            </div>
          </div>
        ))}
      </div>

      <SectionLabel>{t.reports.fireFamily}</SectionLabel>
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <FireNum label={t.reports.fireParentMonthly} value={parentMonthly} money onCommit={(n) => persist({ parentSupportMonthly: n, parentSupportYears: parentYears ?? 0 })} />
        <FireNum label={t.reports.fireParentYears} value={parentYears ?? 0} onCommit={(n) => persist({ parentSupportYears: n, parentSupportMonthly: parentMonthly })} />
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted">{t.reports.fireParentTotal}</span>
          <span className="font-semibold tabular-nums">{money(familyTotal, "HKD")}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={cn("h-11 rounded-xl text-xs font-medium", parentMode === "include" ? "bg-accent text-on-accent" : "bg-background")}
            onClick={() => persist({ parentSupportMode: "include" })}
          >
            {t.reports.fireParentInclude}
          </button>
          <button
            type="button"
            className={cn("h-11 rounded-xl text-xs font-medium", parentMode === "reserve" ? "bg-accent text-on-accent" : "bg-background")}
            onClick={() => persist({ parentSupportMode: "reserve" })}
          >
            {t.reports.fireParentReserve}
          </button>
        </div>
      </div>

      <SectionLabel>{t.reports.fireTimeline}</SectionLabel>
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="grid grid-cols-2 gap-x-3">
          <FireNum label={t.reports.fireSaveNow} value={monthlySave} money onCommit={(n) => persist({ monthlySaveOverride: n })} />
          <FireNum label={t.reports.fireJobAfter} value={jobAfter} money onCommit={(n) => persist({ postRetireJobMonthly: n })} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat label={t.reports.fireCorpusRetire} value={basePath.corpusAtRetire} />
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.fireFirstSwr}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{pct(basePath.firstYearSwr)}</div>
          </div>
          <MiniStat label={t.reports.fireAt80} value={basePath.corpusAt80} />
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.fireDepleteYear}</div>
            <div className={cn("mt-0.5 text-sm font-semibold", basePath.depletes ? "text-expense" : "text-income")}>
              {basePath.depletes ? basePath.depletionAge : t.reports.fireNeverDeplete}
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-xs text-muted">
          <div className="flex justify-between"><span>{t.reports.fireGapFloor}</span><span className="tabular-nums">{money(Math.max(0, targets.floor - investable), "HKD")}</span></div>
          <div className="flex justify-between"><span>{t.reports.fireGapBase}</span><span className="tabular-nums">{money(Math.max(0, targets.base - investable), "HKD")}</span></div>
          <div className="flex justify-between"><span>{t.reports.fireGapComfort}</span><span className="tabular-nums">{money(Math.max(0, targets.comfort - investable), "HKD")}</span></div>
        </div>
        <div className="mt-3 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="age" tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value, name) => [
                  money(Number(value) || 0, "HKD"),
                  name === "floor" ? t.reports.fireTargetFloor : name === "comfort" ? t.reports.fireTargetComfort : t.reports.fireTargetBase,
                ]}
                labelFormatter={(age) => `${t.reports.atAge} ${age}`}
                contentStyle={{ borderRadius: 12, border: "1px solid var(--color-line)", background: "var(--color-elevated)", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="floor" stroke="var(--color-income)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="base" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="comfort" stroke="var(--color-expense)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="pt-1 text-center text-[11px] text-muted">{t.reports.fireChartHint}</p>
      </div>

      <SectionLabel>{t.reports.fireStress}</SectionLabel>
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        {stress.map((s) => {
          const label =
            s.id === "bear" ? t.reports.fireStressBear : s.id === "lowReturn" ? t.reports.fireStressLow : s.id === "highInflation" ? t.reports.fireStressInfl : t.reports.fireStressLong;
          const on = stressOn === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStressOn(on ? null : s.id)}
              className={cn("rounded-2xl p-3 text-left", on ? "bg-accent text-on-accent" : "bg-elevated")}
            >
              <div className="text-xs font-medium">{label}</div>
              <div className={cn("mt-1 text-sm font-semibold", on ? "" : s.depletes ? "text-expense" : "text-income")}>
                {s.depletes ? `${t.reports.fireStressFail} · ${s.depletionAge}` : t.reports.fireStressOk}
              </div>
            </button>
          );
        })}
      </div>

      <SectionLabel>{t.reports.fireGates}</SectionLabel>
      <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
        {gates.map((g, i) => (
          <div key={g.id} className={cn("flex items-start gap-3 px-4 py-3", i > 0 ? "border-t border-line" : "")}>
            <GateIcon status={g.status} />
            <div className="min-w-0 flex-1">
              <div className="text-sm leading-5">{gateLabel(g.id, t)}</div>
              <div className="mt-0.5 text-[11px] text-muted">{g.status === "pass" ? t.reports.fireGatePass : g.status === "fail" ? t.reports.fireGateFail : t.reports.fireGateNeed}</div>
            </div>
          </div>
        ))}
        <label className="flex min-h-11 items-start gap-3 border-t border-line px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 size-4"
            checked={acceptedFlexCut}
            onChange={(e) => persist({ acceptedFlexCut: e.target.checked })}
          />
          <span className="text-sm leading-5">{t.reports.fireAcceptCut}</span>
        </label>
      </div>
    </div>
  );
}

function kindLabel(k: FireSpendKind, t: ReturnType<typeof useT>) {
  if (k === "work") return t.reports.fireKindWork;
  if (k === "core") return t.reports.fireKindCore;
  if (k === "irregular") return t.reports.fireKindIrregular;
  return t.reports.fireKindFlex;
}

function gateLabel(id: string, t: ReturnType<typeof useT>) {
  if (id === "mortgage") return t.reports.fireGateMortgage;
  if (id === "fireNumber") return t.reports.fireGateNumber;
  if (id === "liquidity") return t.reports.fireGateLiq;
  if (id === "parents") return t.reports.fireGateParents;
  if (id === "concentration") return t.reports.fireGateConc;
  if (id === "flexCut") return t.reports.fireGateFlex;
  return t.reports.fireGateStress;
}

function GateIcon({ status }: { status: "pass" | "fail" | "need" }) {
  if (status === "pass") return <Check className="mt-0.5 size-4 shrink-0 text-income" />;
  if (status === "fail") return <X className="mt-0.5 size-4 shrink-0 text-expense" />;
  return <TriangleAlert className="mt-0.5 size-4 shrink-0 text-watch" />;
}

function MiniStat({ label, value, accent, muted, danger }: { label: string; value: number; accent?: boolean; muted?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", accent && "text-accent", muted && "text-muted", danger && "text-expense")}>
        {money(value, "HKD")}
      </div>
    </div>
  );
}

function TargetCard({
  title,
  swr,
  amount,
  now,
  t,
  highlight,
}: {
  title: string;
  swr: string;
  amount: number;
  now: number;
  t: ReturnType<typeof useT>;
  highlight?: boolean;
}) {
  const gap = amount - now;
  return (
    <div className={cn("rounded-2xl p-4", highlight ? "bg-accent-soft" : "bg-elevated")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[11px] text-muted">{t.reports.fireSwrUsed} {swr}</div>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{money(amount, "HKD")}</div>
      <div className={cn("mt-1 text-xs", gap > 0 ? "text-expense" : "text-income")}>
        {gap > 0 ? `${t.reports.fireGapAmt} ${money(gap, "HKD")}` : `${t.reports.fireOverAmt} ${money(-gap, "HKD")}`}
      </div>
    </div>
  );
}

function FireNum({
  label,
  value,
  onCommit,
  money: asMoney,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  money?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value));
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left"
      onClick={() => {
        setRaw(String(value));
        setEditing(true);
      }}
    >
      <span className="min-w-0 truncate text-xs text-muted">{label}</span>
      {editing ? (
        <input
          autoFocus
          inputMode="decimal"
          value={raw}
          className="h-8 w-24 rounded-md bg-background px-2 text-right text-sm tabular-nums outline-none"
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const n = Number(raw);
            if (Number.isFinite(n)) onCommit(n);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-sm font-medium tabular-nums">{asMoney ? money(value, "HKD") : value}</span>
      )}
    </button>
  );
}
