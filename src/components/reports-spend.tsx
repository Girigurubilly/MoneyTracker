import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ScreenHeader } from "@/components/shared";
import { money, shortDate, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { periodCategoryTotals, periodRange, type PeriodPreset, type PeriodTab } from "@/lib/calc/period";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

const CHART = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];

export function SpendingPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const today = todayISO();
  const [preset, setPreset] = useState<PeriodPreset>("this-year");
  const [tab, setTab] = useState<PeriodTab>("expense");
  const [merge, setMerge] = useState(true);
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [customTo, setCustomTo] = useState(today);
  const range = periodRange(preset, today, customFrom, customTo);
  const from = preset === "custom" ? customFrom : range.from;
  const to = preset === "custom" ? customTo : range.to;
  const totals = useMemo(
    () => periodCategoryTotals(txs, cats, rates, from, to, tab, merge),
    [txs, cats, rates, from, to, tab, merge],
  );
  const center = tab === "income" ? totals.income : totals.expense;
  const centerLabel = tab === "income" ? t.reports.income : t.reports.expense;
  const presets: { id: PeriodPreset; label: string }[] = [
    { id: "this-month", label: t.reports.thisMonth },
    { id: "last-month", label: t.reports.lastMonth },
    { id: "this-year", label: t.reports.thisYear },
    { id: "last-year", label: t.reports.lastYear },
    { id: "all", label: t.reports.all },
    { id: "custom", label: t.reports.custom },
  ];
  const tabs: { id: PeriodTab; label: string }[] = [
    { id: "expense", label: t.reports.expense },
    { id: "income", label: t.reports.income },
    { id: "both", label: t.reports.both },
  ];

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.spending} backTo="/reports" />
      <div className="mx-4 grid grid-cols-2 overflow-hidden rounded-xl bg-elevated">
        <label className="border-r border-line px-4 py-3">
          <div className="text-xs text-muted">{t.reports.start}</div>
          {preset === "custom" ? (
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm outline-none"
            />
          ) : (
            <div className="mt-1 text-sm">{shortDate(from, locale)}</div>
          )}
        </label>
        <label className="px-4 py-3">
          <div className="text-xs text-muted">{t.reports.end}</div>
          {preset === "custom" ? (
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm outline-none"
            />
          ) : (
            <div className="mt-1 text-sm">{shortDate(to, locale)}</div>
          )}
        </label>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={cn(
              "h-8 rounded-full px-3 text-sm",
              preset === p.id ? "bg-accent text-on-accent" : "bg-elevated text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mx-4 mt-3 grid grid-cols-3 rounded-xl bg-elevated p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn(
              "h-9 rounded-lg text-sm font-medium",
              tab === tb.id ? "bg-background text-foreground shadow-sm" : "text-muted",
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => setMerge((v) => !v)}
          className={cn(
            "h-8 rounded-full px-3 text-sm font-medium",
            merge ? "bg-accent text-on-accent" : "bg-elevated text-muted",
          )}
        >
          {t.reports.mergeParents}
        </button>
      </div>
      <div className="relative mx-auto h-56 w-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={totals.rows.length ? totals.rows : [{ id: "empty", value: 1, name: "—" }]}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              stroke="none"
              paddingAngle={totals.rows.length > 1 ? 1.2 : 0}
            >
              {(totals.rows.length ? totals.rows : [{ id: "empty", colorIndex: 0 }]).map((r) => (
                <Cell key={r.id} fill={CHART[r.colorIndex]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-base font-semibold tabular-nums">{money(center, "HKD")}</div>
            <div className="text-xs text-muted">{centerLabel}</div>
          </div>
        </div>
      </div>
      <div className="px-5 pt-2">
        {totals.rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART[r.colorIndex] }} />
              <span className="truncate text-sm">{pickName(locale, r.name, r.nameZh)}</span>
            </div>
            <span className="text-sm tabular-nums text-muted">{money(r.value, "HKD")}</span>
          </div>
        ))}
        {totals.rows.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t.common.none}</p> : null}
      </div>
    </div>
  );
}
