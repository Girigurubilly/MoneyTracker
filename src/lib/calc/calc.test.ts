import assert from "node:assert/strict";
import { test } from "node:test";
import { cashflowSide, applyDeltas, balanceDeltas } from "./ledger.ts";
import { toHkd, parseFrankfurter, parseEurCross, mergeRates } from "./fx.ts";
import { monthlyPayment, remainingInterest, effectiveRate, amortize, monthsUntil, endMonthFromRemaining, nextPaymentIso, remainingPayments, paymentDayOf } from "./mortgage.ts";
import { tripProgress, travelSpendYtd, tripCashSpent, isTripActive, isTripExpired } from "./trips.ts";
import { monthFlow, spentInMonth, dailySpendable, budgetActuals, reservedRegulars, projectedNonRegular, livingEssentials, upcomingExpenseRegulars, forecastTone, plannedAdhocSpend, isExpenseRegular, realizedNonRegularSpend, adhocTotal } from "./budget.ts";
import { runRetirement, savingsLast12Months } from "./retirement.ts";
import { MONTH_TOTAL_BUDGET_ID } from "../types.ts";
import type { Account, AdhocBudget, FxRate, Recurring, Transaction } from "../types.ts";

const rates: FxRate[] = [
  { currency: "HKD", perHkd: 1, asOf: "2026-08-23", source: "Base" },
  { currency: "USD", perHkd: 7.8, asOf: "2026-08-23", source: "Test" },
];

test("transfers are excluded from income and spending", () => {
  const txs: Transaction[] = [
    { id: "1", type: "income", amount: 100, currency: "HKD", accountId: "a", date: "2026-08-01", payee: "s", payeeZh: "s" },
    { id: "2", type: "expense", amount: 40, currency: "HKD", accountId: "a", date: "2026-08-02", payee: "e", payeeZh: "e" },
    { id: "3", type: "transfer", amount: 25, currency: "HKD", accountId: "a", toAccountId: "b", date: "2026-08-03", payee: "t", payeeZh: "t" },
  ];
  assert.equal(cashflowSide(txs[2]), "none");
  const flow = monthFlow(txs, "2026-08", rates);
  assert.equal(flow.income, 100);
  assert.equal(flow.expense, 40);
  assert.equal(flow.net, 60);
});

test("FX conversion uses stored or table rate", () => {
  assert.equal(toHkd(10, "USD", rates), 78);
  assert.equal(toHkd(10, "USD", rates, 8), 80);
  assert.equal(toHkd(50, "HKD", rates), 50);
});

test("transfer updates both accounts and expense does not count twice", () => {
  const accounts: Account[] = [
    { id: "a", name: "A", nameZh: "A", type: "current", currency: "HKD", balance: 1000, includeInNetWorth: true, group: "cash" },
    { id: "b", name: "B", nameZh: "B", type: "savings", currency: "HKD", balance: 0, includeInNetWorth: true, group: "cash" },
  ];
  const tx: Transaction = {
    id: "t",
    type: "transfer",
    amount: 200,
    currency: "HKD",
    accountId: "a",
    toAccountId: "b",
    date: "2026-08-01",
    payee: "move",
    payeeZh: "move",
  };
  const next = applyDeltas(accounts, balanceDeltas(tx));
  assert.equal(next[0].balance, 800);
  assert.equal(next[1].balance, 200);
});

test("P-rate mortgage amortisation and stress", () => {
  const rate = effectiveRate({ rateType: "P", benchmark: 5.25, adjustment: -3.15, effectiveRate: 0 });
  assert.equal(rate, 2.1);
  const pay = monthlyPayment(1_000_000, 2.1, 240);
  assert.ok(pay > 5100 && pay < 5300);
  const interest = remainingInterest(1_000_000, 2.1, 240);
  assert.ok(interest > 200_000);
  const rows = amortize(1_000_000, 2.1, 240, 1);
  assert.equal(rows[0].open, 1_000_000);
  assert.ok(rows[0].interest < rows[0].principal);
});

test("trip required monthly and on-track status", () => {
  const p = tripProgress(
    {
      id: "x",
      name: "JP",
      nameZh: "JP",
      destinations: "Tokyo",
      destinationsZh: "東京",
      start: "2027-03-20",
      status: "planning",
      cashBudget: 45000,
      cashSaved: 18000,
      milesTarget: 80000,
      milesSaved: 40000,
      monthlyCash: 4000,
      monthlyMiles: 6000,
    },
    "2026-08-23",
  );
  assert.equal(p.monthsLeft, 7);
  assert.ok(Math.abs(p.requiredCashMonthly - 27000 / 7) < 0.01);
  assert.equal(p.cashStatus, "on-track");
});

