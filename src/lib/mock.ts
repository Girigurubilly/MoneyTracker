import type {
  Account,
  AdhocBudget,
  Allowance,
  Budget,
  Category,
  FxRate,
  Goal,
  Holding,
  Mortgage,
  OneOff,
  PromoSaving,
  Recurring,
  TimeSaving,
  Transaction,
  Trip,
  WishItem,
  YearlyPlan,
} from "./types";
import type { RetirementInputs } from "./calc/retirement";
import { MONTH_TOTAL_BUDGET_ID } from "./types";

export const accounts: Account[] = [
  { id: "bochk", name: "BOCHK payroll", nameZh: "中銀出糧戶口", type: "current", currency: "HKD", balance: 128400, includeInNetWorth: true, group: "cash", sortOrder: 0, institution: "BOCHK", ownership: "sole", balanceBasis: "available_ex_deposits" },
  { id: "hsb-save", name: "Hang Seng savings", nameZh: "恒生儲蓄", type: "savings", currency: "HKD", balance: 220000, includeInNetWorth: true, group: "cash", sortOrder: 1, institution: "Hang Seng", ownership: "sole", balanceBasis: "bank_total_incl_deposits" },
  { id: "cash-hkd", name: "Cash", nameZh: "現金", type: "cash", currency: "HKD", balance: 2400, includeInNetWorth: true, group: "cash", sortOrder: 2, ownership: "sole", balanceBasis: "available_ex_deposits" },
  { id: "yen-cash", name: "Yen", nameZh: "Yen", type: "fx", currency: "JPY", balance: 85000, includeInNetWorth: true, group: "cash", sortOrder: 2, ownership: "sole", balanceBasis: "available_ex_deposits" },
  { id: "octopus", name: "Octopus", nameZh: "八達通", type: "ewallet", currency: "HKD", balance: 186, includeInNetWorth: true, group: "cash", sortOrder: 3, ownership: "sole", balanceBasis: "available_ex_deposits" },
  { id: "hsbc-debit", name: "HSBC debit", nameZh: "匯豐扣帳卡", type: "debit", currency: "HKD", balance: 8200, includeInNetWorth: true, group: "cash", sortOrder: 4, institution: "HSBC", ownership: "sole", balanceBasis: "available_ex_deposits" },
  { id: "hsbc-visa", name: "HSBC Visa", nameZh: "匯豐 Visa", type: "credit", currency: "HKD", balance: -2846, includeInNetWorth: true, group: "credit", sortOrder: 0, institution: "HSBC", ownership: "sole", balanceBasis: "unverified" },
  { id: "mpf", name: "MPF", nameZh: "強積金", type: "mpf", currency: "HKD", balance: 980000, includeInNetWorth: true, group: "assets", sortOrder: 0, ownership: "sole", balanceBasis: "unverified" },
  { id: "broker", name: "Brokerage", nameZh: "證券戶口", type: "investment", currency: "HKD", balance: 640000, includeInNetWorth: true, group: "assets", sortOrder: 1, ownership: "sole", balanceBasis: "holdings_derived", holdingSync: true },
  { id: "tsuen-wan", name: "Tsuen Wan flat", nameZh: "荃灣單位", type: "property", currency: "HKD", balance: 6800000, includeInNetWorth: true, group: "housing", sortOrder: 0, ownership: "sole", balanceBasis: "unverified" },
  { id: "mortgage", name: "Mortgage", nameZh: "按揭", type: "mortgage", currency: "HKD", balance: -2858240, includeInNetWorth: true, group: "housing", sortOrder: 1, ownership: "sole", balanceBasis: "unverified" },
  { id: "asia-miles", name: "Asia Miles", nameZh: "亞洲萬里通", type: "miles", currency: "MILES", balance: 86200, includeInNetWorth: false, group: "loyalty", sortOrder: 0, ownership: "sole", balanceBasis: "unverified" },
];

