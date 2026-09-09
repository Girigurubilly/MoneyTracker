import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ScreenHeader } from "@/components/shared";
import { compactHkd, money, shortDate, todayISO } from "@/lib/format";
import { monthLabel } from "@/lib/derived";
import { periodNetWorthPoints } from "@/lib/calc/networth";
import { periodRange, type PeriodPreset } from "@/lib/calc/period";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function WorthTrendPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const today = todayISO();
  const [preset, setPreset] = useState<PeriodPreset>("this-year");
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [customTo, setCustomTo] = useState(today);
  const range = periodRange(preset, today, customFrom, customTo);
  const from = preset === "custom" ? customFrom : range.from;
  const to = preset === "custom" ? customTo : range.to;
  const points = useMemo(() => periodNetWorthPoints(accounts, txs, rates, from, to), [accounts, txs, rates, from, to]);
  const daily = (Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000 <= 62;
  const series = points.map((p) => ({
    ...p,
    label: daily ? p.date.slice(8) : monthLabel(p.date.slice(0, 7), locale),
  }));
  const first = series[0];
  const last = series.at(-1);
  const delta = first && last ? last.net - first.net : 0;
  const presets: { id: PeriodPreset; label: string }[] = [
    { id: "this-month", label: t.reports.thisMonth },
    { id: "last-month", label: t.reports.lastMonth },
    { id: "this-year", label: t.reports.thisYear },
    { id: "last-year", label: t.reports.lastYear },
    { id: "all", label: t.reports.all },
    { id: "custom", label: t.reports.custom },
  ];

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.worthTrend} backTo="/reports" />
      <div className="mx-4 grid grid-cols-2 overflow-hidden rounded-xl bg-elevated">
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
            className={cn("h-8 rounded-full px-3 text-sm", preset === p.id ? "bg-accent text-on-accent" : "bg-elevated text-foreground")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
        <Stat label={t.assets.netWorth} value={money(last?.net ?? 0, "HKD")} />
        <Stat label={t.reports.worthChange} value={money(delta, "HKD", { sign: true })} tone={delta >= 0 ? "income" : "expense"} />
        <Stat label={t.assets.totalAssets} value={money(last?.assets ?? 0, "HKD")} />
        <Stat label={t.assets.totalLiab} value={money(last?.liab ?? 0, "HKD")} />
      </div>
      <div className="mt-4 h-56 px-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => compactHkd(Number(v))} width={52} />
            <Tooltip
              formatter={(v, name) => [money(Number(v), "HKD"), name === "net" ? t.assets.netWorth : name === "assets" ? t.assets.totalAssets : t.assets.totalLiab]}
              labelFormatter={(_, payload) => (payload?.[0]?.payload?.date as string) ?? ""}
            />
            <Area type="monotone" dataKey="net" name={t.assets.netWorth} fill="var(--color-accent)" fillOpacity={0.16} stroke="var(--color-accent)" strokeWidth={2} />
            <Line type="monotone" dataKey="assets" name={t.assets.totalAssets} stroke="var(--color-income)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="liab" name={t.assets.totalLiab} stroke="var(--color-expense)" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="px-5 pt-2 text-[11px] leading-4 text-muted">{t.reports.worthTrendHint}</p>
      <div className="mt-2">
        {series.slice().reverse().slice(0, 14).map((p) => (
          <div key={p.date} className="flex items-center justify-between px-5 py-2 text-sm">
            <span className="text-muted">{shortDate(p.date, locale)}</span>
            <span className="tabular-nums">{money(p.net, "HKD")}</span>
          </div>
        ))}
      </div>
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