test("travel spend does not double-count trip-linked travel categories", () => {
  const txs: Transaction[] = [
    { id: "1", type: "expense", amount: 1000, currency: "HKD", accountId: "a", categoryId: "flights", date: "2026-03-01", payee: "f", payeeZh: "f", tripId: "t1" },
    { id: "2", type: "expense", amount: 500, currency: "HKD", accountId: "a", categoryId: "dining", date: "2026-03-02", payee: "d", payeeZh: "d", tripId: "t1" },
  ];
  const ytd = travelSpendYtd(txs, 2026, new Set(["flights"]));
  assert.equal(ytd, 1500);
});

test("budget remaining and daily spendable", () => {
  const txs: Transaction[] = [
    { id: "1", type: "expense", amount: 200, currency: "HKD", accountId: "a", categoryId: "dining", date: "2026-08-02", payee: "x", payeeZh: "x" },
  ];
  const spent = spentInMonth(txs, "2026-08", rates, { categoryId: "dining" });
  assert.equal(spent, 200);
  const all = spentInMonth(txs, "2026-08", rates);
  assert.equal(all, 200);
  const d = dailySpendable(800, "2026-08-24");
  assert.equal(d.daysLeft, 8);
  assert.equal(d.daily, 100);
});

test("retirement depletes when spend is too high", () => {
  const result = runRetirement(
    {
      currentAge: 60,
      retireAge: 61,
      deathAge: 90,
      monthlyIncomeNow: 0,
      monthlySpendNow: 0,
      targetMonthly: 50000,
      preReturn: 0.02,
      postReturn: 0.02,
      inflation: 0.02,
      travelInRetirement: 0,
    },
    {
      investableNow: 200000,
      mortgageMonthly: 0,
      mortgagePayoffAge: 50,
      housingAfterPayoff: 0,
      allowances: [],
      oneOffs: [],
    },
  );
  assert.equal(result.depletes, true);
  assert.ok((result.depletionAge ?? 0) < 90);
  assert.equal(result.status, "at-risk");
});

test("retirement lasts with large corpus", () => {
  const result = runRetirement(
    {
      currentAge: 40,
      retireAge: 65,
      deathAge: 90,
      monthlyIncomeNow: 20000,
      monthlySpendNow: 10000,
      targetMonthly: 8000,
      preReturn: 0.05,
      postReturn: 0.04,
      inflation: 0.02,
      travelInRetirement: 0,
    },
    {
      investableNow: 3_000_000,
      mortgageMonthly: 0,
      mortgagePayoffAge: 40,
      housingAfterPayoff: 0,
      allowances: [],
      oneOffs: [],
    },
  );
  assert.equal(result.depletes, false);
  assert.ok(result.corpusAtRetire > 3_000_000);
});

test("unscoped monthly total counts all expenses; named envelope stays at 0", () => {
  const txs: Transaction[] = [
    {
      id: "1",
      type: "expense",
      amount: 50,
      currency: "HKD",
      accountId: "a",
      date: "2026-08-01",
      payee: "x",
      payeeZh: "x",
    },
  ];
  const rows = budgetActuals(
    [
      { id: MONTH_TOTAL_BUDGET_ID, label: "t", labelZh: "t", monthly: 100, spent: 0 },
      { id: "named", label: "Rainy", labelZh: "Rainy", monthly: 20, spent: 0 },
    ],
    txs,
    "2026-08",
    rates,
    [],
  );
  assert.equal(rows[0].spent, 50);
  assert.equal(rows[1].spent, 0);
});

const netflix: Recurring = {
  id: "r-netflix",
  type: "expense",
  label: "Netflix",
  labelZh: "Netflix",
  amount: 220,
  currency: "HKD",
  accountId: "a",
  frequency: "monthly",
  nextDate: "2026-08-15",
  chargedDay: 15,
};

test("remaining budget reserves regulars whose charged day has not arrived", () => {
  const txs: Transaction[] = [
    {
      id: "1",
      type: "expense",
      amount: 100,
      currency: "HKD",
      accountId: "a",
      date: "2026-08-02",
      payee: "Coffee",
      payeeZh: "咖啡",
    },
  ];
  const rows = budgetActuals(
    [{ id: MONTH_TOTAL_BUDGET_ID, label: "t", labelZh: "t", monthly: 1000, spent: 0 }],
    txs,
    "2026-08",
    rates,
    [],
    [netflix],
    "2026-08-10",
  );
  assert.equal(rows[0].spent, 100);
  assert.equal(rows[0].reserved, 220);
  assert.equal(rows[0].realized, 0);
  assert.equal(reservedRegulars([netflix], rates, "2026-08-10"), 220);
});

