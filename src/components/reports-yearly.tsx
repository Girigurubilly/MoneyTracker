import { MONTHS_EN, MONTHS_ZH, yearlyProjection } from "@/lib/calc/deposits";
import { money, todayISO } from "@/lib/format";
import { ScreenHeader } from "@/components/shared";
import { cn } from "@/lib/utils";
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
  const setYearlyCell = useApp((s) => s.setYearlyCell);
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const month0 = Number(today.slice(5, 7)) - 1;
  const data = yearlyProjection(plans, deposits, rates, year, month0, txs, cats);
  const months = locale === "zh-HK" ? MONTHS_ZH : MONTHS_EN;

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.yearly} backTo="/reports" />
      <p className="px-5 pb-3 text-xs text-muted">{t.reports.yearlyPastHint}</p>
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="text-xs font-medium text-accent">{t.reports.yearlySaving}</div>
        <div className={cn("mt-1 text-2xl font-semibold tabular-nums", data.yearSaving >= 0 ? "text-income" : "text-expense")}>
          {money(data.yearSaving, "HKD")}
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
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.earnAsOfNow}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(data.asOfIncome, "HKD")}</div>
          </div>
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.expenseAsOfNow}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(data.asOfExpense, "HKD")}</div>
          </div>
        </div>
      </div>
      <div className="mx-4 space-y-2">
        {data.rows.map((row) => (
          <div key={row.id} className={cn("rounded-2xl bg-elevated px-3 py-3", row.isCurrent && "ring-1 ring-accent")}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">
                {months[row.month0]}
                {row.isCurrent ? <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-on-accent">{t.reports.nowBadge}</span> : null}
              </div>
              <div className={cn("text-sm font-semibold tabular-nums", row.saving >= 0 ? "text-income" : "text-expense")}>{money(row.saving, "HKD")}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted">{t.reports.salary}</div>
                {row.fromLedger ? (
                  <LedgerNum value={row.salary} />
                ) : (
                  <NumCell value={row.salary} onChange={(n) => void setYearlyCell(year, row.month0, "salary", n)} />
                )}
              </div>
              <div>
                <div className="text-muted">{t.reports.depositInterestHkd}</div>
                <div className="mt-1 h-9 py-2 tabular-nums text-income">{row.depInt ? money(row.depInt, "HKD") : "—"}</div>
              </div>
              <div>
                <div className="text-muted">{t.reports.otherIncome}</div>
                {row.fromLedger ? (
                  <LedgerNum value={row.other} />
                ) : (
                  <NumCell value={row.other} onChange={(n) => void setYearlyCell(year, row.month0, "other", n)} />
                )}
              </div>
              <div>
                <div className="text-muted">{t.reports.expectedExpense}</div>
                {row.fromLedger ? (
                  <LedgerNum value={row.expense} />
                ) : (
                  <NumCell value={row.expense} onChange={(n) => void setYearlyCell(year, row.month0, "expense", n)} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LedgerNum({ value }: { value: number }) {
  return <div className="mt-1 h-9 py-2 tabular-nums">{value ? money(value, "HKD") : "—"}</div>;
}

function NumCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      className="mt-1 h-9 w-full rounded-lg bg-background px-2 text-right tabular-nums"
      value={value || ""}
      placeholder="0"
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}
