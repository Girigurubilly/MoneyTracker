import { useState } from "react";
import { Hairline, SectionLabel } from "@/components/shared";
import { money } from "@/lib/format";
import type { LifeYearRow } from "@/lib/calc/life-plan";
import { useT } from "@/store/ui";

export function LifeYearList({ years }: { years: LifeYearRow[] }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const visible = all ? years : years.slice(0, 5);
  return (
    <div className="mb-3">
      <SectionLabel>{t.reports.lpYears}</SectionLabel>
      <p className="px-5 pb-2 text-[11px] leading-4 text-muted">{t.reports.lpLivingNote}</p>
      <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
        {visible.map((y, i) => (
          <div key={y.age}>
            {i > 0 ? <Hairline /> : null}
            <button type="button" className="flex min-h-11 w-full items-start justify-between gap-2 px-4 py-2.5 text-left" onClick={() => setOpen(open === y.age ? null : y.age)}>
              <div>
                <div className="text-sm font-medium">
                  {y.calendarYear} · {t.reports.atAge} {y.age}
                </div>
                <div className="text-[11px] text-muted">
                  {phaseLabel(y.phase, t)}
                  {y.months < 12 ? ` · ${t.reports.lpMonthsLeft.replace("{n}", String(y.months))}` : ""}
                  {y.inheritedHeld > 0 ? ` · ${t.reports.lpInheritHeld}` : ""}
                  {y.inheritKept > 0 ? ` · ${t.reports.lpInheritKept} ${money(y.inheritKept, "HKD")}` : ""}
                </div>
              </div>
              <div className="text-right text-xs tabular-nums">{money(y.closingFinancial, "HKD")}</div>
            </button>
            {open === y.age ? (
              <div className="space-y-1 px-4 pb-3 text-[11px] text-muted">
                <Amt k={t.reports.openingAcc} n={y.openingFinancial} />
                <Amt k={t.reports.lpInvestGain} n={y.investmentReturn} />
                <Amt k={t.reports.lpIncomeYear} n={y.income} />
                <Amt k={t.reports.lpLivingMonth} n={y.livingMonthlyToday} />
                {Math.abs(y.living / y.months - y.livingMonthlyToday) > 1 ? <Amt k={t.reports.lpLivingInflated} n={y.living / y.months} /> : null}
                <Amt k={t.reports.lpLivingYear} n={y.living} />
                <Amt k={t.reports.lpMonthlyPay} n={y.mortgage / y.months} />
                <Amt k={t.reports.lpInheritHeld} n={y.inheritedHeld} />
                {y.inheritStated > 0 && Math.abs(y.inheritStated - y.inheritProceeds) > 1 ? <Amt k={t.reports.lpInheritStated} n={y.inheritStated} /> : null}
                <Amt k={t.reports.lpInheritSold} n={y.inheritProceeds} />
                <Amt k={t.reports.lpInheritPremium} n={y.annuityBuy} />
                <Amt k={t.reports.lpInheritKept} n={y.inheritKept} />
                <Amt k={t.reports.lpAnnuity} n={y.annuityIncome} />
                <Amt k={t.reports.lpPension} n={y.pensionIncome} />
                <Amt k={t.reports.lpAllowance} n={y.allowanceIncome} />
                <Amt k={t.reports.lpReverse} n={y.reverseMortgage} />
                <Amt k={t.reports.lpLocked} n={y.lockedBalance} />
                <Amt k={t.reports.closingAcc} n={y.closingFinancial} />
                {y.notes.map((n) => (
                  <p key={n}>{noteLabel(n, t)}</p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {years.length > 5 ? (
          <button type="button" className="flex min-h-11 w-full items-center justify-center border-t border-line text-sm font-medium text-accent" onClick={() => setAll(!all)}>
            {all ? t.reports.hideAssumptions : `${t.reports.lpYears} (${years.length})`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Amt({ k, n }: { k: string; n: number }) {
  if (!n) return null;
  return (
    <div className="flex justify-between gap-2">
      <span>{k}</span>
      <span className="tabular-nums">{money(n, "HKD")}</span>
    </div>
  );
}

function noteLabel(note: string, t: ReturnType<typeof useT>): string {
  if (note === "inherit-received") return t.reports.lpNoteReceived;
  if (note === "inherit-already") return t.reports.lpNoteAlready;
  if (note === "inherit-sold") return t.reports.lpNoteSold;
  if (note === "inherit-annuity") return t.reports.lpNoteAnnuity;
  if (note === "annuity-bought") return t.reports.lpNoteAnnuityBought;
  if (note === "No retirement spending stage for this age.") return t.reports.lpNoteNoStage;
  return note;
}

function phaseLabel(phase: string, t: ReturnType<typeof useT>) {
  if (phase === "lower") return t.reports.lpPhaseLower;
  if (phase === "retired") return t.reports.lpPhaseRetired;
  return t.reports.lpPhaseCurrent;
}
