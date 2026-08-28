import type {
  Account,
  Allowance,
  Budget,
  Category,
  FxRate,
  Goal,
  Mortgage,
  OneOff,
  Recurring,
  Transaction,
  Trip,
} from "./types";
import type { RetirementInputs } from "./calc/retirement";
import { MONTH_TOTAL_BUDGET_ID } from "./types";

export const accounts: Account[] = [
  { id: "bochk", name: "BOCHK payroll", nameZh: "中銀出糧戶口", type: "current", currency: "HKD", balance: 128400, includeInNetWorth: true, group: "cash", sortOrder: 0 },
  { id: "hsb-save", name: "Hang Seng savings", nameZh: "恒生儲蓄", type: "savings", currency: "HKD", balance: 220000, includeInNetWorth: true, group: "cash", sortOrder: 1 },
  { id: "cash-hkd", name: "Cash", nameZh: "現金", type: "cash", currency: "HKD", balance: 2400, includeInNetWorth: true, group: "cash", sortOrder: 2 },
  { id: "octopus", name: "Octopus", nameZh: "八達通", type: "ewallet", currency: "HKD", balance: 186, includeInNetWorth: true, group: "cash", sortOrder: 3 },
  { id: "hsbc-visa", name: "HSBC Visa", nameZh: "匯豐 Visa", type: "credit", currency: "HKD", balance: -12480, includeInNetWorth: true, group: "credit", sortOrder: 0 },
  { id: "mpf", name: "MPF", nameZh: "強積金", type: "mpf", currency: "HKD", balance: 980000, includeInNetWorth: true, group: "assets", sortOrder: 0 },
  { id: "broker", name: "Brokerage", nameZh: "證券戶口", type: "investment", currency: "HKD", balance: 640000, includeInNetWorth: true, group: "assets", sortOrder: 1 },
  { id: "tsuen-wan", name: "Tsuen Wan flat", nameZh: "荃灣單位", type: "property", currency: "HKD", balance: 6800000, includeInNetWorth: true, group: "housing", sortOrder: 0 },
  { id: "mortgage", name: "Mortgage", nameZh: "按揭", type: "mortgage", currency: "HKD", balance: -2858240, includeInNetWorth: true, group: "housing", sortOrder: 1 },
  { id: "asia-miles", name: "Asia Miles", nameZh: "亞洲萬里通", type: "miles", currency: "MILES", balance: 86200, includeInNetWorth: false, group: "loyalty", sortOrder: 0 },
];

export const categories: Category[] = [
  { id: "p-housing", name: "Housing", nameZh: "房屋", theme: "living", kind: "expense", icon: "home", essential: true },
  { id: "mortgage-p", name: "Mortgage principal", nameZh: "按揭本金", theme: "living", kind: "expense", icon: "home", essential: true, parentId: "p-housing" },
  { id: "mortgage-i", name: "Mortgage interest", nameZh: "按揭利息", theme: "living", kind: "expense", icon: "home", essential: true, parentId: "p-housing" },
  { id: "mgmt", name: "Management fee", nameZh: "管理費", theme: "living", kind: "expense", icon: "building", essential: true, parentId: "p-housing" },
  { id: "p-food", name: "Food", nameZh: "飲食", theme: "living", kind: "expense", icon: "utensils" },
  { id: "dining", name: "Dining out", nameZh: "外出就餐", theme: "living", kind: "expense", icon: "utensils", parentId: "p-food" },
  { id: "groceries", name: "Groceries", nameZh: "超市", theme: "living", kind: "expense", icon: "shopping", parentId: "p-food" },
  { id: "p-transit", name: "Transport", nameZh: "交通", theme: "living", kind: "expense", icon: "train" },
  { id: "mtr", name: "MTR / bus", nameZh: "港鐵 / 巴士", theme: "living", kind: "expense", icon: "train", parentId: "p-transit" },
  { id: "p-personal", name: "Personal", nameZh: "個人", theme: "living", kind: "expense", icon: "user" },
  { id: "internet", name: "Internet / mobile", nameZh: "寬頻 / 流動電話", theme: "living", kind: "expense", icon: "wifi", essential: true, parentId: "p-personal" },
  { id: "entertainment", name: "Entertainment", nameZh: "娛樂", theme: "living", kind: "expense", icon: "film", parentId: "p-personal" },
  { id: "education", name: "Education", nameZh: "教育", theme: "other", kind: "expense", icon: "graduation" },
  { id: "insurance", name: "Insurance", nameZh: "保險", theme: "living", kind: "expense", icon: "shield", essential: true },
  { id: "mpf-vol", name: "Voluntary MPF", nameZh: "自願性強積金", theme: "retirement", kind: "expense", icon: "piggy" },
  { id: "p-travel", name: "Travel", nameZh: "旅遊", theme: "travel", kind: "expense", icon: "plane" },
  { id: "flights", name: "Flights", nameZh: "機票", theme: "travel", kind: "expense", icon: "plane", parentId: "p-travel" },
  { id: "hotels", name: "Hotels", nameZh: "酒店", theme: "travel", kind: "expense", icon: "building", parentId: "p-travel" },
  { id: "p-income", name: "Income", nameZh: "收入", theme: "other", kind: "income", icon: "briefcase" },
  { id: "salary", name: "Salary", nameZh: "薪金", theme: "other", kind: "income", icon: "briefcase", parentId: "p-income" },
  { id: "interest-inc", name: "Interest income", nameZh: "利息收入", theme: "other", kind: "income", icon: "coins", parentId: "p-income" },
];

