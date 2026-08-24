import type {
  Account,
  AccountGroup,
  AccountType,
  Budget,
  Category,
  CategoryIconName,
  Currency,
  FxRate,
  Goal,
  LifeTheme,
  MoneyUnit,
  Mortgage,
  Recurring,
  Transaction,
} from "@/lib/types";
import { CURRENCIES, MONTH_TOTAL_BUDGET_ID } from "@/lib/types";
import { applyDeltas, balanceDeltas } from "@/lib/calc/ledger";
import type { AppSnapshot } from "@/store/app";
import { childLabel, collapseRepeatedLabel, parentCategoryName } from "@/lib/categories";
import { endMonthFromRemaining } from "@/lib/calc/mortgage";

type BtpAccount = {
  id: string;
  name: string;
  kind: string;
  currency: string;
  balance: number;
  mortgage: number;
  hidden?: boolean;
};

type BtpTx = {
  id: string;
  iso: string;
  account: string;
  category: string;
  description: string;
  type: string;
  currency: string;
  amountOriginal: number;
  amountHKD: number;
};

type BtpRegular = { id: string; name: string; amount: number; day: number };

export type BtpFile = {
  app?: string;
  version?: number;
  exportedAt?: string;
  budget?: {
    monthly?: Record<string, { budget?: number; expenses?: number; salary?: number }>;
    regular?: BtpRegular[];
    accounts?: BtpAccount[];
    transactions?: BtpTx[];
    rates?: Record<string, number | Record<string, number>>;
    goal?: { target?: number };
  };
  ledger?: {
    transactions?: BtpTx[];
    accounts?: BtpAccount[];
    rates?: Record<string, number | Record<string, number>>;
    goal?: { target?: number };
  };
};

export function isBtpFile(data: unknown): data is BtpFile {
  if (!data || typeof data !== "object") return false;
  const d = data as BtpFile;
  if (d.app === "Budget Tracker Pro") return true;
  return Array.isArray(d.ledger?.transactions) || Array.isArray(d.budget?.transactions);
}

export function isAppSnapshot(data: unknown): data is AppSnapshot {
  if (!data || typeof data !== "object") return false;
  const d = data as AppSnapshot;
  return (
    Array.isArray(d.accounts) &&
    Array.isArray(d.transactions) &&
    Array.isArray(d.categories) &&
    typeof d.schemaVersion === "number"
  );
}

export function cleanCategoryLabel(raw: string): string {
  return collapseRepeatedLabel(raw);
}

export function categoryIdFromLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `cat-${slug || "uncat"}`;
}

function asCurrency(raw: string): Currency {
  const c = raw.toUpperCase();
  return (CURRENCIES as string[]).includes(c) ? (c as Currency) : "HKD";
}

function themeFor(label: string, kind: "expense" | "income"): LifeTheme {
  if (kind === "income") {
    if (/利息|股息|年金|強積金|mpf/i.test(label)) return "retirement";
    return "other";
  }
  if (/^旅遊/.test(label) || /機票|酒店|住宿/.test(label)) return "travel";
  if (/儲蓄保險|強積金|退休/.test(label)) return "retirement";
  if (/住宅|家居|公用事業|家用|八達通|外出就餐|按揭|管理費|水電|寬頻/.test(label)) return "living";
  return "other";
}

function kindFor(label: string, txType: string): "expense" | "income" {
  if (txType === "income") return "income";
  if (/收入|工資|薪金|股息|贈與|租賃|經營/.test(label) && !/稅/.test(label)) return "income";
  if (/利是/.test(label) && /禮物/.test(label)) return "income";
  return "expense";
}

