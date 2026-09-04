import { useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { InfoButton, Overlay, ScreenHeader, StatusChip } from "@/components/shared";
import { CategoryPicker } from "@/components/category-picker";
import { AccountSelect } from "@/components/account-select";
import { AmountCurrencyRow, AmountWithHkd, CurrencySelect, asFiat, autoDestAmount } from "@/components/currency-field";
import { money, pct, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { asOfForMonth, budgetActuals, chargedDayOf, forecastTone } from "@/lib/calc/budget";
import { travelSpendYtd } from "@/lib/calc/trips";
import { monthKey } from "@/lib/calc/ledger";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import type { AdhocBudget, Currency, Recurring, TxType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { WishlistBlock } from "@/components/wishlist";
import { defaultMortgageAccountId, moneyAccountsForPicker } from "@/lib/accounts";
import { categoryPath, canSplitMortgage, isMortgageInterestCategory, isMortgagePrincipalCategory, mortgageEntryKind, resolvedDefaultAccountId } from "@/lib/categories";
import { applyTxRules } from "@/lib/tx-rules";

export function BudgetScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const budgets = useApp((s) => s.budgets);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const categories = useApp((s) => s.categories);
  const recurring = useApp((s) => s.recurring);
  const adhocRows = useApp((s) => s.adhocBudgets);
  const annual = useApp((s) => s.annualTravelBudget);
  const updateBudget = useApp((s) => s.updateBudget);
  const month = monthKey();
  const asOf = asOfForMonth(month, todayISO());
  const actuals = budgetActuals(budgets, txs, month, rates, categories, recurring, asOf, adhocRows);
  const storedTotal = actuals.find((b) => b.id === MONTH_TOTAL_BUDGET_ID);
  const monthSpent = storedTotal?.spent ?? 0;
  const reserved = storedTotal?.reserved ?? 0;
  const reservedA = storedTotal?.reservedAdhoc ?? 0;
  const realized = storedTotal?.realized ?? 0;
  const projected = storedTotal?.projected ?? 0;
  const projectedRemain = storedTotal?.projectedRemain ?? 0;
  const avgDaily = storedTotal?.avgDaily ?? 0;
  const dailyAllowed = storedTotal?.dailyAllowed ?? 0;
  const daysRemaining = storedTotal?.daysRemaining ?? 0;
  const monthCap = storedTotal?.monthly ?? 0;
  const monthUsed = storedTotal?.expected ?? monthSpent + reserved + reservedA + projectedRemain;
  const monthRemain = monthCap - monthSpent - reserved - reservedA;
  const monthRatio = storedTotal?.ratio ?? (monthCap > 0 ? monthUsed / monthCap : 0);
  const monthTone = forecastTone(monthRatio);
  const categoryActuals = actuals.filter((b) => b.id !== MONTH_TOTAL_BUDGET_ID);
  const travelIds = new Set(categories.filter((c) => c.theme === "travel").map((c) => c.id));
  const spent = travelSpendYtd(txs, Number(month.slice(0, 4)), travelIds, rates);
  const travelPct = annual > 0 ? spent / annual : 0;
  const travelTone = forecastTone(travelPct);
  const [editCap, setEditCap] = useState(false);
  const [capDraft, setCapDraft] = useState("");
  const [regOpen, setRegOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<Recurring | null>(null);
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [editingAdhoc, setEditingAdhoc] = useState<AdhocBudget | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addCat, setAddCat] = useState("");
  const [addAmt, setAddAmt] = useState("");

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.budget.title}
        large
        right={
          <button type="button" aria-label={t.budget.addCategoryBudget} onClick={() => setAddOpen(true)} className="grid size-11 place-items-center text-accent">
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
              <span className="ml-2 text-sm font-normal text-muted">/ {monthCap > 0 ? money(monthCap, "HKD") : "—"}</span>
            </div>
          </button>
          <InfoButton k="cap" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
          <span>
            {t.budget.spent}: {money(monthSpent, "HKD")}
          </span>
          <span>
            {t.today.reservedRegulars}: {money(reserved + reservedA, "HKD")}
          </span>
          <span className="col-span-2">
            {t.budget.postedRegulars}: {money(realized, "HKD")}
          </span>
          <span>
            {t.budget.avgDaily}: {money(avgDaily, "HKD")}
          </span>
          <span>
            {t.budget.dailyAllowed}: {money(dailyAllowed, "HKD")}
          </span>
          <span className="col-span-2">
            {t.budget.projected}: {money(projected, "HKD")}
            <span className="text-faint"> · {t.budget.atPace}</span>
          </span>
          <span className="col-span-2 font-medium text-foreground">
            {t.budget.remaining}: {money(monthRemain, "HKD")}
            {daysRemaining > 0 ? ` · ${daysRemaining} ${t.budget.daysLeft}` : ` · ${t.budget.lastDay}`}
          </span>
        </div>
        {monthCap > 0 ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ring-track">
            <div
              className={cn(
                "h-full rounded-full",
                monthTone === "expense" ? "bg-expense" : monthTone === "watch" ? "bg-watch" : "bg-income",
              )}
              style={{ width: `${Math.min(100, monthRatio * 100)}%` }}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-faint">{t.budget.soft}</p>
        )}
      </div>

      <RegularsBlock
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
        onEdit={(a) => {
          setEditingAdhoc(a);
          setAdhocOpen(true);
        }}
      />

      <Link to="/reports/travel" className="mx-4 mt-3 block rounded-xl bg-elevated px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm text-muted">{t.budget.annualTravel}</span>
          <ChevronRight className="size-4 shrink-0 text-faint" />
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums">
          {money(spent, "HKD")}
          <span className="ml-2 text-sm font-normal text-muted">/ {money(annual, "HKD")}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ring-track">
          <div
            className={cn(
              "h-full rounded-full",
              travelTone === "expense" ? "bg-expense" : travelTone === "watch" ? "bg-watch" : "bg-income",
            )}
            style={{ width: `${Math.min(100, travelPct * 100)}%` }}
          />
        </div>
      </Link>

      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.budget.byCategory}</h2>
      {categoryActuals.map((b) => {
        const ratio = b.ratio;
        const tone = forecastTone(ratio);
        const status = tone === "income" ? "on-track" : tone === "watch" ? "watch" : "at-risk";
        return (
          <div key={b.id} className="px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm">{pickName(locale, b.label, b.labelZh)}</div>
                <div className="text-xs text-muted">
                  {money(b.spent, "HKD")} / {money(b.monthly, "HKD")} · {pct(ratio)} {t.budget.used}
                </div>
              </div>
              <StatusChip status={status} />
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ring-track">
              <div
                className={cn(
                  "h-full rounded-full",
                  tone === "expense" ? "bg-expense" : tone === "watch" ? "bg-watch" : "bg-income",
                )}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
          </div>
        );
      })}

      <WishlistBlock compact />

      <Overlay open={editCap} onClose={() => setEditCap(false)} title={t.budget.monthlyTotal}>
        <div className="px-5 pb-8">
          <input inputMode="decimal" value={capDraft} onChange={(e) => setCapDraft(e.target.value)} className="h-11 w-full rounded-lg bg-elevated px-3" />
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-accent font-semibold text-on-accent"
            onClick={async () => {
              await updateBudget({
                id: MONTH_TOTAL_BUDGET_ID,
                label: "Monthly total",
                labelZh: "本月總額",
                monthly: Number(capDraft) || 0,
                spent: 0,
              });
              setEditCap(false);
            }}
          >
            {t.add.save}
          </button>
        </div>
      </Overlay>

      <Overlay open={addOpen} onClose={() => setAddOpen(false)} title={t.budget.addCategoryBudget}>
        <div className="px-5 pb-8">
          <select value={addCat} onChange={(e) => setAddCat(e.target.value)} className="h-11 w-full rounded-lg bg-elevated px-3">
            <option value="">{t.budget.noCategory}</option>
            {categories
              .filter((c) => c.kind === "expense")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {pickName(locale, c.name, c.nameZh)}
                </option>
              ))}
          </select>
          <input inputMode="decimal" value={addAmt} onChange={(e) => setAddAmt(e.target.value)} className="mt-3 h-11 w-full rounded-lg bg-elevated px-3" placeholder={t.add.amount} />
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-accent font-semibold text-on-accent"
            onClick={async () => {
              const cat = categories.find((c) => c.id === addCat);
              await updateBudget({
                id: `b-${newId().slice(0, 8)}`,
                categoryId: cat?.id,
                label: cat?.name ?? "Budget",
                labelZh: cat?.nameZh ?? "預算",
                monthly: Number(addAmt) || 0,
                spent: 0,
              });
              toast(t.add.savedToast);
              setAddOpen(false);
            }}
          >
            {t.add.save}
          </button>
        </div>
      </Overlay>

      <RegularEditor open={regOpen} initial={editingReg} onClose={() => { setRegOpen(false); setEditingReg(null); }} />
      <AdhocEditor open={adhocOpen} initial={editingAdhoc} month={month} onClose={() => { setAdhocOpen(false); setEditingAdhoc(null); }} />
    </div>
  );
}

