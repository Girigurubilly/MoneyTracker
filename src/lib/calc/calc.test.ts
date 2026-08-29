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
  forecastTone,
  projectedNonRegularRemain,
  avgDailyNonRegular,
} from "./budget.ts";
import { convertAmount, parseErApi, parseFrankfurter } from "./fx.ts";
import { MONTH_TOTAL_BUDGET_ID } from "../types.ts";
import type { AdhocBudget, Budget, Category, Recurring, Transaction } from "../types.ts";
import { monthlyLivingEssentials, monthlyHousingCost, isPrincipalRegular, housingRegularRows, housingMonthLines } from "./housing.ts";
import { periodCategoryTotals, periodCategoryTxs, periodRange } from "./period.ts";
import { runRetirement, sustainableMonthly } from "./retirement.ts";

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

  it("剩餘預算 uses charged-day calendar, not txn matching", () => {
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
      tx({ id: "t-charged", type: "expense", amount: 3_000, date: "2026-08-01", recurringId: "r-charged" }),
      tx({ id: "t1", type: "expense", amount: 7_000, date: "2026-08-12" }),
    ];
    const asOf = "2026-08-15";
    const [row] = budgetActuals(budgets, txs, "2026-08", [], [], recurring, asOf, adhoc);
    const reservedHold = 4_000 + 1_500;
    const realized = 3_000 + 500;
    const pace = 10_000 - realized;
    const remain = projectedNonRegularRemain(pace, asOf);
    assert.equal(row.spent, 10_000);
    assert.equal(row.reserved, 4_000);
    assert.equal(row.reservedAdhoc, 1_500);
    assert.equal(row.adhoc, 2_000);
    assert.equal(row.realized, realized);
    assert.equal(row.nonRegular, pace);
    assert.equal(row.avgDaily, avgDailyNonRegular(pace, asOf));
    assert.equal(row.projectedRemain, remain);
    assert.equal(row.projected, pace + remain);
    assert.equal(row.expected, 10_000 + reservedHold + remain);
    assert.equal(row.remaining, 20_000 - 10_000 - reservedHold);
    assert.equal(row.daysRemaining, 16);
    assert.equal(row.dailyAllowed, row.remaining / 16);
    assert.equal(row.ratio, row.expected / 20_000);
  });

  it("a regular whose charged day has not arrived stays reserved even if the category spent", () => {
    const budgets: Budget[] = [
      { id: MONTH_TOTAL_BUDGET_ID, label: "cap", labelZh: "上限", monthly: 20_000, spent: 0 },
    ];
    const recurring: Recurring[] = [
      rec({ id: "r-phone", type: "expense", amount: 200, chargedDay: 25, categoryId: "phone" }),
    ];
    const cats: Category[] = [
      { id: "phone", name: "Phone", nameZh: "電話", theme: "living", kind: "expense", icon: "wifi" },
    ];
    const txs: Transaction[] = [
      tx({ id: "t-phone", type: "expense", amount: 198, date: "2026-08-05", categoryId: "phone" }),
    ];
    const [row] = budgetActuals(budgets, txs, "2026-08", [], cats, recurring, "2026-08-15", []);
    assert.equal(row.spent, 198);
    assert.equal(row.reserved, 200);
    assert.equal(row.realized, 0);
    assert.equal(row.avgDaily, 198 / 15);
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

describe("cap projection", () => {
  it("avgDaily is (spent − realized) / day; headline adds remaining-days pace", () => {
    const budgets: Budget[] = [
      { id: MONTH_TOTAL_BUDGET_ID, label: "cap", labelZh: "上限", monthly: 20_000, spent: 0 },
    ];
    const recurring: Recurring[] = [
      rec({ id: "r-charged", type: "expense", amount: 3_000, chargedDay: 1 }),
      rec({ id: "r-open", type: "expense", amount: 4_000, chargedDay: 28 }),
    ];
    const txs: Transaction[] = [
      tx({ id: "t-charged", type: "expense", amount: 3_000, date: "2026-08-01", recurringId: "r-charged" }),
      tx({ id: "t1", type: "expense", amount: 7_000, date: "2026-08-12" }),
    ];
    const [row] = budgetActuals(budgets, txs, "2026-08", [], [], recurring, "2026-08-15", []);
    const reservedHold = 4_000;
    const realized = 3_000;
    const pace = 10_000 - realized;
    assert.equal(row.realized, realized);
    assert.equal(row.reserved, reservedHold);
    assert.equal(row.avgDaily, pace / 15);
    assert.equal(row.projected, pace + (pace / 15) * 16);
    assert.equal(row.expected, 10_000 + reservedHold + (pace / 15) * 16);
    assert.equal(row.remaining, 6_000);
    assert.equal(row.dailyAllowed, 6_000 / 16);
  });

  it("past charged day counts as 已入帳 even with no matching txn", () => {
    const budgets: Budget[] = [
      { id: MONTH_TOTAL_BUDGET_ID, label: "cap", labelZh: "上限", monthly: 20_000, spent: 0 },
    ];
    const recurring: Recurring[] = [
      rec({ id: "r-due", type: "expense", amount: 3_000, chargedDay: 1 }),
      rec({ id: "r-open", type: "expense", amount: 4_000, chargedDay: 28 }),
    ];
    const txs: Transaction[] = [tx({ id: "t-all", type: "expense", amount: 10_000, date: "2026-08-12" })];
    const [row] = budgetActuals(budgets, txs, "2026-08", [], [], recurring, "2026-08-15", []);
    const reservedHold = 4_000;
    const realized = 3_000;
    const pace = 10_000 - realized;
    assert.equal(row.spent, 10_000);
    assert.equal(row.reserved, 4_000);
    assert.equal(row.realized, 3_000);
    assert.equal(row.avgDaily, pace / 15);
    assert.equal(row.expected, 10_000 + reservedHold + (pace / 15) * 16);
    assert.equal(row.remaining, 20_000 - 10_000 - reservedHold);
  });

  it("adhoc whose date has passed is 已入帳; later dates stay 已預留", () => {
    const budgets: Budget[] = [
      { id: MONTH_TOTAL_BUDGET_ID, label: "cap", labelZh: "上限", monthly: 20_000, spent: 0 },
    ];
    const adhoc: AdhocBudget[] = [
      hold({ id: "a-gift", amount: 2_000, date: "2026-08-10", categoryId: "gift" }),
      hold({ id: "a-open", amount: 1_500, date: "2026-08-30" }),
    ];
    const txs: Transaction[] = [
      tx({ id: "t-gift", type: "expense", amount: 2_000, date: "2026-08-10", categoryId: "gift" }),
      tx({ id: "t1", type: "expense", amount: 3_000, date: "2026-08-12" }),
    ];
    const [row] = budgetActuals(budgets, txs, "2026-08", [], [], [], "2026-08-15", adhoc);
    assert.equal(row.spent, 5_000);
    assert.equal(row.reserved, 0);
    assert.equal(row.reservedAdhoc, 1_500);
    assert.equal(row.realized, 2_000);
    assert.equal(row.avgDaily, 3_000 / 15);
    assert.equal(row.expected, 5_000 + 1_500 + (3_000 / 15) * 16);
  });
});

describe("convertAmount", () => {
  it("converts via HKD and is reversible", () => {
    const rates = [{ currency: "USD" as const, perHkd: 7.8, asOf: "2026-08-01", source: "test" }];
    assert.equal(convertAmount(100, "USD", "HKD", rates), 780);
    assert.equal(convertAmount(780, "HKD", "USD", rates), 100);
    assert.equal(convertAmount(50, "HKD", "HKD", rates), 50);
  });
});

describe("fx parsers", () => {
  it("Frankfurter from HKD stores per-HKD as the inverse", () => {
    const rows = parseFrankfurter({ date: "2026-08-28", rates: { USD: 0.128 } });
    const usd = rows.find((r) => r.currency === "USD");
    assert.ok(usd);
    assert.equal(usd?.asOf, "2026-08-28");
    assert.ok(Math.abs((usd?.perHkd ?? 0) - 1 / 0.128) < 1e-9);
  });
  it("ER-API uses the published update date", () => {
    const rows = parseErApi({
      time_last_update_utc: "Fri, 28 Aug 2026 00:02:30 +0000",
      rates: { USD: 0.128, TWD: 4.1 },
    });
    const twd = rows.find((r) => r.currency === "TWD");
    assert.ok(twd);
    assert.equal(twd?.asOf, "2026-08-28");
    assert.ok(Math.abs((twd?.perHkd ?? 0) - 1 / 4.1) < 1e-9);
  });
});

describe("forecastTone", () => {
  it("0–95% green, 96–100% amber, over 100% red", () => {
    assert.equal(forecastTone(0), "income");
    assert.equal(forecastTone(0.95), "income");
    assert.equal(forecastTone(0.959), "income");
    assert.equal(forecastTone(0.96), "watch");
    assert.equal(forecastTone(1), "watch");
    assert.equal(forecastTone(1.01), "expense");
    assert.equal(forecastTone(Number.NaN), "income");
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
  it("房屋定期 includes mortgage principal as a house expense", () => {
    const rows = housingRegularRows(recurring, cats, []);
    assert.equal(rows.some((r) => r.id === "r-p"), true);
    assert.equal(rows.reduce((s, r) => s + r.amount, 0), 1590 + 8800 + 5319);
  });
  it("住房成本 is posted house spend plus remaining scheduled, including 本金", () => {
    const asOf = "2026-08-29";
    assert.equal(monthlyHousingCost([], recurring, cats, [], asOf), 1590 + 8800 + 5319);
    const posted = [
      tx({ id: "t-p", type: "transfer", amount: 8800, categoryId: "mortgage-p", countsAsExpense: true, recurringId: "r-p", date: "2026-08-01" }),
    ];
    assert.equal(monthlyHousingCost(posted, recurring, cats, [], asOf), 1590 + 8800 + 5319);
  });
  it("住房成本 does not double-count posted house spend without recurringId", () => {
    const asOf = "2026-08-29";
    const posted = [
      tx({ id: "t-p", type: "transfer", amount: 8800, categoryId: "mortgage-p", countsAsExpense: true, date: "2026-08-01" }),
      tx({ id: "t-i", type: "expense", amount: 5319, categoryId: "mortgage-i", date: "2026-08-01" }),
      tx({ id: "t-m", type: "expense", amount: 1590, categoryId: "mgmt", date: "2026-08-01" }),
    ];
    assert.equal(monthlyHousingCost(posted, recurring, cats, [], asOf), 1590 + 8800 + 5319);
    const lines = housingMonthLines(posted, recurring, cats, [], asOf);
    assert.equal(lines.length, 3);
    assert.equal(
      lines.reduce((s, r) => s + r.amount, 0),
      1590 + 8800 + 5319,
    );
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
    const mergedTx = periodCategoryTxs(txs, cats, "2026-08-01", "2026-08-31", "expense", true, "p-food");
    assert.equal(mergedTx.length, 2);
    assert.deepEqual(
      mergedTx.map((x) => x.id).sort(),
      ["a", "b"],
    );
    const dining = periodCategoryTxs(txs, cats, "2026-08-01", "2026-08-31", "expense", false, "dining");
    assert.equal(dining.length, 1);
    assert.equal(dining[0].id, "a");
    const incomeBoth = periodCategoryTxs(txs, cats, "2026-08-01", "2026-08-31", "income", false, "dining");
    assert.equal(incomeBoth.length, 1);
    assert.equal(incomeBoth[0].id, "c");
    const outOfRange = periodCategoryTxs(txs, cats, "2026-07-01", "2026-07-31", "expense", true, "p-food");
    assert.equal(outOfRange.length, 0);
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
