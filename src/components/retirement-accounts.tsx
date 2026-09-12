import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Group, Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { blankRetirementAccount } from "@/lib/calc/mpf";
import { projectRetirementAccountYear } from "@/lib/calc/mpf";
import type { RetirementAccount, RetirementAccountType, RetirementWithdrawalStrategy } from "@/lib/types";
import { useApp } from "@/store/app";
import { useT } from "@/store/ui";
import { cn } from "@/lib/utils";

const TYPES: RetirementAccountType[] = ["MPF", "ORSO", "TVC", "QDAP", "PENSION", "ANNUITY", "OTHER_LOCKED_RETIREMENT"];

export function RetirementAccountsPage() {
  const t = useT();
  const rows = useApp((s) => s.retirementAccounts);
  const retire = useApp((s) => s.retirement);
  const [editing, setEditing] = useState<RetirementAccount | "new" | null>(null);
  const retireAge = retire?.retireAge ?? 65;
  const currentAge = retire?.currentAge ?? 40;
  const yearsToRetire = Math.max(0, retireAge - currentAge);

  const totals = rows.reduce(
    (s, a) => {
      const monthly = a.contributionFrequency === "annual" ? (a.employeeContributionAmount + a.employerContributionAmount + a.voluntaryContributionAmount) / 12 : a.contributionFrequency === "quarterly" ? (a.employeeContributionAmount + a.employerContributionAmount + a.voluntaryContributionAmount) / 3 : a.employeeContributionAmount + a.employerContributionAmount + a.voluntaryContributionAmount;
      let bal = a.currentBalance;
      for (let i = 0; i <= yearsToRetire; i++) {
        const row = projectRetirementAccountYear({
          account: a,
          openingBalance: bal,
          age: currentAge + i,
          calendarYear: new Date().getFullYear() + i,
          yearsSinceStart: i,
          retireAge,
          birthday: retire?.birthday,
        });
        bal = row.closingBalance;
      }
      return {
        balance: s.balance + a.currentBalance,
        monthly: s.monthly + (a.status === "active" ? monthly : 0),
        atRetire: s.atRetire + (currentAge + yearsToRetire < a.accessibleAge ? bal : 0),
        income: s.income + (a.scheduledAnnualIncome ?? a.plannedAnnualWithdrawal ?? 0),
      };
    },
    { balance: 0, monthly: 0, atRetire: 0, income: 0 },
  );

  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.retireAccounts} backTo="/more" />
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.more.retireAccountsHint}</p>
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        <Stat label={t.reports.raBalance} value={totals.balance} />
        <Stat label={t.reports.raMonthly} value={totals.monthly} />
        <Stat label={t.reports.raLockedAtRetire} value={totals.atRetire} />
        <Stat label={t.reports.raIncome} value={totals.income} />
      </div>
      <div className="px-4 pb-3">
        <button type="button" className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          {t.reports.raAdd}
        </button>
      </div>
      {rows.length ? (
        <Group>
          {rows.map((a, i) => (
            <div key={a.id}>
              {i > 0 ? <Hairline /> : null}
              <button type="button" className="flex w-full items-start gap-2 px-4 py-3 text-left" onClick={() => setEditing(a)}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.name}</span>
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">{a.type}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{a.provider || t.reports.raSetAccess}</div>
                  <div className="mt-1 text-xs tabular-nums text-muted">
                    {money(a.currentBalance, a.currency)} · {t.reports.raAccess} {a.accessibleAge}
                  </div>
                </div>
                <Pencil className="mt-1 size-4 shrink-0 text-muted" />
              </button>
            </div>
          ))}
        </Group>
      ) : (
        <p className="px-5 py-6 text-sm text-muted">{t.reports.raEmpty}</p>
      )}
      {editing ? <AccountEditor initial={editing === "new" ? blankRetirementAccount("MPF") : editing} isNew={editing === "new"} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-elevated px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(value, "HKD")}</div>
    </div>
  );
}