function RegularsBlock({ onAdd, onEdit }: { onAdd: () => void; onEdit: (r: Recurring) => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const recurring = useApp((s) => s.recurring);
  const rates = useApp((s) => s.fxRates);
  const today = Number(todayISO().slice(8, 10));
  const rows = recurring
    .filter((r) => r.frequency === "monthly" && r.type !== "miles")
    .sort((a, b) => chargedDayOf(a) - chargedDayOf(b) || a.label.localeCompare(b.label));
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
            const signed = r.type === "income" ? r.amount : r.type === "expense" || r.countsAsExpense ? -r.amount : r.amount;
            return (
              <button key={r.id} type="button" className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-0" onClick={() => onEdit(r)}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{pickName(locale, r.label, r.labelZh)}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {locale === "zh-HK" ? `${day}日` : `day ${day}`}
                    {` · ${r.type === "income" ? t.add.income : r.type === "transfer" ? (r.countsAsExpense ? `${t.add.transfer} · ${t.add.principal}` : t.add.transfer) : t.add.expense}`}
                  </div>
                </div>
                <AmountWithHkd amount={signed} currency={r.currency} rates={rates} sign className="text-sm font-semibold" />
                <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs font-medium", charged ? "bg-success-soft text-income" : "bg-accent-soft text-accent")}>
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
  onEdit: (a: AdhocBudget) => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rates = useApp((s) => s.fxRates);
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
          {rows.map((a) => (
            <button key={a.id} type="button" className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-0" onClick={() => onEdit(a)}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{pickName(locale, a.label, a.labelZh)}</div>
                <div className="mt-0.5 text-xs text-muted">{a.date.slice(8)}</div>
              </div>
              <AmountWithHkd amount={-a.amount} currency={a.currency} rates={rates} sign className="text-sm font-semibold" />
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </button>
          ))}
        </div>
      )}
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
      {open ? <AdhocEditorBody key={initial?.id ?? "new"} initial={initial} month={month} onClose={onClose} /> : null}
    </Overlay>
  );
}