export const categories: Category[] = [
  { id: "p-housing", name: "Housing", nameZh: "房屋", theme: "living", kind: "expense", icon: "home", essential: true, special: "housing" },
  { id: "mortgage-p", name: "Mortgage principal", nameZh: "按揭本金", theme: "living", kind: "expense", icon: "home", essential: true, parentId: "p-housing", fireSpendKind: "work", special: "mortgagePrincipal" },
  { id: "mortgage-i", name: "Mortgage interest", nameZh: "按揭利息", theme: "living", kind: "expense", icon: "home", essential: true, parentId: "p-housing", fireSpendKind: "work", special: "mortgageInterest" },
  { id: "mgmt", name: "Management fee", nameZh: "管理費", theme: "living", kind: "expense", icon: "building", essential: true, parentId: "p-housing", fireSpendKind: "core", special: "housing" },
  { id: "p-food", name: "Food", nameZh: "飲食", theme: "living", kind: "expense", icon: "utensils" },
  { id: "dining", name: "Dining out", nameZh: "外出就餐", theme: "living", kind: "expense", icon: "utensils", parentId: "p-food" },
  { id: "groceries", name: "Groceries", nameZh: "超市", theme: "living", kind: "expense", icon: "shopping", parentId: "p-food" },
  { id: "p-transit", name: "Transport", nameZh: "交通", theme: "living", kind: "expense", icon: "train" },
  { id: "mtr", name: "MTR / bus", nameZh: "港鐵 / 巴士", theme: "living", kind: "expense", icon: "train", parentId: "p-transit" },
  { id: "p-personal", name: "Personal", nameZh: "個人", theme: "living", kind: "expense", icon: "user" },
  { id: "internet", name: "Internet / mobile", nameZh: "寬頻 / 流動電話", theme: "living", kind: "expense", icon: "wifi", essential: true, parentId: "p-personal" },
  { id: "entertainment", name: "Entertainment", nameZh: "娛樂", theme: "living", kind: "expense", icon: "film", parentId: "p-personal" },
  { id: "education", name: "Education", nameZh: "教育", theme: "other", kind: "expense", icon: "graduation" },
  { id: "insurance", name: "Insurance", nameZh: "保險", theme: "living", kind: "expense", icon: "shield", essential: true, fireSpendKind: "core" },
  { id: "mpf-vol", name: "Voluntary MPF", nameZh: "自願性強積金", theme: "retirement", kind: "expense", icon: "piggy" },
  { id: "p-travel", name: "Travel", nameZh: "旅遊", theme: "travel", kind: "expense", icon: "plane" },
  { id: "flights", name: "Flights", nameZh: "機票", theme: "travel", kind: "expense", icon: "plane", parentId: "p-travel" },
  { id: "hotels", name: "Hotels", nameZh: "酒店", theme: "travel", kind: "expense", icon: "building", parentId: "p-travel" },
  { id: "souvenirs", name: "Souvenirs", nameZh: "手信", theme: "travel", kind: "expense", icon: "gift", parentId: "p-travel" },
  { id: "travel-meals", name: "Meals", nameZh: "旅途用餐", theme: "travel", kind: "expense", icon: "utensils", parentId: "p-travel" },
  { id: "p-income", name: "Income", nameZh: "收入", theme: "other", kind: "income", icon: "briefcase" },
  { id: "salary", name: "Salary", nameZh: "薪金", theme: "other", kind: "income", icon: "briefcase", parentId: "p-income" },
  { id: "interest-inc", name: "Interest income", nameZh: "利息收入", theme: "other", kind: "income", icon: "coins", parentId: "p-income" },
];