function iconFor(label: string, kind: "expense" | "income"): CategoryIconName {
  if (kind === "income") {
    if (/股息/.test(label)) return "coins";
    if (/利息/.test(label)) return "piggy";
    if (/工資|薪/.test(label)) return "briefcase";
    if (/贈|利是|禮物/.test(label)) return "gift";
    return "wallet";
  }
  if (/外出就餐|膳食|食物|咖啡/.test(label) && !/家居/.test(label)) return "utensils";
  if (/^八達通$/.test(label)) return "repeat";
  if (/購物|服裝|玩具|電器|攝影/.test(label)) return "bag";
  if (/八達通|交通|地面|港鐵|巴士/.test(label)) return "train";
  if (/空中|機票/.test(label)) return "plane";
  if (/^旅遊$/.test(label) || /旅遊:/.test(label)) return "plane";
  if (/住宿/.test(label)) return "tent";
  if (/酒店/.test(label)) return "building";
  if (/住宅|按揭|抵押|裝修/.test(label)) return "home";
  if (/債務/.test(label)) return "clock";
  if (/家居和食物/.test(label)) return "broom";
  if (/家庭和個人|剪髮|個人/.test(label)) return "user";
  if (/娛樂|電影|遊戲|Netflix|YouTube|Spotify|Disney/i.test(label)) return "gamepad";
  if (/稅|地租/.test(label)) return "landmark";
  if (/醫療|藥|寵物|驗身/.test(label)) return "heart";
  if (/電話|網際|寬頻|行動/.test(label)) return "wifi";
  if (/電氣|用水|天然氣|公用/.test(label)) return "zap";
  if (/學習|教育/.test(label)) return "graduation";
  if (/維護|修理/.test(label)) return "wrench";
  if (/入場/.test(label)) return "ticket";
  if (/保險/.test(label)) return "umbrella";
  if (/禮物/.test(label)) return "gift";
  if (/股票|投資/.test(label)) return "coins";
  if (/雜項/.test(label)) return "shopping";
  if (/管理費/.test(label)) return "building";
  if (/證件/.test(label)) return "file";
  if (/膳食/.test(label)) return "cup";
  return "wallet";
}

function accountType(a: BtpAccount): { type: AccountType; group: AccountGroup } {
  if (a.kind === "credit") return { type: "credit", group: "credit" };
  if (a.kind === "property") return { type: "property", group: "housing" };
  if (a.kind === "asset") return { type: "investment", group: "assets" };
  if (a.currency !== "HKD") return { type: "fx", group: "cash" };
  if (/cash|現金|利是|payme/i.test(a.name)) return { type: "cash", group: "cash" };
  return { type: "current", group: "cash" };
}

function parseArrowTarget(description: string, arrow: "→" | "←"): string {
  const d = description ?? "";
  const i = d.lastIndexOf(arrow);
  if (i < 0) return "";
  return d.slice(i + arrow.length).trim();
}

