import { useEffect, useMemo, useRef, useState } from "react";
import { MONTHS_EN, MONTHS_ZH, yearlyProjection } from "@/lib/calc/deposits";
import { renderYearlyBriefMarkdown } from "@/lib/calc/yearly-brief";
import { money, todayISO } from "@/lib/format";
import { Enter, useCountUp } from "@/components/retire-ux";
import { Overlay, ScreenHeader } from "@/components/shared";
import { ReportAiButton, ReportAiSheet } from "@/components/report-ai-sheet";
import { ActiveKeypad, ComposerHeader, ComposerShell } from "@/components/txn-composer";
import { cn } from "@/lib/utils";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function YearlyPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const plans = useApp((s) => s.yearlyPlans);
  const deposits = useApp((s) => s.deposits);
  const rates = useApp((s) => s.fxRates);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const recurring = useApp((s) => s.recurring);
  const budgets = useApp((s) => s.budgets);
  const setYearlyCell = useApp((s) => s.setYearlyCell);
  const setYearlySalaryYear = useApp((s) => s.setYearlySalaryYear);
  const [ai, setAi] = useState(false);
  const [hint, setHint] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const calendarMonth0 = Number(today.slice(5, 7)) - 1;
  const [viewYear, setViewYear] = useState(thisYear);
  const isNextYear = viewYear === thisYear + 1;
  const month0 = isNextYear ? -1 : calendarMonth0;
  const monthCap = isNextYear ? 0 : budgets.find((b) => b.id === MONTH_TOTAL_BUDGET_ID)?.monthly ?? 0;
  const data = yearlyProjection(
    plans,
    deposits,
    rates,
    viewYear,
    month0,
    txs,
    cats,
    monthCap,
    recurring,
    isNextYear ? "" : today,
  );
  const months = locale === "zh-HK" ? MONTHS_ZH : MONTHS_EN;
  const markdown = useMemo(
    () =>
      renderYearlyBriefMarkdown({
        asOf: today,
        year: viewYear,
        monthCap,
        locale,
        ...data,
      }),
    [today, viewYear, monthCap, data, locale],
  );
  const shownSaving = useCountUp(data.yearSaving, false, 480);
  const activeFocus = focus ?? (isNextYear ? 0 : calendarMonth0);

  const nextYearNeedsSetup = useMemo(() => {
    if (!isNextYear) return false;
    return data.rows.every((r) => Math.abs(r.salary) < 0.005);
  }, [data.rows, isNextYear]);

  const emptyEarly = useMemo(() => {
    if (isNextYear) return [] as number[];
    const empties: number[] = [];
    for (const row of data.rows) {
      if (row.month0 >= calendarMonth0) break;
      const blank =
        Math.abs(row.salary) < 0.005 &&
        Math.abs(row.other) < 0.005 &&
        Math.abs(row.expense) < 0.005 &&
        Math.abs(row.depInt) < 0.005;
      if (blank) empties.push(row.month0);
      else break;
    }
    return empties;
  }, [data.rows, calendarMonth0, isNextYear]);

  const visibleRows = useMemo(() => {
    if (showEmpty || !emptyEarly.length) return data.rows;
    const hide = new Set(emptyEarly);
    return data.rows.filter((r) => !hide.has(r.month0));
  }, [data.rows, emptyEarly, showEmpty]);

  useEffect(() => {
    setFocus(isNextYear ? 0 : calendarMonth0);
  }, [viewYear, isNextYear, calendarMonth0]);

  function scrubTo(m0: number) {
    setFocus(m0);
    const el = cardRefs.current[m0];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const maxAbs = Math.max(1, ...data.rows.map((r) => Math.abs(r.saving)));

  return (
    <div className="pb-24">
      <ScreenHeader title={t.reports.yearlyTitleYear.replace("{year}", String(viewYear))} backTo="/reports" />

      <div className="mx-4 mb-2 flex gap-2">
        <button
          type="button"
          className={cn(
            "tr-press min-h-11 flex-1 rounded-xl px-3 text-sm font-medium",
            !isNextYear ? "bg-accent text-on-accent" : "bg-elevated text-muted",
          )}
          onClick={() => setViewYear(thisYear)}
        >
          {t.reports.yearThis} · {thisYear}
        </button>
        <button
          type="button"
          className={cn(
            "tr-press min-h-11 flex-1 rounded-xl px-3 text-sm font-medium",
            isNextYear ? "bg-accent text-on-accent" : "bg-elevated text-muted",
          )}
          onClick={() => setViewYear(thisYear + 1)}
        >
          {t.reports.yearNext} · {thisYear + 1}
        </button>
      </div>

      {isNextYear ? (
        <div className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-2xl bg-elevated px-3 py-3">
          <p className="text-xs leading-5 text-muted">
            {nextYearNeedsSetup
              ? t.reports.nextYearEmptyHint.replace("{year}", String(viewYear))
              : t.reports.nextYearWizardHint.replace("{year}", String(viewYear))}
          </p>
          <button
            type="button"
            className="tr-press shrink-0 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-on-accent"
            onClick={() => setWizard(true)}
          >
            {t.reports.setupNextYear.replace("{year}", String(viewYear))}
          </button>
        </div>
      ) : null}

      <div className="tr-sticky px-4 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xs font-medium text-accent">{t.reports.yearlySaving}</div>
          <div className={cn("text-lg font-semibold tabular-nums", shownSaving >= 0 ? "text-income" : "text-expense")}>
            {money(shownSaving, "HKD")}
          </div>
        </div>
      </div>

      <Enter>
        <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
          <div className="text-xs font-medium text-accent">{t.reports.yearlySaving}</div>
          <div className={cn("mt-1 text-2xl font-semibold tabular-nums", data.yearSaving >= 0 ? "text-income" : "text-expense")}>
            {money(shownSaving, "HKD")}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-success-soft px-3 py-2">
              <div className="text-[11px] text-income">{t.reports.yearlyEarn}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(data.yearIncome, "HKD")}</div>
            </div>
            <div className="rounded-xl bg-expense-soft px-3 py-2">
              <div className="text-[11px] text-expense">{t.reports.yearlyExpense}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(data.yearExpense, "HKD")}</div>
            </div>
            {!isNextYear ? (
              <>
                <div className="rounded-xl bg-background px-3 py-2">
                  <div className="text-[11px] text-muted">{t.reports.earnAsOfNow}</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(data.asOfIncome, "HKD")}</div>
                </div>
                <button type="button" className="tr-press rounded-xl bg-background px-3 py-2 text-left" onClick={() => setHint(true)}>
                  <div className="text-[11px] text-muted">{t.reports.expenseAsOfNow}</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(data.asOfExpense, "HKD")}</div>
                  {monthCap > 0 ? <p className="mt-1 text-[10px] leading-3 text-faint">{t.reports.expenseAsOfCapNote}</p> : null}
                </button>
              </>
            ) : null}
          </div>
          {!isNextYear ? (
            <div className="mt-2 rounded-xl bg-background px-3 py-2">
              <div className="text-[11px] text-muted">{t.reports.savingAsOfNow}</div>
              <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", data.asOfSaving >= 0 ? "text-income" : "text-expense")}>
                {money(data.asOfSaving, "HKD")}
              </div>
            </div>
          ) : null}
        </div>
      </Enter>

      <Enter delay>
        <div className="mx-4 mb-3 rounded-2xl bg-elevated px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] text-muted">{t.reports.yearlyBalanceBars}</div>
            <div className="text-[11px] font-medium text-[var(--color-foreground)]">{months[activeFocus]}</div>
          </div>
          <div className="flex h-16 items-end gap-1">
            {data.rows.map((row) => {
              const h = Math.max(4, (Math.abs(row.saving) / maxAbs) * 48);
              const on = row.month0 === activeFocus;
              return (
                <button
                  key={row.id}
                  type="button"
                  className={cn("tr-press flex min-h-11 flex-1 flex-col items-center justify-end", on && "opacity-100")}
                  onClick={() => scrubTo(row.month0)}
                  aria-label={months[row.month0]}
                >
                  <span
                    className={cn(
                      "w-full rounded-t-sm",
                      row.saving >= 0 ? "bg-income" : "bg-expense",
                      on ? "opacity-100 ring-2 ring-accent ring-offset-1 ring-offset-elevated" : "opacity-55",
                    )}
                    style={{ height: h }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </Enter>

      <button type="button" className="tr-press mx-4 mb-2 text-left text-xs leading-5 text-muted underline-offset-2 hover:underline" onClick={() => setHint(true)}>
        {t.reports.yearlyPastHint.slice(0, 48)}…
      </button>

      <ReportAiButton onClick={() => setAi(true)} />
      {ai ? (
        <ReportAiSheet
          title={t.reports.exportBrief}
          hint={t.reports.yearlyAiHint}
          filename={`hk-life-yearly-${viewYear}-${today}.md`}
          markdown={markdown}
          onClose={() => setAi(false)}
        />
      ) : null}

      {emptyEarly.length ? (
        <button
          type="button"
          className="tr-press mx-4 mb-2 inline-flex min-h-11 items-center text-xs font-medium text-accent"
          onClick={() => setShowEmpty((v) => !v)}
        >
          {showEmpty
            ? t.reports.hideEmptyMonths
            : t.reports.emptyEarlyMonths
                .replace("{from}", months[emptyEarly[0]])
                .replace("{to}", months[emptyEarly[emptyEarly.length - 1]])}
        </button>
      ) : null}

      <div className="mx-4 space-y-2">
        {visibleRows.map((row, i) => {
          const capDriven = row.isCurrent && !row.fromLedger && monthCap > 0;
          return (
            <Enter key={row.id} delay={i > 0}>
              <div
                ref={(el) => {
                  cardRefs.current[row.month0] = el;
                }}
                className={cn(
                  "rounded-2xl bg-elevated px-3 py-3",
                  row.month0 === activeFocus && "ring-1 ring-accent",
                )}
              >
                <button type="button" className="tr-press flex w-full items-center justify-between gap-2 text-left" onClick={() => setFocus(row.month0)}>
                  <div className="text-sm font-semibold">
                    {months[row.month0]}
                    {row.isCurrent ? (
                      <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-on-accent">{t.reports.nowBadge}</span>
                    ) : null}
                  </div>
                  <div className={cn("text-sm font-semibold tabular-nums", row.saving >= 0 ? "text-income" : "text-expense")}>
                    {money(row.saving, "HKD")}
                  </div>
                </button>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted">{t.reports.salary}</div>
                    {row.incomeLocked ? (
                      <LedgerNum value={row.salary} />
                    ) : (
                      <NumCell value={row.salary} onChange={(n) => void setYearlyCell(viewYear, row.month0, "salary", n)} />
                    )}
                  </div>
                  <div>
                    <div className="text-muted">{t.reports.depositInterestHkd}</div>
                    <div className="mt-1 flex h-9 items-center justify-end tabular-nums text-income">
                      {row.depInt ? money(row.depInt, "HKD") : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-1 text-muted">
                      <span>{t.reports.otherIncome}</span>
                      {row.otherLocked ? <span className="text-[10px] text-faint">{t.reports.otherFromSchedule}</span> : null}
                    </div>
                    {row.otherLocked || row.incomeLocked ? (
                      <LedgerNum value={row.other} />
                    ) : (
                      <NumCell value={row.other} onChange={(n) => void setYearlyCell(viewYear, row.month0, "other", n)} />
                    )}
                  </div>
                  <div>
                    <div className="text-muted">{t.reports.expectedExpense}</div>
                    {row.fromLedger || capDriven ? (
                      <>
                        <LedgerNum value={row.expense} />
                        {capDriven ? <p className="mt-1 text-[11px] leading-4 text-faint">{t.reports.capDrivenExpense}</p> : null}
                      </>
                    ) : (
                      <>
                        <NumCell value={row.expense} onChange={(n) => void setYearlyCell(viewYear, row.month0, "expense", n)} />
                        {row.isCurrent ? <p className="mt-1 text-[11px] leading-4 text-faint">{t.reports.linkedMonthCap}</p> : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Enter>
          );
        })}
      </div>

      {hint ? (
        <Overlay open onClose={() => setHint(false)} title={t.reports.yearly}>
          <p className="px-5 pb-8 text-sm leading-6 text-muted">{t.reports.yearlyPastHint}</p>
          {monthCap > 0 ? <p className="px-5 pb-8 text-sm leading-6 text-muted">{t.reports.expenseAsOfCapNote}</p> : null}
        </Overlay>
      ) : null}

      {wizard ? (
        <NextYearSalaryWizard
          year={viewYear}
          initial={data.rows.find((r) => r.salary > 0)?.salary ?? 0}
          onClose={() => setWizard(false)}
          onApply={async (salary) => {
            await setYearlySalaryYear(viewYear, salary);
            setWizard(false);
          }}
        />
      ) : null}
    </div>
  );
}

function NextYearSalaryWizard({
  year,
  initial,
  onClose,
  onApply,
}: {
  year: number;
  initial: number;
  onClose: () => void;
  onApply: (salary: number) => void | Promise<void>;
}) {
  const t = useT();
  const [amount, setAmount] = useState(initial > 0.005 ? String(Math.round(initial * 100) / 100) : "");
  const [pad, setPad] = useState(true);
  const [busy, setBusy] = useState(false);

  async function apply() {
    const n = parseFloat(amount) || 0;
    setBusy(true);
    try {
      await onApply(n);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay open onClose={onClose} variant="page">
      <ComposerShell
        header={
          <ComposerHeader
            onClose={onClose}
            onSave={busy ? undefined : () => void apply()}
            title={t.reports.nextYearWizardTitle}
          />
        }
        keypad={
          pad ? (
            <ActiveKeypad
              field="amount"
              amount={amount}
              dest=""
              principal=""
              interest=""
              setAmount={setAmount}
              setDest={() => undefined}
              setPrincipal={() => undefined}
              setInterest={() => undefined}
              currency="HKD"
              onCurrency={() => undefined}
            />
          ) : null
        }
      >
        <p className="border-b border-line px-4 py-3 text-sm leading-6 text-muted" onClick={() => setPad(false)}>
          {t.reports.nextYearWizardHint.replace("{year}", String(year))}
        </p>
        <button
          type="button"
          className="tr-press flex w-full items-baseline justify-between gap-3 px-4 py-4 text-left"
          onClick={() => setPad(true)}
        >
          <span className="text-sm text-muted">{t.reports.nextYearWizardSalary}</span>
          <span className="text-2xl font-semibold tabular-nums text-income">
            {amount ? `HK$ ${amount}` : "HK$ —"}
          </span>
        </button>
      </ComposerShell>
    </Overlay>
  );
}

function LedgerNum({ value }: { value: number }) {
  return <div className="mt-1 flex h-9 items-center justify-end tabular-nums">{value ? money(value, "HKD") : "—"}</div>;
}

function NumCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [raw, setRaw] = useState(value > 0.005 ? String(Math.round(value * 100) / 100) : "");
  useEffect(() => {
    setRaw(value > 0.005 ? String(Math.round(value * 100) / 100) : "");
  }, [value]);
  return (
    <div className="relative mt-1">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">HK$</span>
      <input
        type="text"
        inputMode="decimal"
        className="h-9 w-full rounded-lg bg-background py-2 pl-9 pr-2 text-right tabular-nums"
        value={raw}
        placeholder="—"
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.]/g, "");
          setRaw(v);
          onChange(parseFloat(v) || 0);
        }}
        onBlur={() => setRaw(value > 0.005 ? String(Math.round(value * 100) / 100) : "")}
      />
    </div>
  );
}
