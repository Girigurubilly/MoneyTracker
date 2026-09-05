import { useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { CategoryIcon } from "@/components/category-icon";
import { AccountLine, ComposerHeader, SelectLine, TextLine } from "@/components/txn-composer";
import { pickName } from "@/lib/i18n";
import { CATEGORY_ICON_GROUPS, type Category, type CategoryIconName, type LifeTheme } from "@/lib/types";
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
  return (
    <Overlay open={open} onClose={onClose} variant="page" layer="stack">
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
  const accounts = useApp((s) => s.accounts);
  const add = useApp((s) => s.addCategory);
  const update = useApp((s) => s.updateCategory);
  const del = useApp((s) => s.deleteCategory);
  const parents = cats.filter((c) => !c.parentId);
  const [name, setName] = useState(initial ? pickName(locale, initial.name, initial.nameZh) : "");
  const [kind, setKind] = useState<"expense" | "income">(initial?.kind ?? defaultKind ?? "expense");
  const [parentId, setParentId] = useState(initial?.parentId ?? defaultParentId ?? "");
  const [icon, setIcon] = useState<CategoryIconName>(initial?.icon ?? "wallet");
  const [defaultAccountId, setDefaultAccountId] = useState(
    initial?.defaultAccountId ?? cats.find((c) => c.id === (initial?.parentId ?? defaultParentId))?.defaultAccountId ?? "",
  );

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
      defaultAccountId: defaultAccountId || undefined,
    };
    if (initial) await update(row);
    else await add(row);
    toast(t.add.savedToast);
    onClose();
  }

  return (
    <div className="flex min-h-full flex-col">
      <ComposerHeader
        onClose={onClose}
        onSave={() => void save()}
        title={initial ? t.common.edit : parentId ? t.add.newSub : t.add.newMain}
      />
      <TextLine value={name} onChange={setName} placeholder={t.budget.customName} />
      <SelectLine
        label={t.add.parentCategory}
        value={parentId}
        onChange={setParentId}
        options={[
          { id: "", label: t.add.noParent },
          ...parents.filter((p) => p.id !== initial?.id).map((p) => ({ id: p.id, label: pickName(locale, p.name, p.nameZh) })),
        ]}
      />
      {!parentId ? (
        <SelectLine
          label={t.more.kind}
          value={kind}
          onChange={(v) => setKind(v as "expense" | "income")}
          options={[
            { id: "expense", label: t.add.expense },
            { id: "income", label: t.add.income },
          ]}
        />
      ) : null}
      <AccountLine accounts={accounts} value={defaultAccountId} onChange={setDefaultAccountId} placeholder={t.add.defaultAccount} />
      <p className="px-4 py-2 text-xs text-muted">{t.add.defaultAccountHint}</p>
      <div className="px-4 pb-8 pt-1">
        <div className="text-xs text-muted">{t.add.icon}</div>
        <div className="mt-2 space-y-3">
          {CATEGORY_ICON_GROUPS.map((g) => (
            <div key={g.id}>
              <div className="pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">{t.add.iconGroups[g.id]}</div>
              <div className="grid grid-cols-7 gap-1.5">
                {g.icons.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={id}
                    onClick={() => setIcon(id)}
                    className={cn(
                      "grid size-10 place-items-center rounded-full bg-elevated",
                      icon === id && "ring-2 ring-accent text-accent",
                    )}
                  >
                    <CategoryIcon name={id} className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {initial ? (
        <button
          type="button"
          className="mx-4 mb-10 h-12 rounded-xl text-sm font-medium text-expense"
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
