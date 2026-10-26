import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Overlay, ScreenHeader } from "@/components/shared";
import { useRetirementHeadline } from "@/components/reports-retire";
import { prefersReducedMotion } from "@/components/retire-ux";
import { compactHkd, money, shortDate, todayISO } from "@/lib/format";
import { monthLabel } from "@/lib/derived";
import { pickName } from "@/lib/i18n";
import {
  largestWorthMove,
  periodNetWorthPoints,
  periodPostedCashflow,
  worthMoveIsCliff,
  type WorthPoint,
  type WorthPointSource,
} from "@/lib/calc/networth";
import { toHkd } from "@/lib/calc/fx";
import { cashflowSide } from "@/lib/calc/ledger";
import { periodRange, type PeriodPreset } from "@/lib/calc/period";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function WorthTrendPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setTx = useUi((s) => s.setTxDetailId);
  const deposits = useApp((s) => s.deposits);
  const accounts = useApp((s) => s.accounts);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const snapshots = useApp((s) => s.snapshots);
  const flushWorthSnapshots = useApp((s) => s.flushWorthSnapshots);
  const [flushing, setFlushing] = useState(false);
  const today = todayISO();
  const [preset, setPreset] = useState<PeriodPreset>("this-year");
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [customTo, setCustomTo] = useState(today);
  const [sheetIdx, setSheetIdx] = useState<number | null>(null);
  const range = periodRange(preset, today, customFrom, customTo);
  const from = preset === "custom" ? customFrom : range.from;
  const to = preset === "custom" ? customTo : range.to;
  const points = useMemo(
    () => periodNetWorthPoints(accounts, txs, rates, from, to, deposits, snapshots),
    [accounts, txs, rates, from, to, deposits, snapshots],
  );
  const daily = (Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000 <= 62;
  const years = new Set(points.map((p) => p.date.slice(0, 4)));
  const series = points.map((p) => ({
    ...p,
    label: daily ? p.date.slice(5) : years.size > 1 ? `${p.date.slice(2, 4)}/${p.date.slice(5, 7)}` : monthLabel(p.date.slice(0, 7), locale),
  }));
  const first = series[0];
  const last = series.at(-1);
  const nwDelta = first && last ? last.net - first.net : 0;
  const posted = useMemo(() => periodPostedCashflow(txs, rates, from, last?.date ?? to), [txs, rates, from, last?.date, to]);
  const unexplained = Math.round((nwDelta - posted.net) * 100) / 100;
  const showUnexplained = Math.abs(unexplained) >= Math.max(10_000, Math.abs(nwDelta) * 0.05, Math.abs(posted.net) * 0.05);
  const head = useRetirementHeadline();
  const animate = !prefersReducedMotion();
  const cliff = useMemo(() => {
    const move = largestWorthMove(points);
    return worthMoveIsCliff(move, last?.net ?? 0) ? move : null;
  }, [points, last?.net]);
  const yDomain = useMemo(() => {
    if (!series.length) return [0, 1] as [number, number];
    const vals = series.flatMap((p) => [p.net, p.assets, p.liab]);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 1_000);
    const pad = span * 0.12;
    return [lo - pad, hi + pad] as [number, number];
  }, [series]);
  const presets: { id: PeriodPreset; label: string }[] = [
    { id: "this-month", label: t.reports.thisMonth },
    { id: "last-month", label: t.reports.lastMonth },
    { id: "this-year", label: t.reports.thisYear },
    { id: "last-year", label: t.reports.lastYear },
    { id: "all", label: t.reports.all },
    { id: "custom", label: t.reports.custom },
  ];

  function sourceLabel(source: WorthPointSource): string {
    if (source === "snapshot") return t.reports.worthPointSourceSnap;
    if (source === "live") return t.reports.worthPointSourceLive;
    return t.reports.worthPointSourceRebuilt;
  }

  function openPoint(date: string) {
    const idx = series.findIndex((p) => p.date === date);
    if (idx >= 0) setSheetIdx(idx);
  }

  const sheetPoint = sheetIdx != null ? series[sheetIdx] : null;
  const sheetPrev = sheetIdx != null && sheetIdx > 0 ? series[sheetIdx - 1] : null;

  async function flushSnapshots() {
    if (flushing) return;
    if (!window.confirm(t.reports.worthFlushConfirm)) return;
    setFlushing(true);
    try {
      await flushWorthSnapshots();
      toast(t.reports.worthFlushed);
    } finally {
      setFlushing(false);
    }
  }

  return (
    <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <ScreenHeader title={t.reports.worthTrend} backTo="/reports" />
      <div className="rt-enter mx-4 grid grid-cols-2 overflow-hidden rounded-xl bg-elevated">
        <label className="border-r border-line px-4 py-3">
          <div className="text-xs text-muted">{t.reports.start}</div>
          {preset === "custom" ? (
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-1 w-full bg-transparent text-sm outline-none" />
          ) : (
            <div className="mt-1 text-sm">{shortDate(from, locale)}</div>
          )}
        </label>
        <label className="px-4 py-3">
          <div className="text-xs text-muted">{t.reports.end}</div>
          {preset === "custom" ? (
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-1 w-full bg-transparent text-sm outline-none" />
          ) : (
            <div className="mt-1 text-sm">{shortDate(last?.date ?? to, locale)}</div>
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
      <div className="rt-enter mx-4 mt-4 grid grid-cols-2 gap-2">
        <Stat label={t.assets.netWorth} value={money(last?.net ?? 0, "HKD")} />
        <Stat label={t.reports.worthNwChange} value={money(nwDelta, "HKD", { sign: true })} tone={nwDelta >= 0 ? "income" : "expense"} />
        <Stat label={t.reports.worthPostedFlow} value={money(posted.net, "HKD", { sign: true })} tone={posted.net >= 0 ? "income" : "expense"} />
        <Stat label={t.assets.totalAssets} value={money(last?.assets ?? 0, "HKD")} />
        <Stat label={t.assets.totalLiab} value={money(last?.liab ?? 0, "HKD")} />
        {showUnexplained ? (
          <Stat label={t.reports.worthUnexplained} value={money(unexplained, "HKD", { sign: true })} tone={unexplained >= 0 ? "income" : "expense"} />
        ) : null}
      </div>
      {cliff ? (
        <div className="rt-enter mx-4 mt-3 rounded-2xl bg-watch-soft px-4 py-3">
          <div className="text-sm font-medium text-watch">{t.reports.worthCliffTitle}</div>
          <p className="mt-1 text-xs leading-4 text-muted">
            {t.reports.worthCliffBody
              .replace("{from}", shortDate(cliff.from.date, locale))
              .replace("{to}", shortDate(cliff.to.date, locale))
              .replace("{amount}", money(cliff.deltaNet, "HKD", { sign: true }))}
          </p>
          <button
            type="button"
            className="tr-press mt-2 text-sm font-medium text-accent"
            onClick={() => openPoint(cliff.to.date)}
          >
            {t.reports.worthCliffCta}
          </button>
        </div>
      ) : null}
      <Link to="/reports/retirement" className="rt-enter mx-4 mt-3 block rounded-2xl bg-elevated px-4 py-3 text-sm text-muted">
        <div>{t.reports.investableOfWhich.replace("{amount}", money(head.investable, "HKD"))}</div>
        <div className="mt-1 text-[11px] leading-4 text-faint">{t.reports.investableCardNote}</div>
      </Link>
      <div className={cn("rt-enter mt-4 h-56 px-1", animate && "rt-chart-draw")}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={series}
            onClick={(state) => {
              const row = (state as { activePayload?: { payload?: { date?: string } }[] } | null)?.activePayload?.[0]?.payload;
              if (row?.date) openPoint(row.date);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={daily ? "preserveStartEnd" : 0} />
            <YAxis domain={yDomain} tick={{ fontSize: 10 }} tickFormatter={(v) => compactHkd(Number(v))} width={52} />
            <Tooltip
              formatter={(v, name, item) => {
                const key = String((item as { dataKey?: unknown } | undefined)?.dataKey ?? name ?? "");
                const label =
                  key === "net" ? t.assets.netWorth : key === "assets" ? t.assets.totalAssets : key === "liab" ? t.assets.totalLiab : String(name ?? "");
                return [money(Number(v), "HKD"), label];
              }}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as WorthPoint | undefined;
                if (!row) return "";
                return `${row.date} · ${sourceLabel(row.source)}`;
              }}
            />
            <Legend
              verticalAlign="top"
              height={24}
              formatter={(value) => {
                if (value === t.assets.netWorth || value === "net") return t.reports.worthLegendNet;
                if (value === t.assets.totalAssets || value === "assets") return t.reports.worthLegendAssets;
                if (value === t.assets.totalLiab || value === "liab") return t.reports.worthLegendLiab;
                return String(value);
              }}
            />
            <Area
              type="monotone"
              dataKey="net"
              name={t.assets.netWorth}
              fill="var(--color-accent)"
              fillOpacity={0.16}
              stroke="var(--color-accent)"
              strokeWidth={2}
              isAnimationActive={animate}
              animationDuration={500}
              activeDot={{ r: 5 }}
              dot={daily ? false : { r: 2.5, strokeWidth: 0, fill: "var(--color-accent)" }}
            />
            <Line type="monotone" dataKey="assets" name={t.assets.totalAssets} stroke="var(--color-income)" strokeWidth={1.5} dot={false} isAnimationActive={animate} animationDuration={500} />
            <Line type="monotone" dataKey="liab" name={t.assets.totalLiab} stroke="var(--color-expense)" strokeWidth={1.5} dot={false} isAnimationActive={animate} animationDuration={500} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="px-5 pt-2 text-[11px] leading-4 text-muted">{t.reports.worthTrendHint}</p>
      <div className="px-4 pt-3">
        <button
          type="button"
          disabled={flushing}
          className="tr-press flex h-11 w-full items-center justify-center rounded-xl bg-elevated text-sm font-medium text-accent disabled:opacity-40"
          onClick={() => void flushSnapshots()}
        >
          {t.reports.worthFlush}
        </button>
      </div>
      <div className="rt-enter-delay mt-2">
        <div className="flex items-center justify-between px-5 pb-1 text-[11px] text-faint">
          <span />
          <span className="flex gap-3">
            <span>{t.reports.worthFlow}</span>
            <span>{t.assets.netWorth}</span>
          </span>
        </div>
        {series
          .slice()
          .reverse()
          .slice(0, 14)
          .map((p) => (
            <button
              key={p.date}
              type="button"
              className="tr-press flex w-full items-center justify-between px-5 py-2 text-left text-sm"
              onClick={() => openPoint(p.date)}
            >
              <span className="flex min-w-0 items-center gap-2 text-muted">
                <span>{shortDate(p.date, locale)}</span>
                <SourceBadge source={p.source} label={sourceLabel(p.source)} />
              </span>
              <span className="flex items-baseline gap-3 tabular-nums">
                <span className={cn("w-24 text-right text-xs", p.flow > 0 ? "text-income" : p.flow < 0 ? "text-expense" : "text-faint")}>
                  {p.flow ? money(p.flow, "HKD", { sign: true }) : "—"}
                </span>
                <span className="w-28 text-right">{money(p.net, "HKD")}</span>
              </span>
            </button>
          ))}
      </div>

      {sheetPoint ? (
        <WorthPointSheet
          point={sheetPoint}
          prev={sheetPrev}
          sourceLabel={sourceLabel}
          txs={txs}
          rates={rates}
          locale={locale}
          onClose={() => setSheetIdx(null)}
          onOpenTx={(id) => {
            setSheetIdx(null);
            setTx(id);
          }}
        />
      ) : null}
    </div>
  );
}

function SourceBadge({ source, label }: { source: WorthPointSource; label: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        source === "snapshot" && "bg-accent-soft text-accent",
        source === "live" && "bg-success-soft text-income",
        source === "reconstructed" && "bg-elevated text-muted",
      )}
    >
      {label}
    </span>
  );
}