test("regulars are realized on or after the charged day even without a matching transaction", () => {
  const txs: Transaction[] = [
    {
      id: "1",
      type: "expense",
      amount: 50,
      currency: "HKD",
      accountId: "a",
      date: "2026-08-02",
      payee: "Coffee",
      payeeZh: "咖啡",
    },
  ];
  const onDay = budgetActuals(
    [{ id: MONTH_TOTAL_BUDGET_ID, label: "t", labelZh: "t", monthly: 1000, spent: 0 }],
    txs,
    "2026-08",
    rates,
    [],
    [netflix],
    "2026-08-15",
  );
  assert.equal(onDay[0].realized, 220);
  assert.equal(onDay[0].reserved, 0);

  const after = budgetActuals(
    [{ id: MONTH_TOTAL_BUDGET_ID, label: "t", labelZh: "t", monthly: 1000, spent: 0 }],
    txs,
    "2026-08",
    rates,
    [],
    [netflix],
    "2026-08-23",
  );
  assert.equal(after[0].realized, 220);
  assert.equal(after[0].reserved, 0);
});

test("projected non-regular uses (spent − realized) / day × remaining days", () => {
  const txs: Transaction[] = [
    {
      id: "1",
      type: "expense",
      amount: 230,
      currency: "HKD",
      accountId: "a",
      date: "2026-08-10",
      payee: "Coffee",
      payeeZh: "咖啡",
    },
  ];
  const rows = budgetActuals(
    [{ id: MONTH_TOTAL_BUDGET_ID, label: "t", labelZh: "t", monthly: 1000, spent: 0 }],
    txs,
    "2026-08",
    rates,
    [],
    [netflix],
    "2026-08-10",
  );
  // spent 230, realized 0, reserved 220, remainingDays 21 → projected (230/10)*21 = 483
  assert.equal(rows[0].spent, 230);
  assert.equal(rows[0].reserved, 220);
  assert.equal(rows[0].realized, 0);
  assert.equal(rows[0].projected, 483);
  assert.equal(rows[0].remaining, 1000 - 230 - 220);
  assert.equal(projectedNonRegular(230, 0, "2026-08-10"), 483);
  assert.equal(projectedNonRegular(230, 0, "2026-08-31"), 0);
});

test("upcoming expense regulars skip already-charged days and sort soonest first", () => {
  const rows: Recurring[] = [
    { ...netflix, id: "late", chargedDay: 20, nextDate: "2026-08-20", label: "Late" },
    { ...netflix, id: "soon", chargedDay: 12, nextDate: "2026-08-12", label: "Soon" },
    { ...netflix, id: "done", chargedDay: 5, nextDate: "2026-08-05", label: "Done" },
    { ...netflix, id: "pay", type: "income", chargedDay: 18, nextDate: "2026-08-18", label: "Pay" },
  ];
  const upcoming = upcomingExpenseRegulars(rows, "2026-08-10");
  assert.deepEqual(
    upcoming.map((r) => r.id),
    ["soon", "late"],
  );
});

test("forecast tone is green at cap, amber within 10% over, red beyond", () => {
  assert.equal(forecastTone(0.9), "income");
  assert.equal(forecastTone(1), "income");
  assert.equal(forecastTone(1.1), "watch");
  assert.equal(forecastTone(1.11), "expense");
});

test("living essentials only count regulars marked living", () => {
  assert.equal(livingEssentials([netflix]), 0);
  assert.equal(livingEssentials([{ ...netflix, living: true }]), 220);
});

test("mortgage end month and remaining months stay in sync", () => {
  const from = new Date(2026, 7, 1);
  assert.equal(monthsUntil("2044-08", from), 216);
  assert.equal(endMonthFromRemaining(216, from), "2044-08");
});

test("mortgage remaining includes this month when the charged day has not arrived", () => {
  assert.equal(paymentDayOf("2044-08-28"), 28);
  assert.equal(nextPaymentIso(1, "2026-08-24"), "2026-09-01");
  assert.equal(nextPaymentIso(28, "2026-08-24"), "2026-08-28");
  assert.equal(remainingPayments("2044-08-01", "2026-08-24", 1), 216);
  assert.equal(remainingPayments("2044-08-28", "2026-08-24", 28), 217);
  const rows = amortize(1000, 0, 3, 3, 100, "2026-08-28");
  assert.equal(rows[0]?.due, "2026-08-28");
  assert.equal(rows[1]?.due, "2026-09-28");
});

