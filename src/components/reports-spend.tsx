import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Overlay, ScreenHeader, TxGroupedList } from "@/components/shared";
import { SpendBriefButton } from "@/components/spend-brief";
import { prefersReducedMotion } from "@/components/retire-ux";
import { money, shortDate, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { periodCategoryTotals, periodCategoryTxs, periodRange, type PeriodPreset, type PeriodTab } from "@/lib/calc/period";
import type { Category } from "@/lib/types";
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

function softPct(share: number, tinyLabel: string): string {
  if (!Number.isFinite(share) || share <= 0) return tinyLabel;
  const rounded = Math.round(share * 100);
  if (rounded < 1) return tinyLabel;
  return `${rounded}%`;
}


export function SpendingPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const today = todayISO();
  const animate = !prefersReducedMotion();
  const [preset, setPreset] = useState<PeriodPreset>("this-month");
  const [tab, setTab] = useState<PeriodTab>("expense");
  const [merge, setMerge] = useState(true);
  const [hideAdhoc, setHideAdhoc] = useState(false);
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [customTo, setCustomTo] = useState(today);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusParent, setFocusParent] = useState<string | null>(null);
  const kid = useUi((s) => s.accessMode) === "kid";
  const range = periodRange(preset, today, customFrom, customTo);
  const from = preset === "custom" ? customFrom : range.from;
  const to = preset === "custom" ? customTo : range.to;
  const totals = useMemo(
    () => periodCategoryTotals(txs, cats, rates, from, to, tab, merge, hideAdhoc),
    [txs, cats, rates, from, to, tab, merge, hideAdhoc],
  );
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
  const childTotals = useMemo(() => {
    if (!focusParent) return null;
    const raw = periodCategoryTotals(txs, cats, rates, from, to, tab, false, hideAdhoc);
    const kidIds = new Set(cats.filter((c) => c.parentId === focusParent).map((c) => c.id));
    let rows = raw.rows.filter((r) => kidIds.has(r.id));
    if (!rows.length) rows = raw.rows.filter((r) => r.id === focusParent);
    return {
      ...raw,
      rows: rows.map((r, i) => ({ ...r, colorIndex: i % 8 })),
    };
  }, [txs, cats, rates, from, to, tab, focusParent, hideAdhoc]);
  const view = childTotals ?? totals;
  const netSave = totals.income - totals.expense;
  const bothPie =
    tab === "both" && !focusParent
      ? netSave >= 0
        ? [
            { id: "spend-slice", name: t.reports.expense, nameZh: t.reports.expense, value: totals.expense, colorIndex: 3 },
            { id: "save-slice", name: t.reports.netSurplus, nameZh: t.reports.netSurplus, value: netSave, colorIndex: 0 },
          ].filter((r) => r.value > 0)
        : [
            { id: "income-slice", name: t.reports.income, nameZh: t.reports.income, value: totals.income, colorIndex: 0 },
            { id: "spend-slice", name: t.reports.expense, nameZh: t.reports.expense, value: totals.expense, colorIndex: 3 },
          ].filter((r) => r.value > 0)
      : null;
  const pieRows = bothPie ?? view.rows;
  const openRow = view.rows.find((r) => r.id === openId) ?? totals.rows.find((r) => r.id === openId) ?? null;
  const focusCat = cats.find((c) => c.id === focusParent);
  const center = focusParent
    ? view.rows.reduce((s, r) => s + r.value, 0)
    : tab === "income"
      ? totals.income
      : tab === "both"
        ? netSave
        : totals.expense;
  const centerLabel = focusCat
    ? pickName(locale, focusCat.name, focusCat.nameZh)
    : tab === "income"
      ? t.reports.income
      : tab === "both"
        ? t.reports.netSurplus
        : t.reports.expense;
  const donut = (pieRows.length ? pieRows : [{ id: "empty", value: 1, name: "—", nameZh: "—", colorIndex: 0 }]).filter(
    (r) => Number(r.value) > 0,
  );
  const slices = donut.length ? donut : [{ id: "empty", value: 1, name: "—", nameZh: "—", colorIndex: 0 }];
  const activeId = openId ?? focusParent ?? null;

  function openBucket(id: string) {
    if (merge && !focusParent) {
      const hasKids = cats.some((c) => c.parentId === id);
      if (hasKids) {
        setFocusParent(id);
        return;
      }
    }
    setOpenId(id);
  }

  return (
    <div className="pb-28">
      <ScreenHeader
        title={focusCat ? pickName(locale, focusCat.name, focusCat.nameZh) : t.reports.spending}
        backTo="/reports"
        onBack={focusParent ? () => setFocusParent(null) : undefined}
        right={
          kid ? undefined : (
            <SpendBriefButton
              className="px-2 text-sm font-medium text-accent"
              from={from}
              to={to}
              preset={preset}
              hideAdhoc={hideAdhoc}
              mergeParents={merge}
            />
          )
        }
      />
      <div className="rt-enter mx-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        <label className="bg-elevated px-4 py-3">
          <div className="text-xs text-muted">{t.reports.start}</div>
          {preset === "custom" ? (
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-medium tabular-nums text-accent outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setCustomFrom(from);
                setCustomTo(to);
                setPreset("custom");
              }}
              className="tr-press mt-1 block w-full text-left text-sm font-medium tabular-nums text-accent underline decoration-accent/30 underline-offset-2"
            >
              {shortDate(from, locale)}
            </button>
          )}
        </label>
        <label className="bg-elevated px-4 py-3">
          <div className="text-xs text-muted">{t.reports.end}</div>
          {preset === "custom" ? (
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-medium tabular-nums text-accent outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setCustomFrom(from);
                setCustomTo(to);
                setPreset("custom");
              }}
              className="tr-press mt-1 block w-full text-left text-sm font-medium tabular-nums text-accent underline decoration-accent/30 underline-offset-2"
            >
              {shortDate(to, locale)}
            </button>
          )}
        </label>
      </div>
      <div className="rt-enter flex flex-wrap gap-2 px-4 pt-3">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={cn(
              "tr-press flex h-11 items-center rounded-full px-3 text-sm transition",
              preset === p.id ? "bg-accent text-on-accent" : "bg-elevated text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="rt-enter mx-4 mt-3 grid grid-cols-3 rounded-xl bg-elevated p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn(
              "tr-press h-9 rounded-lg text-sm font-medium transition",
              tab === tb.id ? "bg-background text-foreground shadow-sm" : "text-muted",
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div className="rt-enter mx-4 mt-3 overflow-hidden rounded-xl bg-elevated">
        <MiniStat label={t.reports.income} value={money(totals.income, "HKD")} tone="income" />
        <MiniStat label={t.reports.expense} value={money(totals.expense, "HKD")} tone="expense" />
        <MiniStat
          label={t.reports.netSurplus}
          value={money(netSave, "HKD", { sign: true })}
          tone={netSave >= 0 ? "income" : "expense"}
        />
      </div>
      <div className="rt-enter flex flex-wrap gap-2 px-4 pt-3">
        <button
          type="button"
          onClick={() => setMerge((v) => !v)}
          className={cn(
            "tr-press h-11 rounded-full px-3 text-sm font-medium transition",
            merge ? "bg-accent text-on-accent" : "bg-elevated text-muted",
          )}
        >
          {t.reports.mergeParents}
        </button>
        {tab === "income" ? null : (
          <button
            type="button"
            onClick={() => setHideAdhoc((v) => !v)}
            className={cn(
              "tr-press h-11 rounded-full px-3 text-sm font-medium transition",
              hideAdhoc ? "bg-accent text-on-accent" : "bg-elevated text-muted",
            )}
          >
            {t.reports.hideAdhoc}
          </button>
        )}
      </div>
      {hideAdhoc || focusParent ? (
        <p className="px-5 pt-2 text-[11px] text-faint">
          {hideAdhoc ? t.reports.spendFilterHideAdhoc : null}
          {hideAdhoc && focusParent ? " · " : null}
          {focusParent && focusCat
            ? t.reports.spendFilterFocus.replace("{name}", pickName(locale, focusCat.name, focusCat.nameZh))
            : null}
        </p>
      ) : null}
      <div className={cn("rt-enter relative mx-auto mt-3 h-56 w-56", animate && "rt-chart-draw")}>
        <SpendDonut
          slices={slices.map((r) => ({
            id: r.id,
            value: Number(r.value) || 0,
            color: r.id === "empty" ? "var(--color-line)" : CHART[r.colorIndex % CHART.length],
          }))}
          activeId={activeId}
          animate={animate}
          onPick={(id) => {
            if (id !== "spend-slice" && id !== "save-slice" && id !== "income-slice" && id !== "empty") openBucket(id);
          }}
        />
        <div className="pointer-events-none absolute inset-[26%] grid place-items-center text-center">
          <div className="max-w-full">
            <div className={cn("text-xs font-semibold leading-tight tabular-nums [overflow-wrap:anywhere]", tab === "both" && netSave < 0 && "text-expense")}>
              {money(center, "HKD")}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">{centerLabel}</div>
          </div>
        </div>
      </div>
      <div className="rt-enter-delay px-5 pt-2">
        {view.rows.map((r) => {
          const cat = cats.find((c) => c.id === r.id);
          const parent = !merge && cat?.parentId ? cats.find((c) => c.id === cat.parentId) : null;
          const label = parent ? `${pickName(locale, parent.name, parent.nameZh)} · ${pickName(locale, r.name, r.nameZh)}` : pickName(locale, r.name, r.nameZh);
          const active = openId === r.id || focusParent === r.id;
          return (
          <button
            key={r.id}
            type="button"
            onClick={() => openBucket(r.id)}
            className={cn(
              "tr-press flex min-h-11 w-full items-center justify-between gap-3 rounded-lg py-2.5 text-left transition",
              active && "bg-accent-soft/60 px-2",
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART[r.colorIndex] }} />
              <span className="truncate text-sm">{label}</span>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              <span className="text-sm tabular-nums text-muted">
                {money(r.value, "HKD")}
                <span className="ml-2 text-xs text-faint">{softPct(r.value / shareBase(r.id, cats, tab, totals, center), t.reports.spendShareTiny)}</span>
              </span>
              <ChevronRight className="size-4 text-faint" />
            </span>
          </button>
          );
        })}
        {view.rows.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t.common.none}</p> : null}
      </div>
      {openRow ? (
        <CategoryTxList
          row={openRow}
          from={from}
          to={to}
          tab={tab}
          merge={Boolean(focusParent) ? false : merge}
          hideAdhoc={hideAdhoc}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-t border-line px-4 py-2.5 first:border-0">
      <div className="shrink-0 text-[11px] text-muted">{label}</div>
      <div className={cn("min-w-0 text-right text-sm font-semibold tabular-nums [overflow-wrap:anywhere]", tone === "income" && "text-income", tone === "expense" && "text-expense")}>
        {value}
      </div>
    </div>
  );
}

function SpendDonut({
  slices,
  onPick,
  activeId,
  animate,
}: {
  slices: { id: string; value: number; color: string }[];
  onPick: (id: string) => void;
  activeId?: string | null;
  animate: boolean;
}) {
  const usable = slices.filter((s) => s.value > 0);
  const total = usable.reduce((s, r) => s + r.value, 0);
  const cx = 100;
  const cy = 100;
  const radius = 78;
  const width = 30;
  if (total <= 0 || usable.length === 0) {
    return (
      <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-line)" strokeWidth={width} />
      </svg>
    );
  }
  if (usable.length === 1) {
    const only = usable[0];
    const thick = activeId === only.id ? width + 4 : width;
    return (
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={only.color}
          strokeWidth={thick}
          opacity={activeId && activeId !== only.id ? 0.45 : 1}
          className={cn(only.id === "empty" ? undefined : "cursor-pointer", animate && "rt-ring")}
          onClick={() => onPick(only.id)}
        />
      </svg>
    );
  }
  let angle = -Math.PI / 2;
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      {usable.map((s) => {
        const sweep = (s.value / total) * Math.PI * 2;
        const start = angle;
        const end = angle + sweep;
        angle = end;
        const large = sweep > Math.PI ? 1 : 0;
        const x1 = cx + radius * Math.cos(start);
        const y1 = cy + radius * Math.sin(start);
        const x2 = cx + radius * Math.cos(end);
        const y2 = cy + radius * Math.sin(end);
        const active = activeId === s.id;
        const dimmed = Boolean(activeId) && !active;
        return (
          <path
            key={s.id}
            d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`}
            fill="none"
            stroke={s.color}
            strokeWidth={active ? width + 4 : width}
            strokeLinejoin="round"
            opacity={dimmed ? 0.45 : 1}
            className={cn("cursor-pointer", animate && "rt-ring")}
            onClick={() => onPick(s.id)}
          />
        );
      })}
    </svg>
  );
}

function shareBase(
  id: string,
  cats: Category[],
  tab: PeriodTab,
  totals: { income: number; expense: number },
  center: number,
): number {
  if (tab !== "both") return center > 0 ? center : 1;
  if (id === "uncat-in" || cats.find((c) => c.id === id)?.kind === "income") return totals.income > 0 ? totals.income : 1;
  return totals.expense > 0 ? totals.expense : 1;
}

function CategoryTxList({
  row,
  from,
  to,
  tab,
  merge,
  hideAdhoc,
  onClose,
}: {
  row: { id: string; name: string; nameZh: string; value: number };
  from: string;
  to: string;
  tab: PeriodTab;
  merge: boolean;
  hideAdhoc: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setTx = useUi((s) => s.setTxDetailId);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rows = useMemo(
    () => periodCategoryTxs(txs, cats, from, to, tab, merge, row.id, hideAdhoc),
    [txs, cats, from, to, tab, merge, row.id, hideAdhoc],
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
      <div className="rt-enter mx-4 mb-4 mt-2 rounded-xl bg-elevated px-4 py-4">
        <div className="text-xs text-muted">
          {shortDate(from, locale)} – {shortDate(to, locale)}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(row.value, "HKD")}</div>
      </div>
      <TxGroupedList txs={rows} onClick={(tx) => setTx(tx.id)} empty={t.reports.noTransactions} />
    </Overlay>
  );
}
