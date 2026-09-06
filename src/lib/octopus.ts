import type { Category } from "./types";

export type OctopusKind = "expense" | "topup";

export type OctopusDraft = {
  id: string;
  merchant: string;
  date: string;
  time?: string;
  amount: number;
  kind: OctopusKind;
  categoryId?: string;
  skip: boolean;
};

const SKIP_LINE =
  /餘額|交易紀錄|消費摘要|Main|HKD|八達通卡有限公司$|^八達通$|交易記錄|消費|摘要|餘額|選擇類型|記錄/;

const DATE_RE = /(\d{4})[-/.](\d{2})[-/.](\d{2})(?:\s+(\d{2}):(\d{2}))?/;
const AMOUNT_RE = /^([+-])?\s*(\d{1,6}(?:\.\d{1,2})?)$/;

export function guessOctopusCategory(merchant: string, categories: Category[]): string | undefined {
  const m = merchant.toLowerCase();
  const rules: { re: RegExp; ids: string[] }[] = [
    { re: /港鐵|mtr|九巴|龍運|城巴|新巴|巴士|電車|tram|小巴|專線/, ids: ["mtr"] },
    { re: /餐飲|會所|大快活|太興|美心|咖啡|茶餐廳|mcdonald|麥當勞|kfc|肯德基|瑞幸|星巴克|大家樂|café|cafe|飲食/, ids: ["dining"] },
    { re: /百佳|惠康|超市|萬寧|屈臣|market|7-11|7eleven|便利/, ids: ["grocery", "shop"] },
  ];
  const want = rules.find((r) => r.re.test(m))?.ids ?? [];
  for (const id of want) {
    if (categories.some((c) => c.id === id && c.kind === "expense")) return id;
  }
  const byName = categories.find((c) => {
    if (c.kind !== "expense") return false;
    const n = `${c.name} ${c.nameZh}`.toLowerCase();
    return want.some((id) => n.includes(id)) || n.includes(merchant.slice(0, 2).toLowerCase());
  });
  return byName?.id ?? categories.find((c) => c.kind === "expense" && !c.parentId)?.id;
}

export function parseOctopusText(text: string, categories: Category[]): OctopusDraft[] {
  const raw = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const rows: OctopusDraft[] = [];
  let pending: string[] = [];
  function flush(amount: number, sign: string, date: string, time?: string) {
    const merchant = pending.filter((l) => !SKIP_LINE.test(l) && !DATE_RE.test(l) && !AMOUNT_RE.test(l.replace(/,/g, ""))).at(-1) ?? "八達通";
    pending = [];
    if (amount === 0) return;
    const kind: OctopusKind = sign === "+" || /八達通卡有限公司|增值|自動增值/.test(merchant) ? "topup" : "expense";
    const key = `${date}|${time ?? ""}|${merchant}|${amount}|${kind}`;
    if (rows.some((r) => `${r.date}|${r.time ?? ""}|${r.merchant}|${r.amount}|${r.kind}` === key)) return;
    rows.push({
      id: key,
      merchant,
      date,
      time,
      amount,
      kind: kind === "topup" ? "topup" : "expense",
      categoryId: kind === "expense" ? guessOctopusCategory(merchant, categories) : undefined,
      skip: false,
    });
  }

  for (const line of raw) {
    if (SKIP_LINE.test(line) && !/八達通卡有限公司/.test(line)) continue;
    const dateM = line.match(DATE_RE);
    if (dateM) {
      pending.push(line);
      continue;
    }
    const amtLine = line.replace(/,/g, "").replace(/HKD/i, "").trim();
    const amtM = amtLine.match(AMOUNT_RE);
    if (amtM) {
      const dateLine = [...pending].reverse().find((l) => DATE_RE.test(l));
      const dm = dateLine?.match(DATE_RE);
      const date = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : "";
      const time = dm?.[4] ? `${dm[4]}:${dm[5]}` : undefined;
      const sign = amtM[1] ?? (Number(amtM[2]) === 0 ? "+" : "-");
      flush(Number(amtM[2]), sign, date, time);
      continue;
    }
    pending.push(line);
  }
  return rows;
}

const SETTINGS_KEY = "hk-life-money-octopus";

export type OctopusSettings = {
  accountId?: string;
  fromAccountId?: string;
};

export function readOctopusSettings(): OctopusSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as OctopusSettings;
  } catch {
    return {};
  }
}

export function writeOctopusSettings(next: OctopusSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function suggestOctopusAccountId(accounts: { id: string; name: string; nameZh: string; type: string }[]): string | undefined {
  return accounts.find((a) => /八達通|octopus/i.test(`${a.name}${a.nameZh}`))?.id
    ?? accounts.find((a) => a.type === "ewallet")?.id;
}
