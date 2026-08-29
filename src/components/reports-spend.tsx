import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ChevronRight } from "lucide-react";
import { Hairline, Overlay, ScreenHeader, SectionLabel, TransactionRow } from "@/components/shared";
import { money, shortDate, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { periodCategoryTotals, periodCategoryTxs, periodRange, type PeriodPreset, type PeriodTab } from "@/lib/calc/period";
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
  const [openId, setOpenId] = useState<string | null>(null);
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
  const openRow = totals.rows.find((r) => r.id === openId) ?? null;

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
              onClick={(_, index) => {
                const row = totals.rows[index];
                if (row) setOpenId(row.id);
              }}
            >
              {(totals.rows.length ? totals.rows : [{ id: "empty", colorIndex: 0 }]).map((r) => (
                <Cell
                  key={r.id}
                  fill={CHART[r.colorIndex]}
                  className={r.id === "empty" ? undefined : "cursor-pointer outline-none"}
                  onClick={() => {
                    if (r.id !== "empty") setOpenId(r.id);
                  }}
                />
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
          <button
            key={r.id}
            type="button"
            onClick={() => setOpenId(r.id)}
            className="flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART[r.colorIndex] }} />
              <span className="truncate text-sm">{pickName(locale, r.name, r.nameZh)}</span>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              <span className="text-sm tabular-nums text-muted">{money(r.value, "HKD")}</span>
              <ChevronRight className="size-4 text-faint" />
            </span>
          </button>
        ))}
        {totals.rows.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t.common.none}</p> : null}
      </div>
      {openRow ? (
        <CategoryTxList
          row={openRow}
          from={from}
          to={to}
          tab={tab}
          merge={merge}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

function CategoryTxList({
  row,
  from,
  to,
  tab,
  merge,
  onClose,
}: {
  row: { id: string; name: string; nameZh: string; value: number };
  from: string;
  to: string;
  tab: PeriodTab;
  merge: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setTx = useUi((s) => s.setTxDetailId);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rows = useMemo(
    () => periodCategoryTxs(txs, cats, from, to, tab, merge, row.id),
    [txs, cats, from, to, tab, merge, row.id],
  );
  return (
    <Overlay open onClose={onClose} variant="page">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.common.back}
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{pickName(locale, row.name, row.nameZh)}</h1>
        <span className="min-w-11" />
      </header>
      <div className="mx-4 mb-4 mt-2 rounded-xl bg-elevated px-4 py-4">
        <div className="text-xs text-muted">
          {shortDate(from, locale)} – {shortDate(to, locale)}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(row.value, "HKD")}</div>
      </div>
      <SectionLabel>{t.reports.transactions}</SectionLabel>
      <Hairline />
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">{t.reports.noTransactions}</p>
      ) : (
        rows.map((tx, i) => (
          <div key={tx.id}>
            {i > 0 ? <Hairline /> : null}
            <TransactionRow tx={tx} showDate onClick={() => setTx(tx.id)} />
          </div>
        ))
      )}
    </Overlay>
  );
}
