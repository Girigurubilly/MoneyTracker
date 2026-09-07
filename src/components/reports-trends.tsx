import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ScreenHeader } from "@/components/shared";
import { compactHkd, money, monthGrid, monthTitle, todayISO, weekdayLabels } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { monthKeysBack, monthLabel } from "@/lib/derived";
import { cashflowSide } from "@/lib/calc/ledger";
import { toHkd } from "@/lib/calc/fx";
import { periodCategoryTotals } from "@/lib/calc/period";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function TrendsPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const firstDay = useUi((s) => s.firstDayOfWeek);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const today = todayISO();
  const [windowN, setWindowN] = useState<3 | 6 | 12>(6);
  const [heatMonth, setHeatMonth] = useState(today.slice(0, 7));
  const months = monthKeysBack(today.slice(0, 7), windowN);
  const series = useMemo(() => {
    const raw = months.map((month) => {
      let spend = 0;
      for (const tx of txs) {
        if (tx.planned || !tx.date.startsWith(month)) continue;
        if (cashflowSide(tx) !== "expense") continue;
        spend += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
      }
      return { month, spend };
    });
    return raw.map((row, i) => {
      const slice = raw.slice(0, i + 1);
      const avg = slice.reduce((s, r) => s + r.spend, 0) / slice.length;
      return { ...row, label: monthLabel(row.month, locale), avg };
    });
  }, [months, txs, rates, locale]);
  const last = series.at(-1)?.spend ?? 0;
  const avg = series.length ? series.reduce((s, r) => s + r.spend, 0) / series.length : 0;
  const firstHalf = series.slice(0, Math.max(1, Math.floor(series.length / 2)));
  const secondHalf = series.slice(Math.floor(series.length / 2));
  const avg1 = firstHalf.reduce((s, r) => s + r.spend, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((s, r) => s + r.spend, 0) / secondHalf.length;
  const growth = avg1 > 0 ? (avg2 - avg1) / avg1 : 0;

  const from = `${months[0]}-01`;
  const to = today;
  const catNow = periodCategoryTotals(txs, cats, rates, from, to, "expense", true);
  const mid = months[Math.floor(months.length / 2)] ?? months[0];
  const catPrev = periodCategoryTotals(txs, cats, rates, from, `${mid}-28`, "expense", true);
  const growthRows = catNow.rows.slice(0, 6).map((r) => {
    const prev = catPrev.rows.find((x) => x.id === r.id)?.value ?? 0;
    const g = prev > 0 ? (r.value - prev) / prev : r.value > 0 ? 1 : 0;
    return { ...r, growth: g };
  });

  const daily = new Map<string, number>();
  let peakDay = "";
  let peakAmt = 0;
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  const weekdayN = [0, 0, 0, 0, 0, 0, 0];
  for (const tx of txs) {
    if (tx.planned || !tx.date.startsWith(heatMonth)) continue;
    if (cashflowSide(tx) !== "expense") continue;
    const amt = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    daily.set(tx.date, (daily.get(tx.date) ?? 0) + amt);
    if ((daily.get(tx.date) ?? 0) > peakAmt) {
      peakAmt = daily.get(tx.date) ?? 0;
      peakDay = tx.date;
    }
    const dow = new Date(`${tx.date}T12:00:00`).getDay();
    weekday[dow] += amt;
    weekdayN[dow] += 1;
  }
  const maxDay = Math.max(1, ...daily.values());
  const cells = monthGrid(`${heatMonth}-01`, firstDay);
  const weekdays = weekdayLabels(locale, firstDay);
  const peakWeek = weekday
    .map((v, i) => ({ i, avg: weekdayN[i] ? v / weekdayN[i] : 0 }))
    .sort((a, b) => b.avg - a.avg)[0];

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.trends} backTo="/reports" />
      <p className="px-5 pb-3 text-xs text-muted">{t.reports.trendsHint}</p>
      <div className="mx-4 grid grid-cols-3 gap-1 rounded-xl bg-elevated p-1">
        {([3, 6, 12] as const).map((n) => (
          <button
            key={n}
            type="button"
            className={cn("h-9 rounded-lg text-sm font-medium", windowN === n ? "bg-background shadow-sm" : "text-muted")}
            onClick={() => setWindowN(n)}
          >
            {n === 3 ? t.reports.roll3 : n === 6 ? t.reports.roll6 : t.reports.roll12}
          </button>
        ))}
      </div>
      <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
        <Mini label={t.reports.avgSpend} value={money(avg, "HKD")} />
        <Mini label={t.reports.lastMonthSpend} value={money(last, "HKD")} />
        <Mini label={t.reports.catGrowth} value={pctSigned(growth)} tone={growth <= 0 ? "income" : "expense"} />
        <Mini label={t.reports.peakDay} value={peakDay ? peakDay.slice(8) : "—"} />
      </div>
      <div className="mt-4 h-52 px-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => compactHkd(Number(v))} width={48} />
            <Tooltip formatter={(v) => money(Number(v), "HKD")} />
            <Area type="monotone" dataKey="spend" name={t.reports.expense} fill="var(--color-expense)" fillOpacity={0.18} stroke="var(--color-expense)" />
            <Line type="monotone" dataKey="avg" name={t.reports.movingAvg} stroke="var(--color-accent)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <h2 className="px-5 pb-1 pt-4 text-sm font-medium text-muted">{t.reports.catGrowth}</h2>
      {growthRows.map((r) => (
        <div key={r.id} className="flex items-center justify-between px-5 py-2 text-sm">
          <span>{pickName(locale, r.name, r.nameZh)}</span>
          <span className={cn("tabular-nums", r.growth <= 0 ? "text-income" : "text-expense")}>{pctSigned(r.growth)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-sm font-medium text-muted">{t.reports.heatmap}</h2>
        <input type="month" value={heatMonth} onChange={(e) => setHeatMonth(e.target.value)} className="h-9 rounded-lg bg-elevated px-2 text-sm" />
      </div>
      <p className="px-5 pb-2 text-xs text-muted">
        {monthTitle(`${heatMonth}-01`, locale)}
        {peakWeek?.avg ? ` · ${t.reports.peakWeekday} ${weekdays[(peakWeek.i - firstDay + 7) % 7]}` : ""}
      </p>
      <div className="mx-4 rounded-xl bg-elevated px-2 py-3">
        <div className="grid grid-cols-7 text-center text-[10px] text-muted">
          {weekdays.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            if (!c) return <div key={`e-${i}`} className="aspect-square" />;
            const amt = daily.get(c.iso) ?? 0;
            const heat = amt / maxDay;
            return (
              <div key={c.iso} className="grid aspect-square place-items-center">
                <span
                  className="grid size-8 place-items-center rounded-md text-[11px] tabular-nums"
                  style={{
                    background: amt ? `color-mix(in srgb, var(--color-expense) ${Math.round(20 + heat * 70)}%, transparent)` : undefined,
                    color: heat > 0.55 ? "var(--color-on-accent, #fff)" : undefined,
                  }}
                >
                  {c.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {peakDay ? (
        <p className="px-5 pt-3 text-xs text-muted">
          {t.reports.peakDay}: {peakDay} · {money(peakAmt, "HKD")}
        </p>
      ) : null}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <div className="rounded-xl bg-elevated px-3 py-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={cn("mt-1 text-sm font-semibold tabular-nums", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{value}</div>
    </div>
  );
}

function pctSigned(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const v = Math.round(n * 100);
  return `${v > 0 ? "+" : ""}${v}%`;
}