function AdhocEditorBody({ initial, month, onClose }: { initial: AdhocBudget | null; month: string; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const add = useApp((s) => s.addAdhocBudget);
  const update = useApp((s) => s.updateAdhocBudget);
  const del = useApp((s) => s.deleteAdhocBudget);
  const categories = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const defaultCurrency = useApp((s) => s.defaultCurrency);
  const today = todayISO();
  const [name, setName] = useState(initial ? pickName(locale, initial.label, initial.labelZh) : "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [currency, setCurrency] = useState<Currency>(initial && initial.currency !== "MILES" ? initial.currency : defaultCurrency);
  const [date, setDate] = useState(initial?.date ?? (today.startsWith(month) ? today : `${month}-28`));
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [pickCat, setPickCat] = useState(false);
  const cat = categories.find((c) => c.id === categoryId);
  return (
    <>
      {pickCat ? (
        <CategoryPicker
          categories={categories}
          kind="expense"
          selectedId={categoryId || undefined}
          onClose={() => setPickCat(false)}
          onSelect={(c) => setCategoryId(c?.id ?? "")}
        />
      ) : null}
      <div className="px-5 pb-8">
      <p className="text-xs text-muted">{t.budget.adhocHint}</p>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.budget.regularName}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.amount}</span>
        <AmountCurrencyRow amount={amount} currency={currency} onAmount={setAmount} onCurrency={setCurrency} rates={rates} />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.category}</span>
        <button type="button" className="mt-1 flex h-11 w-full items-center rounded-lg bg-elevated px-3 text-left" onClick={() => setPickCat(true)}>
          {cat ? categoryPath(cat, categories, locale) : t.add.pickCategory}
        </button>
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.date}</span>
        <input type="date" value={date} min={`${month}-01`} max={`${month}-31`} onChange={(e) => setDate(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
      </label>
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        onClick={async () => {
          const n = name.trim();
          const amt = Number(amount) || 0;
          if (!n || amt <= 0) return;
          const iso = date.startsWith(month) ? date : `${month}-28`;
          const row: AdhocBudget = {
            id: initial?.id ?? newId(),
            label: n,
            labelZh: n,
            amount: amt,
            currency,
            month,
            date: iso,
            categoryId: categoryId || undefined,
          };
          if (initial) await update(row);
          else await add(row);
          toast(t.add.savedToast);
          onClose();
        }}
      >
        {t.add.save}
      </button>
      {initial ? (
        <button type="button" className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-expense" onClick={async () => { await del(initial.id); onClose(); }}>
          {t.tx.delete}
        </button>
      ) : null}
    </div>
    </>
  );
}

