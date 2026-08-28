import { create } from "zustand";
import { getDb } from "@/lib/idb";
import type {
  Account,
  Allowance,
  Budget,
  Category,
  FxRate,
  Goal,
  Mortgage,
  OneOff,
  Recurring,
  Transaction,
  Trip,
} from "@/lib/types";
import type { RetirementInputs } from "@/lib/calc/retirement";
import type { SnapshotRow } from "@/lib/idb";
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
  annualTravelBudget as seedTravelBudget,
  netWorthSeries as seedNw,
} from "@/lib/mock";
import { applyDeltas, balanceDeltas, monthKey } from "@/lib/calc/ledger";
import { netWorthNow } from "@/lib/calc/networth";
import { fetchLiveFx } from "@/lib/calc/fx";
import { chargedDayOf, chargedIso, inferLivingRegular } from "@/lib/calc/budget";
import { isMortgageInterestCategory, isMortgagePrincipalCategory } from "@/lib/categories";
import { accountsInGroup, nextSortOrder } from "@/lib/accounts";
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
};

function idb() {
  const d = getDb();
  if (!d) throw new Error("IndexedDB unavailable");
  return d;
}

function nid(): string {
  return crypto.randomUUID();
}

export function newId(): string {
  return nid();
}

export function accountById(id: string, accounts?: Account[]) {
  return (accounts ?? useApp.getState().accounts).find((a) => a.id === id);
}

export function categoryById(id?: string, categories?: Category[]) {
  if (!id) return undefined;
  return (categories ?? useApp.getState().categories).find((c) => c.id === id);
}

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
  fxRates: FxRate[];
  snapshots: SnapshotRow[];
  annualTravelBudget: number;
  hydrate: () => Promise<void>;
  addTransaction: (tx: Omit<Transaction, "id"> & { id?: string }) => Promise<Transaction>;
  updateTransaction: (tx: Transaction, previous?: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<Transaction | undefined>;
  addAccount: (a: Account) => Promise<void>;
  updateAccount: (a: Account) => Promise<void>;
  moveAccount: (id: string, dir: -1 | 1) => Promise<void>;
  addCategory: (c: Category) => Promise<void>;
  updateCategory: (c: Category) => Promise<void>;
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
  addAllowance: (a: Allowance) => Promise<void>;
  updateAllowance: (a: Allowance) => Promise<void>;
  deleteAllowance: (id: string) => Promise<void>;
  replaceAll: (snap: AppSnapshot) => Promise<void>;
  exportSnapshot: () => AppSnapshot;
  resetSample: () => Promise<void>;
  clearAll: () => Promise<void>;
};

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
    fxRates,
    snapshots,
    annualTravelBudget: meta?.annualTravelBudget ?? seedTravelBudget,
  };
}

type Dispatchers = {
  addTransaction: AppState["addTransaction"];
  updateTransaction: AppState["updateTransaction"];
  deleteTransaction: AppState["deleteTransaction"];
  addAccount: AppState["addAccount"];
  updateAccount: AppState["updateAccount"];
  moveAccount: AppState["moveAccount"];
  addCategory: AppState["addCategory"];
  updateCategory: AppState["updateCategory"];
  updateMortgage: AppState["updateMortgage"];
  updateRetirement: AppState["updateRetirement"];
  updateBudget: AppState["updateBudget"];
  addTrip: AppState["addTrip"];
  updateTrip: AppState["updateTrip"];
  deleteTrip: AppState["deleteTrip"];
  addRecurring: AppState["addRecurring"];
  updateRecurring: AppState["updateRecurring"];
  deleteRecurring: AppState["deleteRecurring"];
  setFxRates: AppState["setFxRates"];
  refreshFx: AppState["refreshFx"];
  setAnnualTravel: AppState["setAnnualTravel"];
  addAllowance: AppState["addAllowance"];
  updateAllowance: AppState["updateAllowance"];
  deleteAllowance: AppState["deleteAllowance"];
  replaceAll: AppState["replaceAll"];
  exportSnapshot: AppState["exportSnapshot"];
  resetSample: AppState["resetSample"];
  clearAll: AppState["clearAll"];
};