export const recurring: Recurring[] = [
  { id: "r-salary", type: "income", label: "Salary", labelZh: "薪金", amount: 72000, currency: "HKD", accountId: "bochk", categoryId: "salary", frequency: "monthly", nextDate: "2026-08-28", chargedDay: 28 },
  { id: "r-mgmt", type: "expense", label: "Management fee", labelZh: "管理費", amount: 2180, currency: "HKD", accountId: "bochk", categoryId: "mgmt", frequency: "monthly", nextDate: "2026-08-01", chargedDay: 1, essential: true, living: true },
  { id: "r-mortgage-p", type: "transfer", label: "Mortgage principal", labelZh: "按揭本金", amount: 9600, currency: "HKD", accountId: "bochk", toAccountId: "mortgage", categoryId: "mortgage-p", frequency: "monthly", nextDate: "2026-08-01", chargedDay: 1, essential: true, living: true, countsAsExpense: true, splitWithId: "r-mortgage-i" },
  { id: "r-mortgage-i", type: "expense", label: "Mortgage interest", labelZh: "按揭利息", amount: 4980, currency: "HKD", accountId: "bochk", categoryId: "mortgage-i", frequency: "monthly", nextDate: "2026-08-01", chargedDay: 1, essential: true, living: true, splitWithId: "r-mortgage-p" },
  { id: "r-life", type: "expense", label: "Life insurance", labelZh: "人壽保險", amount: 1860, currency: "HKD", accountId: "hsbc-visa", categoryId: "insurance", frequency: "monthly", nextDate: "2026-08-05", chargedDay: 5, essential: true },
  { id: "r-mobile", type: "expense", label: "Mobile plan", labelZh: "流動電話", amount: 198, currency: "HKD", accountId: "hsbc-visa", categoryId: "internet", frequency: "monthly", nextDate: "2026-08-26", chargedDay: 26, essential: true, variable: true },
  { id: "r-mpf", type: "expense", label: "Voluntary MPF", labelZh: "自願性強積金", amount: 3000, currency: "HKD", accountId: "bochk", categoryId: "mpf-vol", frequency: "monthly", nextDate: "2026-08-28", chargedDay: 28 },
  { id: "r-travel", type: "transfer", label: "Travel fund", labelZh: "旅遊儲蓄", amount: 3500, currency: "HKD", accountId: "bochk", toAccountId: "hsb-save", frequency: "monthly", nextDate: "2026-08-28", chargedDay: 28 },
];

export const budgets: Budget[] = [
  { id: MONTH_TOTAL_BUDGET_ID, label: "Monthly total", labelZh: "本月總額", monthly: 40000, spent: 0 },
  { id: "b-dining", categoryId: "dining", label: "Dining out", labelZh: "外出就餐", monthly: 6000, spent: 0 },
  { id: "b-groc", categoryId: "groceries", label: "Groceries", labelZh: "超市", monthly: 4500, spent: 0 },
  { id: "b-mtr", categoryId: "mtr", label: "MTR / bus", labelZh: "港鐵 / 巴士", monthly: 800, spent: 0 },
  { id: "b-ent", categoryId: "entertainment", label: "Entertainment", labelZh: "娛樂", monthly: 1500, spent: 0 },
];

export const annualTravelBudget = 80000;

export const fxRates: FxRate[] = [
  { currency: "HKD", perHkd: 1, asOf: "2026-08-23", source: "Base" },
  { currency: "USD", perHkd: 7.82, asOf: "2026-08-23", source: "Indicative" },
  { currency: "JPY", perHkd: 0.0531, asOf: "2026-08-23", source: "Indicative" },
  { currency: "CNY", perHkd: 1.088, asOf: "2026-08-23", source: "Indicative" },
  { currency: "TWD", perHkd: 0.244, asOf: "2026-08-23", source: "Indicative" },
  { currency: "THB", perHkd: 0.241, asOf: "2026-08-23", source: "Indicative" },
  { currency: "GBP", perHkd: 10.12, asOf: "2026-08-23", source: "Indicative" },
  { currency: "EUR", perHkd: 9.16, asOf: "2026-08-23", source: "Indicative" },
];

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

