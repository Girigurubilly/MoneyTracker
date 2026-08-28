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
  RetirementScenario,
  Transaction,
  Trip,
} from "./types";

export const SAMPLE_USER = {
  name: "Alex",
  nameZh: "Alex",
};

export const accounts: Account[] = [
  {
    id: "bochk",
    name: "BOCHK Salary",
    nameZh: "中銀出糧戶口",
    type: "current",
    currency: "HKD",
    balance: 62800.4,
    includeInNetWorth: true,
    group: "cash",
    institution: "BOCHK",
  },
  {
    id: "hsbc-hkd",
    name: "HSBC Current",
    nameZh: "滙豐往來",
    type: "current",
    currency: "HKD",
    balance: 185420.55,
    includeInNetWorth: true,
    group: "cash",
    institution: "HSBC",
  },
  {
    id: "hsb-save",
    name: "Hang Seng Savings",
    nameZh: "恒生儲蓄",
    type: "savings",
    currency: "HKD",
    balance: 420000,
    includeInNetWorth: true,
    group: "cash",
    institution: "Hang Seng",
  },
  {
    id: "hsbc-usd",
    name: "HSBC USD",
    nameZh: "滙豐美元",
    type: "fx",
    currency: "USD",
    balance: 12450.2,
    includeInNetWorth: true,
    group: "cash",
    institution: "HSBC",
  },
  {
    id: "jpy-cash",
    name: "JPY Cash",
    nameZh: "日圓現金",
    type: "cash",
    currency: "JPY",
    balance: 85000,
    includeInNetWorth: true,
    group: "cash",
  },
  {
    id: "octopus",
    name: "Octopus",
    nameZh: "八達通",
    type: "ewallet",
    currency: "HKD",
    balance: 342.1,
    includeInNetWorth: true,
    group: "cash",
  },
  {
    id: "hsbc-visa",
    name: "HSBC Red Visa",
    nameZh: "滙豐 Red Visa",
    type: "credit",
    currency: "HKD",
    balance: -8240.5,
    includeInNetWorth: true,
    group: "credit",
    institution: "HSBC",
  },
  {
    id: "futu",
    name: "Futu Brokerage",
    nameZh: "富途證券",
    type: "investment",
    currency: "HKD",
    balance: 1250000,
    includeInNetWorth: true,
    group: "assets",
    notes: "Manually valued",
    notesZh: "手動估值",
  },
  {
    id: "mpf",
    name: "Manulife MPF",
    nameZh: "宏利強積金",
    type: "mpf",
    currency: "HKD",
    balance: 890000,
    includeInNetWorth: true,
    group: "assets",
    institution: "Manulife",
  },
  {
    id: "home",
    name: "Tsuen Wan flat",
    nameZh: "荃灣單位",
    type: "property",
    currency: "HKD",
    balance: 6800000,
    includeInNetWorth: true,
    group: "housing",
    notes: "Not treated as spendable retirement capital by default",
    notesZh: "預設不視為可動用退休資金",
  },
  {
    id: "mortgage",
    name: "Hang Seng Mortgage",
    nameZh: "恒生按揭",
    type: "mortgage",
    currency: "HKD",
    balance: -2850000,
    includeInNetWorth: true,
    group: "housing",
    institution: "Hang Seng",
  },
  {
    id: "asia-miles",
    name: "Asia Miles",
    nameZh: "亞洲萬里通",
    type: "miles",
    currency: "MILES",
    balance: 186400,
    includeInNetWorth: false,
    group: "loyalty",
    institution: "Cathay",
  },
];

