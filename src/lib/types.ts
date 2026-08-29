export type Locale = "en" | "zh-HK";
export type ThemeMode = "dark" | "light";
export type Currency =
  | "HKD"
  | "USD"
  | "JPY"
  | "CNY"
  | "TWD"
  | "THB"
  | "GBP"
  | "EUR"
  | "AUD"
  | "SGD"
  | "CHF"
  | "MOP"
  | "KRW"
  | "CAD"
  | "NZD"
  | "INR";
export type MoneyUnit = Currency | "MILES";
export type TxType = "expense" | "income" | "transfer" | "miles";
export type LifeTheme = "living" | "travel" | "retirement" | "other";
export type TodayView = "day" | "week" | "month";
export type AccountGroup = "cash" | "credit" | "assets" | "housing" | "loyalty";
export type AccountType =
  | "cash"
  | "current"
  | "savings"
  | "fx"
  | "ewallet"
  | "credit"
  | "loan"
  | "investment"
  | "mpf"
  | "property"
  | "mortgage"
  | "miles"
  | "other_asset";

export const CURRENCIES: Currency[] = [
  "HKD",
  "USD",
  "JPY",
  "CNY",
  "TWD",
  "THB",
  "GBP",
  "EUR",
  "AUD",
  "SGD",
  "CHF",
  "MOP",
  "KRW",
  "CAD",
  "NZD",
  "INR",
];

export const ACCOUNT_TYPE_OPTIONS: { id: AccountType; en: string; zh: string }[] = [
  { id: "current", en: "Current", zh: "往來" },
  { id: "savings", en: "Savings", zh: "儲蓄" },
  { id: "cash", en: "Cash", zh: "現金" },
  { id: "fx", en: "FX", zh: "外幣" },
  { id: "ewallet", en: "E-wallet", zh: "電子錢包" },
  { id: "credit", en: "Credit card", zh: "信用卡" },
  { id: "loan", en: "Loan", zh: "貸款" },
  { id: "investment", en: "Investment", zh: "投資" },
  { id: "mpf", en: "MPF", zh: "強積金" },
  { id: "property", en: "Property", zh: "物業" },
  { id: "mortgage", en: "Mortgage", zh: "按揭" },
  { id: "miles", en: "Asia Miles", zh: "亞洲萬里通" },
  { id: "other_asset", en: "Other asset", zh: "其他資產" },
];

export function groupForType(type: AccountType): AccountGroup {
  if (type === "credit" || type === "loan") return "credit";
  if (type === "investment" || type === "mpf" || type === "other_asset") return "assets";
  if (type === "property" || type === "mortgage") return "housing";
  if (type === "miles") return "loyalty";
  return "cash";
}

export type Account = {
  id: string;
  name: string;
  nameZh: string;
  type: AccountType;
  currency: MoneyUnit;
  balance: number;
  includeInNetWorth: boolean;
  group: AccountGroup;
  hidden?: boolean;
  institution?: string;
  notes?: string;
  notesZh?: string;
  sortOrder?: number;
};

export type CategoryIconName =
  | "utensils"
  | "shopping"
  | "train"
  | "car"
  | "home"
  | "wrench"
  | "zap"
  | "wifi"
  | "heart"
  | "shield"
  | "graduation"
  | "film"
  | "sparkles"
  | "plane"
  | "building"
  | "map"
  | "ticket"
  | "umbrella"
  | "bag"
  | "landmark"
  | "piggy"
  | "repeat"
  | "wallet"
  | "gift"
  | "coins"
  | "trending"
  | "briefcase"
  | "gamepad"
  | "user"
  | "broom"
  | "tent"
  | "cup"
  | "book"
  | "file"
  | "clock"
  | "dollar";

export const CATEGORY_ICONS: CategoryIconName[] = [
  "utensils",
  "shopping",
  "train",
  "car",
  "home",
  "wrench",
  "zap",
  "wifi",
  "heart",
  "shield",
  "graduation",
  "film",
  "sparkles",
  "plane",
  "building",
  "map",
  "ticket",
  "umbrella",
  "bag",
  "landmark",
  "piggy",
  "repeat",
  "wallet",
  "gift",
  "coins",
  "trending",
  "briefcase",
  "gamepad",
  "user",
  "broom",
  "tent",
  "cup",
  "book",
  "file",
  "clock",
  "dollar",
];

export type Category = {
  id: string;
  name: string;
  nameZh: string;
  theme: LifeTheme;
  kind: "expense" | "income";
  icon: CategoryIconName;
  essential?: boolean;
  defaultAccountId?: string;
  parentId?: string;
};

export const MONTH_TOTAL_BUDGET_ID = "b-month-total";

export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  currency: MoneyUnit;
  accountId: string;
  toAccountId?: string;
  destAmount?: number;
  categoryId?: string;
  date: string;
  payee: string;
  payeeZh: string;
  note?: string;
  noteZh?: string;
  tags?: string[];
  tripId?: string;
  milesType?: "earn" | "burn" | "adjust" | "expiry";
  planned?: boolean;
  recurringId?: string;
  countsAsExpense?: boolean;
  housing?: boolean;
  fxToHkd?: number;
};

export type Recurring = {
  id: string;
  type: TxType;
  label: string;
  labelZh: string;
  amount: number;
  currency: MoneyUnit;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  nextDate: string;
  chargedDay?: number;
  essential?: boolean;
  variable?: boolean;
  living?: boolean;
  countsAsExpense?: boolean;
  housing?: boolean;
  splitWithId?: string;
};

export type AdhocBudget = {
  id: string;
  label: string;
  labelZh: string;
  amount: number;
  currency: MoneyUnit;
  month: string;
  date: string;
  categoryId?: string;
};

export type Budget = {
  id: string;
  categoryId?: string;
  theme?: LifeTheme;
  label: string;
  labelZh: string;
  monthly: number;
  spent: number;
};

export type Trip = {
  id: string;
  name: string;
  nameZh: string;
  destination: string;
  start: string;
  end: string;
  status: "planning" | "booked" | "completed" | "cancelled";
  cashBudget: number;
  cashSaved: number;
  milesTarget: number;
  milesSaved: number;
  monthlyCash: number;
};

export type Goal = {
  id: string;
  name: string;
  nameZh: string;
  current: number;
  target: number;
  currency: MoneyUnit;
  change30?: number;
};

export type Mortgage = {
  id: string;
  name: string;
  nameZh: string;
  accountId: string;
  original: number;
  outstanding: number;
  rate: number;
  pRate?: number;
  spread?: number;
  remainingMonths: number;
  paymentDay: number;
  type: "p" | "h" | "fixed";
  livingMode?: "own-mortgage" | "own-outright" | "rent" | "other";
  propertyAccountId?: string;
  paymentOverride?: number;
};

export type Allowance = {
  id: string;
  label: string;
  labelZh: string;
  monthly: number;
  startAge: number;
  endAge?: number;
  kind: "oaa" | "annuity" | "other";
  inflationAdjusted: boolean;
};

export type OneOff = {
  id: string;
  label: string;
  labelZh: string;
  amount: number;
  age: number;
};

export type FxRate = {
  currency: Currency;
  perHkd: number;
  asOf: string;
  source: string;
};
