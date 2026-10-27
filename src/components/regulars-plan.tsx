import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { RegularEditor } from "@/components/budget";
import { AmountWithHkd } from "@/components/currency-field";
import { ScreenHeader } from "@/components/shared";
import { chargedDayOf, hkdOfRegular, monthlyRegularsNetHkd, regularSettledInMonth } from "@/lib/calc/budget";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import type { Recurring } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

function dayPart(day: number, locale: string): string {
  return locale === "zh-HK" ? `${day}日` : `Day ${day}`;
}

export function RegularsPlanPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const recurring = useApp((s) => s.recurring);
  const rates = useApp((s) => s.fxRates);
  const txs = useApp((s) => s.transactions);
  const accounts = useApp((s) => s.accounts);
  const todayIso = todayISO();
  const month = todayIso.slice(0, 7);
  const today = Number(todayIso.slice(8, 10));
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () =>
      recurring
        .filter((r) => r.frequency === "monthly" && r.type !== "miles")
        .sort((a, b) => chargedDayOf(a) - chargedDayOf(b) || a.label.localeCompare(b.label)),
    [recurring],
  );
  const income = rows.filter((r) => r.type === "income");
  const expense = rows.filter((r) => r.type === "expense" || r.countsAsExpense);
  const transfer = rows.filter((r) => r.type === "transfer" && !r.countsAsExpense);
  const incomeHkd = income.reduce((sum, r) => sum + hkdOfRegular(r, rates), 0);
  const expenseHkd = expense.reduce((sum, r) => sum + hkdOfRegular(r, rates), 0);
  const net = monthlyRegularsNetHkd(rows, rates);

  function section(title: string, list: Recurring[], empty: string, lump?: number, tone?: "income" | "expense") {
    return (
      <section className="pt-4">
        <div className="flex items-baseline justify-between gap-3 px-5 pb-2">
          <h2 className="text-sm font-medium text-muted">{title}</h2>
          {list.length && lump != null ? (
            <span className={cn("text-sm font-semibold tabular-nums", tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "")}>
              {money(tone === "expense" ? -lump : lump, "HKD", { sign: true })}
            </span>
          ) : null}
        </div>
        {list.length === 0 ? (
          <p className="px-5 py-2 text-sm text-muted">{empty}</p>
        ) : (
          <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
            {list.map((r) => {
              const day = chargedDayOf(r);
              const iso = `${month}-${String(day).padStart(2, "0")}`;
              const posted = regularSettledInMonth(r, txs, month, iso);
              const due = day <= today;
              const signed = r.type === "income" ? r.amount : r.type === "expense" || r.countsAsExpense ? -r.amount : r.amount;
              const badgeClass = posted ? "bg-success-soft text-income" : due ? "bg-watch-soft text-watch" : "bg-accent-soft text-accent";
              const badgeLabel =
                r.type === "income"
                  ? posted
                    ? t.add.received
                    : due
                      ? t.budget.dueNotPosted
                      : t.budget.upcomingIncome
                  : posted
                    ? t.budget.charged
                    : due
                      ? t.budget.dueNotPosted
                      : t.budget.upcomingStatus;
              const acc = accounts.find((a) => a.id === r.accountId);
              return (
                <button key={r.id} type="button" className="w-full border-t border-line px-4 py-3 text-left first:border-0" onClick={() => setEditing(r)}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-medium">{pickName(locale, r.label, r.labelZh)}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted">
                          {dayPart(day, locale)}
                          {acc ? ` · ${pickName(locale, acc.name, acc.nameZh)}` : ""}
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badgeClass)}>{badgeLabel}</span>
                      </div>
                    </div>
                    <AmountWithHkd
                      amount={signed}
                      currency={r.currency}
                      rates={rates}
                      sign
                      className={cn(
                        "shrink-0 text-sm font-semibold",
                        r.type === "income" ? "text-income" : r.type === "expense" || r.countsAsExpense ? "text-expense" : undefined,
                      )}
                    />
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-faint" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.more.regulars}
        backTo="/more"
        right={
          <button type="button" className="shrink-0 px-2 text-sm font-medium text-accent" onClick={() => setAdding(true)}>
            {t.budget.addShort}
          </button>
        }
      />
      <p className="rt-enter px-5 pb-2 text-xs leading-5 text-muted">{t.budget.regularsPlanHint}</p>
      <div className="mx-4 mt-2 rounded-xl bg-elevated px-4 py-3">
        <div className="text-xs text-muted">{t.budget.monthlyRegulars}</div>
        <div className={cn("mt-1 text-2xl font-semibold tabular-nums", net > 0 ? "text-income" : net < 0 ? "text-expense" : "")}>
          {money(net, "HKD", { sign: true })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <div className="text-xs text-muted">{t.add.income}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-income">{money(incomeHkd, "HKD", { sign: true })}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.add.expense}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-expense">{money(-expenseHkd, "HKD", { sign: true })}</div>
          </div>
        </div>
      </div>
      {section(t.add.income, income, t.budget.regularsNone, incomeHkd, "income")}
      {section(t.add.expense, expense, t.budget.regularsNone, expenseHkd, "expense")}
      {transfer.length ? section(t.add.transfer, transfer, "") : null}
      {rows.length === 0 ? (
        <div className="px-5 pt-4">
          <button type="button" onClick={() => setAdding(true)} className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent">
            {t.budget.addRegular}
          </button>
        </div>
      ) : null}
      <RegularEditor
        open={adding || editing != null}
        initial={editing}
        onClose={() => {
          setEditing(null);
          setAdding(false);
        }}
      />
    </div>
  );
}
