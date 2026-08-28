import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Minus, Plane, Plus } from "lucide-react";
import { Overlay, CategoryGlyph, Hairline } from "@/components/shared";
import { CategoryPicker } from "@/components/category-picker";
import { pickName } from "@/lib/i18n";
import { money, todayISO } from "@/lib/format";
import { rateToHkd } from "@/lib/calc/fx";
import { categoryPath, isMortgageInterestCategory, isMortgagePrincipalCategory, isMortgageSplitCategory } from "@/lib/categories";
import { spentInMonth } from "@/lib/calc/budget";
import { activeTrips } from "@/lib/calc/trips";
import { ACCOUNT_GROUPS, accountsInGroup, iconForAccountType } from "@/lib/accounts";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import type { Account, Category, Transaction, TxType } from "@/lib/types";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/types";

export function AddFlow() {
  const t = useT();
  const picker = useUi((s) => s.addPickerOpen);
  const kind = useUi((s) => s.addKind);
  const editingId = useUi((s) => s.editingId);
  const close = useUi((s) => s.closeAdd);
  const setKind = useUi((s) => s.setAddKind);
  const txs = useApp((s) => s.transactions);
  const editing = editingId ? txs.find((x) => x.id === editingId) : undefined;
  const formKind = kind ?? editing?.type ?? null;
  const [pickedCat, setPickedCat] = useState<Category | null>(null);

  useEffect(() => {
    setPickedCat(null);
  }, [formKind]);

  const catScreen =
    (formKind === "expense" || formKind === "income") && !editing;
  const catFirst = catScreen && pickedCat == null;

  return (
    <>
      <Overlay open={picker} onClose={close} title={t.add.title}>
        <div className="grid grid-cols-2 gap-3 px-5 pb-8 pt-2">
          <AddChoice
            icon={<Minus className="size-6" />}
            label={t.add.expense}
            tone="expense"
            onClick={() => setKind("expense")}
          />
          <AddChoice
            icon={<Plus className="size-6" />}
            label={t.add.income}
            tone="income"
            onClick={() => setKind("income")}
          />
          <AddChoice
            icon={<ArrowLeftRight className="size-6" />}
            label={t.add.transfer}
            tone="transfer"
            onClick={() => setKind("transfer")}
          />
          <AddChoice
            icon={<Plane className="size-6" />}
            label={t.add.miles}
            tone="miles"
            onClick={() => setKind("miles")}
          />
        </div>
      </Overlay>
      <Overlay open={catFirst} onClose={close} variant="page">
        {formKind === "income" || formKind === "expense" ? (
          <CategoryFirst
            kind={formKind}
            onSelect={setPickedCat}
            onKindChange={(k) => {
              setPickedCat(null);
              setKind(k);
            }}
            onClose={close}
          />
        ) : null}
      </Overlay>
      <Overlay
        open={formKind != null && !catFirst}
        onClose={() => {
          if (pickedCat && !editing) setPickedCat(null);
          else close();
        }}
        title={
          formKind === "expense"
            ? t.add.expense
            : formKind === "income"
              ? t.add.income
              : formKind === "transfer"
                ? t.add.transfer
                : t.add.miles
        }
      >
        {formKind ? (
          <AddForm kind={formKind} editing={editing} presetCategory={pickedCat} />
        ) : null}
      </Overlay>
    </>
  );
}

