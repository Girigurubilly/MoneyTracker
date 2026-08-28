import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";
import { Group, Hairline, InfoButton, ScreenHeader } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { cashflowSeries, monthKeysBack, monthLabel, monthStats } from "@/lib/derived";
import { livingEssentials, monthCashflowForecast, spentInMonth } from "@/lib/calc/budget";
import { travelSpendYtd, tripProgress, tripCashSpent, isTripActive } from "@/lib/calc/trips";
import { monthlyPayment, remainingInterest, effectiveRate, endMonthFromRemaining } from "@/lib/calc/mortgage";
import { runRetirement, savingsLast12Months } from "@/lib/calc/retirement";
import { netWorthNow } from "@/lib/calc/networth";
import { monthKey } from "@/lib/calc/ledger";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { useState } from "react";

export function ReportsHub() {
  const t = useT();
  const items = [
    { to: "/reports/dashboard", title: t.reports.dashboard },
    { to: "/reports/spending", title: t.reports.spending },
    { to: "/reports/cashflow", title: t.reports.cashflow },
    { to: "/reports/living", title: t.reports.living },
    { to: "/reports/travel", title: t.reports.travel },
    { to: "/reports/retirement", title: t.reports.retirement },
    { to: "/reports/history", title: t.reports.history },
  ] as const;
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.title} large />
      <Group>
        {items.map((it, i) => (
          <div key={it.to}>
            {i > 0 ? <Hairline /> : null}
            <Link to={it.to} className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm">{it.title}</span>
              <ChevronRight className="size-4 text-faint" />
            </Link>
          </div>
        ))}
      </Group>
    </div>
  );
}

export function DashboardPage() {
  const t = useT();
  const txs = useApp((s) => s.transactions);
  const budgets = useApp((s) => s.budgets);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const rec = useApp((s) => s.recurring);
  const adhoc = useApp((s) => s.adhocBudgets);
  const stats = monthStats(txs, budgets, cats, rates, todayISO(), rec, adhoc);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.dashboard} />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="text-sm text-muted">{t.today.expenseMonth}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(stats.flow.expense, "HKD")}</div>
        <div className="mt-3 text-sm text-muted">{t.today.remainingBudget}</div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{money(stats.remainingBudget, "HKD")}</div>
      </div>
    </div>
  );
}

