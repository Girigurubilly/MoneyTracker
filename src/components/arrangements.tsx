import { useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Overlay } from "@/components/shared";
import { blankArrangement, reviewArrangements } from "@/lib/calc/arrangements";
import type { ArrangementAlertCode } from "@/lib/calc/arrangements";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import type { Account, ProductArrangement, RateStep } from "@/lib/types";
import { newId, useApp } from "@/store/app";
import { useUi } from "@/store/ui";

const copy = {
  en: {
    title: "Savings arrangements",
    hint: "A rate rule on an account you already have. It does not add money or post interest.",
    addPromo: "Promotional rate",
    addOffset: "Mortgage-linked",
    empty: "None yet. Add one only if a bank rate depends on a rule.",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    name: "Name",
    nameHint: "For example, Marathon savings",
    promo: "Promotional rate",
    offset: "Mortgage-linked",
    parent: "Which account",
    balance: "Balance in this rule",
    balanceHint: "Leave blank if you are not sure.",
    inside: "Is this balance already in that account?",
    included: "Yes. Do not count it again",
    excluded: "No. It is separate",
    unsure: "Not sure",
    start: "Starts",
    rate: "Promotional rate (%)",
    cap: "Highest balance that earns this rate",
    expiry: "Promotional rate ends",
    expiryHint: "The money stays. Only the rate ends.",
    post: "Rate after that (%)",
    earns: "Which balance earns the rate?",
    earnsAll: "The balance above, up to the cap",
    earnsNew: "New funds only",
    mortgage: "Which mortgage",
    spread: "Extra on the mortgage rate (percentage points)",
    spreadHint: "0 means the same as the mortgage. Leave blank if you have not checked.",
    capBasis: "What is the cap?",
    stated: "The amount I enter",
    outstanding: "Whatever is still owed on the mortgage",
    more: "More details",
    less: "Hide extra details",
    child: "Separate account, if this rule uses one",
    none: "None",
    withdrawal: "What happens if you withdraw",
    credits: "Dates interest is credited",
    creditsHint: "Comma-separated. Leave blank if you do not know.",
    schedule: "Another rate period",
    from: "From",
    to: "To",
    addStep: "Add another period",
    excess: "Rate above the cap (%)",
    group: "Shared cap name",
    groupHint: "Use the same name on each account that shares one cap.",
    allocation: "This account's share of that cap",
    dayCount: "How to estimate interest",
    dayOff: "Do not estimate",
    dayOn: "Actual days ÷ 365",
    daily: "Daily balances",
    dailyHint: "Optional. One line: date, balance, yes. Missing days stay missing.",
    review: "Look at these terms again on",
    estimate: "Estimate for",
    estimateHint: "This does not change any balance.",
    unknown: "Not set",
  },
  "zh-HK": {
    title: "儲蓄安排",
    hint: "掛在你已有戶口上的利率規則。唔會多一筆錢，亦唔會自動入帳。",
    addPromo: "推廣利率",
    addOffset: "跟按揭利率",
    empty: "未有。只有銀行利率要跟某項規則先需要加。",
    save: "儲存",
    cancel: "取消",
    delete: "刪除",
    name: "名稱",
    nameHint: "例如馬拉松儲蓄",
    promo: "推廣利率",
    offset: "跟按揭利率",
    parent: "哪個戶口",
    balance: "這項規則下的結餘",
    balanceHint: "未肯定就留空。",
    inside: "這筆結餘是不是已經在戶口餘額裡？",
    included: "是，不要再計多次",
    excluded: "不是，這是另一筆",
    unsure: "未肯定",
    start: "開始",
    rate: "推廣年利率 (%)",
    cap: "最多幾多結餘可享這個利率",
    expiry: "推廣利率結束",
    expiryHint: "錢仍在，只是利率結束。",
    post: "結束後的年利率 (%)",
    earns: "邊筆結餘可享利率？",
    earnsAll: "上面的結餘，以上限為準",
    earnsNew: "只計新資金",
    mortgage: "哪筆按揭",
    spread: "比按揭利率高或低幾多（百分點）",
    spreadHint: "0 代表跟按揭一樣。未核對就留空。",
    capBasis: "上限是甚麼？",
    stated: "我填一個金額",
    outstanding: "跟按揭未還本金",
    more: "更多資料",
    less: "收起",
    child: "如果規則用另一個已有戶口",
    none: "無",
    withdrawal: "提款會怎樣",
    credits: "利息入帳日",
    creditsHint: "用逗號分開。不知道就留空。",
    schedule: "另一段利率",
    from: "由",
    to: "至",
    addStep: "加另一段",
    excess: "超出上限的年利率 (%)",
    group: "共用上限的名稱",
    groupHint: "幾個戶口共用一個上限時，填同一個名稱。",
    allocation: "這個戶口佔用幾多",
    dayCount: "點估算利息",
    dayOff: "不估算",
    dayOn: "實際日數 ÷ 365",
    daily: "每日結餘",
    dailyHint: "可留空。每行：日期, 結餘, yes。缺的日子不會補。",
    review: "這天再看一次條款",
    estimate: "估算期間",
    estimateHint: "不會改任何結餘。",
    unknown: "未填",
  },
} as const;