async function seedDb() {
  const ret = {
    id: "base",
    currentAge: seedRetirement.currentAge,
    retireAge: seedRetirement.retireAge,
    deathAge: seedRetirement.deathAge,
    monthlyIncomeNow: seedRetirement.monthlyIncomeNow,
    monthlySpendNow: seedRetirement.monthlySpendNow,
    targetMonthly: seedRetirement.targetMonthly,
    preReturn: seedRetirement.preReturn,
    postReturn: seedRetirement.postReturn,
    inflation: seedRetirement.inflation,
    travelInRetirement: seedRetirement.travelInRetirement,
  };
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
    await idb().fxRates.bulkAdd(seedFx);
    await idb().snapshots.bulkAdd(
      seedNw.map((s) => ({
        month: s.month,
        net: s.value,
        assets: s.value + 2_858_240,
        liab: 2_858_240,
      })),
    );
    await idb().meta.put({
      key: "settings",
      annualTravelBudget: seedTravelBudget,
      schemaVersion: 1,
      seededAt: new Date().toISOString(),
    });
  });
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

async function seedSkeleton() {
  await idb().transaction("rw", idb().tables, async () => {
    await Promise.all(idb().tables.map((t) => t.clear()));
    await idb().accounts.bulkAdd([defaultCash]);
    await idb().categories.bulkAdd(seedCategories);
    await idb().fxRates.bulkAdd(seedFx);
    await idb().allowances.bulkAdd([defaultOaa]);
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
      schemaVersion: 1,
      seededAt: new Date().toISOString(),
    });
  });
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
    destAmount: r.type === "transfer" ? r.amount : undefined,
    categoryId: r.categoryId,
    date: iso,
    payee: r.label,
    payeeZh: r.labelZh,
    planned: iso > today,
    recurringId: r.id,
    countsAsExpense: r.countsAsExpense,
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
  const adopt =
    existing ??
    txs.find(
      (t) =>
        t.planned &&
        !t.recurringId &&
        t.type === r.type &&
        t.date === iso &&
        t.accountId === r.accountId &&
        Math.abs(t.amount - r.amount) < 0.01,
    );
  const tx = scheduledFromRegular(r, month, today, adopt?.id);
  if (adopt) await idb().transactions.put({ ...adopt, ...tx, id: adopt.id });
  else await idb().transactions.add(tx);
  const dupes = txs.filter(
    (t) =>
      t.id !== tx.id &&
      t.planned &&
      !t.recurringId &&
      t.type === r.type &&
      t.date === iso &&
      t.accountId === r.accountId &&
      Math.abs(t.amount - r.amount) < 0.01,
  );
  for (const d of dupes) await idb().transactions.delete(d.id);
}

async function postDuePlanned() {
  const today = todayISO();
  const txs = await idb().transactions.toArray();
  const due = txs.filter((t) => t.planned && t.date <= today);
  if (!due.length) return;
  let accounts = await idb().accounts.toArray();
  await idb().transaction("rw", [idb().transactions, idb().accounts], async () => {
    for (const tx of due) {
      const posted = { ...tx, planned: false };
      accounts = applyDeltas(accounts, balanceDeltas(posted));
      await idb().transactions.put(posted);
    }
    for (const a of accounts) await idb().accounts.put(a);
  });
}

async function syncRegularSchedules() {
  const rows = await idb().recurring.toArray();
  for (const r of rows) await upsertScheduledFor(r);
}

