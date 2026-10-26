import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryPicker } from "@/components/category-picker";
import { CategoryIcon } from "@/components/category-icon";
import { Group, Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { money, todayISO, clockNow } from "@/lib/format";
import { resolveAmountInput } from "@/lib/money-expr";
import { moneyAccountsForPicker } from "@/lib/accounts";
import { applyTxRules } from "@/lib/tx-rules";
import { captureFxToHkd } from "@/lib/calc/fx";
import { categoryPath } from "@/lib/categories";
import { WhenField } from "@/components/when-picker";
import type { Category, Currency, WishCard, WishItem } from "@/lib/types";
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
      <ScreenHeader title={t.wish.title} backTo="/more" />
      <p className="rt-enter px-5 pb-3 text-xs leading-5 text-muted">{t.wish.hint}</p>
      <WishlistBlock />
    </div>
  );
}

export function WishlistBlock({ compact }: { compact?: boolean }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const items = useApp((s) => s.wishlist);
  const defaultCurrency = useApp((s) => s.defaultCurrency);
  const add = useApp((s) => s.addWishItem);
  const update = useApp((s) => s.updateWishItem);
  const remove = useApp((s) => s.deleteWishItem);
  const [editing, setEditing] = useState<WishItem | null | "new">(null);
  const [board, setBoard] = useState<WishItem | null>(null);
  const [converting, setConverting] = useState<WishItem | null>(null);

  return (
    <div>
      {!compact ? null : (
        <div className="flex items-center justify-between px-5 pb-1 pt-6">
          <h2 className="text-sm font-medium text-muted">{t.wish.title}</h2>
          <button type="button" className="tr-press inline-flex min-h-11 items-center text-sm font-medium text-accent" onClick={() => setEditing("new")}>
            {t.wish.add}
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <div className="rt-enter mx-4 rounded-2xl bg-elevated px-4 py-6 text-center">
          <p className="text-sm font-medium">{t.wish.empty}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{t.wish.emptyHint}</p>
          {!compact ? (
            <button
              type="button"
              className="tr-press mx-auto mt-3 flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent"
              onClick={() => setEditing("new")}
            >
              <Plus className="size-4" />
              {t.wish.add}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rt-enter">
          <Group>
            {items.map((it, i) => {
              const notes = (it.priceCards?.length ?? 0) + (it.valueCards?.length ?? 0);
              return (
                <div key={it.id}>
                  {i > 0 ? <Hairline /> : null}
                  <div className="flex min-h-11 items-center gap-1 px-3 py-2.5">
                    <button type="button" className="tr-press min-w-0 flex-1 text-left" onClick={() => setBoard(it)}>
                      <div className="truncate text-sm font-medium">{it.name}</div>
                      <div className="mt-0.5 text-xs tabular-nums text-muted">
                        {money(it.price, it.currency)}
                        {notes ? (locale === "zh-HK" ? ` · ${notes} 張卡` : ` · ${notes} cards`) : ""}
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={t.wish.edit}
                      className="tr-press grid size-11 shrink-0 place-items-center text-muted"
                      onClick={() => setEditing(it)}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="tr-press inline-flex h-11 min-h-11 shrink-0 items-center rounded-full bg-accent-soft px-3 text-xs font-medium text-accent"
                      onClick={() => setConverting(it)}
                    >
                      {t.wish.convert}
                    </button>
                    <button
                      type="button"
                      aria-label={t.wish.remove}
                      className="tr-press grid size-11 shrink-0 place-items-center text-expense"
                      onClick={() => void remove(it.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </Group>
        </div>
      )}
      {!compact && items.length ? (
        <div className="rt-enter-delay px-5 pt-4">
          <button
            type="button"
            className="tr-press flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent"
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
        onClose={() => setEditing(null)}
        onSave={(row) => {
          if (editing === "new" || !editing) void add(row);
          else void update(row);
          setEditing(null);
          setBoard(row);
        }}
      />
      <WishBoard
        item={board ? items.find((x) => x.id === board.id) ?? board : null}
        onClose={() => setBoard(null)}
        onEdit={(it) => {
          setBoard(null);
          setEditing(it);
        }}
        onConvert={(it) => {
          setBoard(null);
          setConverting(it);
        }}
      />
      {converting ? <ConvertSheet key={converting.id} item={converting} onClose={() => setConverting(null)} /> : null}
    </div>
  );
}

function WishBoard({
  item,
  onClose,
  onEdit,
  onConvert,
}: {
  item: WishItem | null;
  onClose: () => void;
  onEdit: (it: WishItem) => void;
  onConvert: (it: WishItem) => void;
}) {
  const t = useT();
  const update = useApp((s) => s.updateWishItem);
  if (!item) return null;

  function patch(next: Partial<WishItem>) {
    void update({ ...item!, ...next });
  }

  return (
    <Overlay open onClose={onClose} variant="page">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="tr-press inline-flex min-h-11 items-center px-2 text-sm text-accent" onClick={onClose}>
          {t.common.done}
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{item.name}</h1>
        <button type="button" className="tr-press inline-flex min-h-11 items-center px-2 text-sm font-medium text-accent" onClick={() => onEdit(item)}>
          {t.wish.edit}
        </button>
      </header>
      <div className="rt-enter px-4 pb-2 pt-1">
        <button type="button" className="tr-press text-left" onClick={() => onEdit(item)}>
          <p className="text-sm font-semibold tabular-nums text-accent">{money(item.price, item.currency)}</p>
          <p className="pt-0.5 text-[11px] text-muted">{t.wish.edit}</p>
        </button>
        <p className="pb-2 pt-2 text-xs leading-5 text-muted">{t.wish.boardHint}</p>
        <button
          type="button"
          className="tr-press mb-2 inline-flex h-11 min-h-11 items-center rounded-full bg-accent-soft px-4 text-xs font-medium text-accent"
          onClick={() => onConvert(item)}
        >
          {t.wish.convert}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-2 pb-6">
        <WishColumn
          title={t.wish.consCol}
          cards={item.priceCards ?? []}
          addLabel={t.wish.addCard}
          placeholder={t.wish.cardPlaceholder}
          removeLabel={t.wish.remove}
          onChange={(priceCards) => patch({ priceCards })}
        />
        <WishColumn
          title={t.wish.prosCol}
          cards={item.valueCards ?? []}
          addLabel={t.wish.addCard}
          placeholder={t.wish.cardPlaceholder}
          removeLabel={t.wish.remove}
          onChange={(valueCards) => patch({ valueCards })}
        />
      </div>
    </Overlay>
  );
}

function WishColumn({
  title,
  cards,
  addLabel,
  placeholder,
  removeLabel,
  onChange,
}: {
  title: string;
  cards: WishCard[];
  addLabel: string;
  placeholder: string;
  removeLabel: string;
  onChange: (cards: WishCard[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const text = draft.trim();
    if (!text) return;
    onChange([...cards, { id: newId(), text }]);
    setDraft("");
  }
  return (
    <section className="rt-enter rounded-2xl bg-elevated px-1.5 py-2">
      <h2 className="px-1 pb-2 text-xs font-semibold text-muted">{title}</h2>
      <div className="space-y-2">
        {cards.map((card) => (
          <div key={card.id} className="rounded-xl bg-background px-2.5 py-2 shadow-sm">
            <p className="whitespace-pre-wrap text-sm leading-5">{card.text}</p>
            <button
              type="button"
              aria-label={removeLabel}
              className="tr-press mt-1 inline-flex min-h-11 items-center text-xs text-expense"
              onClick={() => onChange(cards.filter((c) => c.id !== card.id))}
            >
              {removeLabel}
            </button>
          </div>
        ))}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="mt-2 w-full resize-none rounded-xl bg-background px-2.5 py-2 text-sm outline-none"
      />
      <button type="button" className="tr-press mt-1 flex h-11 min-h-11 w-full items-center justify-center rounded-lg text-xs font-medium text-accent" onClick={add}>
        + {addLabel}
      </button>
    </section>
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
  onClose: () => void;
  onSave: (row: WishItem) => void;
}) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? defaultCurrency);
  const [pad, setPad] = useState(false);

  function save() {
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
      note: initial?.note,
      categoryId: initial?.categoryId,
      priceCards: initial?.priceCards,
      valueCards: initial?.valueCards,
    });
  }

  return (
    <Overlay open={open} onClose={onClose} variant="page">
      <ComposerShell
        header={<ComposerHeader onClose={onClose} onSave={save} title={initial ? t.common.edit : t.wish.add} />}
        keypad={
          pad ? (
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
          ) : null
        }
      >
        <div className="rt-enter" onFocusCapture={() => setPad(false)} onClick={() => setPad(false)}>
          <TextLine value={name} onChange={setName} placeholder={t.wish.name} />
        </div>
        <LineRow label={t.wish.price} amount={price} active={pad} onFocusAmount={() => setPad(true)} />
      </ComposerShell>
    </Overlay>
  );
}

function ConvertSheet({ item, onClose }: { item: WishItem; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const addTransaction = useApp((s) => s.addTransaction);
  const addAdhocBudget = useApp((s) => s.addAdhocBudget);
  const deleteWishItem = useApp((s) => s.deleteWishItem);
  const moneyAccounts = moneyAccountsForPicker(accounts);
  const today = todayISO();
  const [dest, setDest] = useState<"choose" | "expense" | "hold">("choose");
  const [categoryId, setCategoryId] = useState(item.categoryId ?? "");
  const [accountId, setAccountId] = useState(moneyAccounts[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(clockNow);
  const [paid, setPaid] = useState(true);
  const [pickCat, setPickCat] = useState(false);
  const cat = categories.find((c) => c.id === categoryId);

  async function saveExpense() {
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
          time,
          payee: item.name,
          payeeZh: item.name,
          planned: !paid,
          adhoc: true,
        },
        { categories, accounts },
      ),
    );
    await deleteWishItem(item.id);
    toast(t.wish.converted);
    onClose();
  }

  async function saveHold() {
    const iso = date < today ? today : date;
    await addAdhocBudget({
      id: newId(),
      label: item.name,
      labelZh: item.name,
      amount: item.price,
      currency: item.currency,
      month: iso.slice(0, 7),
      date: iso,
      time,
      categoryId: categoryId || undefined,
      accountId: accountId || undefined,
      priceCards: item.priceCards,
      valueCards: item.valueCards,
    });
    await deleteWishItem(item.id);
    toast(t.wish.toAdhocDone);
    onClose();
  }

  if (pickCat) {
    return (
      <Overlay open onClose={() => setPickCat(false)} variant="page">
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

  if (dest === "choose") {
    return (
      <Overlay open onClose={onClose} variant="page" title={t.wish.chooseConvert}>
        <div className="px-5 pb-2">
          <div className="text-base font-semibold">{item.name}</div>
          <div className="mt-0.5 text-sm tabular-nums text-muted">{money(item.price, item.currency)}</div>
        </div>
        <div className="rt-enter mx-4 mt-2 space-y-2 pb-10">
          <button
            type="button"
            className="tr-press flex h-12 min-h-12 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent"
            onClick={() => {
              setDest("expense");
              setPickCat(true);
            }}
          >
            {t.wish.convert}
          </button>
          <button
            type="button"
            className="tr-press flex h-12 min-h-12 w-full items-center justify-center rounded-xl bg-elevated text-sm font-medium"
            onClick={() => setDest("hold")}
          >
            {t.wish.toAdhoc}
          </button>
          <p className="px-1 pt-2 text-xs leading-5 text-muted">{t.wish.toAdhocHint}</p>
        </div>
      </Overlay>
    );
  }

  if (dest === "hold") {
    return (
      <Overlay open onClose={onClose} variant="page">
        <ComposerShell
          header={
            <ComposerHeader
              onClose={() => setDest("choose")}
              onSave={() => void saveHold()}
              title={t.wish.toAdhoc}
            />
          }
          keypad={null}
        >
          <LineRow label={item.name} amount={String(item.price)} />
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
          <AccountLine accounts={accounts} value={accountId} onChange={setAccountId} placeholder={t.budget.expectedAccount} />
          <p className="px-4 pt-1 text-xs leading-5 text-muted">{t.budget.expectedAccountHint}</p>
          <WhenField date={date} time={time} locale={locale} min={today} onDate={setDate} onTime={setTime} />
          <p className="px-4 py-3 text-xs leading-5 text-muted">{t.wish.holdDateHint}</p>
        </ComposerShell>
      </Overlay>
    );
  }

  return (
    <Overlay open onClose={onClose} variant="page">
      <ComposerShell
        header={<ComposerHeader onClose={() => setDest("choose")} onSave={() => void saveExpense()} title={t.wish.convert} />}
        keypad={null}
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
        <DatePaidRow date={date} time={time} paid={paid} onDate={setDate} onTime={setTime} onPaid={setPaid} />
      </ComposerShell>
    </Overlay>
  );
}
