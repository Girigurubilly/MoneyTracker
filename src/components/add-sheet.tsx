import { useRef, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryPicker, TypeSwitch } from "@/components/category-picker";
import {
  AccountLine,
  ActiveKeypad,
  ComposerShell,
  DatePaidRow,
  ExtraIconBar,
  LineRow,
  type AmountField,
} from "@/components/txn-composer";
import { asFiat, autoDestAmount } from "@/components/currency-field";
import { todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { defaultMortgageAccountId, moneyAccountsForPicker } from "@/lib/accounts";
import { canSplitMortgage, categoryPath, mortgageEntryKind, resolvedDefaultAccountId } from "@/lib/categories";
import { captureFxToHkd } from "@/lib/calc/fx";
import { isTripActive } from "@/lib/calc/trips";
import { applyTxRules, infersHousing, splitMortgageAmounts } from "@/lib/tx-rules";
import { resolveAmountInput } from "@/lib/money-expr";
import type { Category, Currency, MoneyUnit, TxType } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function AddFlow() {
  const open = useUi((s) => s.addOpen);
  const type = useUi((s) => s.addType);
  const close = useUi((s) => s.closeAdd);
  const pickType = useUi((s) => s.openAdd);
  if (!open) return null;
  if (!type) {
    return <AddTypePicker onPick={pickType} onClose={close} />;
  }
  return (
    <Overlay open onClose={close} variant="page">
      <AddBody key={type} initialType={type} onClose={close} />
    </Overlay>
  );
}

function AddTypePicker({ onPick, onClose }: { onPick: (t: TxType) => void; onClose: () => void }) {
  const t = useT();
  const opts: { id: TxType; tone: string }[] = [
    { id: "expense", tone: "bg-expense-soft text-expense" },
    { id: "income", tone: "bg-success-soft text-income" },
    { id: "transfer", tone: "bg-accent-soft text-accent" },
  ];
  return (
    <Overlay open onClose={onClose} variant="page">
      <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button type="button" className="h-11 px-2 text-sm text-accent" onClick={onClose}>
            {t.add.cancel}
          </button>
          <h1 className="text-base font-semibold">{t.add.chooseType}</h1>
          <span className="inline-block min-w-11" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {opts.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`flex min-h-28 flex-col items-center justify-center rounded-2xl text-base font-semibold ${k.tone}`}
              onClick={() => onPick(k.id)}
            >
              {t.add[k.id]}
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}

function AddBody({ initialType, onClose }: { initialType: TxType; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const selectedDate = useUi((s) => s.selectedDate);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const trips = useApp((s) => s.trips);
  const rates = useApp((s) => s.fxRates);
  const defaultCurrency = useApp((s) => s.defaultCurrency);
  const addTransaction = useApp((s) => s.addTransaction);
  const moneyAccounts = moneyAccountsForPicker(accounts);
  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [destAmount, setDestAmount] = useState("");
  const [destLocked, setDestLocked] = useState(false);
  const [date, setDate] = useState(selectedDate || todayISO());
  const [accountId, setAccountId] = useState(moneyAccounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(
    moneyAccounts.find((a) => a.id !== moneyAccounts[0]?.id)?.id ?? defaultMortgageAccountId(accounts) ?? "",
  );
  const [categoryId, setCategoryId] = useState("");
  const [tripId, setTripId] = useState("");
  const [payee, setPayee] = useState("");
  const [pickCat, setPickCat] = useState(initialType !== "miles" && initialType !== "transfer");
  const pickedCat = useRef(false);
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [doSplit, setDoSplit] = useState(false);
  const [housing, setHousing] = useState(false);
  const [paid, setPaid] = useState(true);
  const [field, setField] = useState<AmountField>("amount");
  const [extra, setExtra] = useState<"note" | "trip" | "housing" | "split" | null>(null);
  const cat = categories.find((c) => c.id === categoryId);
  const mortgageKind = mortgageEntryKind(cat, categories);
  const canSplit = type !== "income" && type !== "miles" && canSplitMortgage(mortgageKind);
  const principalOnly = (type === "expense" || type === "transfer") && mortgageKind === "principal";
  const showDest = type === "transfer" || principalOnly || (canSplit && doSplit);
  const destDefault = defaultMortgageAccountId(accounts) ?? toAccountId;
  const destAcc = accounts.find((a) => a.id === (toAccountId || destDefault));
  const destCcy: Currency = destAcc ? asFiat(destAcc.currency, currency) : currency;
  const autoDest = autoDestAmount(resolveAmountInput(amount), currency, destCcy, rates);
  const destN = destLocked ? Number(destAmount) || 0 : autoDest;
  const ctx = { categories, accounts };

  function changeType(next: TxType) {
    setType(next);
    if (next === "miles" || next === "transfer") {
      setPickCat(false);
      if (next === "transfer") {
        setCategoryId("");
        setDoSplit(false);
      }
      return;
    }
    setPickCat(true);
  }

  function onPickCategory(c: Category | null) {
    pickedCat.current = true;
    setCategoryId(c?.id ?? "");
    if (infersHousing(c?.id, categories)) setHousing(true);
    const kind = mortgageEntryKind(c, categories);
    if (canSplitMortgage(kind)) {
      setDoSplit(true);
      setToAccountId(defaultMortgageAccountId(accounts) ?? "");
    } else {
      setDoSplit(false);
    }
    const def = resolvedDefaultAccountId(c, categories);
    if (def && accounts.some((a) => a.id === def)) setAccountId(def);
  }

  function onPickerClose() {
    if (pickedCat.current || categoryId) {
      pickedCat.current = false;
      setPickCat(false);
      return;
    }
    onClose();
  }

  async function save() {
    const amt = resolveAmountInput(amount);
    const parts = splitMortgageAmounts(principal, interest, amount, mortgageKind);
    if (amt <= 0 && !(canSplit && doSplit && (parts.principal > 0 || parts.interest > 0))) {
      toast(t.add.needAmount);
      return;
    }
    const planned = !paid;
    const pCat = categories.find((c) => mortgageEntryKind(c, categories) === "principal");
    const iCat = categories.find((c) => mortgageEntryKind(c, categories) === "interest");
    const ccy: MoneyUnit = type === "miles" ? "MILES" : currency;
    const fxToHkd = captureFxToHkd(ccy, rates);
    if (canSplit && doSplit) {
      const p = parts.principal;
      const i = parts.interest;
      if (p <= 0 && i <= 0) {
        toast(t.add.needAmount);
        return;
      }
      if (p > 0) {
        await addTransaction(
          applyTxRules(
            {
              type: "transfer",
              amount: p,
              currency: ccy,
              fxToHkd,
              accountId,
              toAccountId: toAccountId || destDefault,
              destAmount: autoDestAmount(p, ccy, destCcy, rates) || p,
              categoryId: pCat?.id,
              date,
              payee: payee || t.add.principal,
              payeeZh: payee || t.add.principal,
              planned,
              countsAsExpense: true,
              housing,
            },
            ctx,
          ),
        );
      }
      if (i > 0) {
        await addTransaction(
          applyTxRules(
            {
              type: "expense",
              amount: i,
              currency: ccy,
              fxToHkd,
              accountId,
              categoryId: iCat?.id ?? categoryId,
              date,
              payee: payee || t.add.interest,
              payeeZh: payee || t.add.interest,
              planned,
              housing,
            },
            ctx,
          ),
        );
      }
    } else {
      await addTransaction(
        applyTxRules(
          {
            id: newId(),
            type,
            amount: amt,
            currency: ccy,
            fxToHkd,
            accountId: type === "miles" ? (accounts.find((a) => a.currency === "MILES")?.id ?? accountId) : accountId,
            toAccountId: type === "transfer" || principalOnly ? toAccountId || destDefault : undefined,
            destAmount: type === "transfer" || principalOnly ? destN || amt : undefined,
            categoryId: categoryId || undefined,
            date,
            payee: payee || t.add[type],
            payeeZh: payee || t.add[type],
            planned,
            milesType: type === "miles" ? "earn" : undefined,
            tripId: type === "expense" && tripId ? tripId : undefined,
            housing,
          },
          ctx,
        ),
      );
    }
    toast(t.add.savedToast);
    onClose();
  }

  if (pickCat) {
    return (
      <CategoryPicker
        categories={categories}
        kind={type === "income" ? "income" : "expense"}
        selectedId={categoryId || undefined}
        txType={type === "miles" ? "expense" : type}
        onTxTypeChange={(next) => {
          setType(next);
          if (next === "miles" || next === "transfer") {
            setPickCat(false);
            if (next === "transfer") {
              setCategoryId("");
              setDoSplit(false);
            }
          }
        }}
        onClose={onPickerClose}
        onSelect={onPickCategory}
      />
    );
  }

  return (
    <ComposerShell
      header={
        <header className="flex items-center justify-between px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
            {t.add.cancel}
          </button>
          <div className="min-w-0 flex-1 text-center">
            <TypeSwitch value={type} onChange={changeType} includeMiles />
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
            value={toAccountId || destDefault}
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
          <AccountLine accounts={accounts} value={accountId} onChange={setAccountId} placeholder={t.add.account} />
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
            <LineRow
              label={t.add.miles}
              amount={amount}
              active={field === "amount"}
              onFocusAmount={() => setField("amount")}
            />
          )}
        </>
      )}
      {canSplit && doSplit ? (
        <>
          <LineRow
            label={t.add.principal}
            amount={principal}
            active={field === "principal"}
            onFocusAmount={() => setField("principal")}
          />
          <LineRow
            label={t.add.interest}
            amount={interest}
            active={field === "interest"}
            onFocusAmount={() => setField("interest")}
          />
          <AccountLine
            accounts={accounts}
            value={toAccountId || destDefault}
            onChange={setToAccountId}
            placeholder={t.add.mortgageTo}
          />
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
        showHousing={type !== "miles"}
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
    </ComposerShell>
  );
}
