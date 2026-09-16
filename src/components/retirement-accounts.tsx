import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Group, Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { ActiveKeypad, ComposerHeader, ComposerShell, LineRow, TextLine } from "@/components/txn-composer";
import { pickName } from "@/lib/i18n";
import { money, todayISO } from "@/lib/format";
import { resolveAmountInput } from "@/lib/money-expr";
import {
  applyAnnuityTerms,
  blankRetirementAccount,
  isGuaranteedPayout,
  projectRetirementAccountYear,
  scheduledPayoutAnnual,
} from "@/lib/calc/mpf";
import type { Allowance, RetirementAccount, RetirementAccountType, RetirementWithdrawalStrategy } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { cn } from "@/lib/utils";

const TYPES: RetirementAccountType[] = ["MPF", "ORSO", "ANNUITY", "TVC", "QDAP", "PENSION", "OTHER_LOCKED_RETIREMENT"];
const YEAR_CHIPS = [5, 10, 15, 20];

export function RetirementAccountsPage() {
  const t = useT();
  const rows = useApp((s) => s.retirementAccounts);
  const retire = useApp((s) => s.retirement);
  const [editing, setEditing] = useState<RetirementAccount | "new" | "annuity" | null>(null);
  const retireAge = retire?.retireAge ?? 65;
  const currentAge = retire?.currentAge ?? 40;
  const yearsToRetire = Math.max(0, retireAge - currentAge);

  const totals = rows.reduce(
    (s, a) => {
      const monthly =
        a.contributionFrequency === "annual"
          ? (a.employeeContributionAmount + a.employerContributionAmount + a.voluntaryContributionAmount) / 12
          : a.contributionFrequency === "quarterly"
            ? (a.employeeContributionAmount + a.employerContributionAmount + a.voluntaryContributionAmount) / 3
            : a.employeeContributionAmount + a.employerContributionAmount + a.voluntaryContributionAmount;
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
        income: s.income + scheduledPayoutAnnual(a) + (a.plannedAnnualWithdrawal ?? 0),
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
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-on-accent"
          onClick={() => setEditing("new")}
        >
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
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">{typeLabel(a.type, t)}</span>
                  </div>
                  <div className="mt-1 text-xs tabular-nums text-muted">{accountLine(a, t)}</div>
                </div>
                <Pencil className="mt-1 size-4 shrink-0 text-muted" />
              </button>
            </div>
          ))}
        </Group>
      ) : (
        <p className="px-5 py-6 text-sm text-muted">{t.reports.raEmpty}</p>
      )}
      {editing ? (
        <AccountEditor
          initial={editing === "new" ? blankRetirementAccount("MPF") : editing === "annuity" ? blankRetirementAccount("ANNUITY") : editing}
          isNew={editing === "new" || editing === "annuity"}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <HkIncomeSection onAddAnnuity={() => setEditing("annuity")} />
    </div>
  );
}

function typeLabel(type: RetirementAccountType, t: ReturnType<typeof useT>): string {
  if (type === "MPF") return t.reports.raTypeMpf;
  if (type === "ORSO") return t.reports.raTypeOrso;
  if (type === "TVC") return t.reports.raTypeTvc;
  if (type === "QDAP") return t.reports.raTypeQdap;
  if (type === "PENSION") return t.reports.raTypePension;
  if (type === "ANNUITY") return t.reports.raTypeAnnuity;
  return t.reports.raTypeOther;
}

