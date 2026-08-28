import { useMemo, useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { InfoButton, Overlay, ScreenHeader, StatusChip } from "@/components/shared";
import { money, pct, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import {
  asOfForMonth,
  budgetActuals,
  chargedDayOf,
  dailySpendable,
  spentInMonth,
} from "@/lib/calc/budget";
import { travelSpendYtd } from "@/lib/calc/trips";
import { monthKey } from "@/lib/calc/ledger";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import type { AdhocBudget, Category, Recurring, TxType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { toast } from "sonner";
import { defaultMortgageAccountId } from "@/lib/accounts";
import {
  categoryPath,
  isMortgageInterestCategory,
  isMortgagePrincipalCategory,
  isMortgageSplitCategory,
} from "@/lib/categories";
import { CategoryPicker } from "@/components/category-picker";

export function BudgetScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const budgets = useApp((s) => s.budgets);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const categories = useApp((s) => s.categories);
  const recurring = useApp((s) => s.recurring);
  const adhocBudgets = useApp((s) => s.adhocBudgets);
  const annual = useApp((s) => s.annualTravelBudget);
  const setAnnual = useApp((s) => s.setAnnualTravel);
  const updateBudget = useApp((s) => s.updateBudget);
  const month = monthKey();
  const asOf = asOfForMonth(month, todayISO());
  const actuals = budgetActuals(budgets, txs, month, rates, categories, recurring, asOf, adhocBudgets);
  const storedTotal = actuals.find((b) => b.id === MONTH_TOTAL_BUDGET_ID);
  const monthSpent = storedTotal?.spent ?? 0;
  const reserved = storedTotal?.reserved ?? 0;
  const adhocAmt = storedTotal?.adhoc ?? 0;
  const projected = storedTotal?.projected ?? 0;
  const monthCap = storedTotal?.monthly ?? 0;
  const monthUsed = monthSpent + reserved + adhocAmt + projected;
  const monthRemain = monthCap - monthSpent - reserved - adhocAmt;
  const monthRatio = storedTotal?.ratio ?? (monthCap > 0 ? monthUsed / monthCap : 0);
  const daysLeft = dailySpendable(monthRemain, asOf).daysLeft;
  const forecastRemain = monthRemain - projected;
  const overForecast = monthCap > 0 && forecastRemain < 0;
  const forecastDailyGap = forecastRemain / daysLeft;
  const categoryActuals = actuals.filter((b) => b.id !== MONTH_TOTAL_BUDGET_ID);
  const travelIds = new Set(categories.filter((c) => c.theme === "travel").map((c) => c.id));
  const spent = travelSpendYtd(txs, Number(month.slice(0, 4)), travelIds, rates);
  const travelPct = annual > 0 ? spent / annual : 0;
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [travelDraft, setTravelDraft] = useState("");
  const [editTravel, setEditTravel] = useState(false);
  const [editCap, setEditCap] = useState(false);
  const [capDraft, setCapDraft] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addCat, setAddCat] = useState("");
  const [addAmt, setAddAmt] = useState("");
  const [addName, setAddName] = useState("");
  const [regOpen, setRegOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<Recurring | null>(null);
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [editingAdhoc, setEditingAdhoc] = useState<AdhocBudget | null>(null);
  const editing = categoryActuals.find((b) => b.id === editId);
  const usedCatIds = new Set(budgets.map((b) => b.categoryId).filter(Boolean));
  const freeCats = categories.filter((c) => c.kind === "expense" && !usedCatIds.has(c.id));

  function openAdd() {
    setAddCat("");
    setAddAmt("");
    setAddName("");
    setAddOpen(true);
  }

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.budget.title}
        large
        right={
          <button
            type="button"
            aria-label={t.budget.addCategoryBudget}
            onClick={openAdd}
            className="grid size-11 place-items-center text-accent"
          >
            <Plus className="size-6" />
          </button>
        }
      />
      <p className="px-5 pb-3 text-xs text-muted">{t.budget.soft}</p>

      <div className="mx-4 rounded-xl bg-elevated px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => {
              setCapDraft(String(monthCap || ""));
              setEditCap(true);
            }}
          >
            <span className="text-sm text-muted">{t.budget.monthlyTotal}</span>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {money(monthUsed, "HKD")}
              <span className="ml-2 text-sm font-normal text-muted">
                / {monthCap > 0 ? money(monthCap, "HKD") : "—"}
              </span>
            </div>
          </button>
          <InfoButton k="cap" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
          <span>
            {t.budget.spent}: {money(monthSpent, "HKD")}
          </span>
          <span>
            {t.today.reservedRegulars}: {money(reserved, "HKD")}
          </span>
          {(storedTotal?.adhoc ?? 0) > 0 ? (
            <span>
              {t.budget.adhoc}: {money(storedTotal?.adhoc ?? 0, "HKD")}
            </span>
          ) : null}
          {projected > 0 ? (
            <span className="col-span-2">
              {t.budget.projected}: {money(projected, "HKD")}
            </span>
          ) : null}
          <span className="col-span-2 font-medium text-foreground">
            {t.budget.remaining}: {money(monthRemain, "HKD")}
          </span>
          {overForecast ? (
            <>
              <span className="col-span-2 font-medium text-expense">
                {t.budget.forecastShortfall}: {money(Math.abs(forecastRemain), "HKD")}
              </span>
              <span className="col-span-2 font-medium text-expense">
                {t.budget.forecastDailyGap}: {money(forecastDailyGap, "HKD", { sign: true })}
              </span>
            </>
          ) : null}
        </div>
        {monthCap > 0 ? <Bar value={monthRatio} tight /> : <p className="mt-2 text-xs text-faint">{t.budget.soft}</p>}
      </div>

      <RegularsBlock
        month={month}
        onAdd={() => {
          setEditingReg(null);
          setRegOpen(true);
        }}
        onEdit={(r) => {
          setEditingReg(r);
          setRegOpen(true);
        }}
      />
      <AdhocBlock
        month={month}
        onAdd={() => {
          setEditingAdhoc(null);
          setAdhocOpen(true);
        }}
        onEdit={(row) => {
          setEditingAdhoc(row);
          setAdhocOpen(true);
        }}
      />

      <div className="mx-4 mt-3 rounded-xl bg-elevated px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setTravelDraft(String(annual));
              setEditTravel(true);
            }}
            className="min-w-0 flex-1 text-left"
          >
            <span className="text-sm text-muted">{t.budget.annualTravel}</span>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {money(spent, "HKD")}
              <span className="ml-2 text-sm font-normal text-muted">/ {money(annual, "HKD")}</span>
            </div>
          </button>
          <InfoButton k="trip" />
        </div>
        <Bar value={travelPct} />
      </div>

      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.budget.byCategory}</h2>
      <div className="divide-y divide-line">
        {categoryActuals.map((b) => {
          const ratio = b.ratio;
          const status = ratio >= 1.2 ? "at-risk" : ratio >= 0.8 ? "watch" : "on-track";
          return (
            <button
              key={b.id}
              type="button"
              className="w-full px-5 py-3 text-left"
              onClick={() => {
                setEditId(b.id);
                setDraft(String(b.monthly));
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px]">{pickName(locale, b.label, b.labelZh)}</div>
                  <div className="text-xs text-muted">
                    {money(b.spent, "HKD")} / {money(b.monthly, "HKD")} · {pct(ratio)} {t.budget.used}
                  </div>
                </div>
                <StatusChip status={status} />
              </div>
              <Bar value={ratio} />
            </button>
          );
        })}
      </div>
      <div className="px-5 pt-4">
        <button
          type="button"
          onClick={openAdd}
          className="h-11 w-full rounded-xl bg-elevated text-sm font-medium"
        >
          {t.budget.addCategoryBudget}
        </button>
      </div>

      <Overlay open={!!editing} onClose={() => setEditId(null)} title={t.budget.title}>
        <div className="px-5 pb-8">
          <p className="text-sm text-muted">
            {editing ? pickName(locale, editing.label, editing.labelZh) : ""}
          </p>
          <input
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mt-3 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
            onClick={async () => {
              if (!editing) return;
              await updateBudget({ ...editing, monthly: Number(draft) || 0, spent: editing.spent });
              toast(t.add.savedToast);
              setEditId(null);
            }}
          >
            {t.add.save}
          </button>
        </div>
      </Overlay>

      <Overlay open={editCap} onClose={() => setEditCap(false)} title={t.budget.monthlyTotal}>
        <div className="px-5 pb-8">
          <p className="text-sm text-muted">{t.budget.soft}</p>
          <input
            inputMode="decimal"
            value={capDraft}
            onChange={(e) => setCapDraft(e.target.value)}
            className="mt-3 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
            onClick={async () => {
              await updateBudget({
                id: MONTH_TOTAL_BUDGET_ID,
                label: "Monthly total",
                labelZh: "本月總額",
                monthly: Number(capDraft) || 0,
                spent: monthSpent,
              });
              toast(t.add.savedToast);
              setEditCap(false);
            }}
          >
            {t.add.save}
          </button>
        </div>
      </Overlay>

      <Overlay open={editTravel} onClose={() => setEditTravel(false)} title={t.budget.annualTravel}>
        <div className="px-5 pb-8">
          <input
            inputMode="decimal"
            value={travelDraft}
            onChange={(e) => setTravelDraft(e.target.value)}
            className="mt-3 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
            onClick={async () => {
              await setAnnual(Number(travelDraft) || 0);
              toast(t.add.savedToast);
              setEditTravel(false);
            }}
          >
            {t.add.save}
          </button>
        </div>
      </Overlay>

      <Overlay open={addOpen} onClose={() => setAddOpen(false)} title={t.budget.addCategoryBudget}>
        <div className="px-5 pb-8">
          <label className="block py-2">
            <span className="text-xs text-muted">{t.budget.pickCategory}</span>
            <select
              value={addCat}
              onChange={(e) => setAddCat(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
            >
              <option value="">{t.budget.noCategory}</option>
              {freeCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickName(locale, c.name, c.nameZh)}
                </option>
              ))}
            </select>
          </label>
          {!addCat ? (
            <label className="block py-2">
              <span className="text-xs text-muted">{t.budget.customName}</span>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder={t.budget.monthlyTotal}
                className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
              />
            </label>
          ) : null}
          <label className="block py-2">
            <span className="text-xs text-muted">{t.add.amount}</span>
            <input
              inputMode="decimal"
              value={addAmt}
              onChange={(e) => setAddAmt(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
            />
          </label>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
            onClick={async () => {
              const amt = Number(addAmt) || 0;
              if (!addCat) {
                const name = addName.trim();
                if (!name) {
                  await updateBudget({
                    id: MONTH_TOTAL_BUDGET_ID,
                    label: "Monthly total",
                    labelZh: "本月總額",
                    monthly: amt,
                    spent: monthSpent,
                  });
                } else {
                  await updateBudget({
                    id: `b-${newId().slice(0, 8)}`,
                    label: name,
                    labelZh: name,
                    monthly: amt,
                    spent: 0,
                  });
                }
              } else {
                const cat = categories.find((c) => c.id === addCat);
                if (!cat) return;
                await updateBudget({
                  id: `b-${newId().slice(0, 8)}`,
                  categoryId: cat.id,
                  label: cat.name,
                  labelZh: cat.nameZh,
                  monthly: amt,
                  spent: 0,
                });
              }
              toast(t.add.savedToast);
              setAddOpen(false);
            }}
          >
            {t.add.save}
          </button>
        </div>
      </Overlay>

      <RegularEditor
        open={regOpen}
        initial={editingReg}
        onClose={() => {
          setRegOpen(false);
          setEditingReg(null);
        }}
      />
      <AdhocEditor
        open={adhocOpen}
        initial={editingAdhoc}
        month={month}
        onClose={() => {
          setAdhocOpen(false);
          setEditingAdhoc(null);
        }}
      />
    </div>
  );
}