test("trip spend and active window", () => {
  const trip = {
    id: "t1",
    name: "JP",
    nameZh: "JP",
    destinations: "Tokyo",
    destinationsZh: "東京",
    start: "2026-11-01",
    end: "2026-11-10",
    status: "planning" as const,
    cashBudget: 10000,
    cashSaved: 0,
    milesTarget: 0,
    milesSaved: 0,
    monthlyCash: 0,
    monthlyMiles: 0,
  };
  assert.equal(isTripActive(trip, "2026-08-24"), true);
  assert.equal(isTripActive({ ...trip, status: "cancelled" }, "2026-08-24"), false);
  assert.equal(isTripActive({ ...trip, end: "2026-08-01" }, "2026-08-24"), true);
  assert.equal(isTripExpired({ ...trip, end: "2026-08-01" }, "2026-08-24"), false);
  assert.equal(isTripExpired({ ...trip, end: "2025-07-01" }, "2026-08-24"), true);
  assert.equal(isTripExpired({ ...trip, status: "cancelled" }, "2026-08-24"), true);
  assert.equal(isTripActive({ ...trip, end: "2025-08-01" }, "2026-08-24"), false);
  const txs: Transaction[] = [
    { id: "1", type: "expense", amount: 3000, currency: "HKD", accountId: "a", date: "2026-08-02", payee: "x", payeeZh: "x", tripId: "t1" },
    { id: "2", type: "expense", amount: 500, currency: "USD", accountId: "a", date: "2026-08-03", payee: "y", payeeZh: "y", tripId: "t1" },
    { id: "3", type: "income", amount: 100, currency: "HKD", accountId: "a", date: "2026-08-04", payee: "z", payeeZh: "z", tripId: "t1" },
  ];
  assert.equal(tripCashSpent(txs, rates, "t1"), 3000 + 500 * 7.8);
  const p = tripProgress(trip, "2026-08-24", 4000);
  assert.equal(p.spent, 4000);
  assert.equal(p.usedRatio, 0.4);
});

test("last 12 months saving averages income minus expense", () => {
  const txs: Transaction[] = [
    { id: "1", type: "income", amount: 12000, currency: "HKD", accountId: "a", date: "2026-08-01", payee: "s", payeeZh: "s" },
    { id: "2", type: "expense", amount: 3000, currency: "HKD", accountId: "a", date: "2026-07-15", payee: "e", payeeZh: "e" },
    { id: "3", type: "expense", amount: 1000, currency: "HKD", accountId: "a", date: "2025-08-02", payee: "old", payeeZh: "old" },
  ];
  const s = savingsLast12Months(txs, rates, "2026-08-24");
  assert.equal(s.income, 12000);
  assert.equal(s.expense, 3000);
  assert.equal(s.monthly, (12000 - 3000) / 12);
});

test("planned transactions do not change balances or cashflow", () => {
  const accounts: Account[] = [
    { id: "a", name: "A", nameZh: "A", type: "current", currency: "HKD", balance: 1000, includeInNetWorth: true, group: "cash" },
  ];
  const tx: Transaction = {
    id: "p",
    type: "expense",
    amount: 200,
    currency: "HKD",
    accountId: "a",
    date: "2026-09-01",
    payee: "future",
    payeeZh: "未來",
    planned: true,
  };
  assert.equal(cashflowSide(tx), "none");
  assert.deepEqual(balanceDeltas(tx), []);
  const next = applyDeltas(accounts, balanceDeltas(tx));
  assert.equal(next[0].balance, 1000);
  const posted = applyDeltas(accounts, balanceDeltas({ ...tx, planned: false }));
  assert.equal(posted[0].balance, 800);
});

test("travel YTD converts foreign currency and skips planned", () => {
  const txs: Transaction[] = [
    { id: "1", type: "expense", amount: 100, currency: "USD", accountId: "a", categoryId: "flights", date: "2026-03-01", payee: "f", payeeZh: "f" },
    { id: "2", type: "expense", amount: 50, currency: "USD", accountId: "a", categoryId: "flights", date: "2026-03-02", payee: "p", payeeZh: "p", planned: true },
    { id: "3", type: "expense", amount: 20, currency: "HKD", accountId: "a", date: "2026-03-03", payee: "t", payeeZh: "t", tripId: "t1" },
  ];
  assert.equal(travelSpendYtd(txs, 2026, new Set(["flights"]), rates), 100 * 7.8 + 20);
});

