import { ChevronLeft, ChevronRight, ChevronDown, Plus, Search, Wallet } from "lucide-react";
import { Hairline, InfoButton, ProgressRing, SectionLabel, TransactionRow } from "@/components/shared";
import { AmountWithHkd } from "@/components/currency-field";
import { longDate, money, monthGrid, monthTitle, shiftMonth, todayISO, weekdayLabels } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { activityDates, plannedIso, monthStats } from "@/lib/derived";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import { chargedDayOf, chargedIso, forecastTone, regularSettledInMonth } from "@/lib/calc/budget";
import type { AdhocBudget, Locale, MoneyUnit, Recurring, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi, readSavedLocale } from "@/store/ui";
import { useEffect, useState } from "react";

export function TodayScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const selected = useUi((s) => s.selectedDate);
  const setSelected = useUi((s) => s.setSelectedDate);
  const openAdd = useUi((s) => s.openAdd);
  const setSearch = useUi((s) => s.setSearchOpen);
  const today = todayISO();
  const onThisMonth = selected.slice(0, 7) === today.slice(0, 7);

  useEffect(() => {
    const saved = readSavedLocale();
    if (saved !== locale) setLocale(saved);
  }, [locale, setLocale]);

  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col lg:min-h-dvh">
      <header className="px-4 pb-2 pt-[max(0.9rem,env(safe-area-inset-top))]">
        <div className="flex items-end justify-between gap-2">
          <h1 className="whitespace-nowrap text-3xl font-semibold tracking-tight">{monthTitle(selected, locale)}</h1>
          <div className="mb-0.5 flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setLocale(locale === "zh-HK" ? "en" : "zh-HK")}
              className="grid size-11 place-items-center text-sm font-medium text-accent"
              aria-label={t.more.language}
            >
              {locale === "zh-HK" ? "EN" : "中"}
            </button>
            <button type="button" aria-label={t.today.search} onClick={() => setSearch(true)} className="grid size-11 place-items-center">
              <Search className="size-6" strokeWidth={1.7} />
            </button>
            <button type="button" aria-label={t.add.title} onClick={() => openAdd("expense")} className="grid size-11 place-items-center">
              <Plus className="size-7" strokeWidth={1.7} />
            </button>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-center">
          <button type="button" aria-label={t.today.prevMonth} onClick={() => setSelected(shiftMonth(selected, -1))} className="grid size-11 place-items-center text-accent">
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => setSelected(today)}
            disabled={onThisMonth}
            className={cn("min-w-16 text-center text-sm font-medium", onThisMonth ? "text-faint" : "text-accent")}
          >
            {t.today.jumpToday}
          </button>
          <button type="button" aria-label={t.today.nextMonth} onClick={() => setSelected(shiftMonth(selected, 1))} className="grid size-11 place-items-center text-accent">
            <ChevronRight className="size-6" />
          </button>
        </div>
      </header>
      <TodayBody />
    </div>
  );
}