export const categories: Category[] = [
  { id: "p-housing", name: "Housing", nameZh: "房屋", theme: "living", kind: "expense", icon: "home", essential: true },
  { id: "p-food", name: "Food", nameZh: "飲食", theme: "living", kind: "expense", icon: "utensils" },
  { id: "p-transport", name: "Transport", nameZh: "交通", theme: "living", kind: "expense", icon: "train" },
  { id: "p-health", name: "Health", nameZh: "保健", theme: "living", kind: "expense", icon: "heart" },
  { id: "p-personal", name: "Family & personal", nameZh: "家庭和個人", theme: "other", kind: "expense", icon: "user" },
  { id: "p-entertainment", name: "Entertainment", nameZh: "娛樂", theme: "other", kind: "expense", icon: "film" },
  { id: "p-travel", name: "Travel", nameZh: "旅遊", theme: "travel", kind: "expense", icon: "plane" },
  { id: "p-retirement", name: "Retirement", nameZh: "退休", theme: "retirement", kind: "expense", icon: "piggy" },
  { id: "p-income", name: "Income", nameZh: "收入", theme: "other", kind: "income", icon: "briefcase" },
  { id: "rent", name: "Rent", nameZh: "租金", theme: "living", kind: "expense", icon: "home", essential: true, parentId: "p-housing" },
  { id: "mortgage-p", name: "Mortgage principal", nameZh: "按揭本金", theme: "living", kind: "expense", icon: "home", essential: true, parentId: "p-housing" },
  { id: "mortgage-i", name: "Mortgage interest", nameZh: "按揭利息", theme: "living", kind: "expense", icon: "home", essential: true, parentId: "p-housing" },
  { id: "mgmt", name: "Management fee", nameZh: "管理費", theme: "living", kind: "expense", icon: "building", essential: true, parentId: "p-housing" },
  { id: "rates", name: "Rates / gov. rent", nameZh: "差餉 / 地租", theme: "living", kind: "expense", icon: "landmark", essential: true, parentId: "p-housing" },
  { id: "home-ins", name: "Home insurance", nameZh: "家居保險", theme: "living", kind: "expense", icon: "shield", essential: true, parentId: "p-housing" },
  { id: "repairs", name: "Repairs", nameZh: "維修", theme: "living", kind: "expense", icon: "wrench", parentId: "p-housing" },
  { id: "utilities", name: "Utilities", nameZh: "水電煤", theme: "living", kind: "expense", icon: "zap", essential: true, parentId: "p-housing" },
  { id: "internet", name: "Internet / mobile", nameZh: "寬頻 / 流動電話", theme: "living", kind: "expense", icon: "wifi", essential: true, parentId: "p-personal" },
  { id: "groceries", name: "Groceries", nameZh: "超市", theme: "living", kind: "expense", icon: "shopping", essential: true, parentId: "p-food" },
  { id: "dining", name: "Dining out", nameZh: "外出就餐", theme: "living", kind: "expense", icon: "utensils", defaultAccountId: "hsbc-visa", parentId: "p-food" },
  { id: "mtr", name: "MTR / bus", nameZh: "港鐵 / 巴士", theme: "living", kind: "expense", icon: "train", essential: true, parentId: "p-transport" },
  { id: "taxi", name: "Taxi / ride-hailing", nameZh: "的士 / 網約車", theme: "living", kind: "expense", icon: "car", parentId: "p-transport" },
  { id: "medical", name: "Medical", nameZh: "醫療", theme: "living", kind: "expense", icon: "heart", essential: true, parentId: "p-health" },
  { id: "insurance", name: "Insurance", nameZh: "保險", theme: "living", kind: "expense", icon: "shield", essential: true, parentId: "p-health" },
  { id: "education", name: "Education", nameZh: "教育", theme: "other", kind: "expense", icon: "graduation", parentId: "p-personal" },
  { id: "entertainment", name: "Entertainment", nameZh: "娛樂", theme: "other", kind: "expense", icon: "film", parentId: "p-entertainment" },
  { id: "personal", name: "Personal care", nameZh: "個人護理", theme: "other", kind: "expense", icon: "sparkles", parentId: "p-personal" },
  { id: "flights", name: "Air travel", nameZh: "空中交通", theme: "travel", kind: "expense", icon: "plane", parentId: "p-travel" },
  { id: "hotels", name: "Lodging", nameZh: "住宿", theme: "travel", kind: "expense", icon: "tent", parentId: "p-travel" },
  { id: "local-tx", name: "Ground transport", nameZh: "地面交通", theme: "travel", kind: "expense", icon: "train", parentId: "p-travel" },
  { id: "travel-food", name: "Meals", nameZh: "膳食", theme: "travel", kind: "expense", icon: "cup", parentId: "p-travel" },
  { id: "attractions", name: "Admission", nameZh: "入場費", theme: "travel", kind: "expense", icon: "ticket", parentId: "p-travel" },
  { id: "travel-ins", name: "Insurance", nameZh: "保險", theme: "travel", kind: "expense", icon: "umbrella", parentId: "p-travel" },
  { id: "shopping", name: "Shopping", nameZh: "購物", theme: "travel", kind: "expense", icon: "bag", parentId: "p-travel" },
  { id: "travel-misc", name: "Misc", nameZh: "雜項", theme: "travel", kind: "expense", icon: "sparkles", parentId: "p-travel" },
  { id: "travel-docs", name: "Documents", nameZh: "證件", theme: "travel", kind: "expense", icon: "file", parentId: "p-travel" },
  { id: "fx-cash", name: "Foreign cash", nameZh: "外幣提取", theme: "travel", kind: "expense", icon: "wallet", parentId: "p-travel" },
  { id: "mpf-vol", name: "MPF voluntary", nameZh: "自願性強積金", theme: "retirement", kind: "expense", icon: "shield", essential: true, parentId: "p-retirement" },
  { id: "retire-inv", name: "Retirement investing", nameZh: "退休投資供款", theme: "retirement", kind: "expense", icon: "trending", parentId: "p-retirement" },
  { id: "salary", name: "Salary", nameZh: "薪金", theme: "other", kind: "income", icon: "briefcase", defaultAccountId: "bochk", parentId: "p-income" },
  { id: "bonus", name: "Bonus", nameZh: "花紅", theme: "other", kind: "income", icon: "gift", parentId: "p-income" },
  { id: "interest", name: "Interest", nameZh: "利息收入", theme: "retirement", kind: "income", icon: "piggy", parentId: "p-income" },
  { id: "dividend", name: "Dividend", nameZh: "股息", theme: "retirement", kind: "income", icon: "coins", parentId: "p-income" },
  { id: "refund", name: "Refund", nameZh: "退款", theme: "other", kind: "income", icon: "repeat", parentId: "p-income" },
];