test("annuity with end age stops after that age", () => {
  const inputs = {
    currentAge: 64,
    retireAge: 65,
    deathAge: 90,
    monthlyIncomeNow: 0,
    monthlySpendNow: 0,
    targetMonthly: 10000,
    preReturn: 0.02,
    postReturn: 0.02,
    inflation: 0.02,
    travelInRetirement: 0,
  };
  const ctx = {
    investableNow: 2_000_000,
    mortgageMonthly: 0,
    mortgagePayoffAge: 50,
    housingAfterPayoff: 0,
    oneOffs: [],
  };
  const limited = runRetirement(inputs, {
    ...ctx,
    allowances: [
      { id: "ann", label: "A", labelZh: "A", monthly: 5000, startAge: 65, endAge: 70, inflationAdjusted: false, kind: "annuity" },
    ],
  });
  const lifetime = runRetirement(inputs, {
    ...ctx,
    allowances: [
      { id: "ann", label: "A", labelZh: "A", monthly: 5000, startAge: 65, inflationAdjusted: false, kind: "annuity" },
    ],
  });
  assert.ok(lifetime.requiredCorpus < limited.requiredCorpus);
});

test("FX from-HKD quotes invert to HKD per unit", () => {
  const rows = parseFrankfurter({ date: "2026-08-26", rates: { USD: 0.1282 } });
  const usd = rows.find((r) => r.currency === "USD");
  assert.ok(usd && Math.abs(usd.perHkd - 1 / 0.1282) < 1e-9);
  const cross = parseEurCross({ date: "2026-08-26", rates: { HKD: 9.16, USD: 1.17 } });
  const usd2 = cross.find((r) => r.currency === "USD");
  assert.ok(usd2 && Math.abs(usd2.perHkd - 9.16 / 1.17) < 1e-9);
  const merged = mergeRates(
    [{ currency: "TWD", perHkd: 0.244, asOf: "2026-01-01", source: "old" }],
    rows,
  );
  assert.equal(merged.find((r) => r.currency === "TWD")?.perHkd, 0.244);
});

test("posted mortgage principal transfer counts as spend; ordinary transfer does not", () => {
  const ordinary: Transaction = {
    id: "t",
    type: "transfer",
    amount: 25,
    currency: "HKD",
    accountId: "a",
    toAccountId: "b",
    date: "2026-08-03",
    payee: "move",
    payeeZh: "轉帳",
  };
  const principal: Transaction = {
    id: "p",
    type: "transfer",
    amount: 9600,
    currency: "HKD",
    accountId: "a",
    toAccountId: "m",
    destAmount: 9600,
    categoryId: "mortgage-p",
    date: "2026-08-01",
    payee: "Mortgage principal",
    payeeZh: "按揭本金",
    countsAsExpense: true,
  };
  const interest: Transaction = {
    id: "i",
    type: "expense",
    amount: 4980,
    currency: "HKD",
    accountId: "a",
    categoryId: "mortgage-i",
    date: "2026-08-01",
    payee: "Mortgage interest",
    payeeZh: "按揭利息",
  };
  assert.equal(cashflowSide(ordinary), "none");
  assert.equal(cashflowSide(principal), "expense");
  assert.equal(cashflowSide(interest), "expense");
  const flow = monthFlow([ordinary, principal, interest], "2026-08", rates);
  assert.equal(flow.expense, 14580);
  assert.equal(spentInMonth([ordinary, principal, interest], "2026-08", rates), 14580);
  const accounts: Account[] = [
    { id: "a", name: "A", nameZh: "A", type: "current", currency: "HKD", balance: 20000, includeInNetWorth: true, group: "cash" },
    { id: "m", name: "M", nameZh: "M", type: "mortgage", currency: "HKD", balance: -500000, includeInNetWorth: true, group: "housing" },
  ];
  const next = applyDeltas(accounts, balanceDeltas(principal));
  assert.equal(next[0].balance, 10400);
  assert.equal(next[1].balance, -490400);
});