function TodayBody() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const selected = useUi((s) => s.selectedDate);
  const setSelected = useUi((s) => s.setSelectedDate);
  const firstDay = useUi((s) => s.firstDayOfWeek);
  const setTx = useUi((s) => s.setTxDetailId);
  const kid = useUi((s) => s.accessMode) === "kid";
  const transactions = useApp((s) => s.transactions);
  const budgets = useApp((s) => s.budgets);
  const categories = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const recurring = useApp((s) => s.recurring);
  const adhoc = useApp((s) => s.adhocBudgets);
  const targetMode = useApp((s) => s.budgetTargetMode);
  const stats = monthStats(transactions, budgets, categories, rates, selected, recurring, adhoc, targetMode);
  const cap = stats.actuals.find((b) => b.id === MONTH_TOTAL_BUDGET_ID) ?? stats.actuals.find((b) => !b.categoryId && !b.theme);
  const spentNow = stats.flow.expense;
  const expected = cap?.expected ?? spentNow;
  const target = cap?.monthly ?? 0;
  const today = todayISO();
  const onThisMonth = selected.slice(0, 7) === today.slice(0, 7);
  const ringTone = forecastTone(target > 0 ? spentNow / target : 0);
  const paid = transactions.filter((x) => x.date === selected && !x.planned && x.type !== "miles").sort((a, b) => b.id.localeCompare(a.id));
  const monthKey = selected.slice(0, 7);
  const schedule = monthSchedule({
    monthKey,
    today,
    recurring,
    adhoc,
    planned: transactions.filter((x) => x.planned && x.type !== "miles" && x.date.startsWith(monthKey) && !x.recurringId),
    posted: transactions,
    locale,
    regularLabel: t.budget.monthlyRegulars,
    adhocLabel: t.budget.adhoc,
    plannedLabel: locale === "zh-HK" ? "計劃" : "Planned",
  });
  const cells = monthGrid(selected, firstDay);
  const active = activityDates(transactions);
  const plannedDays = plannedIso(transactions);
  for (const row of schedule) plannedDays.add(row.iso);
  const weekdays = weekdayLabels(locale, firstDay);
  const [showSummary, setShowSummary] = useState(false);

  return (
    <div className="pb-10">
      <div className="mx-4 mb-4 rounded-xl bg-elevated px-2 py-3">
          <div className="grid grid-cols-7 text-center text-xs text-muted">
            {weekdays.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7">
            {cells.map((c, i) =>
              c ? (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => setSelected(c.iso)}
                  className={cn(
                    "relative mx-auto flex size-10 flex-col items-center justify-center rounded-full text-sm",
                    c.iso === selected && "bg-accent font-semibold text-on-accent",
                    c.iso === today && c.iso !== selected && "font-semibold text-accent",
                  )}
                >
                  {c.day}
                  {active.has(c.iso) ? (
                    <span className={cn("absolute bottom-1 size-1 rounded-full", c.iso === selected ? "bg-on-accent" : "bg-accent")} />
                  ) : plannedDays.has(c.iso) ? (
                    <span className={cn("absolute bottom-1 size-1.5 rounded-full border", c.iso === selected ? "border-on-accent" : "border-accent")} />
                  ) : null}
                </button>
              ) : (
                <div key={`e-${i}`} />
              ),
            )}
          </div>
        </div>

      {kid ? null : (
      <button
        type="button"
        className="mx-4 mb-2 flex w-[calc(100%-2rem)] items-center justify-center gap-1 text-xs font-medium text-accent"
        onClick={() => setShowSummary((v) => !v)}
      >
        {showSummary ? t.today.hideSummary : t.today.showSummary}
        <ChevronDown className={cn("size-3.5 transition", showSummary && "rotate-180")} />
      </button>
      )}
      {!kid && showSummary ? (
        <>
          <div className="mx-4 mb-4 rounded-xl bg-elevated px-4 py-1">
            <SummaryRow label={t.today.incomeMonth} value={money(stats.flow.income, "HKD")} tone="income" />
            <SummaryRow label={t.today.expenseMonth} value={money(stats.flow.expense, "HKD")} tone="expense" />
            <SummaryRow label={t.today.netMonth} value={money(stats.flow.net, "HKD", { sign: true })} tone={stats.flow.net >= 0 ? "income" : "expense"} />
          </div>
          {onThisMonth ? (
            <>
              <div className="mx-4 mb-2 rounded-xl bg-elevated px-4 py-1">
                <SummaryRow label={t.today.remainingBudget} value={money(stats.remainingBudget, "HKD")} />
                <SummaryRow label={t.today.remainingDisc} value={money(stats.remainingDisc, "HKD")} info="disc" />
              </div>
              <p className="px-5 pb-2 text-xs text-faint">{t.today.guidance}</p>
            </>
          ) : null}
        </>
      ) : null}
      {onThisMonth ? (
        <>
          <SectionLabel>{t.today.goals}</SectionLabel>
          <Hairline />
          <Link to="/budget" className="flex w-full items-center gap-3 px-5 py-3.5 text-left">
            <span className="relative">
              <ProgressRing value={target ? spentNow / target : 0} size={40} stroke={3} tone={ringTone} />
              <span className={cn("pointer-events-none absolute inset-0 grid place-items-center", ringTone === "expense" ? "text-expense" : ringTone === "watch" ? "text-watch" : "text-income")}>
                <Wallet className="size-3.5" />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t.today.expenseMonth}</span>
              <span className="text-xs text-muted">
                {t.budget.expectedMonth}: {money(expected, "HKD")}
                {target > 0 ? ` · ${t.budget.monthlyTotal} ${money(target, "HKD")}` : ""}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-lg font-semibold tabular-nums">{money(spentNow, "HKD")}</span>
            </span>
          </Link>
          <Hairline />
        </>
      ) : null}

      <SectionLabel>{t.today.dayTx}</SectionLabel>
      <Hairline />
      <p className="px-5 pt-2 text-xs text-muted">{longDate(selected, locale)}</p>
      {paid.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">{t.today.noTxDay}</p>
      ) : (
        <>
          {paid.map((tx, i) => (
            <div key={tx.id}>
              {i > 0 ? <Hairline /> : null}
              <TransactionRow tx={tx} onClick={() => setTx(tx.id)} />
            </div>
          ))}
        </>
      )}

      {schedule.length ? (
        <>
          <SectionLabel>{t.today.monthPlanned}</SectionLabel>
          <Hairline />
          {schedule.map((row, i) => (
            <div key={row.id}>
              {i > 0 ? <Hairline /> : null}
              <ScheduleRow row={row} onTx={setTx} />
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

function dayLabel(day: number, locale: Locale): string {
  return locale === "zh-HK" ? `${day}日` : `Day ${day}`;
}

type ScheduleRowModel = {
  id: string;
  day: number;
  iso: string;
  title: string;
  meta: string;
  amount: number;
  currency: MoneyUnit;
  tone: "income" | "expense" | "plain";
  to?: "/budget" | "/more/adhoc";
  txId?: string;
};

function monthSchedule(opts: {
  monthKey: string;
  today: string;
  recurring: Recurring[];
  adhoc: AdhocBudget[];
  planned: Transaction[];
  posted: Transaction[];
  locale: Locale;
  regularLabel: string;
  adhocLabel: string;
  plannedLabel: string;
}): ScheduleRowModel[] {
  const thisMonth = opts.today.slice(0, 7);
  if (opts.monthKey < thisMonth) return [];
  const future = opts.monthKey > thisMonth;
  const open = (iso: string) => future || iso >= opts.today;
  const rows: ScheduleRowModel[] = [];
  for (const r of opts.recurring) {
    if (r.type === "miles") continue;
    const monthly = r.frequency === "monthly";
    const day = monthly ? chargedDayOf(r) : Number(r.nextDate.slice(8, 10)) || 1;
    const iso = monthly ? chargedIso(opts.monthKey, day) : r.nextDate;
    if (!monthly && !iso.startsWith(opts.monthKey)) continue;
    if (!open(iso)) continue;
    if (regularSettledInMonth(r, opts.posted, opts.monthKey, iso)) continue;
    const spend = r.type === "expense" || Boolean(r.countsAsExpense);
    const amount = r.type === "income" ? r.amount : spend ? -r.amount : r.amount;
    rows.push({
      id: `r-${r.id}`,
      day,
      iso,
      title: pickName(opts.locale, r.label, r.labelZh),
      meta: `${dayLabel(day, opts.locale)} · ${opts.regularLabel}`,
      amount,
      currency: r.currency,
      tone: r.type === "income" ? "income" : spend ? "expense" : "plain",
      to: "/budget",
    });
  }
  for (const a of opts.adhoc) {
    if (a.paidOn) continue;
    const paidTx = opts.posted.some(
      (t) =>
        !t.planned &&
        t.adhoc &&
        t.date.startsWith(opts.monthKey) &&
        Math.abs(t.amount - a.amount) < 0.01 &&
        (t.payee === a.label || t.payeeZh === a.labelZh),
    );
    if (paidTx) continue;
    if (a.month !== opts.monthKey && !a.date.startsWith(opts.monthKey)) continue;
    const day = Number(a.date.slice(8, 10)) || 1;
    const iso = a.date.startsWith(opts.monthKey) ? a.date : chargedIso(opts.monthKey, day);
    if (!open(iso)) continue;
    rows.push({
      id: `a-${a.id}`,
      day,
      iso,
      title: pickName(opts.locale, a.label, a.labelZh),
      meta: `${dayLabel(day, opts.locale)} · ${opts.adhocLabel}`,
      amount: -Math.abs(a.amount),
      currency: a.currency,
      tone: "expense",
      to: "/more/adhoc",
    });
  }
  for (const tx of opts.planned) {
    if (!open(tx.date)) continue;
    const already = opts.posted.some(
      (t) =>
        !t.planned &&
        t.id !== tx.id &&
        t.date === tx.date &&
        t.type === tx.type &&
        t.accountId === tx.accountId &&
        Math.abs(t.amount - tx.amount) < 0.01 &&
        t.payee === tx.payee,
    );
    if (already) continue;
    const day = Number(tx.date.slice(8, 10)) || 1;
    const spend = tx.type === "expense" || Boolean(tx.countsAsExpense);
    const transfer = tx.type === "transfer" && !tx.countsAsExpense;
    const amount = transfer ? tx.amount : spend ? -tx.amount : tx.amount;
    rows.push({
      id: `t-${tx.id}`,
      day,
      iso: tx.date,
      title: pickName(opts.locale, tx.payee, tx.payeeZh),
      meta: `${dayLabel(day, opts.locale)} · ${opts.plannedLabel}`,
      amount,
      currency: tx.currency,
      tone: tx.type === "income" ? "income" : spend ? "expense" : "plain",
      txId: tx.id,
    });
  }
  rows.sort((a, b) => a.day - b.day || a.title.localeCompare(b.title));
  return rows;
}

function ScheduleRow({ row, onTx }: { row: ScheduleRowModel; onTx: (id: string) => void }) {
  const rates = useApp((s) => s.fxRates);
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-medium">{row.title}</div>
        <div className="truncate text-xs text-muted">{row.meta}</div>
      </div>
      <AmountWithHkd
        amount={row.amount}
        currency={row.currency}
        rates={rates}
        sign
        className={cn("text-sm font-semibold", row.tone === "expense" ? "text-expense" : row.tone === "income" ? "text-income" : undefined)}
      />
    </>
  );
  const className = "flex w-full items-center gap-3 px-5 py-3 text-left";
  if (row.to === "/budget") {
    return (
      <Link to="/budget" className={className}>
        {body}
      </Link>
    );
  }
  if (row.to === "/more/adhoc") {
    return (
      <Link to="/more/adhoc" className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={() => row.txId && onTx(row.txId)}>
      {body}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  info,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
  info?: "disc" | "daily";
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-line py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-xs leading-snug text-muted">
          <span>{label}</span>
          {info ? <InfoButton k={info} /> : null}
        </div>
      </div>
      <div
        className={cn(
          "shrink-0 text-right text-base font-semibold tabular-nums",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </div>
    </div>
  );
}
