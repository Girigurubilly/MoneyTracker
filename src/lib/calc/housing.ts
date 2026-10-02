import type { Account, Category, FxRate, Locale, Mortgage, Recurring, Transaction } from "../types.ts";
import { isMortgagePrincipalCategory, isMortgageInterestCategory, isHousingCategory } from "../categories.ts";
import { isSpendLike, inMonth } from "./ledger.ts";
import { monthlyExpenseRegulars, hkdOfRegular, coverRegulars } from "./budget.ts";
import { monthlyPayment, remainingInterest, effectiveRate, originalPrincipal, originalTermMonths, amortizeFrom, monthsBetween } from "./mortgage.ts";
import { toHkd } from "./fx.ts";
import { todayISO } from "../format.ts";

export type LivingMode = NonNullable<Mortgage["livingMode"]>;

export function livingModeOf(m: Mortgage | null): LivingMode {
  if (!m) return "other";
  return m.livingMode ?? (m.outstanding > 0 ? "own-mortgage" : "own-outright");
}

export function installmentOf(m: Mortgage): number {
  if (m.paymentOverride && m.paymentOverride > 0) return m.paymentOverride;
  const rate = effectiveRate(m);
  const today = todayISO();
  if (m.startDate && m.original > 0) {
    return monthlyPayment(m.original, rate, originalTermMonths(m, today));
  }
  return monthlyPayment(m.outstanding, rate, Math.max(1, m.remainingMonths));
}

export function loanTimeProgress(m: Mortgage, today = todayISO()): number {
  if (!m.startDate || m.remainingMonths <= 0) return m.original > 0 ? Math.max(0, 1 - m.outstanding / m.original) : 0;
  const elapsed = monthsBetween(m.startDate, today);
  const total = elapsed + m.remainingMonths;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, elapsed / total));
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

export function isHousingSpendRegular(r: Recurring, categories: Category[]): boolean {
  if (r.housing === false) return false;
  if (isPrincipalRegular(r, categories)) return true;
  if (r.living || r.housing) return true;
  return Boolean(r.categoryId && housingCategoryIds(categories).has(r.categoryId));
}

export function monthlyLivingEssentials(recurring: Recurring[], categories: Category[], rates: FxRate[]): number {
  return livingEssentialRows(recurring, categories, rates).reduce((s, r) => s + r.amount, 0);
}

export type HousingMonthLine = {
  id: string;
  label: string;
  labelZh: string;
  amount: number;
  posted: boolean;
};

function isHousingMonthTx(tx: Transaction, categories: Category[], month: string): boolean {
  if (!inMonth(tx.date, month)) return false;
  if (tx.housing === false) return false;
  const tagged = tx.housing === true || Boolean(tx.categoryId && housingCategoryIds(categories).has(tx.categoryId));
  if (!tagged) return false;
  return isSpendLike(tx);
}

/** Current-month house spend + still-scheduled house regulars, without double-counting posted items. */
export function housingMonthLines(
  txs: Transaction[],
  recurring: Recurring[],
  categories: Category[],
  rates: FxRate[],
  asOf: string,
): HousingMonthLine[] {
  const iso = typeof asOf === "string" ? asOf : "";
  if (iso.length < 7) return [];
  const month = iso.slice(0, 7);
  const houseTxs = txs.filter((tx) => isHousingMonthTx(tx, categories, month));
  const regulars = monthlyExpenseRegulars(recurring).filter((r) => isHousingSpendRegular(r, categories));
  const cover = coverRegulars(regulars, houseTxs);
  const lines: HousingMonthLine[] = [];
  const used = new Set<string>();
  for (const row of cover.covered) {
    let amount = 0;
    let posted = false;
    for (const tx of row.txs) {
      used.add(tx.id);
      amount += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
      if (!tx.planned) posted = true;
    }
    lines.push({
      id: row.regular.id,
      label: row.regular.label,
      labelZh: row.regular.labelZh,
      amount,
      posted,
    });
  }
  for (const r of cover.uncovered) {
    lines.push({
      id: r.id,
      label: r.label,
      labelZh: r.labelZh,
      amount: hkdOfRegular(r, rates),
      posted: false,
    });
  }
  for (const tx of houseTxs) {
    if (used.has(tx.id)) continue;
    lines.push({
      id: tx.id,
      label: tx.payee,
      labelZh: tx.payeeZh,
      amount: Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd)),
      posted: !tx.planned,
    });
  }
  return lines;
}