function RegularEditor({ open, initial, onClose }: { open: boolean; initial: Recurring | null; onClose: () => void }) {
  const t = useT();
  return (
    <Overlay open={open} onClose={onClose} title={initial ? t.common.edit : t.budget.addRegular} variant="page">
      {open ? <RegularEditorBody key={initial?.id ?? "new"} initial={initial} onClose={onClose} /> : null}
    </Overlay>
  );
}

function RegularEditorBody({ initial, onClose }: { initial: Recurring | null; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const recurring = useApp((s) => s.recurring);
  const rates = useApp((s) => s.fxRates);
  const defaultCurrency = useApp((s) => s.defaultCurrency);
  const addRecurring = useApp((s) => s.addRecurring);
  const updateRecurring = useApp((s) => s.updateRecurring);
  const deleteRecurring = useApp((s) => s.deleteRecurring);
  const moneyAccounts = moneyAccountsForPicker(accounts);
  const mate = initial?.splitWithId ? recurring.find((r) => r.id === initial.splitWithId) : null;
  const alreadySplit = Boolean(mate);
  const [kind, setKind] = useState<TxType>(
    initial?.type === "transfer" && initial.countsAsExpense ? "expense" : (initial?.type ?? "expense"),
  );
  const [name, setName] = useState(initial ? pickName(locale, initial.label, initial.labelZh) : "");
  const [amount, setAmount] = useState(initial ? String((alreadySplit ? initial.amount + (mate?.amount ?? 0) : initial.amount)) : "");
  const [currency, setCurrency] = useState<Currency>(initial && initial.currency !== "MILES" ? initial.currency : defaultCurrency);
  const [destAmount, setDestAmount] = useState(initial?.destAmount != null ? String(initial.destAmount) : "");
  const [destLocked, setDestLocked] = useState(initial?.destAmount != null);
  const [principalAmt, setPrincipalAmt] = useState(alreadySplit && initial?.type === "transfer" ? String(initial.amount) : alreadySplit && mate?.type === "transfer" ? String(mate.amount) : "");
  const [interestAmt, setInterestAmt] = useState(alreadySplit && initial?.type === "expense" ? String(initial.amount) : alreadySplit && mate?.type === "expense" ? String(mate.amount) : "");
  const [day, setDay] = useState(String(initial ? chargedDayOf(initial) : 1));
  const [accountId, setAccountId] = useState(initial?.accountId ?? moneyAccounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(initial?.toAccountId ?? defaultMortgageAccountId(accounts) ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [splitMortgage, setSplitMortgage] = useState(
    alreadySplit ||
      canSplitMortgage(mortgageEntryKind(categories.find((c) => c.id === initial?.categoryId), categories)),
  );
  const [living, setLiving] = useState(Boolean(initial?.living));
  const [pickCat, setPickCat] = useState(false);
  const cat = categories.find((c) => c.id === categoryId);
  const mortgageKind = mortgageEntryKind(cat, categories);
  const showSplit = kind !== "income" && (alreadySplit || canSplitMortgage(mortgageKind));
  const principalOnly = (kind === "expense" || kind === "transfer") && mortgageKind === "principal";
  const showDest = kind === "transfer" || principalOnly || (showSplit && splitMortgage);
  const destAcc = accounts.find((a) => a.id === toAccountId);
  const destCcy: Currency = destAcc ? asFiat(destAcc.currency, currency) : currency;
  const autoDest = autoDestAmount(Number(amount) || 0, currency, destCcy, rates);
  const destN = destLocked ? Number(destAmount) || 0 : autoDest;

  async function save() {
    const n = name.trim();
    const d = Math.min(28, Math.max(1, Number(day) || 1));
    const next = `2026-08-${String(d).padStart(2, "0")}`;
    if (showSplit && splitMortgage) {
      const p = Number(principalAmt) || 0;
      const i = Number(interestAmt) || 0;
      const pId = initial?.type === "transfer" ? initial.id : mate?.type === "transfer" ? mate.id : newId();
      const iId = initial?.type === "expense" ? initial.id : mate?.type === "expense" ? mate.id : newId();
      const pCat = categories.find((c) => isMortgagePrincipalCategory(c));
      const iCat = categories.find((c) => isMortgageInterestCategory(c));
      const dest = toAccountId || defaultMortgageAccountId(accounts) || "";
      await addRecurring({
        id: pId,
        type: "transfer",
        label: `${n} ${t.add.principal}`,
        labelZh: `${n} ${t.add.principal}`,
        amount: p,
        currency,
        accountId,
        toAccountId: dest,
        destAmount: autoDestAmount(p, currency, destCcy, rates) || p,
        categoryId: pCat?.id,
        frequency: "monthly",
        nextDate: next,
        chargedDay: d,
        living: true,
        countsAsExpense: true,
        splitWithId: iId,
      });
      await addRecurring({
        id: iId,
        type: "expense",
        label: `${n} ${t.add.interest}`,
        labelZh: `${n} ${t.add.interest}`,
        amount: i,
        currency,
        accountId,
        categoryId: iCat?.id,
        frequency: "monthly",
        nextDate: next,
        chargedDay: d,
        living: true,
        splitWithId: pId,
      });
    } else {
      const ruled = applyTxRules(
        {
          type: kind,
          amount: Number(amount) || 0,
          accountId,
          toAccountId: kind === "transfer" || principalOnly ? toAccountId : undefined,
          destAmount: kind === "transfer" || principalOnly ? destN || Number(amount) || 0 : undefined,
          categoryId: categoryId || undefined,
          housing: undefined,
          countsAsExpense: undefined,
        },
        { categories, accounts },
      );
      const row: Recurring = {
        id: initial?.id ?? newId(),
        type: ruled.type,
        label: n,
        labelZh: n,
        amount: ruled.amount,
        currency,
        accountId: ruled.accountId,
        toAccountId: ruled.toAccountId,
        destAmount: ruled.destAmount,
        categoryId: ruled.categoryId,
        frequency: "monthly",
        nextDate: next,
        chargedDay: d,
        living,
        countsAsExpense: ruled.countsAsExpense,
        housing: ruled.housing,
      };
      if (initial) await updateRecurring(row);
      else await addRecurring(row);
    }
    toast(t.add.savedToast);
    onClose();
  }

  return (
    <>
      {pickCat ? (
        <CategoryPicker
          categories={categories}
          kind={kind === "income" ? "income" : "expense"}
          selectedId={categoryId || undefined}
          txType={kind}
          onTxTypeChange={(next) => setKind(next)}
          onClose={() => setPickCat(false)}
          onSelect={(c) => {
            setCategoryId(c?.id ?? "");
            const nextKind = mortgageEntryKind(c, categories);
            setSplitMortgage(alreadySplit || canSplitMortgage(nextKind));
            const def = resolvedDefaultAccountId(c, categories);
            if (def && accounts.some((a) => a.id === def)) setAccountId(def);
          }}
        />
      ) : null}
      <div className="px-5 pb-8">
      <label className="block py-2">
        <span className="text-xs text-muted">{t.more.kind}</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as TxType)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3">
          <option value="expense">{t.add.expense}</option>
          <option value="income">{t.add.income}</option>
          <option value="transfer">{t.add.transfer}</option>
        </select>
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.budget.regularName}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.budget.pickCategory}</span>
        <button type="button" className="mt-1 flex h-11 w-full items-center rounded-lg bg-elevated px-3 text-left" onClick={() => setPickCat(true)}>
          {cat ? categoryPath(cat, categories, locale) : t.add.pickCategory}
        </button>
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{kind === "transfer" ? t.add.from : t.add.account}</span>
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
      </label>
      {showSplit ? (
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" checked={splitMortgage} onChange={(e) => setSplitMortgage(e.target.checked)} />
          {t.add.split}
        </label>
      ) : null}
      {showSplit && splitMortgage ? (
        <div>
          <p className="text-xs text-muted">{t.add.splitHint}</p>
          <div className="mt-1 flex justify-end">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block py-2">
              <span className="text-xs text-muted">{t.add.principal}</span>
              <input inputMode="decimal" value={principalAmt} onChange={(e) => setPrincipalAmt(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
            </label>
            <label className="block py-2">
              <span className="text-xs text-muted">{t.add.interest}</span>
              <input inputMode="decimal" value={interestAmt} onChange={(e) => setInterestAmt(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
            </label>
          </div>
        </div>
      ) : (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.amount}</span>
          <AmountCurrencyRow
            amount={amount}
            currency={currency}
            onAmount={setAmount}
            onCurrency={(c) => {
              setCurrency(c);
              setDestLocked(false);
            }}
            rates={rates}
          />
        </label>
      )}
      {showDest ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{principalOnly || (showSplit && splitMortgage) ? t.add.mortgageTo : t.add.to}</span>
          <AccountSelect
            accounts={accounts}
            value={toAccountId}
            onChange={(id) => {
              setToAccountId(id);
              setDestLocked(false);
            }}
            excludeId={accountId}
          />
        </label>
      ) : null}
      {showDest && !(showSplit && splitMortgage) ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.destAmount}</span>
          <AmountCurrencyRow
            amount={destLocked ? destAmount : String(autoDest || "")}
            currency={destCcy}
            onAmount={(v) => {
              setDestLocked(true);
              setDestAmount(v);
            }}
            onCurrency={() => undefined}
            rates={rates}
            currencyDisabled
          />
          <span className="mt-1 block text-xs text-faint">{t.add.destAmountHint}</span>
        </label>
      ) : null}
      <label className="block py-2">
        <span className="text-xs text-muted">{t.budget.chargedDay}</span>
        <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
      </label>
      <label className="flex items-center gap-2 py-2 text-sm">
        <input type="checkbox" checked={living} onChange={(e) => setLiving(e.target.checked)} />
        {t.budget.livingRegular}
      </label>
      <button type="button" className="mt-4 h-12 w-full rounded-xl bg-accent font-semibold text-on-accent" onClick={() => void save()}>
        {t.add.save}
      </button>
      {initial ? (
        <button type="button" className="mt-3 h-12 w-full text-sm text-expense" onClick={async () => { await deleteRecurring(initial.id); if (mate) await deleteRecurring(mate.id); onClose(); }}>
          {t.tx.delete}
        </button>
      ) : null}
    </div>
    </>
  );
}
