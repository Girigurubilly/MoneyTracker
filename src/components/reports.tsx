import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  CalendarRange,
  ChevronRight,
  GitCompare,
  Home,
  Landmark,
  LayoutDashboard,
  Plane,
  Receipt,
  Scale,
  Sunset,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Disclaimer, Group, Hairline, Overlay, ProgressRing, Row, ScreenHeader, SectionLabel, StatusChip, BudgetChip } from "@/components/shared";
import { Enter, useCountUp } from "@/components/retire-ux";
import { money, pct, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { monthKeysBack, monthLabel } from "@/lib/derived";
import { budgetActuals, committedOutflows, monthEndIso, monthFlow } from "@/lib/calc/budget";
import { nextTrip, travelSpendYtd, tripCashSpent } from "@/lib/calc/trips";
import { effectiveRate } from "@/lib/calc/mortgage";
import { housingStatus, monthlyHousingCost } from "@/lib/calc/housing";
import { netWorthNow, periodNetWorthPoints } from "@/lib/calc/networth";
import { useRetirementHeadline } from "@/components/reports-retire";
import { periodCashflowPoints, periodRange, type PeriodPreset } from "@/lib/calc/period";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import { monthKey } from "@/lib/calc/ledger";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { cn } from "@/lib/utils";

export { SpendingPage } from "@/components/reports-spend";
export { CashflowPage } from "@/components/reports-cashflow";
export { LivingPage } from "@/components/reports-living";
export { TravelPage, TripDetailPage } from "@/components/reports-travel";
export { RetirementPage, RetirementProjectionPage } from "@/components/reports-retire";
export { BalancePage } from "@/components/reports-balance";

export function ReportsHub() {
  const t = useT();
  const access = useUi((s) => s.accessMode);
  const head = useRetirementHeadline();
  const retireSub =
    head.story.kind === "setup"
      ? null
      : `${head.story.kind === "enough" ? t.reports.verdictEnough : t.reports.verdictShort} · ${money(head.story.gap, "HKD", { sign: true })}`;
  const items = [
    { to: "/reports/dashboard", title: t.reports.dashboard, icon: LayoutDashboard, modes: ["standard", "elderly"] },
    { to: "/reports/spending", title: t.reports.spending, icon: Receipt, modes: ["standard", "elderly", "kid"] },
    { to: "/reports/cashflow", title: t.reports.cashflow, icon: ArrowLeftRight, modes: ["standard", "elderly", "kid"] },
    { to: "/reports/trends", title: t.reports.trends, icon: TrendingUp, modes: ["standard", "elderly"] },
    { to: "/reports/compare", title: t.reports.yearCompare, icon: GitCompare, modes: ["standard"] },
    { to: "/reports/balance", title: t.reports.balance, icon: Scale, modes: ["standard", "elderly"] },
    { to: "/reports/deposits", title: t.reports.deposits, icon: Landmark, modes: ["standard", "elderly"] },
    { to: "/reports/prices", title: t.prices.title, icon: BadgeDollarSign, modes: ["standard", "elderly"] },
    { to: "/reports/yearly", title: t.reports.yearly, icon: CalendarRange, modes: ["standard"] },
    { to: "/reports/living", title: t.reports.living, icon: Home, modes: ["standard", "elderly"] },
    { to: "/reports/travel", title: t.reports.travel, icon: Plane, modes: ["standard", "elderly", "kid"] },
    { to: "/reports/retirement", title: t.reports.retirement, icon: Sunset, modes: ["standard", "elderly"] },
  ].filter((it) => it.modes.includes(access));
  const groups = [
    { id: "flow", title: t.reports.groupFlow, items: items.filter((it) => ["/reports/dashboard", "/reports/spending", "/reports/cashflow", "/reports/trends", "/reports/compare"].includes(it.to)) },
    { id: "save", title: t.reports.groupSave, items: items.filter((it) => ["/reports/balance", "/reports/deposits", "/reports/prices", "/reports/yearly"].includes(it.to)) },
    { id: "life", title: t.reports.groupLife, items: items.filter((it) => ["/reports/living", "/reports/travel", "/reports/retirement"].includes(it.to)) },
  ].filter((g) => g.items.length);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.title} large />
      {groups.map((g) => (
        <div key={g.id}>
          <SectionLabel>{g.title}</SectionLabel>
          <Group>
            {g.items.map((it, i) => (
              <div key={it.to}>
                {i > 0 ? <Hairline /> : null}
                <Row
                  icon={<it.icon className="size-4" />}
                  title={it.title}
                  subtitle={it.to === "/reports/retirement" ? retireSub ?? undefined : undefined}
                  to={it.to}
                  chevron
                />
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
  const deposits = useApp((s) => s.deposits);
  const accounts = useApp((s) => s.accounts);
  const budgets = useApp((s) => s.budgets);
  const adhoc = useApp((s) => s.adhocBudgets);
  const targetMode = useApp((s) => s.budgetTargetMode);
  const m = useApp((s) => s.mortgage);
  const trips = useApp((s) => s.trips);
  const annual = useApp((s) => s.annualTravelBudget);
  const head = useRetirementHeadline();
  const [explain, setExplain] = useState<null | "available" | "saveMonth" | "saveYtd" | "travel">(null);
  const today = todayISO();
  const cost = monthlyHousingCost(txs, rec, cats, rates, today);
  const houseStatus = housingStatus(m);
  const travelIds = new Set(cats.filter((c) => c.theme === "travel").map((c) => c.id));
  const ytd = travelSpendYtd(txs, Number(today.slice(0, 4)), travelIds, rates);
  const nxt = nextTrip(trips, today);
  const nxtSpent = nxt ? tripCashSpent(txs, nxt.id, rates, adhoc) : 0;
  const month = monthKey(today);
  const flow = monthFlow(txs, month, rates);
  const monthRow = budgetActuals(budgets, txs, month, rates, cats, rec, today, adhoc, targetMode).find(
    (b) => b.id === MONTH_TOTAL_BUDGET_ID,
  );
  const ytdFlow = monthKeysBack(month, Number(today.slice(5, 7))).reduce(
    (acc, m) => {
      const f = monthFlow(txs, m, rates);
      return { income: acc.income + f.income, expense: acc.expense + f.expense };
    },
    { income: 0, expense: 0 },
  );
  const cap = monthRow?.monthly ?? 0;
  const spent = monthRow?.spent ?? flow.expense;
  const hold = (monthRow?.reserved ?? 0) + (targetMode === "regular" ? 0 : (monthRow?.reservedAdhoc ?? 0));
  const available = cap > 0 ? (monthRow?.remaining ?? cap - spent - hold) : flow.income - spent - hold;
  const next14 = committedOutflows(rec, adhoc, txs, rates, today, 14);
  const afterCommit = available - next14;
  const nw = netWorthNow(accounts, rates, deposits);
  const prevEnd = monthEndIso(shiftYm(month, -1));
  const prevWorth = periodNetWorthPoints(accounts, txs, rates, prevEnd, prevEnd, deposits).at(-1)?.net;
  const nwDelta = prevWorth == null ? 0 : nw.net - prevWorth;
  const saveM = flow.income > 0 ? flow.net / flow.income : 0;
  const saveY = ytdFlow.income > 0 ? (ytdFlow.income - ytdFlow.expense) / ytdFlow.income : 0;
  const incomeZero = flow.income <= 0.005;
  const ledgerLive =
    txs.some((tx) => !tx.planned) ||
    accounts.some((a) => a.type !== "miles" && a.currency !== "MILES" && Math.abs(a.balance) > 0.005);
  const yearTravelPct = annual > 0 ? ytd / annual : 0;
  const tripPct = nxt && nxt.cashBudget > 0 ? nxtSpent / nxt.cashBudget : 0;
  const shownAvail = useCountUp(available, false, 420);
  const monthTitle = monthLabel(month, loc);

  const explainCopy =
    explain === "available"
      ? { title: t.reports.explainAvailableTitle, body: t.reports.explainAvailableBody }
      : explain === "saveMonth"
        ? { title: t.reports.explainSaveMonthTitle, body: t.reports.explainSaveMonthBody }
        : explain === "saveYtd"
          ? { title: t.reports.explainSaveYtdTitle, body: t.reports.explainSaveYtdBody }
          : explain === "travel"
            ? { title: t.reports.explainTravelTitle, body: t.reports.explainTravelBody }
            : null;

  return (
    <div className="pb-24">
      <ScreenHeader title={t.reports.dashboard} backTo="/reports" />
      <Enter>
        <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
          <button type="button" className="tr-press w-full text-left" onClick={() => setExplain("available")}>
            <div className="text-xs font-medium text-accent">
              {t.reports.availableSpend}
              <span className="ml-1 font-normal text-muted">· {monthTitle}</span>
            </div>
            <div className={cn("mt-1 text-3xl font-semibold tabular-nums tracking-tight", shownAvail >= 0 ? "text-income" : "text-expense")}>
              {money(shownAvail, "HKD", { sign: true })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
              <span>
                {t.reports.budgetRemain} {money(available, "HKD", { sign: true })}
              </span>
              {next14 > 0.005 ? (
                <span>
                  {t.reports.afterCommitments} {money(afterCommit, "HKD", { sign: true })}
                </span>
              ) : null}
            </div>
          </button>
          <div className="mt-3 border-t border-line pt-1">
            <DashRow label={t.reports.mtdVsBudget} value={cap ? `${money(spent, "HKD")} / ${money(cap, "HKD")}` : money(spent, "HKD")} />
            <DashRow label={t.reports.next14} value={money(next14, "HKD")} />
            <DashRow label={t.reports.netWorthNow} value={money(nw.net, "HKD")} />
            <DashRow label={t.reports.nwDeltaLine} value={money(nwDelta, "HKD", { sign: true })} />
            <button type="button" className="tr-press flex w-full items-start justify-between gap-3 border-b border-line py-2.5 text-left" onClick={() => setExplain("saveMonth")}>
              <span className="text-xs text-muted">{t.reports.saveRateMonth}</span>
              <span className="max-w-[58%] text-right text-sm font-semibold tabular-nums">
                {incomeZero ? t.reports.salaryNotPosted : pct(saveM)}
              </span>
            </button>
            <button type="button" className="tr-press flex w-full items-start justify-between gap-3 py-2.5 text-left" onClick={() => setExplain("saveYtd")}>
              <span className="text-xs text-muted">{t.reports.saveRateYtdPosted}</span>
              <span className="max-w-[58%] text-right text-sm font-semibold tabular-nums">{pct(saveY)}</span>
            </button>
          </div>
        </div>
      </Enter>

      <Enter delay>
        <Link to="/reports/living" className="tr-press mx-4 block rounded-xl bg-elevated p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold">{t.reports.living}</h2>
            {m ? <StatusChip status={houseStatus} /> : <span className="text-xs font-medium text-muted">{t.reports.notSet}</span>}
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
      </Enter>

      <Enter delay>
        <div className="mx-4 mt-3 rounded-xl bg-elevated p-4">
          <Link to="/reports/travel" className="tr-press block">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold">{t.reports.travel}</h2>
              <div className="flex items-center gap-2">
                {ledgerLive && annual > 0 ? <BudgetChip over={ytd > annual} /> : <span className="text-xs font-medium text-muted">{t.reports.notSet}</span>}
                <div className="relative shrink-0">
                  <ProgressRing value={yearTravelPct} size={36} stroke={3} tone={ytd > annual && annual > 0 ? "expense" : "income"} draw />
                  <span className="pointer-events-none absolute inset-0 grid place-items-center text-[9px] font-semibold tabular-nums">
                    {annual > 0 ? `${Math.round(yearTravelPct * 100)}%` : "—"}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs text-muted">{t.reports.travelYtd}</div>
              <div className="mt-1 text-base font-semibold tabular-nums leading-snug">
                {money(ytd, "HKD")}
                <span className="text-sm font-normal text-muted"> / {money(annual, "HKD")}</span>
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <ChevronRight className="size-4 text-faint" />
            </div>
          </Link>
          <button type="button" className="tr-press mt-2 w-full rounded-lg bg-background px-3 py-2 text-left text-[11px] leading-4 text-muted" onClick={() => setExplain("travel")}>
            <span className="font-medium text-[var(--color-foreground)]">
              {t.reports.travelYearUsed.replace("{pct}", annual > 0 ? `${Math.round(yearTravelPct * 100)}%` : "—")}
            </span>
            {nxt ? (
              <>
                {" · "}
                {pickName(loc, nxt.name, nxt.nameZh)}
                {" · "}
                {t.reports.travelTripUsed.replace("{pct}", nxt.cashBudget > 0 ? `${Math.round(tripPct * 100)}%` : "—")}
              </>
            ) : null}
          </button>
        </div>
      </Enter>

      <Enter delay>
        <Link to="/reports/retirement" className="tr-press mx-4 mt-3 block rounded-xl bg-elevated p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold">{t.reports.retirement}</h2>
            {ledgerLive && head.story.kind !== "setup" ? (
              <span className={cn("text-xs font-medium tabular-nums", head.story.kind === "enough" ? "text-income" : "text-expense")}>
                {head.story.kind === "enough" ? t.reports.verdictEnough : t.reports.verdictShort}
                {" · "}
                {money(head.story.gap, "HKD", { sign: true })}
              </span>
            ) : (
              <span className="text-xs font-medium text-muted">{t.reports.verdictSetup}</span>
            )}
          </div>
          {ledgerLive && head.story.kind !== "setup" ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Metric label={t.reports.spendRetired} value={money(head.base.targetMonthly, "HKD")} />
              <Metric label={t.reports.surplus} value={money(head.story.gap, "HKD", { sign: true })} />
              <Metric label={t.reports.investableNow} value={money(head.investable, "HKD")} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{t.reports.setupLine}</p>
          )}
          <div className="mt-2 flex justify-end">
            <ChevronRight className="size-4 text-faint" />
          </div>
        </Link>
      </Enter>

      <Disclaimer>{t.reports.disclaimer}</Disclaimer>

      {explainCopy ? (
        <Overlay open onClose={() => setExplain(null)} title={explainCopy.title}>
          <p className="px-5 pb-8 text-sm leading-6 text-muted">{explainCopy.body}</p>
        </Overlay>
      ) : null}
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
