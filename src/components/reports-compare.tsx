import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";
import { ScreenHeader } from "@/components/shared";
import { ReportAiButton, ReportAiSheet } from "@/components/report-ai-sheet";
import { renderYearCompareMarkdown } from "@/lib/calc/compare-brief";
import { yearProjectionCompare } from "@/lib/calc/deposits";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { yearCategoryCompare, yearCompareRanges, type PeriodTab, type YearCompareMode } from "@/lib/calc/period";
import { cn } from "@/lib/utils";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function YearComparePage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const plans = useApp((s) => s.yearlyPlans);
  const deposits = useApp((s) => s.deposits);
  const recurring = useApp((s) => s.recurring);
  const adhoc = useApp((s) => s.adhocBudgets);
  const budgets = useApp((s) => s.budgets);
  const today = todayISO();
  const [mode, setMode] = useState<YearCompareMode>("same-stage");
  const [tab, setTab] = useState<PeriodTab>("expense");
  const [merge, setMerge] = useState(true);
  const [zoomId, setZoomId] = useState<string | null>(null);
  const [ai, setAi] = useState(false);
  const projected = mode === "projected-year";
  const monthCap = budgets.find((b) => b.id === MONTH_TOTAL_BUDGET_ID)?.monthly ?? 0;
  const range = yearCompareRanges(today, mode);
  const zoom = zoomId ? cats.find((c) => c.id === zoomId) : undefined;

  const proj = useMemo(
    () =>
      projected
        ? yearProjectionCompare(plans, deposits, rates, txs, cats, recurring, today, monthCap, adhoc)
        : null,
    [projected, plans, deposits, rates, txs, cats, recurring, today, monthCap, adhoc],
  );

  const data = useMemo(
    () =>
      projected
        ? { rows: [], thisTotal: 0, lastTotal: 0 }
        : yearCategoryCompare(txs, cats, rates, today, mode, tab, merge, zoomId ?? undefined),
    [projected, txs, cats, rates, today, mode, tab, merge, zoomId],
  );

  const chart = projected
    ? (proj?.rows ?? []).map((r) => ({
        ...r,
        label: pickName(locale, r.name, r.nameZh),
      }))
    : data.rows.slice(0, 8).map((r) => ({
        ...r,
        label: pickName(locale, r.name, r.nameZh),
      }));

  const thisCol = projected
    ? t.reports.projectedYearCol.replace("{year}", String(proj?.year ?? ""))
    : t.reports.thisYearCol;
  const lastCol = projected
    ? t.reports.lastYearFullCol.replace("{year}", String(proj?.lastYear ?? ""))
    : t.reports.lastYearCol;

  const thisTotal = projected
    ? tab === "income"
      ? (proj?.thisIncome ?? 0)
      : (proj?.thisExpense ?? 0)
    : data.thisTotal;
  const lastTotal = projected
    ? tab === "income"
      ? (proj?.lastIncome ?? 0)
      : (proj?.lastExpense ?? 0)
    : data.lastTotal;

  const markdown = useMemo(() => {
    if (projected && proj) {
      return renderYearCompareMarkdown({
        asOf: today,
        mode: "projected-year",
        kind: tab,
        groupedByParent: false,
        ...range,
        thisTotal,
        lastTotal,
        rows: proj.rows.map((r) => ({
          ...r,
          name: pickName(locale, r.name, r.nameZh),
          nameZh: r.nameZh,
          colorIndex: 0,
        })),
      });
    }
    const label = (name: string, nameZh: string) => pickName(locale, name, nameZh);
    const groups = !zoom && merge
      ? data.rows
          .filter((r) => cats.some((c) => c.parentId === r.id))
          .map((r) => ({
            name: label(r.name, r.nameZh),
            rows: yearCategoryCompare(txs, cats, rates, today, mode, tab, true, r.id).rows.map((row) => ({
              ...row,
              name: label(row.name, row.nameZh),
            })),
          }))
      : [];
    return renderYearCompareMarkdown({
      asOf: today,
      mode,
      kind: tab,
      groupedByParent: merge && !zoom,
      focus: zoom ? label(zoom.name, zoom.nameZh) : undefined,
      ...range,
      thisTotal: data.thisTotal,
      lastTotal: data.lastTotal,
      rows: data.rows.map((r) => ({ ...r, name: label(r.name, r.nameZh) })),
      groups,
    });
  }, [projected, proj, data, cats, txs, rates, today, mode, tab, merge, zoom, locale, range, thisTotal, lastTotal]);

  const tabs: { id: PeriodTab; label: string }[] = [
    { id: "expense", label: t.reports.expense },
    { id: "income", label: t.reports.income },
  ];

  const modes: { id: YearCompareMode; label: string }[] = [
    { id: "same-stage", label: t.reports.compareSameStage },
    { id: "full-last-year", label: t.reports.compareFullLast },
    { id: "projected-year", label: t.reports.compareProjected },
  ];

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.yearCompare} backTo="/reports" />
      <div className="mx-4 grid grid-cols-3 rounded-xl bg-elevated p-1">
        {modes.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              setZoomId(null);
            }}
            className={cn(
              "tr-press min-h-11 rounded-lg px-1 text-xs font-medium leading-4 sm:text-sm",
              mode === id ? "bg-background text-foreground shadow-sm" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="px-5 pt-2 text-xs text-muted">
        {mode === "same-stage"
          ? t.reports.compareHintSame
          : mode === "full-last-year"
            ? t.reports.compareHintFull
            : t.reports.compareHintProjected}
      </p>
      <p className="px-5 pt-1 text-xs text-faint">
        {range.thisFrom} – {range.thisTo} · {range.lastFrom} – {range.lastTo}
      </p>

      {!projected ? (
        <>
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
              onClick={() => {
                setMerge((v) => !v);
                setZoomId(null);
              }}
              className={cn("h-8 rounded-full px-3 text-sm font-medium", merge ? "bg-accent text-on-accent" : "bg-elevated text-muted")}
            >
              {t.reports.mergeParents}
            </button>
          </div>
          {zoom ? (
            <button
              type="button"
              className="mx-4 mt-3 flex h-11 w-[calc(100%-2rem)] items-center justify-between rounded-xl bg-elevated px-4 text-left"
              onClick={() => setZoomId(zoom.parentId ?? null)}
            >
              <span className="min-w-0">
                <span className="block text-[11px] text-muted">{t.reports.compareAll}</span>
                <span className="block truncate text-sm font-medium">{pickName(locale, zoom.name, zoom.nameZh)}</span>
              </span>
              <ChevronRight className="size-4 rotate-180 text-faint" />
            </button>
          ) : null}
        </>
      ) : (
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
      )}

      <div className="mx-4 mt-3 grid grid-cols-2 gap-3 rounded-xl bg-elevated px-4 py-3">
        <div>
          <div className="text-xs text-muted">{thisCol}</div>
          <div className="mt-1 text-base font-semibold tabular-nums">{money(thisTotal, "HKD")}</div>
        </div>
        <div>
          <div className="text-xs text-muted">{lastCol}</div>
          <div className="mt-1 text-base font-semibold tabular-nums">{money(lastTotal, "HKD")}</div>
        </div>
      </div>

      {projected && proj ? (
        <div className="mx-4 mt-3 grid grid-cols-3 gap-2 rounded-xl bg-elevated px-3 py-3 text-center">
          <div>
            <div className="text-[11px] text-muted">{t.reports.yearlyEarn}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-income">{money(proj.thisIncome, "HKD")}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">{t.reports.yearlyExpense}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-expense">{money(proj.thisExpense, "HKD")}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">{t.reports.yearlySaving}</div>
            <div
              className={cn(
                "mt-0.5 text-sm font-semibold tabular-nums",
                proj.thisSaving >= 0 ? "text-income" : "text-expense",
              )}
            >
              {money(proj.thisSaving, "HKD")}
            </div>
          </div>
        </div>
      ) : null}

      <ReportAiButton onClick={() => setAi(true)} />
      {ai ? (
        <ReportAiSheet
          title={t.reports.exportBrief}
          hint={t.reports.compareAiHint}
          filename={`hk-life-compare-${today}.md`}
          markdown={markdown}
          onClose={() => setAi(false)}
        />
      ) : null}

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
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="thisYear" name={thisCol} fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lastYear" name={lastCol} fill="var(--color-muted)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-muted">{t.reports.noTransactions}</p>
      )}

      <p className="px-5 pt-1 text-[11px] leading-4 text-faint">{t.reports.comparePctDashHint}</p>
      <div className="px-5 pt-2">
        {(projected ? (proj?.rows ?? []) : data.rows).map((r) => {
          const tone = r.delta > 0 ? "text-expense" : r.delta < 0 ? "text-income" : "text-muted";
          const pct =
            r.pct == null ? (r.thisYear > 0 ? "—" : "0%") : `${r.pct >= 0 ? "+" : ""}${Math.round(r.pct * 100)}%`;
          const kids = !projected && cats.some((c) => c.parentId === r.id);
          const open = Boolean(kids);
          const name = "nameZh" in r ? pickName(locale, r.name, r.nameZh) : r.name;
          return (
            <button
              key={r.id}
              type="button"
              disabled={!open}
              onClick={() => open && setZoomId(r.id)}
              className="block w-full border-t border-line py-3 text-left first:border-0 disabled:cursor-default"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm">{name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className={cn("text-sm font-medium tabular-nums", tone)}>
                    {money(r.delta, "HKD", { sign: true })} · {pct}
                  </span>
                  {open ? <ChevronRight className="size-4 text-faint" /> : null}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs tabular-nums text-muted">
                <span>
                  {thisCol} {money(r.thisYear, "HKD")}
                </span>
                <span>
                  {lastCol} {money(r.lastYear, "HKD")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