function WorthPointSheet({
  point,
  prev,
  sourceLabel,
  txs,
  rates,
  locale,
  onClose,
  onOpenTx,
}: {
  point: WorthPoint & { label?: string };
  prev: (WorthPoint & { label?: string }) | null | undefined;
  sourceLabel: (s: WorthPointSource) => string;
  txs: ReturnType<typeof useApp.getState>["transactions"];
  rates: ReturnType<typeof useApp.getState>["fxRates"];
  locale: "en" | "zh-HK";
  onClose: () => void;
  onOpenTx: (id: string) => void;
}) {
  const t = useT();
  const windowFrom = prev ? prev.date : point.date;
  const windowTo = point.date;
  const posted = useMemo(() => periodPostedCashflow(txs, rates, addOneDay(windowFrom), windowTo), [txs, rates, windowFrom, windowTo]);
  const deltaNet = prev ? Math.round((point.net - prev.net) * 100) / 100 : 0;
  const deltaAssets = prev ? Math.round((point.assets - prev.assets) * 100) / 100 : 0;
  const deltaLiab = prev ? Math.round((point.liab - prev.liab) * 100) / 100 : 0;
  const unexplained = Math.round((deltaNet - posted.net) * 100) / 100;
  const seam = Boolean(prev && prev.source !== point.source);
  const topTxs = useMemo(() => {
    const rows = txs
      .filter((tx) => !tx.planned && tx.date > windowFrom && tx.date <= windowTo)
      .filter((tx) => cashflowSide(tx) !== "none" || tx.type === "transfer")
      .map((tx) => ({
        tx,
        hkd: Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd)),
        side: cashflowSide(tx),
      }))
      .sort((a, b) => b.hkd - a.hkd)
      .slice(0, 5);
    return rows;
  }, [txs, rates, windowFrom, windowTo]);

  return (
    <Overlay open onClose={onClose} variant="page">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.common.back}
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{t.reports.worthPointDetail}</h1>
        <span className="min-w-11" />
      </header>
      <div className="rt-enter mx-4 mt-2 rounded-xl bg-elevated px-4 py-4">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{shortDate(point.date, locale)}</span>
          <SourceBadge source={point.source} label={sourceLabel(point.source)} />
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(point.net, "HKD")}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-[11px] text-muted">{t.assets.totalAssets}</div>
            <div className="tabular-nums">{money(point.assets, "HKD")}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">{t.assets.totalLiab}</div>
            <div className="tabular-nums">{money(point.liab, "HKD")}</div>
          </div>
        </div>
      </div>
      {seam ? <p className="rt-enter mx-4 mt-3 rounded-xl bg-watch-soft px-3 py-2 text-xs leading-4 text-watch">{t.reports.worthSeamNote}</p> : null}
      {prev ? (
        <div className="rt-enter mx-4 mt-3 rounded-xl bg-elevated px-4 py-3">
          <div className="text-xs font-medium text-muted">{t.reports.worthDeltaVsPrev}</div>
          <div className="mt-2 space-y-1 text-sm tabular-nums">
            <Row label={t.assets.netWorth} value={money(deltaNet, "HKD", { sign: true })} tone={deltaNet} />
            <Row label={t.assets.totalAssets} value={money(deltaAssets, "HKD", { sign: true })} tone={deltaAssets} />
            <Row label={t.assets.totalLiab} value={money(deltaLiab, "HKD", { sign: true })} tone={deltaLiab} />
            <Row label={t.reports.worthPostedFlow} value={money(posted.net, "HKD", { sign: true })} tone={posted.net} />
            <Row label={t.reports.worthUnexplained} value={money(unexplained, "HKD", { sign: true })} tone={unexplained} />
          </div>
        </div>
      ) : null}
      <div className="rt-enter mt-4 px-5">
        <div className="text-xs font-medium text-muted">{t.reports.worthTopTxs}</div>
        {topTxs.length === 0 ? <p className="py-4 text-sm text-muted">{t.common.none}</p> : null}
        {topTxs.map(({ tx, hkd, side }) => (
          <button
            key={tx.id}
            type="button"
            className="tr-press flex w-full items-center justify-between gap-3 border-b border-line py-3 text-left"
            onClick={() => onOpenTx(tx.id)}
          >
            <div className="min-w-0">
              <div className="truncate text-sm">{pickName(locale, tx.payee || tx.note || tx.type, tx.payeeZh || tx.note || "") || shortDate(tx.date, locale)}</div>
              <div className="text-[11px] text-faint">{shortDate(tx.date, locale)}</div>
            </div>
            <span className={cn("shrink-0 text-sm tabular-nums", side === "income" ? "text-income" : side === "expense" ? "text-expense" : "text-muted")}>
              {money(side === "income" ? hkd : side === "expense" ? -hkd : hkd, "HKD", { sign: side !== "none" })}
            </span>
          </button>
        ))}
      </div>
    </Overlay>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={cn(tone > 0 && "text-income", tone < 0 && "text-expense")}>{value}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <div className="rounded-xl bg-elevated px-3 py-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={cn("mt-1 text-sm font-semibold tabular-nums", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{value}</div>
    </div>
  );
}

function addOneDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