test("planned principal transfer does not hit cashflow; the regular still reserves remaining", () => {
  const planned: Transaction = {
    id: "p",
    type: "transfer",
    amount: 9600,
    currency: "HKD",
    accountId: "a",
    toAccountId: "m",
    destAmount: 9600,
    date: "2026-08-20",
    payee: "Mortgage principal",
    payeeZh: "按揭本金",
    planned: true,
    countsAsExpense: true,
    recurringId: "r-p",
  };
  assert.equal(cashflowSide(planned), "none");
  assert.deepEqual(balanceDeltas(planned), []);
  const flow = monthFlow([planned], "2026-08", rates);
  assert.equal(flow.expense, 0);
  const regular: Recurring = {
    id: "r-p",
    type: "transfer",
    label: "Principal",
    labelZh: "本金",
    amount: 9600,
    currency: "HKD",
    accountId: "a",
    toAccountId: "m",
    categoryId: "mortgage-p",
    frequency: "monthly",
    nextDate: "2026-08-20",
    chargedDay: 20,
    countsAsExpense: true,
  };
  assert.equal(isExpenseRegular(regular), true);
  assert.equal(reservedRegulars([regular], rates, "2026-08-10"), 9600);
  assert.equal(reservedRegulars([regular], rates, "2026-08-20"), 0);
  const upcoming = upcomingExpenseRegulars([regular], "2026-08-10");
  assert.equal(upcoming[0]?.id, "r-p");
  const travelFund: Recurring = {
    ...regular,
    id: "r-t",
    countsAsExpense: false,
    label: "Travel fund",
  };
  assert.equal(isExpenseRegular(travelFund), false);
  assert.equal(reservedRegulars([travelFund], rates, "2026-08-10"), 0);
});

test("planned ad-hoc principal transfer is reserved as this-month spend", () => {
  const tx: Transaction = {
    id: "p",
    type: "transfer",
    amount: 5000,
    currency: "HKD",
    accountId: "a",
    toAccountId: "m",
    date: "2026-08-25",
    payee: "Principal",
    payeeZh: "本金",
    planned: true,
    countsAsExpense: true,
  };
  assert.equal(plannedAdhocSpend([tx], "2026-08", rates), 5000);
  const ordinary: Transaction = { ...tx, id: "o", countsAsExpense: false };
  assert.equal(plannedAdhocSpend([ordinary], "2026-08", rates), 0);
});

test("this-month-only holds are not cashflow; remaining subtracts the full hold", () => {
  const txs: Transaction[] = [
    {
      id: "1",
      type: "expense",
      amount: 3000,
      currency: "HKD",
      accountId: "a",
      date: "2026-08-05",
      payee: "x",
      payeeZh: "x",
    },
  ];
  const regulars: Recurring[] = [
    { ...netflix, id: "r1", amount: 1000, chargedDay: 5, nextDate: "2026-08-05" },
    { ...netflix, id: "r2", amount: 2000, chargedDay: 25, nextDate: "2026-08-25" },
  ];
  const adhoc: AdhocBudget[] = [
    { id: "a1", label: "Gift", labelZh: "禮物", amount: 500, currency: "HKD", month: "2026-08", date: "2026-08-10" },
    { id: "a2", label: "Trip", labelZh: "旅行", amount: 800, currency: "HKD", month: "2026-08", date: "2026-08-28" },
  ];
  assert.equal(monthFlow(txs, "2026-08", rates).expense, 3000);
  assert.equal(adhocTotal(adhoc, "2026-08", rates), 1300);
  const rows = budgetActuals(
    [{ id: MONTH_TOTAL_BUDGET_ID, label: "t", labelZh: "t", monthly: 10000, spent: 0 }],
    txs,
    "2026-08",
    rates,
    [],
    regulars,
    "2026-08-15",
    adhoc,
  );
  const b = rows[0];
  assert.equal(b.spent, 3000);
  assert.equal(b.realized, 1000);
  assert.equal(b.reserved, 2000);
  assert.equal(b.adhoc, 1300);
  assert.equal(b.remaining, 10000 - 3000 - 2000 - 1300);
  assert.equal(realizedNonRegularSpend(3000, 1000), 2000);
  assert.equal(b.projected, projectedNonRegular(3000, 1000, "2026-08-15"));
  assert.equal(b.expected, 2000 + 3000 + 1300);
  const later = budgetActuals(
    [{ id: MONTH_TOTAL_BUDGET_ID, label: "t", labelZh: "t", monthly: 10000, spent: 0 }],
    txs,
    "2026-08",
    rates,
    [],
    regulars,
    "2026-08-28",
    adhoc,
  );
  assert.equal(later[0].remaining, 10000 - 3000 - 0 - 1300);
  assert.equal(later[0].reserved, 0);
  assert.equal(later[0].adhoc, 1300);
});

