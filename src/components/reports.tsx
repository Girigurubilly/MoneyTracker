import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  ChevronRight,
  Home,
  LineChart,
  PieChart,
  Plane,
  Plus,
  TrendingUp,
  Umbrella,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RechartsPie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  Disclaimer,
  Group,
  Hairline,
  InfoButton,
  Metric,
  Overlay,
  Row,
  ScreenHeader,
  StatusChip,
  TransactionRow,
} from "@/components/shared";
import { livingEssentials, monthlyExpenseRegulars } from "@/lib/calc/budget";
import { investableNow } from "@/lib/calc/networth";
import { runRetirement, savingsLast12Months } from "@/lib/calc/retirement";
import {
  amortize,
  effectiveRate,
  endDateFromRemaining,
  monthsUntil,
  nextPaymentIso,
  normalizeEndDate,
  paymentDayOf,
  remainingInterest,
  remainingPayments,
  stress,
} from "@/lib/calc/mortgage";
import { isTripActive, isTripExpired, tripCashSpent, tripProgress, travelSpendYtd } from "@/lib/calc/trips";
import {
  categorySpend,
  forecastFromRecurring,
  groupSpendByParent,
  lastMonthsFlow,
  presetRange,
  rangeCategorySpend,
  rangeFlow,
  withOtherCategory,
  type RangePreset,
} from "@/lib/derived";
import { miles, money, pct, ratePct, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { monthKey } from "@/lib/calc/ledger";
import type { Allowance, Mortgage, Trip } from "@/lib/types";
import { cn } from "@/lib/utils";
import { newId, useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

const pieColors = ["#059669", "#0284c7", "#d97706", "#dc2626", "#0369a1", "#64748b", "#0ea5e9", "#14b8a6"];

const CHART_COLORS = [
  "#34d399",
  "#2dd4bf",
  "#fbbf24",
  "#ef4444",
  "#f97316",
  "#22d3ee",
  "#3b82f6",
  "#8b5cf6",
  "#84cc16",
  "#ec4899",
];

export function ReportsHub() {
  const t = useT();
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.title} large />
      <h2 className="px-5 pb-1 pt-2 text-sm font-medium text-muted">{t.reports.planning}</h2>
      <Group>
        <Row icon={<Home className="size-4" />} title={t.reports.dashboard} to="/reports/dashboard" chevron />
        <Hairline />
        <Row icon={<Building2 className="size-4" />} title={t.reports.living} to="/reports/living" chevron />
        <Hairline />
        <Row icon={<Plane className="size-4" />} title={t.reports.travel} to="/reports/travel" chevron />
        <Hairline />
        <Row icon={<Wallet className="size-4" />} title={t.reports.cashflow} to="/reports/cashflow" chevron />
        <Hairline />
        <Row icon={<Umbrella className="size-4" />} title={t.reports.retirement} to="/reports/retirement" chevron />
      </Group>
      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.reports.history}</h2>
      <Group>
        <Row icon={<PieChart className="size-4" />} title={t.reports.spending} to="/reports/spending" chevron />
        <Hairline />
        <Row icon={<TrendingUp className="size-4" />} title={t.reports.incomeExpense} to="/reports/spending" chevron />
        <Hairline />
        <Row icon={<LineChart className="size-4" />} title={t.reports.netWorth} to="/reports/history" chevron />
      </Group>
    </div>
  );
}

function usePlanning() {
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const mortgage = useApp((s) => s.mortgage);
  const retirement = useApp((s) => s.retirement);
  const allowances = useApp((s) => s.allowances);
  const oneOffs = useApp((s) => s.oneOffs);
  const recurring = useApp((s) => s.recurring);
  const categories = useApp((s) => s.categories);
  const txs = useApp((s) => s.transactions);
  const trips = useApp((s) => s.trips);
  const annual = useApp((s) => s.annualTravelBudget);
  const snapshots = useApp((s) => s.snapshots);
  const housing =
    (mortgage?.monthlyPayment ?? 0) +
    recurring.filter((r) => r.categoryId === "mgmt" || r.categoryId === "rates").reduce((s, r) => s + r.amount, 0);
  const essential = livingEssentials(recurring);
  const travelIds = new Set(categories.filter((c) => c.theme === "travel").map((c) => c.id));
  const ytd = travelSpendYtd(txs, new Date().getFullYear(), travelIds, rates);
  const milesAcc = accounts.find((a) => a.type === "miles");
  const next = [...trips].sort((a, b) => a.start.localeCompare(b.start))[0];
  const retInputs = retirement ?? {
    id: "base",
    currentAge: 38,
    retireAge: 60,
    deathAge: 90,
    monthlyIncomeNow: 0,
    monthlySpendNow: 0,
    targetMonthly: 0,
    preReturn: 0.05,
    postReturn: 0.035,
    inflation: 0.025,
    travelInRetirement: 0,
  };
  const payoffAge =
    mortgage && retirement
      ? Math.round(retirement.currentAge + mortgage.remainingMonths / 12)
      : retInputs.currentAge;
  const saving12 = savingsLast12Months(txs, rates, todayISO());
  const incomeMonthly = saving12.income / 12;
  const expenseMonthly = saving12.expense / 12;
  const monthlySaving = Math.max(0, saving12.monthly);
  const ctx = {
    investableNow: investableNow(accounts, rates),
    mortgageMonthly: mortgage?.monthlyPayment ?? 0,
    mortgagePayoffAge: payoffAge,
    housingAfterPayoff: recurring.find((r) => r.categoryId === "mgmt")?.amount ?? 0,
    allowances,
    oneOffs,
    monthlySaving,
  };
  const probed = runRetirement(
    { ...retInputs, monthlyIncomeNow: incomeMonthly, monthlySpendNow: expenseMonthly },
    ctx,
  );
  return {
    accounts,
    rates,
    mortgage,
    retirement: { ...retInputs, monthlyIncomeNow: incomeMonthly, monthlySpendNow: expenseMonthly },
    result: probed,
    saving12,
    monthlySaving,
    incomeMonthly,
    expenseMonthly,
    allowances,
    oneOffs,
    recurring,
    categories,
    txs,
    trips,
    annual,
    snapshots,
    housing,
    essential,
    ytd,
    milesAcc,
    next,
    payoffAge,
  };
}