export const budgets: Budget[] = [
  { id: MONTH_TOTAL_BUDGET_ID, label: "Monthly total", labelZh: "本月總額", monthly: 40000, spent: 0 },
  { id: "b-dining", categoryId: "dining", label: "Dining out", labelZh: "外出就餐", monthly: 6000, spent: 0 },
  { id: "b-groc", categoryId: "groceries", label: "Groceries", labelZh: "超市", monthly: 4500, spent: 0 },
  { id: "b-mtr", categoryId: "mtr", label: "MTR / bus", labelZh: "港鐵 / 巴士", monthly: 800, spent: 0 },
  { id: "b-ent", categoryId: "entertainment", label: "Entertainment", labelZh: "娛樂", monthly: 1500, spent: 0 },
];

export const annualTravelBudget = 80000;

export const mortgage: Mortgage = {
  id: "m1",
  name: "Primary mortgage",
  nameZh: "自住按揭",
  accountId: "mortgage",
  original: 4200000,
  outstanding: 2858240,
  rate: 0.0375,
  pRate: 0.05,
  spread: -0.0125,
  remainingMonths: 216,
  paymentDay: 1,
  type: "p",
  livingMode: "own-mortgage",
  propertyAccountId: "tsuen-wan",
};

export const retirement: RetirementInputs = {
  currentAge: 40,
  retireAge: 65,
  deathAge: 90,
  monthlyIncomeNow: 72000,
  monthlySpendNow: 28000,
  targetMonthly: 25000,
  preReturn: 0.05,
  postReturn: 0.035,
  inflation: 0.025,
  travelInRetirement: 40000,
};

export const allowances: Allowance[] = [
  { id: "oaa", label: "Old Age Allowance", labelZh: "生果金", monthly: 1620, startAge: 70, kind: "oaa", inflationAdjusted: true },
];

export const oneOffs: OneOff[] = [];

export const goals: Goal[] = [
  { id: "nw", name: "Net worth", nameZh: "淨資產", current: 0, target: 8_000_000, currency: "HKD" },
];

export const wishlist: WishItem[] = [
  { id: "wish-airpods", name: "AirPods Pro", price: 1849, currency: "HKD", categoryId: "entertainment" },
  { id: "wish-kindle", name: "Kindle", price: 149, currency: "USD", categoryId: "entertainment" },
];

type Charge = {
  id: string;
  recurringId: string;
  day: number;
  type: Transaction["type"];
  amount: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  payee: string;
  payeeZh: string;
  countsAsExpense?: boolean;
  essential?: boolean;
  living?: boolean;
  variable?: boolean;
  splitWithId?: string;
};

const CHARGES: Charge[] = [
  { id: "salary", recurringId: "r-salary", day: 28, type: "income", amount: 72000, accountId: "bochk", categoryId: "salary", payee: "Employer", payeeZh: "公司薪金" },
  { id: "mpf", recurringId: "r-mpf", day: 28, type: "expense", amount: 3000, accountId: "bochk", categoryId: "mpf-vol", payee: "Voluntary MPF", payeeZh: "自願性強積金" },
  { id: "tfund", recurringId: "r-travel", day: 28, type: "transfer", amount: 3500, accountId: "bochk", toAccountId: "hsb-save", payee: "Travel fund", payeeZh: "旅遊儲蓄" },
  { id: "mgmt", recurringId: "r-mgmt", day: 1, type: "expense", amount: 2180, accountId: "bochk", categoryId: "mgmt", payee: "Management", payeeZh: "管理費", essential: true, living: true },
  { id: "mp", recurringId: "r-mortgage-p", day: 1, type: "transfer", amount: 9600, accountId: "bochk", toAccountId: "mortgage", categoryId: "mortgage-p", payee: "Mortgage principal", payeeZh: "按揭本金", countsAsExpense: true, essential: true, living: true, splitWithId: "r-mortgage-i" },
  { id: "mi", recurringId: "r-mortgage-i", day: 1, type: "expense", amount: 4980, accountId: "bochk", categoryId: "mortgage-i", payee: "Mortgage interest", payeeZh: "按揭利息", essential: true, living: true, splitWithId: "r-mortgage-p" },
  { id: "life", recurringId: "r-life", day: 5, type: "expense", amount: 1860, accountId: "hsbc-visa", categoryId: "insurance", payee: "Life insurance", payeeZh: "人壽保險", essential: true },
  { id: "mobile", recurringId: "r-mobile", day: 26, type: "expense", amount: 198, accountId: "hsbc-visa", categoryId: "internet", payee: "CSL mobile", payeeZh: "流動電話", essential: true, variable: true },
];

