import { create } from "zustand";
import { getDb } from "@/lib/idb";
import type {
  Account,
  AdhocBudget,
  Allowance,
  Budget,
  Category,
  Currency,
  FxRate,
  Goal,
  Mortgage,
  OneOff,
  Recurring,
  TimeSaving,
  Transaction,
  Trip,
  WishItem,
  YearlyPlan,
} from "@/lib/types";
import type { RetirementInputs } from "@/lib/calc/retirement";
import type { MetaRow, SnapshotRow } from "@/lib/idb";
import {
  accounts as seedAccounts,
  allowances as seedAllowances,
  budgets as seedBudgets,
  categories as seedCategories,
  fxRates as seedFx,
  goals as seedGoals,
  mortgage as seedMortgage,
  oneOffs as seedOneOffs,
  recurring as seedRecurring,
  retirement as seedRetirement,
  transactions as seedTx,
  trips as seedTrips,
  deposits as seedDeposits,
  yearlyPlans as seedYearly,
  wishlist as seedWishlist,
  annualTravelBudget as seedTravelBudget,
  netWorthSeries as seedNw,
} from "@/lib/mock";
import { applyDeltas, balanceDeltas, monthKey } from "@/lib/calc/ledger";
import { netWorthNow } from "@/lib/calc/networth";
import { fetchLiveFx } from "@/lib/calc/fx";
import { chargedDayOf, chargedIso, inferLivingRegular, isExpenseRegular } from "@/lib/calc/budget";
import { isMortgageInterestCategory, isMortgagePrincipalCategory } from "@/lib/categories";
import { accountsInGroup, nextSortOrder } from "@/lib/accounts";
import { applyTxRules } from "@/lib/tx-rules";
import { todayISO } from "@/lib/format";
import { MONTH_TOTAL_BUDGET_ID } from "@/lib/types";

export type AppSnapshot = {
  schemaVersion: number;
  exportedAt: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
  budgets: Budget[];
  trips: Trip[];
  goals: Goal[];
  mortgage: Mortgage[];
  retirement: (RetirementInputs & { id: string })[];
  allowances: Allowance[];
  oneOffs: OneOff[];
  fxRates: FxRate[];
  snapshots: SnapshotRow[];
  annualTravelBudget: number;
  adhocBudgets?: AdhocBudget[];
  deposits?: TimeSaving[];
  yearlyPlans?: YearlyPlan[];
  wishlist?: WishItem[];
  defaultCurrency?: Currency;
  lastFxSyncAt?: string;
};

function idb() {
  const d = getDb();
  if (!d) throw new Error("IndexedDB unavailable");
  return d;
}

function nid(): string {
  return crypto.randomUUID();
}

async function writeMeta(
  patch: Partial<Omit<MetaRow, "key">>,
  fallback: { annualTravelBudget: number; defaultCurrency: Currency },
): Promise<void> {
  const prev = await idb().meta.get("settings");
  await idb().meta.put({
    key: "settings",
    annualTravelBudget: patch.annualTravelBudget ?? prev?.annualTravelBudget ?? fallback.annualTravelBudget,
    schemaVersion: patch.schemaVersion ?? prev?.schemaVersion ?? 3,
    seededAt: "seededAt" in patch ? patch.seededAt : prev?.seededAt,
    defaultCurrency: patch.defaultCurrency ?? prev?.defaultCurrency ?? fallback.defaultCurrency,
    lastFxSyncAt: "lastFxSyncAt" in patch ? patch.lastFxSyncAt : prev?.lastFxSyncAt,
  });
}

export function newId(): string {
  return nid();
}

