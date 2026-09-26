import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AdhocEditor } from "@/components/budget";
import { AmountWithHkd } from "@/components/currency-field";
import { ScreenHeader } from "@/components/shared";
import { categoryPath } from "@/lib/categories";
import { todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import type { AdhocBudget, FxRate, WishItem } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  if (locale === "zh-HK") return `${y}年${m}月`;
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
}

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function wishFromAdhoc(a: AdhocBudget, locale: "en" | "zh-HK"): WishItem {
  return {
    id: newId(),
    name: pickName(locale, a.label, a.labelZh),
    price: a.amount,
    currency: a.currency === "MILES" ? "HKD" : a.currency,
    categoryId: a.categoryId,
    priceCards: a.priceCards,
    valueCards: a.valueCards,
  };
}

export function AdhocPlanPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rows = useApp((s) => s.adhocBudgets);
  const categories = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const accounts = useApp((s) => s.accounts);
  const addTx = useApp((s) => s.addTransaction);
  const delAdhoc = useApp((s) => s.deleteAdhocBudget);
  const addWish = useApp((s) => s.addWishItem);
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const [editing, setEditing] = useState<AdhocBudget | null>(null);
  const [addingMonth, setAddingMonth] = useState<string | null>(null);

  const groups = useMemo(() => {
    const by = new Map<string, AdhocBudget[]>();
    for (const a of rows) {
      const month = a.month || a.date.slice(0, 7);
      const list = by.get(month) ?? [];
      list.push(a);
      by.set(month, list);
    }
    for (const list of by.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
    const months = [...by.keys()].sort();
    return {
      current: by.get(thisMonth) ?? [],
      future: months.filter((m) => m > thisMonth),
      past: months.filter((m) => m < thisMonth).reverse(),
      by,
    };
  }, [rows, thisMonth]);

  function openAdd(month: string) {
    setEditing(null);
    setAddingMonth(month);
  }

  async function post(a: AdhocBudget) {
    const acc = accounts.find((x) => x.type === "cash" || x.type === "current" || x.type === "savings") ?? accounts[0];
    if (!acc) return;
    await addTx({
      type: "expense",
      date: today,
      amount: a.amount,
      currency: a.currency,
      accountId: acc.id,
      categoryId: a.categoryId,
      payee: a.label,
      payeeZh: a.labelZh,
      note: a.label,
      adhoc: true,
    });
    await delAdhoc(a.id);
  }

  function section(title: string, months: string[], empty: string) {
    return (
      <section className="pt-4">
        <h2 className="px-5 pb-2 text-sm font-medium text-muted">{title}</h2>
        {months.length === 0 ? <p className="px-5 py-2 text-sm text-muted">{empty}</p> : null}
        {months.map((month) => (
          <MonthBlock
            key={month}
            month={month}
            label={monthLabel(month, locale)}
            rows={groups.by.get(month) ?? []}
            today={today}
            rates={rates}
            locale={locale}
            categories={categories}
            onAdd={() => openAdd(month)}
            onEdit={setEditing}
            onPost={(a) => void post(a)}
            onWish={async (a) => {
              await addWish(wishFromAdhoc(a, locale));
              await delAdhoc(a.id);
              toast(t.budget.toWishlistDone);
            }}
          />
        ))}
      </section>
    );
  }

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.more.adhocPlan}
        backTo="/more"
        right={
          <button type="button" className="shrink-0 px-2 text-sm font-medium text-accent" onClick={() => openAdd(thisMonth)}>
            {t.budget.addShort}
          </button>
        }
      />
      <p className="px-5 pb-2 text-xs leading-5 text-muted">{t.budget.adhocPlanHint}</p>
      <section className="pt-2">
        <div className="flex items-center justify-between gap-3 px-5 pb-2">
          <h2 className="min-w-0 text-sm font-medium text-muted">
            {t.budget.adhoc} · {monthLabel(thisMonth, locale)}
          </h2>
          <button type="button" className="shrink-0 text-sm font-medium text-accent" onClick={() => openAdd(thisMonth)}>
            {t.budget.addShort}
          </button>
        </div>
        <MonthRows
          rows={groups.current}
          today={today}
          rates={rates}
          locale={locale}
          categories={categories}
          empty={t.budget.adhocNone}
          onEdit={setEditing}
          onPost={(a) => void post(a)}
          onWish={async (a) => {
            await addWish(wishFromAdhoc(a, locale));
            await delAdhoc(a.id);
            toast(t.budget.toWishlistDone);
          }}
        />
      </section>
      {section(t.budget.adhocFuture, groups.future, t.budget.adhocNone)}
      <div className="px-5 pt-2">
        <button type="button" className="text-sm font-medium text-accent" onClick={() => openAdd(nextMonth(groups.future.at(-1) ?? thisMonth))}>
          {t.budget.addAdhocAny}
        </button>
      </div>
      {groups.past.length ? section(t.budget.adhocPast, groups.past, "") : null}
      <AdhocEditor
        open={addingMonth != null || editing != null}
        initial={editing}
        month={editing ? editing.month || editing.date.slice(0, 7) : (addingMonth ?? thisMonth)}
        lockToMonth={false}
        onClose={() => {
          setEditing(null);
          setAddingMonth(null);
        }}
      />
    </div>
  );
}