export function monthlyHousingCost(
  txs: Transaction[],
  recurring: Recurring[],
  categories: Category[],
  rates: FxRate[],
  asOf: string,
): number {
  return housingMonthLines(txs, recurring, categories, rates, asOf).reduce((s, r) => s + r.amount, 0);
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
  const ids = new Set<string>();
  for (const c of categories) {
    if (isHousingCategory(c, categories)) ids.add(c.id);
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
    .filter((tx) => tx.date >= from && tx.date <= to)
    .filter((tx) => {
      if (tx.housing === false) return false;
      const tagged = tx.housing === true || Boolean(tx.categoryId && ids.has(tx.categoryId));
      if (!tagged) return false;
      return tx.type === "expense" || (tx.type === "transfer" && Boolean(tx.countsAsExpense));
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
  const orig = originalPrincipal(m);
  const term = originalTermMonths(m, todayISO());
  return [0.005, 0.01, 0.02].map((shock) => ({
    shock,
    payment: monthlyPayment(orig, rate + shock, term),
    interest: remainingInterest(orig, rate + shock, term),
  }));
}

export function projection12(m: Mortgage, today = todayISO()) {
  const orig = originalPrincipal(m);
  const term = originalTermMonths(m, today);
  let skip = m.startDate ? monthsBetween(m.startDate, today) : Math.max(0, term - m.remainingMonths);
  const payDay = Math.min(28, Math.max(1, m.paymentDay || 1));
  const thisMonth = today.slice(0, 7);
  const started = !m.startDate || m.startDate.slice(0, 7) <= thisMonth;
  const includeCurrent = !started || Number(today.slice(8, 10)) <= payDay;
  if (started && !includeCurrent) skip += 1;
  const shown = amortizeFrom(orig, effectiveRate(m), term, skip, 12);
  const [y, mo] = thisMonth.split("-").map(Number);
  const start = new Date(y, (mo || 1) - 1 + (includeCurrent ? 0 : 1), 1);
  const firstMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  const edits = m.scheduleEdits ?? {};
  const hasEdit = Object.keys(edits).some((month) => shown.rows.some((_, i) => addYearMonths(firstMonth, i) === month));
  if (!hasEdit) {
    return {
      payment: shown.payment,
      firstMonth,
      rows: shown.rows.map((r, i) => ({ ...r, month: addYearMonths(firstMonth, i), edited: false })),
    };
  }
  let bal = shown.rows[0] ? shown.rows[0].balance + shown.rows[0].principal : orig;
  const rate = effectiveRate(m) / 12;
  const rows = shown.rows.map((r, i) => {
    const month = addYearMonths(firstMonth, i);
    const edit = edits[month];
    const interestCalc = bal * rate;
    const principalCalc = Math.min(Math.max(0, shown.payment - interestCalc), bal);
    const interest = edit ? roundMoney(edit.interest) : roundMoney(interestCalc);
    const principal = edit ? roundMoney(Math.min(Math.max(0, edit.principal), bal)) : roundMoney(principalCalc);
    bal = roundMoney(Math.max(0, bal - principal));
    return { ...r, month, interest, principal, balance: bal, edited: Boolean(edit) };
  });
  return { payment: shown.payment, rows, firstMonth };
}

export function mortgageMonthLabel(month: string, locale: Locale): string {
  const [y, m] = month.split("-").map(Number);
  if (locale === "zh-HK") return `${y}年${m}月`;
  return new Date(y, m - 1, 1).toLocaleDateString("en-HK", { month: "short", year: "numeric" });
}

export function mortgageRegularPair(recurring: Recurring[], categories: Category[]): { principal?: Recurring; interest?: Recurring } {
  let principal: Recurring | undefined;
  let interest: Recurring | undefined;
  for (const r of recurring) {
    if (r.frequency !== "monthly") continue;
    const cat = categories.find((c) => c.id === r.categoryId);
    if (!cat) continue;
    if (!principal && isMortgagePrincipalCategory(cat)) principal = r;
    else if (!interest && isMortgageInterestCategory(cat)) interest = r;
  }
  return { principal, interest };
}

/** After the regular 本金 / 利息 amounts change, store them on that payment month. */
export function mortgageFromRegulars(m: Mortgage, recurring: Recurring[], categories: Category[], today: string): Mortgage | undefined {
  const active = projection12(m, today).rows[0];
  if (!active) return undefined;
  const pair = mortgageRegularPair(recurring, categories);
  if (!pair.principal && !pair.interest) return undefined;
  const interest = pair.interest?.amount ?? active.interest;
  const principal = pair.principal?.amount ?? active.principal;
  if (Math.abs(interest - active.interest) < 0.05 && Math.abs(principal - active.principal) < 0.05) return undefined;
  return { ...m, scheduleEdits: { ...m.scheduleEdits, [active.month]: { interest, principal } } };
}
export function alignMortgageAndRegulars(
  m: Mortgage,
  recurring: Recurring[],
  categories: Category[],
  today: string,
): { mortgage?: Mortgage; regulars: Recurring[] } {
  const shown = projection12(m, today);
  const active = shown.rows[0];
  if (!active) return { regulars: [] };
  const pair = mortgageRegularPair(recurring, categories);
  const edit = m.scheduleEdits?.[active.month];
  if (!edit && pair.principal && pair.interest) {
    const bare = projection12({ ...m, scheduleEdits: withoutMonth(m.scheduleEdits, active.month) }, today).rows[0];
    if (
      bare &&
      (Math.abs(pair.principal.amount - bare.principal) > 0.05 || Math.abs(pair.interest.amount - bare.interest) > 0.05)
    ) {
      return {
        mortgage: {
          ...m,
          scheduleEdits: { ...m.scheduleEdits, [active.month]: { interest: pair.interest.amount, principal: pair.principal.amount } },
        },
        regulars: [],
      };
    }
  }
  const regulars: Recurring[] = [];
  if (pair.principal && Math.abs(pair.principal.amount - active.principal) > 0.05) regulars.push({ ...pair.principal, amount: active.principal });
  if (pair.interest && Math.abs(pair.interest.amount - active.interest) > 0.05) regulars.push({ ...pair.interest, amount: active.interest });
  return { regulars };
}

function withoutMonth(edits: Mortgage["scheduleEdits"], month: string): Mortgage["scheduleEdits"] {
  if (!edits?.[month]) return edits;
  const next = { ...edits };
  delete next[month];
  return next;
}

function addYearMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
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
