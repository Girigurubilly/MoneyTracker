import type { AppSnapshot } from "@/store/app";
import type { Account, Currency, FxRate, Transaction } from "@/lib/types";

type BtpFile = {
  app?: string;
  version?: number;
  budget?: {
    monthly?: Record<string, { budget?: number }>;
    regular?: { id: string; name: string; amount: number; day: number }[];
    accounts?: { id: string; name: string; kind: string; currency: string; balance: number; mortgage?: number }[];
    transactions?: BtpTx[];
  };
  ledger?: {
    transactions?: BtpTx[];
    accounts?: BtpFile["budget"] extends infer B ? B extends { accounts?: infer A } ? A : never : never;
    rates?: Record<string, number>;
  };
};

type BtpTx = {
  id: string;
  iso: string;
  account: string;
  category: string;
  description: string;
  type: string;
  currency: string;
  amountOriginal: number;
  amountHKD: number;
};

export function isBtpFile(data: unknown): data is BtpFile {
  if (!data || typeof data !== "object") return false;
  const d = data as BtpFile;
  if (d.app === "Budget Tracker Pro") return true;
  return Array.isArray(d.ledger?.transactions) || Array.isArray(d.budget?.transactions);
}

export function isAppSnapshot(data: unknown): data is AppSnapshot {
  if (!data || typeof data !== "object") return false;
  const d = data as AppSnapshot;
  return Array.isArray(d.accounts) && Array.isArray(d.transactions) && Array.isArray(d.categories) && typeof d.schemaVersion === "number";
}

function btpRates(data: BtpFile): FxRate[] {
  const raw = data.ledger?.rates;
  if (!raw) return [];
  const asOf = new Date().toISOString().slice(0, 10);
  const out: FxRate[] = [];
  for (const [currency, perUnit] of Object.entries(raw)) {
    if (!perUnit || currency === "HKD") continue;
    out.push({
      currency: currency as Currency,
      perHkd: 1 / perUnit,
      asOf,
      source: "Budget Tracker Pro",
    });
  }
  return out;
}

export function convertBtp(data: BtpFile): AppSnapshot {
  const accs = data.budget?.accounts ?? data.ledger?.accounts ?? [];
  const txs = data.budget?.transactions ?? data.ledger?.transactions ?? [];
  const accounts = accs.map((a, i) => ({
    id: a.id || `a-${i}`,
    name: a.name,
    nameZh: a.name,
    type: (a.kind === "credit" ? "credit" : a.kind === "mortgage" ? "mortgage" : "current") as Account["type"],
    currency: (a.currency === "MILES" ? "MILES" : a.currency || "HKD") as Account["currency"],
    balance: a.kind === "mortgage" ? -Math.abs(a.mortgage || a.balance) : a.balance,
    includeInNetWorth: true,
    group: a.kind === "credit" ? ("credit" as const) : a.kind === "mortgage" ? ("housing" as const) : ("cash" as const),
  }));
  const catMap = new Map<string, string>();
  const categories = [] as AppSnapshot["categories"];
  for (const tx of txs) {
    const label = tx.category || "Other";
    if (!catMap.has(label)) {
      const id = `c-${catMap.size}`;
      catMap.set(label, id);
      categories.push({
        id,
        name: label,
        nameZh: label,
        theme: "other",
        kind: tx.type === "income" ? "income" : "expense",
        icon: "wallet",
      });
    }
  }
  const transactions = txs.map((tx, i) => {
    const currency = (tx.currency || "HKD") as Transaction["currency"];
    const original = Math.abs(tx.amountOriginal || tx.amountHKD || 0);
    const hkd = Math.abs(tx.amountHKD || tx.amountOriginal || 0);
    const fxToHkd = currency !== "HKD" && currency !== "MILES" && original > 0 && hkd > 0 ? hkd / original : undefined;
    return {
      id: tx.id || `t-${i}`,
      type: (tx.type === "income" ? "income" : tx.type === "transfer" ? "transfer" : "expense") as Transaction["type"],
      amount: original,
      currency,
      accountId: accounts.find((a) => a.name === tx.account)?.id ?? accounts[0]?.id ?? "a0",
      categoryId: catMap.get(tx.category),
      date: tx.iso?.slice(0, 10) ?? "2026-01-01",
      payee: tx.description || tx.category || "—",
      payeeZh: tx.description || tx.category || "—",
      fxToHkd,
    };
  });
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    accounts: accounts.length ? accounts : [{ id: "cash-hkd", name: "Cash", nameZh: "現金", type: "cash", currency: "HKD", balance: 0, includeInNetWorth: true, group: "cash" }],
    categories,
    transactions,
    recurring: [],
    budgets: [],
    trips: [],
    goals: [],
    mortgage: [],
    retirement: [],
    allowances: [],
    oneOffs: [],
    fxRates: btpRates(data),
    snapshots: [],
    annualTravelBudget: 0,
    adhocBudgets: [],
  };
}
