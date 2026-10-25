import type { Transaction } from "./types.ts";

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