function MonthBlock({
  label,
  rows,
  today,
  rates,
  locale,
  categories,
  onAdd,
  onEdit,
  onPost,
  onWish,
}: {
  month: string;
  label: string;
  rows: AdhocBudget[];
  today: string;
  rates: FxRate[];
  locale: "en" | "zh-HK";
  categories: ReturnType<typeof useApp.getState>["categories"];
  onAdd: () => void;
  onEdit: (a: AdhocBudget) => void;
  onPost: (a: AdhocBudget) => void;
  onWish: (a: AdhocBudget) => void;
}) {
  const t = useT();
  return (
    <div className="pb-3">
      <div className="flex items-center justify-between gap-3 px-5 pb-1">
        <h3 className="min-w-0 text-sm font-medium">{label}</h3>
        <button type="button" className="shrink-0 text-sm font-medium text-accent" onClick={onAdd}>
          {t.budget.addShort}
        </button>
      </div>
      <MonthRows rows={rows} today={today} rates={rates} locale={locale} categories={categories} empty={t.budget.adhocNone} onEdit={onEdit} onPost={onPost} onWish={onWish} />
    </div>
  );
}

function MonthRows({
  rows,
  today,
  rates,
  locale,
  categories,
  empty,
  onEdit,
  onPost,
  onWish,
}: {
  rows: AdhocBudget[];
  today: string;
  rates: FxRate[];
  locale: "en" | "zh-HK";
  categories: ReturnType<typeof useApp.getState>["categories"];
  empty: string;
  onEdit: (a: AdhocBudget) => void;
  onPost: (a: AdhocBudget) => void;
  onWish: (a: AdhocBudget) => void;
}) {
  const t = useT();
  if (!rows.length) return <p className="px-5 py-2 text-sm text-muted">{empty}</p>;
  return (
    <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
      {rows.map((a) => {
        const upcoming = a.date > today;
        return (
          <div key={a.id} className="border-t border-line px-4 py-3 first:border-0">
            <div className="flex items-start gap-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(a)}>
                <div className="break-words text-sm font-medium">{pickName(locale, a.label, a.labelZh)}</div>
                <div className="mt-0.5 break-words text-xs text-muted">
                  {a.date}
                  {(() => {
                    const cat = categories.find((c) => c.id === a.categoryId);
                    return cat ? ` · ${categoryPath(cat, categories, locale)}` : "";
                  })()}
                </div>
              </button>
              <AmountWithHkd amount={-a.amount} currency={a.currency} rates={rates} sign className="shrink-0 text-sm font-semibold" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
            {upcoming ? (
              <button type="button" className="h-8 shrink-0 rounded-full bg-accent-soft px-3 text-xs font-medium text-accent" onClick={() => onPost(a)}>
                {t.budget.postAdhoc}
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-success-soft px-2 py-1 text-xs font-medium text-income">{t.budget.charged}</span>
            )}
            {upcoming ? (
              <button type="button" className="h-8 shrink-0 rounded-full bg-elevated px-3 text-xs font-medium" onClick={() => onWish(a)}>
                {t.budget.toWishlist}
              </button>
            ) : null}
            <button type="button" aria-label={t.common.edit} className="ml-auto" onClick={() => onEdit(a)}>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