function AccountEditor({ initial, isNew, onClose }: { initial: RetirementAccount; isNew: boolean; onClose: () => void }) {
  const t = useT();
  const upsert = useApp((s) => s.upsertRetirementAccount);
  const remove = useApp((s) => s.deleteRetirementAccount);
  const [row, setRow] = useState(initial);
  const patch = (p: Partial<RetirementAccount>) => setRow((r) => ({ ...r, ...p, updatedAt: new Date().toISOString() }));

  return (
    <Overlay open onClose={onClose} variant="page" title={isNew ? t.reports.raAdd : t.common.edit}>
      <div className="space-y-3 px-5 pt-4 pb-8">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((type) => (
            <button key={type} type="button" onClick={() => setRow({ ...blankRetirementAccount(type), id: row.id, currentBalance: row.currentBalance, name: row.name })} className={cn("h-8 rounded-full px-3 text-xs", row.type === type ? "bg-accent text-on-accent" : "bg-elevated")}>
              {type}
            </button>
          ))}
        </div>
        <Field label={t.common.name} value={row.name} onChange={(v) => patch({ name: v })} />
        <Field label={t.reports.raProvider} value={row.provider ?? ""} onChange={(v) => patch({ provider: v })} />
        <Num label={t.reports.raBalance} value={row.currentBalance} onChange={(n) => patch({ currentBalance: n })} />
        <Field label={t.reports.asOf} value={row.balanceAsOf} onChange={(v) => patch({ balanceAsOf: v })} />
        <Num label={t.reports.raAccess} value={row.accessibleAge} onChange={(n) => patch({ accessibleAge: n })} />
        <p className="text-xs text-muted">{t.reports.raSetAccess}</p>
        <Num label={`${t.reports.raEmployee} / mo`} value={row.employeeContributionAmount} onChange={(n) => patch({ employeeContributionAmount: n })} />
        <Num label={`${t.reports.raEmployer} / mo`} value={row.employerContributionAmount} onChange={(n) => patch({ employerContributionAmount: n })} />
        <Num label={`${t.reports.raVoluntary} / mo`} value={row.voluntaryContributionAmount} onChange={(n) => patch({ voluntaryContributionAmount: n })} />
        <Num label={`${t.reports.raEmployee} %`} value={row.employeeContributionGrowthRate * 100} onChange={(n) => patch({ employeeContributionGrowthRate: n / 100 })} />
        <Num label={`${t.reports.raEmployer} %`} value={row.employerContributionGrowthRate * 100} onChange={(n) => patch({ employerContributionGrowthRate: n / 100 })} />
        <Num label={`${t.reports.raVoluntary} %`} value={row.voluntaryContributionGrowthRate * 100} onChange={(n) => patch({ voluntaryContributionGrowthRate: n / 100 })} />
        <Num label={`${t.reports.expectedReturn} %`} value={row.expectedAnnualReturnRate * 100} onChange={(n) => patch({ expectedAnnualReturnRate: n / 100 })} />
        <Num label={t.reports.raFee} value={(row.annualFeeRate ?? 0) * 100} onChange={(n) => patch({ annualFeeRate: n / 100 })} />
        <label className="block text-xs text-muted">{t.reports.raStrategy}</label>
        <select value={row.withdrawalStrategy} onChange={(e) => patch({ withdrawalStrategy: e.target.value as RetirementWithdrawalStrategy })} className="h-11 w-full rounded-xl bg-elevated px-3 text-sm">
          <option value="annual_drawdown">{t.reports.raDrawdown}</option>
          <option value="lump_sum">{t.reports.raLump}</option>
          <option value="scheduled_income">{t.reports.raScheduled}</option>
          <option value="do_not_use_in_projection">{t.reports.raIgnore}</option>
        </select>
        {row.withdrawalStrategy === "annual_drawdown" ? <Num label={t.reports.raDrawAmt} value={row.plannedAnnualWithdrawal ?? 0} onChange={(n) => patch({ plannedAnnualWithdrawal: n })} /> : null}
        {row.withdrawalStrategy === "scheduled_income" ? (
          <>
            <Num label={t.reports.raIncome} value={row.scheduledAnnualIncome ?? 0} onChange={(n) => patch({ scheduledAnnualIncome: n })} />
            <Num label={t.reports.raIncomeStart} value={row.scheduledIncomeStartAge ?? row.accessibleAge} onChange={(n) => patch({ scheduledIncomeStartAge: n })} />
            <Num label={t.reports.raIncomeEnd} value={row.scheduledIncomeEndAge ?? 95} onChange={(n) => patch({ scheduledIncomeEndAge: n })} />
          </>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={row.status === "active"} onChange={(e) => patch({ status: e.target.checked ? "active" : "contribution_stopped" })} />
          {t.reports.raContributing}
        </label>
        <button
          type="button"
          className="h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
          onClick={() => {
            void upsert({ ...row, balanceAsOf: row.balanceAsOf || todayISO() });
            onClose();
          }}
        >
          {t.common.done}
        </button>
        {isNew ? null : (
          <button type="button" className="flex h-11 w-full items-center justify-center gap-1.5 text-sm text-expense" onClick={() => { void remove(row.id); onClose(); }}>
            <Trash2 className="size-4" />
            {t.common.delete}
          </button>
        )}
      </div>
    </Overlay>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
    </label>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <input inputMode="decimal" defaultValue={String(value)} onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(n); }} className="mt-1 h-11 w-full rounded-xl bg-elevated px-3 text-sm tabular-nums" />
    </label>
  );
}