function accountLine(a: RetirementAccount, t: ReturnType<typeof useT>): string {
  if (isGuaranteedPayout(a) && a.withdrawalStrategy === "scheduled_income") {
    const monthly = a.scheduledMonthlyIncome && a.scheduledMonthlyIncome > 0 ? a.scheduledMonthlyIncome : scheduledPayoutAnnual(a) / 12;
    const start = a.scheduledIncomeStartAge ?? a.accessibleAge;
    const years = a.scheduledIncomeYears;
    const lifetime = years === 0 || (years == null && !a.scheduledIncomeEndAge);
    if (lifetime) {
      return t.reports.raPayoutLifeSummary.replace("{amount}", money(monthly, a.currency)).replace("{age}", String(start));
    }
    const y = years && years > 0 ? years : Math.max(0, (a.scheduledIncomeEndAge ?? start) - start);
    return t.reports.raPayoutSummary
      .replace("{amount}", money(monthly, a.currency))
      .replace("{years}", String(y))
      .replace("{age}", String(start));
  }
  return `${money(a.currentBalance, a.currency)} · ${t.reports.raAccess} ${a.accessibleAge}`;
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
  const payout = isGuaranteedPayout(row);
  const monthlyDefault =
    row.scheduledMonthlyIncome && row.scheduledMonthlyIncome > 0
      ? row.scheduledMonthlyIncome
      : scheduledPayoutAnnual(row) / 12;
  const [amount, setAmount] = useState(String(payout ? monthlyDefault || "" : row.currentBalance || ""));
  const yearsDefault =
    row.scheduledIncomeYears != null
      ? row.scheduledIncomeYears
      : row.scheduledIncomeEndAge
        ? Math.max(0, row.scheduledIncomeEndAge - (row.scheduledIncomeStartAge ?? row.accessibleAge))
        : 10;
  const [years, setYears] = useState(yearsDefault);
  const [startAge, setStartAge] = useState(row.scheduledIncomeStartAge ?? row.accessibleAge);
  const [more, setMore] = useState(false);
  const patch = (p: Partial<RetirementAccount>) => setRow((r) => ({ ...r, ...p, updatedAt: new Date().toISOString() }));

  function changeType(type: RetirementAccountType) {
    const next = { ...blankRetirementAccount(type), id: row.id, name: row.name || blankRetirementAccount(type).name, currentBalance: row.currentBalance };
    setRow(next);
    const nextPayout = isGuaranteedPayout(next);
    setAmount(String(nextPayout ? next.scheduledMonthlyIncome || "" : next.currentBalance || ""));
    setYears(next.scheduledIncomeYears ?? 10);
    setStartAge(next.scheduledIncomeStartAge ?? 65);
    setMore(false);
  }

  function save() {
    const n = resolveAmountInput(amount);
    let next = { ...row, balanceAsOf: row.balanceAsOf || todayISO(), updatedAt: new Date().toISOString() };
    if (isGuaranteedPayout(next)) {
      next = applyAnnuityTerms(next, n, years, startAge);
      if (next.type !== "ANNUITY") {
        next.currentBalance = row.currentBalance;
        next.status = row.status === "closed" ? "closed" : "active";
        next.contributionFrequency = "monthly";
        next.voluntaryContributionAmount = row.voluntaryContributionAmount;
      }
    } else {
      next.currentBalance = n;
    }
    void upsert(next);
    onClose();
  }

  return (
    <Overlay open onClose={onClose} variant="page">
      <ComposerShell
        header={<ComposerHeader onClose={onClose} onSave={save} title={isNew ? t.reports.raAdd : row.name} />}
        keypad={
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
            currency={row.currency}
            onCurrency={() => undefined}
          />
        }
      >
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => changeType(type)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-medium",
                row.type === type ? "bg-accent text-on-accent" : "bg-elevated text-muted",
              )}
            >
              {typeLabel(type, t)}
            </button>
          ))}
        </div>
        <TextLine value={row.name} onChange={(v) => patch({ name: v })} placeholder={t.common.name} />
        {payout ? (
          <>
            <LineRow
              label={t.reports.raMonthlyPayout}
              amount={amount || "0"}
              active
              onFocusAmount={() => undefined}
            />
            <p className="px-4 py-2 text-xs leading-5 text-muted">{t.reports.raPayoutHint}</p>
            <StepperRow label={t.reports.raStartPayout} value={startAge} min={40} max={90} onChange={setStartAge} />
            <YearChips years={years} onChange={setYears} lifetimeLabel={t.reports.raLifetime} yearsLabel={t.reports.raYears} />
          </>
        ) : (
          <>
            <LineRow label={t.reports.raBalance} amount={amount || "0"} active onFocusAmount={() => undefined} />
            <StepperRow label={t.reports.raAccess} value={row.accessibleAge} min={50} max={75} onChange={(n) => patch({ accessibleAge: n })} />
            <NumLine label={t.reports.raEmployee} value={row.employeeContributionAmount} onChange={(n) => patch({ employeeContributionAmount: n })} />
            <NumLine label={t.reports.raEmployer} value={row.employerContributionAmount} onChange={(n) => patch({ employerContributionAmount: n })} />
            <NumLine label={t.reports.raVoluntary} value={row.voluntaryContributionAmount} onChange={(n) => patch({ voluntaryContributionAmount: n })} />
            <NumLine label={`${t.reports.expectedReturn} %`} value={+(row.expectedAnnualReturnRate * 100).toFixed(2)} onChange={(n) => patch({ expectedAnnualReturnRate: n / 100 })} />
          </>
        )}
        <button type="button" className="h-11 w-full text-sm text-accent" onClick={() => setMore((v) => !v)}>
          {more ? t.reports.raHideMore : t.reports.raMore}
        </button>
        {more ? (
          <>
            <TextLine value={row.provider ?? ""} onChange={(v) => patch({ provider: v })} placeholder={t.reports.raProvider} />
            {payout ? (
              <NumLine label={t.reports.raBalance} value={row.currentBalance} onChange={(n) => patch({ currentBalance: n })} />
            ) : (
              <>
                <label className="block px-4 pt-2 text-xs text-muted">{t.reports.raStrategy}</label>
                <select
                  value={row.withdrawalStrategy}
                  onChange={(e) => patch({ withdrawalStrategy: e.target.value as RetirementWithdrawalStrategy })}
                  className="mx-4 mb-2 h-11 w-[calc(100%-2rem)] rounded-xl bg-elevated px-3 text-sm"
                >
                  <option value="annual_drawdown">{t.reports.raDrawdown}</option>
                  <option value="lump_sum">{t.reports.raLump}</option>
                  <option value="scheduled_income">{t.reports.raScheduled}</option>
                  <option value="do_not_use_in_projection">{t.reports.raIgnore}</option>
                </select>
                {row.withdrawalStrategy === "annual_drawdown" ? (
                  <NumLine label={t.reports.raDrawAmt} value={row.plannedAnnualWithdrawal ?? 0} onChange={(n) => patch({ plannedAnnualWithdrawal: n })} />
                ) : null}
                <NumLine label={t.reports.raFee} value={(row.annualFeeRate ?? 0) * 100} onChange={(n) => patch({ annualFeeRate: n / 100 })} />
                <label className="flex items-center gap-2 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={row.status === "active"}
                    onChange={(e) => patch({ status: e.target.checked ? "active" : "contribution_stopped" })}
                  />
                  {t.reports.raContributing}
                </label>
              </>
            )}
          </>
        ) : null}
        {isNew ? null : (
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center gap-1.5 text-sm text-expense"
            onClick={() => {
              void remove(row.id);
              onClose();
            }}
          >
            <Trash2 className="size-4" />
            {t.common.delete}
          </button>
        )}
      </ComposerShell>
    </Overlay>
  );
}