const alertText: Record<ArrangementAlertCode, { en: string; "zh-HK": string }> = {
  "promo-expired": { en: "Promotional rate has ended", "zh-HK": "推廣利率已結束" },
  "rate-expiry-unknown": { en: "No end date for the rate", "zh-HK": "未填利率結束日" },
  "terms-unverified": { en: "Rate rule is incomplete", "zh-HK": "利率規則未填完" },
  "terms-stale": { en: "Time to check the terms again", "zh-HK": "條款到了覆核日" },
  "terms-overlap": { en: "Two periods cover the same date", "zh-HK": "兩段日期重疊" },
  "cap-breach": { en: "Balance is over the cap", "zh-HK": "結餘超出上限" },
  "cap-unknown": { en: "Cap is not set", "zh-HK": "未填上限" },
  "cap-mismatch": { en: "Shared accounts use different caps", "zh-HK": "共用上限的金額不一致" },
  "cap-allocation-unknown": { en: "Share of the cap is not set", "zh-HK": "未填分佔上限" },
  "rate-unknown": { en: "No rate to use", "zh-HK": "未有可用利率" },
  "inclusion-unknown": { en: "Not sure if the balance is already in the account", "zh-HK": "未說明結餘是否已在戶口內" },
  "balance-unknown": { en: "Balance is not set", "zh-HK": "未填結餘" },
  "parent-short": { en: "The rules add up to more than the account", "zh-HK": "安排合計多過戶口結餘" },
  "child-in-net-worth": { en: "The other account may count the same money", "zh-HK": "另一個戶口可能計重同一筆錢" },
  "eligibility-unknown": { en: "Not sure which balance earns the rate", "zh-HK": "未說明邊筆結餘可享利率" },
};

