import type { Account, FxRate, MoneyUnit, Transaction } from "../types.ts";
import { convertAmount, toHkd } from "./fx.ts";

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

/** HKD gained or lost on a transfer. A matched move is 0. A short destination is a loss. */
export function transferGapHkd(tx: Transaction, accounts: Account[], rates: FxRate[]): number {
  const srcHkd = accountLegHkd(tx, accounts, rates, tx.accountId, tx.amount);
  if (!tx.toAccountId) return -srcHkd;
  const dest = accounts.find((a) => a.id === tx.toAccountId);
  const destCcy = dest?.currency ?? tx.currency;
  const destAmt =
    tx.destAmount != null ? Math.abs(tx.destAmount) : Math.abs(amountInAccount(tx.amount, tx.currency, dest, rates, tx.fxToHkd));
  const destHkd = Math.abs(toHkd(destAmt, destCcy, rates, destCcy === tx.currency ? tx.fxToHkd : undefined));
  return destHkd - srcHkd;
}

function accountLegHkd(tx: Transaction, accounts: Account[], rates: FxRate[], accountId: string, amount: number): number {
  const acc = accounts.find((a) => a.id === accountId);
  const ccy = acc?.currency ?? tx.currency;
  const amt = Math.abs(amountInAccount(amount, tx.currency, acc, rates, tx.fxToHkd));
  return Math.abs(toHkd(amt, ccy, rates, ccy === tx.currency ? tx.fxToHkd : undefined));
}

/** Posted income minus posted expense since `afterIso`, plus any transfer shortfall. Plain transfers net to zero. */
export function netCashMovementHkd(
  txs: Transaction[],
  accounts: Account[],
  rates: FxRate[],
  afterIso: string,
  throughIso: string,
): number {
  let sum = 0;
  for (const tx of txs) {
    if (tx.planned || tx.type === "miles") continue;
    if (tx.date <= afterIso || tx.date > throughIso) continue;
    if (tx.type === "income") sum += accountLegHkd(tx, accounts, rates, tx.accountId, tx.amount);
    else if (tx.type === "expense") sum -= accountLegHkd(tx, accounts, rates, tx.accountId, tx.amount);
    else if (tx.type === "transfer") sum += transferGapHkd(tx, accounts, rates);
  }
  return Math.round(sum * 100) / 100;
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

export function amountInAccount(
  amount: number,
  from: MoneyUnit,
  account: Account | undefined,
  rates: FxRate[],
  fxToHkd?: number,
): number {
  if (!account || from === account.currency) return amount;
  return convertAmount(amount, from, account.currency, rates, fxToHkd);
}

export function balanceDeltas(
  tx: Transaction,
  accounts: Account[] = [],
  rates: FxRate[] = [],
): { accountId: string; delta: number }[] {
  if (tx.planned) return [];
  const src = accounts.find((a) => a.id === tx.accountId);
  const srcAmt = Math.abs(amountInAccount(tx.amount, tx.currency, src, rates, tx.fxToHkd));
  if (tx.type === "expense") {
    return [{ accountId: tx.accountId, delta: -srcAmt }];
  }
  if (tx.type === "income") {
    return [{ accountId: tx.accountId, delta: srcAmt }];
  }
  if (tx.type === "transfer") {
    const rows = [{ accountId: tx.accountId, delta: -srcAmt }];
    if (tx.toAccountId) {
      const dest = accounts.find((a) => a.id === tx.toAccountId);
      const destAmt = Math.abs(
        tx.destAmount != null
          ? tx.destAmount
          : amountInAccount(tx.amount, tx.currency, dest, rates, tx.fxToHkd),
      );
      rows.push({
        accountId: tx.toAccountId,
        delta: dest && isDebtAccount(dest) ? payDownDelta(dest.balance, destAmt) : destAmt,
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
  return [{ accountId: tx.accountId, delta: -srcAmt }];
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

export function monthKey(iso?: string): string {
  if (iso) return iso.slice(0, 7);
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}