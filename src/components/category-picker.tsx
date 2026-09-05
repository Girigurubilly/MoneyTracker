import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, Pencil } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryEditor } from "@/components/category-editor";
import { Hairline } from "@/components/shared";
import { pickName } from "@/lib/i18n";
import { pickerGroups } from "@/lib/categories";
import { cashflowSide, monthKey } from "@/lib/calc/ledger";
import { toHkd } from "@/lib/calc/fx";
import type { Category, FxRate, Transaction, TxType } from "@/lib/types";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { cn } from "@/lib/utils";

export function TypeSwitch({
  value,
  onChange,
  includeMiles,
}: {
  value: TxType;
  onChange: (t: TxType) => void;
  includeMiles?: boolean;
}) {
  const t = useT();
  const opts: TxType[] = ["expense", "income", "transfer"];
  return (
    <label className="relative inline-flex min-h-11 items-center justify-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TxType)}
        className="h-11 appearance-none bg-transparent pr-5 text-center text-base font-semibold outline-none"
        aria-label={t.more.kind}
      >
        {opts.map((k) => (
          <option key={k} value={k}>
            {t.add[k]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-0 size-4 text-foreground" />
    </label>
  );
}

export function CategoryPicker({
  categories,
  kind,
  selectedId,
  txType,
  onTxTypeChange,
  onClose,
  onSelect,
  embedded,
  manageOnly,
}: {
  categories: Category[];
  kind: "expense" | "income";
  selectedId?: string;
  txType?: TxType;
  onTxTypeChange?: (t: TxType) => void;
  onClose: () => void;
  onSelect: (c: Category | null) => void;
  embedded?: boolean;
  manageOnly?: boolean;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const budgets = useApp((s) => s.budgets);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const [parent, setParent] = useState<Category | null>(null);
  const [editMode, setEditMode] = useState(!!manageOnly);
  const [editOpen, setEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<Category | null>(null);
  const groups = useMemo(
    () => pickerGroups(categories.filter((c) => c.kind === kind)),
    [categories, kind],
  );
  const month = monthKey();
  const spent = useMemo(() => spentByCategory(txs, categories, rates, month), [txs, categories, rates, month]);
  const tiles = parent ? (groups.find((g) => g.parent.id === parent.id)?.children ?? []) : groups.map((g) => g.parent);
  const selected = categories.find((c) => c.id === selectedId);
  const parentRatio = parent
    ? ringRatio(budgets.find((b) => b.categoryId === parent.id)?.monthly ?? 0, spent.get(parent.id) ?? 0)
    : 0;

  useEffect(() => {
    setParent(null);
  }, [kind]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (editOpen) return;
      if (parent) {
        setParent(null);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editOpen, parent, onClose]);

  function openCreate() {
    setEditInitial(null);
    setEditOpen(true);
  }

  function openEditCat(c: Category | null) {
    setEditInitial(c);
    setEditOpen(true);
  }

  function pick(c: Category) {
    onSelect(c);
    onClose();
  }

  function onTile(c: Category) {
    if (editMode || manageOnly) {
      openEditCat(c);
      return;
    }
    if (!parent) {
      const g = groups.find((x) => x.parent.id === c.id);
      if (g && g.children.length) {
        setParent(c);
        return;
      }
    }
    pick(c);
  }

  const node = (
    <div className={cn(embedded ? "flex min-h-0 flex-1 flex-col" : "fixed inset-0 z-[96] flex h-dvh flex-col bg-background")}>
      {embedded ? (
        <div className="px-3 pb-2 pt-1 text-center">
          {onTxTypeChange && txType ? (
            <TypeSwitch
              value={txType === "income" ? "income" : "expense"}
              onChange={(next) => {
                onTxTypeChange(next === "income" ? "income" : "expense");
                setParent(null);
              }}
              includeMiles={false}
            />
          ) : null}
        </div>
      ) : (
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.add.cancel}
        </button>
        <div className="min-w-0 flex-1 text-center">
          {onTxTypeChange && txType ? (
            <TypeSwitch
              value={txType}
              onChange={(next) => {
                onTxTypeChange(next);
                setParent(null);
              }}
            />
          ) : (
            <div className="text-base font-semibold">{kind === "income" ? t.add.income : t.add.expense}</div>
          )}
        </div>
        <button
          type="button"
          className="h-11 min-w-11 px-2 text-sm text-accent"
          onClick={() => setEditMode((v) => !v)}
        >
          {editMode ? t.common.done : t.common.edit}
        </button>
      </header>
      )}
      {embedded ? null : <Hairline />}

      {parent ? (
        <>
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              aria-label={t.common.back}
              onClick={() => setParent(null)}
              className="shrink-0"
            >
              <BudgetRing ratio={parentRatio} size={44}>
                <span className="grid size-9 place-items-center rounded-full bg-elevated">
                  <ChevronLeft className="size-5" />
                </span>
              </BudgetRing>
            </button>
            <button type="button" className="flex min-w-0 items-center gap-2" onClick={() => (editMode ? openEditCat(parent) : pick(parent))}>
              <span className="grid size-10 place-items-center">
                <CategoryIcon name={parent.icon} />
              </span>
              <span className="truncate text-base font-semibold">{pickName(locale, parent.name, parent.nameZh)}</span>
            </button>
          </div>
          <Hairline />
        </>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-4">
        <div className="grid grid-cols-4 gap-x-2 gap-y-5">
          {tiles.map((c) => {
            const ratio = ringRatio(budgets.find((b) => b.categoryId === c.id)?.monthly ?? 0, spent.get(c.id) ?? 0);
            const isOn = selectedId === c.id || (!parent && selected?.parentId === c.id);
            return (
              <button key={c.id} type="button" onClick={() => onTile(c)} className="flex min-h-11 flex-col items-center gap-2">
                <span className="relative">
                  <BudgetRing ratio={ratio} size={64}>
                    <span
                      className={cn(
                        "grid size-12 place-items-center rounded-full bg-elevated",
                        isOn && "bg-expense-soft text-expense",
                      )}
                    >
                      <CategoryIcon name={c.icon} />
                    </span>
                  </BudgetRing>
                  {editMode ? (
                    <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-accent text-on-accent">
                      <Pencil className="size-3" />
                    </span>
                  ) : null}
                </span>
                <span className="line-clamp-2 max-w-[4.8rem] text-center text-xs leading-tight text-foreground">
                  {pickName(locale, c.name, c.nameZh)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 space-y-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        <button type="button" className="h-11 w-full rounded-xl bg-elevated text-sm" onClick={openCreate}>
          {parent ? t.add.newSub : t.add.newMain}
        </button>
      </div>

      <CategoryEditor
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={editInitial}
        defaultParentId={parent?.id}
        defaultKind={kind}
      />
    </div>
  );

  if (embedded) return node;
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

function ringRatio(monthly: number, used: number) {
  if (monthly <= 0) return used > 0 ? 1 : 0;
  return used / monthly;
}

function BudgetRing({ ratio, size, children }: { ratio: number; size: number; children: ReactNode }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ring-track)" strokeWidth="3" />
        {ratio > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-expense)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${c * Math.min(1, ratio)} ${c}`}
          />
        ) : null}
      </svg>
      {children}
    </span>
  );
}

function spentByCategory(txs: Transaction[], categories: Category[], rates: FxRate[], month: string) {
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (tx.planned || !tx.date.startsWith(month) || !tx.categoryId) continue;
    if (cashflowSide(tx) !== "expense") continue;
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + hkd);
  }
  for (const c of categories) {
    if (!c.parentId) continue;
    map.set(c.parentId, (map.get(c.parentId) ?? 0) + (map.get(c.id) ?? 0));
  }
  return map;
}
