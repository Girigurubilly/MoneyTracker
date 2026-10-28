import { useMemo, useState } from "react";
import { RegularEditor, RegularRow } from "@/components/budget";
import { ScreenHeader } from "@/components/shared";
import { chargedDayOf, hkdOfRegular, monthlyRegularsNetHkd } from "@/lib/calc/budget";
import { money } from "@/lib/format";
import type { Recurring } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT } from "@/store/ui";

export function RegularsPlanPage() {
  const t = useT();
  const recurring = useApp((s) => s.recurring);
  const rates = useApp((s) => s.fxRates);
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () =>
      recurring
        .filter((r) => r.type !== "miles")
        .sort((a, b) => chargedDayOf(a) - chargedDayOf(b) || a.label.localeCompare(b.label)),
    [recurring],
  );
  const income = rows.filter((r) => r.type === "income");
  const expense = rows.filter((r) => r.type === "expense" || r.countsAsExpense);
  const transfer = rows.filter((r) => r.type === "transfer" && !r.countsAsExpense);
  const incomeHkd = income.filter((r) => r.frequency === "monthly").reduce((sum, r) => sum + hkdOfRegular(r, rates), 0);
  const expenseHkd = expense.filter((r) => r.frequency === "monthly").reduce((sum, r) => sum + hkdOfRegular(r, rates), 0);
  const net = monthlyRegularsNetHkd(rows, rates);

  function section(title: string, list: Recurring[], empty: string) {
    return (
      <section className="pt-4">
        <h2 className="px-5 pb-2 text-sm font-medium text-muted">{title}</h2>
        {list.length === 0 ? (
          <p className="px-5 py-2 text-sm text-muted">{empty}</p>
        ) : (
          <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
            {list.map((r) => (
              <RegularRow key={r.id} r={r} onEdit={setEditing} />
            ))}
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
      {section(t.add.income, income, t.budget.regularsNone)}
      {section(t.add.expense, expense, t.budget.regularsNone)}
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