function Bar({ value, tight }: { value: number; tight?: boolean }) {
  const tone = tight
    ? value > 1.1
      ? "bg-expense"
      : value > 1
        ? "bg-watch"
        : "bg-income"
    : value >= 1.2
      ? "bg-expense"
      : value >= 1
        ? "bg-watch"
        : "bg-income";
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ring-track">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}

function nextDateForDay(day: number): string {
  const charged = Math.min(28, Math.max(1, day));
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  let next = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(charged)}`;
  if (next < now.toISOString().slice(0, 10)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, charged);
    next = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return next;
}

function RegularsBlock({
  onAdd,
  onEdit,
}: {
  month: string;
  onAdd: () => void;
  onEdit: (r: Recurring) => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const recurring = useApp((s) => s.recurring);
  const txs = useApp((s) => s.transactions);
  const today = Number(todayISO().slice(8, 10));
  const rows = recurring
    .filter((r) => r.frequency === "monthly" && r.type !== "miles")
    .sort((a, b) => chargedDayOf(a) - chargedDayOf(b) || a.label.localeCompare(b.label));
  const month = todayISO().slice(0, 7);

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between px-5 pb-1">
        <h2 className="text-sm font-medium text-muted">{t.budget.monthlyRegulars}</h2>
        <button type="button" onClick={onAdd} className="text-sm font-medium text-accent">
          {t.budget.addRegular}
        </button>
      </div>
      <p className="px-5 pb-2 text-xs text-faint">{t.budget.regularsHint}</p>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">{t.budget.addRegular}</p>
      ) : (
        <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
          {rows.map((r) => {
            const day = chargedDayOf(r);
            const charged = day <= today;
            const linked = txs.find((tx) => tx.recurringId === r.id && tx.date.startsWith(month));
            return (
              <button
                key={r.id}
                type="button"
                className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-0"
                onClick={() => onEdit(r)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{pickName(locale, r.label, r.labelZh)}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span className="tabular-nums">{money(r.amount, r.currency)}</span>
                    <span>·</span>
                    <span>{locale === "zh-HK" ? `${day}日` : `day ${day}`}</span>
                    <span>·</span>
                    <span>
                      {r.type === "income"
                        ? t.add.income
                        : r.type === "transfer"
                          ? r.countsAsExpense
                            ? `${t.add.transfer} · ${t.add.principal}`
                            : t.add.transfer
                          : t.add.expense}
                    </span>
                    {linked?.planned ? (
                      <>
                        <span>·</span>
                        <span className="text-accent">{t.add.scheduled}</span>
                      </>
                    ) : null}
                    {r.living ? (
                      <>
                        <span>·</span>
                        <span className="text-accent">{t.reports.living}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-1 text-xs font-medium",
                    charged ? "bg-success-soft text-income" : "bg-accent-soft text-accent",
                  )}
                >
                  {charged ? t.budget.charged : t.budget.upcomingStatus}
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdhocBlock({
  month,
  onAdd,
  onEdit,
}: {
  month: string;
  onAdd: () => void;
  onEdit: (row: AdhocBudget) => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rows = useApp((s) => s.adhocBudgets)
    .filter((a) => a.month === month || a.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between px-5 pb-1">
        <h2 className="text-sm font-medium text-muted">{t.budget.adhoc}</h2>
        <button type="button" onClick={onAdd} className="text-sm font-medium text-accent">
          {t.budget.addAdhoc}
        </button>
      </div>
      <p className="px-5 pb-2 text-xs text-faint">{t.budget.adhocHint}</p>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">{t.budget.addAdhoc}</p>
      ) : (
        <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-0"
              onClick={() => onEdit(row)}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{pickName(locale, row.label, row.labelZh)}</div>
                <div className="mt-0.5 text-xs text-muted tabular-nums">{row.date.slice(8)}</div>
              </div>
              <span className="text-[15px] font-semibold tabular-nums text-foreground">
                {money(-row.amount, row.currency, { sign: true })}
              </span>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RegularEditor({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: Recurring | null;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Overlay open={open} onClose={onClose} title={initial ? t.common.edit : t.budget.addRegular} variant="page">
      {open ? <RegularEditorBody key={initial?.id ?? "new"} initial={initial} onClose={onClose} /> : null}
    </Overlay>
  );
}

function splitMate(r: Recurring | null, all: Recurring[]): Recurring | null {
  if (!r?.splitWithId) return null;
  return all.find((x) => x.id === r.splitWithId) ?? null;
}

function splitParts(initial: Recurring | null, all: Recurring[]) {
  const mate = splitMate(initial, all);
  const pair = [initial, mate].filter((x): x is Recurring => Boolean(x));
  const principal = pair.find((r) => r.type === "transfer" && r.countsAsExpense) ?? null;
  const interest =
    pair.find((r) => r.type === "expense" && r.id !== principal?.id) ??
    (initial && initial.type === "expense" && !principal ? initial : null);
  return { principal, interest, mate };
}

function stripSplitSuffix(label: string): string {
  return label.replace(/\s*[·•]\s*(本金|利息|Principal|Interest)\s*$/i, "").trim();
}

function RegularEditorBody({
  initial,
  onClose,
}: {
  initial: Recurring | null;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const recurring = useApp((s) => s.recurring);
  const mortgage = useApp((s) => s.mortgage);
  const budgets = useApp((s) => s.budgets);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const addRecurring = useApp((s) => s.addRecurring);
  const updateRecurring = useApp((s) => s.updateRecurring);
  const deleteRecurring = useApp((s) => s.deleteRecurring);
  const moneyAccounts = accounts.filter((a) => a.currency !== "MILES" && !a.hidden);
  const destAccounts = moneyAccounts.filter((a) => a.type === "mortgage" || a.type === "loan");
  const { principal: p0, interest: i0 } = splitParts(initial, recurring);
  const alreadySplit = Boolean(p0 && i0 && p0.id !== i0.id);
  const [kind, setKind] = useState<TxType>(alreadySplit || p0 ? "expense" : (initial?.type ?? "expense"));
  const [name, setName] = useState(
    initial ? stripSplitSuffix(pickName(locale, initial.label, initial.labelZh)) : "",
  );
  const [amount, setAmount] = useState(
    alreadySplit ? String((p0?.amount ?? 0) + (i0?.amount ?? 0)) : initial ? String(initial.amount) : "",
  );
  const [principalAmt, setPrincipalAmt] = useState(p0 ? String(p0.amount) : alreadySplit ? "0" : "");
  const [interestAmt, setInterestAmt] = useState(alreadySplit && i0 ? String(i0.amount) : "");
  const [splitMortgage, setSplitMortgage] = useState(alreadySplit);
  const [day, setDay] = useState(String(initial ? chargedDayOf(initial) : 1));
  const [accountId, setAccountId] = useState(initial?.accountId ?? moneyAccounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(
    initial?.toAccountId ?? moneyAccounts.find((a) => a.id !== (initial?.accountId ?? moneyAccounts[0]?.id))?.id ?? "",
  );
  const [mortgageToId, setMortgageToId] = useState(
    p0?.toAccountId ?? defaultMortgageAccountId(accounts, undefined, mortgage?.accountId) ?? "",
  );
  const [categoryId, setCategoryId] = useState(
    (alreadySplit ? i0?.categoryId ?? p0?.categoryId : initial?.categoryId) ?? "",
  );
  const [living, setLiving] = useState(Boolean(initial?.living ?? alreadySplit));
  const [pickCat, setPickCat] = useState(false);
  const cat = categories.find((c) => c.id === categoryId);
  const mortgageSplitCat = kind === "expense" && isMortgageSplitCategory(cat, categories);
  const showSplit = kind === "expense" && (mortgageSplitCat || alreadySplit || Boolean(p0));
  const spendMap = useMemo(() => {
    const month = todayISO().slice(0, 7);
    const map = new Map<string, number>();
    for (const c of categories) {
      map.set(c.id, spentInMonth(txs, month, rates, { categoryId: c.id }));
    }
    return map;
  }, [categories, txs, rates]);

  function applyCategory(next: Category | null) {
    const real = next ? (categories.find((c) => c.id === next.id) ?? next) : null;
    setCategoryId(real?.id ?? "");
    if (real && kind === "expense" && isMortgageSplitCategory(real, categories)) {
      setSplitMortgage(true);
      setPrincipalAmt((p) => p || amount || "0");
      setInterestAmt((i) => i || "0");
      setLiving(true);
      setMortgageToId(defaultMortgageAccountId(accounts, mortgageToId, mortgage?.accountId) ?? "");
    } else if (!alreadySplit) {
      setSplitMortgage(false);
    }
  }

  async function upsert(r: Recurring) {
    if (recurring.some((x) => x.id === r.id)) await updateRecurring(r);
    else await addRecurring(r);
  }

  async function save() {
    const n = name.trim();
    if (!n || !accountId) return;
    const charged = Math.min(28, Math.max(1, Number(day) || 1));
    const nextDate = nextDateForDay(charged);
    const pAmt = Number(principalAmt) || 0;
    const iAmt = Number(interestAmt) || 0;
    const { principal: curP, interest: curI, mate } = splitParts(initial, recurring);

    if (splitMortgage && showSplit) {
      if (pAmt + iAmt <= 0) {
        toast(t.add.needAmount);
        return;
      }
      if (pAmt > 0 && !mortgageToId) {
        toast(t.add.needMortgageAccount);
        return;
      }
      const pCat =
        (cat && isMortgagePrincipalCategory(cat) ? cat.id : undefined) ??
        categories.find((c) => isMortgagePrincipalCategory(c))?.id ??
        "mortgage-p";
      const iCat =
        (cat && isMortgageInterestCategory(cat) ? cat.id : undefined) ??
        categories.find((c) => isMortgageInterestCategory(c))?.id ??
        "mortgage-i";
      const pLabel = `${n} · ${t.add.principal}`;
      const iLabel = `${n} · ${t.add.interest}`;
      const keep = new Set<string>();
      if (pAmt > 0 && iAmt > 0) {
        const pid = curP?.id ?? `r-${newId().slice(0, 8)}`;
        const iid =
          curI && curI.id !== pid
            ? curI.id
            : initial && initial.id !== pid && initial.type === "expense"
              ? initial.id
              : `r-${newId().slice(0, 8)}`;
        keep.add(pid);
        keep.add(iid);
        await upsert({
          id: pid,
          type: "transfer",
          label: pLabel,
          labelZh: pLabel,
          amount: pAmt,
          currency: "HKD",
          accountId,
          toAccountId: mortgageToId,
          categoryId: pCat,
          frequency: "monthly",
          nextDate,
          chargedDay: charged,
          essential: true,
          living,
          countsAsExpense: true,
          splitWithId: iid,
        });
        await upsert({
          id: iid,
          type: "expense",
          label: iLabel,
          labelZh: iLabel,
          amount: iAmt,
          currency: "HKD",
          accountId,
          categoryId: iCat,
          frequency: "monthly",
          nextDate,
          chargedDay: charged,
          essential: true,
          living,
          splitWithId: pid,
        });
      } else if (pAmt > 0) {
        const pid = curP?.id ?? initial?.id ?? `r-${newId().slice(0, 8)}`;
        keep.add(pid);
        await upsert({
          id: pid,
          type: "transfer",
          label: pLabel,
          labelZh: pLabel,
          amount: pAmt,
          currency: "HKD",
          accountId,
          toAccountId: mortgageToId,
          categoryId: pCat,
          frequency: "monthly",
          nextDate,
          chargedDay: charged,
          essential: true,
          living,
          countsAsExpense: true,
        });
      } else {
        const iid = curI?.id ?? initial?.id ?? `r-${newId().slice(0, 8)}`;
        keep.add(iid);
        await upsert({
          id: iid,
          type: "expense",
          label: iLabel,
          labelZh: iLabel,
          amount: iAmt,
          currency: "HKD",
          accountId,
          categoryId: iCat,
          frequency: "monthly",
          nextDate,
          chargedDay: charged,
          essential: true,
          living,
        });
      }
      for (const extra of [curP, curI, initial]) {
        if (extra && !keep.has(extra.id)) await deleteRecurring(extra.id);
      }
    } else {
      const id = initial?.id ?? `r-${newId().slice(0, 8)}`;
      await upsert({
        id,
        type: kind,
        label: n,
        labelZh: n,
        amount: Number(amount) || 0,
        currency: "HKD",
        accountId,
        toAccountId: kind === "transfer" ? toAccountId || undefined : undefined,
        categoryId: kind === "transfer" ? undefined : categoryId || undefined,
        frequency: "monthly",
        nextDate,
        chargedDay: charged,
        essential: kind === "expense",
        living: kind === "expense" ? living : false,
      });
      for (const extra of [mate, curP, curI]) {
        if (extra && extra.id !== id) await deleteRecurring(extra.id);
      }
    }
    toast(t.add.savedToast);
    onClose();
  }

  async function remove() {
    const { principal, interest, mate } = splitParts(initial, recurring);
    const ids = new Set([principal?.id, interest?.id, mate?.id, initial?.id].filter(Boolean) as string[]);
    for (const id of ids) await deleteRecurring(id);
    onClose();
  }

  return (
    <div className="px-5 pb-8">
      {splitMortgage && showSplit ? null : (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.more.kind}</span>
          <select
            value={kind}
            onChange={(e) => {
              const next = e.target.value as TxType;
              setKind(next);
              if (next !== "expense") setSplitMortgage(false);
            }}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          >
            <option value="expense">{t.add.expense}</option>
            <option value="income">{t.add.income}</option>
            <option value="transfer">{t.add.transfer}</option>
          </select>
        </label>
      )}
      <label className="block py-2">
        <span className="text-xs text-muted">{t.budget.regularName}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      {splitMortgage && showSplit ? (
        <div className="grid grid-cols-2 gap-3 py-2">
          <label>
            <span className="text-xs text-muted">{t.add.principal}</span>
            <input
              inputMode="decimal"
              value={principalAmt}
              onChange={(e) => {
                setPrincipalAmt(e.target.value);
                const p = Number(e.target.value) || 0;
                const i = Number(interestAmt) || 0;
                setAmount(String(p + i));
              }}
              className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 tabular-nums outline-none"
            />
          </label>
          <label>
            <span className="text-xs text-muted">{t.add.interest}</span>
            <input
              inputMode="decimal"
              value={interestAmt}
              onChange={(e) => {
                setInterestAmt(e.target.value);
                const i = Number(e.target.value) || 0;
                const p = Number(principalAmt) || 0;
                setAmount(String(p + i));
              }}
              className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 tabular-nums outline-none"
            />
          </label>
        </div>
      ) : (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.amount}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
        </label>
      )}
      <label className="block py-2">
        <span className="text-xs text-muted">{t.budget.chargedDay}</span>
        <input
          inputMode="numeric"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{kind === "transfer" && !splitMortgage ? t.add.from : t.add.account}</span>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        >
          {moneyAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {pickName(locale, a.name, a.nameZh)}
            </option>
          ))}
        </select>
      </label>
      {kind === "transfer" && !splitMortgage ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.to}</span>
          <select
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          >
            {moneyAccounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {pickName(locale, a.name, a.nameZh)}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      {splitMortgage && showSplit ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.mortgageAccount}</span>
          <select
            value={mortgageToId}
            onChange={(e) => setMortgageToId(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          >
            <option value="">{t.add.none}</option>
            {(destAccounts.length
              ? [
                  ...destAccounts.filter((a) => a.id !== accountId),
                  ...moneyAccounts.filter(
                    (a) => a.id !== accountId && !destAccounts.some((d) => d.id === a.id),
                  ),
                ]
              : moneyAccounts.filter((a) => a.id !== accountId)
            ).map((a) => (
              <option key={a.id} value={a.id}>
                {pickName(locale, a.name, a.nameZh)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {kind !== "transfer" || splitMortgage ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.budget.pickCategory}</span>
          <button
            type="button"
            onClick={() => setPickCat(true)}
            className="mt-1 flex h-11 w-full items-center justify-between rounded-lg bg-elevated px-3 text-left outline-none"
          >
            <span className={cn("truncate", !cat && "text-faint")}>
              {cat ? categoryPath(categories, cat, locale) : t.common.none}
            </span>
            <ChevronRight className="size-4 shrink-0 text-faint" />
          </button>
        </label>
      ) : null}
      {showSplit ? (
        <button
          type="button"
          onClick={() => {
            setSplitMortgage((v) => {
              const next = !v;
              if (next) {
                setPrincipalAmt(amount || "0");
                setInterestAmt(interestAmt || "0");
                setMortgageToId(
                  defaultMortgageAccountId(accounts, mortgageToId, mortgage?.accountId) ?? "",
                );
              }
              return next;
            });
          }}
          className="mt-2 flex w-full items-start gap-3 rounded-xl bg-elevated px-3 py-3 text-left"
        >
          <span
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded border",
              splitMortgage ? "border-accent bg-accent text-on-accent" : "border-line bg-background",
            )}
            aria-hidden
          >
            {splitMortgage ? "✓" : ""}
          </span>
          <span>
            <span className="block text-sm font-medium">{t.add.splitMortgage}</span>
            <span className="mt-0.5 block text-xs text-muted">{t.add.splitMortgageHint}</span>
          </span>
        </button>
      ) : null}
      {kind === "expense" || (splitMortgage && showSplit) ? (
        <button
          type="button"
          onClick={() => setLiving((v) => !v)}
          className="mt-2 flex w-full items-start gap-3 rounded-xl bg-elevated px-3 py-3 text-left"
        >
          <span
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded border",
              living ? "border-accent bg-accent text-on-accent" : "border-line bg-background",
            )}
            aria-hidden
          >
            {living ? "✓" : ""}
          </span>
          <span>
            <span className="block text-sm font-medium">{t.budget.livingRegular}</span>
            <span className="mt-0.5 block text-xs text-muted">{t.budget.livingRegularHint}</span>
          </span>
        </button>
      ) : null}
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        onClick={() => void save()}
      >
        {t.add.save}
      </button>
      {initial ? (
        <button
          type="button"
          className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-expense"
          onClick={() => void remove()}
        >
          {t.tx.delete}
        </button>
      ) : null}
      <Overlay open={pickCat} onClose={() => setPickCat(false)} variant="page">
        <CategoryPicker
          categories={categories}
          kind={kind === "income" ? "income" : "expense"}
          budgets={budgets}
          spentById={spendMap}
          onClose={() => setPickCat(false)}
          onSelect={(c) => {
            applyCategory(c);
            setPickCat(false);
          }}
        />
      </Overlay>
    </div>
  );
}

function AdhocEditor({
  open,
  initial,
  month,
  onClose,
}: {
  open: boolean;
  initial: AdhocBudget | null;
  month: string;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Overlay open={open} onClose={onClose} title={initial ? t.common.edit : t.budget.addAdhoc} variant="page">
      {open ? (
        <AdhocEditorBody key={initial?.id ?? "new"} initial={initial} month={month} onClose={onClose} />
      ) : null}
    </Overlay>
  );
}

function AdhocEditorBody({
  initial,
  month,
  onClose,
}: {
  initial: AdhocBudget | null;
  month: string;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const addAdhocBudget = useApp((s) => s.addAdhocBudget);
  const updateAdhocBudget = useApp((s) => s.updateAdhocBudget);
  const deleteAdhocBudget = useApp((s) => s.deleteAdhocBudget);
  const [name, setName] = useState(initial ? pickName(locale, initial.label, initial.labelZh) : "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const today = todayISO();
  const [date, setDate] = useState(initial?.date ?? (today.startsWith(month) ? today : `${month}-15`));

  return (
    <div className="px-5 pb-8">
      <p className="text-xs text-muted">{t.budget.adhocHint}</p>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.budget.regularName}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.amount}</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.date}</span>
        <input
          type="date"
          value={date}
          min={`${month}-01`}
          max={`${month}-31`}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        onClick={async () => {
          const n = name.trim();
          const amt = Number(amount) || 0;
          if (!n || amt <= 0) return;
          const iso = date.startsWith(month) ? date : `${month}-15`;
          const row: AdhocBudget = {
            id: initial?.id ?? newId(),
            label: n,
            labelZh: n,
            amount: amt,
            currency: "HKD",
            month,
            date: iso,
          };
          if (initial) await updateAdhocBudget(row);
          else await addAdhocBudget(row);
          toast(t.add.savedToast);
          onClose();
        }}
      >
        {t.add.save}
      </button>
      {initial ? (
        <button
          type="button"
          className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-expense"
          onClick={async () => {
            await deleteAdhocBudget(initial.id);
            onClose();
          }}
        >
          {t.tx.delete}
        </button>
      ) : null}
    </div>
  );
}

