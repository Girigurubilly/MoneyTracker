import { useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { CategoryIcon } from "@/components/category-icon";
import { pickName } from "@/lib/i18n";
import { CATEGORY_ICONS, type Category, type CategoryIconName, type LifeTheme } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { cn } from "@/lib/utils";

export function CategoryEditor({
  open,
  onClose,
  initial,
  defaultParentId,
  defaultKind,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Category | null;
  defaultParentId?: string;
  defaultKind?: "expense" | "income";
}) {
  const t = useT();
  return (
    <Overlay open={open} onClose={onClose} title={initial ? t.common.edit : defaultParentId ? t.add.newSub : t.add.newMain} variant="page" layer="stack">
      {open ? (
        <CategoryEditorBody
          key={initial?.id ?? `${defaultParentId ?? "main"}-${defaultKind ?? "expense"}`}
          initial={initial}
          defaultParentId={defaultParentId}
          defaultKind={defaultKind}
          onClose={onClose}
        />
      ) : null}
    </Overlay>
  );
}

function CategoryEditorBody({
  initial,
  defaultParentId,
  defaultKind,
  onClose,
}: {
  initial?: Category | null;
  defaultParentId?: string;
  defaultKind?: "expense" | "income";
  onClose: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const cats = useApp((s) => s.categories);
  const add = useApp((s) => s.addCategory);
  const update = useApp((s) => s.updateCategory);
  const del = useApp((s) => s.deleteCategory);
  const parents = cats.filter((c) => !c.parentId);
  const [name, setName] = useState(initial ? pickName(locale, initial.name, initial.nameZh) : "");
  const [kind, setKind] = useState<"expense" | "income">(initial?.kind ?? defaultKind ?? "expense");
  const [parentId, setParentId] = useState(initial?.parentId ?? defaultParentId ?? "");
  const [icon, setIcon] = useState<CategoryIconName>(initial?.icon ?? "wallet");

  async function save() {
    const n = name.trim();
    if (!n) return;
    const parent = parents.find((p) => p.id === parentId);
    const theme: LifeTheme = parent?.theme ?? (kind === "income" ? "other" : "living");
    const row: Category = {
      id: initial?.id ?? newId(),
      name: n,
      nameZh: n,
      theme,
      kind: parent?.kind ?? kind,
      icon,
      parentId: parentId || undefined,
      essential: initial?.essential,
      defaultAccountId: initial?.defaultAccountId,
    };
    if (initial) await update(row);
    else await add(row);
    toast(t.add.savedToast);
    onClose();
  }

  return (
    <div className="px-5 pb-10">
      <label className="block py-2">
        <span className="text-xs text-muted">{t.budget.customName}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.parentCategory}</span>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3">
          <option value="">{t.add.noParent}</option>
          {parents
            .filter((p) => p.id !== initial?.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {pickName(locale, p.name, p.nameZh)}
              </option>
            ))}
        </select>
      </label>
      {!parentId ? (
        <label className="block py-2">
          <span className="text-xs text-muted">{t.more.kind}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as "expense" | "income")} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3">
            <option value="expense">{t.add.expense}</option>
            <option value="income">{t.add.income}</option>
          </select>
        </label>
      ) : null}
      <div className="py-2">
        <span className="text-xs text-muted">{t.add.icon}</span>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {CATEGORY_ICONS.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={id}
              onClick={() => setIcon(id)}
              className={cn(
                "grid size-11 place-items-center rounded-full bg-elevated",
                icon === id && "ring-2 ring-accent text-accent",
              )}
            >
              <CategoryIcon name={id} className="size-5" />
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void save()}>
        {t.add.save}
      </button>
      {initial ? (
        <button
          type="button"
          className="mt-3 h-12 w-full text-sm font-medium text-expense"
          onClick={async () => {
            await del(initial.id);
            onClose();
          }}
        >
          {t.tx.delete}
        </button>
      ) : null}
    </div>
  );
}
