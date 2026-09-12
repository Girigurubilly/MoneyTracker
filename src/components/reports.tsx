import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";
import { Disclaimer, Group, Hairline, ScreenHeader, StatusChip, BudgetChip } from "@/components/shared";
import { compactHkd, money, pct, shortDate, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { monthKeysBack, monthLabel } from "@/lib/derived";
import { chargedIso, isExpenseRegular, livingEssentials, monthFlow } from "@/lib/calc/budget";
import { nextTrip, travelSpendYtd, tripCashSpent } from "@/lib/calc/trips";
import { effectiveRate, monthlyPayment } from "@/lib/calc/mortgage";
import { housingStatus, monthlyHousingCost } from "@/lib/calc/housing";
import { investableNow, netWorthNow } from "@/lib/calc/networth";
import { ageFromBirthday, retirementStatus, runRetirement, savingsLast12Months, sustainableMonthly } from "@/lib/calc/retirement";
import { periodCashflowPoints, periodRange, type PeriodPreset } from "@/lib/calc/period";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import { monthKey } from "@/lib/calc/ledger";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export { SpendingPage } from "@/components/reports-spend";
export { CashflowPage } from "@/components/reports-cashflow";
export { LivingPage } from "@/components/reports-living";
export { TravelPage, TripDetailPage } from "@/components/reports-travel";
export { RetirementPage, RetirementProjectionPage } from "@/components/reports-retire";
export { BalancePage } from "@/components/reports-balance";

export function ReportsHub() {
  const t = useT();
  const access = useUi((s) => s.accessMode);
  const items = [
    { to: "/reports/dashboard", title: t.reports.dashboard, modes: ["standard", "elderly"] },
    { to: "/reports/spending", title: t.reports.spending, modes: ["standard", "elderly", "kid"] },
    { to: "/reports/cashflow", title: t.reports.cashflow, modes: ["standard", "elderly", "kid"] },
    { to: "/reports/trends", title: t.reports.trends, modes: ["standard", "elderly"] },
    { to: "/reports/compare", title: t.reports.yearCompare, modes: ["standard"] },
    { to: "/reports/balance", title: t.reports.balance, modes: ["standard", "elderly"] },
    { to: "/reports/worth", title: t.reports.worthTrend, modes: ["standard", "elderly"] },
    { to: "/reports/deposits", title: t.reports.deposits, modes: ["standard", "elderly"] },
    { to: "/reports/prices", title: t.prices.title, modes: ["standard", "elderly"] },
    { to: "/reports/yearly", title: t.reports.yearly, modes: ["standard"] },
    { to: "/reports/living", title: t.reports.living, modes: ["standard", "elderly"] },
    { to: "/reports/travel", title: t.reports.travel, modes: ["standard", "elderly", "kid"] },
    { to: "/reports/retirement", title: t.reports.retirement, modes: ["standard", "elderly"] },
  ].filter((it) => it.modes.includes(access));
  const groups = [
    { id: "flow", title: t.reports.groupFlow, items: items.filter((it) => ["/reports/dashboard", "/reports/spending", "/reports/cashflow", "/reports/trends", "/reports/compare"].includes(it.to)) },
    { id: "save", title: t.reports.groupSave, items: items.filter((it) => ["/reports/balance", "/reports/worth", "/reports/deposits", "/reports/prices", "/reports/yearly"].includes(it.to)) },
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
  const budgets = useApp((s) => s.budgets);
  const adhoc = useApp((s) => s.adhocBudgets);
  const snaps = useApp((s) => s.snapshots);
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
  const month = monthKey(today);
  const flow = monthFlow(txs, month, rates);
  const ytdFlow = monthKeysBack(month, Number(today.slice(5, 7))).reduce(
    (acc, m) => {
      const f = monthFlow(txs, m, rates);
      return { income: acc.income + f.income, expense: acc.expense + f.expense };
    },
    { income: 0, expense: 0 },
  );
  const essentials = rec.filter((r) => r.essential && isExpenseRegular(r) && r.frequency === "monthly").reduce((s, r) => s + r.amount, 0);
  const plannedXfer = rec.filter((r) => r.type === "transfer" && !r.countsAsExpense && r.frequency === "monthly").reduce((s, r) => s + r.amount, 0);
  const cap = budgets.find((b) => b.id === MONTH_TOTAL_BUDGET_ID)?.monthly ?? 0;
  const available = flow.income - essentials - plannedXfer - cap;
  const until = addDaysIso(today, 14);
  let next14 = 0;
  for (const r of rec) {
    if (!isExpenseRegular(r) && r.type !== "transfer") continue;
    const dates = r.frequency === "monthly" ? [chargedIso(month, r.chargedDay ?? 1), chargedIso(shiftYm(month, 1), r.chargedDay ?? 1)] : [r.nextDate];
    for (const iso of dates) {
      if (iso > today && iso <= until) next14 += r.amount;
    }
  }
  for (const a of adhoc) {
    if (a.date > today && a.date <= until) next14 += a.amount;
  }
  for (const tx of txs) {
    if (!tx.planned) continue;
    if (tx.date <= today || tx.date > until) continue;
    if (tx.type === "expense" || (tx.type === "transfer" && tx.countsAsExpense)) next14 += tx.amount;
  }
  const nw = netWorthNow(accounts, rates);
  const prevSnap = snaps.find((s) => s.month === shiftYm(month, -1));
  const nwDelta = prevSnap ? nw.net - prevSnap.net : 0;
  const saveM = flow.income > 0 ? flow.net / flow.income : 0;
  const saveY = ytdFlow.income > 0 ? (ytdFlow.income - ytdFlow.expense) / ytdFlow.income : 0;

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.dashboard} backTo="/reports" />
      <div className="mx-4 mb-3 rounded-xl bg-elevated px-4 py-3">
        <DashRow label={t.reports.availableSpend} value={money(available, "HKD", { sign: true })} />
        <DashRow label={t.reports.mtdVsBudget} value={cap ? `${money(flow.expense, "HKD")} / ${money(cap, "HKD")}` : money(flow.expense, "HKD")} />
        <DashRow label={t.reports.next14} value={money(next14, "HKD")} />
        <DashRow label={t.reports.netWorthNow} value={`${money(nw.net, "HKD")} (${t.reports.vsLastMonth} ${money(nwDelta, "HKD", { sign: true })})`} />
        <DashRow label={t.reports.saveRateMonth} value={pct(saveM)} />
        <DashRow label={t.reports.saveRateYtd} value={pct(saveY)} />
      </div>
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

function DashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="max-w-[58%] text-right text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function shiftYm(ym: string, dir: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className="mt-1 truncate text-base font-semibold tabular-nums">{value}</div>
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
