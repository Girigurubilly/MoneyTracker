import { useState } from "react";
import { toast } from "sonner";
import { AccountSelect } from "@/components/account-select";
import { Overlay } from "@/components/shared";
import { CategoryPicker, TypeSwitch } from "@/components/category-picker";
import { todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { defaultMortgageAccountId, moneyAccountsForPicker } from "@/lib/accounts";
import { categoryPath, mortgageEntryKind } from "@/lib/categories";
import { isTripActive } from "@/lib/calc/trips";
import { applyTxRules, infersHousing } from "@/lib/tx-rules";
import type { Category, TxType } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function AddFlow() {
  const open = useUi((s) => s.addOpen);
  const type = useUi((s) => s.addType);
  const close = useUi((s) => s.closeAdd);
  if (!open) return null;
  return (
    <Overlay open onClose={close} variant="page">
      <AddBody key={String(open)} initialType={type ?? "expense"} onClose={close} />
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
  const addTransaction = useApp((s) => s.addTransaction);
  const moneyAccounts = moneyAccountsForPicker(accounts);
  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(selectedDate || todayISO());
  const [accountId, setAccountId] = useState(moneyAccounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(
    moneyAccounts.find((a) => a.id !== moneyAccounts[0]?.id)?.id ?? defaultMortgageAccountId(accounts) ?? "",
  );
  const [categoryId, setCategoryId] = useState("");
  const [tripId, setTripId] = useState("");
  const [payee, setPayee] = useState("");
  const [pickCat, setPickCat] = useState(false);
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [housing, setHousing] = useState(false);
  const cat = categories.find((c) => c.id === categoryId);
  const mortgageKind = mortgageEntryKind(cat, categories);
  const split = type === "expense" && mortgageKind === "split";
  const principalOnly = (type === "expense" || type === "transfer") && mortgageKind === "principal";
  const showDest = type === "transfer" || split || principalOnly;
  const destDefault = defaultMortgageAccountId(accounts) ?? toAccountId;
  const ctx = { categories, accounts };

  function onPickCategory(c: Category | null) {
    setCategoryId(c?.id ?? "");
    if (infersHousing(c?.id, categories)) setHousing(true);
    if (mortgageEntryKind(c, categories) === "principal") {
      setToAccountId(defaultMortgageAccountId(accounts) ?? "");
    }
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
          if (next === "miles") setPickCat(false);
        }}
        onClose={() => setPickCat(false)}
        onSelect={onPickCategory}
      />
    );
  }

  return (
    <div className="pb-8">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.add.cancel}
        </button>
        <div className="min-w-0 flex-1 text-center">
          <TypeSwitch value={type} onChange={setType} includeMiles />
        </div>
        <span className="min-w-11" />
      </header>
      <div className="px-5">
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.amount}</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{type === "transfer" ? t.add.from : t.add.account}</span>
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
      </label>
      {showDest ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{split || principalOnly ? t.add.mortgageTo : t.add.to}</span>
          <AccountSelect
            accounts={accounts}
            value={toAccountId || destDefault}
            onChange={setToAccountId}
            excludeId={accountId}
          />
        </label>
      ) : null}
      {type !== "miles" ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.category}</span>
          <button type="button" className="mt-1 flex h-11 w-full items-center rounded-lg bg-elevated px-3 text-left" onClick={() => setPickCat(true)}>
            {cat ? categoryPath(cat, categories, locale) : t.add.pickCategory}
          </button>
        </label>
      ) : null}
      {type === "expense" ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.trip}</span>
          <select value={tripId} onChange={(e) => setTripId(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3">
            <option value="">{t.reports.noneTrip}</option>
            {trips.filter((tr) => isTripActive(tr, todayISO())).map((tr) => (
              <option key={tr.id} value={tr.id}>
                {pickName(locale, tr.name, tr.nameZh)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {split ? (
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
      ) : null}
      {type !== "miles" ? (
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" checked={housing} onChange={(e) => setHousing(e.target.checked)} />
          {t.add.housing}
        </label>
      ) : null}
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.date}</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.note}</span>
        <input value={payee} onChange={(e) => setPayee(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
      </label>
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        onClick={async () => {
          const amt = Number(amount) || 0;
          if (amt <= 0 && !split) {
            toast(t.add.needAmount);
            return;
          }
          const planned = date > todayISO();
          const acc = moneyAccounts.find((a) => a.id === accountId) ?? accounts.find((a) => a.id === accountId);
          const pCat = categories.find((c) => mortgageEntryKind(c, categories) === "principal");
          const iCat = categories.find((c) => mortgageEntryKind(c, categories) === "interest");
          const currency = type === "miles" ? "MILES" : acc?.currency === "MILES" ? "HKD" : (acc?.currency ?? "HKD");
          if (split) {
            const p = Number(principal) || 0;
            const i = Number(interest) || amt - p;
            if (p > 0) {
              await addTransaction(
                applyTxRules(
                  {
                    type: "transfer",
                    amount: p,
                    currency,
                    accountId,
                    toAccountId: toAccountId || destDefault,
                    destAmount: p,
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
                    currency,
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
                  currency,
                  accountId: type === "miles" ? (accounts.find((a) => a.currency === "MILES")?.id ?? accountId) : accountId,
                  toAccountId: type === "transfer" || principalOnly ? toAccountId || destDefault : undefined,
                  destAmount: type === "transfer" || principalOnly ? amt : undefined,
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
        }}
      >
        {t.add.save}
      </button>
      </div>
    </div>
  );
}
