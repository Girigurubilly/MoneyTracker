import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ScreenHeader } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { yearCategoryCompare, yearCompareRanges, type PeriodTab } from "@/lib/calc/period";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function YearComparePage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const today = todayISO();
  const [mode, setMode] = useState<"same-stage" | "full-last-year">("same-stage");
  const [tab, setTab] = useState<PeriodTab>("expense");
  const [merge, setMerge] = useState(true);
  const range = yearCompareRanges(today, mode);
  const data = useMemo(
    () => yearCategoryCompare(txs, cats, rates, today, mode, tab, merge),
    [txs, cats, rates, today, mode, tab, merge],
  );
  const chart = data.rows.slice(0, 8).map((r) => ({
    ...r,
    label: pickName(locale, r.name, r.nameZh),
  }));
  const tabs: { id: PeriodTab; label: string }[] = [
    { id: "expense", label: t.reports.expense },
    { id: "income", label: t.reports.income },
  ];

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.yearCompare} backTo="/reports" />
      <div className="mx-4 grid grid-cols-2 rounded-xl bg-elevated p-1">
        {(
          [
            ["same-stage", t.reports.compareSameStage],
            ["full-last-year", t.reports.compareFullLast],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn("h-9 rounded-lg text-sm font-medium", mode === id ? "bg-background text-foreground shadow-sm" : "text-muted")}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="px-5 pt-2 text-xs text-muted">{mode === "same-stage" ? t.reports.compareHintSame : t.reports.compareHintFull}</p>
      <p className="px-5 pt-1 text-xs text-faint">
        {range.thisFrom} – {range.thisTo} · {range.lastFrom} – {range.lastTo}
      </p>
      <div className="mx-4 mt-3 grid grid-cols-2 rounded-xl bg-elevated p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn("h-9 rounded-lg text-sm font-medium", tab === tb.id ? "bg-background text-foreground shadow-sm" : "text-muted")}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => setMerge((v) => !v)}
          className={cn("h-8 rounded-full px-3 text-sm font-medium", merge ? "bg-accent text-on-accent" : "bg-elevated text-muted")}
        >
          {t.reports.mergeParents}
        </button>
      </div>
      <div className="mx-4 mt-3 grid grid-cols-2 gap-3 rounded-xl bg-elevated px-4 py-3">
        <div>
          <div className="text-xs text-muted">{t.reports.thisYearCol}</div>
          <div className="mt-1 text-base font-semibold tabular-nums">{money(data.thisTotal, "HKD")}</div>
        </div>
        <div>
          <div className="text-xs text-muted">{t.reports.lastYearCol}</div>
          <div className="mt-1 text-base font-semibold tabular-nums">{money(data.lastTotal, "HKD")}</div>
        </div>
      </div>
      {chart.length ? (
        <div className="mt-3 h-64 px-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted)" }} interval={0} angle={-18} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-muted)" }} width={44} />
              <Tooltip
                formatter={(value) => money(Number(value) || 0, "HKD")}
                contentStyle={{ background: "var(--color-elevated)", border: "1px solid var(--color-line)", borderRadius: 12 }}
              />
              <Bar dataKey="thisYear" name={t.reports.thisYearCol} fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lastYear" name={t.reports.lastYearCol} fill="var(--color-muted)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-muted">{t.reports.noTransactions}</p>
      )}
      <div className="px-5 pt-2">
        {data.rows.map((r) => {
          const tone = r.delta > 0 ? "text-expense" : r.delta < 0 ? "text-income" : "text-muted";
          const pct =
            r.pct == null ? (r.thisYear > 0 ? "—" : "0%") : `${r.pct >= 0 ? "+" : ""}${Math.round(r.pct * 100)}%`;
          return (
            <div key={r.id} className="border-t border-line py-3 first:border-0">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm">{pickName(locale, r.name, r.nameZh)}</span>
                <span className={cn("shrink-0 text-sm font-medium tabular-nums", tone)}>
                  {money(r.delta, "HKD", { sign: true })} · {pct}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs tabular-nums text-muted">
                <span>
                  {t.reports.thisYearCol} {money(r.thisYear, "HKD")}
                </span>
                <span>
                  {t.reports.lastYearCol} {money(r.lastYear, "HKD")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
