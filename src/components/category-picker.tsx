import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CategoryGlyph } from "@/components/shared";
import { categoryTint, displayCategoryName, pickerGroups, type PickerGroup } from "@/lib/categories";
import { useT, useUi } from "@/store/ui";
import { cn } from "@/lib/utils";
import type { Budget, Category, TxType } from "@/lib/types";

export function CategoryPicker({
  categories,
  kind,
  onKindChange,
  budgets,
  spentById,
  onSelect,
  onClose,
}: {
  categories: Category[];
  kind: "expense" | "income";
  onKindChange?: (k: TxType) => void;
  budgets: Budget[];
  spentById: Map<string, number>;
  onSelect: (c: Category) => void;
  onClose?: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const [open, setOpen] = useState<PickerGroup | null>(null);
  const [kindOpen, setKindOpen] = useState(false);
  const kindRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => pickerGroups(categories, kind), [categories, kind]);
  useEffect(() => {
    setOpen(null);
    setKindOpen(false);
  }, [kind]);
  useEffect(() => {
    if (!kindOpen) return;
    function onDoc(e: MouseEvent) {
      if (kindRef.current && !kindRef.current.contains(e.target as Node)) setKindOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [kindOpen]);
  const ring = kind === "income" ? "var(--income)" : "var(--expense)";
  const original = (c: Category) => categories.find((x) => x.id === c.id) ?? c;

  function ratioFor(c: Category, nested: Category[]): number {
    const ids = nested.length ? nested.map((x) => x.id) : [c.id];
    let spent = 0;
    for (const id of ids) spent += spentById.get(id) ?? 0;
    const cap = budgets
      .filter((b) => b.categoryId && ids.includes(b.categoryId))
      .reduce((s, b) => s + b.monthly, 0);
    if (cap > 0) return spent / cap;
    const monthCap = budgets.find((b) => !b.categoryId && !b.theme)?.monthly ?? 0;
    return monthCap > 0 ? spent / monthCap : spent > 0 ? 0.18 : 0;
  }

  function pickMain(g: PickerGroup) {
    if (g.children.length) setOpen(g);
    else onSelect(original(g.parent));
  }

  return (
    <div className="flex min-h-[70dvh] flex-col px-3 pb-10 pt-[max(0.35rem,env(safe-area-inset-top))]">
      <div className="relative flex items-center justify-between pb-2">
        {open ? (
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="grid size-11 place-items-center text-accent"
            aria-label={t.common.back}
          >
            <ChevronLeft className="size-6" strokeWidth={2} />
          </button>
        ) : onClose ? (
          <button type="button" onClick={onClose} className="min-h-11 min-w-14 px-2 text-left text-sm font-medium text-accent">
            {t.add.cancel}
          </button>
        ) : (
          <span className="min-w-14" />
        )}

        {open ? (
          <span className="min-w-0 flex-1 truncate px-1 text-center text-lg font-semibold">
            {displayCategoryName(open.parent, locale)}
          </span>
        ) : onKindChange ? (
          <div className="relative" ref={kindRef}>
            <button
              type="button"
              onClick={() => setKindOpen((v) => !v)}
              className="flex min-h-11 items-center gap-0.5 text-lg font-semibold"
            >
              {kind === "income" ? t.add.income : t.add.expense}
              <ChevronDown className="size-5 text-muted" />
            </button>
            {kindOpen ? (
              <div className="absolute left-1/2 top-full z-20 mt-1 w-40 -translate-x-1/2 overflow-hidden rounded-xl bg-elevated py-1 shadow-lg ring-1 ring-line">
                {(
                  [
                    ["expense", t.add.expense],
                    ["income", t.add.income],
                    ["transfer", t.add.transfer],
                    ["miles", t.add.miles],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "flex h-11 w-full items-center px-4 text-left text-sm",
                      id === kind && "font-semibold text-accent",
                    )}
                    onClick={() => {
                      setKindOpen(false);
                      onKindChange(id);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-lg font-semibold">
            {kind === "income" ? t.add.income : t.add.expense}
          </span>
        )}

        <Link
          to="/more/$page"
          params={{ page: "categories" }}
          onClick={onClose}
          className="grid min-h-11 min-w-14 place-items-center text-sm font-medium text-accent"
        >
          {t.common.edit}
        </Link>
      </div>

      {open ? (
        <div className="flex-1">
          <p className="px-2 pb-3 text-center text-xs text-muted">{t.add.subcategory}</p>
          <div className="overflow-hidden rounded-xl bg-elevated">
            {open.children.map((c) => {
              const tint = categoryTint(c.icon);
              return (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left first:border-0"
                  onClick={() => onSelect(original(c))}
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full"
                    style={{ background: tint.bg, color: tint.fg }}
                  >
                    <CategoryGlyph name={c.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{displayCategoryName(c, locale)}</span>
                  <ChevronRight className="size-4 shrink-0 text-faint" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <p className="px-2 pb-4 text-center text-xs text-muted">{t.add.parentCategory}</p>
          <div className="grid grid-cols-4 gap-x-1 gap-y-5">
            {groups.map((g) => {
              const ratio = ratioFor(g.parent, g.children);
              const tint = categoryTint(g.parent.icon);
              return (
                <button
                  key={g.key}
                  type="button"
                  className="flex flex-col items-center gap-1.5"
                  onClick={() => pickMain(g)}
                >
                  <span className="relative">
                    <UsageRing ratio={ratio} stroke={ring}>
                      <span
                        className="grid size-12 place-items-center rounded-full"
                        style={{ background: tint.bg, color: tint.fg }}
                      >
                        <CategoryGlyph name={g.parent.icon} className="size-6" />
                      </span>
                    </UsageRing>
                    {g.children.length ? (
                      <span className="absolute -right-0.5 bottom-1 grid size-5 place-items-center rounded-full bg-elevated text-muted shadow-sm ring-1 ring-line">
                        <ChevronRight className="size-3" strokeWidth={2.4} />
                      </span>
                    ) : null}
                  </span>
                  <span className="w-full px-0.5 text-center text-[10px] leading-tight">
                    {displayCategoryName(g.parent, locale)}
                  </span>
                </button>
              );
            })}
          </div>
          {groups.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-muted">{t.reports.noData}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

function UsageRing({
  ratio,
  stroke,
  children,
}: {
  ratio: number;
  stroke: string;
  children: React.ReactNode;
}) {
  const size = 72;
  const r = 30;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, ratio));
  const color = ratio >= 1 ? "var(--expense)" : stroke;
  return (
    <span className={cn("relative grid size-[4.5rem] place-items-center")}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth="3.5" />
        {p > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${p * c} ${c}`}
          />
        ) : null}
      </svg>
      {children}
    </span>
  );
}