import { useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { CategoryPicker } from "@/components/category-picker";
import { todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { defaultMortgageAccountId } from "@/lib/accounts";
import { isMortgageInterestCategory, isMortgagePrincipalCategory, isMortgageSplitCategory, categoryPath } from "@/lib/categories";
import { isTripActive } from "@/lib/calc/trips";
import type { TxType } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function AddFlow() {
  const t = useT();
  const open = useUi((s) => s.addOpen);
  const type = useUi((s) => s.addType);
  const close = useUi((s) => s.closeAdd);
  const openAdd = useUi((s) => s.openAdd);
  if (!open) return null;
  if (!type) {
    return (
      <Overlay open onClose={close} title={t.add.title}>
        <div className="grid grid-cols-2 gap-3 px-5 pb-8">
          {(["expense", "income", "transfer", "miles"] as TxType[]).map((k) => (
            <button key={k} type="button" onClick={() => openAdd(k)} className="h-16 rounded-xl bg-elevated text-sm font-medium">
              {t.add[k]}
            </button>
          ))}
        </div>
      </Overlay>
    );
  }
  return (
    <Overlay open onClose={close} title={t.add[type]} variant="page">
      <AddBody type={type} onClose={close} />
    </Overlay>
  );
}

function AddBody({ type, onClose }: { type: TxType; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const selectedDate = useUi((s) => s.selectedDate);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const trips = useApp((s) => s.trips);
  const addTransaction = useApp((s) => s.addTransaction);
  const moneyAccounts = accounts.filter((a) => a.currency !== "MILES" && !a.hidden);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(selectedDate || todayISO());
  const [accountId, setAccountId] = useState(moneyAccounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(moneyAccounts[1]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [tripId, setTripId] = useState("");
  const [payee, setPayee] = useState("");
  const [pickCat, setPickCat] = useState(false);
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const cat = categories.find((c) => c.id === categoryId);
  const split = type === "expense" && isMortgageSplitCategory(cat, categories);
  const destDefault = defaultMortgageAccountId(accounts) ?? toAccountId;

  return (
    <div className="px-5 pb-8">
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.amount}</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{type === "transfer" ? t.add.from : t.add.account}</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3">
          {moneyAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {pickName(locale, a.name, a.nameZh)}
            </option>
          ))}
        </select>
      </label>
      {type === "transfer" || split ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{split ? t.add.mortgageTo : t.add.to}</span>
          <select value={toAccountId || destDefault} onChange={(e) => setToAccountId(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3">
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
      {type !== "transfer" && type !== "miles" ? (
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
          const acc = moneyAccounts.find((a) => a.id === accountId);
          const pCat = categories.find((c) => isMortgagePrincipalCategory(c));
          const iCat = categories.find((c) => isMortgageInterestCategory(c));
          if (split) {
            const p = Number(principal) || 0;
            const i = Number(interest) || amt - p;
            if (p > 0) {
              await addTransaction({
                type: "transfer",
                amount: p,
                currency: acc?.currency === "MILES" ? "HKD" : (acc?.currency ?? "HKD"),
                accountId,
                toAccountId: toAccountId || destDefault,
                destAmount: p,
                categoryId: pCat?.id,
                date,
                payee: payee || t.add.principal,
                payeeZh: payee || t.add.principal,
                planned,
                countsAsExpense: true,
              });
            }
            if (i > 0) {
              await addTransaction({
                type: "expense",
                amount: i,
                currency: acc?.currency === "MILES" ? "HKD" : (acc?.currency ?? "HKD"),
                accountId,
                categoryId: iCat?.id ?? categoryId,
                date,
                payee: payee || t.add.interest,
                payeeZh: payee || t.add.interest,
                planned,
              });
            }
          } else {
            await addTransaction({
              id: newId(),
              type,
              amount: amt,
              currency: type === "miles" ? "MILES" : acc?.currency === "MILES" ? "HKD" : (acc?.currency ?? "HKD"),
              accountId: type === "miles" ? (accounts.find((a) => a.currency === "MILES")?.id ?? accountId) : accountId,
              toAccountId: type === "transfer" ? toAccountId : undefined,
              destAmount: type === "transfer" ? amt : undefined,
              categoryId: categoryId || undefined,
              date,
              payee: payee || t.add[type],
              payeeZh: payee || t.add[type],
              planned,
              milesType: type === "miles" ? "earn" : undefined,
              tripId: type === "expense" && tripId ? tripId : undefined,
            });
          }
          toast(t.add.savedToast);
          onClose();
        }}
      >
        {t.add.save}
      </button>
      <Overlay open={pickCat} onClose={() => setPickCat(false)} variant="page">
        <CategoryPicker
          categories={categories}
          kind={type === "income" ? "income" : "expense"}
          onClose={() => setPickCat(false)}
          onSelect={(c) => setCategoryId(c?.id ?? "")}
        />
      </Overlay>
    </div>
  );
}