function num(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPercentInput(rate: number | null): string {
  if (rate == null) return "";
  const pct = Math.abs(rate) > 1 ? rate : rate * 100;
  return String(Math.round(pct * 10000) / 10000);
}

function fromPercent(value: string): number | null {
  const n = num(value);
  return n == null ? null : n / 100;
}

export function ArrangementsSection() {
  const locale = useUi((s) => s.locale);
  const t = copy[locale];
  const rows = useApp((s) => s.arrangements);
  const accounts = useApp((s) => s.accounts);
  const mortgage = useApp((s) => s.mortgage);
  const [editing, setEditing] = useState<ProductArrangement | null>(null);
  const review = useMemo(
    () => reviewArrangements({ arrangements: rows, accounts, mortgages: mortgage ? [mortgage] : [], asOf: todayISO() }),
    [rows, accounts, mortgage],
  );
  const usable = accounts.filter((a) => a.currency !== "MILES" && !a.hidden);

  function start(kind: ProductArrangement["kind"]) {
    const accountId = usable.find((a) => a.type === "savings" || a.type === "current")?.id ?? usable[0]?.id ?? "";
    const row = blankArrangement(kind, accountId, newId());
    if (kind === "mortgage_linked_savings" && mortgage) row.mortgageId = mortgage.id;
    setEditing(row);
  }

  return (
    <section className="mx-4 mb-5 rounded-2xl bg-elevated px-4 py-3">
      <h2 className="text-sm font-semibold">{t.title}</h2>
      <p className="mt-1 text-[11px] leading-4 text-muted">{t.hint}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="flex h-11 items-center justify-center gap-1 rounded-xl bg-background text-sm font-medium" onClick={() => start("promotional_savings")}>
          <Plus className="size-4" />
          {t.addPromo}
        </button>
        <button type="button" className="flex h-11 items-center justify-center gap-1 rounded-xl bg-background text-sm font-medium" onClick={() => start("mortgage_linked_savings")}>
          <Plus className="size-4" />
          {t.addOffset}
        </button>
      </div>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">{t.empty}</p> : null}
      <ul>
        {review.views.map((row) => {
          const account = accounts.find((a) => a.id === row.parentAccountId);
          const notes = row.alerts.slice(0, 2).map((code) => alertText[code][locale]);
          return (
            <li key={row.id} className="border-t border-line py-3">
              <button type="button" className="w-full text-left" onClick={() => setEditing(rows.find((r) => r.id === row.id) ?? null)}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{row.name || (row.kind === "promotional_savings" ? t.promo : t.offset)}</span>
                  <span className="text-sm tabular-nums">{row.attributedBalance == null ? t.unknown : money(row.attributedBalance, row.currency)}</span>
                </div>
                <div className="mt-1 text-[11px] leading-4 text-muted">
                  {account ? pickName(locale, account.name, account.nameZh) : t.unknown}
                  {" · "}
                  {row.rateLabel === "unknown" ? t.unknown : `${toPercentInput(Number(row.rateLabel))}%`}
                  {row.rateExpiry ? ` · ${row.rateExpiry}` : ""}
                </div>
                {notes.length ? <div className="mt-1 text-[11px] leading-4 text-expense">{notes.join(" · ")}</div> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {editing ? <ArrangementForm initial={editing} accounts={usable} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function ArrangementForm({ initial, accounts, onClose }: { initial: ProductArrangement; accounts: Account[]; onClose: () => void }) {
  const locale = useUi((s) => s.locale);
  const t = copy[locale];
  const save = useApp((s) => s.upsertArrangement);
  const remove = useApp((s) => s.deleteArrangement);
  const mortgage = useApp((s) => s.mortgage);
  const [row, setRow] = useState(initial);
  const [rateText, setRateText] = useState(toPercentInput(initial.rateSchedule[0]?.annualRate ?? null));
  const [postText, setPostText] = useState(toPercentInput(initial.postPromoRate));
  const [spreadText, setSpreadText] = useState(toPercentInput(initial.mortgageSpread));
  const [excessText, setExcessText] = useState(toPercentInput(initial.excessRate));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dailyText, setDailyText] = useState(initial.dailyBalances.map((p) => `${p.date}, ${p.balance}, ${p.reliable ? "yes" : "no"}`).join("\n"));
  const [more, setMore] = useState(Boolean(initial.childAccountId || initial.dailyBalances.length || initial.rateSchedule.length > 1 || initial.capGroup || initial.reviewBy || initial.withdrawal.note));
  const patch = (next: Partial<ProductArrangement>) => setRow((prev) => ({ ...prev, ...next }));
  const draft = prepared(row, rateText, postText, spreadText, excessText, dailyText);
  const estimate = useMemo(() => {
    if (!from || !to) return null;
    return reviewArrangements({
      arrangements: [draft],
      accounts,
      mortgages: mortgage ? [mortgage] : [],
      asOf: to,
      period: { from, to },
    }).views[0];
  }, [draft, from, to, accounts, mortgage]);

  function commit() {
    const parent = accounts.find((a) => a.id === draft.parentAccountId);
    const currency = parent && parent.currency !== "MILES" ? parent.currency : draft.currency;
    void save({ ...draft, currency, childAccountId: draft.childAccountId || undefined }).then(onClose);
  }

  const promo = row.kind === "promotional_savings";

  return (
    <Overlay open onClose={onClose} title={promo ? t.promo : t.offset} variant="page">
      <div className="space-y-3 px-4 pb-8">
        <Field label={t.name} hint={t.nameHint} value={row.name} onChange={(name) => patch({ name })} />
        <AccountSelect label={t.parent} accounts={accounts} value={row.parentAccountId} onChange={(parentAccountId) => patch({ parentAccountId })} />
        <Field label={t.balance} hint={t.balanceHint} value={row.attributedBalance ?? ""} onChange={(v) => patch({ attributedBalance: num(v) })} inputMode="decimal" />
        <Choice
          label={t.inside}
          value={row.countsInParent}
          options={[
            ["included", t.included],
            ["excluded", t.excluded],
            ["unknown", t.unsure],
          ]}
          onChange={(countsInParent) => patch({ countsInParent: countsInParent as ProductArrangement["countsInParent"] })}
        />
        {promo ? (
          <>
            <Field label={t.start} type="date" value={row.startDate ?? ""} onChange={(startDate) => patch({ startDate: startDate || null })} />
            <Field label={t.rate} value={rateText} onChange={setRateText} inputMode="decimal" />
            <Field label={t.cap} value={row.eligible.cap ?? ""} onChange={(v) => patch({ eligible: { ...row.eligible, cap: num(v) } })} inputMode="decimal" />
            <Field label={t.expiry} hint={t.expiryHint} type="date" value={row.rateExpiry ?? ""} onChange={(rateExpiry) => patch({ rateExpiry: rateExpiry || null })} />
            <Field label={t.post} value={postText} onChange={setPostText} inputMode="decimal" />
            <Choice
              label={t.earns}
              value={row.eligible.newFundsOnly == null ? "unknown" : row.eligible.newFundsOnly ? "new" : "all"}
              options={[
                ["all", t.earnsAll],
                ["new", t.earnsNew],
                ["unknown", t.unsure],
              ]}
              onChange={(v) => patch({ eligible: { ...row.eligible, newFundsOnly: v === "unknown" ? null : v === "new", status: v === "unknown" ? "unknown" : "verified" } })}
            />
          </>
        ) : (
          <>
            <label className="block text-xs text-muted">
              {t.mortgage}
              <select className="mt-1 h-11 w-full rounded-lg bg-background px-3 text-sm text-foreground" value={row.mortgageId ?? ""} onChange={(e) => patch({ mortgageId: e.target.value || null })}>
                <option value="">{t.none}</option>
                {mortgage ? <option value={mortgage.id}>{pickName(locale, mortgage.name, mortgage.nameZh)}</option> : null}
              </select>
            </label>
            <Field label={t.spread} hint={t.spreadHint} value={spreadText} onChange={setSpreadText} inputMode="decimal" />
            <Choice
              label={t.capBasis}
              value={row.capBasis}
              options={[
                ["mortgage_outstanding", t.outstanding],
                ["stated", t.stated],
                ["unknown", t.unsure],
              ]}
              onChange={(capBasis) => patch({ capBasis: capBasis as ProductArrangement["capBasis"] })}
            />
            {row.capBasis === "stated" ? (
              <Field label={t.cap} value={row.eligible.cap ?? ""} onChange={(v) => patch({ eligible: { ...row.eligible, cap: num(v) } })} inputMode="decimal" />
            ) : null}
          </>
        )}

        <button type="button" className="flex h-11 w-full items-center justify-between text-sm font-medium text-accent" onClick={() => setMore((v) => !v)}>
          {more ? t.less : t.more}
          <ChevronDown className={`size-4 transition ${more ? "rotate-180" : ""}`} />
        </button>
        {more ? (
          <div className="space-y-3">
            <AccountSelect label={t.child} accounts={accounts} value={row.childAccountId ?? ""} allowEmpty emptyLabel={t.none} onChange={(childAccountId) => patch({ childAccountId })} />
            <Field label={t.withdrawal} value={row.withdrawal.note} onChange={(note) => patch({ withdrawal: { note, status: note.trim() ? "verified" : "unknown" } })} />
            <Field label={t.credits} hint={t.creditsHint} value={row.interestCreditDates.join(", ")} onChange={(v) => patch({ interestCreditDates: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
            <Field label={t.excess} value={excessText} onChange={setExcessText} inputMode="decimal" />
            <Field label={t.group} hint={t.groupHint} value={row.capGroup} onChange={(capGroup) => patch({ capGroup })} />
            <Field label={t.allocation} value={row.capAllocation ?? ""} onChange={(v) => patch({ capAllocation: num(v), capAllocationStatus: v.trim() === "" ? "unknown" : "verified" })} inputMode="decimal" />
            <Choice
              label={t.dayCount}
              value={row.dayCount}
              options={[
                ["unknown", t.dayOff],
                ["actual/365", t.dayOn],
              ]}
              onChange={(dayCount) => patch({ dayCount: dayCount as ProductArrangement["dayCount"] })}
            />
            <label className="block text-xs text-muted">
              {t.daily}
              <textarea className="mt-1 min-h-24 w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground" value={dailyText} onChange={(e) => setDailyText(e.target.value)} />
            </label>
            <p className="text-[11px] leading-4 text-muted">{t.dailyHint}</p>
            <Field label={t.review} type="date" value={row.reviewBy ?? ""} onChange={(reviewBy) => patch({ reviewBy: reviewBy || null })} />
            {row.rateSchedule.slice(1).map((step) => (
              <div key={step.id} className="grid grid-cols-2 gap-2">
                <Field label={t.from} type="date" value={step.from} onChange={(v) => patch({ rateSchedule: replaceStep(row.rateSchedule, step.id, { from: v }) })} />
                <Field label={t.to} type="date" value={step.to ?? ""} onChange={(v) => patch({ rateSchedule: replaceStep(row.rateSchedule, step.id, { to: v || null }) })} />
                <Field label={t.rate} value={step.annualRate == null ? "" : toPercentInput(step.annualRate)} onChange={(v) => patch({ rateSchedule: replaceStep(row.rateSchedule, step.id, { annualRate: fromPercent(v), status: v.trim() === "" ? "unknown" : "verified" }) })} inputMode="decimal" />
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-medium text-accent"
              onClick={() => {
                const base = row.rateSchedule.length
                  ? row.rateSchedule
                  : [{ id: `${row.id}-rate`, from: row.startDate ?? "", to: row.rateExpiry, annualRate: fromPercent(rateText), status: "unknown" as const }];
                patch({ rateSchedule: [...base, { id: newId(), from: "", to: null, annualRate: null, status: "unknown" }] });
              }}
            >
              {t.addStep}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t.estimate} type="date" value={from} onChange={setFrom} />
              <Field label={t.to} type="date" value={to} onChange={setTo} />
            </div>
            <p className="text-[11px] leading-4 text-muted">
              {estimate && estimate.interest.amount != null
                ? `${estimate.interest.quality === "daily" ? (locale === "zh-HK" ? "按每日結餘" : "From daily balances") : locale === "zh-HK" ? "估算" : "Estimate"} ${estimate.interest.amount}`
                : t.unknown}
              {". "}
              {t.estimateHint}
            </p>
          </div>
        ) : null}

        <div className="flex gap-2 pt-2">
          <button type="button" className="h-11 flex-1 rounded-xl bg-accent text-sm font-medium text-on-accent" onClick={commit}>
            {t.save}
          </button>
          <button type="button" className="h-11 rounded-xl bg-background px-4 text-sm" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
        <button type="button" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm text-expense" onClick={() => void remove(row.id).then(onClose)}>
          <Trash2 className="size-4" />
          {t.delete}
        </button>
      </div>
    </Overlay>
  );
}

function prepared(row: ProductArrangement, rateText: string, postText: string, spreadText: string, excessText: string, dailyText: string): ProductArrangement {
  const rate = fromPercent(rateText);
  const post = fromPercent(postText);
  const spread = fromPercent(spreadText);
  const excess = fromPercent(excessText);
  const today = todayISO();
  const first: RateStep = row.rateSchedule[0] ?? { id: `${row.id}-rate`, from: row.startDate ?? "", to: row.rateExpiry, annualRate: null, status: "unknown" };
  const mainStep: RateStep = {
    ...first,
    from: row.startDate || first.from,
    to: row.rateExpiry,
    annualRate: rate,
    status: rate != null && row.startDate ? "verified" : "unknown",
  };
  const promo = row.kind === "promotional_savings";
  const capReady = row.capBasis === "mortgage_outstanding" || (row.capBasis === "stated" && row.eligible.cap != null);
  const mortgageReady = !promo && Boolean(row.mortgageId) && spread != null && capReady;
  const termsReady = promo ? rate != null && Boolean(row.startDate) : mortgageReady;
  const terms = row.terms.length === 1
    ? [{
        ...row.terms[0],
        rateSource: row.mortgageId && spread != null ? "mortgage" as const : row.terms[0].rateSource,
        spread,
        spreadStatus: spread == null ? "unknown" as const : "verified" as const,
        capBasis: row.capBasis,
        cap: row.eligible.cap,
        capStatus: row.eligible.cap == null ? "unknown" as const : "verified" as const,
        excessRate: excess,
        excessRateStatus: excess == null ? "unknown" as const : "verified" as const,
        verifiedAt: mortgageReady ? row.terms[0].verifiedAt || today : null,
      }]
    : row.terms;
  return {
    ...row,
    rateSchedule: promo ? [mainStep, ...row.rateSchedule.slice(1)] : row.rateSchedule,
    postPromoRate: post,
    postPromoStatus: post == null ? "unknown" : "verified",
    mortgageSpread: spread,
    mortgageSpreadStatus: spread == null ? "unknown" : "verified",
    excessRate: excess,
    excessRateStatus: excess == null ? "unknown" : "verified",
    rateSource: promo ? "schedule" : row.mortgageId && spread != null ? "mortgage" : "unknown",
    eligible: {
      ...row.eligible,
      capStatus: row.eligible.cap != null ? "verified" : "unknown",
      status: promo ? (row.eligible.newFundsOnly == null ? "unknown" : "verified") : row.eligible.status,
    },
    terms,
    termsStatus: termsReady ? "verified" : "unknown",
    termsVerifiedAt: termsReady ? row.termsVerifiedAt || today : null,
    dailyBalances: parseDaily(dailyText),
    withdrawal: { note: row.withdrawal.note, status: row.withdrawal.note.trim() ? "verified" : "unknown" },
  };
}

function replaceStep(steps: RateStep[], id: string, patch: Partial<RateStep>): RateStep[] {
  return steps.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

function parseDaily(text: string): ProductArrangement["dailyBalances"] {
  return text
    .split("\n")
    .map((line) => line.split(",").map((p) => p.trim()))
    .filter((parts) => parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0]) && Number.isFinite(Number(parts[1])))
    .map(([date, balance, flag]) => ({ date, balance: Number(balance), reliable: flag === "yes" }));
}

function Field({ label, hint, value, onChange, type = "text", inputMode }: { label: string; hint?: string; value: string | number; onChange: (value: string) => void; type?: string; inputMode?: "decimal" }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input className="mt-1 h-11 w-full rounded-lg bg-background px-3 text-sm text-foreground" type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <span className="mt-1 block text-[11px] leading-4">{hint}</span> : null}
    </label>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 grid gap-2">
        {options.map(([id, text]) => (
          <button key={id} type="button" className={`min-h-11 rounded-xl px-3 text-left text-sm ${value === id ? "bg-accent text-on-accent" : "bg-background"}`} onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function AccountSelect({ label, accounts, value, onChange, allowEmpty = false, emptyLabel = "" }: { label: string; accounts: Account[]; value: string; onChange: (id: string) => void; allowEmpty?: boolean; emptyLabel?: string }) {
  const locale = useUi((s) => s.locale);
  return (
    <label className="block text-xs text-muted">
      {label}
      <select className="mt-1 h-11 w-full rounded-lg bg-background px-3 text-sm text-foreground" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {pickName(locale, a.name, a.nameZh)}
          </option>
        ))}
      </select>
    </label>
  );
}
