import { useState } from "react";
import { toast } from "sonner";
import { AccountSelect } from "@/components/account-select";
import { AmountCurrencyRow, CurrencySelect, asFiat, autoDestAmount } from "@/components/currency-field";
import { CategoryPicker, TypeSwitch } from "@/components/category-picker";
import { Overlay } from "@/components/shared";
import { todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { defaultMortgageAccountId } from "@/lib/accounts";
import { canSplitMortgage, categoryPath, mortgageEntryKind, resolvedDefaultAccountId } from "@/lib/categories";
import { captureFxToHkd } from "@/lib/calc/fx";
import { isTripActive } from "@/lib/calc/trips";
import { applyTxRules, infersHousing, splitMortgageAmounts } from "@/lib/tx-rules";
import type { Category, Currency, MoneyUnit, Transaction, TxType } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

function formTypeOf(tx: Transaction, categories: Category[]): TxType {
  const cat = categories.find((c) => c.id === tx.categoryId);
  if (tx.type === "transfer" && tx.countsAsExpense && mortgageEntryKind(cat, categories) === "principal") {
    return "expense";
  }
  return tx.type;
}

export function TxDetail() {
  const id = useUi((s) => s.txDetailId);
  const setId = useUi((s) => s.setTxDetailId);
  const txs = useApp((s) => s.transactions);
  const tx = txs.find((x) => x.id === id);
  if (!tx) return null;
  return (
    <Overlay open={!!id} onClose={() => setId(null)} variant="page">
      <TxDetailBody key={tx.id} tx={tx} onClose={() => setId(null)} />
    </Overlay>
  );
}

function TxDetailBody({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const trips = useApp((s) => s.trips);
  const rates = useApp((s) => s.fxRates);
  const defaultCurrency = useApp((s) => s.defaultCurrency);
  const del = useApp((s) => s.deleteTransaction);
  const add = useApp((s) => s.addTransaction);
  const update = useApp((s) => s.updateTransaction);
  const [type, setType] = useState<TxType>(formTypeOf(tx, categories));
  const [amount, setAmount] = useState(String(tx.amount));
  const [currency, setCurrency] = useState<Currency>(tx.currency === "MILES" ? defaultCurrency : tx.currency);
  const [destAmount, setDestAmount] = useState(tx.destAmount != null ? String(tx.destAmount) : "");
  const [destLocked, setDestLocked] = useState(tx.destAmount != null);
  const [date, setDate] = useState(tx.date);
  const [accountId, setAccountId] = useState(tx.accountId);
  const [toAccountId, setToAccountId] = useState(tx.toAccountId ?? defaultMortgageAccountId(accounts) ?? "");
  const [categoryId, setCategoryId] = useState(tx.categoryId ?? "");
  const [tripId, setTripId] = useState(tx.tripId ?? "");
  const [payee, setPayee] = useState(pickName(locale, tx.payee, tx.payeeZh));
  const [housing, setHousing] = useState(tx.housing === true || infersHousing(tx.categoryId, categories));
  const [pickCat, setPickCat] = useState(false);
  const [principal, setPrincipal] = useState(tx.type === "transfer" && tx.countsAsExpense ? String(tx.amount) : "");
  const [interest, setInterest] = useState(tx.type === "expense" && mortgageEntryKind(categories.find((c) => c.id === tx.categoryId), categories) === "interest" ? String(tx.amount) : "");
  const [doSplit, setDoSplit] = useState(
    canSplitMortgage(mortgageEntryKind(categories.find((c) => c.id === tx.categoryId), categories)),
  );
  const cat = categories.find((c) => c.id === categoryId);
  const mortgageKind = mortgageEntryKind(cat, categories);
  const canSplit = type !== "income" && type !== "miles" && canSplitMortgage(mortgageKind);
  const principalOnly = (type === "expense" || type === "transfer") && mortgageKind === "principal";
  const showDest = type === "transfer" || principalOnly || (canSplit && doSplit);
  const moneyTx = type !== "miles";
  const destAcc = accounts.find((a) => a.id === toAccountId);
  const destCcy: Currency = destAcc ? asFiat(destAcc.currency, currency) : currency;
  const autoDest = autoDestAmount(Number(amount) || 0, currency, destCcy, rates, tx.fxToHkd);
  const destN = destLocked ? Number(destAmount) || 0 : autoDest;
  const activeTrips = trips.filter((tr) => isTripActive(tr, todayISO()) || tr.id === tx.tripId);

  function changeType(next: TxType) {
    setType(next);
    if (next === "transfer") {
      setCategoryId("");
      setDoSplit(false);
      setPickCat(false);
      return;
    }
    if (next !== "miles") setPickCat(true);
  }

  function onPickCategory(c: Category | null) {
    setCategoryId(c?.id ?? "");
    if (infersHousing(c?.id, categories)) setHousing(true);
    const kind = mortgageEntryKind(c, categories);
    if (canSplitMortgage(kind)) {
      setDoSplit(true);
      setToAccountId((id) => id || defaultMortgageAccountId(accounts) || "");
    } else {
      setDoSplit(false);
    }
    const def = resolvedDefaultAccountId(c, categories);
    if (def && accounts.some((a) => a.id === def)) setAccountId(def);
  }

  async function save() {
    const amt = Number(amount) || 0;
    const parts = splitMortgageAmounts(principal, interest, amount, mortgageKind);
    const ccy: MoneyUnit = type === "miles" ? "MILES" : currency;
    const fxToHkd = captureFxToHkd(ccy, rates);
    const ctx = { categories, accounts };
    const planned = date > todayISO();
    const dest = toAccountId || defaultMortgageAccountId(accounts);
    const pCat = categories.find((c) => mortgageEntryKind(c, categories) === "principal");
    const iCat = categories.find((c) => mortgageEntryKind(c, categories) === "interest");
    if (canSplit && doSplit) {
      const p = parts.principal;
      const i = parts.interest;
      if (p <= 0 && i <= 0) {
        toast(t.add.needAmount);
        return;
      }
      const wasPrincipal = tx.type === "transfer" && Boolean(tx.countsAsExpense);
      if (p > 0 && i > 0) {
        const pTx = applyTxRules(
          {
            ...tx,
            type: "transfer",
            amount: p,
            currency: ccy,
            fxToHkd,
            accountId,
            toAccountId: dest,
            destAmount: autoDestAmount(p, ccy, destCcy, rates) || p,
            categoryId: pCat?.id,
            date,
            payee: payee || t.add.principal,
            payeeZh: payee || t.add.principal,
            planned,
            housing,
            countsAsExpense: true,
          },
          ctx,
        );
        const iTx = applyTxRules(
          {
            ...tx,
            id: newId(),
            type: "expense",
            amount: i,
            currency: ccy,
            fxToHkd,
            accountId,
            toAccountId: undefined,
            destAmount: undefined,
            categoryId: iCat?.id ?? categoryId,
            date,
            payee: payee || t.add.interest,
            payeeZh: payee || t.add.interest,
            planned,
            housing,
            countsAsExpense: undefined,
          },
          ctx,
        );
        if (wasPrincipal || mortgageKind === "principal") {
          await update(pTx, tx);
          await add(iTx);
        } else {
          await update({ ...iTx, id: tx.id }, tx);
          await add({ ...pTx, id: newId() });
        }
      } else if (p > 0) {
        await update(
          applyTxRules(
            {
              ...tx,
              type: "transfer",
              amount: p,
              currency: ccy,
              fxToHkd,
              accountId,
              toAccountId: dest,
              destAmount: autoDestAmount(p, ccy, destCcy, rates) || p,
              categoryId: pCat?.id ?? categoryId,
              date,
              payee: payee || tx.payee,
              payeeZh: payee || tx.payeeZh,
              planned,
              housing,
            },
            ctx,
          ),
          tx,
        );
      } else {
        await update(
          applyTxRules(
            {
              ...tx,
              type: "expense",
              amount: i,
              currency: ccy,
              fxToHkd,
              accountId,
              categoryId: iCat?.id ?? categoryId,
              date,
              payee: payee || tx.payee,
              payeeZh: payee || tx.payeeZh,
              planned,
              housing,
            },
            ctx,
          ),
          tx,
        );
      }
    } else {
      if (amt <= 0) {
        toast(t.add.needAmount);
        return;
      }
      const next = applyTxRules(
        {
          ...tx,
          type,
          amount: amt,
          currency: ccy,
          fxToHkd,
          accountId,
          toAccountId: type === "transfer" || principalOnly ? toAccountId : undefined,
          destAmount: type === "transfer" || principalOnly ? destN || amt : undefined,
          categoryId: categoryId || undefined,
          date,
          payee: payee || tx.payee,
          payeeZh: payee || tx.payeeZh,
          planned,
          tripId: type === "expense" && tripId ? tripId : undefined,
          housing,
          countsAsExpense: type === "transfer" ? tx.countsAsExpense : undefined,
        },
        ctx,
      );
      await update(next, tx);
    }
    toast(t.add.savedToast);
    onClose();
  }

  return (
    <>
      {pickCat ? (
        <CategoryPicker
          categories={categories}
          kind={type === "income" ? "income" : "expense"}
          selectedId={categoryId || undefined}
          txType={type === "miles" ? "expense" : type}
          onTxTypeChange={(next) => {
            setType(next);
            if (next === "transfer") {
              setCategoryId("");
              setDoSplit(false);
              setPickCat(false);
            }
          }}
          onClose={() => setPickCat(false)}
          onSelect={onPickCategory}
        />
      ) : null}
      <div className="pb-8">
        <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
            {t.add.cancel}
          </button>
          <div className="min-w-0 flex-1 text-center">
            {moneyTx ? <TypeSwitch value={type} onChange={changeType} /> : <div className="text-base font-semibold">{t.tx.edit}</div>}
          </div>
          <button type="button" className="h-11 min-w-11 px-2 text-sm font-medium text-accent" onClick={() => void save()}>
            {t.add.save}
          </button>
        </header>
        <div className="px-5">
          <label className="block py-2">
            <span className="text-xs text-muted">{t.add.date}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
          </label>
          {type !== "miles" && type !== "transfer" ? (
            <label className="block py-2">
              <span className="text-xs text-muted">{t.add.category}</span>
              <button type="button" className="mt-1 flex h-11 w-full items-center rounded-lg bg-elevated px-3 text-left" onClick={() => setPickCat(true)}>
                {cat ? categoryPath(cat, categories, locale) : t.add.pickCategory}
              </button>
            </label>
          ) : null}
          {moneyTx ? (
            <label className="block py-2">
              <span className="text-xs text-muted">{type === "transfer" ? t.add.from : t.add.account}</span>
              <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
            </label>
          ) : null}
          {canSplit ? (
            <label className="flex items-center gap-2 py-2 text-sm">
              <input
                type="checkbox"
                checked={doSplit}
                onChange={(e) => {
                  const on = e.target.checked;
                  setDoSplit(on);
                  if (on && !principal && !interest && amount) {
                    if (mortgageKind === "interest") setInterest(amount);
                    else setPrincipal(amount);
                  }
                  if (!on && !amount) {
                    const sum = (Number(principal) || 0) + (Number(interest) || 0);
                    if (sum > 0) setAmount(String(sum));
                  }
                }}
              />
              {t.add.split}
            </label>
          ) : null}
          {canSplit && doSplit ? (
            <div>
              <p className="text-xs text-muted">{t.add.splitHint}</p>
              <div className="mt-1 flex justify-end">
                <CurrencySelect value={currency} onChange={setCurrency} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block py-2">
                  <span className="text-xs text-muted">{t.add.principal}</span>
                  <input inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
                </label>
                <label className="block py-2">
                  <span className="text-xs text-muted">{t.add.interest}</span>
                  <input inputMode="decimal" value={interest} onChange={(e) => setInterest(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
                </label>
              </div>
            </div>
          ) : type === "miles" ? (
            <label className="block py-2">
              <span className="text-xs text-muted">{t.add.amount}</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
            </label>
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
                fxToHkd={tx.fxToHkd}
              />
            </label>
          )}
          {showDest ? (
            <label className="block py-2">
              <span className="text-xs text-muted">{principalOnly || (canSplit && doSplit) ? t.add.mortgageTo : t.add.to}</span>
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
          {showDest && !(canSplit && doSplit) ? (
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
          {type === "expense" ? (
            <label className="block py-2">
              <span className="text-xs text-muted">{t.add.trip}</span>
              <select value={tripId} onChange={(e) => setTripId(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3">
                <option value="">{t.reports.noneTrip}</option>
                {activeTrips.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {pickName(locale, tr.name, tr.nameZh)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block py-2">
            <span className="text-xs text-muted">{t.add.note}</span>
            <input value={payee} onChange={(e) => setPayee(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
          </label>
          {moneyTx ? (
            <label className="flex items-center gap-2 py-2 text-sm">
              <input type="checkbox" checked={housing} onChange={(e) => setHousing(e.target.checked)} />
              {t.add.housing}
            </label>
          ) : null}
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
            onClick={() => void save()}
          >
            {t.add.save}
          </button>
          <button
            type="button"
            className="mt-3 h-12 w-full rounded-xl text-sm font-medium text-expense"
            onClick={async () => {
              const prev = await del(tx.id);
              onClose();
              toast(t.tx.deleted, {
                action: {
                  label: t.tx.undo,
                  onClick: () => {
                    if (prev) void add(prev);
                  },
                },
              });
            }}
          >
            {t.tx.delete}
          </button>
        </div>
      </div>
    </>
  );
}