export const trips: Trip[] = [
  { id: "taipei-2026", name: "Taipei", nameZh: "台北", destination: "Taipei", start: "2026-10-12", end: "2026-10-16", status: "booked", cashBudget: 12000, cashSaved: 8000, milesTarget: 25000, milesSaved: 15000, monthlyCash: 2000 },
  { id: "japan-2027", name: "Japan 2027", nameZh: "日本 2027", destination: "Tokyo", start: "2027-03-20", end: "2027-03-28", status: "planning", cashBudget: 28000, cashSaved: 9000, milesTarget: 80000, milesSaved: 20000, monthlyCash: 3500 },
];

export const netWorthSeries = [
  { month: "2026-03", value: 5_720_000 },
  { month: "2026-04", value: 5_810_000 },
  { month: "2026-05", value: 5_860_000 },
  { month: "2026-06", value: 5_940_000 },
  { month: "2026-07", value: 5_980_000 },
];

function t(row: Transaction): Transaction {
  return row;
}

export const transactions: Transaction[] = [
  t({ id: "tx-salary", type: "income", amount: 72000, currency: "HKD", accountId: "bochk", categoryId: "salary", date: "2026-08-28", payee: "Employer", payeeZh: "公司薪金" }),
  t({ id: "tx-mpf", type: "expense", amount: 3000, currency: "HKD", accountId: "bochk", categoryId: "mpf-vol", date: "2026-08-28", payee: "Voluntary MPF", payeeZh: "自願性強積金" }),
  t({ id: "tx-travel-fund", type: "transfer", amount: 3500, currency: "HKD", accountId: "bochk", toAccountId: "hsb-save", date: "2026-08-28", payee: "Travel fund", payeeZh: "旅遊儲蓄" }),
  t({ id: "tx-mgmt", type: "expense", amount: 2180, currency: "HKD", accountId: "bochk", categoryId: "mgmt", date: "2026-08-01", payee: "Management", payeeZh: "管理費" }),
  t({ id: "tx-mp", type: "transfer", amount: 9600, currency: "HKD", accountId: "bochk", toAccountId: "mortgage", destAmount: 9600, categoryId: "mortgage-p", date: "2026-08-01", payee: "Mortgage principal", payeeZh: "按揭本金", countsAsExpense: true }),
  t({ id: "tx-mi", type: "expense", amount: 4980, currency: "HKD", accountId: "bochk", categoryId: "mortgage-i", date: "2026-08-01", payee: "Mortgage interest", payeeZh: "按揭利息" }),
  t({ id: "tx-life", type: "expense", amount: 1860, currency: "HKD", accountId: "hsbc-visa", categoryId: "insurance", date: "2026-08-05", payee: "Life insurance", payeeZh: "人壽保險" }),
  t({ id: "tx-mobile", type: "expense", amount: 198, currency: "HKD", accountId: "hsbc-visa", categoryId: "internet", date: "2026-08-26", payee: "CSL mobile", payeeZh: "流動電話", recurringId: "r-mobile" }),
  t({ id: "tx-coffee", type: "expense", amount: 48, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: "2026-08-28", payee: "Starbucks", payeeZh: "星巴克" }),
  t({ id: "tx-lunch", type: "expense", amount: 92, currency: "HKD", accountId: "octopus", categoryId: "dining", date: "2026-08-27", payee: "Cafe", payeeZh: "茶餐廳" }),
  t({ id: "tx-groc", type: "expense", amount: 420, currency: "HKD", accountId: "hsbc-visa", categoryId: "groceries", date: "2026-08-24", payee: "Wellcome", payeeZh: "惠康" }),
  t({ id: "tx-mtr1", type: "expense", amount: 51.2, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: "2026-08-22", payee: "MTR", payeeZh: "港鐵" }),
  t({ id: "tx-mtr2", type: "expense", amount: 18, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: "2026-08-21", payee: "MTR", payeeZh: "港鐵" }),
  t({ id: "tx-ent", type: "expense", amount: 320, currency: "HKD", accountId: "hsbc-visa", categoryId: "entertainment", date: "2026-08-16", payee: "Cinema", payeeZh: "戲院" }),
  t({ id: "tx-tpe", type: "expense", amount: 2100, currency: "HKD", accountId: "hsbc-visa", categoryId: "hotels", date: "2026-07-12", payee: "Taipei hotel", payeeZh: "台北酒店訂金", tripId: "taipei-2026" }),
  t({ id: "tx-salary-jul", type: "income", amount: 72000, currency: "HKD", accountId: "bochk", categoryId: "salary", date: "2026-07-28", payee: "Employer", payeeZh: "公司薪金" }),
];