export const goals: Goal[] = [
  {
    id: "savings",
    name: "Savings",
    nameZh: "儲蓄",
    current: 7726038.29,
    target: 8000000,
    currency: "HKD",
    change30: 147559.26,
  },
];

export const trips: Trip[] = [
  {
    id: "japan-2027",
    name: "Japan spring",
    nameZh: "日本春天",
    destinations: "Tokyo, Kyoto",
    destinationsZh: "東京、京都",
    start: "2027-03-20",
    end: "2027-03-30",
    status: "planning",
    cashBudget: 45000,
    cashSaved: 18600,
    milesTarget: 80000,
    milesSaved: 52000,
    monthlyCash: 3500,
    monthlyMiles: 4000,
    notes: "Award ticket + taxes",
    notesZh: "里數機票 + 稅費",
  },
  {
    id: "taipei-2026",
    name: "Taipei weekend",
    nameZh: "台北週末",
    destinations: "Taipei",
    destinationsZh: "台北",
    start: "2026-11-14",
    end: "2026-11-16",
    status: "booked",
    cashBudget: 8000,
    cashSaved: 8000,
    milesTarget: 15000,
    milesSaved: 15000,
    monthlyCash: 0,
    monthlyMiles: 0,
  },
];

export const mortgage: Mortgage = {
  id: "m1",
  accountId: "mortgage",
  propertyAccountId: "home",
  lender: "Hang Seng Bank",
  lenderZh: "恒生銀行",
  original: 4200000,
  outstanding: 2850000,
  remainingMonths: 216,
  endDate: "2044-08-01",
  rateType: "P",
  benchmark: 5.25,
  adjustment: -3.15,
  effectiveRate: 2.1,
  monthlyPayment: 14580,
  nextReprice: "2026-12-01",
  paymentAccountId: "hsb-save",
};

