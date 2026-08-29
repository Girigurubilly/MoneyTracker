import Dexie, { type EntityTable } from "dexie";
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
  Transaction,
  Trip,
} from "./types";
import type { RetirementInputs } from "./calc/retirement";

export type MetaRow = {
  key: string;
  annualTravelBudget: number;
  schemaVersion: number;
  seededAt?: string;
  defaultCurrency?: Currency;
  lastFxSyncAt?: string;
};

export type RetirementRow = RetirementInputs & { id: string };

export type SnapshotRow = { month: string; net: number; assets: number; liab: number };

export class HKLifeDB extends Dexie {
  accounts!: EntityTable<Account, "id">;
  categories!: EntityTable<Category, "id">;
  transactions!: EntityTable<Transaction, "id">;
  recurring!: EntityTable<Recurring, "id">;
  budgets!: EntityTable<Budget, "id">;
  trips!: EntityTable<Trip, "id">;
  goals!: EntityTable<Goal, "id">;
  mortgage!: EntityTable<Mortgage, "id">;
  retirement!: EntityTable<RetirementRow, "id">;
  allowances!: EntityTable<Allowance, "id">;
  oneOffs!: EntityTable<OneOff, "id">;
  adhocBudgets!: EntityTable<AdhocBudget, "id">;
  fxRates!: EntityTable<FxRate, "currency">;
  meta!: EntityTable<MetaRow, "key">;
  snapshots!: EntityTable<SnapshotRow, "month">;

  constructor() {
    super("hk-life-money-v1");
    this.version(1).stores({
      accounts: "id, group, type",
      categories: "id, theme, kind",
      transactions: "id, date, accountId, type, tripId",
      recurring: "id, nextDate",
      budgets: "id, categoryId",
      trips: "id, start, status",
      goals: "id",
      mortgage: "id",
      retirement: "id",
      allowances: "id",
      oneOffs: "id",
      fxRates: "currency",
      meta: "key",
      snapshots: "month",
    });
    this.version(2).stores({
      adhocBudgets: "id, month, date",
    });
  }
}

let instance: HKLifeDB | null = null;

export function getDb(): HKLifeDB | null {
  if (typeof indexedDB === "undefined") return null;
  if (!instance) instance = new HKLifeDB();
  return instance;
}
