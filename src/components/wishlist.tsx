import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccountSelect } from "@/components/account-select";
import { AmountCurrencyRow } from "@/components/currency-field";
import { CategoryPicker } from "@/components/category-picker";
import { Group, Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { resolveAmountInput } from "@/lib/money-expr";
import { moneyAccountsForPicker } from "@/lib/accounts";
import { applyTxRules } from "@/lib/tx-rules";
import { captureFxToHkd } from "@/lib/calc/fx";
import type { Category, Currency, WishItem } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function WishlistPage() {
  const t = useT();
  return (
    <div className="pb-10">
      <ScreenHeader title={t.wish.title} />
      <p className="px-5 pb-3 text-xs text-muted">{t.wish.hint}</p>
      <WishlistBlock />
    </div>
  );
}

export function WishlistBlock({ compact }: { compact?: boolean }) {
  const t = useT();
  const items = useApp((s) => s.wishlist);
  const rates = useApp((s) => s.fxRates);
  const defaultCurrency = useApp((s) => s.defaultCurrency);
  const add = useApp((s) => s.addWishItem);
  const remove = useApp((s) => s.deleteWishItem);
  const [editing, setEditing] = useState<WishItem | null | "new">(null);
  const [converting, setConverting] = useState<WishItem | null>(null);

  return (
    <div>
      {!compact ? null : (
        <div className="flex items-center justify-between px-5 pb-1 pt-6">
          <h2 className="text-sm font-medium text-muted">{t.wish.title}</h2>
          <button type="button" className="text-sm font-medium text-accent" onClick={() => setEditing("new")}>
            {t.wish.add}
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">{t.wish.empty}</p>
      ) : (
        <Group>
          {items.map((it, i) => (
            <div key={it.id}>
              {i > 0 ? <Hairline /> : null}
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{it.name}</div>
                  <div className="mt-0.5 text-xs tabular-nums text-muted">{money(it.price, it.currency)}</div>
                </div>
                <button
                  type="button"
                  className="h-9 shrink-0 rounded-full bg-accent-soft px-3 text-xs font-medium text-accent"
                  onClick={() => setConverting(it)}
                >
                  {t.wish.convert}
                </button>
                <button
                  type="button"
                  aria-label={t.wish.remove}
                  className="grid size-9 place-items-center text-expense"
                  onClick={() => void remove(it.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </Group>
      )}
      {!compact ? (
        <div className="px-5 pt-4">
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent"
            onClick={() => setEditing("new")}
          >
            <Plus className="size-4" />
            {t.wish.add}
          </button>
        </div>
      ) : null}
      <WishEditor
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        open={editing !== null}
        initial={editing === "new" ? null : editing}
        defaultCurrency={defaultCurrency}
        rates={rates}
        onClose={() => setEditing(null)}
        onSave={(row) => {
          void add(row);
          setEditing(null);
        }}
      />
      <ConvertSheet item={converting} onClose={() => setConverting(null)} />
    </div>
  );
}

function WishEditor({
  open,
  initial,
  defaultCurrency,
  rates,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: WishItem | null;
  defaultCurrency: Currency;
  rates: { currency: Currency; perHkd: number; asOf: string; source: string }[];
  onClose: () => void;
  onSave: (row: WishItem) => void;
}) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? defaultCurrency);
  return (
    <Overlay open={open} onClose={onClose} title={initial ? t.common.edit : t.wish.add} variant="sheet">
      <div className="px-5 pb-8">
        <label className="block py-2">
          <span className="text-xs text-muted">{t.wish.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.wish.price}</span>
          <AmountCurrencyRow amount={price} currency={currency} onAmount={setPrice} onCurrency={setCurrency} rates={rates} />
        </label>
        <button
          type="button"
          className="mt-3 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
          onClick={() => {
            const n = name.trim();
            const amt = resolveAmountInput(price);
            if (!n || amt <= 0) {
              toast(t.add.needAmount);
              return;
            }
            onSave({
              id: initial?.id ?? newId(),
              name: n,
              price: amt,
              currency,
            });
          }}
        >
          {t.add.save}
        </button>
      </div>
    </Overlay>
  );
}

function ConvertSheet({ item, onClose }: { item: WishItem | null; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const addTransaction = useApp((s) => s.addTransaction);
  const deleteWishItem = useApp((s) => s.deleteWishItem);
  const moneyAccounts = moneyAccountsForPicker(accounts);
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState(moneyAccounts[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [pickCat, setPickCat] = useState(false);
  const cat = categories.find((c) => c.id === categoryId);
  if (!item) return null;

  async function save() {
    if (!item) return;
    await addTransaction(
      applyTxRules(
        {
          type: "expense",
          amount: item.price,
          currency: item.currency,
          fxToHkd: captureFxToHkd(item.currency, rates),
          accountId,
          categoryId: categoryId || undefined,
          date,
          payee: item.name,
          payeeZh: item.name,
          planned: date > todayISO(),
        },
        { categories, accounts },
      ),
    );
    await deleteWishItem(item.id);
    toast(t.wish.converted);
    onClose();
  }

  if (pickCat) {
    return (
      <CategoryPicker
        categories={categories}
        kind="expense"
        selectedId={categoryId || undefined}
        txType="expense"
        onClose={() => setPickCat(false)}
        onSelect={(c: Category | null) => {
          setCategoryId(c?.id ?? "");
          setPickCat(false);
        }}
      />
    );
  }

  return (
    <Overlay open onClose={onClose} title={t.wish.convert} variant="sheet">
      <div className="px-5 pb-8">
        <div className="mb-3 text-sm">
          {item.name}
          <span className="ml-2 tabular-nums text-muted">{money(item.price, item.currency)}</span>
        </div>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.date}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3" />
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.category}</span>
          <button type="button" className="mt-1 flex h-11 w-full items-center rounded-lg bg-elevated px-3 text-left" onClick={() => setPickCat(true)}>
            {cat ? pickName(locale, cat.name, cat.nameZh) : t.add.pickCategory}
          </button>
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.account}</span>
          <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
        </label>
        <button type="button" className="mt-3 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void save()}>
          {t.add.save}
        </button>
      </div>
    </Overlay>
  );
}
