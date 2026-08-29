import type { Account, Category, FxRate, Locale, Mortgage, Recurring, Transaction } from "../types.ts";
import { isMortgagePrincipalCategory, housingParentId, isMortgageInterestCategory } from "../categories.ts";
import { cashflowSide } from "./ledger.ts";
import { monthlyExpenseRegulars, hkdOfRegular } from "./budget.ts";
import { monthlyPayment, remainingInterest, effectiveRate, amortize } from "./mortgage.ts";
import { toHkd } from "./fx.ts";

export type LivingMode = NonNullable<Mortgage["livingMode"]>;

export function livingModeOf(m: Mortgage | null): LivingMode {
  if (!m) return "other";
  return m.livingMode ?? (m.outstanding > 0 ? "own-mortgage" : "own-outright");
}

export function installmentOf(m: Mortgage): number {
  if (m.paymentOverride && m.paymentOverride > 0) return m.paymentOverride;
  return monthlyPayment(m.outstanding, effectiveRate(m), m.remainingMonths);
}

export function isPrincipalRegular(r: Recurring, categories: Category[]): boolean {
  if (r.type === "transfer" && r.countsAsExpense) {
    const cat = categories.find((c) => c.id === r.categoryId);
    if (!cat) return true;
    return isMortgagePrincipalCategory(cat);
  }
  const cat = categories.find((c) => c.id === r.categoryId);
  return Boolean(cat && isMortgagePrincipalCategory(cat));
}

export function livingEssentialRows(
  recurring: Recurring[],
  categories: Category[],
  rates: FxRate[],
): { id: string; label: string; labelZh: string; amount: number }[] {
  return monthlyExpenseRegulars(recurring)
    .filter((r) => r.living)
    .filter((r) => !isPrincipalRegular(r, categories))
    .map((r) => ({
      id: r.id,
      label: r.label,
      labelZh: r.labelZh,
      amount: hkdOfRegular(r, rates),
    }));
}

export function housingRegularRows(
  recurring: Recurring[],
  categories: Category[],
  rates: FxRate[],
): { id: string; label: string; labelZh: string; amount: number }[] {
  return monthlyExpenseRegulars(recurring)
    .filter((r) => r.living || isPrincipalRegular(r, categories))
    .map((r) => ({
      id: r.id,
      label: r.label,
      labelZh: r.labelZh,
      amount: hkdOfRegular(r, rates),
    }));
}

export function monthlyLivingEssentials(recurring: Recurring[], categories: Category[], rates: FxRate[]): number {
  return livingEssentialRows(recurring, categories, rates).reduce((s, r) => s + r.amount, 0);
}

export function monthlyHousingCost(
  m: Mortgage | null,
  recurring: Recurring[],
  categories: Category[],
  rates: FxRate[],
): number {
  const mode = livingModeOf(m);
  if (m && mode === "own-mortgage") return installmentOf(m);
  const rows = livingEssentialRows(recurring, categories, rates);
  if (mode === "rent") return rows.reduce((s, r) => s + r.amount, 0);
  return rows.reduce((s, r) => s + r.amount, 0);
}

export function housingStatus(m: Mortgage | null): "on-track" | "watch" | "at-risk" {
  if (!m || livingModeOf(m) !== "own-mortgage") return "on-track";
  const rate = effectiveRate(m);
  const pmt = installmentOf(m);
  if (pmt <= 0) return "on-track";
  const plus2 = monthlyPayment(m.outstanding, rate + 0.02, m.remainingMonths);
  if (plus2 > pmt * 1.45) return "at-risk";
  if (plus2 > pmt * 1.25) return "watch";
  return "on-track";
}

export function formatRatePct(n: number): string {
  const p = n * 100;
  const s = Number.isInteger(p) ? String(p) : p.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${s}%`;
}

export function rateLine(m: Mortgage): string {
  const eff = formatRatePct(effectiveRate(m));
  if (m.type === "p" || m.type === "h") {
    const bench = m.type === "p" ? "P" : "H";
    const sp = m.spread ?? 0;
    const sign = sp < 0 ? "−" : "+";
    return `${bench} ${sign}${formatRatePct(Math.abs(sp))} → ${eff}`;
  }
  return eff;
}

export function remainingMonthsLabel(months: number, locale: Locale): string {
  const years = Math.max(0, Math.round(months / 12));
  return locale === "zh-HK" ? `${months} · ${years} 年` : `${months} · ${years} yr`;
}

export function housingCategoryIds(categories: Category[]): Set<string> {
  const parent = housingParentId(categories);
  const ids = new Set<string>();
  if (parent) ids.add(parent);
  for (const c of categories) {
    if (c.id === parent || c.parentId === parent) ids.add(c.id);
    if (isMortgagePrincipalCategory(c) || isMortgageInterestCategory(c)) ids.add(c.id);
  }
  return ids;
}

export function housingTransactions(
  txs: Transaction[],
  categories: Category[],
  from: string,
  to: string,
): Transaction[] {
  const ids = housingCategoryIds(categories);
  return txs
    .filter((tx) => !tx.planned && tx.date >= from && tx.date <= to)
    .filter((tx) => {
      if (tx.housing === false) return false;
      const tagged = tx.housing === true || Boolean(tx.categoryId && ids.has(tx.categoryId));
      return tagged && cashflowSide(tx) === "expense";
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function monthsAgoIso(fromIso: string, months: number): string {
  const [y, m, d] = fromIso.split("-").map(Number);
  const dt = new Date(y, m - 1 - months, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function stressRows(m: Mortgage): { shock: number; payment: number; interest: number }[] {
  const rate = effectiveRate(m);
  return [0.005, 0.01, 0.02].map((shock) => ({
    shock,
    payment: monthlyPayment(m.outstanding, rate + shock, m.remainingMonths),
    interest: remainingInterest(m.outstanding, rate + shock, m.remainingMonths),
  }));
}

export function projection12(m: Mortgage) {
  return amortize(m.outstanding, effectiveRate(m), m.remainingMonths, 12);
}

export function linkedProperty(accounts: Account[], m: Mortgage | null): Account | undefined {
  if (!m) return accounts.find((a) => a.type === "property");
  if (m.propertyAccountId) return accounts.find((a) => a.id === m.propertyAccountId);
  return accounts.find((a) => a.type === "property");
}

export function linkedLoan(accounts: Account[], m: Mortgage | null): Account | undefined {
  if (!m) return accounts.find((a) => a.type === "mortgage");
  return accounts.find((a) => a.id === m.accountId) ?? accounts.find((a) => a.type === "mortgage");
}
