import { useState } from "react";
import { Overlay } from "@/components/shared";
import { CategoryIcon } from "@/components/category-icon";
import { AccountLine, ComposerHeader, SelectLine, TextLine } from "@/components/txn-composer";
import { pickName } from "@/lib/i18n";
import { infersAdhoc } from "@/lib/tx-rules";
import { isHousingCategory, isTaxCategory, resolvedSpecial } from "@/lib/categories";
import { CATEGORY_ICON_GROUPS, type Category, type CategoryIconName, type CategorySpecial, type FireSpendKind, type LifeTheme } from "@/lib/types";
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
  const [parentId, setParentId] = useState(
    initial?.parentId && initial.parentId !== initial.id ? initial.parentId : initial ? "" : (defaultParentId ?? ""),
  );
  const [icon, setIcon] = useState<CategoryIconName>(initial?.icon ?? "wallet");
  const [defaultAccountId, setDefaultAccountId] = useState(
    initial?.defaultAccountId ?? cats.find((c) => c.id === (initial?.parentId ?? defaultParentId))?.defaultAccountId ?? "",
  );
  const [adhocDefault, setAdhocDefault] = useState(
    initial?.adhocDefault ?? infersAdhoc(initial?.id ?? defaultParentId, cats),
  );
  const [fireKind, setFireKind] = useState<FireSpendKind | "">(initial?.fireSpendKind ?? "");
  const parentSeed = cats.find((c) => c.id === (initial?.parentId ?? defaultParentId));
  const [theme, setTheme] = useState<LifeTheme>(
    initial?.theme ?? parentSeed?.theme ?? ((initial?.kind ?? defaultKind ?? "expense") === "income" ? "other" : "living"),
  );
  const [special, setSpecial] = useState<CategorySpecial>(() => {
    if (initial) {
      const s = resolvedSpecial(initial, cats);
      if (s !== "none") return s;
      if (isHousingCategory(initial, cats)) return "housing";
      return "none";
    }
    if (parentSeed && resolvedSpecial(parentSeed, cats) === "housing") return "housing";
    return "none";
  });
  const [tax, setTax] = useState(initial ? isTaxCategory(initial) : false);
  const [essential, setEssential] = useState(Boolean(initial?.essential));
  const expenseKind = (parentId ? parents.find((p) => p.id === parentId)?.kind ?? kind : kind) === "expense";

  async function save() {
    const n = name.trim();
    if (!n) return;
    const nextParentId = parentId && parentId !== (initial?.id ?? "") ? parentId : undefined;
    const parent = parents.find((p) => p.id === nextParentId);
    const nextKind = parent?.kind ?? kind;
    const row: Category = {
      id: initial?.id ?? newId(),
      name: n,
      nameZh: n,
      theme,
      kind: nextKind,
      icon,
      parentId: nextParentId,
      essential: nextKind === "expense" ? essential : undefined,
      adhocDefault: nextKind === "expense" ? adhocDefault : undefined,
      defaultAccountId: defaultAccountId || undefined,
      fireSpendKind: nextKind === "expense" && fireKind ? fireKind : undefined,
      special: nextKind === "expense" ? special : "none",
      tax: nextKind === "expense" ? tax : false,
    };
    if (initial) await update(row);
    else await add(row);
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
        onChange={(v) => {
          setParentId(v);
          const parent = parents.find((p) => p.id === v);
          if (!parent) return;
          setKind(parent.kind);
          setTheme(parent.theme);
          if (resolvedSpecial(parent, cats) === "housing" && (special === "none" || special === "housing")) {
            setSpecial("housing");
          }
        }}
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
      <SelectLine
        label={t.add.catTheme}
        value={theme}
        onChange={(v) => setTheme(v as LifeTheme)}
        options={[
          { id: "living", label: t.add.themeLiving },
          { id: "travel", label: t.add.themeTravel },
          { id: "retirement", label: t.add.themeRetirement },
          { id: "other", label: t.add.themeOther },
        ]}
      />
      <p className="px-4 py-2 text-xs text-muted">{t.add.catThemeHint}</p>
      <AccountLine accounts={accounts} value={defaultAccountId} onChange={setDefaultAccountId} placeholder={t.add.defaultAccount} />
      <p className="px-4 py-2 text-xs text-muted">{t.add.defaultAccountHint}</p>
      {expenseKind ? (
        <>
          <SelectLine
            label={t.add.catSpecial}
            value={special}
            onChange={(v) => setSpecial(v as CategorySpecial)}
            options={[
              { id: "none", label: t.add.catSpecialNone },
              { id: "housing", label: t.add.catSpecialHousing },
              { id: "mortgagePrincipal", label: t.add.catSpecialPrincipal },
              { id: "mortgageInterest", label: t.add.catSpecialInterest },
              { id: "mortgageSplit", label: t.add.catSpecialSplit },
            ]}
          />
          <p className="px-4 py-2 text-xs text-muted">{t.add.catSpecialHint}</p>
          <RuleCheck checked={tax} onChange={setTax} label={t.add.catTax} hint={t.add.catTaxHint} />
          <RuleCheck checked={essential} onChange={setEssential} label={t.add.catEssential} hint={t.add.catEssentialHint} />
          <RuleCheck checked={adhocDefault} onChange={setAdhocDefault} label={t.add.adhocDefault} hint={t.add.adhocDefaultHint} />
          <SelectLine
            label={t.reports.fireSpendEngine}
            value={fireKind}
            onChange={(v) => setFireKind(v as FireSpendKind | "")}
            options={[
              { id: "", label: t.add.fireSpendAuto },
              { id: "work", label: t.reports.fireKindWork },
              { id: "core", label: t.reports.fireKindCore },
              { id: "flex", label: t.reports.fireKindFlex },
              { id: "irregular", label: t.reports.fireKindIrregular },
            ]}
          />
        </>
      ) : null}
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

function RuleCheck({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex items-start gap-3 border-b border-line px-4 py-3">
      <input type="checkbox" className="mt-1 size-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}