export function convertBtp(data: BtpFile): AppSnapshot {
  const srcAccounts = data.ledger?.accounts?.length
    ? data.ledger.accounts
    : data.budget?.accounts ?? [];
  const rawTxs = data.ledger?.transactions?.length
    ? data.ledger.transactions
    : data.budget?.transactions ?? [];
  const asOf = (data.exportedAt ?? new Date().toISOString()).slice(0, 10);

  const accounts: Account[] = srcAccounts.map((a) => {
    const { type, group } = accountType(a);
    return {
      id: a.id,
      name: a.name,
      nameZh: a.name,
      type,
      currency: a.currency === "MILES" ? "MILES" : asCurrency(a.currency),
      balance: type === "property" ? a.balance : 0,
      includeInNetWorth: !a.hidden,
      hidden: Boolean(a.hidden),
      group,
      notes: a.hidden ? "Hidden in source" : undefined,
    };
  });

  const byName = new Map(accounts.map((a) => [a.name, a]));

  for (const a of srcAccounts) {
    if (a.kind === "property" && a.mortgage > 0) {
      const id = `${a.id}-mortgage`;
      if (!accounts.some((x) => x.id === id)) {
        accounts.push({
          id,
          name: `${a.name} 按揭`,
          nameZh: `${a.name} 按揭`,
          type: "mortgage",
          currency: "HKD",
          balance: -Math.abs(a.mortgage),
          includeInNetWorth: true,
          group: "housing",
          institution: a.name,
        });
      }
    }
  }

  const categories = new Map<string, Category>();
  function ensureCat(label: string, txType: string): string | undefined {
    const raw = cleanCategoryLabel(label);
    if (!raw) return undefined;
    const parentName = parentCategoryName(raw);
    const childName = childLabel(raw);
    const hasChild = Boolean(childName && parentName && childName !== raw);
    const kind = kindFor(raw, txType);

    let parentId: string | undefined;
    if (hasChild) {
      parentId = categoryIdFromLabel(parentName);
      if (!categories.has(parentId)) {
        categories.set(parentId, {
          id: parentId,
          name: parentName,
          nameZh: parentName,
          theme: themeFor(parentName, kind),
          kind,
          icon: iconFor(parentName, kind),
          essential: /按揭|管理費|保險|公用|工資/.test(parentName),
        });
      }
    }

    const id = categoryIdFromLabel(raw);
    if (!categories.has(id)) {
      categories.set(id, {
        id,
        name: hasChild ? childName : raw,
        nameZh: hasChild ? childName : raw,
        theme: themeFor(raw, kind),
        kind,
        icon: iconFor(raw, kind),
        essential: /按揭|管理費|保險|公用|工資/.test(raw),
        parentId,
      });
    }
    return id;
  }

  const usedIncoming = new Set<string>();
  const outgoing = rawTxs.filter((t) => t.type === "transfer" && (t.description ?? "").includes("→"));
  const incoming = rawTxs.filter((t) => t.type === "transfer" && (t.description ?? "").includes("←"));

  function matchIncoming(out: BtpTx): BtpTx | undefined {
    const toName = parseArrowTarget(out.description, "→");
    return incoming.find(
      (inn) =>
        !usedIncoming.has(inn.id) &&
        inn.iso === out.iso &&
        inn.currency === out.currency &&
        Math.abs(inn.amountOriginal - out.amountOriginal) < 0.005 &&
        (inn.account === toName || parseArrowTarget(inn.description, "←") === out.account),
    );
  }

  const transactions: Transaction[] = [];

  for (const t of rawTxs) {
    if (t.type === "transfer" && (t.description ?? "").includes("←")) continue;
    const from = byName.get(t.account);
    if (!from) continue;
    const currency: MoneyUnit = t.currency === "MILES" ? "MILES" : asCurrency(t.currency);
    const amount = Math.abs(t.amountOriginal);
    const fxToHkd =
      currency !== "HKD" && currency !== "MILES" && amount > 0 ? Math.abs(t.amountHKD) / amount : undefined;

    if (t.type === "transfer") {
      const inn = matchIncoming(t);
      if (inn) usedIncoming.add(inn.id);
      const toName = inn?.account || parseArrowTarget(t.description, "→");
      const to = toName ? byName.get(toName) : undefined;
      transactions.push({
        id: t.id,
        type: "transfer",
        amount,
        currency,
        accountId: from.id,
        toAccountId: to?.id,
        destAmount: to ? (to.currency === currency ? amount : Math.abs(inn?.amountOriginal ?? amount)) : undefined,
        date: t.iso,
        payee: toName ? `→ ${toName}` : t.description || "Transfer",
        payeeZh: toName ? `→ ${toName}` : t.description || "轉帳",
        note: t.description || undefined,
        fxToHkd,
      });
      continue;
    }

    const type = t.type === "income" ? "income" : "expense";
    const categoryId = ensureCat(t.category, type);
    const payee = (t.description || "").replace(/^自動產生的交易\s*/, "").trim() || t.category || type;
    transactions.push({
      id: t.id,
      type,
      amount,
      currency,
      accountId: from.id,
      categoryId,
      date: t.iso,
      payee,
      payeeZh: payee,
      note: t.description || undefined,
      fxToHkd,
    });
  }

  const catAccountCount = new Map<string, Map<string, number>>();
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    let m = catAccountCount.get(tx.categoryId);
    if (!m) {
      m = new Map();
      catAccountCount.set(tx.categoryId, m);
    }
    m.set(tx.accountId, (m.get(tx.accountId) ?? 0) + 1);
  }
  for (const cat of categories.values()) {
    const m = catAccountCount.get(cat.id);
    if (!m) continue;
    let best = "";
    let n = 0;
    for (const [id, c] of m) {
      if (c > n) {
        best = id;
        n = c;
      }
    }
    if (best) cat.defaultAccountId = best;
  }

  let nextAccounts = accounts.map((a) => ({ ...a }));
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const tx of sorted) {
    nextAccounts = applyDeltas(nextAccounts, balanceDeltas(tx));
  }
  for (const src of srcAccounts) {
    if (src.kind === "property") {
      nextAccounts = nextAccounts.map((a) => (a.id === src.id ? { ...a, balance: src.balance } : a));
      if (src.mortgage > 0) {
        const mid = `${src.id}-mortgage`;
        nextAccounts = nextAccounts.map((a) =>
          a.id === mid ? { ...a, balance: -Math.abs(src.mortgage) } : a,
        );
      }
    }
  }

  const ratesIn = data.ledger?.rates ?? data.budget?.rates ?? {};
  const fxRates: FxRate[] = [{ currency: "HKD", perHkd: 1, asOf, source: "Base" }];
  const flat: Record<string, number> = {};
  for (const [k, v] of Object.entries(ratesIn)) {
    if (typeof v === "number") flat[k] = v;
    else if (v && typeof v === "object") Object.assign(flat, v);
  }
  for (const c of CURRENCIES) {
    if (c === "HKD") continue;
    const perHkdUnit = flat[c];
    if (!perHkdUnit) continue;
    fxRates.push({
      currency: c,
      perHkd: 1 / perHkdUnit,
      asOf,
      source: "Budget Tracker Pro",
    });
  }

  const months = Object.keys(data.budget?.monthly ?? {}).sort();
  const latestMonth = months[months.length - 1];
  const monthlyCap = latestMonth ? data.budget?.monthly?.[latestMonth]?.budget ?? 0 : 0;
  const budgets: Budget[] = [
    {
      id: MONTH_TOTAL_BUDGET_ID,
      label: "Monthly total",
      labelZh: "本月總額",
      monthly: monthlyCap || 0,
      spent: 0,
    },
  ];

  const fallbackAccount =
    nextAccounts.find((a) => a.currency === "HKD" && a.type === "current")?.id ?? nextAccounts[0]?.id ?? "";
  const recurring: Recurring[] = (data.budget?.regular ?? []).map((r) => {
    const day = String(Math.min(28, Math.max(1, r.day))).padStart(2, "0");
    const now = new Date();
    let next = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${day}`;
    if (next < now.toISOString().slice(0, 10)) {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, r.day);
      next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return {
      id: r.id,
      type: "expense" as const,
      label: r.name,
      labelZh: r.name,
      amount: r.amount,
      currency: "HKD" as const,
      accountId: fallbackAccount,
      frequency: "monthly" as const,
      nextDate: next,
      chargedDay: Math.min(28, Math.max(1, r.day)),
      essential: /mortgage|parent|management|insurance|按揭|管理|保險/i.test(r.name),
      living: /mortgage|parent|management|按揭|管理費|差餉|地租|水電|家居保險|住宅/i.test(r.name),
    };
  });

  const property = srcAccounts.find((a) => a.kind === "property" && a.mortgage > 0);
  const mortgage: Mortgage[] = property
    ? [
        {
          id: "imported-mortgage",
          accountId: `${property.id}-mortgage`,
          propertyAccountId: property.id,
          lender: property.name,
          lenderZh: property.name,
          original: Math.abs(property.mortgage),
          outstanding: Math.abs(property.mortgage),
          remainingMonths: 216,
          endDate: endMonthFromRemaining(216),
          rateType: "P",
          benchmark: 5.25,
          adjustment: -3.15,
          effectiveRate: 2.1,
          monthlyPayment: data.budget?.regular?.find((r) => /mortgage|按揭/i.test(r.name))?.amount ?? 14155,
          paymentAccountId: fallbackAccount,
        },
      ]
    : [];

  const goals: Goal[] = [
    {
      id: "savings",
      name: "Savings",
      nameZh: "儲蓄",
      current: 0,
      target: data.ledger?.goal?.target ?? data.budget?.goal?.target ?? 1_000_000,
      currency: "HKD",
      change30: 0,
    },
  ];

  const travelBudget =
    (data.budget?.regular ?? []).filter((r) => /travel|旅遊/i.test(r.name)).reduce((s, r) => s + r.amount, 0) * 12 ||
    80000;

  return {
    schemaVersion: 1,
    exportedAt: data.exportedAt ?? new Date().toISOString(),
    accounts: nextAccounts,
    categories: [...categories.values()],
    transactions,
    recurring,
    budgets,
    trips: [],
    goals,
    mortgage,
    retirement: [],
    allowances: [],
    oneOffs: [],
    fxRates,
    snapshots: [],
    annualTravelBudget: travelBudget,
  };
}
