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
import type { AdhocBudget, Budget, Category, Mortgage, Recurring, Transaction } from "../types.ts";
import { monthlyLivingEssentials, monthlyHousingCost, isPrincipalRegular } from "./housing.ts";
import { periodCategoryTotals, periodRange } from "./period.ts";
import { runRetirement, sustainableMonthly } from "./retirement.ts";
import { monthlyPayment } from "./mortgage.ts";

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

describe("housing monthly cost", () => {
  const cats: Category[] = [
    { id: "p-housing", name: "Housing", nameZh: "房屋", theme: "living", kind: "expense", icon: "home" },
    { id: "mortgage-p", name: "Mortgage principal", nameZh: "按揭本金", theme: "living", kind: "expense", icon: "home", parentId: "p-housing" },
    { id: "mortgage-i", name: "Mortgage interest", nameZh: "按揭利息", theme: "living", kind: "expense", icon: "home", parentId: "p-housing" },
    { id: "mgmt", name: "Management fee", nameZh: "管理費", theme: "living", kind: "expense", icon: "building", parentId: "p-housing" },
  ];
  const recurring: Recurring[] = [
    rec({ id: "r-mgmt", type: "expense", amount: 1590, chargedDay: 1, living: true, categoryId: "mgmt", label: "Mgmt" }),
    rec({
      id: "r-p",
      type: "transfer",
      amount: 8800,
      chargedDay: 1,
      living: true,
      categoryId: "mortgage-p",
      countsAsExpense: true,
      label: "Principal",
    }),
    rec({ id: "r-i", type: "expense", amount: 5319, chargedDay: 1, living: true, categoryId: "mortgage-i", label: "Interest" }),
  ];
  it("必要開支 excludes mortgage principal", () => {
    assert.equal(isPrincipalRegular(recurring[1], cats), true);
    assert.equal(monthlyLivingEssentials(recurring, cats, []), 1590 + 5319);
  });
  it("住房成本 is the mortgage instalment", () => {
    const m: Mortgage = {
      id: "m",
      name: "m",
      nameZh: "m",
      accountId: "mortgage",
      original: 4_000_000,
      outstanding: 2_913_000,
      rate: 0.0215,
      pRate: 0.0525,
      spread: -0.031,
      remainingMonths: 256,
      paymentDay: 28,
      type: "p",
      livingMode: "own-mortgage",
    };
    const pmt = monthlyPayment(m.outstanding, 0.0215, 256);
    assert.equal(monthlyHousingCost(m, recurring, cats, []), pmt);
  });
});

describe("period merge", () => {
  const cats: Category[] = [
    { id: "p-food", name: "Food", nameZh: "飲食", theme: "living", kind: "expense", icon: "utensils" },
    { id: "dining", name: "Dining", nameZh: "外出就餐", theme: "living", kind: "expense", icon: "utensils", parentId: "p-food" },
    { id: "groc", name: "Groceries", nameZh: "超市", theme: "living", kind: "expense", icon: "shopping", parentId: "p-food" },
  ];
  const txs: Transaction[] = [
    tx({ id: "a", type: "expense", amount: 100, date: "2026-08-02", categoryId: "dining" }),
    tx({ id: "b", type: "expense", amount: 40, date: "2026-08-03", categoryId: "groc" }),
    tx({ id: "c", type: "income", amount: 200, date: "2026-08-04", categoryId: "dining" }),
  ];
  it("rolls children into the parent when merging", () => {
    const merged = periodCategoryTotals(txs, cats, [], "2026-08-01", "2026-08-31", "expense", true);
    assert.equal(merged.rows.length, 1);
    assert.equal(merged.rows[0].id, "p-food");
    assert.equal(merged.rows[0].value, 140);
    const split = periodCategoryTotals(txs, cats, [], "2026-08-01", "2026-08-31", "expense", false);
    assert.equal(split.rows.length, 2);
  });
  it("this-year range is inclusive calendar year", () => {
    const r = periodRange("this-year", "2026-08-28");
    assert.equal(r.from, "2026-01-01");
    assert.equal(r.to, "2026-12-31");
  });
});

describe("sustainable monthly", () => {
  it("finds a withdrawal that lasts to death age", () => {
    const inputs = {
      currentAge: 60,
      retireAge: 60,
      deathAge: 70,
      monthlyIncomeNow: 0,
      monthlySpendNow: 0,
      targetMonthly: 10_000,
      preReturn: 0,
      postReturn: 0,
      inflation: 0,
      travelInRetirement: 0,
    };
    const ctx = {
      investableNow: 120_000,
      mortgageMonthly: 0,
      mortgagePayoffAge: 60,
      housingAfterPayoff: 0,
      oneOffs: [] as { id: string; label: string; labelZh: string; amount: number; age: number }[],
    };
    const sustain = sustainableMonthly(inputs, ctx);
    assert.ok(sustain > 900 && sustain < 1100, String(sustain));
    const trial = runRetirement({ ...inputs, targetMonthly: sustain }, ctx);
    assert.equal(trial.depletes, false);
    const last = trial.series[trial.series.length - 1]?.corpus ?? 0;
    assert.ok(last >= 0);
  });
});