export const recurring: Recurring[] = [
  { id: "r-salary", type: "income", label: "Salary", labelZh: "薪金", amount: 72000, currency: "HKD", accountId: "bochk", categoryId: "salary", frequency: "monthly", nextDate: "2026-08-28", chargedDay: 28 },
  { id: "r-mortgage", type: "expense", label: "Mortgage", labelZh: "按揭供款", amount: 14580, currency: "HKD", accountId: "hsb-save", categoryId: "mortgage-i", frequency: "monthly", nextDate: "2026-09-01", essential: true, living: true, chargedDay: 1 },
  { id: "r-mgmt", type: "expense", label: "Management fee", labelZh: "管理費", amount: 2180, currency: "HKD", accountId: "hsbc-hkd", categoryId: "mgmt", frequency: "monthly", nextDate: "2026-09-01", essential: true, living: true, chargedDay: 1 },
  { id: "r-mobile", type: "expense", label: "Mobile plan", labelZh: "流動電話", amount: 198, currency: "HKD", accountId: "hsbc-visa", categoryId: "internet", frequency: "monthly", nextDate: "2026-08-26", essential: true, variable: true, chargedDay: 26 },
  { id: "r-mpf", type: "expense", label: "MPF voluntary", labelZh: "自願性強積金", amount: 3000, currency: "HKD", accountId: "bochk", toAccountId: "mpf", categoryId: "mpf-vol", frequency: "monthly", nextDate: "2026-08-28", essential: true, chargedDay: 28 },
  { id: "r-ins", type: "expense", label: "Life insurance", labelZh: "人壽保險", amount: 1860, currency: "HKD", accountId: "hsbc-hkd", categoryId: "insurance", frequency: "monthly", nextDate: "2026-09-05", essential: true, chargedDay: 5 },
  { id: "r-travel", type: "transfer", label: "Travel fund", labelZh: "旅遊儲蓄", amount: 3500, currency: "HKD", accountId: "bochk", toAccountId: "hsb-save", frequency: "monthly", nextDate: "2026-08-29" },
];

export const budgets: Budget[] = [
  { id: "b-month-total", label: "Monthly total", labelZh: "本月總額", monthly: 40000, spent: 28640 },
  { id: "b-dining", categoryId: "dining", label: "Dining out", labelZh: "外出就餐", monthly: 6000, spent: 4540.3 },
  { id: "b-groc", categoryId: "groceries", label: "Groceries", labelZh: "超市", monthly: 4500, spent: 2186.4 },
  { id: "b-mtr", categoryId: "mtr", label: "MTR / bus", labelZh: "港鐵 / 巴士", monthly: 800, spent: 500 },
  { id: "b-ent", categoryId: "entertainment", label: "Entertainment", labelZh: "娛樂", monthly: 1500, spent: 320 },
  { id: "b-travel", theme: "travel", label: "Travel (month)", labelZh: "旅遊（月）", monthly: 6667, spent: 2100 },
];

export const annualTravelBudget = 80000;
export const annualTravelSpent = 18640;

export const fxRates: FxRate[] = [
  { currency: "USD", perHkd: 7.82, asOf: "2026-08-23", source: "Indicative" },
  { currency: "JPY", perHkd: 0.0531, asOf: "2026-08-23", source: "Indicative" },
  { currency: "CNY", perHkd: 1.088, asOf: "2026-08-23", source: "Indicative" },
  { currency: "TWD", perHkd: 0.244, asOf: "2026-08-23", source: "Indicative" },
  { currency: "THB", perHkd: 0.241, asOf: "2026-08-23", source: "Indicative" },
  { currency: "GBP", perHkd: 10.12, asOf: "2026-08-23", source: "Indicative" },
  { currency: "EUR", perHkd: 9.16, asOf: "2026-08-23", source: "Indicative" },
  { currency: "AUD", perHkd: 5.61, asOf: "2026-08-23", source: "Indicative" },
  { currency: "SGD", perHkd: 6.18, asOf: "2026-08-23", source: "Indicative" },
  { currency: "CHF", perHkd: 9.80, asOf: "2026-08-23", source: "Indicative" },
  { currency: "MOP", perHkd: 0.971, asOf: "2026-08-23", source: "Indicative" },
  { currency: "KRW", perHkd: 0.0057, asOf: "2026-08-23", source: "Indicative" },
  { currency: "CAD", perHkd: 5.70, asOf: "2026-08-23", source: "Indicative" },
  { currency: "NZD", perHkd: 4.69, asOf: "2026-08-23", source: "Indicative" },
  { currency: "INR", perHkd: 0.082, asOf: "2026-08-23", source: "Indicative" },
  { currency: "HKD", perHkd: 1, asOf: "2026-08-23", source: "Base" },
];

export const retirement: RetirementScenario = {
  currentAge: 38,
  retireAge: 60,
  deathAge: 90,
  monthlyIncomeNow: 72000,
  monthlySpendNow: 38000,
  targetMonthly: 32000,
  sustainableMonthly: 28400,
  corpusAtRetire: 8420000,
  requiredCorpus: 9180000,
  gap: -760000,
  extraMonthlySaving: 1850,
  preReturn: 0.05,
  postReturn: 0.035,
  inflation: 0.025,
  travelInRetirement: 40000,
  depletes: false,
  mortgagePayoffAge: 56,
  status: "watch",
};