function StepperRow({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full bg-elevated text-lg"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className="w-10 text-center text-base font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full bg-elevated text-lg"
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

function YearChips({
  years,
  onChange,
  lifetimeLabel,
  yearsLabel,
}: {
  years: number;
  onChange: (n: number) => void;
  lifetimeLabel: string;
  yearsLabel: string;
}) {
  return (
    <div className="border-b border-line px-4 py-3">
      <div className="mb-2 text-sm">{yearsLabel}</div>
      <div className="flex flex-wrap gap-2">
        {YEAR_CHIPS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn("h-10 min-w-12 rounded-full px-3 text-sm font-medium", years === n ? "bg-accent text-on-accent" : "bg-elevated")}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(0)}
          className={cn("h-10 rounded-full px-3 text-sm font-medium", years === 0 ? "bg-accent text-on-accent" : "bg-elevated")}
        >
          {lifetimeLabel}
        </button>
      </div>
    </div>
  );
}

function NumLine({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      <span className="text-sm">{label}</span>
      <input
        inputMode="decimal"
        defaultValue={String(value)}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="h-10 w-28 bg-transparent text-right text-sm tabular-nums outline-none"
      />
    </label>
  );
}

function kindLabel(kind: Allowance["kind"], t: ReturnType<typeof useT>): string {
  if (kind === "oaa") return t.reports.oaa;
  if (kind === "annuity") return t.reports.annuity;
  return t.reports.addAllowance;
}

function HkIncomeSection({ onAddAnnuity }: { onAddAnnuity: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rows = useApp((s) => s.allowances);
  const add = useApp((s) => s.addAllowance);
  const update = useApp((s) => s.updateAllowance);
  const del = useApp((s) => s.deleteAllowance);
  const hasOaa = rows.some((a) => a.kind === "oaa");
  const [editing, setEditing] = useState<Allowance | "oaa" | "other" | null>(null);

  function seed(kind: "oaa" | "other"): Allowance {
    if (kind === "oaa") {
      return {
        id: newId(),
        label: "Old Age Allowance",
        labelZh: "生果金",
        monthly: 1620,
        startAge: 70,
        kind: "oaa",
        inflationAdjusted: true,
      };
    }
    return {
      id: newId(),
      label: "Other retirement income",
      labelZh: "其他退休收入",
      monthly: 0,
      startAge: 65,
      kind: "other",
      inflationAdjusted: false,
    };
  }

  return (
    <div className="pt-6">
      <h2 className="px-5 pb-1 text-sm font-medium text-muted">{t.reports.hkIncome}</h2>
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.reports.hkIncomeHint}</p>
      {rows.length ? (
        <Group>
          {rows.map((a, i) => (
            <div key={a.id}>
              {i > 0 ? <Hairline /> : null}
              <button type="button" className="flex w-full items-start gap-2 px-4 py-3 text-left" onClick={() => setEditing(a)}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{kindLabel(a.kind, t)}</div>
                  <div className="mt-0.5 text-xs tabular-nums text-muted">{allowanceLine(a, t, locale)}</div>
                </div>
                <Pencil className="mt-1 size-4 shrink-0 text-muted" />
              </button>
            </div>
          ))}
        </Group>
      ) : (
        <p className="px-5 pb-2 text-sm text-muted">{t.reports.raEmpty}</p>
      )}
      <div className="mx-4 mt-3 flex flex-col gap-2">
        {!hasOaa ? (
          <button type="button" className="h-11 rounded-xl bg-elevated text-sm font-medium" onClick={() => setEditing("oaa")}>
            {t.reports.addOaa}
          </button>
        ) : null}
        <button type="button" className="h-11 rounded-xl bg-elevated text-sm font-medium" onClick={onAddAnnuity}>
          {t.reports.addAnnuity}
        </button>
        <button type="button" className="h-11 rounded-xl bg-elevated text-sm" onClick={() => setEditing("other")}>
          {t.reports.addAllowance}
        </button>
      </div>
      {editing ? (
        <IncomeEditor
          initial={editing === "oaa" || editing === "other" ? seed(editing) : editing}
          isNew={editing === "oaa" || editing === "other"}
          onSave={(row) => {
            if (editing === "oaa" || editing === "other") void add(row);
            else void update(row);
            setEditing(null);
          }}
          onDelete={
            editing === "oaa" || editing === "other"
              ? undefined
              : () => {
                  void del(editing.id);
                  setEditing(null);
                }
          }
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function allowanceLine(a: Allowance, t: ReturnType<typeof useT>, locale: "en" | "zh-HK"): string {
  const name = pickName(locale, a.label, a.labelZh);
  const years = a.payoutYears ?? (a.endAge ? Math.max(0, a.endAge - a.startAge) : 0);
  if (a.kind === "annuity" && years > 0) {
    return t.reports.raPayoutSummary
      .replace("{amount}", money(a.monthly, "HKD"))
      .replace("{years}", String(years))
      .replace("{age}", String(a.startAge));
  }
  return `${name} · ${money(a.monthly, "HKD")} · ${t.reports.startAge} ${a.startAge}`;
}

function IncomeEditor({
  initial,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Allowance;
  isNew: boolean;
  onSave: (row: Allowance) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [row, setRow] = useState(initial);
  const yearsDefault = row.payoutYears ?? (row.endAge ? Math.max(0, row.endAge - row.startAge) : row.kind === "annuity" ? 10 : 0);
  const [years, setYears] = useState(yearsDefault);
  const [amount, setAmount] = useState(String(row.monthly || ""));
  const annuity = row.kind === "annuity";

  function save() {
    const monthly = resolveAmountInput(amount);
    const lifetime = years <= 0 || row.kind === "oaa";
    onSave({
      ...row,
      monthly,
      payoutYears: annuity ? years : undefined,
      endAge: annuity && !lifetime ? row.startAge + years : row.kind === "oaa" ? undefined : row.endAge,
    });
  }

  return (
    <Overlay open onClose={onClose} variant="page" layer="stack">
      <ComposerShell
        header={<ComposerHeader onClose={onClose} onSave={save} title={kindLabel(row.kind, t)} />}
        keypad={
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
        }
      >
        {row.kind === "other" ? (
          <TextLine
            value={row.labelZh || row.label}
            onChange={(v) => setRow((r) => ({ ...r, label: v, labelZh: v }))}
            placeholder={t.common.name}
          />
        ) : null}
        <LineRow label={t.reports.allowanceMonthly} amount={amount || "0"} active onFocusAmount={() => undefined} />
        <StepperRow label={t.reports.startAge} value={row.startAge} min={60} max={90} onChange={(n) => setRow((r) => ({ ...r, startAge: n }))} />
        {annuity ? <YearChips years={years} onChange={setYears} lifetimeLabel={t.reports.raLifetime} yearsLabel={t.reports.raPayoutYears} /> : null}
        <label className="flex items-center gap-2 px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={row.inflationAdjusted}
            onChange={(e) => setRow((r) => ({ ...r, inflationAdjusted: e.target.checked }))}
          />
          {t.reports.inflationAdj}
        </label>
        {isNew || !onDelete ? null : (
          <button type="button" className="flex h-11 w-full items-center justify-center gap-1.5 text-sm text-expense" onClick={onDelete}>
            <Trash2 className="size-4" />
            {t.common.delete}
          </button>
        )}
      </ComposerShell>
    </Overlay>
  );
}