type Dispatchers = {
  addTransaction: (partial: Omit<Transaction, "id"> & { id?: string }) => Promise<Transaction>;
  updateTransaction: (tx: Transaction, previous?: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<Transaction | undefined>;
  addAccount: (a: Account) => Promise<void>;
  updateAccount: (a: Account) => Promise<void>;
  moveAccount: (id: string, dir: number) => Promise<void>;
  addCategory: (c: Category) => Promise<void>;
  updateCategory: (c: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateMortgage: (m: Mortgage) => Promise<void>;
  updateRetirement: (r: RetirementInputs & { id: string }) => Promise<void>;
  updateBudget: (b: Budget) => Promise<void>;
  addTrip: (t: Trip) => Promise<void>;
  updateTrip: (t: Trip) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  addRecurring: (r: Recurring) => Promise<void>;
  updateRecurring: (r: Recurring) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  setFxRates: (rows: FxRate[]) => Promise<void>;
  refreshFx: () => Promise<void>;
  setAnnualTravel: (n: number) => Promise<void>;
  setDefaultCurrency: (c: Currency) => Promise<void>;
  addAllowance: (a: Allowance) => Promise<void>;
  updateAllowance: (a: Allowance) => Promise<void>;
  deleteAllowance: (id: string) => Promise<void>;
  addAdhocBudget: (a: AdhocBudget) => Promise<void>;
  updateAdhocBudget: (a: AdhocBudget) => Promise<void>;
  deleteAdhocBudget: (id: string) => Promise<void>;
  addDeposit: (partial: Omit<TimeSaving, "id"> & { id?: string }) => Promise<TimeSaving>;
  updateDeposit: (row: TimeSaving) => Promise<void>;
  deleteDeposit: (id: string) => Promise<void>;
  setYearlyCell: (year: number, month0: number, field: "salary" | "other" | "expense", value: number) => Promise<void>;
  addWishItem: (row: WishItem) => Promise<void>;
  updateWishItem: (row: WishItem) => Promise<void>;
  deleteWishItem: (id: string) => Promise<void>;
  replaceAll: (snap: AppSnapshot) => Promise<void>;
  exportSnapshot: () => AppSnapshot;
  resetSample: () => Promise<void>;
  clearAll: () => Promise<void>;
};

type AppState = {
  ready: boolean;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
  budgets: Budget[];
  trips: Trip[];
  goals: Goal[];
  mortgage: Mortgage | null;
  retirement: (RetirementInputs & { id: string }) | null;
  allowances: Allowance[];
  oneOffs: OneOff[];
  adhocBudgets: AdhocBudget[];
  deposits: TimeSaving[];
  yearlyPlans: YearlyPlan[];
  wishlist: WishItem[];
  fxRates: FxRate[];
  snapshots: SnapshotRow[];
  annualTravelBudget: number;
  defaultCurrency: Currency;
  lastFxSyncAt?: string;
  hydrate: () => Promise<void>;
} & Dispatchers;

async function loadAll(): Promise<Omit<AppState, keyof Dispatchers | "hydrate" | "ready">> {
  const [
    accounts,
    categories,
    transactions,
    recurring,
    budgets,
    trips,
    goals,
    mortgageRows,
    retirementRows,
    allowances,
    oneOffs,
    adhocBudgets,
    deposits,
    yearlyPlans,
    wishlist,
    fxRates,
    snapshots,
    meta,
  ] = await Promise.all([
    idb().accounts.toArray(),
    idb().categories.toArray(),
    idb().transactions.toArray(),
    idb().recurring.toArray(),
    idb().budgets.toArray(),
    idb().trips.toArray(),
    idb().goals.toArray(),
    idb().mortgage.toArray(),
    idb().retirement.toArray(),
    idb().allowances.toArray(),
    idb().oneOffs.toArray(),
    idb().adhocBudgets.toArray(),
    idb().deposits.toArray(),
    idb().yearlyPlans.toArray(),
    idb().wishlist.toArray(),
    idb().fxRates.toArray(),
    idb().snapshots.toArray(),
    idb().meta.get("settings"),
  ]);
  return {
    accounts,
    categories,
    transactions,
    recurring,
    budgets,
    trips,
    goals,
    mortgage: mortgageRows[0] ?? null,
    retirement: retirementRows[0] ?? null,
    allowances,
    oneOffs,
    adhocBudgets,
    deposits,
    yearlyPlans,
    wishlist,
    fxRates,
    snapshots,
    annualTravelBudget: meta?.annualTravelBudget ?? seedTravelBudget,
    defaultCurrency: meta?.defaultCurrency ?? "HKD",
    lastFxSyncAt: meta?.lastFxSyncAt,
  };
}

const emptyRetirement = {
  id: "base",
  currentAge: 40,
  retireAge: 65,
  deathAge: 90,
  monthlyIncomeNow: 0,
  monthlySpendNow: 0,
  targetMonthly: 25000,
  preReturn: 0.05,
  postReturn: 0.035,
  inflation: 0.025,
  travelInRetirement: 0,
};

const defaultOaa: Allowance = {
  id: "oaa",
  label: "Old Age Allowance",
  labelZh: "生果金",
  monthly: 1620,
  startAge: 70,
  kind: "oaa",
  inflationAdjusted: true,
};

const defaultAnnuity: Allowance = {
  id: "annuity",
  label: "Annuity",
  labelZh: "年金",
  monthly: 0,
  startAge: 65,
  kind: "annuity",
  inflationAdjusted: false,
};

const defaultCash: Account = {
  id: "cash-hkd",
  name: "Cash",
  nameZh: "現金",
  type: "cash",
  currency: "HKD",
  balance: 0,
  includeInNetWorth: true,
  group: "cash",
};

async function seedDb() {
  const ret = { id: "base", ...seedRetirement };
  await idb().transaction("rw", idb().tables, async () => {
    await Promise.all(idb().tables.map((t) => t.clear()));
    await idb().accounts.bulkAdd(seedAccounts);
    await idb().categories.bulkAdd(seedCategories);
    await idb().transactions.bulkAdd(seedTx);
    await idb().recurring.bulkAdd(seedRecurring);
    await idb().budgets.bulkAdd(seedBudgets);
    await idb().trips.bulkAdd(seedTrips);
    await idb().goals.bulkAdd(seedGoals);
    await idb().mortgage.add(seedMortgage);
    await idb().retirement.add(ret);
    await idb().allowances.bulkAdd(seedAllowances);
    await idb().oneOffs.bulkAdd(seedOneOffs);
    await idb().deposits.bulkAdd(seedDeposits);
    await idb().yearlyPlans.bulkAdd(seedYearly);
    await idb().wishlist.bulkAdd(seedWishlist);
    await idb().fxRates.bulkAdd(seedFx);
    await idb().snapshots.bulkAdd(
      seedNw.map((s) => ({ month: s.month, net: s.value, assets: s.value + 2_858_240, liab: 2_858_240 })),
    );
    await idb().meta.put({
      key: "settings",
      annualTravelBudget: seedTravelBudget,
      schemaVersion: 3,
      seededAt: new Date().toISOString(),
      defaultCurrency: "HKD",
    });
  });
}

async function seedSkeleton() {
  await idb().transaction("rw", idb().tables, async () => {
    await Promise.all(idb().tables.map((t) => t.clear()));
    await idb().accounts.bulkAdd([defaultCash]);
    await idb().categories.bulkAdd(seedCategories);
    await idb().fxRates.bulkAdd(seedFx);
    await idb().allowances.bulkAdd([defaultOaa, defaultAnnuity]);
    await idb().retirement.add(emptyRetirement);
    await idb().budgets.add({
      id: MONTH_TOTAL_BUDGET_ID,
      label: "Monthly total",
      labelZh: "本月總額",
      monthly: 0,
      spent: 0,
    });
    await idb().meta.put({
      key: "settings",
      annualTravelBudget: 0,
      schemaVersion: 3,
      seededAt: new Date().toISOString(),
      defaultCurrency: "HKD",
    });
  });
}

function interestTxFromDeposit(d: TimeSaving, today: string, existing?: Transaction): Transaction | null {
  if (!d.interest || d.interest <= 0 || !d.endDate) return null;
  return {
    id: existing?.id ?? nid(),
    type: "income",
    amount: d.interest,
    currency: d.currency,
    accountId: d.accountId,
    categoryId: "interest-inc",
    date: d.endDate,
    payee: `${d.bank} deposit interest`,
    payeeZh: `${d.bank} 存款利息`,
    planned: existing && !existing.planned ? false : d.endDate > today,
    depositId: d.id,
  };
}

async function syncLinkedInterest(get: () => AppState, d: TimeSaving) {
  const today = todayISO();
  const existing = get().transactions.find((t) => t.depositId === d.id);
  const next = interestTxFromDeposit(d, today, existing);
  if (!next) {
    if (existing?.planned) await get().deleteTransaction(existing.id);
    return;
  }
  if (existing) await get().updateTransaction({ ...existing, ...next, id: existing.id }, existing);
  else await get().addTransaction(next);
}

function scheduledFromRegular(r: Recurring, month: string, today: string, existingId?: string): Transaction {
  const iso = chargedIso(month, chargedDayOf(r));
  return {
    id: existingId ?? nid(),
    type: r.type,
    amount: r.amount,
    currency: r.currency,
    accountId: r.accountId,
    toAccountId: r.toAccountId,
    destAmount: r.type === "transfer" ? (r.destAmount ?? r.amount) : undefined,
    categoryId: r.categoryId,
    date: iso,
    payee: r.label,
    payeeZh: r.labelZh,
    planned: iso > today,
    recurringId: r.id,
    countsAsExpense: r.countsAsExpense,
    housing: r.housing,
  };
}

async function upsertScheduledFor(r: Recurring) {
  if (r.frequency !== "monthly") return;
  const today = todayISO();
  const month = today.slice(0, 7);
  const iso = chargedIso(month, chargedDayOf(r));
  if (iso < today) return;
  const txs = await idb().transactions.toArray();
  const existing = txs.find((t) => t.recurringId === r.id && t.date.startsWith(month));
  if (existing && !existing.planned) return;
  if (!existing) {
    const similar = txs.find(
      (t) =>
        !t.planned &&
        t.type === r.type &&
        t.accountId === r.accountId &&
        Math.abs(t.amount - r.amount) < 0.01 &&
        t.date === iso,
    );
    if (similar) return;
  }
  const tx = scheduledFromRegular(r, month, today, existing?.id);
  if (existing) await idb().transactions.put({ ...existing, ...tx, id: existing.id });
  else await idb().transactions.add(tx);
}

async function postDuePlanned() {
  const today = todayISO();
  const txs = await idb().transactions.toArray();
  const due = txs.filter((t) => t.planned && t.date <= today);
  if (!due.length) return;
  let accounts = await idb().accounts.toArray();
  const rates = await idb().fxRates.toArray();
  await idb().transaction("rw", [idb().transactions, idb().accounts, idb().mortgage], async () => {
    for (const tx of due) {
      const posted = { ...tx, planned: false };
      accounts = applyDeltas(accounts, balanceDeltas(posted, accounts, rates));
      await idb().transactions.put(posted);
    }
    for (const a of accounts) await idb().accounts.put(a);
    const m = (await idb().mortgage.toArray())[0] ?? null;
    const next = syncMortgageOutstanding(m, accounts);
    if (next) await idb().mortgage.put(next);
  });
}

async function migrateAdhocFromPlannedTxs() {
  const txs = await idb().transactions.toArray();
  const regulars = await idb().recurring.toArray();
  const existing = await idb().adhocBudgets.toArray();
  const seen = new Set(existing.map((a) => `${a.date}|${a.amount}|${a.label}`));
  const candidates = txs.filter((t) => {
    if (!t.planned || t.recurringId || t.depositId || t.type === "miles" || t.type === "income") return false;
    const day = Number(t.date.slice(8, 10));
    return !regulars.some(
      (r) =>
        r.frequency === "monthly" &&
        r.type === t.type &&
        r.accountId === t.accountId &&
        Math.abs(r.amount - t.amount) < 0.01 &&
        chargedDayOf(r) === day,
    );
  });
  if (candidates.length) {
    await idb().transaction("rw", [idb().transactions, idb().adhocBudgets], async () => {
      for (const tx of candidates) {
        const key = `${tx.date}|${tx.amount}|${tx.payee}`;
        if (!seen.has(key)) {
          await idb().adhocBudgets.put({
            id: tx.id,
            label: tx.payee,
            labelZh: tx.payeeZh,
            amount: Math.abs(tx.amount),
            currency: tx.currency,
            month: tx.date.slice(0, 7),
            date: tx.date,
          });
          seen.add(key);
        }
        await idb().transactions.delete(tx.id);
      }
    });
  }
  for (const a of await idb().adhocBudgets.toArray()) {
    const day = Number(a.date.slice(8, 10));
    const match = regulars.some(
      (r) =>
        r.frequency === "monthly" &&
        isExpenseRegular(r) &&
        Math.abs(r.amount - a.amount) < 0.01 &&
        chargedDayOf(r) === day &&
        (r.label === a.label || r.labelZh === a.labelZh),
    );
    if (match) await idb().adhocBudgets.delete(a.id);
  }
}

async function syncRegularSchedules() {
  const rows = await idb().recurring.toArray();
  for (const r of rows) await upsertScheduledFor(r);
}

async function ensureMortgageCategories() {
  const cats = await idb().categories.toArray();
  let housing =
    cats.find((c) => c.id === "p-housing") ??
    cats.find((c) => !c.parentId && /房屋|housing|居住/i.test(`${c.name} ${c.nameZh}`));
  if (!housing) {
    const row = seedCategories.find((c) => c.id === "p-housing");
    if (row) {
      await idb().categories.add(row);
      housing = row;
    }
  }
  const parentId = housing?.id;
  if (!cats.some((c) => isMortgagePrincipalCategory(c))) {
    const row = seedCategories.find((c) => c.id === "mortgage-p");
    if (row) await idb().categories.add({ ...row, parentId: parentId ?? row.parentId });
  }
  if (!cats.some((c) => isMortgageInterestCategory(c))) {
    const row = seedCategories.find((c) => c.id === "mortgage-i");
    if (row) await idb().categories.add({ ...row, parentId: parentId ?? row.parentId });
  }
  if (parentId) {
    const latest = await idb().categories.toArray();
    for (const c of latest) {
      if (c.parentId === parentId) continue;
      if (!isMortgagePrincipalCategory(c) && !isMortgageInterestCategory(c)) continue;
      await idb().categories.put({ ...c, parentId });
    }
  }
}

async function ensureRegularLiving() {
  const cats = await idb().categories.toArray();
  const rows = await idb().recurring.toArray();
  for (const r of rows) {
    if (typeof r.living === "boolean") continue;
    if (!inferLivingRegular(r, cats)) continue;
    await idb().recurring.put({ ...r, living: true });
  }
}

async function bulkChunk<T>(add: (rows: T[]) => Promise<unknown>, rows: T[], size = 800) {
  for (let i = 0; i < rows.length; i += size) await add(rows.slice(i, i + size));
}

function syncMortgageOutstanding(m: Mortgage | null, accounts: Account[], destId?: string): Mortgage | null {
  if (!m) return m;
  const dest = destId ? accounts.find((a) => a.id === destId) : undefined;
  const loan =
    (dest && (dest.type === "mortgage" || dest.type === "loan") ? dest : undefined) ??
    accounts.find((a) => a.id === m.accountId) ??
    accounts.find((a) => a.type === "mortgage");
  if (!loan) return m;
  const outstanding = Math.abs(loan.balance);
  if (outstanding === m.outstanding && loan.id === m.accountId) return m;
  return { ...m, accountId: loan.id, outstanding };
}

function withLinkedCounterpart(accounts: Account[], row: Account): Account[] {
  if (row.linkedAccountId) {
    return accounts.map((x) => {
      if (x.id === row.id) return row;
      if (x.id === row.linkedAccountId) return { ...x, linkedAccountId: row.id };
      if (x.linkedAccountId === row.id) return { ...x, linkedAccountId: undefined };
      return x;
    });
  }
  return accounts.map((x) => (x.id === row.id ? row : x.linkedAccountId === row.id ? { ...x, linkedAccountId: undefined } : x));
}

function mortgageFromAccount(m: Mortgage | null, row: Account, accounts: Account[]): Mortgage | null {
  if (!m) return m;
  let next = m;
  if ((row.type === "mortgage" || row.type === "loan") && row.id === m.accountId) {
    next = {
      ...next,
      outstanding: Math.abs(row.balance),
      propertyAccountId: row.linkedAccountId ?? next.propertyAccountId,
    };
  } else if (row.type === "property" && row.linkedAccountId === m.accountId) {
    next = { ...next, propertyAccountId: row.id };
  }
  return syncMortgageOutstanding(next, accounts);
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  accounts: [],
  categories: [],
  transactions: [],
  recurring: [],
  budgets: [],
  trips: [],
  goals: [],
  mortgage: null,
  retirement: null,
  allowances: [],
  oneOffs: [],
  adhocBudgets: [],
  deposits: [],
  yearlyPlans: [],
  wishlist: [],
  fxRates: seedFx,
  snapshots: [],
  annualTravelBudget: seedTravelBudget,
  defaultCurrency: "HKD",
  lastFxSyncAt: undefined,

  hydrate: async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.storage?.persist) void navigator.storage.persist();
      if (!getDb()) {
        set({ ready: true });
        return;
      }
      const n = await idb().accounts.count();
      const catN = await idb().categories.count();
      if (n === 0 && catN === 0) await seedSkeleton();
      else {
        if (n === 0) await idb().accounts.add(defaultCash);
        if (catN === 0) await idb().categories.bulkAdd(seedCategories);
        await ensureMortgageCategories();
        await ensureRegularLiving();
        await migrateAdhocFromPlannedTxs();
        await postDuePlanned();
        await syncRegularSchedules();
      }
      const data = await loadAll();
      if (!data.fxRates.length) {
        await idb().fxRates.bulkPut(seedFx);
        data.fxRates = seedFx;
      }
      const nw = netWorthNow(data.accounts, data.fxRates);
      const month = monthKey();
      if (!data.snapshots.some((s) => s.month === month)) {
        const row = { month, net: nw.net, assets: nw.assets, liab: nw.liab };
        await idb().snapshots.put(row);
        data.snapshots = [...data.snapshots, row];
      }
      set({ ...data, ready: true });
    } catch {
      set({ ready: true });
    }
  },

  addTransaction: async (partial) => {
    const ctx = { categories: get().categories, accounts: get().accounts };
    const tx: Transaction = applyTxRules({ ...partial, id: partial.id ?? nid() }, ctx);
    const accounts = applyDeltas(get().accounts, balanceDeltas(tx, get().accounts, get().fxRates));
    const mortgage = syncMortgageOutstanding(get().mortgage, accounts, tx.toAccountId);
    await idb().transaction("rw", [idb().transactions, idb().accounts, idb().mortgage], async () => {
      await idb().transactions.add(tx);
      await Promise.all(accounts.map((a) => idb().accounts.put(a)));
      if (mortgage) await idb().mortgage.put(mortgage);
    });
    set({ transactions: [tx, ...get().transactions], accounts, mortgage });
    return tx;
  },

  updateTransaction: async (tx, previous) => {
    const ctx = { categories: get().categories, accounts: get().accounts };
    const next = applyTxRules(tx, ctx);
    const prev = previous ?? get().transactions.find((t) => t.id === next.id);
    let accounts = get().accounts;
    if (prev) accounts = applyDeltas(accounts, balanceDeltas(prev, accounts, get().fxRates), -1);
    accounts = applyDeltas(accounts, balanceDeltas(next, accounts, get().fxRates), 1);
    const mortgage = syncMortgageOutstanding(get().mortgage, accounts, next.toAccountId);
    await idb().transaction("rw", [idb().transactions, idb().accounts, idb().mortgage], async () => {
      await idb().transactions.put(next);
      await Promise.all(accounts.map((a) => idb().accounts.put(a)));
      if (mortgage) await idb().mortgage.put(mortgage);
    });
    set({ transactions: get().transactions.map((t) => (t.id === next.id ? next : t)), accounts, mortgage });
  },

  deleteTransaction: async (id) => {
    const prev = get().transactions.find((t) => t.id === id);
    if (!prev) return undefined;
    const accounts = applyDeltas(get().accounts, balanceDeltas(prev, get().accounts, get().fxRates), -1);
    const mortgage = syncMortgageOutstanding(get().mortgage, accounts, prev.toAccountId);
    await idb().transaction("rw", [idb().transactions, idb().accounts, idb().mortgage], async () => {
      await idb().transactions.delete(id);
      await Promise.all(accounts.map((a) => idb().accounts.put(a)));
      if (mortgage) await idb().mortgage.put(mortgage);
    });
    set({ transactions: get().transactions.filter((t) => t.id !== id), accounts, mortgage });
    return prev;
  },

  addAccount: async (a) => {
    const row = { ...a, sortOrder: a.sortOrder ?? nextSortOrder(get().accounts, a.group) };
    const accounts = withLinkedCounterpart([...get().accounts, row], row);
    const mortgage = mortgageFromAccount(get().mortgage, row, accounts);
    await idb().transaction("rw", [idb().accounts, idb().mortgage], async () => {
      for (const x of accounts) {
        const before = get().accounts.find((y) => y.id === x.id);
        if (before !== x) await idb().accounts.put(x);
      }
      if (mortgage) await idb().mortgage.put(mortgage);
    });
    set({ accounts, mortgage });
  },
  updateAccount: async (a) => {
    const accounts = withLinkedCounterpart(get().accounts, a);
    const mortgage = mortgageFromAccount(get().mortgage, a, accounts);
    await idb().transaction("rw", [idb().accounts, idb().mortgage], async () => {
      for (const x of accounts) {
        const before = get().accounts.find((y) => y.id === x.id);
        if (before !== x) await idb().accounts.put(x);
      }
      if (mortgage) await idb().mortgage.put(mortgage);
    });
    set({ accounts, mortgage });
  },
  moveAccount: async (id, dir) => {
    const accounts = get().accounts;
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    const rows = accountsInGroup(accounts, acc.group);
    const i = rows.findIndex((a) => a.id === id);
    if (i < 0) return;
    let j = i + dir;
    while (j >= 0 && j < rows.length && rows[j].type !== acc.type) j += dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
    const patched = next.map((a, idx) => ({ ...a, sortOrder: idx }));
    await idb().transaction("rw", [idb().accounts], async () => {
      for (const a of patched) await idb().accounts.put(a);
    });
    const map = new Map(patched.map((a) => [a.id, a]));
    set({ accounts: accounts.map((a) => map.get(a.id) ?? a) });
  },
  addCategory: async (c) => {
    await idb().categories.add(c);
    set({ categories: [...get().categories, c] });
  },
  updateCategory: async (c) => {
    await idb().categories.put(c);
    set({ categories: get().categories.map((x) => (x.id === c.id ? c : x)) });
  },
  deleteCategory: async (id) => {
    const prev = get().categories;
    const next = prev.filter((c) => c.id !== id).map((c) => (c.parentId === id ? { ...c, parentId: undefined } : c));
    await idb().transaction("rw", [idb().categories], async () => {
      await idb().categories.delete(id);
      for (const c of next) {
        const before = prev.find((x) => x.id === c.id);
        if (before && before.parentId !== c.parentId) await idb().categories.put(c);
      }
    });
    set({ categories: next });
  },
  updateMortgage: async (m) => {
    const accounts = get().accounts.map((a) => (a.id === m.accountId ? { ...a, balance: -Math.abs(m.outstanding) } : a));
    await idb().transaction("rw", [idb().mortgage, idb().accounts], async () => {
      await idb().mortgage.put(m);
      const loan = accounts.find((a) => a.id === m.accountId);
      if (loan) await idb().accounts.put(loan);
    });
    set({ mortgage: m, accounts });
  },
  updateRetirement: async (r) => {
    await idb().retirement.put(r);
    set({ retirement: r });
  },
  updateBudget: async (b) => {
    await idb().budgets.put(b);
    set({
      budgets: get()
        .budgets.map((x) => (x.id === b.id ? b : x))
        .concat(get().budgets.some((x) => x.id === b.id) ? [] : [b]),
    });
  },
  addTrip: async (t) => {
    await idb().trips.add(t);
    set({ trips: [...get().trips, t] });
  },
  updateTrip: async (t) => {
    await idb().trips.put(t);
    set({ trips: get().trips.map((x) => (x.id === t.id ? t : x)) });
  },
  deleteTrip: async (id) => {
    await idb().trips.delete(id);
    set({ trips: get().trips.filter((t) => t.id !== id) });
  },
  addRecurring: async (r) => {
    const row = applyTxRules(r, { categories: get().categories, accounts: get().accounts });
    await idb().recurring.put(row);
    await upsertScheduledFor(row);
    const data = await loadAll();
    set({ recurring: data.recurring, transactions: data.transactions });
  },
  updateRecurring: async (r) => {
    const row = applyTxRules(r, { categories: get().categories, accounts: get().accounts });
    await idb().recurring.put(row);
    await upsertScheduledFor(row);
    const data = await loadAll();
    set({ recurring: data.recurring, transactions: data.transactions });
  },
  deleteRecurring: async (id) => {
    const today = todayISO();
    const month = today.slice(0, 7);
    const linked = get().transactions.filter((t) => t.recurringId === id && t.planned && t.date.startsWith(month));
    await idb().transaction("rw", [idb().recurring, idb().transactions], async () => {
      await idb().recurring.delete(id);
      for (const tx of linked) await idb().transactions.delete(tx.id);
    });
    set({
      recurring: get().recurring.filter((x) => x.id !== id),
      transactions: get().transactions.filter((t) => !linked.some((x) => x.id === t.id)),
    });
  },
  setFxRates: async (rows) => {
    await idb().fxRates.bulkPut(rows);
    set({ fxRates: rows });
  },
  refreshFx: async () => {
    const rows = await fetchLiveFx(get().fxRates);
    const synced = new Date().toISOString();
    await idb().fxRates.bulkPut(rows);
    await writeMeta({ lastFxSyncAt: synced }, get());
    set({ fxRates: rows, lastFxSyncAt: synced });
  },
  setAnnualTravel: async (n) => {
    await writeMeta({ annualTravelBudget: n }, get());
    set({ annualTravelBudget: n });
  },
  setDefaultCurrency: async (c) => {
    await writeMeta({ defaultCurrency: c }, get());
    set({ defaultCurrency: c });
  },
  addAllowance: async (a) => {
    await idb().allowances.put(a);
    set({ allowances: get().allowances.some((x) => x.id === a.id) ? get().allowances.map((x) => (x.id === a.id ? a : x)) : [...get().allowances, a] });
  },
  updateAllowance: async (a) => {
    await get().addAllowance(a);
  },
  deleteAllowance: async (id) => {
    await idb().allowances.delete(id);
    set({ allowances: get().allowances.filter((x) => x.id !== id) });
  },
  addAdhocBudget: async (a) => {
    await idb().adhocBudgets.put(a);
    set({
      adhocBudgets: get().adhocBudgets.some((x) => x.id === a.id)
        ? get().adhocBudgets.map((x) => (x.id === a.id ? a : x))
        : [...get().adhocBudgets, a],
    });
  },
  updateAdhocBudget: async (a) => {
    await get().addAdhocBudget(a);
  },
  deleteAdhocBudget: async (id) => {
    await idb().adhocBudgets.delete(id);
    set({ adhocBudgets: get().adhocBudgets.filter((x) => x.id !== id) });
  },
  addDeposit: async (partial) => {
    const row: TimeSaving = { ...partial, id: partial.id ?? nid() };
    await idb().deposits.put(row);
    set({ deposits: get().deposits.some((d) => d.id === row.id) ? get().deposits.map((d) => (d.id === row.id ? row : d)) : [...get().deposits, row] });
    await syncLinkedInterest(get, row);
    return row;
  },
  updateDeposit: async (row) => {
    await idb().deposits.put(row);
    set({ deposits: get().deposits.map((d) => (d.id === row.id ? row : d)) });
    await syncLinkedInterest(get, row);
  },
  deleteDeposit: async (id) => {
    const linked = get().transactions.find((t) => t.depositId === id);
    await idb().deposits.delete(id);
    set({ deposits: get().deposits.filter((d) => d.id !== id) });
    if (linked?.planned) await get().deleteTransaction(linked.id);
  },
  setYearlyCell: async (year, month0, field, value) => {
    const id = `${year}-${String(month0 + 1).padStart(2, "0")}`;
    const prev = get().yearlyPlans.find((p) => p.id === id) ?? { id, salary: 0, other: 0, expense: 0 };
    const next = { ...prev, [field]: value };
    await idb().yearlyPlans.put(next);
    set({
      yearlyPlans: get().yearlyPlans.some((p) => p.id === id)
        ? get().yearlyPlans.map((p) => (p.id === id ? next : p))
        : [...get().yearlyPlans, next],
    });
  },
  addWishItem: async (row) => {
    await idb().wishlist.put(row);
    set({
      wishlist: get().wishlist.some((x) => x.id === row.id)
        ? get().wishlist.map((x) => (x.id === row.id ? row : x))
        : [...get().wishlist, row],
    });
  },
  updateWishItem: async (row) => {
    await get().addWishItem(row);
  },
  deleteWishItem: async (id) => {
    await idb().wishlist.delete(id);
    set({ wishlist: get().wishlist.filter((x) => x.id !== id) });
  },
  replaceAll: async (snap) => {
    await idb().transaction("rw", idb().tables, async () => {
      await Promise.all(idb().tables.map((t) => t.clear()));
      await bulkChunk((rows) => idb().accounts.bulkAdd(rows), snap.accounts);
      await bulkChunk((rows) => idb().categories.bulkAdd(rows), snap.categories);
      await bulkChunk((rows) => idb().transactions.bulkAdd(rows), snap.transactions);
      await bulkChunk((rows) => idb().recurring.bulkAdd(rows), snap.recurring);
      await bulkChunk((rows) => idb().budgets.bulkAdd(rows), snap.budgets);
      await bulkChunk((rows) => idb().trips.bulkAdd(rows), snap.trips);
      await bulkChunk((rows) => idb().goals.bulkAdd(rows), snap.goals);
      if (snap.mortgage.length) await idb().mortgage.bulkAdd(snap.mortgage);
      if (snap.retirement.length) await idb().retirement.bulkAdd(snap.retirement);
      await bulkChunk((rows) => idb().allowances.bulkAdd(rows), snap.allowances ?? []);
      await bulkChunk((rows) => idb().oneOffs.bulkAdd(rows), snap.oneOffs ?? []);
      await bulkChunk((rows) => idb().adhocBudgets.bulkAdd(rows), snap.adhocBudgets ?? []);
      await bulkChunk((rows) => idb().deposits.bulkAdd(rows), snap.deposits ?? []);
      await bulkChunk((rows) => idb().yearlyPlans.bulkAdd(rows), snap.yearlyPlans ?? []);
      await bulkChunk((rows) => idb().wishlist.bulkAdd(rows), snap.wishlist ?? []);
      await idb().fxRates.bulkPut(snap.fxRates.length ? snap.fxRates : seedFx);
      if (snap.snapshots.length) await idb().snapshots.bulkPut(snap.snapshots);
      await idb().meta.put({
        key: "settings",
        annualTravelBudget: snap.annualTravelBudget,
        schemaVersion: 3,
        seededAt: snap.exportedAt,
        defaultCurrency: snap.defaultCurrency ?? "HKD",
        lastFxSyncAt: snap.lastFxSyncAt,
      });
    });
    await migrateAdhocFromPlannedTxs();
    const data = await loadAll();
    set({ ...data, ready: true });
  },
  exportSnapshot: () => {
    const s = get();
    return {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      accounts: s.accounts,
      categories: s.categories,
      transactions: s.transactions,
      recurring: s.recurring,
      budgets: s.budgets,
      trips: s.trips,
      goals: s.goals,
      mortgage: s.mortgage ? [s.mortgage] : [],
      retirement: s.retirement ? [s.retirement] : [],
      allowances: s.allowances,
      oneOffs: s.oneOffs,
      fxRates: s.fxRates,
      snapshots: s.snapshots,
      annualTravelBudget: s.annualTravelBudget,
      adhocBudgets: s.adhocBudgets,
      deposits: s.deposits,
      yearlyPlans: s.yearlyPlans,
      wishlist: s.wishlist,
      defaultCurrency: s.defaultCurrency,
      lastFxSyncAt: s.lastFxSyncAt,
    };
  },
  resetSample: async () => {
    await seedDb();
    await migrateAdhocFromPlannedTxs();
    await postDuePlanned();
    await syncRegularSchedules();
    const data = await loadAll();
    set({ ...data, ready: true });
  },
  clearAll: async () => {
    await seedSkeleton();
    const data = await loadAll();
    set({ ...data, ready: true });
  },
}));