export const allowances: Allowance[] = [
  {
    id: "oaa",
    label: "Old Age Allowance",
    labelZh: "生果金",
    monthly: 1620,
    startAge: 70,
    kind: "oaa",
    inflationAdjusted: true,
  },
];

export const oneOffs: OneOff[] = [
  { id: "edu", label: "Niece education gift", labelZh: "姪女教育金", amount: 150000, direction: "out", age: 45 },
  { id: "inherit", label: "Expected inheritance", labelZh: "預期遺產", amount: 800000, direction: "in", age: 62 },
];

export const monthSummary = {
  income: 113,
  expense: 28640.3,
  net: -28527.3,
  remainingBudget: 12400,
  remainingDisc: 12400,
  dailySpendable: 1550,
  daysLeft: 8,
};

export const netWorthSeries = [
  { month: "2025-09", value: 6280000 },
  { month: "2025-10", value: 6315000 },
  { month: "2025-11", value: 6342000 },
  { month: "2025-12", value: 6410000 },
  { month: "2026-01", value: 6388000 },
  { month: "2026-02", value: 6462000 },
  { month: "2026-03", value: 6524000 },
  { month: "2026-04", value: 6580000 },
  { month: "2026-05", value: 6611000 },
  { month: "2026-06", value: 6694000 },
  { month: "2026-07", value: 6748000 },
  { month: "2026-08", value: 6789386 },
];

export const incomeExpenseSeries = [
  { month: "Mar", income: 72000, expense: 41200 },
  { month: "Apr", income: 72000, expense: 38800 },
  { month: "May", income: 86000, expense: 45100 },
  { month: "Jun", income: 72000, expense: 36500 },
  { month: "Jul", income: 72000, expense: 40200 },
  { month: "Aug", income: 113, expense: 28640 },
];

export const spendingByCategory = [
  { id: "dining", value: 4540 },
  { id: "groceries", value: 2186 },
  { id: "mortgage-i", value: 14580 },
  { id: "mgmt", value: 2180 },
  { id: "mtr", value: 500 },
  { id: "utilities", value: 890 },
  { id: "entertainment", value: 320 },
  { id: "internet", value: 198 },
];

export const cashflowForecast = [
  { month: "Sep", inflow: 72000, outflow: 41200 },
  { month: "Oct", inflow: 72000, outflow: 39800 },
  { month: "Nov", inflow: 72000, outflow: 47800 },
  { month: "Dec", inflow: 92000, outflow: 51200 },
  { month: "Jan", inflow: 72000, outflow: 40600 },
  { month: "Feb", inflow: 72000, outflow: 38900 },
];

export const retirementSeries = [
  { age: 38, assets: 2.62 },
  { age: 42, assets: 3.41 },
  { age: 46, assets: 4.38 },
  { age: 50, assets: 5.52 },
  { age: 54, assets: 6.85 },
  { age: 56, assets: 7.52 },
  { age: 60, assets: 8.42 },
  { age: 65, assets: 8.05 },
  { age: 70, assets: 7.41 },
  { age: 75, assets: 6.48 },
  { age: 80, assets: 5.22 },
  { age: 85, assets: 3.51 },
  { age: 90, assets: 1.18 },
];

export const amortSample = [
  { month: "2026-09", open: 2850000, pay: 14580, interest: 4988, principal: 9592, close: 2840408 },
  { month: "2026-10", open: 2840408, pay: 14580, interest: 4971, principal: 9609, close: 2830799 },
  { month: "2026-11", open: 2830799, pay: 14580, interest: 4954, principal: 9626, close: 2821173 },
  { month: "2026-12", open: 2821173, pay: 14580, interest: 4937, principal: 9643, close: 2811530 },
  { month: "2027-01", open: 2811530, pay: 14580, interest: 4920, principal: 9660, close: 2801870 },
  { month: "2027-02", open: 2801870, pay: 14580, interest: 4903, principal: 9677, close: 2792193 },
];

export const stressTests = [
  { shock: 0.5, payment: 15240, extraInterest: 142000 },
  { shock: 1.0, payment: 15920, extraInterest: 292000 },
  { shock: 2.0, payment: 17340, extraInterest: 618000 },
];

