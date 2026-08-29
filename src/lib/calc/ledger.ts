import type { Account, Transaction } from "../types.ts";

export function isPosted(tx: Transaction): boolean {
  return !tx.planned;
}

export function isSpendLike(tx: Pick<Transaction, "type" | "countsAsExpense">): boolean {
  return tx.type === "expense" || (tx.type === "transfer" && Boolean(tx.countsAsExpense));
}

export function cashflowSide(tx: Transaction): "income" | "expense" | "none" {
  if (tx.planned) return "none";
  if (tx.type === "income") return "income";
  if (isSpendLike(tx)) return "expense";
  return "none";
}

export function isDebtAccount(a: Pick<Account, "type">): boolean {
  return a.type === "mortgage" || a.type === "loan" || a.type === "credit";
}

/** Move a liability toward zero. Positive stored debt decreases; negative stored debt increases (toward 0). */
export function payDownDelta(balance: number, amount: number): number {
  const pay = Math.abs(amount);
  if (pay === 0) return 0;
  if (balance > 0) return -pay;
  return pay;
}

export function balanceDeltas(tx: Transaction, accounts: Account[] = []): { accountId: string; delta: number }[] {
  if (tx.planned) return [];
  if (tx.type === "expense") {
    return [{ accountId: tx.accountId, delta: -Math.abs(tx.amount) }];
  }
  if (tx.type === "income") {
    return [{ accountId: tx.accountId, delta: Math.abs(tx.amount) }];
  }
  if (tx.type === "transfer") {
    const rows = [{ accountId: tx.accountId, delta: -Math.abs(tx.amount) }];
    if (tx.toAccountId) {
      const dest = accounts.find((a) => a.id === tx.toAccountId);
      const amt = Math.abs(tx.destAmount ?? tx.amount);
      rows.push({
        accountId: tx.toAccountId,
        delta: dest && isDebtAccount(dest) ? payDownDelta(dest.balance, amt) : amt,
      });
    }
    return rows;
  }
  if (tx.milesType === "earn") {
    return [{ accountId: tx.accountId, delta: Math.abs(tx.amount) }];
  }
  if (tx.milesType === "adjust") {
    return [{ accountId: tx.accountId, delta: tx.amount }];
  }
  return [{ accountId: tx.accountId, delta: -Math.abs(tx.amount) }];
}

export function applyDeltas(
  accounts: Account[],
  deltas: { accountId: string; delta: number }[],
  sign: 1 | -1 = 1,
): Account[] {
  if (!deltas.length) return accounts;
  const map = new Map(accounts.map((a) => [a.id, { ...a }]));
  for (const d of deltas) {
    const acc = map.get(d.accountId);
    if (!acc) continue;
    acc.balance = roundMoney(acc.balance + d.delta * sign, acc.currency === "JPY" || acc.currency === "MILES" ? 0 : 2);
  }
  return accounts.map((a) => map.get(a.id) ?? a);
}

export function roundMoney(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function inMonth(iso: string, month: string): boolean {
  return iso.startsWith(month);
}

export function monthKey(iso = new Date().toISOString()): string {
  return iso.slice(0, 7);
}
