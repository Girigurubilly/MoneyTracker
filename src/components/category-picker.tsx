import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { pickName } from "@/lib/i18n";
import { pickerGroups } from "@/lib/categories";
import { money } from "@/lib/format";
import type { Budget, Category } from "@/lib/types";
import { useT, useUi } from "@/store/ui";

export function CategoryPicker({
  categories,
  kind,
  onClose,
  onSelect,
}: {
  categories: Category[];
  kind: "expense" | "income";
  budgets?: Budget[];
  spentById?: Map<string, number>;
  onClose: () => void;
  onSelect: (c: Category | null) => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const [q, setQ] = useState("");
  const [parent, setParent] = useState<Category | null>(null);
  const groups = useMemo(() => pickerGroups(categories.filter((c) => c.kind === kind || (!c.parentId && kind === "expense"))), [categories, kind]);
  const filtered = groups.filter((g) => {
    const hay = `${g.parent.name} ${g.parent.nameZh} ${g.children.map((c) => `${c.name} ${c.nameZh}`).join(" ")}`;
    return !q || hay.toLowerCase().includes(q.toLowerCase());
  });
  const kids = parent ? (groups.find((g) => g.parent.id === parent.id)?.children ?? []) : [];

  return (
    <div className="px-5 pb-8">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.add.searchCategory}
        className="mt-2 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
      />
      {parent ? (
        <div className="pt-3">
          <button type="button" className="text-sm text-accent" onClick={() => setParent(null)}>
            ← {pickName(locale, parent.name, parent.nameZh)}
          </button>
          <button
            type="button"
            className="mt-2 flex h-12 w-full items-center justify-between rounded-xl bg-elevated px-4 text-sm"
            onClick={() => {
              onSelect(parent);
              onClose();
            }}
          >
            {t.add.useParent}
          </button>
          {kids.map((c) => (
            <button
              key={c.id}
              type="button"
              className="mt-2 flex h-12 w-full items-center justify-between rounded-xl bg-elevated px-4 text-left text-sm"
              onClick={() => {
                onSelect(c);
                onClose();
              }}
            >
              {pickName(locale, c.name, c.nameZh)}
            </button>
          ))}
        </div>
      ) : (
        <div className="pt-3">
          {filtered.map((g) => (
            <button
              key={g.parent.id}
              type="button"
              className="mb-2 flex h-12 w-full items-center justify-between rounded-xl bg-elevated px-4 text-left text-sm"
              onClick={() => {
                if (g.children.length) setParent(g.parent);
                else {
                  onSelect(g.parent);
                  onClose();
                }
              }}
            >
              <span>{pickName(locale, g.parent.name, g.parent.nameZh)}</span>
              {g.children.length ? <ChevronRight className="size-4 text-faint" /> : null}
            </button>
          ))}
        </div>
      )}
      <p className="hidden">{money(0, "HKD")}</p>
    </div>
  );
}
