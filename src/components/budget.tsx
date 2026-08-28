import { useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { InfoButton, Overlay, ScreenHeader, StatusChip } from "@/components/shared";
import { money, pct, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import {
  asOfForMonth,
  budgetActuals,
  chargedDayOf,
  dailySpendable,
} from "@/lib/calc/budget";
import { travelSpendYtd } from "@/lib/calc/trips";
import { inMonth, monthKey } from "@/lib/calc/ledger";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import type { Recurring, Transaction, TxType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { toast } from "sonner";

export function BudgetScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const budgets = useApp((s) => s.budgets);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const categories = useApp((s) => s.categories);
  const recurring = useApp((s) => s.recurring);
  const annual = useApp((s) => s.annualTravelBudget);
  const setAnnual = useApp((s) => s.setAnnualTravel);
  const updateBudget = useApp((s) => s.updateBudget);
  const addRecurring = useApp((s) => s.addRecurring);
  const updateRecurring = useApp((s) => s.updateRecurring);
  const deleteRecurring = useApp((s) => s.deleteRecurring);
  const month = monthKey();
  const asOf = asOfForMonth(month, todayISO());
  const actuals = budgetActuals(budgets, txs, month, rates, categories, recurring, asOf);
  const storedTotal = actuals.find((b) => b.id === MONTH_TOTAL_BUDGET_ID);
  const monthSpent = storedTotal?.spent ?? 0;
  const reserved = storedTotal?.reserved ?? 0;
  const projected = storedTotal?.projected ?? 0;
  const monthCap = storedTotal?.monthly ?? 0;
  const monthUsed = monthSpent + reserved + projected;
  const monthRemain = monthCap - monthSpent - reserved;
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
  const [editingAdhoc, setEditingAdhoc] = useState<Transaction | null>(null);
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
        onDelete={(id) => void deleteRecurring(id)}
      />
      <AdhocBlock
        month={month}
        onAdd={() => {
          setEditingAdhoc(null);
          setAdhocOpen(true);
        }}
        onEdit={(tx) => {
          setEditingAdhoc(tx);
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
        onSave={async (r) => {
          if (editingReg) await updateRecurring(r);
          else await addRecurring(r);
          toast(t.add.savedToast);
          setRegOpen(false);
          setEditingReg(null);
        }}
        onDelete={
          editingReg
            ? async () => {
                await deleteRecurring(editingReg.id);
                setRegOpen(false);
                setEditingReg(null);
              }
            : undefined
        }
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
  onDelete: (id: string) => void;
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
                      {r.type === "income" ? t.add.income : r.type === "transfer" ? t.add.transfer : t.add.expense}
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
  onEdit: (tx: Transaction) => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const rows = txs
    .filter((tx) => tx.planned && !tx.recurringId && inMonth(tx.date, month) && tx.type !== "miles")
    .sort((a, b) => a.date.localeCompare(b.date) || a.payee.localeCompare(b.payee));

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
          {rows.map((tx) => (
            <button
              key={tx.id}
              type="button"
              className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-0"
              onClick={() => onEdit(tx)}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{pickName(locale, tx.payee, tx.payeeZh)}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {tx.date.slice(8)} · {tx.type === "income" ? t.add.income : tx.type === "transfer" ? t.add.transfer : t.add.expense}
                </div>
              </div>
              <span
                className={cn(
                  "text-[15px] font-semibold tabular-nums",
                  tx.type === "income" ? "text-income" : "text-foreground",
                )}
              >
                {money(tx.type === "expense" ? -tx.amount : tx.amount, tx.currency, { sign: true })}
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
  onSave,
  onDelete,
}: {
  open: boolean;
  initial: Recurring | null;
  onClose: () => void;
  onSave: (r: Recurring) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const t = useT();
  return (
    <Overlay open={open} onClose={onClose} title={initial ? t.common.edit : t.budget.addRegular} variant="page">
      {open ? (
        <RegularEditorBody key={initial?.id ?? "new"} initial={initial} onSave={onSave} onDelete={onDelete} />
      ) : null}
    </Overlay>
  );
}

function RegularEditorBody({
  initial,
  onSave,
  onDelete,
}: {
  initial: Recurring | null;
  onSave: (r: Recurring) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const moneyAccounts = accounts.filter((a) => a.currency !== "MILES" && !a.hidden);
  const [kind, setKind] = useState<TxType>(initial?.type ?? "expense");
  const [name, setName] = useState(initial ? pickName(locale, initial.label, initial.labelZh) : "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [day, setDay] = useState(String(initial ? chargedDayOf(initial) : 1));
  const [accountId, setAccountId] = useState(initial?.accountId ?? moneyAccounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(
    initial?.toAccountId ?? moneyAccounts.find((a) => a.id !== (initial?.accountId ?? moneyAccounts[0]?.id))?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [living, setLiving] = useState(Boolean(initial?.living));

  return (
    <div className="px-5 pb-8">
      <label className="block py-2">
        <span className="text-xs text-muted">{t.more.kind}</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as TxType)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        >
          <option value="expense">{t.add.expense}</option>
          <option value="income">{t.add.income}</option>
          <option value="transfer">{t.add.transfer}</option>
        </select>
      </label>
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
        <span className="text-xs text-muted">{t.budget.chargedDay}</span>
        <input
          inputMode="numeric"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.account}</span>
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
      {kind === "transfer" ? (
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
      {kind !== "transfer" ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.budget.pickCategory}</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          >
            <option value="">{t.common.none}</option>
            {categories
              .filter((c) => (kind === "income" ? c.kind === "income" : c.kind === "expense"))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {pickName(locale, c.name, c.nameZh)}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      {kind === "expense" ? (
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
        onClick={async () => {
          const n = name.trim();
          if (!n || !accountId) return;
          const charged = Math.min(28, Math.max(1, Number(day) || 1));
          await onSave({
            id: initial?.id ?? `r-${newId().slice(0, 8)}`,
            type: kind,
            label: n,
            labelZh: n,
            amount: Number(amount) || 0,
            currency: "HKD",
            accountId,
            toAccountId: kind === "transfer" ? toAccountId || undefined : undefined,
            categoryId: kind === "transfer" ? undefined : categoryId || undefined,
            frequency: "monthly",
            nextDate: nextDateForDay(charged),
            chargedDay: charged,
            essential: kind === "expense",
            living: kind === "expense" ? living : false,
          });
        }}
      >
        {t.add.save}
      </button>
      {initial && onDelete ? (
        <button
          type="button"
          className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-expense"
          onClick={() => void onDelete()}
        >
          {t.tx.delete}
        </button>
      ) : null}
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
  initial: Transaction | null;
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
  initial: Transaction | null;
  month: string;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const addTransaction = useApp((s) => s.addTransaction);
  const updateTransaction = useApp((s) => s.updateTransaction);
  const deleteTransaction = useApp((s) => s.deleteTransaction);
  const moneyAccounts = accounts.filter((a) => a.currency !== "MILES" && !a.hidden);
  const [kind, setKind] = useState<TxType>(initial?.type ?? "expense");
  const [name, setName] = useState(initial ? pickName(locale, initial.payee, initial.payeeZh) : "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? `${month}-28`);
  const [accountId, setAccountId] = useState(initial?.accountId ?? moneyAccounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(
    initial?.toAccountId ?? moneyAccounts.find((a) => a.id !== (initial?.accountId ?? moneyAccounts[0]?.id))?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const today = todayISO();

  return (
    <div className="px-5 pb-8">
      <p className="text-xs text-muted">{t.budget.adhocHint}</p>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.more.kind}</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as TxType)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        >
          <option value="expense">{t.add.expense}</option>
          <option value="income">{t.add.income}</option>
          <option value="transfer">{t.add.transfer}</option>
        </select>
      </label>
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
      <label className="block py-2">
        <span className="text-xs text-muted">{kind === "transfer" ? t.add.from : t.add.account}</span>
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
      {kind === "transfer" ? (
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
      ) : (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.budget.pickCategory}</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          >
            <option value="">{t.common.none}</option>
            {categories
              .filter((c) => (kind === "income" ? c.kind === "income" : c.kind === "expense"))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {pickName(locale, c.name, c.nameZh)}
                </option>
              ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        onClick={async () => {
          const n = name.trim();
          const amt = Number(amount) || 0;
          if (!n || !accountId || amt <= 0) return;
          const iso = date.startsWith(month) ? date : `${month}-28`;
          const planned = iso > today;
          const acc = moneyAccounts.find((a) => a.id === accountId);
          const tx: Transaction = {
            id: initial?.id ?? newId(),
            type: kind,
            amount: amt,
            currency: acc?.currency === "MILES" ? "HKD" : (acc?.currency ?? "HKD"),
            accountId,
            toAccountId: kind === "transfer" ? toAccountId : undefined,
            destAmount: kind === "transfer" ? amt : undefined,
            categoryId: kind === "transfer" ? undefined : categoryId || undefined,
            date: iso,
            payee: n,
            payeeZh: n,
            planned,
          };
          if (initial) await updateTransaction(tx, initial);
          else await addTransaction(tx);
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
            await deleteTransaction(initial.id);
            onClose();
          }}
        >
          {t.tx.delete}
        </button>
      ) : null}
    </div>
  );
}

