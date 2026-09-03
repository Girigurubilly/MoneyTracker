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
  const setYearlyCell = useApp((s) => s.setYearlyCell);
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const month0 = Number(today.slice(5, 7)) - 1;
  const data = yearlyProjection(plans, deposits, rates, year, month0);
  const months = locale === "zh-HK" ? MONTHS_ZH : MONTHS_EN;

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.yearly} backTo="/reports" />
      <div className="mx-4 grid grid-cols-2 gap-2">
        <Metric label={t.reports.yearlyEarn} value={money(data.yearIncome, "HKD")} tone="income" />
        <Metric label={t.reports.yearlyExpense} value={money(data.yearExpense, "HKD")} tone="expense" />
        <Metric label={t.reports.yearlySaving} value={money(data.yearSaving, "HKD")} tone={data.yearSaving >= 0 ? "income" : "expense"} />
        <Metric label={t.reports.earnAsOfNow} value={money(data.asOfIncome, "HKD")} tone="income" />
        <Metric label={t.reports.expenseAsOfNow} value={money(data.asOfExpense, "HKD")} tone="expense" />
        <Metric label={t.reports.savingAsOfNow} value={money(data.asOfSaving, "HKD")} tone={data.asOfSaving >= 0 ? "income" : "expense"} />
      </div>
      <div className="mt-4 overflow-x-auto px-2">
        <table className="min-w-[720px] w-full text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="px-2 py-2 text-left font-medium">{locale === "zh-HK" ? "月份" : "Month"}</th>
              <th className="px-2 py-2 text-right font-medium">{t.reports.salary}</th>
              <th className="px-2 py-2 text-right font-medium">{t.reports.depositInterestHkd}</th>
              <th className="px-2 py-2 text-right font-medium">{t.reports.otherIncome}</th>
              <th className="px-2 py-2 text-right font-medium">{t.reports.totalIncome}</th>
              <th className="px-2 py-2 text-right font-medium">{t.reports.expectedExpense}</th>
              <th className="px-2 py-2 text-right font-medium">{t.reports.saving}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} className={cn(row.isCurrent && "bg-elevated")}>
                <td className={cn("whitespace-nowrap px-2 py-2 font-medium", row.isCurrent && "text-accent")}>
                  {months[row.month0]}
                  {row.isCurrent ? <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-on-accent">{t.reports.nowBadge}</span> : null}
                </td>
                <td className="px-2 py-1">
                  <NumCell value={row.salary} onChange={(n) => void setYearlyCell(year, row.month0, "salary", n)} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-income">{row.depInt ? money(row.depInt, "HKD") : "—"}</td>
                <td className="px-2 py-1">
                  <NumCell value={row.other} onChange={(n) => void setYearlyCell(year, row.month0, "other", n)} />
                </td>
                <td className="px-2 py-2 text-right font-medium tabular-nums">{row.income ? money(row.income, "HKD") : "—"}</td>
                <td className="px-2 py-1">
                  <NumCell value={row.expense} onChange={(n) => void setYearlyCell(year, row.month0, "expense", n)} />
                </td>
                <td className={cn("px-2 py-2 text-right font-semibold tabular-nums", row.saving >= 0 ? "text-income" : "text-expense")}>
                  {money(row.saving, "HKD")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <div className="rounded-xl bg-elevated px-3 py-3">
      <div className="text-[11px] leading-snug text-muted">{label}</div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : ""}`}>{value}</div>
    </div>
  );
}

function NumCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      className="h-9 w-[108px] rounded-lg bg-background px-2 text-right tabular-nums"
      value={value || ""}
      placeholder="0"
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}
