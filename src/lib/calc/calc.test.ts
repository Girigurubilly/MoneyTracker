import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  realizedNonRegularSpend,
  reservedRegulars,
  reservedAdhoc,
  realizedRegulars,
  adhocTotal,
  budgetActuals,
  monthCashflowForecast,
} from "./budget.ts";
import { MONTH_TOTAL_BUDGET_ID } from "../types.ts";
import type { AdhocBudget, Budget, Recurring, Transaction } from "../types.ts";

function rec(partial: Partial<Recurring> & Pick<Recurring, "id" | "type" | "amount" | "chargedDay">): Recurring {
  return {
    label: partial.label ?? partial.id,
    labelZh: partial.labelZh ?? partial.label ?? partial.id,
    currency: "HKD",
    accountId: "cash",
    frequency: "monthly",
    nextDate: `2026-08-${String(partial.chargedDay).padStart(2, "0")}`,
    ...partial,
  };
}

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "type" | "amount" | "date">): Transaction {
  return {
    currency: "HKD",
    accountId: "cash",
    payee: partial.payee ?? partial.id,
    payeeZh: partial.payeeZh ?? partial.payee ?? partial.id,
    ...partial,
  };
}

function hold(partial: Partial<AdhocBudget> & Pick<AdhocBudget, "id" | "amount" | "date">): AdhocBudget {
  return {
    label: partial.label ?? partial.id,
    labelZh: partial.labelZh ?? partial.label ?? partial.id,
    currency: "HKD",
    month: partial.month ?? partial.date.slice(0, 7),
    ...partial,
  };
}

describe("budget formulas", () => {
  it("已實現非定期 = 本月已花費 − 已實現每月定期 − 本月臨時 (all adhoc)", () => {
    assert.equal(realizedNonRegularSpend(10_000, 3_000, 2_000), 5_000);
    assert.equal(realizedNonRegularSpend(1_000, 3_000, 2_000), 0);
  });

  it("剩餘預算 holds only uncharged regulars and uncharged adhoc", () => {
    const budgets: Budget[] = [
      { id: MONTH_TOTAL_BUDGET_ID, label: "cap", labelZh: "上限", monthly: 20_000, spent: 0 },
    ];
    const recurring: Recurring[] = [
      rec({ id: "r-charged", type: "expense", amount: 3_000, chargedDay: 1 }),
      rec({ id: "r-open", type: "expense", amount: 4_000, chargedDay: 28 }),
    ];
    const adhoc: AdhocBudget[] = [
      hold({ id: "a-due", amount: 500, date: "2026-08-10" }),
      hold({ id: "a-open", amount: 1_500, date: "2026-08-30" }),
    ];
    const txs: Transaction[] = [
      tx({ id: "t1", type: "expense", amount: 10_000, date: "2026-08-12" }),
    ];
    const asOf = "2026-08-15";
    const [row] = budgetActuals(budgets, txs, "2026-08", [], [], recurring, asOf, adhoc);
    assert.equal(row.spent, 10_000);
    assert.equal(row.reserved, 4_000);
    assert.equal(row.reservedAdhoc, 1_500);
    assert.equal(row.adhoc, 2_000);
    assert.equal(row.realized, 3_000);
    assert.equal(row.remaining, 20_000 - 10_000 - 4_000 - 1_500);
    assert.equal(realizedNonRegularSpend(row.spent, row.realized, row.adhoc), 5_000);
  });

  it("reserved helpers skip charged items", () => {
    const recurring: Recurring[] = [
      rec({ id: "r1", type: "expense", amount: 100, chargedDay: 1 }),
      rec({ id: "r2", type: "expense", amount: 250, chargedDay: 20 }),
      rec({ id: "r3", type: "transfer", amount: 50, chargedDay: 25, countsAsExpense: true }),
    ];
    const adhoc: AdhocBudget[] = [
      hold({ id: "a1", amount: 10, date: "2026-08-05" }),
      hold({ id: "a2", amount: 40, date: "2026-08-22" }),
    ];
    assert.equal(realizedRegulars(recurring, [], "2026-08-15"), 100);
    assert.equal(reservedRegulars(recurring, [], "2026-08-15"), 300);
    assert.equal(adhocTotal(adhoc, "2026-08", []), 50);
    assert.equal(reservedAdhoc(adhoc, "2026-08", [], "2026-08-15"), 40);
  });
});

describe("monthCashflowForecast", () => {
  const recurring: Recurring[] = [
    rec({ id: "salary", type: "income", amount: 20_000, chargedDay: 1 }),
    rec({ id: "bonus", type: "income", amount: 5_000, chargedDay: 28 }),
    rec({ id: "rent", type: "expense", amount: 8_000, chargedDay: 1 }),
    rec({ id: "phone", type: "expense", amount: 200, chargedDay: 25 }),
  ];
  const adhoc: AdhocBudget[] = [
    hold({ id: "gift", amount: 1_000, date: "2026-08-10" }),
    hold({ id: "trip", amount: 3_000, date: "2026-08-29" }),
  ];
  const txs: Transaction[] = [
    tx({ id: "in", type: "income", amount: 20_000, date: "2026-08-01" }),
    tx({ id: "rent", type: "expense", amount: 8_000, date: "2026-08-01" }),
    tx({ id: "coffee", type: "expense", amount: 50, date: "2026-08-12" }),
    tx({ id: "past-in", type: "income", amount: 18_000, date: "2026-07-01" }),
    tx({ id: "past-out", type: "expense", amount: 9_000, date: "2026-07-03" }),
  ];
  const today = "2026-08-15";

  it("current month income = posted + uncharged scheduled income", () => {
    const cur = monthCashflowForecast(txs, recurring, adhoc, "2026-08", [], today);
    assert.equal(cur.income, 20_000 + 5_000);
  });

  it("current month expense = posted + uncharged regulars + uncharged adhoc", () => {
    const cur = monthCashflowForecast(txs, recurring, adhoc, "2026-08", [], today);
    assert.equal(cur.expense, 8_050 + 200 + 3_000);
  });

  it("future month uses monthly regulars only, not adhoc", () => {
    const fut = monthCashflowForecast(txs, recurring, adhoc, "2026-09", [], today);
    assert.equal(fut.income, 25_000);
    assert.equal(fut.expense, 8_200);
  });

  it("past month is posted only", () => {
    const past = monthCashflowForecast(txs, recurring, adhoc, "2026-07", [], today);
    assert.equal(past.income, 18_000);
    assert.equal(past.expense, 9_000);
  });
});
