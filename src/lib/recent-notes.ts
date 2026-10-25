import type { Category, Transaction } from "./types.ts";

const PLACEHOLDER = new Set(
  ["expense", "income", "transfer", "asia miles", "principal", "interest", "費用", "收入", "轉帳", "亞洲萬里通", "本金", "利息"].map((s) => s.toLocaleLowerCase()),
);

/** Three newest distinct remarks already used on this exact category. */
export function recentNoteLabels(transactions: Transaction[], categoryId: string, limit = 3): string[] {
  if (!categoryId) return [];
  const rows = transactions
    .filter((tx) => tx.type === "expense" && tx.categoryId === categoryId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "") || b.id.localeCompare(a.id));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tx of rows) {
    const label = (tx.payee || tx.payeeZh || "").trim();
    const key = label.toLocaleLowerCase();
    if (!label || PLACEHOLDER.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

/** Newest leaf categories already used on posted transactions. Parents are skipped so one tap picks 飲食 → 子類. */
export function recentLeafCategories(
  transactions: Transaction[],
  categories: Category[],
  kind: "expense" | "income",
  limit = 6,
): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parents = new Set(categories.flatMap((c) => (c.parentId ? [c.parentId] : [])));
  const rows = transactions
    .filter((tx) => !tx.planned && tx.type === kind && tx.categoryId && byId.get(tx.categoryId)?.kind === kind)
    .sort(
      (a, b) =>
        (b.date || "").localeCompare(a.date || "") ||
        (b.time || "").localeCompare(a.time || "") ||
        (b.createdAt || "").localeCompare(a.createdAt || "") ||
        b.id.localeCompare(a.id),
    );
  const out: Category[] = [];
  const seen = new Set<string>();
  for (const tx of rows) {
    const cat = tx.categoryId ? byId.get(tx.categoryId) : undefined;
    if (!cat || parents.has(cat.id) || seen.has(cat.id)) continue;
    seen.add(cat.id);
    out.push(cat);
    if (out.length >= limit) break;
  }
  return out;
}
