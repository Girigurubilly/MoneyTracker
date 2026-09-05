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

export function defaultTypeForGroup(group: AccountGroup): AccountType {
  if (group === "credit") return "credit";
  if (group === "assets") return "investment";
  if (group === "housing") return "property";
  if (group === "loyalty") return "miles";
  return "current";
}

export function typesInGroup(group: AccountGroup): AccountType[] {
  return ACCOUNT_TYPE_OPTIONS.map((o) => o.id).filter((id) => groupForType(id) === group);
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
  linkedAccountId?: string;
  expectedReturn?: number;
  retireInclude?: boolean;
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
  | "dollar"
  | "card"
  | "banknote"
  | "receipt"
  | "percent"
  | "calculator"
  | "vault"
  | "cart"
  | "store"
  | "tag"
  | "package"
  | "barcode"
  | "pizza"
  | "icecream"
  | "wine"
  | "beer"
  | "cake"
  | "apple"
  | "sandwich"
  | "salad"
  | "sofa"
  | "key"
  | "lamp"
  | "hammer"
  | "droplets"
  | "bed"
  | "bath"
  | "plug"
  | "paw"
  | "bird"
  | "fish"
  | "cat"
  | "dog"
  | "rabbit"
  | "bone"
  | "baby"
  | "milk"
  | "palmtree"
  | "luggage"
  | "ferris"
  | "sun"
  | "snow"
  | "moon"
  | "pill"
  | "activity"
  | "stethoscope"
  | "pulse"
  | "cross"
  | "bus"
  | "bike"
  | "ship"
  | "fuel"
  | "factory"
  | "hotel"
  | "shirt"
  | "glasses"
  | "watch"
  | "gem"
  | "scissors"
  | "users"
  | "handshake"
  | "presentation"
  | "scale"
  | "gavel"
  | "drama"
  | "clapper"
  | "popcorn"
  | "phone"
  | "laptop"
  | "tv"
  | "headphones"
  | "speaker"
  | "printer"
  | "battery"
  | "tablet"
  | "cpu"
  | "palette"
  | "library"
  | "church"
  | "dice"
  | "puzzle"
  | "joystick"
  | "music"
  | "mic"
  | "disc"
  | "radio"
  | "guitar"
  | "globe"
  | "signal"
  | "cloud"
  | "mail"
  | "share"
  | "camera"
  | "image"
  | "aperture"
  | "trophy"
  | "medal"
  | "run"
  | "dumbbell"
  | "calendar"
  | "hourglass"
  | "timer"
  | "alarm"
  | "bell"
  | "newspaper"
  | "podcast"
  | "play"
  | "crown"
  | "rss"
  | "leaf"
  | "tree"
  | "mountain"
  | "flower"
  | "waves"
  | "tram"
  | "taxi"
  | "parking"
  | "cookie"
  | "soup";

export type CategoryIconGroupId =
  | "financial"
  | "ecommerce"
  | "food"
  | "house"
  | "animal"
  | "baby"
  | "holiday"
  | "health"
  | "transport"
  | "city"
  | "clothes"
  | "business"
  | "drama"
  | "devices"
  | "culture"
  | "gaming"
  | "music"
  | "network"
  | "photo"
  | "sport"
  | "times"
  | "subscriptions"
  | "nature";

export const CATEGORY_ICON_GROUPS: { id: CategoryIconGroupId; icons: CategoryIconName[] }[] = [
  { id: "financial", icons: ["wallet", "coins", "dollar", "piggy", "landmark", "trending", "card", "banknote", "receipt", "percent", "calculator", "vault"] },
  { id: "ecommerce", icons: ["shopping", "bag", "gift", "cart", "store", "tag", "package", "barcode"] },
  { id: "food", icons: ["utensils", "cup", "pizza", "icecream", "wine", "beer", "cake", "apple", "sandwich", "salad", "cookie", "soup"] },
  { id: "house", icons: ["home", "wrench", "zap", "broom", "sofa", "key", "lamp", "hammer", "droplets", "bed", "bath", "plug"] },
  { id: "animal", icons: ["paw", "bird", "fish", "cat", "dog", "rabbit", "bone"] },
  { id: "baby", icons: ["baby", "milk", "user"] },
  { id: "holiday", icons: ["plane", "tent", "ticket", "sparkles", "umbrella", "palmtree", "luggage", "ferris", "sun", "snow", "moon"] },
  { id: "health", icons: ["heart", "shield", "pill", "activity", "stethoscope", "pulse", "cross"] },
  { id: "transport", icons: ["train", "car", "bus", "bike", "ship", "fuel", "tram", "taxi", "parking"] },
  { id: "city", icons: ["building", "map", "factory", "hotel"] },
  { id: "clothes", icons: ["shirt", "glasses", "watch", "gem", "scissors"] },
  { id: "business", icons: ["briefcase", "file", "users", "handshake", "presentation", "scale", "gavel"] },
  { id: "drama", icons: ["film", "drama", "clapper", "popcorn"] },
  { id: "devices", icons: ["phone", "laptop", "tv", "headphones", "speaker", "printer", "battery", "tablet", "cpu"] },
  { id: "culture", icons: ["graduation", "book", "palette", "library", "church"] },
  { id: "gaming", icons: ["gamepad", "dice", "puzzle", "joystick"] },
  { id: "music", icons: ["music", "mic", "disc", "radio", "guitar"] },
  { id: "network", icons: ["wifi", "globe", "signal", "cloud", "mail", "share"] },
  { id: "photo", icons: ["camera", "image", "aperture"] },
  { id: "sport", icons: ["trophy", "medal", "run", "dumbbell"] },
  { id: "times", icons: ["clock", "calendar", "hourglass", "timer", "alarm", "bell"] },
  { id: "subscriptions", icons: ["repeat", "newspaper", "podcast", "play", "crown", "rss"] },
  { id: "nature", icons: ["leaf", "tree", "mountain", "flower", "waves"] },
];

export const CATEGORY_ICONS: CategoryIconName[] = CATEGORY_ICON_GROUPS.flatMap((g) => g.icons);

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
  depositId?: string;
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
  destAmount?: number;
};

export type TimeSaving = {
  id: string;
  bank: string;
  startDate: string;
  endDate: string;
  rate: number;
  currency: Currency;
  amount: number;
  interest: number;
  accountId: string;
};

export type YearlyPlan = {
  id: string;
  salary: number;
  other: number;
  expense: number;
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

export type WishItem = {
  id: string;
  name: string;
  price: number;
  currency: Currency;
  note?: string;
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
  startDate?: string;
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
