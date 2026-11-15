import type { AdhocBudget, Transaction } from "./types.ts";

export function isOneOffTx(tx: Transaction): boolean {
  if (!tx.adhoc) return false;
  if (tx.type === "expense") return true;
  return tx.type === "transfer" && Boolean(tx.countsAsExpense);
}

/** Find the one-off row for this expense. Uses the previous payee so a rename still hits. */
export function findPairedAdhoc(rows: AdhocBudget[], tx: Transaction, prev?: Transaction): AdhocBudget | undefined {
  const id = tx.adhocId || prev?.adhocId;
  if (id) {
    const hit = rows.find((a) => a.id === id);
    if (hit) return hit;
  }
  const byTx = rows.find((a) => a.txId === tx.id);
  if (byTx) return byTx;
  const source = prev ?? tx;
  if (!source.adhoc && !source.adhocId) return undefined;
  if (prev && !prev.adhoc && !prev.adhocId) return undefined;
  const probe = prev ?? tx;
  return rows.find(
    (a) =>
      !a.txId &&
      a.date === probe.date &&
      a.currency === probe.currency &&
      Math.abs(a.amount - probe.amount) < 0.01 &&
      (a.label === probe.payee || a.labelZh === probe.payeeZh || a.label === probe.payeeZh || a.labelZh === probe.payee),
  );
}

/** Find the expense for this one-off. Uses the previous label so a rename still hits. */
export function findPairedTx(txs: Transaction[], row: AdhocBudget, prev?: AdhocBudget): Transaction | undefined {
  if (row.txId) {
    const hit = txs.find((t) => t.id === row.txId);
    if (hit) return hit;
  }
  const byAdhoc = txs.find((t) => t.adhocId === row.id);
  if (byAdhoc) return byAdhoc;
  const probe = prev ?? row;
  return txs.find(
    (t) =>
      t.adhoc &&
      !t.adhocId &&
      t.date === probe.date &&
      t.currency === probe.currency &&
      Math.abs(t.amount - probe.amount) < 0.01 &&
      (t.payee === probe.label || t.payeeZh === probe.labelZh || t.payee === probe.labelZh || t.payeeZh === probe.label),
  );
}

export function adhocFromTx(tx: Transaction, existing: AdhocBudget | undefined, today: string): AdhocBudget {
  const paidOn = !tx.planned && tx.date <= today ? (existing?.paidOn ?? tx.date) : undefined;
  return {
    ...existing,
    id: existing?.id ?? crypto.randomUUID(),
    txId: tx.id,
    label: tx.payee,
    labelZh: tx.payeeZh || tx.payee,
    amount: tx.amount,
    currency: tx.currency,
    month: tx.date.slice(0, 7),
    date: tx.date,
    time: tx.time,
    categoryId: tx.categoryId,
    accountId: tx.accountId,
    tripId: tx.tripId,
    paidOn,
  };
}

export function txFromAdhoc(tx: Transaction, row: AdhocBudget): Transaction {
  return {
    ...tx,
    adhoc: true,
    adhocId: row.id,
    payee: row.label,
    payeeZh: row.labelZh || row.label,
    amount: row.amount,
    currency: row.currency,
    date: row.date,
    time: row.time ?? tx.time,
    categoryId: row.categoryId,
    accountId: row.accountId || tx.accountId,
    tripId: row.tripId,
    tripManual: tx.tripManual || Boolean(row.tripId),
    planned: row.paidOn ? false : tx.planned,
  };
}
