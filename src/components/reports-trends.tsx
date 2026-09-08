import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Overlay, ScreenHeader } from "@/components/shared";
import { compactHkd, money, monthGrid, monthTitle, todayISO, weekdayLabels } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { monthKeysBack, monthLabel } from "@/lib/derived";
import { cashflowSide } from "@/lib/calc/ledger";
import { toHkd } from "@/lib/calc/fx";
import { taxCategoryIds } from "@/lib/categories";
import { periodCategoryTotals } from "@/lib/calc/period";
import { cn } from "@/lib/utils";
import type { Category, FxRate, Locale, Transaction } from "@/lib/types";
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
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [skipTax, setSkipTax] = useState(true);
  const taxIds = useMemo(() => taxCategoryIds(cats), [cats]);
  const scopedTxs = useMemo(
    () => (skipTax ? txs.filter((tx) => !tx.categoryId || !taxIds.has(tx.categoryId)) : txs),
    [txs, skipTax, taxIds],
  );
  const months = monthKeysBack(today.slice(0, 7), windowN);
  const series = useMemo(() => {
    const raw = months.map((month) => {
      let spend = 0;
      for (const tx of scopedTxs) {
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
  }, [months, scopedTxs, rates, locale]);
  const last = series.at(-1)?.spend ?? 0;
  const avg = series.length ? series.reduce((s, r) => s + r.spend, 0) / series.length : 0;
  const firstHalf = series.slice(0, Math.max(1, Math.floor(series.length / 2)));
  const secondHalf = series.slice(Math.floor(series.length / 2));
  const avg1 = firstHalf.reduce((s, r) => s + r.spend, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((s, r) => s + r.spend, 0) / secondHalf.length;
  const growth = avg1 > 0 ? (avg2 - avg1) / avg1 : 0;

  const from = `${months[0]}-01`;
  const to = today;
  const catNow = periodCategoryTotals(scopedTxs, cats, rates, from, to, "expense", true);
  const mid = months[Math.floor(months.length / 2)] ?? months[0];
  const catPrev = periodCategoryTotals(scopedTxs, cats, rates, from, `${mid}-28`, "expense", true);
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
  for (const tx of scopedTxs) {
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
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.reports.trendsHint}</p>
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
      <p className="px-5 pt-2 text-[11px] leading-4 text-muted">{t.reports.trendsWindowHint}</p>
      <button
        type="button"
        className={cn("mx-5 mt-3 h-8 rounded-full px-3 text-sm font-medium", skipTax ? "bg-accent text-on-accent" : "bg-elevated text-muted")}
        onClick={() => setSkipTax((v) => !v)}
      >
        {t.reports.excludeTax}
      </button>
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
      <p className="px-5 pb-2 text-[11px] leading-4 text-muted">{t.reports.trendsGrowthHint}</p>
      {growthRows.map((r) => (
        <div key={r.id} className="flex items-center justify-between px-5 py-2 text-sm">
          <span>{pickName(locale, r.name, r.nameZh)}</span>
          <span className={cn("tabular-nums", r.growth <= 0 ? "text-income" : "text-expense")}>{pctSigned(r.growth)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-sm font-medium text-muted">{t.reports.heatmap}</h2>
        <div className="flex items-center gap-1">
          <button type="button" className="grid size-9 place-items-center text-accent" onClick={() => setHeatMonth(shiftMonth(heatMonth, -1))} aria-label="prev">
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-[6.5rem] text-center text-sm tabular-nums">{heatMonth}</span>
          <button type="button" className="grid size-9 place-items-center text-accent" onClick={() => setHeatMonth(shiftMonth(heatMonth, 1))} aria-label="next">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <p className="px-5 pb-2 text-[11px] leading-4 text-muted">{t.reports.trendsHeatHint}</p>
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
              <button key={c.iso} type="button" className="grid aspect-square place-items-center" onClick={() => setOpenDay(c.iso)}>
                <span
                  className="grid size-8 place-items-center rounded-md text-[11px] tabular-nums"
                  style={{
                    background: amt ? `color-mix(in srgb, var(--color-expense) ${Math.round(20 + heat * 70)}%, transparent)` : undefined,
                    color: heat > 0.55 ? "var(--color-on-accent, #fff)" : undefined,
                  }}
                >
                  {c.day}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {peakDay ? (
        <p className="px-5 pt-3 text-xs text-muted">
          {t.reports.peakDay}: {peakDay} · {money(peakAmt, "HKD")}
        </p>
      ) : null}
      {openDay ? (
        <Overlay open onClose={() => setOpenDay(null)} title={`${t.reports.tripDaySpend} · ${openDay}`}>
          <DaySpendList date={openDay} txs={scopedTxs} cats={cats} rates={rates} locale={locale} />
        </Overlay>
      ) : null}
    </div>
  );
}

function DaySpendList({
  date,
  txs,
  cats,
  rates,
  locale,
}: {
  date: string;
  txs: Transaction[];
  cats: Category[];
  rates: FxRate[];
  locale: Locale;
}) {
  const sums = new Map<string, number>();
  let total = 0;
  for (const tx of txs) {
    if (tx.planned || tx.date !== date || cashflowSide(tx) !== "expense") continue;
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    const id = tx.categoryId ?? "uncat";
    sums.set(id, (sums.get(id) ?? 0) + hkd);
    total += hkd;
  }
  const rows = [...sums.entries()]
    .map(([id, value]) => {
      const cat = cats.find((c) => c.id === id);
      return { id, value, name: cat ? pickName(locale, cat.name, cat.nameZh) : id };
    })
    .sort((a, b) => b.value - a.value);
  return (
    <div className="px-5 pb-8">
      <div className="mb-3 text-2xl font-semibold tabular-nums">{money(total, "HKD")}</div>
      {rows.length === 0 ? <p className="text-sm text-muted">—</p> : null}
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between py-2 text-sm">
          <span className="truncate pr-3">{r.name}</span>
          <span className="tabular-nums text-muted">
            {money(r.value, "HKD")}
            <span className="ml-2 text-xs text-faint">{total ? `${Math.round((r.value / total) * 100)}%` : ""}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function shiftMonth(ym: string, dir: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
