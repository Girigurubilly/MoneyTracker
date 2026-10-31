import { categoryPath } from "../categories.ts";
import type { AdhocBudget, Category, FxRate } from "../types.ts";
import { toHkd } from "./fx.ts";

type Named = { id: string; name: string; nameZh: string };

function hkd(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function cell(value: string): string {
  return value.replace(/\|/g, "/").replace(/\n/g, " ");
}

export function renderAdhocBriefMarkdown(input: {
  asOf: string;
  locale: "en" | "zh-HK";
  rows: AdhocBudget[];
  categories: Category[];
  rates: FxRate[];
  trips?: Named[];
  accounts?: Named[];
}): string {
  const today = input.asOf;
  const month = today.slice(0, 7);
  const rows = [...input.rows].sort((a, b) => (a.month || a.date).localeCompare(b.month || b.date) || a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  let unpaid = 0;
  let paid = 0;
  let unpaidThis = 0;
  let unpaidLater = 0;
  const byMonth = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.month || row.date.slice(0, 7);
    const value = toHkd(row.amount, row.currency, input.rates);
    const status = row.paidOn ? "paid" : row.date > today ? "later" : "due";
    if (row.paidOn) paid += value;
    else {
      unpaid += value;
      if (key === month) unpaidThis += value;
      else if (key > month) unpaidLater += value;
    }
    const name = input.locale === "zh-HK" ? row.labelZh || row.label : row.label || row.labelZh;
    const cat = input.categories.find((c) => c.id === row.categoryId);
    const trip = input.trips?.find((t) => t.id === row.tripId);
    const account = input.accounts?.find((a) => a.id === row.accountId);
    const line = `| ${cell(row.time ? `${row.date} ${row.time}` : row.date)} | ${cell(name)} | ${cell(cat ? categoryPath(cat, input.categories, input.locale) : "")} | ${hkd(row.amount)} | ${row.currency} | ${hkd(value)} | ${status}${row.paidOn ? ` ${row.paidOn}` : ""} | ${cell(trip ? (input.locale === "zh-HK" ? trip.nameZh || trip.name : trip.name) : "")} | ${cell(account ? (input.locale === "zh-HK" ? account.nameZh || account.name : account.name) : "")} |`;
    const list = byMonth.get(key) ?? [];
    list.push(line);
    byMonth.set(key, list);
  }
  const lines = [
    `# One-off payments`,
    ``,
    `- As of: ${today}`,
    `- Currency of totals: HKD`,
    `- Unpaid, not yet posted: ${hkd(unpaid)}`,
    `- Already paid: ${hkd(paid)}`,
    `- Unpaid in ${month}: ${hkd(unpaidThis)}`,
    `- Unpaid in later months: ${hkd(unpaidLater)}`,
    ``,
    `A paid row has been posted. A row without a paid date is only a plan and does not change an account balance. Later months stay off the current budget page until that month.`,
    ``,
  ];
  for (const [key, list] of byMonth) {
    lines.push(`## ${key}${key === month ? " (current month)" : ""}`, ``, `| When | Item | Category | Amount | Currency | HKD | Status | Trip | Account |`, `| --- | --- | --- | ---: | --- | ---: | --- | --- | --- |`, ...list, ``);
  }
  if (!rows.length) lines.push(`No one-off payments.`, ``);
  return lines.join("\n");
}