const RECURRING_LABELS: Record<string, { label: string; labelZh: string }> = {
  "r-salary": { label: "Salary", labelZh: "薪金" },
  "r-mpf": { label: "Voluntary MPF", labelZh: "自願性強積金" },
  "r-travel": { label: "Travel fund", labelZh: "旅遊儲蓄" },
  "r-mgmt": { label: "Management fee", labelZh: "管理費" },
  "r-mortgage-p": { label: "Mortgage principal", labelZh: "按揭本金" },
  "r-mortgage-i": { label: "Mortgage interest", labelZh: "按揭利息" },
  "r-life": { label: "Life insurance", labelZh: "人壽保險" },
  "r-mobile": { label: "Mobile plan", labelZh: "流動電話" },
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shift(now: Date, monthOffset: number, day: number): string {
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return iso(new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(1, day), last)));
}

function ym(now: Date, monthOffset: number): string {
  return shift(now, monthOffset, 1).slice(0, 7);
}

function addDays(now: Date, days: number): string {
  return iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.max(0, Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86_400_000));
}

function money2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Charge dates already reached. Future days this month stay on the regular schedule. */
function postedOn(now: Date, monthOffset: number, day: number): string | null {
  if (monthOffset > 0) return null;
  if (monthOffset === 0 && day > now.getDate()) return null;
  return shift(now, monthOffset, day);
}

function nextCharge(now: Date, day: number): string {
  if (day > now.getDate()) return shift(now, 0, day);
  return shift(now, 1, day);
}

function spend(partial: Omit<Transaction, "id"> & { id: string }): Transaction {
  return clean(partial);
}

function clean<T extends object>(row: T): T {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) as T;
}

export type SampleBook = {
  fxRates: FxRate[];
  recurring: Recurring[];
  trips: Trip[];
  netWorthSeries: { month: string; value: number }[];
  transactions: Transaction[];
  deposits: TimeSaving[];
  promoSavings: PromoSaving[];
  holdings: Holding[];
  yearlyPlans: YearlyPlan[];
  adhocBudgets: AdhocBudget[];
};