export function SpendingPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const month = monthKey();
  const rows = cats
    .filter((c) => c.kind === "expense")
    .map((c) => ({ id: c.id, name: pickName(locale, c.name, c.nameZh), value: spentInMonth(txs, month, rates, { categoryId: c.id }) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.spending} />
      <div className="h-64 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="px-5 pt-4">
        {rows.map((r) => (
          <div key={r.id} className="flex justify-between py-2 text-sm">
            <span>{r.name}</span>
            <span className="tabular-nums">{money(r.value, "HKD")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CashflowPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const rec = useApp((s) => s.recurring);
  const adhoc = useApp((s) => s.adhocBudgets);
  const rates = useApp((s) => s.fxRates);
  const today = todayISO();
  const from = today.slice(0, 7);
  const series = cashflowSeries(txs, rec, adhoc, rates, from, 6, today);
  const current = monthCashflowForecast(txs, rec, adhoc, from, rates, today);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.cashflow} />
      <p className="px-5 pb-3 text-xs text-muted">
        {locale === "zh-HK"
          ? "收入含本月已入帳及尚未扣帳的定期收入。本月開支含已入帳開支、尚未扣帳的每月定期，以及尚未扣帳的本月臨時。"
          : "Income includes posted and still-scheduled income this month. This month’s expense includes posted spend, uncharged monthly regulars, and uncharged this-month-only holds."}
      </p>
      <div className="mx-4 mb-4 grid grid-cols-3 gap-2 rounded-xl bg-elevated px-4 py-3 text-center">
        <div>
          <div className="text-xs text-muted">{t.reports.income}</div>
          <div className="mt-1 text-sm font-semibold tabular-nums text-income">{money(current.income, "HKD")}</div>
        </div>
        <div>
          <div className="text-xs text-muted">{t.reports.expense}</div>
          <div className="mt-1 text-sm font-semibold tabular-nums text-expense">{money(current.expense, "HKD")}</div>
        </div>
        <div>
          <div className="text-xs text-muted">{t.reports.net}</div>
          <div className="mt-1 text-sm font-semibold tabular-nums">{money(current.net, "HKD", { sign: true })}</div>
        </div>
      </div>
      <div className="h-64 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series.map((s) => ({ ...s, label: monthLabel(s.month, locale) }))}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="px-5 pt-4">
        {series.map((s) => (
          <div key={s.month} className="flex items-center justify-between border-t border-line py-3 text-sm first:border-0">
            <span>{monthLabel(s.month, locale)}</span>
            <span className="tabular-nums text-muted">
              {money(s.income, "HKD")} / {money(s.expense, "HKD")}
            </span>
            <span className="tabular-nums font-medium">{money(s.net, "HKD", { sign: true })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LivingPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rec = useApp((s) => s.recurring);
  const m = useApp((s) => s.mortgage);
  const living = livingEssentials(rec);
  const rate = m ? effectiveRate(m) : 0;
  const pmt = m ? monthlyPayment(m.outstanding, rate, m.remainingMonths) : 0;
  const interest = m ? remainingInterest(m.outstanding, rate, m.remainingMonths) : 0;
  const end = m ? endMonthFromRemaining(todayISO(), m.remainingMonths, m.paymentDay) : "";
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.living} />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">{locale === "zh-HK" ? "每月必要居住開支" : "Monthly living essentials"}</span>
          <InfoButton k="mortgage" />
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(living, "HKD")}</div>
        {m ? (
          <div className="mt-4 space-y-1 text-sm text-muted">
            <div>
              {t.add.amount}: {money(pmt, "HKD")}
            </div>
            <div>
              {locale === "zh-HK" ? "尚餘利息" : "Remaining interest"}: {money(interest, "HKD")}
            </div>
            <div>
              {locale === "zh-HK" ? "完結" : "End"}: {end}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TravelPage() {
  const t = useT();
  const loc = useUi((s) => s.locale);
  const trips = useApp((s) => s.trips);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const annual = useApp((s) => s.annualTravelBudget);
  const addTrip = useApp((s) => s.addTrip);
  const travelIds = new Set(cats.filter((c) => c.theme === "travel").map((c) => c.id));
  const ytd = travelSpendYtd(txs, Number(todayISO().slice(0, 4)), travelIds, rates);
  const [name, setName] = useState("");
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.travel} />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">{t.budget.annualTravel}</span>
          <InfoButton k="trip" />
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums">
          {money(ytd, "HKD")} <span className="text-sm font-normal text-muted">/ {money(annual, "HKD")}</span>
        </div>
      </div>
      {trips.filter((tr) => isTripActive(tr, todayISO())).map((tr) => {
        const spent = tripCashSpent(txs, tr.id, rates);
        const p = tripProgress(tr, spent);
        return (
          <Link key={tr.id} to="/reports/travel/$id" params={{ id: tr.id }} className="mx-4 mt-3 block rounded-xl bg-elevated p-4">
            <div className="text-sm font-medium">{pickName(loc, tr.name, tr.nameZh)}</div>
            <div className="mt-1 text-xs text-muted">
              {money(spent, "HKD")} / {money(tr.cashBudget, "HKD")} · {p.onTrack ? (loc === "zh-HK" ? "進度良好" : "On track") : loc === "zh-HK" ? "需留意" : "At risk"}
            </div>
          </Link>
        );
      })}
      <div className="mx-4 mt-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 flex-1 rounded-lg bg-elevated px-3" placeholder={loc === "zh-HK" ? "新旅程" : "New trip"} />
        <button
          type="button"
          className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent"
          onClick={async () => {
            const n = name.trim();
            if (!n) return;
            await addTrip({
              id: newId(),
              name: n,
              nameZh: n,
              destination: n,
              start: todayISO().slice(0, 7) + "-28",
              end: todayISO().slice(0, 7) + "-30",
              status: "planning",
              cashBudget: 10000,
              cashSaved: 0,
              milesTarget: 0,
              milesSaved: 0,
              monthlyCash: 1000,
            });
            setName("");
          }}
        >
          {t.add.save}
        </button>
      </div>
    </div>
  );
}

export function TripDetailPage({ id }: { id: string }) {
  const loc = useUi((s) => s.locale);
  const trip = useApp((s) => s.trips.find((x) => x.id === id));
  const del = useApp((s) => s.deleteTrip);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  if (!trip) return <div className="p-5">—</div>;
  const spent = tripCashSpent(txs, trip.id, rates);
  return (
    <div className="pb-10">
      <ScreenHeader title={pickName(loc, trip.name, trip.nameZh)} />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="text-xl font-semibold tabular-nums">{money(spent, "HKD")}</div>
        <div className="text-sm text-muted">/ {money(trip.cashBudget, "HKD")}</div>
      </div>
      <button type="button" className="mx-5 mt-6 text-sm text-expense" onClick={() => void del(trip.id)}>
        {loc === "zh-HK" ? "移除旅程" : "Remove trip"}
      </button>
    </div>
  );
}

export function RetirementPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const txs = useApp((s) => s.transactions);
  const rec = useApp((s) => s.recurring);
  const ret = useApp((s) => s.retirement);
  const update = useApp((s) => s.updateRetirement);
  const allowances = useApp((s) => s.allowances);
  const oneOffs = useApp((s) => s.oneOffs);
  const mortgage = useApp((s) => s.mortgage);
  const nw = netWorthNow(accounts, rates);
  const avg = savingsLast12Months(txs, rates, monthKey());
  const inputs = ret ?? {
    id: "base",
    currentAge: 40,
    retireAge: 65,
    deathAge: 90,
    monthlyIncomeNow: avg.monthlyIncome,
    monthlySpendNow: avg.monthlySpend,
    targetMonthly: 25000,
    preReturn: 0.05,
    postReturn: 0.035,
    inflation: 0.025,
    travelInRetirement: 0,
  };
  const result = runRetirement(inputs, {
    investableNow: nw.net,
    mortgageMonthly: mortgage ? monthlyPayment(mortgage.outstanding, effectiveRate(mortgage), mortgage.remainingMonths) : 0,
    mortgagePayoffAge: inputs.currentAge + Math.round((mortgage?.remainingMonths ?? 0) / 12),
    housingAfterPayoff: livingEssentials(rec.filter((r) => r.living && r.categoryId !== "mortgage-p" && r.categoryId !== "mortgage-i")),
    oneOffs,
    allowances,
  });
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.retirement} />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">{locale === "zh-HK" ? "退休時資產" : "Corpus at retirement"}</span>
          <InfoButton k="retirement" />
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(result.corpusAtRetire, "HKD")}</div>
        <p className="mt-2 text-xs text-muted">
          {result.depletes ? (locale === "zh-HK" ? "可能用盡" : "May deplete") : locale === "zh-HK" ? "可支撐至預期終年" : "Lasts to expected age"}
        </p>
      </div>
      <div className="px-5 pt-4 space-y-3">
        {(
          [
            ["currentAge", inputs.currentAge],
            ["retireAge", inputs.retireAge],
            ["targetMonthly", inputs.targetMonthly],
          ] as const
        ).map(([k, v]) => (
          <label key={k} className="block text-xs text-muted">
            {k}
            <input
              inputMode="decimal"
              defaultValue={v}
              className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground"
              onBlur={(e) => void update({ ...inputs, id: "base", [k]: Number(e.target.value) || 0 })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function HistoryPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const snaps = useApp((s) => s.snapshots);
  const months = monthKeysBack(monthKey(), 6);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.history} />
      {months.map((m) => {
        const s = snaps.find((x) => x.month === m);
        return (
          <div key={m} className="flex items-center justify-between px-5 py-3 text-sm">
            <span>{monthLabel(m, locale)}</span>
            <span className="tabular-nums">{s ? money(s.net, "HKD") : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}