function CategoryFirst({
  kind,
  onSelect,
  onKindChange,
  onClose,
}: {
  kind: "expense" | "income";
  onSelect: (c: Category) => void;
  onKindChange: (k: TxType) => void;
  onClose: () => void;
}) {
  const categories = useApp((s) => s.categories);
  const budgets = useApp((s) => s.budgets);
  const txs = useApp((s) => s.transactions);
  const fxRates = useApp((s) => s.fxRates);
  const date = useUi((s) => s.selectedDate) || todayISO();
  const spendMap = useMemo(() => {
    const month = date.slice(0, 7);
    const map = new Map<string, number>();
    for (const c of categories) {
      map.set(c.id, spentInMonth(txs, month, fxRates, { categoryId: c.id }));
    }
    return map;
  }, [categories, txs, fxRates, date]);

  return (
    <CategoryPicker
      categories={categories}
      kind={kind}
      onKindChange={onKindChange}
      budgets={budgets}
      spentById={spendMap}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}

function AddChoice({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: TxType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl bg-elevated"
    >
      <span
        className={cn(
          "grid size-12 place-items-center rounded-full",
          tone === "expense" && "bg-pill-expense text-expense",
          tone === "income" && "bg-pill-income text-income",
          tone === "transfer" && "bg-pill-transfer text-transfer",
          tone === "miles" && "bg-pill-miles text-miles",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function AddForm({
  kind,
  editing,
  presetCategory,
}: {
  kind: TxType;
  editing?: Transaction;
  presetCategory?: Category | null;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const selectedDate = useUi((s) => s.selectedDate);
  const close = useUi((s) => s.closeAdd);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const trips = useApp((s) => s.trips);
  const fxRates = useApp((s) => s.fxRates);
  const budgets = useApp((s) => s.budgets);
  const txs = useApp((s) => s.transactions);
  const addTransaction = useApp((s) => s.addTransaction);
  const updateTransaction = useApp((s) => s.updateTransaction);
  const mortgage = useApp((s) => s.mortgage);

  const monetary = kind !== "miles";
  const fromAccounts = accounts.filter((a) => {
    const kindOk = kind === "miles" ? a.type === "miles" : a.currency !== "MILES";
    if (!kindOk) return false;
    if (a.hidden && a.id !== editing?.accountId && a.id !== editing?.toAccountId) return false;
    return true;
  });
  const cats = categories.filter((c) =>
    kind === "income" ? c.kind === "income" : kind === "expense" ? c.kind === "expense" : true,
  );
  const defaultCatId =
    kind === "income"
      ? (presetCategory?.id ?? (cats.find((c) => c.id === "salary") ?? cats[0])?.id ?? "")
      : kind === "expense"
        ? (presetCategory?.id ?? (cats.find((c) => c.id === "dining") ?? cats[0])?.id ?? "")
        : cats[0]?.id ?? "";
  const defaultFrom =
    fromAccounts.find((a) => a.currency === "HKD" && a.type === "current")?.id ??
    fromAccounts.find((a) => a.currency === "HKD")?.id ??
    fromAccounts[0]?.id ??
    "";

  function accountForCategory(catId: string, fallback: string) {
    const c = categories.find((x) => x.id === catId);
    if (c?.defaultAccountId && fromAccounts.some((a) => a.id === c.defaultAccountId)) {
      return c.defaultAccountId;
    }
    return fallback;
  }

  const [digits, setDigits] = useState(editing ? String(editing.amount) : "0");
  const [accountId, setAccountId] = useState(
    editing?.accountId ?? accountForCategory(defaultCatId, defaultFrom),
  );
  const [toAccountId, setToAccountId] = useState(
    editing?.toAccountId ??
      fromAccounts.find((a) => a.id !== (editing?.accountId ?? defaultFrom))?.id ??
      defaultFrom,
  );
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? defaultCatId);
  const [date, setDate] = useState(editing?.date ?? selectedDate ?? todayISO());
  const [payee, setPayee] = useState(
    editing ? (locale === "zh-HK" ? editing.payeeZh : editing.payee) : "",
  );
  const [tripId, setTripId] = useState(editing?.tripId ?? "");
  const [milesType, setMilesType] = useState<NonNullable<Transaction["milesType"]>>(
    editing?.milesType ?? "earn",
  );
  const [pick, setPick] = useState<null | "from" | "to" | "cat" | "trip" | "miles">(null);
  const [scheduled, setScheduled] = useState(
    Boolean(editing?.planned) || (editing?.date ?? selectedDate ?? todayISO()) > todayISO(),
  );
  const [splitMortgage, setSplitMortgage] = useState(
    Boolean(!editing && isMortgageSplitCategory(presetCategory, categories)),
  );
  const [principalDigits, setPrincipalDigits] = useState("0");
  const [interestDigits, setInterestDigits] = useState("0");

  useEffect(() => {
    setDigits(editing ? String(editing.amount) : "0");
    setAccountId(editing?.accountId ?? accountForCategory(defaultCatId, defaultFrom));
    setToAccountId(
      editing?.toAccountId ??
        fromAccounts.find((a) => a.id !== (editing?.accountId ?? defaultFrom))?.id ??
        defaultFrom,
    );
    setCategoryId(editing?.categoryId ?? defaultCatId);
    setDate(editing?.date ?? selectedDate ?? todayISO());
    setPayee(editing ? (locale === "zh-HK" ? editing.payeeZh : editing.payee) : "");
    setTripId(editing?.tripId ?? "");
    setMilesType(editing?.milesType ?? "earn");
    const nextDate = editing?.date ?? selectedDate ?? todayISO();
    setScheduled(Boolean(editing?.planned) || nextDate > todayISO());
    setSplitMortgage(Boolean(!editing && isMortgageSplitCategory(presetCategory, categories)));
    setPrincipalDigits("0");
    setInterestDigits("0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, kind]);

  const amount = Number(digits) || 0;
  const from = accounts.find((a) => a.id === accountId);
  const to = accounts.find((a) => a.id === toAccountId);
  const cat = categories.find((c) => c.id === categoryId);
  const mortgageSplitCat = kind === "expense" && isMortgageSplitCategory(cat, categories);
  const currency = from?.currency ?? (kind === "miles" ? "MILES" : "HKD");
  const spendMap = useMemo(() => {
    const month = (date || todayISO()).slice(0, 7);
    const map = new Map<string, number>();
    for (const c of categories) {
      map.set(c.id, spentInMonth(txs, month, fxRates, { categoryId: c.id }));
    }
    return map;
  }, [categories, txs, fxRates, date]);

  const display = useMemo(() => {
    if (!monetary) return Math.round(amount).toLocaleString("en-HK");
    return money(amount, currency === "MILES" ? "HKD" : currency);
  }, [amount, monetary, currency]);

  function tap(k: string) {
    setDigits((prev) => {
      let next = prev;
      if (k === "⌫") {
        next = prev.slice(0, -1);
        if (!next.length) next = "0";
      } else if (k === "." && (prev.includes(".") || !monetary || currency === "JPY")) {
        return prev;
      } else if (prev === "0" && k !== ".") {
        next = k;
      } else {
        next = prev + k;
      }
      if (splitMortgage) {
        const total = Number(next) || 0;
        const interest = Number(interestDigits) || 0;
        setPrincipalDigits(String(Math.max(0, Math.round((total - interest) * 100) / 100)));
      }
      return next;
    });
  }

  async function save() {
    const planned = scheduled || date > todayISO();
    const principal = Number(principalDigits) || 0;
    const interest = Number(interestDigits) || 0;
    const useSplit = !editing && splitMortgage && mortgageSplitCat && (principal > 0 || interest > 0);
    if (!useSplit && amount <= 0 && milesType !== "adjust") {
      toast(t.add.needAmount);
      return;
    }
    if (useSplit && principal + interest <= 0) {
      toast(t.add.needAmount);
      return;
    }
    if (!accountId) {
      toast(t.add.needAmount);
      return;
    }
    const fx = currency !== "HKD" && currency !== "MILES" ? rateToHkd(currency, fxRates) : undefined;
    const payeeEn = payee.trim() || cat?.name || t.add.note;
    const payeeZh = payee.trim() || cat?.nameZh || t.add.note;

    if (useSplit) {
      const mortgageAccId =
        mortgage?.accountId ?? accounts.find((a) => a.type === "mortgage" && !a.hidden)?.id;
      if (principal > 0) {
        await addTransaction({
          type: mortgageAccId ? "transfer" : "expense",
          amount: principal,
          currency,
          accountId,
          toAccountId: mortgageAccId,
          destAmount: mortgageAccId ? principal : undefined,
          categoryId:
            categories.find((c) => isMortgagePrincipalCategory(c))?.id ?? "mortgage-p",
          date,
          payee: payee.trim() || "Mortgage principal",
          payeeZh: payee.trim() || "按揭本金",
          note: payee.trim() || undefined,
          tripId: tripId || undefined,
          planned,
          fxToHkd: fx,
        });
      }
      if (interest > 0) {
        await addTransaction({
          type: "expense",
          amount: interest,
          currency,
          accountId,
          categoryId:
            categories.find((c) => isMortgageInterestCategory(c))?.id ?? "mortgage-i",
          date,
          payee: payee.trim() || "Mortgage interest",
          payeeZh: payee.trim() || "按揭利息",
          note: payee.trim() || undefined,
          tripId: tripId || undefined,
          planned,
          fxToHkd: fx,
        });
      }
      toast(t.add.savedToast);
      close();
      return;
    }

    let destAmount: number | undefined;
    if (kind === "transfer" && from && to) {
      const fromRate = rateToHkd(from.currency, fxRates);
      const toRate = rateToHkd(to.currency, fxRates) || 1;
      destAmount = from.currency === to.currency ? amount : (amount * fromRate) / toRate;
    }
    const tx: Transaction = {
      id: editing?.id ?? crypto.randomUUID(),
      type: kind,
      amount,
      currency,
      accountId,
      toAccountId: kind === "transfer" ? toAccountId : undefined,
      destAmount,
      categoryId: kind === "expense" || kind === "income" ? categoryId : undefined,
      date,
      payee: payeeEn,
      payeeZh,
      note: payee.trim() || undefined,
      tripId: tripId || undefined,
      milesType: kind === "miles" ? milesType : undefined,
      fxToHkd: fx,
      planned,
    };
    if (editing) await updateTransaction(tx, editing);
    else await addTransaction(tx);
    toast(t.add.savedToast);
    close();
  }

  const keys = monetary && currency !== "JPY" ? ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"] : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "⌫"];

  return (
    <div className="px-5 pb-8">
      <div className="py-4 text-center text-4xl font-semibold tabular-nums tracking-tight">
        {display}
        {!monetary ? (
          <span className="ml-2 text-base font-medium text-muted">
            {locale === "zh-HK" ? "里" : "miles"}
          </span>
        ) : (
          <span className="ml-2 text-base font-medium text-muted">{currency}</span>
        )}
      </div>
      <Field
        label={kind === "transfer" ? t.add.from : t.add.account}
        onClick={() => setPick("from")}
      >
        {from ? pickName(locale, from.name, from.nameZh) : "—"}
      </Field>
      {kind === "transfer" ? (
        <Field label={t.add.to} onClick={() => setPick("to")}>
          {to ? pickName(locale, to.name, to.nameZh) : "—"}
        </Field>
      ) : null}
      {kind === "expense" || kind === "income" ? (
        <Field label={t.add.category} onClick={() => setPick("cat")}>
        {cat ? categoryPath(categories, cat, locale) : "—"}
        </Field>
      ) : null}
      {kind === "miles" ? (
        <Field label={t.add.milesType} onClick={() => setPick("miles")}>
          {milesType === "earn"
            ? t.add.earn
            : milesType === "burn"
              ? t.add.burn
              : milesType === "expiry"
                ? t.add.expiry
                : t.add.adjust}
        </Field>
      ) : null}
      <label className="flex items-center justify-between border-b border-line py-3">
        <span className="text-sm text-muted">{t.add.date}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            const v = e.target.value;
            setDate(v);
            if (v > todayISO()) setScheduled(true);
            else if (!editing?.planned) setScheduled(false);
          }}
          className="bg-transparent text-right text-sm outline-none"
        />
      </label>
      {kind !== "miles" ? (
        <button
          type="button"
          onClick={() => setScheduled((v) => !v)}
          className="flex w-full items-start gap-3 border-b border-line py-3 text-left"
        >
          <span
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded border",
              scheduled ? "border-accent bg-accent text-on-accent" : "border-line bg-background",
            )}
            aria-hidden
          >
            {scheduled ? "✓" : ""}
          </span>
          <span>
            <span className="block text-sm font-medium">{t.add.scheduled}</span>
            <span className="mt-0.5 block text-xs text-muted">{t.add.scheduledHint}</span>
          </span>
        </button>
      ) : null}
      {kind === "expense" && mortgageSplitCat && !editing ? (
        <>
          <button
            type="button"
            onClick={() => {
              setSplitMortgage((v) => {
                const next = !v;
                if (next) {
                  setPrincipalDigits(digits);
                  setInterestDigits("0");
                }
                return next;
              });
            }}
            className="flex w-full items-start gap-3 border-b border-line py-3 text-left"
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
            <span className="block text-sm font-medium">{t.add.splitMortgage}</span>
          </button>
          {splitMortgage ? (
            <div className="grid grid-cols-2 gap-3 border-b border-line py-3">
              <label>
                <span className="text-xs text-muted">{t.add.principal}</span>
                <input
                  inputMode="decimal"
                  value={principalDigits}
                  onChange={(e) => {
                    setPrincipalDigits(e.target.value);
                    const p = Number(e.target.value) || 0;
                    const i = Number(interestDigits) || 0;
                    setDigits(String(p + i));
                  }}
                  className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 tabular-nums outline-none"
                />
              </label>
              <label>
                <span className="text-xs text-muted">{t.add.interest}</span>
                <input
                  inputMode="decimal"
                  value={interestDigits}
                  onChange={(e) => {
                    setInterestDigits(e.target.value);
                    const i = Number(e.target.value) || 0;
                    const p = Number(principalDigits) || 0;
                    setDigits(String(p + i));
                  }}
                  className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 tabular-nums outline-none"
                />
              </label>
            </div>
          ) : null}
        </>
      ) : null}
      <label className="flex items-center justify-between gap-3 border-b border-line py-3">
        <span className="shrink-0 text-sm text-muted">{t.add.note}</span>
        <input
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          placeholder={t.add.payeePlaceholder}
          className="min-w-0 flex-1 bg-transparent text-right text-sm outline-none"
        />
      </label>
      {kind === "expense" ? (
        <Field
          label={`${t.add.trip} · ${t.add.optional}`}
          onClick={() => setPick("trip")}
          muted={!tripId}
        >
          {tripId
            ? pickName(
                locale,
                trips.find((x) => x.id === tripId)?.name ?? "",
                trips.find((x) => x.id === tripId)?.nameZh ?? "",
              )
            : t.add.none}
        </Field>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {keys.map((k, i) => (
          <button
            key={`${k}-${i}`}
            type="button"
            onClick={() => tap(k)}
            className="h-12 rounded-lg bg-elevated text-lg font-medium tabular-nums"
          >
            {k}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void save()}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent"
      >
        {t.add.save}
      </button>

      <Overlay
        open={pick === "from" || pick === "to"}
        onClose={() => setPick(null)}
        title={pick === "to" ? t.add.to : t.add.account}
        variant="page"
      >
        <AccountPickList
          accounts={fromAccounts}
          selectedId={pick === "to" ? toAccountId : accountId}
          onSelect={(id) => {
            if (pick === "from") setAccountId(id);
            else setToAccountId(id);
            setPick(null);
          }}
        />
      </Overlay>
      <Overlay
        open={pick === "trip" || pick === "miles"}
        onClose={() => setPick(null)}
        title={pick === "trip" ? t.add.trip : t.add.milesType}
      >
        <div className="px-2 pb-6">
          {pick === "trip" ? (
            <>
              <button
                type="button"
                className="flex w-full px-4 py-3 text-left text-[15px] text-muted"
                onClick={() => {
                  setTripId("");
                  setPick(null);
                }}
              >
                {t.add.none}
              </button>
              {activeTrips(trips, todayISO(), tripId || undefined).map((tr) => (
                <button
                  key={tr.id}
                  type="button"
                  className="flex w-full flex-col px-4 py-3 text-left"
                  onClick={() => {
                    setTripId(tr.id);
                    setPick(null);
                  }}
                >
                  <span className="text-[15px]">{pickName(locale, tr.name, tr.nameZh)}</span>
                  <span className="text-xs text-muted">
                    {tr.start}
                    {tr.end ? ` → ${tr.end}` : ""}
                  </span>
                </button>
              ))}
            </>
          ) : null}
          {pick === "miles"
            ? (
                [
                  ["earn", t.add.earn],
                  ["burn", t.add.burn],
                  ["adjust", t.add.adjust],
                  ["expiry", t.add.expiry],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="flex w-full px-4 py-3 text-left text-[15px]"
                  onClick={() => {
                    setMilesType(id);
                    setPick(null);
                  }}
                >
                  {label}
                </button>
              ))
            : null}
        </div>
      </Overlay>
      <Overlay open={pick === "cat"} onClose={() => setPick(null)} variant="page">
        <CategoryPicker
          categories={categories}
          kind={kind === "income" ? "income" : "expense"}
          budgets={budgets}
          spentById={spendMap}
          onClose={() => setPick(null)}
          onSelect={(c) => {
            setCategoryId(c.id);
            if (isMortgageSplitCategory(c, categories)) {
              setSplitMortgage(true);
              setPrincipalDigits(digits);
              setInterestDigits("0");
            } else {
              setSplitMortgage(false);
            }
            if (c.defaultAccountId && fromAccounts.some((a) => a.id === c.defaultAccountId)) {
              setAccountId(c.defaultAccountId);
            } else {
              const parent = categories.find((x) => x.id === c.parentId);
              if (
                parent?.defaultAccountId &&
                fromAccounts.some((a) => a.id === parent.defaultAccountId)
              ) {
                setAccountId(parent.defaultAccountId);
              }
            }
            setPick(null);
          }}
        />
      </Overlay>
    </div>
  );
}

function Field({
  label,
  children,
  muted,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between border-b border-line py-3 text-left"
    >
      <span className="text-sm text-muted">{label}</span>
      <span className={cn("text-sm", muted && "text-faint")}>{children}</span>
    </button>
  );
}

function AccountPickList({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const titles: Record<(typeof ACCOUNT_GROUPS)[number], string> = {
    cash: t.assets.cash,
    credit: t.assets.credit,
    assets: t.assets.investments,
    housing: t.assets.housing,
    loyalty: t.assets.loyalty,
  };
  return (
    <div className="pb-8">
      {ACCOUNT_GROUPS.map((g) => {
        const rows = accountsInGroup(accounts, g, { includeHidden: true });
        if (!rows.length) return null;
        return (
          <div key={g}>
            <h2 className="px-5 pb-1 pt-5 text-sm font-medium text-muted">{titles[g]}</h2>
            <Hairline />
            {rows.map((a, i) => {
              const typeLabel = ACCOUNT_TYPE_OPTIONS.find((o) => o.id === a.type);
              const native =
                a.currency === "MILES"
                  ? `${Math.round(a.balance).toLocaleString("en-HK")} ${locale === "zh-HK" ? "里" : "miles"}`
                  : money(a.balance, a.currency, { sign: true });
              return (
                <div key={a.id}>
                  {i > 0 ? <Hairline /> : null}
                  <button
                    type="button"
                    onClick={() => onSelect(a.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3 text-left",
                      a.id === selectedId && "bg-accent-soft",
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated ring-1 ring-line">
                      <CategoryGlyph name={iconForAccountType(a.type)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {pickName(locale, a.name, a.nameZh)}
                      </span>
                      <span className="text-xs text-muted">
                        {typeLabel ? (locale === "zh-HK" ? typeLabel.zh : typeLabel.en) : a.type}
                        {a.institution ? ` · ${a.institution}` : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "text-[15px] font-semibold tabular-nums",
                        a.balance < 0 ? "text-expense" : "text-foreground",
                      )}
                    >
                      {native}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