async function ensureCategoryParents() {
  const existing = await idb().categories.toArray();
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const s of seedCategories) {
    if (!s.parentId) continue;
    const cur = byId.get(s.id);
    if (cur && cur.parentId !== s.parentId) {
      await idb().categories.put({ ...cur, parentId: s.parentId });
    }
  }
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
  for (let i = 0; i < rows.length; i += size) {
    await add(rows.slice(i, i + size));
  }
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
  fxRates: seedFx,
  snapshots: [],
  annualTravelBudget: seedTravelBudget,

  hydrate: async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        void navigator.storage.persist();
      }
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
        await ensureCategoryParents();
        await ensureMortgageCategories();
        await ensureRegularLiving();
        await postDuePlanned();
        await syncRegularSchedules();
      }
      const data = await loadAll();
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
    const tx: Transaction = { ...partial, id: partial.id ?? nid() };
    let accounts = get().accounts;
    accounts = applyDeltas(accounts, balanceDeltas(tx));
    await idb().transaction("rw", [idb().transactions, idb().accounts], async () => {
      await idb().transactions.add(tx);
      await Promise.all(accounts.map((a) => idb().accounts.put(a)));
    });
    set({
      transactions: [tx, ...get().transactions],
      accounts,
    });
    return tx;
  },

  updateTransaction: async (tx, previous) => {
    const prev = previous ?? get().transactions.find((t) => t.id === tx.id);
    let accounts = get().accounts;
    if (prev) accounts = applyDeltas(accounts, balanceDeltas(prev), -1);
    accounts = applyDeltas(accounts, balanceDeltas(tx), 1);
    await idb().transaction("rw", [idb().transactions, idb().accounts], async () => {
      await idb().transactions.put(tx);
      await Promise.all(accounts.map((a) => idb().accounts.put(a)));
    });
    set({
      transactions: get().transactions.map((t) => (t.id === tx.id ? tx : t)),
      accounts,
    });
  },

  deleteTransaction: async (id) => {
    const prev = get().transactions.find((t) => t.id === id);
    if (!prev) return undefined;
    const accounts = applyDeltas(get().accounts, balanceDeltas(prev), -1);
    await idb().transaction("rw", [idb().transactions, idb().accounts], async () => {
      await idb().transactions.delete(id);
      await Promise.all(accounts.map((a) => idb().accounts.put(a)));
    });
    set({
      transactions: get().transactions.filter((t) => t.id !== id),
      accounts,
    });
    return prev;
  },

  addAccount: async (a) => {
    const row = { ...a, sortOrder: a.sortOrder ?? nextSortOrder(get().accounts, a.group) };
    await idb().accounts.add(row);
    set({ accounts: [...get().accounts, row] });
  },

  updateAccount: async (a) => {
    await idb().accounts.put(a);
    set({ accounts: get().accounts.map((x) => (x.id === a.id ? a : x)) });
  },

  moveAccount: async (id, dir) => {
    const accounts = get().accounts;
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    const rows = accountsInGroup(accounts, acc.group);
    const i = rows.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
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

  updateMortgage: async (m) => {
    let accounts = get().accounts.map((a) => {
      if (a.id === m.accountId) return { ...a, balance: -Math.abs(m.outstanding) };
      return a;
    });
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
    const linked = get().transactions.filter((t) => t.tripId === id);
    await idb().transaction("rw", [idb().trips, idb().transactions], async () => {
      await idb().trips.delete(id);
      for (const tx of linked) {
        const next = { ...tx };
        delete next.tripId;
        await idb().transactions.put(next);
      }
    });
    set({
      trips: get().trips.filter((t) => t.id !== id),
      transactions: get().transactions.map((t) => {
        if (t.tripId !== id) return t;
        const next = { ...t };
        delete next.tripId;
        return next;
      }),
    });
  },

  addRecurring: async (r) => {
    await idb().recurring.put(r);
    await upsertScheduledFor(r);
    const data = await loadAll();
    set({
      recurring: data.recurring,
      transactions: data.transactions,
    });
  },

  updateRecurring: async (r) => {
    await idb().recurring.put(r);
    await upsertScheduledFor(r);
    const data = await loadAll();
    set({
      recurring: data.recurring,
      transactions: data.transactions,
    });
  },

  deleteRecurring: async (id) => {
    const today = todayISO();
    const month = today.slice(0, 7);
    const linked = get().transactions.filter(
      (t) => t.recurringId === id && t.planned && t.date.startsWith(month),
    );
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
    await get().setFxRates(rows);
  },

  setAnnualTravel: async (n) => {
    const prev = await idb().meta.get("settings");
    await idb().meta.put({
      key: "settings",
      annualTravelBudget: n,
      schemaVersion: prev?.schemaVersion ?? 1,
      seededAt: prev?.seededAt,
    });
    set({ annualTravelBudget: n });
  },

  addAllowance: async (a) => {
    await idb().allowances.put(a);
    set({
      allowances: get().allowances.some((x) => x.id === a.id)
        ? get().allowances.map((x) => (x.id === a.id ? a : x))
        : [...get().allowances, a],
    });
  },

  updateAllowance: async (a) => {
    await idb().allowances.put(a);
    set({
      allowances: get().allowances.some((x) => x.id === a.id)
        ? get().allowances.map((x) => (x.id === a.id ? a : x))
        : [...get().allowances, a],
    });
  },

  deleteAllowance: async (id) => {
    await idb().allowances.delete(id);
    set({ allowances: get().allowances.filter((x) => x.id !== id) });
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
      await bulkChunk((rows) => idb().allowances.bulkAdd(rows), snap.allowances);
      await bulkChunk((rows) => idb().oneOffs.bulkAdd(rows), snap.oneOffs);
      if (snap.fxRates.length) await idb().fxRates.bulkPut(snap.fxRates);
      if (snap.snapshots.length) await idb().snapshots.bulkPut(snap.snapshots);
      await idb().meta.put({
        key: "settings",
        annualTravelBudget: snap.annualTravelBudget,
        schemaVersion: snap.schemaVersion || 1,
        seededAt: snap.exportedAt,
      });
    });
    const data = await loadAll();
    set({ ...data, ready: true });
  },

  exportSnapshot: () => {
    const s = get();
    return {
      schemaVersion: 1,
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
    };
  },

  resetSample: async () => {
    await seedDb();
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
