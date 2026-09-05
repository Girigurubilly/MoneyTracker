import { useState } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryPicker, TypeSwitch } from "@/components/category-picker";
import { Overlay } from "@/components/shared";
import { asFiat, autoDestAmount } from "@/components/currency-field";
import {
  AccountLine,
  ActiveKeypad,
  ComposerShell,
  DatePaidRow,
  ExtraIconBar,
  LineRow,
  type AmountField,
} from "@/components/txn-composer";
import { todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { defaultMortgageAccountId } from "@/lib/accounts";
import { canSplitMortgage, categoryPath, mortgageEntryKind, resolvedDefaultAccountId } from "@/lib/categories";
import { captureFxToHkd } from "@/lib/calc/fx";
import { isTripActive } from "@/lib/calc/trips";
import { applyTxRules, infersHousing, splitMortgageAmounts } from "@/lib/tx-rules";
import { resolveAmountInput } from "@/lib/money-expr";
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
  const [paid, setPaid] = useState(!tx.planned);
  const [field, setField] = useState<AmountField>("amount");
  const [extra, setExtra] = useState<"note" | "trip" | "housing" | "split" | null>(null);
  const cat = categories.find((c) => c.id === categoryId);
  const mortgageKind = mortgageEntryKind(cat, categories);
  const canSplit = type !== "income" && type !== "miles" && canSplitMortgage(mortgageKind);
  const principalOnly = (type === "expense" || type === "transfer") && mortgageKind === "principal";
  const showDest = type === "transfer" || principalOnly || (canSplit && doSplit);
  const moneyTx = type !== "miles";
  const destAcc = accounts.find((a) => a.id === toAccountId);
  const destCcy: Currency = destAcc ? asFiat(destAcc.currency, currency) : currency;
  const autoDest = autoDestAmount(resolveAmountInput(amount), currency, destCcy, rates, tx.fxToHkd);
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
    const amt = resolveAmountInput(amount);
    const parts = splitMortgageAmounts(principal, interest, amount, mortgageKind);
    const ccy: MoneyUnit = type === "miles" ? "MILES" : currency;
    const fxToHkd = captureFxToHkd(ccy, rates);
    const ctx = { categories, accounts };
    const planned = !paid;
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
      <ComposerShell
        header={
          <header className="flex items-center justify-between px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
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
        }
        keypad={
          <ActiveKeypad
            field={field}
            amount={amount}
            dest={destLocked ? destAmount : String(autoDest || "")}
            principal={principal}
            interest={interest}
            setAmount={setAmount}
            setDest={(v) => {
              setDestLocked(true);
              setDestAmount(v);
            }}
            setPrincipal={setPrincipal}
            setInterest={setInterest}
            currency={field === "dest" ? destCcy : currency}
            onCurrency={(c) => {
              if (field === "dest") return;
              setCurrency(c);
              setDestLocked(false);
            }}
          />
        }
      >
        {type === "transfer" ? (
          <>
            <AccountLine
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              placeholder={t.add.from}
              amount={amount}
              active={field === "amount"}
              onFocusAmount={() => setField("amount")}
            />
            <AccountLine
              accounts={accounts}
              value={toAccountId}
              onChange={(id) => {
                setToAccountId(id);
                setDestLocked(false);
              }}
              excludeId={accountId}
              placeholder={t.add.to}
              amount={destLocked ? destAmount : String(autoDest || amount || "0")}
              active={field === "dest"}
              onFocusAmount={() => setField("dest")}
            />
          </>
        ) : (
          <>
            {moneyTx ? <AccountLine accounts={accounts} value={accountId} onChange={setAccountId} placeholder={t.add.account} /> : null}
            {type !== "miles" ? (
              <LineRow
                leading={
                  cat ? (
                    <span className="grid size-8 place-items-center rounded-full bg-elevated">
                      <CategoryIcon name={cat.icon} />
                    </span>
                  ) : null
                }
                label={cat ? categoryPath(cat, categories, locale) : ""}
                placeholder={t.add.pickCategory}
                amount={canSplit && doSplit ? undefined : amount}
                active={field === "amount"}
                onFocusAmount={canSplit && doSplit ? undefined : () => setField("amount")}
                onPressLabel={() => setPickCat(true)}
              />
            ) : (
              <LineRow label={t.add.miles} amount={amount} active={field === "amount"} onFocusAmount={() => setField("amount")} />
            )}
          </>
        )}
        {canSplit && doSplit ? (
          <>
            <LineRow label={t.add.principal} amount={principal} active={field === "principal"} onFocusAmount={() => setField("principal")} />
            <LineRow label={t.add.interest} amount={interest} active={field === "interest"} onFocusAmount={() => setField("interest")} />
            <AccountLine accounts={accounts} value={toAccountId} onChange={setToAccountId} placeholder={t.add.mortgageTo} />
          </>
        ) : null}
        <DatePaidRow date={date} paid={paid} onDate={setDate} onPaid={setPaid} />
        <ExtraIconBar
          extra={extra}
          onExtra={setExtra}
          noteOn={!!payee}
          tripOn={!!tripId}
          housingOn={housing}
          splitOn={doSplit}
          showTrip={type === "expense"}
          showHousing={moneyTx}
          showSplit={canSplit}
          onHousing={() => setHousing((v) => !v)}
          onSplit={() => {
            const on = !doSplit;
            setDoSplit(on);
            if (on && !principal && !interest && amount) {
              if (mortgageKind === "interest") setInterest(amount);
              else setPrincipal(amount);
              setField("principal");
            }
          }}
          noteValue={payee}
          onNoteChange={setPayee}
          tripValue={tripId}
          tripOptions={trips.filter((tr) => isTripActive(tr, todayISO())).map((tr) => ({ id: tr.id, label: pickName(locale, tr.name, tr.nameZh) }))}
          onTripChange={setTripId}
        />
        <div className="px-4 pb-2">
          <button
            type="button"
            className="h-10 w-full text-sm font-medium text-expense"
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
      </ComposerShell>
    </>
  );
}