function t(
  partial: Omit<Transaction, "id"> & { id?: string },
): Transaction {
  return {
    id: partial.id ?? `tx-${partial.date}-${partial.payee}-${partial.amount}`,
    ...partial,
  };
}

export const transactions: Transaction[] = [
  t({ id: "tx-int", type: "income", amount: 113, currency: "HKD", accountId: "hsb-save", categoryId: "interest", date: "2026-08-23", payee: "Interest", payeeZh: "利息收入" }),
  t({ id: "tx-din", type: "expense", amount: 454.3, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: "2026-08-22", payee: "Dining out", payeeZh: "外出就餐", tags: ["weekend"] }),
  t({ id: "tx-oct", type: "expense", amount: 500, currency: "HKD", accountId: "hsbc-hkd", toAccountId: "octopus", categoryId: "mtr", date: "2026-08-22", payee: "Octopus top-up", payeeZh: "八達通" }),
  t({ id: "tx-well", type: "expense", amount: 186.4, currency: "HKD", accountId: "hsbc-visa", categoryId: "groceries", date: "2026-08-21", payee: "Wellcome", payeeZh: "惠康" }),
  t({ id: "tx-mtr21", type: "expense", amount: 38.4, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: "2026-08-21", payee: "MTR", payeeZh: "港鐵" }),
  t({ id: "tx-coffee", type: "expense", amount: 48, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: "2026-08-20", payee: "% Arabica", payeeZh: "% Arabica" }),
  t({ id: "tx-clp", type: "expense", amount: 890, currency: "HKD", accountId: "hsbc-hkd", categoryId: "utilities", date: "2026-08-19", payee: "CLP", payeeZh: "中電", tags: ["essential"] }),
  t({ id: "tx-net", type: "expense", amount: 218, currency: "HKD", accountId: "hsbc-visa", categoryId: "internet", date: "2026-08-18", payee: "HGC broadband", payeeZh: "寬頻" }),
  t({ id: "tx-park", type: "expense", amount: 320, currency: "HKD", accountId: "hsbc-visa", categoryId: "entertainment", date: "2026-08-17", payee: "Cinema", payeeZh: "戲院" }),
  t({ id: "tx-park-n", type: "expense", amount: 76.5, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: "2026-08-16", payee: "MTR", payeeZh: "港鐵" }),
  t({ id: "tx-city", type: "expense", amount: 412.8, currency: "HKD", accountId: "hsbc-visa", categoryId: "groceries", date: "2026-08-15", payee: "City'super", payeeZh: "City'super" }),
  t({ id: "tx-yum", type: "expense", amount: 288, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: "2026-08-15", payee: "Dim sum", payeeZh: "點心" }),
  t({ id: "tx-taxi", type: "expense", amount: 128, currency: "HKD", accountId: "hsbc-visa", categoryId: "taxi", date: "2026-08-14", payee: "Uber", payeeZh: "Uber" }),
  t({ id: "tx-miles", type: "miles", amount: 2400, currency: "MILES", accountId: "asia-miles", date: "2026-08-14", payee: "HSBC conversion", payeeZh: "滙豐兌換", milesType: "earn", tripId: "japan-2027" }),
  t({ id: "tx-gp", type: "expense", amount: 450, currency: "HKD", accountId: "hsbc-hkd", categoryId: "medical", date: "2026-08-13", payee: "Family clinic", payeeZh: "家庭醫生" }),
  t({ id: "tx-hkt", type: "expense", amount: 198, currency: "HKD", accountId: "hsbc-visa", categoryId: "internet", date: "2026-08-12", payee: "CSL mobile", payeeZh: "流動電話" }),
  t({ id: "tx-lunch", type: "expense", amount: 78, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: "2026-08-12", payee: "Cafe", payeeZh: "午餐" }),
  t({ id: "tx-ikea", type: "expense", amount: 640, currency: "HKD", accountId: "hsbc-visa", categoryId: "repairs", date: "2026-08-11", payee: "IKEA", payeeZh: "宜家", tags: ["Renovation"] }),
  t({ id: "tx-bus", type: "expense", amount: 24.6, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: "2026-08-10", payee: "KMB", payeeZh: "九巴" }),
  t({ id: "tx-market", type: "expense", amount: 156, currency: "HKD", accountId: "hsbc-hkd", categoryId: "groceries", date: "2026-08-09", payee: "Wet market", payeeZh: "街市" }),
  t({ id: "tx-dinner", type: "expense", amount: 980, currency: "HKD", accountId: "hsbc-visa", categoryId: "dining", date: "2026-08-08", payee: "Japanese dinner", payeeZh: "日本菜", tags: ["Japan2027"] }),
  t({ id: "tx-mgmt", type: "expense", amount: 2180, currency: "HKD", accountId: "hsbc-hkd", categoryId: "mgmt", date: "2026-08-07", payee: "Estate mgmt", payeeZh: "管理費" }),
  t({ id: "tx-mort", type: "expense", amount: 14580, currency: "HKD", accountId: "hsb-save", categoryId: "mortgage-i", date: "2026-08-06", payee: "Hang Seng mortgage", payeeZh: "恒生按揭" }),
  t({ id: "tx-hair", type: "expense", amount: 280, currency: "HKD", accountId: "hsbc-visa", categoryId: "personal", date: "2026-08-05", payee: "Salon", payeeZh: "理髮" }),
  t({ id: "tx-park5", type: "expense", amount: 42, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: "2026-08-04", payee: "MTR", payeeZh: "港鐵" }),
  t({ id: "tx-books", type: "expense", amount: 210, currency: "HKD", accountId: "hsbc-visa", categoryId: "education", date: "2026-08-03", payee: "Commercial Press", payeeZh: "商務印書館" }),
  t({ id: "tx-park2", type: "expense", amount: 51.2, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: "2026-08-02", payee: "MTR", payeeZh: "港鐵" }),
  t({ id: "tx-park1", type: "expense", amount: 18, currency: "HKD", accountId: "octopus", categoryId: "mtr", date: "2026-08-01", payee: "MTR", payeeZh: "港鐵" }),
  t({ id: "tx-salary-jul", type: "income", amount: 72000, currency: "HKD", accountId: "bochk", categoryId: "salary", date: "2026-07-28", payee: "Employer", payeeZh: "公司薪金" }),
  t({ id: "tx-travel-fund", type: "transfer", amount: 3500, currency: "HKD", accountId: "bochk", toAccountId: "hsb-save", date: "2026-07-29", payee: "Travel fund", payeeZh: "旅遊儲蓄" }),
  t({ id: "tx-tpe-hotel", type: "expense", amount: 2100, currency: "HKD", accountId: "hsbc-visa", categoryId: "hotels", date: "2026-07-12", payee: "Taipei hotel deposit", payeeZh: "台北酒店訂金", tripId: "taipei-2026" }),
  t({ id: "tx-miles-burn", type: "miles", amount: 15000, currency: "MILES", accountId: "asia-miles", date: "2026-07-12", payee: "Award hold", payeeZh: "兌換預留", milesType: "burn", tripId: "taipei-2026" }),
  t({ id: "tx-plan-mobile", type: "expense", amount: 198, currency: "HKD", accountId: "hsbc-visa", categoryId: "internet", date: "2026-08-26", payee: "CSL mobile", payeeZh: "流動電話", planned: true, recurringId: "r-mobile" }),
  t({ id: "tx-plan-salary", type: "income", amount: 72000, currency: "HKD", accountId: "bochk", categoryId: "salary", date: "2026-08-28", payee: "Employer", payeeZh: "公司薪金", planned: true }),
];

export const plannedDates = new Set(["2026-08-26", "2026-08-28"]);

export function toHkd(amount: number, currency: Account["currency"]): number {
  if (currency === "MILES") return 0;
  const row = fxRates.find((r) => r.currency === currency);
  return amount * (row?.perHkd ?? 1);
}

export function netWorthNow() {
  let assets = 0;
  let liab = 0;
  for (const a of accounts) {
    if (!a.includeInNetWorth || a.currency === "MILES") continue;
    const hkd = toHkd(a.balance, a.currency);
    if (hkd >= 0) assets += hkd;
    else liab += -hkd;
  }
  return { assets, liab, net: assets - liab };
}

export function accountById(id: string) {
  return accounts.find((a) => a.id === id);
}

export function categoryById(id?: string) {
  return categories.find((c) => c.id === id);
}

export function txsOn(iso: string) {
  return transactions.filter((t) => t.date === iso);
}

export function datesWithActivity() {
  const set = new Set<string>();
  for (const t of transactions) {
    if (!t.planned) set.add(t.date);
  }
  return set;
}