/** Demo ledger dated from the phone calendar, so a new user always sees this month and last month. */
export function buildSample(now = new Date()): SampleBook {
  const today = iso(now);
  const thisMonth = ym(now, 0);
  const lastMonth = ym(now, -1);
  const nextMonth = ym(now, 1);
  const year = now.getFullYear();

  const recurring: Recurring[] = CHARGES.map((c) => {
    const names = RECURRING_LABELS[c.recurringId];
    return clean({
      id: c.recurringId,
      type: c.type,
      label: names.label,
      labelZh: names.labelZh,
      amount: c.amount,
      currency: "HKD" as const,
      accountId: c.accountId,
      toAccountId: c.toAccountId,
      categoryId: c.categoryId,
      frequency: "monthly" as const,
      nextDate: nextCharge(now, c.day),
      chargedDay: c.day,
      essential: c.essential,
      living: c.living,
      variable: c.variable,
      countsAsExpense: c.countsAsExpense,
      splitWithId: c.splitWithId,
    });
  });

  const transactions: Transaction[] = [];
  const firstOffset = Math.min(-1, -now.getMonth());
  for (let offset = firstOffset; offset <= 0; offset++) {
    const month = ym(now, offset);
    for (const c of CHARGES) {
      const date = postedOn(now, offset, c.day);
      if (!date) continue;
      transactions.push(
        spend({
          id: `tx-${c.id}-${month}`,
          type: c.type,
          amount: c.amount,
          currency: "HKD",
          accountId: c.accountId,
          toAccountId: c.toAccountId,
          destAmount: c.toAccountId ? c.amount : undefined,
          categoryId: c.categoryId,
          date,
          payee: c.payee,
          payeeZh: c.payeeZh,
          countsAsExpense: c.countsAsExpense,
          recurringId: c.recurringId,
        }),
      );
    }
    if (offset < -1) {
      transactions.push(
        spend({ id: `tx-groc-${month}`, type: "expense", amount: 480, currency: "HKD", accountId: "hsbc-visa", categoryId: "groceries", date: shift(now, offset, 12), payee: "Wellcome", payeeZh: "惠康" }),
        spend({ id: `tx-dine-${month}`, type: "expense", amount: 220, currency: "HKD", accountId: "octopus", categoryId: "dining", date: shift(now, offset, 18), payee: "Cafe", payeeZh: "茶餐廳" }),
        spend({ id: `tx-mtr-${month}`, type: "expense", amount: 42.8, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: shift(now, offset, 9), payee: "MTR", payeeZh: "港鐵" }),
      );
    }
  }

  const macauStart = addDays(now, -1);
  const macauEnd = addDays(now, 2);
  const taipeiStart = shift(now, -1, 12);
  const taipeiEnd = shift(now, -1, 16);
  const fukuokaStart = addDays(now, 48);
  const fukuokaEnd = addDays(now, 54);
  const japanStart = addDays(now, 130);
  const japanEnd = addDays(now, 138);
  const osakaStart = shift(now, -12, 8);
  const osakaEnd = shift(now, -12, 12);

  const trips: Trip[] = [
    { id: "trip-macau", name: "Macau weekend", nameZh: "澳門週末", destination: "澳門", start: macauStart, end: macauEnd, status: "booked", cashBudget: 3500, cashSaved: 1500, milesTarget: 0, milesSaved: 0, monthlyCash: 0 },
    { id: "trip-taipei", name: "Taipei", nameZh: "台北", destination: "台北", start: taipeiStart, end: taipeiEnd, status: "completed", cashBudget: 12000, cashSaved: 12000, milesTarget: 25000, milesSaved: 15000, monthlyCash: 0 },
    { id: "trip-fukuoka", name: "Fukuoka", nameZh: "福岡", destination: "福岡", start: fukuokaStart, end: fukuokaEnd, status: "planning", cashBudget: 20000, cashSaved: 6000, milesTarget: 40000, milesSaved: 12000, monthlyCash: 2000 },
    { id: "trip-japan", name: "Japan", nameZh: "日本", destination: "東京", start: japanStart, end: japanEnd, status: "planning", cashBudget: 28000, cashSaved: 9000, milesTarget: 80000, milesSaved: 20000, monthlyCash: 3500 },
    { id: "trip-osaka", name: "Osaka", nameZh: "大阪", destination: "大阪", start: osakaStart, end: osakaEnd, status: "completed", cashBudget: 18000, cashSaved: 18000, milesTarget: 0, milesSaved: 0, monthlyCash: 0 },
  ];

  const cinemaDay = postedOn(now, 0, 8) ?? today;
  const familyDay = shift(now, -1, 20);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const birthdayDay = now.getDate() < lastDay ? shift(now, 0, Math.min(lastDay, now.getDate() + 3)) : null;
  const adhocBudgets: AdhocBudget[] = [
    { id: "adhoc-cinema", label: "Cinema", labelZh: "戲院", amount: 145, currency: "HKD", month: thisMonth, date: cinemaDay, paidOn: cinemaDay, categoryId: "entertainment", accountId: "hsbc-visa" },
    { id: "adhoc-family", label: "Family dinner", labelZh: "家庭聚餐", amount: 860, currency: "HKD", month: lastMonth, date: familyDay, paidOn: familyDay, categoryId: "dining", accountId: "hsbc-visa" },
    { id: "adhoc-dimsum", label: "Weekend dim sum", labelZh: "週末飲茶", amount: 420, currency: "HKD", month: nextMonth, date: shift(now, 1, 8), categoryId: "dining", accountId: "octopus" },
  ];
  if (birthdayDay && birthdayDay > today) {
    adhocBudgets.push({ id: "adhoc-birthday", label: "Birthday dinner", labelZh: "生日飯", amount: 680, currency: "HKD", month: thisMonth, date: birthdayDay, categoryId: "dining", accountId: "hsbc-visa" });
  }

  transactions.push(
    spend({ id: "tx-lunch-today", type: "expense", amount: 78, currency: "HKD", accountId: "octopus", categoryId: "dining", date: today, payee: "Cafe", payeeZh: "茶餐廳" }),
    spend({ id: "tx-coffee", type: "expense", amount: 48, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: postedOn(now, 0, 6) ?? today, payee: "Starbucks", payeeZh: "星巴克" }),
    spend({ id: "tx-groc-now", type: "expense", amount: 486, currency: "HKD", accountId: "hsbc-visa", categoryId: "groceries", date: postedOn(now, 0, 3) ?? today, payee: "Wellcome", payeeZh: "惠康" }),
    spend({ id: "tx-groc-debit", type: "expense", amount: 210, currency: "HKD", accountId: "hsbc-debit", categoryId: "groceries", date: postedOn(now, 0, 15) ?? today, payee: "ParknShop", payeeZh: "百佳" }),
    spend({ id: "tx-mtr-a", type: "expense", amount: 15.5, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: postedOn(now, 0, 2) ?? today, payee: "MTR", payeeZh: "港鐵" }),
    spend({ id: "tx-mtr-b", type: "expense", amount: 22.4, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: postedOn(now, 0, 11) ?? today, payee: "MTR", payeeZh: "港鐵" }),
    spend({ id: "tx-mtr-c", type: "expense", amount: 18.2, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: postedOn(now, 0, 19) ?? today, payee: "MTR", payeeZh: "港鐵" }),
    spend({ id: "tx-cinema", type: "expense", amount: 145, currency: "HKD", accountId: "hsbc-visa", categoryId: "entertainment", date: cinemaDay, payee: "Cinema", payeeZh: "戲院", adhoc: true }),
    spend({ id: "tx-ferry", type: "expense", amount: 340, currency: "HKD", accountId: "hsbc-visa", categoryId: "flights", date: macauStart, payee: "TurboJET", payeeZh: "噴射飛航", tripId: "trip-macau" }),
    spend({ id: "tx-macau-meal", type: "expense", amount: 220, currency: "HKD", accountId: "cash-hkd", categoryId: "travel-meals", date: today, payee: "Macau lunch", payeeZh: "澳門午餐", tripId: "trip-macau" }),
    spend({ id: "tx-fukuoka-air", type: "expense", amount: 2480, currency: "HKD", accountId: "bochk", categoryId: "flights", date: postedOn(now, 0, 4) ?? today, payee: "Air travel", payeeZh: "福岡機票訂金", tripId: "trip-fukuoka" }),
    spend({ id: "tx-octo", type: "transfer", amount: 500, currency: "HKD", accountId: "bochk", toAccountId: "octopus", destAmount: 500, date: postedOn(now, 0, 2) ?? today, payee: "Octopus top-up", payeeZh: "八達通增值" }),
    spend({ id: "tx-visa-pay", type: "transfer", amount: 3200, currency: "HKD", accountId: "bochk", toAccountId: "hsbc-visa", destAmount: 3200, date: postedOn(now, 0, 10) ?? today, payee: "Visa payment", payeeZh: "Visa 還款" }),
    spend({ id: "tx-miles", type: "miles", amount: 2400, currency: "MILES", accountId: "asia-miles", date: postedOn(now, 0, 4) ?? today, payee: "Flight earn", payeeZh: "飛行里數", milesType: "earn", tripId: "trip-fukuoka" }),
    spend({ id: "tx-groc-last-1", type: "expense", amount: 420, currency: "HKD", accountId: "hsbc-visa", categoryId: "groceries", date: shift(now, -1, 4), payee: "Wellcome", payeeZh: "惠康" }),
    spend({ id: "tx-groc-last-2", type: "expense", amount: 380, currency: "HKD", accountId: "hsbc-debit", categoryId: "groceries", date: shift(now, -1, 16), payee: "ParknShop", payeeZh: "百佳" }),
    spend({ id: "tx-groc-last-3", type: "expense", amount: 156, currency: "HKD", accountId: "cash-hkd", categoryId: "groceries", date: shift(now, -1, 24), payee: "Market", payeeZh: "街市" }),
    spend({ id: "tx-dine-last-1", type: "expense", amount: 92, currency: "HKD", accountId: "octopus", categoryId: "dining", date: shift(now, -1, 6), payee: "Cafe", payeeZh: "茶餐廳" }),
    spend({ id: "tx-dine-last-2", type: "expense", amount: 48, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: shift(now, -1, 9), payee: "Starbucks", payeeZh: "星巴克" }),
    spend({ id: "tx-dine-last-3", type: "expense", amount: 186, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: shift(now, -1, 22), payee: "Dinner", payeeZh: "晚飯" }),
    spend({ id: "tx-family", type: "expense", amount: 860, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: familyDay, payee: "Family dinner", payeeZh: "家庭聚餐", adhoc: true }),
    spend({ id: "tx-mtr-last-1", type: "expense", amount: 16.8, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: shift(now, -1, 3), payee: "MTR", payeeZh: "港鐵" }),
    spend({ id: "tx-mtr-last-2", type: "expense", amount: 24.6, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: shift(now, -1, 11), payee: "MTR", payeeZh: "港鐵" }),
    spend({ id: "tx-mtr-last-3", type: "expense", amount: 19.4, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: shift(now, -1, 19), payee: "Bus", payeeZh: "巴士" }),
    spend({ id: "tx-ent-last", type: "expense", amount: 180, currency: "HKD", accountId: "hsbc-visa", categoryId: "entertainment", date: shift(now, -1, 8), payee: "Cinema", payeeZh: "戲院" }),
    spend({ id: "tx-tpe-air", type: "expense", amount: 3180, currency: "HKD", accountId: "bochk", categoryId: "flights", date: shift(now, -1, 2), payee: "Air travel", payeeZh: "台北機票", tripId: "trip-taipei" }),
    spend({ id: "tx-tpe-hotel", type: "expense", amount: 2100, currency: "HKD", accountId: "hsbc-visa", categoryId: "hotels", date: taipeiStart, payee: "Taipei hotel", payeeZh: "台北酒店", tripId: "trip-taipei" }),
    spend({ id: "tx-tpe-meal", type: "expense", amount: 486, currency: "HKD", accountId: "cash-hkd", categoryId: "travel-meals", date: shift(now, -1, 14), payee: "Taipei meals", payeeZh: "台北用餐", tripId: "trip-taipei" }),
    spend({ id: "tx-tpe-gift", type: "expense", amount: 12800, currency: "JPY", accountId: "yen-cash", categoryId: "souvenirs", date: shift(now, -1, 15), payee: "Souvenirs", payeeZh: "手信", tripId: "trip-taipei" }),
    spend({ id: "tx-ly-salary", type: "income", amount: 68000, currency: "HKD", accountId: "bochk", categoryId: "salary", date: shift(now, -12, 28), payee: "Employer", payeeZh: "公司薪金" }),
    spend({ id: "tx-ly-dine", type: "expense", amount: 6800, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: shift(now, -12, 18), payee: "Dining last year", payeeZh: "去年外出就餐" }),
    spend({ id: "tx-ly-groc", type: "expense", amount: 3900, currency: "HKD", accountId: "hsbc-visa", categoryId: "groceries", date: shift(now, -12, 12), payee: "Groceries last year", payeeZh: "去年超市" }),
    spend({ id: "tx-ly-mtr", type: "expense", amount: 620, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: shift(now, -12, 20), payee: "MTR last year", payeeZh: "去年港鐵" }),
    spend({ id: "tx-ly-ins", type: "expense", amount: 1860, currency: "HKD", accountId: "hsbc-visa", categoryId: "insurance", date: shift(now, -12, 5), payee: "Life insurance", payeeZh: "人壽保險" }),
    spend({ id: "tx-ly-air", type: "expense", amount: 8600, currency: "HKD", accountId: "hsbc-visa", categoryId: "flights", date: osakaStart, payee: "Osaka flight", payeeZh: "大阪機票", tripId: "trip-osaka" }),
  );

  const depositStart = shift(now, -9, 15);
  const depositEnd = shift(now, 3, 15);
  const depositInterest = money2(200000 * 0.038 * (daysBetween(depositStart, depositEnd) / 365));
  const deposits: TimeSaving[] = [
    {
      id: "dep-hsb",
      bank: "Hang Seng",
      startDate: depositStart,
      endDate: depositEnd,
      rate: 3.8,
      currency: "HKD",
      amount: 200000,
      interest: depositInterest,
      accountId: "hsb-save",
    },
  ];
  transactions.push(
    spend({
      id: "tx-dep-hsb",
      type: "income",
      amount: depositInterest,
      currency: "HKD",
      accountId: "hsb-save",
      categoryId: "interest-inc",
      date: depositEnd,
      payee: "Hang Seng deposit interest",
      payeeZh: "恒生 存款利息",
      planned: true,
      depositId: "dep-hsb",
    }),
  );

  const promoSavings: PromoSaving[] = [
    {
      id: "promo-marathon",
      accountId: "hsb-save",
      residualHkd: 20000,
      rateSchedule: [
        { from: `${year}-01-01`, to: `${year}-06-30`, rate: 4.5 },
        { from: `${year}-07-01`, to: `${year}-12-31`, rate: 1.5 },
      ],
      arrangementEnd: `${year}-12-31`,
      accessibility: "restricted",
      distinctFromTd: true,
      name: "Marathon savings",
      nameZh: "馬拉松儲蓄",
    },
  ];

  const holdings: Holding[] = [
    {
      id: "hold-tracker",
      symbol: "2800",
      name: "Tracker Fund",
      market: "hk",
      source: "manual",
      quantity: 3200,
      currency: "HKD",
      lastPrice: 200,
      avgCost: 180,
      lastPriceAt: today,
      accountId: "broker",
    },
  ];

  const yearlyPlans: YearlyPlan[] = Array.from({ length: 12 }, (_, mo) => ({
    id: `${year}-${pad(mo + 1)}`,
    salary: 72000,
    other: 0,
    expense: mo === 5 || mo === 11 ? 48000 : 38000,
  }));

  const fxRates: FxRate[] = [
    { currency: "HKD", perHkd: 1, asOf: today, source: "Base" },
    { currency: "USD", perHkd: 7.82, asOf: today, source: "Indicative" },
    { currency: "JPY", perHkd: 0.0531, asOf: today, source: "Indicative" },
    { currency: "CNY", perHkd: 1.088, asOf: today, source: "Indicative" },
    { currency: "TWD", perHkd: 0.244, asOf: today, source: "Indicative" },
    { currency: "THB", perHkd: 0.241, asOf: today, source: "Indicative" },
    { currency: "GBP", perHkd: 10.12, asOf: today, source: "Indicative" },
    { currency: "EUR", perHkd: 9.16, asOf: today, source: "Indicative" },
  ];

  const netWorthSeries = Array.from({ length: 6 }, (_, i) => {
    const offset = i - 6;
    return { month: ym(now, offset), value: 5_640_000 + i * 55_000 };
  });

  return { fxRates, recurring, trips, netWorthSeries, transactions, deposits, promoSavings, holdings, yearlyPlans, adhocBudgets };
}
