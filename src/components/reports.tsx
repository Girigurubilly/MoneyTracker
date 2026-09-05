import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";
import { Disclaimer, Group, Hairline, ScreenHeader, StatusChip, BudgetChip } from "@/components/shared";
import { compactHkd, money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { cashflowSeries, monthKeysBack, monthLabel } from "@/lib/derived";
import { livingEssentials, monthCashflowForecast } from "@/lib/calc/budget";
import { nextTrip, travelSpendYtd, tripCashSpent } from "@/lib/calc/trips";
import { effectiveRate, monthlyPayment } from "@/lib/calc/mortgage";
import { housingStatus, monthlyHousingCost } from "@/lib/calc/housing";
import { investableNow } from "@/lib/calc/networth";
import { ageFromBirthday, retirementStatus, runRetirement, savingsLast12Months, sustainableMonthly } from "@/lib/calc/retirement";
import { monthKey } from "@/lib/calc/ledger";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export { SpendingPage } from "@/components/reports-spend";
export { LivingPage } from "@/components/reports-living";
export { TravelPage, TripDetailPage } from "@/components/reports-travel";
export { RetirementPage } from "@/components/reports-retire";
export { BalancePage } from "@/components/reports-balance";

export function ReportsHub() {
  const t = useT();
  const access = useUi((s) => s.accessMode);
  const items = [
    { to: "/reports/dashboard", title: t.reports.dashboard, modes: ["standard", "elderly"] },
    { to: "/reports/spending", title: t.reports.spending, modes: ["standard", "elderly", "kid"] },
    { to: "/reports/compare", title: t.reports.yearCompare, modes: ["standard"] },
    { to: "/reports/balance", title: t.reports.balance, modes: ["standard", "elderly"] },
    { to: "/reports/deposits", title: t.reports.deposits, modes: ["standard", "elderly"] },
    { to: "/reports/yearly", title: t.reports.yearly, modes: ["standard"] },
    { to: "/reports/living", title: t.reports.living, modes: ["standard", "elderly"] },
    { to: "/reports/travel", title: t.reports.travel, modes: ["standard", "elderly", "kid"] },
    { to: "/reports/retirement", title: t.reports.retirement, modes: ["standard", "elderly"] },
  ].filter((it) => it.modes.includes(access));
  const groups = [
    { id: "flow", title: t.reports.groupFlow, items: items.filter((it) => ["/reports/dashboard", "/reports/spending", "/reports/compare"].includes(it.to)) },
    { id: "save", title: t.reports.groupSave, items: items.filter((it) => ["/reports/balance", "/reports/deposits", "/reports/yearly"].includes(it.to)) },
    { id: "life", title: t.reports.groupLife, items: items.filter((it) => ["/reports/living", "/reports/travel", "/reports/retirement"].includes(it.to)) },
  ].filter((g) => g.items.length);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.title} large />
      {groups.map((g) => (
        <div key={g.id} className="mb-4">
          <h2 className="px-5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</h2>
          <Group>
            {g.items.map((it, i) => (
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
      ))}
    </div>
  );
}

export function DashboardPage() {
  const t = useT();
  const loc = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const rec = useApp((s) => s.recurring);
  const accounts = useApp((s) => s.accounts);
  const m = useApp((s) => s.mortgage);
  const trips = useApp((s) => s.trips);
  const annual = useApp((s) => s.annualTravelBudget);
  const ret = useApp((s) => s.retirement);
  const allowances = useApp((s) => s.allowances);
  const oneOffs = useApp((s) => s.oneOffs);
  const today = todayISO();
  const cost = monthlyHousingCost(txs, rec, cats, rates, today);
  const houseStatus = housingStatus(m);
  const travelIds = new Set(cats.filter((c) => c.theme === "travel").map((c) => c.id));
  const ytd = travelSpendYtd(txs, Number(today.slice(0, 4)), travelIds, rates);
  const nxt = nextTrip(trips, today);
  const avg = savingsLast12Months(txs, rates, monthKey(today));
  const inputs = {
    currentAge: ret?.birthday ? ageFromBirthday(ret.birthday, today) : ret?.currentAge ?? 40,
    retireAge: ret?.retireAge ?? 65,
    deathAge: ret?.deathAge ?? 90,
    monthlyIncomeNow: ret?.monthlyIncomeNow || avg.monthlyIncome,
    monthlySpendNow: ret?.monthlySpendNow || avg.monthlySpend,
    targetMonthly: ret?.targetMonthly ?? avg.monthlySpend,
    preReturn: ret?.preReturn ?? 0.05,
    postReturn: ret?.postReturn ?? 0.035,
    inflation: ret?.inflation ?? 0.025,
    travelInRetirement: ret?.travelInRetirement ?? 0,
  };
  const ctx = {
    investableNow: investableNow(accounts, rates),
    mortgageMonthly: m ? monthlyPayment(m.outstanding, effectiveRate(m), m.remainingMonths) : 0,
    mortgagePayoffAge: inputs.currentAge + Math.round((m?.remainingMonths ?? 0) / 12),
    housingAfterPayoff: livingEssentials(rec.filter((r) => r.living && r.categoryId !== "mortgage-p" && r.categoryId !== "mortgage-i")),
    oneOffs,
    allowances,
  };
  const result = runRetirement(inputs, ctx);
  const sustain = sustainableMonthly(inputs, ctx);
  const retStatus = retirementStatus(result.depletes, sustain, inputs.targetMonthly, result.series);
  const nxtSpent = nxt ? tripCashSpent(txs, nxt.id, rates) : 0;

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.dashboard} backTo="/reports" />
      <Link to="/reports/living" className="mx-4 block rounded-xl bg-elevated p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold">{t.reports.living}</h2>
          <StatusChip status={houseStatus} />
        </div>
        <div className="mt-4">
          <div className="text-xs text-muted">{t.reports.housingCost}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{money(cost, "HKD")}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Metric label={t.reports.outstanding} value={m ? money(m.outstanding, "HKD") : "—"} />
          <Metric label={t.reports.effectiveRate} value={m ? `${(effectiveRate(m) * 100).toFixed(2)}%` : "—"} />
        </div>
        <div className="mt-2 flex justify-end">
          <ChevronRight className="size-4 text-faint" />
        </div>
      </Link>
      <Link to="/reports/travel" className="mx-4 mt-3 block rounded-xl bg-elevated p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold">{t.reports.travel}</h2>
          <BudgetChip over={annual > 0 && ytd > annual} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted">{t.reports.travelYtd}</div>
            <div className="mt-1 text-base font-semibold tabular-nums leading-snug">
              {money(ytd, "HKD")}
              <span className="block text-sm font-normal text-muted">/ {money(annual, "HKD")}</span>
            </div>
          </div>
          <Metric label={t.reports.nextTrip} value={nxt ? pickName(loc, nxt.name, nxt.nameZh) : t.common.none} />
        </div>
        {nxt ? (
          <div className="mt-3 text-sm text-muted">
            {t.reports.nextTrip}: {pickName(loc, nxt.name, nxt.nameZh)}
            {nxt.cashBudget > 0 ? ` · ${Math.round((nxtSpent / nxt.cashBudget) * 100)}%` : ""}
          </div>
        ) : null}
        <div className="mt-2 flex justify-end">
          <ChevronRight className="size-4 text-faint" />
        </div>
      </Link>
      <Link to="/reports/retirement" className="mx-4 mt-3 block rounded-xl bg-elevated p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold">{t.reports.retirement}</h2>
          <StatusChip status={retStatus} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Metric label={t.reports.corpusAtRetire} value={compactHkd(result.corpusAtRetire)} />
          <Metric label={t.reports.sustainable} value={money(sustain, "HKD")} />
          <Metric label={t.reports.targetMonthly} value={money(inputs.targetMonthly, "HKD")} />
        </div>
        <div className="mt-2 flex justify-end">
          <ChevronRight className="size-4 text-faint" />
        </div>
      </Link>
      <Disclaimer>{t.reports.disclaimer}</Disclaimer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className="mt-1 truncate text-base font-semibold tabular-nums">{value}</div>
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
      <ScreenHeader title={t.reports.cashflow} backTo="/reports" />
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

export function HistoryPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const snaps = useApp((s) => s.snapshots);
  const months = monthKeysBack(monthKey(todayISO()), 6);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.history} backTo="/reports" />
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
