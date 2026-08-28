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
  /** Future / not-yet-charged: does not change any account balance until the date arrives. */
  planned?: boolean;
  /** Links a scheduled occurrence to a monthly regular. */
  recurringId?: string;
  /**
   * Mortgage principal (and similar): stored as a transfer so cash falls and
   * the loan account is reduced, but still counted as spend on Today / Budget.
   */
  countsAsExpense?: boolean;
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
  /** Counts toward Living / Home essential spend when true. */
  living?: boolean;
  /**
   * Transfer that still counts as spend (mortgage principal). Cash leaves the
   * payment account and the destination (loan) balance is reduced.
   */
  countsAsExpense?: boolean;
  /** Partner regular when this item is one half of a 本金 / 利息 split. */
  splitWithId?: string;
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
  destinations: string;
  destinationsZh: string;
  start: string;
  end?: string;
  status: "planning" | "booked" | "completed" | "cancelled";
  cashBudget: number;
  cashSaved: number;
  milesTarget: number;
  milesSaved: number;
  monthlyCash: number;
  monthlyMiles: number;
  notes?: string;
  notesZh?: string;
};

export type Goal = {
  id: string;
  name: string;
  nameZh: string;
  current: number;
  target: number;
  currency: MoneyUnit;
  change30: number;
};

export type Mortgage = {
  id: string;
  accountId: string;
  propertyAccountId?: string;
  lender: string;
  lenderZh: string;
  original: number;
  outstanding: number;
  remainingMonths: number;
  endDate?: string;
  rateType: "P" | "H" | "fixed";
  benchmark: number;
  adjustment: number;
  effectiveRate: number;
  monthlyPayment: number;
  nextReprice?: string;
  paymentAccountId: string;
};

export type RetirementScenario = {
  currentAge: number;
  retireAge: number;
  deathAge: number;
  monthlyIncomeNow: number;
  monthlySpendNow: number;
  targetMonthly: number;
  sustainableMonthly: number;
  corpusAtRetire: number;
  requiredCorpus: number;
  gap: number;
  extraMonthlySaving: number;
  preReturn: number;
  postReturn: number;
  inflation: number;
  travelInRetirement: number;
  depletes: boolean;
  depletionAge?: number;
  mortgagePayoffAge: number;
  status: "on-track" | "watch" | "at-risk";
};

export type OneOff = {
  id: string;
  label: string;
  labelZh: string;
  amount: number;
  direction: "in" | "out";
  age: number;
};

export type Allowance = {
  id: string;
  label: string;
  labelZh: string;
  monthly: number;
  startAge: number;
  /** Inclusive. Omit for lifetime (e.g. 生果金). */
  endAge?: number;
  kind?: "oaa" | "annuity" | "other";
  inflationAdjusted: boolean;
};

export type FxRate = {
  currency: Currency;
  perHkd: number;
  asOf: string;
  source: string;
};
