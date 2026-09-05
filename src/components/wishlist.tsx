import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryPicker } from "@/components/category-picker";
import { CategoryIcon } from "@/components/category-icon";
import { Group, Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { resolveAmountInput } from "@/lib/money-expr";
import { moneyAccountsForPicker } from "@/lib/accounts";
import { applyTxRules } from "@/lib/tx-rules";
import { captureFxToHkd } from "@/lib/calc/fx";
import { categoryPath } from "@/lib/categories";
import type { Category, Currency, WishItem } from "@/lib/types";
import {
  AccountLine,
  ActiveKeypad,
  ComposerHeader,
  ComposerShell,
  DatePaidRow,
  LineRow,
  TextLine,
} from "@/components/txn-composer";
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

  function save() {
    const n = name.trim();
    const amt = resolveAmountInput(price);
    if (!n || amt <= 0) {
      toast(t.add.needAmount);
      return;
    }
    onSave({ id: initial?.id ?? newId(), name: n, price: amt, currency });
  }

  return (
    <Overlay open={open} onClose={onClose} variant="page">
      <ComposerShell
        header={<ComposerHeader onClose={onClose} onSave={save} title={initial ? t.common.edit : t.wish.add} />}
        keypad={
          <ActiveKeypad
            field="amount"
            amount={price}
            dest=""
            principal=""
            interest=""
            setAmount={setPrice}
            setDest={() => undefined}
            setPrincipal={() => undefined}
            setInterest={() => undefined}
            currency={currency}
            onCurrency={setCurrency}
          />
        }
      >
        <TextLine value={name} onChange={setName} placeholder={t.wish.name} />
        <LineRow label={t.wish.price} amount={price} active onFocusAmount={() => undefined} />
      </ComposerShell>
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
  const [paid, setPaid] = useState(true);
  const [pickCat, setPickCat] = useState(true);
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
          planned: !paid,
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
      <Overlay open onClose={onClose} variant="page">
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
      </Overlay>
    );
  }

  return (
    <Overlay open onClose={onClose} variant="page">
      <ComposerShell
        header={<ComposerHeader onClose={onClose} onSave={() => void save()} title={t.wish.convert} />}
        keypad={
          <ActiveKeypad
            field="amount"
            amount={String(item.price)}
            dest=""
            principal=""
            interest=""
            setAmount={() => undefined}
            setDest={() => undefined}
            setPrincipal={() => undefined}
            setInterest={() => undefined}
            currency={item.currency}
            onCurrency={() => undefined}
          />
        }
      >
        <LineRow label={item.name} amount={String(item.price)} />
        <AccountLine accounts={accounts} value={accountId} onChange={setAccountId} placeholder={t.add.account} />
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
          onPressLabel={() => setPickCat(true)}
        />
        <DatePaidRow date={date} paid={paid} onDate={setDate} onPaid={setPaid} />
      </ComposerShell>
    </Overlay>
  );
}