export function LifeDashboard() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const p = usePlanning();
  const next = p.next;
  const progress = next ? tripProgress(next, todayISO()) : null;
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.dashboard} backTo="/reports" />
      <CardLink to="/reports/living">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t.dashboard.living}</h2>
          <StatusChip status="on-track" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Metric label={t.dashboard.housingCost} value={money(p.housing, "HKD")} />
          <Metric label={t.dashboard.essential} value={money(p.essential, "HKD")} />
          <Metric label={t.dashboard.mortgageLeft} value={money(p.mortgage?.outstanding ?? 0, "HKD")} />
          <Metric label={t.dashboard.effective} value={p.mortgage ? ratePct(effectiveRate(p.mortgage)) : "—"} />
        </div>
      </CardLink>
      <CardLink to="/reports/travel">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t.dashboard.travel}</h2>
          <StatusChip status={progress?.cashStatus ?? "on-track"} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Metric label={t.dashboard.ytd} value={`${money(p.ytd, "HKD")} / ${money(p.annual, "HKD")}`} />
          <Metric label={t.dashboard.milesBal} value={miles(p.milesAcc?.balance ?? 0, locale)} />
        </div>
        {next ? (
          <div className="mt-3 text-sm text-muted">
            {t.dashboard.nextTrip}: {pickName(locale, next.name, next.nameZh)}
          </div>
        ) : null}
      </CardLink>
      <CardLink to="/reports/retirement">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t.dashboard.retirement}</h2>
          <StatusChip status={p.result.status} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Metric label={t.dashboard.corpus} value={money(p.result.corpusAtRetire, "HKD", { compact: true })} />
          <Metric label={t.dashboard.sustainable} value={money(p.result.sustainableMonthly, "HKD")} />
          <Metric label={t.dashboard.target} value={money(p.retirement.targetMonthly, "HKD")} />
        </div>
      </CardLink>
      <Disclaimer>{t.retirement.disclaimer}</Disclaimer>
    </div>
  );
}

function CardLink({ to, children }: { to: "/reports/living" | "/reports/travel" | "/reports/retirement"; children: ReactNode }) {
  return (
    <Link to={to} className="mx-4 mt-3 block rounded-xl bg-elevated p-4">
      {children}
      <div className="mt-3 flex items-center justify-end text-muted">
        <ChevronRight className="size-4" />
      </div>
    </Link>
  );
}

