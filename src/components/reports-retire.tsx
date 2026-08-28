import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts";
import { Hairline, InfoButton, ScreenHeader, SectionLabel, StatusChip } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { livingEssentials } from "@/lib/calc/budget";
import { monthlyPayment, effectiveRate } from "@/lib/calc/mortgage";
import { investableNow } from "@/lib/calc/networth";
import { retirementStatus, runRetirement, savingsLast12Months, sustainableMonthly, type RetirementInputs } from "@/lib/calc/retirement";
import { monthKey } from "@/lib/calc/ledger";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT } from "@/store/ui";

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
  const avg = savingsLast12Months(txs, rates, monthKey(todayISO()));
  const base: RetirementInputs = {
    currentAge: ret?.currentAge ?? 40,
    retireAge: ret?.retireAge ?? 65,
    deathAge: ret?.deathAge ?? 90,
    monthlyIncomeNow: ret?.monthlyIncomeNow || avg.monthlyIncome,
    monthlySpendNow: ret?.monthlySpendNow || avg.monthlySpend,
    targetMonthly: ret?.targetMonthly ?? avg.monthlySpend,
    preReturn: ret?.preReturn ?? 0.05,
    postReturn: ret?.postReturn ?? 0.035,
    inflation: ret?.inflation ?? 0.025,
    travelInRetirement: ret?.travelInRetirement ?? 0,
  };
  const ctx = {
    investableNow: investableNow(accounts, rates),
    mortgageMonthly: mortgage ? monthlyPayment(mortgage.outstanding, effectiveRate(mortgage), mortgage.remainingMonths) : 0,
    mortgagePayoffAge: base.currentAge + Math.round((mortgage?.remainingMonths ?? 0) / 12),
    housingAfterPayoff: livingEssentials(rec.filter((r) => r.living && r.categoryId !== "mortgage-p" && r.categoryId !== "mortgage-i")),
    oneOffs,
    allowances,
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
    ctx.housingAfterPayoff,
    oneOffs,
    allowances,
  ]);
  const surplus = sustain - base.targetMonthly;
  const status = retirementStatus(result.depletes, sustain, base.targetMonthly, result.series);

  function persist(patch: Partial<RetirementInputs>) {
    void update({ ...base, ...patch, id: ret?.id ?? "base" });
  }

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.retirement} backTo="/reports" right={<InfoButton k="retirement" />} />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold">{t.reports.result}</h2>
          <StatusChip status={status} />
        </div>
        <div className="mt-4">
          <div className="text-xs text-muted">{t.reports.corpusAtRetire}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{money(result.corpusAtRetire, "HKD")}</div>
        </div>
        <div className="mt-4">
          <div className="text-xs text-muted">{t.reports.avgSave12}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{money(avg.monthlySave, "HKD")}</div>
        </div>
        <div className="mt-4">
          <div className="text-xs text-muted">{t.reports.targetToday}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{money(base.targetMonthly, "HKD")}</div>
        </div>
        <div className="mt-4">
          <div className="text-xs text-muted">{t.reports.surplus}</div>
          <div className={cn("mt-1 text-lg font-semibold tabular-nums", surplus >= 0 ? "text-income" : "text-expense")}>
            {money(surplus, "HKD", { sign: true })}
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">{t.reports.retireHint}</p>
      </div>

      <SectionLabel>{t.reports.assetsByAge}</SectionLabel>
      <div className="h-48 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={result.series} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
            <XAxis dataKey="age" tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} interval={1} />
            <Area type="monotone" dataKey="corpus" stroke="var(--color-accent)" fill="var(--color-accent-soft)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <SectionLabel>{t.reports.timeline}</SectionLabel>
      <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
        <NumRow label={t.reports.currentAge} value={base.currentAge} onCommit={(n) => persist({ currentAge: n })} />
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
        <NumRow label={t.reports.travelRetired} value={base.travelInRetirement} money onCommit={(n) => persist({ travelInRetirement: n })} />
      </div>
      <p className="px-5 py-4 text-xs leading-relaxed text-faint">{t.reports.disclaimer}</p>
    </div>
  );
}

function NumRow({
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
        <span className="text-sm tabular-nums text-muted">{asMoney ? money(value, "HKD") : value}</span>
      )}
    </button>
  );
}

