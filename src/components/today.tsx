import { ChevronLeft, ChevronRight, Plus, Search, Wallet } from "lucide-react";
import { Hairline, InfoButton, Metric, ProgressRing, SectionLabel, Segmented, TransactionRow } from "@/components/shared";
import { AmountWithHkd } from "@/components/currency-field";
import { longDate, money, monthGrid, monthTitle, shiftMonth, todayISO, weekdayLabels } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { activityDates, plannedIso, monthStats } from "@/lib/derived";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import { asOfForMonth, chargedDayOf, forecastTone, upcomingExpenseRegulars } from "@/lib/calc/budget";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi, readSavedLocale } from "@/store/ui";
import { useEffect } from "react";

export function TodayScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const selected = useUi((s) => s.selectedDate);
  const setSelected = useUi((s) => s.setSelectedDate);
  const openAdd = useUi((s) => s.openAddPicker);
  const setSearch = useUi((s) => s.setSearchOpen);
  const todayView = useUi((s) => (s.todayView === "week" ? "month" : s.todayView));
  const setTodayView = useUi((s) => s.setTodayView);
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
            <button type="button" aria-label={t.add.title} onClick={openAdd} className="grid size-11 place-items-center">
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
        <div className="-mx-4 mt-3">
          <Segmented<"day" | "month">
            value={todayView}
            onChange={(v) => setTodayView(v)}
            options={[
              { id: "day", label: t.views.day },
              { id: "month", label: t.views.month },
            ]}
          />
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
  const todayView = useUi((s) => (s.todayView === "week" ? "month" : s.todayView));
  const firstDay = useUi((s) => s.firstDayOfWeek);
  const setTx = useUi((s) => s.setTxDetailId);
  const transactions = useApp((s) => s.transactions);
  const budgets = useApp((s) => s.budgets);
  const categories = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const recurring = useApp((s) => s.recurring);
  const adhoc = useApp((s) => s.adhocBudgets);
  const stats = monthStats(transactions, budgets, categories, rates, selected, recurring, adhoc);
  const cap = stats.actuals.find((b) => b.id === MONTH_TOTAL_BUDGET_ID) ?? stats.actuals.find((b) => !b.categoryId && !b.theme);
  const used = cap?.expected ?? stats.flow.expense;
  const target = cap?.monthly ?? 0;
  const today = todayISO();
  const asOf = asOfForMonth(selected.slice(0, 7), today);
  const ringTone = forecastTone(target > 0 ? used / target : 0);
  const paid = transactions.filter((x) => x.date === selected && !x.planned && x.type !== "miles").sort((a, b) => b.id.localeCompare(a.id));
  const scheduled = transactions.filter((x) => x.date === selected && x.planned && x.type !== "miles").sort((a, b) => b.id.localeCompare(a.id));
  const upcoming = upcomingExpenseRegulars(recurring, asOf);
  const cells = monthGrid(selected, firstDay);
  const active = activityDates(transactions);
  const plannedDays = plannedIso(transactions);
  const weekdays = weekdayLabels(locale, firstDay);

  return (
    <div className="pb-10">
      {todayView === "month" ? (
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
      ) : null}

      <div className="mx-4 mb-4 grid grid-cols-3 gap-3 rounded-xl bg-elevated px-4 py-3">
        <Metric label={t.today.incomeMonth} value={money(stats.flow.income, "HKD")} tone="income" />
        <Metric label={t.today.expenseMonth} value={money(stats.flow.expense, "HKD")} tone="expense" />
        <Metric label={t.today.netMonth} value={money(stats.flow.net, "HKD", { sign: true })} tone={stats.flow.net >= 0 ? "income" : "expense"} />
      </div>
      <div className="mx-4 mb-2 grid grid-cols-3 gap-3 rounded-xl bg-elevated px-4 py-3">
        <Metric label={t.today.remainingBudget} value={money(stats.remainingBudget, "HKD")} />
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-xs text-muted">
            {t.today.remainingDisc}
            <InfoButton k="disc" />
          </div>
          <div className="mt-1 truncate text-base font-semibold tabular-nums">{money(stats.remainingDisc, "HKD")}</div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-xs text-muted">
            {t.today.dailySpend}
            <InfoButton k="daily" />
          </div>
          <div className="mt-1 truncate text-base font-semibold tabular-nums">{money(stats.daily.daily, "HKD")}</div>
        </div>
      </div>
      <p className="px-5 pb-2 text-xs text-faint">{t.today.guidance}</p>

      <SectionLabel>{t.today.goals}</SectionLabel>
      <Hairline />
      <Link to="/budget" className="flex w-full items-center gap-3 px-5 py-3.5 text-left">
        <span className="relative">
          <ProgressRing value={target ? used / target : 0} size={40} stroke={3} tone={ringTone} />
          <span className={cn("pointer-events-none absolute inset-0 grid place-items-center", ringTone === "expense" ? "text-expense" : ringTone === "watch" ? "text-watch" : "text-income")}>
            <Wallet className="size-3.5" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{t.budget.monthlyTotal}</span>
          <span className="text-xs text-muted">
            {t.today.reservedRegulars}: {money((cap?.reserved ?? 0) + (cap?.reservedAdhoc ?? 0), "HKD")}
            <span className="block">
              {t.budget.postedRegulars}: {money(cap?.realized ?? 0, "HKD")}
            </span>
          </span>
        </span>
        <span className="text-right">
          <span className="block text-sm font-semibold tabular-nums">{money(used, "HKD")}</span>
          <span className="text-xs tabular-nums text-muted">{target > 0 ? money(target, "HKD") : "—"}</span>
        </span>
      </Link>
      <Hairline />

      {upcoming.length ? (
        <>
          <SectionLabel>{t.today.upcoming}</SectionLabel>
          <Hairline />
          {upcoming.map((r, i) => (
            <div key={r.id}>
              {i > 0 ? <Hairline /> : null}
              <div className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm">{pickName(locale, r.label, r.labelZh)}</div>
                  <div className="text-xs text-muted">
                    {t.budget.chargedDay} {chargedDayOf(r)}
                  </div>
                </div>
                <div className={cn("shrink-0", r.type === "income" ? "text-income" : "text-foreground")}>
                  <AmountWithHkd
                    amount={r.type === "expense" || r.countsAsExpense ? -r.amount : r.amount}
                    currency={r.currency}
                    rates={rates}
                    sign
                    className="text-sm font-semibold"
                  />
                </div>
              </div>
            </div>
          ))}
        </>
      ) : null}

      <SectionLabel>{t.today.dayTx}</SectionLabel>
      <Hairline />
      <p className="px-5 pt-2 text-xs text-muted">{longDate(selected, locale)}</p>
      {paid.length === 0 && scheduled.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">{t.today.noTxDay}</p>
      ) : (
        <>
          {paid.map((tx, i) => (
            <div key={tx.id}>
              {i > 0 ? <Hairline /> : null}
              <TransactionRow tx={tx} onClick={() => setTx(tx.id)} />
            </div>
          ))}
          {scheduled.length ? (
            <>
              <SectionLabel>{t.today.scheduled}</SectionLabel>
              <Hairline />
              {scheduled.map((tx, i) => (
                <div key={tx.id}>
                  {i > 0 ? <Hairline /> : null}
                  <TransactionRow tx={tx} onClick={() => setTx(tx.id)} />
                </div>
              ))}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