export function HistoryReports() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const categories = useApp((s) => s.categories);
  const snapshots = useApp((s) => s.snapshots);
  const month = monthKey();
  const ie = lastMonthsFlow(txs, rates, month, 6, locale);
  const pieData = categorySpend(txs, rates, month, categories).map((s) => ({
    name: locale === "zh-HK" ? s.nameZh : s.name,
    value: s.value,
  }));
  const nw = [...snapshots]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((s) => ({ month: s.month, value: s.net }));
  const tooltip = {
    background: "var(--elevated)",
    border: "1px solid var(--border)",
    borderRadius: 12,
  };
  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.history} backTo="/reports" />
      <h2 className="px-5 pt-2 text-sm font-medium text-muted">{t.reports.incomeExpense}</h2>
      <div className="h-52 px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ie}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltip} formatter={(v) => money(Number(v), "HKD")} />
            <Bar dataKey="income" fill="var(--income)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="var(--expense)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <h2 className="px-5 pt-2 text-sm font-medium text-muted">{t.reports.spending}</h2>
      <div className="h-52 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPie>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
              {pieData.map((row, i) => (
                <Cell key={row.name} fill={pieColors[i % pieColors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltip} formatter={(v) => money(Number(v), "HKD")} />
          </RechartsPie>
        </ResponsiveContainer>
      </div>
      <div className="px-5 text-xs text-muted">
        {pieData.slice(0, 4).map((p) => (
          <div key={p.name} className="flex justify-between py-1">
            <span>{p.name}</span>
            <span className="tabular-nums">{money(p.value, "HKD")}</span>
          </div>
        ))}
      </div>
      <h2 className="px-5 pt-4 text-sm font-medium text-muted">{t.reports.netWorth}</h2>
      <div className="h-48 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={nw}>
            <defs>
              <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" hide />
            <Tooltip contentStyle={tooltip} formatter={(v) => money(Number(v), "HKD")} />
            <Area type="monotone" dataKey="value" stroke="var(--accent)" fill="url(#nw)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <Disclaimer>{locale === "zh-HK" ? "轉帳不計入收支。" : "Transfers are excluded from income and spending."}</Disclaimer>
    </div>
  );
}

export function SpendingScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const categories = useApp((s) => s.categories);
  const today = todayISO();
  const year = today.slice(0, 4);
  const [preset, setPreset] = useState<RangePreset>("thisYear");
  const [customFrom, setCustomFrom] = useState(`${year}-01-01`);
  const [customTo, setCustomTo] = useState(`${year}-12-31`);
  const [kind, setKind] = useState<"expense" | "income" | "both">("expense");
  const [chart, setChart] = useState<"pie" | "bars">("pie");
  const [groupParent, setGroupParent] = useState(true);
  const range = useMemo(
    () => presetRange(preset, today, txs, { from: customFrom, to: customTo }),
    [preset, today, txs, customFrom, customTo],
  );
  const flow = useMemo(() => rangeFlow(txs, rates, range.from, range.to), [txs, rates, range]);
  const catRows = useMemo(() => {
    if (kind === "both") return [];
    const rows = rangeCategorySpend(txs, rates, categories, range.from, range.to, kind);
    return groupParent ? groupSpendByParent(rows, categories) : rows;
  }, [txs, rates, categories, range, kind, groupParent]);
  const pieRows = useMemo(
    () =>
      groupParent
        ? catRows
        : withOtherCategory(catRows, { name: t.reports.other, nameZh: t.reports.other }, 12),
    [catRows, groupParent, t.reports.other],
  );
  const total = kind === "income" ? flow.income : flow.expense;
  const pieData = pieRows.map((s) => ({
    name: locale === "zh-HK" ? s.nameZh : s.name,
    value: s.value,
  }));
  const maxCat = catRows[0]?.value || 1;
  const maxFlow = Math.max(flow.income, flow.expense, 1);
  const presets: { id: RangePreset; label: string }[] = [
    { id: "thisMonth", label: t.reports.thisMonth },
    { id: "lastMonth", label: t.reports.lastMonth },
    { id: "thisYear", label: t.reports.thisYear },
    { id: "lastYear", label: t.reports.lastYear },
    { id: "allTime", label: t.reports.allTime },
    { id: "custom", label: t.reports.custom },
  ];
  return (
    <div className="pb-10">
      <ScreenHeader
        title={kind === "both" ? t.reports.both : kind === "income" ? t.reports.income : t.reports.expenses}
        backTo="/reports"
        right={
          kind === "both" ? null : (
            <button
              type="button"
              aria-label={chart === "pie" ? t.reports.bars : t.reports.pie}
              onClick={() => setChart(chart === "pie" ? "bars" : "pie")}
              className="grid size-11 place-items-center text-accent"
            >
              {chart === "pie" ? <BarChart3 className="size-5" /> : <PieChart className="size-5" />}
            </button>
          )
        }
      />
      <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
        <div className="grid grid-cols-2 divide-x divide-line">
          <label className="px-4 py-3">
            <span className="block text-[11px] text-muted">{t.reports.start}</span>
            <input
              type="date"
              value={range.from}
              onChange={(e) => {
                setPreset("custom");
                setCustomFrom(e.target.value);
              }}
              className="mt-0.5 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="px-4 py-3">
            <span className="block text-[11px] text-muted">{t.reports.end}</span>
            <input
              type="date"
              value={range.to}
              onChange={(e) => {
                setPreset("custom");
                setCustomTo(e.target.value);
              }}
              className="mt-0.5 w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 px-4">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-medium",
              preset === p.id ? "bg-accent text-on-accent" : "bg-elevated text-muted",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-3 px-4">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-line p-0.5">
          {(
            [
              ["expense", t.reports.expenses],
              ["income", t.reports.income],
              ["both", t.reports.both],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={cn(
                "h-9 rounded-md text-sm",
                kind === id ? "bg-elevated font-medium text-foreground shadow-sm" : "text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {kind !== "both" ? (
        <div className="mt-3 px-4">
          <button
            type="button"
            onClick={() => setGroupParent((v) => !v)}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-medium",
              groupParent ? "bg-accent text-on-accent" : "bg-elevated text-muted",
            )}
          >
            {t.reports.groupParent}
          </button>
        </div>
      ) : null}
      {kind === "both" ? (
        <div className="mt-5 space-y-3 px-4">
          <FlowBar label={t.reports.income} amount={flow.income} max={maxFlow} tone="bg-income" />
          <FlowBar label={t.reports.expenses} amount={flow.expense} max={maxFlow} tone="bg-expense" />
        </div>
      ) : catRows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted">{t.reports.noData}</p>
      ) : chart === "pie" ? (
        <>
          <div className="relative mx-auto h-64 w-full max-w-sm">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={1.5}
                  stroke="none"
                  label={sliceLabel}
                  labelLine={false}
                >
                  {pieData.map((row, i) => (
                    <Cell key={row.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </RechartsPie>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="text-sm font-semibold tabular-nums">{money(total, "HKD")}</div>
                <div className="text-[11px] text-muted">{kind === "income" ? t.reports.income : t.reports.expenses}</div>
              </div>
            </div>
          </div>
          <div className="px-5 pb-4">
            {pieRows.map((row, i) => (
              <div key={row.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span
                  className="size-3 shrink-0 rounded-sm"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate">{locale === "zh-HK" ? row.nameZh : row.name}</span>
                <span className="tabular-nums text-muted">{money(row.value, "HKD")}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 space-y-2 px-4">
          {catRows.map((row, i) => {
            const pct = Math.max(12, (row.value / maxCat) * 100);
            return (
              <div
                key={row.id}
                className="overflow-hidden rounded-md"
                style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
              >
                <div className="px-3 py-2 text-on-accent">
                  <div className="truncate text-sm font-medium">{locale === "zh-HK" ? row.nameZh : row.name}</div>
                  <div className="text-xs tabular-nums">{money(row.value, "HKD")}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Disclaimer>{locale === "zh-HK" ? "轉帳不計入收支。" : "Transfers are excluded from income and spending."}</Disclaimer>
    </div>
  );
}

function FlowBar({ label, amount, max, tone }: { label: string; amount: number; max: number; tone: string }) {
  const pct = Math.max(22, (amount / max) * 100);
  return (
    <div className={cn("overflow-hidden rounded-md", tone)} style={{ width: `${pct}%` }}>
      <div className="px-3 py-3 text-on-accent">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm tabular-nums">{money(amount, "HKD")}</div>
      </div>
    </div>
  );
}

function sliceLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
  if (percent < 0.04) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const rad = (-midAngle * Math.PI) / 180;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);
  return (
    <text
      x={x}
      y={y}
      fill="var(--on-accent)"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

export function LivingScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const p = usePlanning();
  const m = p.mortgage;
  const accounts = useApp((s) => s.accounts);
  const rate = m ? effectiveRate(m) : 0;
  const today = todayISO();
  const payDay = m ? paymentDayOf(m.endDate) : 1;
  const endIso = m
    ? (normalizeEndDate(m.endDate, payDay) ?? endDateFromRemaining(m.remainingMonths, new Date(), payDay))
    : undefined;
  const remaining = m && endIso ? remainingPayments(endIso, today, payDay) : m?.remainingMonths ?? 0;
  const firstDue = m ? nextPaymentIso(payDay, today) : "";
  const interestLeft = m ? remainingInterest(m.outstanding, rate, remaining, m.monthlyPayment) : 0;
  const amort = m ? amortize(m.outstanding, rate, remaining, 12, m.monthlyPayment, firstDue) : [];
  const shocks = m ? [0.5, 1, 2].map((s) => stress(m, s)) : [];
  const [edit, setEdit] = useState(false);
  const property =
    accounts.find((a) => a.id === m?.propertyAccountId) ?? accounts.find((a) => a.type === "property");
  const livingRows = monthlyExpenseRegulars(p.recurring).filter((r) => r.living);
  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.living.title}
        backTo="/reports"
        right={
          <span className="flex items-center">
            <InfoButton k="mortgage" />
            <button type="button" className="px-2 text-sm font-medium text-accent" onClick={() => setEdit(true)}>
              {t.living.edit}
            </button>
          </span>
        }
      />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="text-xs text-muted">{t.living.mode}</div>
        <div className="mt-1 text-base font-medium">{t.living.ownerMortgage}</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Metric label={t.dashboard.housingCost} value={money(p.housing, "HKD")} />
          <Metric label={t.dashboard.essential} value={money(p.essential, "HKD")} />
        </div>
        {livingRows.length ? (
          <div className="mt-3 border-t border-line pt-2">
            {livingRows.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-1 text-sm">
                <span className="min-w-0 truncate">{pickName(locale, r.label, r.labelZh)}</span>
                <span className="tabular-nums">{money(r.amount, r.currency)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-faint">{t.budget.livingRegularHint}</p>
        )}
      </div>
      {m ? (
        <>
          <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.living.mortgage}</h2>
          <div className="mx-4 rounded-xl bg-elevated p-4 text-sm">
            <Line k={t.living.linkProperty} v={property ? pickName(locale, property.name, property.nameZh) : "—"} />
            <Line k={t.living.propertyValue} v={money(property?.balance ?? 0, "HKD")} />
            <Line k={t.living.owed} v={money(m.outstanding, "HKD")} />
            <Line k={locale === "zh-HK" ? "貸款" : "Lender"} v={pickName(locale, m.lender, m.lenderZh)} />
            <Line k={t.living.currentRate} v={`${m.rateType} ${m.adjustment}%  →  ${ratePct(rate)}`} />
            <Line k={t.living.payment} v={money(m.monthlyPayment, "HKD")} />
            <Line k={t.living.endDate} v={endIso ?? "—"} />
            <Line
              k={t.living.remainingMonths}
              v={`${remaining} · ${Math.round(remaining / 12)} ${locale === "zh-HK" ? "年" : "years"}`}
            />
            <Line k={t.living.totalInterest} v={money(interestLeft, "HKD")} />
          </div>
          <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.living.stress}</h2>
          <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
            <div className="grid grid-cols-3 px-4 py-2 text-[11px] text-muted">
              <span>{t.living.shock}</span>
              <span>{t.living.newPay}</span>
              <span>{t.living.extraInterest}</span>
            </div>
            {shocks.map((s) => (
              <div key={s.shock} className="grid grid-cols-3 border-t border-line px-4 py-2 text-sm tabular-nums">
                <span>+{s.shock.toFixed(1)}%</span>
                <span>{money(s.payment, "HKD")}</span>
                <span>{money(s.extraInterest, "HKD")}</span>
              </div>
            ))}
          </div>
          <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.living.amort}</h2>
          <div className="mx-4 overflow-x-auto rounded-xl bg-elevated">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.add.date}</th>
                  <th className="px-3 py-2 font-medium">{t.living.payment}</th>
                  <th className="px-3 py-2 font-medium">{t.living.interest}</th>
                  <th className="px-3 py-2 font-medium">{t.living.principal}</th>
                  <th className="px-3 py-2 font-medium">{t.living.closing}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {amort.map((r) => (
                    <tr key={r.monthIndex} className="border-t border-line">
                      <td className="px-3 py-2">{r.due || r.monthIndex}</td>
                      <td className="px-3 py-2">{money(r.pay, "HKD")}</td>
                      <td className="px-3 py-2">{money(r.interest, "HKD")}</td>
                      <td className="px-3 py-2">{money(r.principal, "HKD")}</td>
                      <td className="px-3 py-2">{money(r.close, "HKD")}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="px-5 py-8">
          <p className="text-sm text-muted">{t.living.noMortgage}</p>
          <button
            type="button"
            className="mt-4 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
            onClick={() => setEdit(true)}
          >
            {t.living.edit}
          </button>
        </div>
      )}
      <Disclaimer>{t.living.disclaimer}</Disclaimer>
      <MortgageEditor open={edit} onClose={() => setEdit(false)} />
    </div>
  );
}

function MortgageEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const mortgage = useApp((s) => s.mortgage);
  return (
    <Overlay open={open} onClose={onClose} title={t.living.edit}>
      {open ? <MortgageEditorBody key={mortgage?.id ?? "new"} onClose={onClose} /> : null}
    </Overlay>
  );
}

function MortgageEditorBody({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const mortgage = useApp((s) => s.mortgage);
  const updateMortgage = useApp((s) => s.updateMortgage);
  const updateAccount = useApp((s) => s.updateAccount);
  const properties = accounts.filter((a) => a.type === "property");
  const loans = accounts.filter((a) => a.type === "mortgage" || a.type === "loan");
  const [propertyId, setPropertyId] = useState(mortgage?.propertyAccountId ?? properties[0]?.id ?? "");
  const property = accounts.find((a) => a.id === propertyId);
  const [value, setValue] = useState(String(property?.balance ?? 0));
  const [owed, setOwed] = useState(String(mortgage?.outstanding ?? 0));
  const [rate, setRate] = useState(String(mortgage ? effectiveRate(mortgage) : 2.1));
  const [payment, setPayment] = useState(String(mortgage?.monthlyPayment ?? 0));
  const [end, setEnd] = useState(
    normalizeEndDate(mortgage?.endDate, paymentDayOf(mortgage?.endDate)) ??
      endDateFromRemaining(mortgage?.remainingMonths ?? 216),
  );
  const [lender, setLender] = useState(mortgage ? pickName(locale, mortgage.lender, mortgage.lenderZh) : "");
  const [loanId, setLoanId] = useState(mortgage?.accountId ?? loans[0]?.id ?? "");
  return (
    <div className="px-5 pb-8">
      <label className="block py-2">
        <span className="text-xs text-muted">{t.living.linkProperty}</span>
        <select
          value={propertyId}
          onChange={(e) => {
            setPropertyId(e.target.value);
            const a = accounts.find((x) => x.id === e.target.value);
            if (a) setValue(String(a.balance));
          }}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        >
          {properties.map((a) => (
            <option key={a.id} value={a.id}>
              {pickName(locale, a.name, a.nameZh)}
            </option>
          ))}
        </select>
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.living.propertyValue}</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.living.owed}</span>
        <input
          inputMode="decimal"
          value={owed}
          onChange={(e) => setOwed(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.living.currentRate}</span>
        <input
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.living.payment}</span>
        <input
          inputMode="decimal"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.living.endDate}</span>
        <input
          type="date"
          value={end.length >= 10 ? end : `${end}-01`}
          onChange={(e) => setEnd(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{locale === "zh-HK" ? "貸款" : "Lender"}</span>
        <input
          value={lender}
          onChange={(e) => setLender(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      {loans.length ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.assets.mortgage}</span>
          <select
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          >
            {loans.map((a) => (
              <option key={a.id} value={a.id}>
                {pickName(locale, a.name, a.nameZh)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        onClick={async () => {
          const outstanding = Math.abs(Number(owed) || 0);
          const remaining = monthsUntil(end);
          const eff = Number(rate) || 0;
          const rateType = mortgage?.rateType ?? "fixed";
          const benchmark = mortgage?.benchmark ?? eff;
          const next: Mortgage = {
            id: mortgage?.id ?? "imported-mortgage",
            accountId: loanId || mortgage?.accountId || "mortgage",
            propertyAccountId: propertyId || undefined,
            lender: lender.trim() || "Bank",
            lenderZh: lender.trim() || "銀行",
            original: mortgage?.original ?? outstanding,
            outstanding,
            remainingMonths: remaining || mortgage?.remainingMonths || 1,
            endDate: end,
            rateType,
            benchmark,
            adjustment: rateType === "fixed" ? 0 : Math.round((eff - benchmark) * 1e4) / 1e4,
            effectiveRate: eff,
            monthlyPayment: Number(payment) || 0,
            nextReprice: mortgage?.nextReprice,
            paymentAccountId: mortgage?.paymentAccountId ?? "",
          };
          const prop = accounts.find((a) => a.id === propertyId);
          if (prop) await updateAccount({ ...prop, balance: Number(value) || 0 });
          await updateMortgage(next);
          toast(t.add.savedToast);
          onClose();
        }}
      >
        {t.add.save}
      </button>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}

export function TravelScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const p = usePlanning();
  const setAdd = useUi((s) => s.setAddTripOpen);
  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.travel.title}
        backTo="/reports"
        right={
          <span className="flex items-center">
            <InfoButton k="trip" />
            <button
              type="button"
              aria-label={t.travel.addTrip}
              onClick={() => setAdd(true)}
              className="grid size-11 place-items-center"
            >
              <Plus className="size-5" />
            </button>
          </span>
        }
      />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="text-xs text-muted">{t.travel.annual}</div>
        <div className="mt-1 text-xl font-semibold tabular-nums">
          {money(p.ytd, "HKD")}
          <span className="ml-2 text-sm font-normal text-muted">/ {money(p.annual, "HKD")}</span>
        </div>
        <div className="mt-3 text-sm text-muted">
          {t.travel.miles}: {miles(p.milesAcc?.balance ?? 0, locale)}
        </div>
        <p className="mt-2 text-xs text-faint">{t.travel.noValue}</p>
        <p className="mt-1 text-xs text-faint">{t.travel.validUntil}</p>
      </div>
      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.travel.trips}</h2>
      {p.trips.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">{t.travel.addTrip}</p>
      ) : null}
      {p.trips
        .filter((trip) => isTripActive(trip, todayISO()))
        .map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      {p.trips.some((trip) => isTripExpired(trip, todayISO())) ? (
        <>
          <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.travel.expired}</h2>
          {p.trips
            .filter((trip) => isTripExpired(trip, todayISO()))
            .map((trip) => (
              <TripCard key={trip.id} trip={trip} expired />
            ))}
        </>
      ) : null}
      <AddTripOverlay />
    </div>
  );
}

function TripCard({ trip, expired }: { trip: Trip; expired?: boolean }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const p = usePlanning();
  const remove = useApp((s) => s.deleteTrip);
  const spent = tripCashSpent(p.txs, p.rates, trip.id);
  const prog = tripProgress(trip, todayISO(), spent);
  const ended = Boolean(trip.end && trip.end < todayISO());
  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-xl bg-elevated">
      <Link to="/reports/travel/$id" params={{ id: trip.id }} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">{pickName(locale, trip.name, trip.nameZh)}</div>
            <div className="text-xs text-muted">
              {pickName(locale, trip.destinations, trip.destinationsZh)}
              {" · "}
              {trip.start}
              {trip.end ? ` → ${trip.end}` : ""}
            </div>
          </div>
          {expired ? (
            <span className="shrink-0 rounded-full bg-pill-expense px-2 py-1 text-xs font-medium text-expense">
              {t.travel.expired}
            </span>
          ) : ended ? (
            <span className="shrink-0 rounded-full bg-elevated px-2 py-1 text-xs font-medium text-muted ring-1 ring-line">
              {t.travel.ended}
            </span>
          ) : (
            <StatusChip status={prog.cashStatus} />
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted">{t.travel.spent}</div>
            <div className="tabular-nums">
              {money(prog.spent, "HKD")} / {money(trip.cashBudget, "HKD")}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.travel.usedPct}</div>
            <div className="tabular-nums">{pct(prog.usedRatio)}</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ring-track">
          <div
            className={cn(
              "h-full rounded-full",
              prog.usedRatio >= 1.1 ? "bg-expense" : prog.usedRatio >= 1 ? "bg-watch" : "bg-income",
            )}
            style={{ width: `${Math.min(100, prog.usedRatio * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-muted">
          {t.travel.miles}: {miles(trip.milesSaved, locale)} / {miles(trip.milesTarget, locale)}
        </div>
      </Link>
      {expired ? (
        <button
          type="button"
          className="w-full border-t border-line py-3 text-sm font-medium text-expense"
          onClick={() => void remove(trip.id).then(() => toast(t.travel.removeTrip))}
        >
          {t.travel.removeTrip}
        </button>
      ) : null}
    </div>
  );
}

function AddTripOverlay() {
  const t = useT();
  const open = useUi((s) => s.addTripOpen);
  const setOpen = useUi((s) => s.setAddTripOpen);
  const add = useApp((s) => s.addTrip);
  const [name, setName] = useState("");
  const [dest, setDest] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [cash, setCash] = useState("0");
  const [milesTarget, setMiles] = useState("0");
  return (
    <Overlay open={open} onClose={() => setOpen(false)} title={t.travel.addTrip}>
      <div className="px-5 pb-8">
        <label className="block py-2">
          <span className="text-xs text-muted">{t.assets.name}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.travel.title}</span>
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.travel.start}</span>
          <input
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (end && e.target.value && end < e.target.value) setEnd(e.target.value);
            }}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.travel.end}</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.travel.cash}</span>
          <input
            inputMode="decimal"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.travel.miles}</span>
          <input
            inputMode="numeric"
            value={milesTarget}
            onChange={(e) => setMiles(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
        </label>
        <button
          type="button"
          className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
          onClick={async () => {
            if (!name.trim() || !start || !end) return;
            const from = start <= end ? start : end;
            const to = start <= end ? end : start;
            await add({
              id: newId(),
              name: name.trim(),
              nameZh: name.trim(),
              destinations: dest.trim(),
              destinationsZh: dest.trim(),
              start: from,
              end: to,
              status: "planning",
              cashBudget: Number(cash) || 0,
              cashSaved: 0,
              milesTarget: Number(milesTarget) || 0,
              milesSaved: 0,
              monthlyCash: 0,
              monthlyMiles: 0,
            });
            toast(t.add.savedToast);
            setName("");
            setDest("");
            setStart("");
            setEnd("");
            setCash("0");
            setMiles("0");
            setOpen(false);
          }}
        >
          {t.add.save}
        </button>
      </div>
    </Overlay>
  );
}

export function TripDetail({ id }: { id: string }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const nav = useNavigate();
  const setTx = useUi((s) => s.setTxDetailId);
  const trips = useApp((s) => s.trips);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const updateTrip = useApp((s) => s.updateTrip);
  const deleteTrip = useApp((s) => s.deleteTrip);
  const [edit, setEdit] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const trip = trips.find((x) => x.id === id);
  if (!trip) return <ScreenHeader title={t.travel.title} backTo="/reports/travel" />;
  const spent = tripCashSpent(txs, rates, trip.id);
  const prog = tripProgress(trip, todayISO(), spent);
  const linked = txs.filter((x) => x.tripId === trip.id && x.type === "expense");
  const expired = isTripExpired(trip, todayISO());
  return (
    <div className="pb-10">
      <ScreenHeader
        title={pickName(locale, trip.name, trip.nameZh)}
        backTo="/reports/travel"
        right={
          <button type="button" className="px-2 text-sm font-medium text-accent" onClick={() => setEdit(true)}>
            {t.travel.editTrip}
          </button>
        }
      />
      {expired ? (
        <p className="px-5 pb-2 text-xs text-muted">{t.travel.expired}</p>
      ) : null}
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="text-sm text-muted">{pickName(locale, trip.destinations, trip.destinationsZh)}</div>
        <div className="mt-1 text-sm">
          {trip.start}
          {trip.end ? ` → ${trip.end}` : ""}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Metric label={t.travel.cash} value={money(trip.cashBudget, "HKD")} />
          <Metric label={t.travel.spent} value={money(prog.spent, "HKD")} />
          <Metric label={t.travel.usedPct} value={pct(prog.usedRatio)} />
          <Metric label={t.travel.remaining} value={money(prog.cashLeft, "HKD")} />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ring-track">
          <div
            className={cn(
              "h-full rounded-full",
              prog.usedRatio >= 1.1 ? "bg-expense" : prog.usedRatio >= 1 ? "bg-watch" : "bg-income",
            )}
            style={{ width: `${Math.min(100, prog.usedRatio * 100)}%` }}
          />
        </div>
      </div>
      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.travel.linked}</h2>
      <Hairline />
      {linked.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">{t.travel.linked}</p>
      ) : (
        linked.map((tx, i) => (
          <div key={tx.id}>
            {i > 0 ? <Hairline /> : null}
            <TransactionRow tx={tx} showDate onClick={() => setTx(tx.id)} />
          </div>
        ))
      )}
      <Disclaimer>{t.travel.noValue}</Disclaimer>
      <div className="px-5 pt-2">
        <button
          type="button"
          className="h-12 w-full rounded-xl text-sm font-medium text-expense"
          onClick={() => setConfirmRemove(true)}
        >
          {t.travel.removeTrip}
        </button>
      </div>
      <Overlay open={confirmRemove} onClose={() => setConfirmRemove(false)} title={t.travel.removeTrip}>
        <div className="px-5 pb-8">
          <p className="text-sm text-muted">{t.travel.confirmRemove}</p>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-expense text-sm font-semibold text-on-accent"
            onClick={async () => {
              await deleteTrip(trip.id);
              toast(t.travel.removeTrip);
              void nav({ to: "/reports/travel" });
            }}
          >
            {t.travel.removeTrip}
          </button>
        </div>
      </Overlay>
      <Overlay open={edit} onClose={() => setEdit(false)} title={t.travel.editTrip}>
        <TripEditBody
          trip={trip}
          onClose={() => setEdit(false)}
          onSave={async (next) => {
            await updateTrip(next);
            toast(t.add.savedToast);
            setEdit(false);
          }}
        />
      </Overlay>
    </div>
  );
}

function TripEditBody({
  trip,
  onClose,
  onSave,
}: {
  trip: Trip;
  onClose: () => void;
  onSave: (t: Trip) => Promise<void>;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const [name, setName] = useState(pickName(locale, trip.name, trip.nameZh));
  const [dest, setDest] = useState(pickName(locale, trip.destinations, trip.destinationsZh));
  const [start, setStart] = useState(trip.start);
  const [end, setEnd] = useState(trip.end ?? trip.start);
  const [cash, setCash] = useState(String(trip.cashBudget));
  const [milesTarget, setMiles] = useState(String(trip.milesTarget));
  void onClose;
  return (
    <div className="px-5 pb-8">
      <label className="block py-2">
        <span className="text-xs text-muted">{t.assets.name}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.travel.title}</span>
        <input value={dest} onChange={(e) => setDest(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.travel.start}</span>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.travel.end}</span>
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.travel.cash}</span>
        <input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.travel.miles}</span>
        <input inputMode="numeric" value={milesTarget} onChange={(e) => setMiles(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
      </label>
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        onClick={async () => {
          const n = name.trim();
          if (!n || !start || !end) return;
          const from = start <= end ? start : end;
          const to = start <= end ? end : start;
          await onSave({
            ...trip,
            name: n,
            nameZh: n,
            destinations: dest.trim(),
            destinationsZh: dest.trim(),
            start: from,
            end: to,
            cashBudget: Number(cash) || 0,
            milesTarget: Number(milesTarget) || 0,
          });
        }}
      >
        {t.add.save}
      </button>
    </div>
  );
}

export function CashflowScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const recurring = useApp((s) => s.recurring);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const data = forecastFromRecurring(recurring, monthKey(), 6, locale, txs, rates);
  const tooltip = {
    background: "var(--elevated)",
    border: "1px solid var(--border)",
    borderRadius: 12,
  };
  return (
    <div className="pb-10">
      <ScreenHeader title={t.cashflow.title} backTo="/reports" />
      <p className="px-5 text-xs text-muted">{t.cashflow.fromRecurring}</p>
      <div className="h-52 px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltip} formatter={(v) => money(Number(v), "HKD")} />
            <Bar dataKey="inflow" fill="var(--income)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="outflow" fill="var(--expense)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
        {data.map((r) => (
          <div key={r.month} className="grid grid-cols-4 border-b border-line px-4 py-2 text-sm last:border-0">
            <span>{r.month}</span>
            <span className="tabular-nums text-income">{money(r.inflow, "HKD")}</span>
            <span className="tabular-nums text-expense">{money(r.outflow, "HKD")}</span>
            <span className={cn("tabular-nums", r.inflow - r.outflow >= 0 ? "text-income" : "text-expense")}>
              {money(r.inflow - r.outflow, "HKD", { sign: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RetirementScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const p = usePlanning();
  const update = useApp((s) => s.updateRetirement);
  const addAllowance = useApp((s) => s.addAllowance);
  const updateAllowance = useApp((s) => s.updateAllowance);
  const deleteAllowance = useApp((s) => s.deleteAllowance);
  const r = p.retirement;
  const result = p.result;
  const series = result.series.map((pt) => ({ age: pt.age, assets: pt.assets / 1e6 }));
  const oaa = p.allowances.find((a) => a.id === "oaa" || a.kind === "oaa");
  const annuities = p.allowances.filter((a) => a.id !== "oaa" && a.kind !== "oaa");
  const [annuityOpen, setAnnuityOpen] = useState(false);
  const [editingAnnuity, setEditingAnnuity] = useState<Allowance | null>(null);
  async function patch(partial: Partial<typeof r>) {
    await update({ ...r, ...partial });
  }
  async function toggleOaa() {
    if (oaa) await deleteAllowance(oaa.id);
    else {
      await addAllowance({
        id: "oaa",
        label: "Old Age Allowance",
        labelZh: "生果金",
        monthly: 1620,
        startAge: 70,
        kind: "oaa",
        inflationAdjusted: true,
      });
    }
  }
  const tooltip = {
    background: "var(--elevated)",
    border: "1px solid var(--border)",
    borderRadius: 12,
  };
  return (
    <div className="pb-10">
      <ScreenHeader title={t.retirement.title} backTo="/reports" right={<InfoButton k="retirement" />} />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t.retirement.outputs}</h2>
          <StatusChip status={result.status} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Metric label={t.retirement.corpus} value={money(result.corpusAtRetire, "HKD")} />
          <Metric label={t.retirement.required} value={money(result.requiredCorpus, "HKD")} />
          <Metric label={t.retirement.spendAfter} value={money(r.targetMonthly, "HKD")} />
          <Metric
            label={t.retirement.saveNeeded}
            value={money(result.extraMonthlySaving, "HKD")}
            tone={result.extraMonthlySaving > 0 ? "expense" : "income"}
          />
          <Metric
            label={t.retirement.gap}
            value={money(result.gap, "HKD", { sign: true })}
            tone={result.gap >= 0 ? "income" : "expense"}
          />
          <Metric label={t.retirement.saving12m} value={money(p.monthlySaving, "HKD")} />
        </div>
        <p className="mt-3 text-xs text-muted">{t.retirement.noSalary}</p>
        <p className="mt-1 text-xs text-muted">{t.retirement.saveNeededHint}</p>
      </div>
      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.retirement.chart}</h2>
      <div className="h-52 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series}>
            <XAxis dataKey="age" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltip} formatter={(v) => `HK$${Number(v).toFixed(2)}M`} />
            <Area
              type="monotone"
              dataKey="assets"
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <h2 className="px-5 pb-1 pt-4 text-sm font-medium text-muted">{t.retirement.timeline}</h2>
      <div className="mx-4 rounded-xl bg-elevated p-4 text-sm">
        <NumLine k={t.retirement.now} v={r.currentAge} onChange={(n) => void patch({ currentAge: n })} />
        <NumLine k={t.retirement.retire} v={r.retireAge} onChange={(n) => void patch({ retireAge: n })} />
        <NumLine k={t.retirement.death} v={r.deathAge} onChange={(n) => void patch({ deathAge: n })} />
      </div>
      <h2 className="px-5 pb-1 pt-4 text-sm font-medium text-muted">{t.retirement.lifestyle}</h2>
      <div className="mx-4 rounded-xl bg-elevated p-4 text-sm">
        <ReadOnlyMoney k={t.retirement.incomeNow} v={p.incomeMonthly} hint={t.retirement.from12m} />
        <ReadOnlyMoney k={t.retirement.spendNow} v={p.expenseMonthly} hint={t.retirement.from12m} />
        <NumLine k={t.retirement.spendAfter} v={r.targetMonthly} onChange={(n) => void patch({ targetMonthly: n })} />
      </div>
      <p className="px-5 pt-2 text-xs text-muted">{t.retirement.targetHint}</p>

      <h2 className="px-5 pb-1 pt-4 text-sm font-medium text-muted">{t.retirement.hkIncome}</h2>
      <div className="mx-4 rounded-xl bg-elevated">
        <button type="button" onClick={() => void toggleOaa()} className="flex w-full items-start gap-3 px-4 py-3 text-left">
          <span
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded border",
              oaa ? "border-accent bg-accent text-on-accent" : "border-line bg-background",
            )}
            aria-hidden
          >
            {oaa ? "✓" : ""}
          </span>
          <span>
            <span className="block text-sm font-medium">{t.retirement.oaa}</span>
            <span className="mt-0.5 block text-xs text-muted">{t.retirement.oaaHint}</span>
            {oaa ? (
              <span className="mt-1 block text-xs tabular-nums text-foreground">
                {money(oaa.monthly, "HKD")} · {t.retirement.startAge} {oaa.startAge}
              </span>
            ) : null}
          </span>
        </button>
        {oaa ? (
          <div className="border-t border-line px-4 py-2 text-sm">
            <NumLine
              k={t.retirement.monthlyAmt}
              v={oaa.monthly}
              onChange={(n) => void updateAllowance({ ...oaa, monthly: n })}
            />
            <NumLine
              k={t.retirement.startAge}
              v={oaa.startAge}
              onChange={(n) => void updateAllowance({ ...oaa, startAge: n })}
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-5 pb-1 pt-4">
        <h2 className="text-sm font-medium text-muted">{t.retirement.annuities}</h2>
        <button
          type="button"
          className="text-sm font-medium text-accent"
          onClick={() => {
            setEditingAnnuity(null);
            setAnnuityOpen(true);
          }}
        >
          {t.retirement.addAnnuity}
        </button>
      </div>
      <p className="px-5 pb-2 text-xs text-faint">{t.retirement.annuityHint}</p>
      {annuities.length === 0 ? (
        <p className="px-5 py-3 text-sm text-muted">{t.retirement.addAnnuity}</p>
      ) : (
        <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
          {annuities.map((a) => (
            <button
              key={a.id}
              type="button"
              className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-left first:border-0"
              onClick={() => {
                setEditingAnnuity(a);
                setAnnuityOpen(true);
              }}
            >
              <span>
                <span className="block text-[15px] font-medium">{pickName(locale, a.label, a.labelZh)}</span>
                <span className="text-xs text-muted">
                  {money(a.monthly, "HKD")} · {a.startAge}
                  {a.endAge ? `–${a.endAge}` : "+"}
                </span>
              </span>
              <ChevronRight className="size-4 text-faint" />
            </button>
          ))}
        </div>
      )}

      <Disclaimer>{t.retirement.disclaimer}</Disclaimer>
      <AnnuityEditor
        open={annuityOpen}
        initial={editingAnnuity}
        retireAge={r.retireAge}
        deathAge={r.deathAge}
        onClose={() => {
          setAnnuityOpen(false);
          setEditingAnnuity(null);
        }}
        onSave={async (row) => {
          if (editingAnnuity) await updateAllowance(row);
          else await addAllowance(row);
          setAnnuityOpen(false);
          setEditingAnnuity(null);
          toast(t.add.savedToast);
        }}
        onDelete={
          editingAnnuity
            ? async () => {
                await deleteAllowance(editingAnnuity.id);
                setAnnuityOpen(false);
                setEditingAnnuity(null);
              }
            : undefined
        }
      />
    </div>
  );
}

function AnnuityEditor({
  open,
  initial,
  retireAge,
  deathAge,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial: Allowance | null;
  retireAge: number;
  deathAge: number;
  onClose: () => void;
  onSave: (a: Allowance) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const t = useT();
  return (
    <Overlay open={open} onClose={onClose} title={initial ? t.common.edit : t.retirement.addAnnuity}>
      {open ? (
        <AnnuityEditorBody
          key={initial?.id ?? "new"}
          initial={initial}
          retireAge={retireAge}
          deathAge={deathAge}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : null}
    </Overlay>
  );
}

function AnnuityEditorBody({
  initial,
  retireAge,
  deathAge,
  onSave,
  onDelete,
}: {
  initial: Allowance | null;
  retireAge: number;
  deathAge: number;
  onSave: (a: Allowance) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const [name, setName] = useState(initial ? pickName(locale, initial.label, initial.labelZh) : "");
  const [monthly, setMonthly] = useState(initial ? String(initial.monthly) : "");
  const [startAge, setStartAge] = useState(String(initial?.startAge ?? retireAge));
  const [endAge, setEndAge] = useState(String(initial?.endAge ?? deathAge));
  return (
    <div className="px-5 pb-8">
      <p className="text-xs text-muted">{t.retirement.annuityHint}</p>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.budget.regularName}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.retirement.monthlyAmt}</span>
        <input
          inputMode="decimal"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.retirement.startAge}</span>
        <input
          inputMode="numeric"
          value={startAge}
          onChange={(e) => setStartAge(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.retirement.endAge}</span>
        <input
          inputMode="numeric"
          value={endAge}
          onChange={(e) => setEndAge(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        onClick={async () => {
          const n = name.trim();
          if (!n) return;
          await onSave({
            id: initial?.id ?? `ann-${newId().slice(0, 8)}`,
            label: n,
            labelZh: n,
            monthly: Number(monthly) || 0,
            startAge: Number(startAge) || retireAge,
            endAge: Number(endAge) || undefined,
            kind: "annuity",
            inflationAdjusted: false,
          });
        }}
      >
        {t.add.save}
      </button>
      {initial && onDelete ? (
        <button
          type="button"
          className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-expense"
          onClick={() => void onDelete()}
        >
          {t.tx.delete}
        </button>
      ) : null}
    </div>
  );
}

function NumLine({ k, v, onChange }: { k: string; v: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between border-b border-line py-2 last:border-0">
      <span className="text-muted">{k}</span>
      <input
        inputMode="numeric"
        value={String(v)}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-24 bg-transparent text-right tabular-nums outline-none"
      />
    </label>
  );
}

function ReadOnlyMoney({ k, v, hint }: { k: string; v: number; hint?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2 last:border-0">
      <span>
        <span className="block text-muted">{k}</span>
        {hint ? <span className="mt-0.5 block text-[11px] text-faint">{hint}</span> : null}
      </span>
      <span className="tabular-nums">{money(v, "HKD")}</span>
    </div>
  );
}


