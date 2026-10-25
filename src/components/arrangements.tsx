import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Overlay } from "@/components/shared";
import { blankArrangement, reviewArrangements } from "@/lib/calc/arrangements";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import type { Account, ArrangementTerm, ProductArrangement, RateStep, TermStatus } from "@/lib/types";
import { newId, useApp } from "@/store/app";
import { useUi } from "@/store/ui";

const copy = {
  en: {
    title: "Savings arrangements",
    hint: "An arrangement describes a rate rule. It does not create an account, a deposit, or an interest transaction.",
    add: "Add arrangement",
    empty: "None yet.",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    name: "Name",
    kind: "Type",
    promo: "Promotional savings",
    offset: "Mortgage-linked savings",
    structure: "Structure",
    marathon: "Marathon-style",
    generic: "Generic",
    parent: "Existing account",
    child: "Child account, if it already exists",
    none: "None",
    balance: "Attributed balance",
    unknown: "Unknown",
    inside: "Already inside that account?",
    included: "Yes, included",
    excluded: "No, separate",
    start: "Start date",
    expiry: "Rate expiry",
    expiryHint: "This ends the promotional rate. It does not mature or move the principal.",
    dayCount: "Day count",
    terms: "Terms checked",
    checkedOn: "Checked on",
    review: "Review by",
    withdrawal: "Withdrawal conditions",
    eligible: "Eligible-balance rule",
    cap: "Eligible cap",
    capStatus: "Cap checked",
    newFunds: "New funds only",
    yes: "Yes",
    no: "No",
    schedule: "Promotional rate schedule",
    from: "From",
    to: "To",
    rate: "Annual rate",
    addStep: "Add rate step",
    post: "Rate after the promotion",
    credits: "Interest credit dates",
    creditsHint: "Comma-separated dates you already know. None are created for you.",
    mortgage: "Linked mortgage",
    spread: "Spread added to the mortgage rate",
    capBasis: "Cap basis",
    stated: "Stated amount",
    outstanding: "Mortgage outstanding",
    excess: "Rate on the balance above the cap",
    group: "Shared cap group",
    allocation: "This account's share of the cap",
    daily: "Daily balances",
    dailyHint: "One line: date, balance, yes. yes means that day is reliable. Missing days are not filled in.",
    estimate: "Estimate",
    estimateHint: "Leaves every balance unchanged.",
    alerts: "Alerts",
  },
  "zh-HK": {
    title: "儲蓄安排",
    hint: "安排只描述利率規則，唔會新增戶口、存款，亦唔會自動入帳利息。",
    add: "加一項安排",
    empty: "未有。",
    save: "儲存",
    cancel: "取消",
    delete: "刪除",
    name: "名稱",
    kind: "類型",
    promo: "推廣儲蓄",
    offset: "按揭掛鈎儲蓄",
    structure: "結構",
    marathon: "馬拉松式",
    generic: "一般",
    parent: "現有戶口",
    child: "已存在的子戶口",
    none: "無",
    balance: "歸屬結餘",
    unknown: "未知",
    inside: "呢筆結餘是否已包含在戶口內？",
    included: "已包含",
    excluded: "獨立",
    start: "開始日期",
    expiry: "推廣利率到期",
    expiryHint: "只係利率完結，本金唔會因此到期或者調動。",
    dayCount: "日數基準",
    terms: "條款已核對",
    checkedOn: "核對日期",
    review: "覆核日期",
    withdrawal: "提款條件",
    eligible: "可享利率結餘規則",
    cap: "可享上限",
    capStatus: "上限已核對",
    newFunds: "只計新資金",
    yes: "係",
    no: "否",
    schedule: "推廣利率表",
    from: "由",
    to: "至",
    rate: "年利率",
    addStep: "加一段利率",
    post: "推廣完結後利率",
    credits: "利息入帳日",
    creditsHint: "用逗號分開你已知的日期，程式唔會代你加。",
    mortgage: "掛鈎按揭",
    spread: "加在按揭利率上的息差",
    capBasis: "上限依據",
    stated: "指定金額",
    outstanding: "按揭未還本金",
    excess: "超出上限部分的利率",
    group: "共用上限組別",
    allocation: "這個戶口佔用的上限",
    daily: "每日結餘",
    dailyHint: "每行：日期, 結餘, yes。yes 代表當日可靠。缺的日子唔會補。",
    estimate: "估算",
    estimateHint: "唔會改任何結餘。",
    alerts: "提示",
  },
} as const;

function num(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function statusOf(value: string): TermStatus {
  return value === "verified" ? "verified" : "unknown";
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

  return (
    <section className="mx-4 mb-5 rounded-2xl bg-elevated px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t.title}</h2>
          <p className="mt-1 text-[11px] leading-4 text-muted">{t.hint}</p>
        </div>
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center text-accent"
          aria-label={t.add}
          onClick={() => setEditing(blankArrangement("promotional_savings", accounts[0]?.id ?? "", newId()))}
        >
          <Plus className="size-5" />
        </button>
      </div>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">{t.empty}</p> : null}
      <ul className="mt-2">
        {review.views.map((row) => (
          <li key={row.id} className="border-t border-line py-3 first:border-t-0">
            <button type="button" className="w-full text-left" onClick={() => setEditing(rows.find((r) => r.id === row.id) ?? null)}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{row.name || (row.kind === "promotional_savings" ? t.promo : t.offset)}</span>
                <span className="text-sm tabular-nums">{row.attributedBalance == null ? t.unknown : money(row.attributedBalance, row.currency)}</span>
              </div>
              <div className="mt-1 text-[11px] leading-4 text-muted">
                {row.structure === "marathon" ? t.marathon : row.kind === "promotional_savings" ? t.promo : t.offset}
                {" · "}
                {t.rate} {row.rateLabel === "unknown" ? t.unknown : row.rateLabel}
                {" · "}
                {row.interest.quality} {row.interest.amount ?? t.unknown}
              </div>
              {row.alerts.length ? <div className="mt-1 text-[11px] text-expense">{row.alerts.join(", ")}</div> : null}
            </button>
          </li>
        ))}
      </ul>
      {editing ? (
        <ArrangementForm
          initial={editing}
          accounts={accounts}
          mortgageId={mortgage?.id ?? ""}
          mortgageName={mortgage ? pickName(locale, mortgage.name, mortgage.nameZh) : ""}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function ArrangementForm({
  initial,
  accounts,
  mortgageId,
  mortgageName,
  onClose,
}: {
  initial: ProductArrangement;
  accounts: Account[];
  mortgageId: string;
  mortgageName: string;
  onClose: () => void;
}) {
  const locale = useUi((s) => s.locale);
  const t = copy[locale];
  const save = useApp((s) => s.upsertArrangement);
  const remove = useApp((s) => s.deleteArrangement);
  const mortgage = useApp((s) => s.mortgage);
  const [row, setRow] = useState(initial);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dailyText, setDailyText] = useState(initial.dailyBalances.map((p) => `${p.date}, ${p.balance}, ${p.reliable ? "yes" : "no"}`).join("\n"));
  const patch = (next: Partial<ProductArrangement>) => setRow((prev) => ({ ...prev, ...next }));
  const estimate = useMemo(() => {
    if (!from || !to) return null;
    return reviewArrangements({
      arrangements: [{ ...row, dailyBalances: parseDaily(dailyText) }],
      accounts,
      mortgages: mortgage ? [mortgage] : [],
      asOf: to,
      period: { from, to },
    }).views[0];
  }, [row, from, to, dailyText, accounts, mortgage]);

  function commit() {
    const parent = accounts.find((a) => a.id === row.parentAccountId);
    const currency = parent && parent.currency !== "MILES" ? parent.currency : row.currency;
    const next = { ...row, currency, dailyBalances: parseDaily(dailyText), childAccountId: row.childAccountId || undefined };
    void save(next).then(onClose);
  }

  return (
    <Overlay open onClose={onClose} title={t.title} variant="page">
      <div className="space-y-3 px-4 pb-8">
        <Field label={t.name} value={row.name} onChange={(name) => patch({ name })} />
        <label className="block text-xs text-muted">
          {t.kind}
          <select className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm" value={row.kind} onChange={(e) => patch({ kind: e.target.value as ProductArrangement["kind"], structure: e.target.value === "promotional_savings" ? "marathon" : "generic" })}>
            <option value="promotional_savings">{t.promo}</option>
            <option value="mortgage_linked_savings">{t.offset}</option>
          </select>
        </label>
        {row.kind === "promotional_savings" ? (
          <label className="block text-xs text-muted">
            {t.structure}
            <select className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm" value={row.structure} onChange={(e) => patch({ structure: e.target.value as ProductArrangement["structure"] })}>
              <option value="marathon">{t.marathon}</option>
              <option value="generic">{t.generic}</option>
            </select>
          </label>
        ) : null}
        <AccountSelect label={t.parent} accounts={accounts} value={row.parentAccountId} onChange={(parentAccountId) => patch({ parentAccountId })} />
        <AccountSelect label={t.child} accounts={accounts} value={row.childAccountId ?? ""} allowEmpty emptyLabel={t.none} onChange={(childAccountId) => patch({ childAccountId })} />
        <Field label={t.balance} value={row.attributedBalance ?? ""} onChange={(v) => patch({ attributedBalance: num(v) })} inputMode="decimal" />
        <StatusSelect label={t.inside} value={row.countsInParent} options={[["unknown", t.unknown], ["included", t.included], ["excluded", t.excluded]]} onChange={(countsInParent) => patch({ countsInParent: countsInParent as ProductArrangement["countsInParent"] })} />
        <Field label={t.start} type="date" value={row.startDate ?? ""} onChange={(startDate) => patch({ startDate: startDate || null })} />
        <Field label={t.expiry} type="date" value={row.rateExpiry ?? ""} onChange={(rateExpiry) => patch({ rateExpiry: rateExpiry || null })} />
        <p className="text-[11px] leading-4 text-muted">{t.expiryHint}</p>
        <StatusSelect label={t.dayCount} value={row.dayCount} options={[["unknown", t.unknown], ["actual/365", "actual/365"]]} onChange={(dayCount) => patch({ dayCount: dayCount as ProductArrangement["dayCount"] })} />
        <StatusSelect label={t.terms} value={row.termsStatus} options={[["unknown", t.unknown], ["verified", t.yes]]} onChange={(termsStatus) => patch({ termsStatus: statusOf(termsStatus) })} />
        <Field label={t.checkedOn} type="date" value={row.termsVerifiedAt ?? ""} onChange={(termsVerifiedAt) => patch({ termsVerifiedAt: termsVerifiedAt || null })} />
        <Field label={t.review} type="date" value={row.reviewBy ?? ""} onChange={(reviewBy) => patch({ reviewBy: reviewBy || null })} />
        <Field label={t.withdrawal} value={row.withdrawal.note} onChange={(note) => patch({ withdrawal: { ...row.withdrawal, note } })} />
        <StatusSelect label={t.withdrawal} value={row.withdrawal.status} options={[["unknown", t.unknown], ["verified", t.yes]]} onChange={(status) => patch({ withdrawal: { ...row.withdrawal, status: statusOf(status) } })} />
        <Field label={t.eligible} value={row.eligible.note} onChange={(note) => patch({ eligible: { ...row.eligible, note } })} />
        <StatusSelect label={t.eligible} value={row.eligible.status} options={[["unknown", t.unknown], ["verified", t.yes]]} onChange={(status) => patch({ eligible: { ...row.eligible, status: statusOf(status) } })} />
        <Field label={t.cap} value={row.eligible.cap ?? ""} onChange={(v) => patch({ eligible: { ...row.eligible, cap: num(v) } })} inputMode="decimal" />
        <StatusSelect label={t.capStatus} value={row.eligible.capStatus} options={[["unknown", t.unknown], ["verified", t.yes]]} onChange={(capStatus) => patch({ eligible: { ...row.eligible, capStatus: statusOf(capStatus) } })} />
        <StatusSelect
          label={t.newFunds}
          value={row.eligible.newFundsOnly == null ? "unknown" : row.eligible.newFundsOnly ? "yes" : "no"}
          options={[["unknown", t.unknown], ["yes", t.yes], ["no", t.no]]}
          onChange={(v) => patch({ eligible: { ...row.eligible, newFundsOnly: v === "unknown" ? null : v === "yes" } })}
        />
        <div>
          <div className="text-xs text-muted">{t.schedule}</div>
          {row.rateSchedule.map((step) => (
            <div key={step.id} className="mt-2 grid grid-cols-2 gap-2">
              <Field label={t.from} type="date" value={step.from} onChange={(v) => patch({ rateSchedule: replaceStep(row.rateSchedule, step.id, { from: v }) })} />
              <Field label={t.to} type="date" value={step.to ?? ""} onChange={(v) => patch({ rateSchedule: replaceStep(row.rateSchedule, step.id, { to: v || null }) })} />
              <Field label={t.rate} value={step.annualRate ?? ""} onChange={(v) => patch({ rateSchedule: replaceStep(row.rateSchedule, step.id, { annualRate: num(v) }) })} inputMode="decimal" />
              <StatusSelect label={t.terms} value={step.status} options={[["unknown", t.unknown], ["verified", t.yes]]} onChange={(status) => patch({ rateSchedule: replaceStep(row.rateSchedule, step.id, { status: statusOf(status) }) })} />
            </div>
          ))}
          <button type="button" className="mt-2 text-sm font-medium text-accent" onClick={() => patch({ rateSchedule: [...row.rateSchedule, { id: newId(), from: "", to: null, annualRate: null, status: "unknown" }] })}>
            {t.addStep}
          </button>
        </div>
        <Field label={t.post} value={row.postPromoRate ?? ""} onChange={(v) => patch({ postPromoRate: num(v), postPromoStatus: v.trim() === "" ? "unknown" : row.postPromoStatus })} inputMode="decimal" />
        <StatusSelect label={t.post} value={row.postPromoStatus} options={[["unknown", t.unknown], ["verified", t.yes]]} onChange={(postPromoStatus) => patch({ postPromoStatus: statusOf(postPromoStatus) })} />
        <Field label={t.credits} value={row.interestCreditDates.join(", ")} onChange={(v) => patch({ interestCreditDates: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
        <p className="text-[11px] leading-4 text-muted">{t.creditsHint}</p>
        {row.kind === "mortgage_linked_savings" ? (
          <>
            <label className="block text-xs text-muted">
              {t.mortgage}
              <select className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm" value={row.mortgageId ?? ""} onChange={(e) => patch({ mortgageId: e.target.value || null })}>
                <option value="">{t.none}</option>
                {mortgageId ? <option value={mortgageId}>{mortgageName || mortgageId}</option> : null}
              </select>
            </label>
            <Field label={t.spread} value={row.mortgageSpread ?? ""} onChange={(v) => patch({ mortgageSpread: num(v) })} inputMode="decimal" />
            <StatusSelect label={t.spread} value={row.mortgageSpreadStatus} options={[["unknown", t.unknown], ["verified", t.yes]]} onChange={(mortgageSpreadStatus) => patch({ mortgageSpreadStatus: statusOf(mortgageSpreadStatus) })} />
            <StatusSelect label={t.capBasis} value={row.capBasis} options={[["unknown", t.unknown], ["stated", t.stated], ["mortgage_outstanding", t.outstanding]]} onChange={(capBasis) => patch({ capBasis: capBasis as ProductArrangement["capBasis"] })} />
            <Field label={t.excess} value={row.excessRate ?? ""} onChange={(v) => patch({ excessRate: num(v) })} inputMode="decimal" />
            <StatusSelect label={t.excess} value={row.excessRateStatus} options={[["unknown", t.unknown], ["verified", t.yes]]} onChange={(excessRateStatus) => patch({ excessRateStatus: statusOf(excessRateStatus) })} />
            <Field label={t.group} value={row.capGroup} onChange={(capGroup) => patch({ capGroup })} />
            <Field label={t.allocation} value={row.capAllocation ?? ""} onChange={(v) => patch({ capAllocation: num(v) })} inputMode="decimal" />
            <StatusSelect label={t.allocation} value={row.capAllocationStatus} options={[["unknown", t.unknown], ["verified", t.yes]]} onChange={(capAllocationStatus) => patch({ capAllocationStatus: statusOf(capAllocationStatus) })} />
            <TermEditor row={row} onChange={(terms) => patch({ terms })} labels={t} />
          </>
        ) : null}
        <label className="block text-xs text-muted">
          {t.daily}
          <textarea className="mt-1 min-h-24 w-full rounded-lg bg-elevated px-3 py-2 text-sm" value={dailyText} onChange={(e) => setDailyText(e.target.value)} />
        </label>
        <p className="text-[11px] leading-4 text-muted">{t.dailyHint}</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t.from} type="date" value={from} onChange={setFrom} />
          <Field label={t.to} type="date" value={to} onChange={setTo} />
        </div>
        <p className="text-[11px] leading-4 text-muted">
          {t.estimate}: {estimate ? `${estimate.interest.quality} ${estimate.interest.amount ?? t.unknown}` : t.unknown}. {t.estimateHint}
        </p>
        <div className="flex gap-2">
          <button type="button" className="h-11 flex-1 rounded-xl bg-accent text-sm font-medium text-white" onClick={commit}>{t.save}</button>
          <button type="button" className="h-11 rounded-xl bg-elevated px-4 text-sm" onClick={onClose}>{t.cancel}</button>
        </div>
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm text-expense"
          onClick={() => void remove(row.id).then(onClose)}
        >
          <Trash2 className="size-4" />
          {t.delete}
        </button>
      </div>
    </Overlay>
  );
}

function TermEditor({ row, onChange, labels }: { row: ProductArrangement; onChange: (terms: ArrangementTerm[]) => void; labels: (typeof copy)["en"] | (typeof copy)["zh-HK"] }) {
  return (
    <div>
      <button
        type="button"
        className="text-sm font-medium text-accent"
        onClick={() =>
          onChange([
            ...row.terms,
            {
              id: newId(),
              from: "",
              to: null,
              rateSource: row.rateSource,
              spread: row.mortgageSpread,
              spreadStatus: row.mortgageSpreadStatus,
              cap: row.eligible.cap,
              capStatus: row.eligible.capStatus,
              capBasis: row.capBasis,
              excessRate: row.excessRate,
              excessRateStatus: row.excessRateStatus,
              verifiedAt: null,
            },
          ])
        }
      >
        {labels.addStep}
      </button>
      {row.terms.map((term) => (
        <div key={term.id} className="mt-2 grid grid-cols-2 gap-2">
          <Field label={labels.from} type="date" value={term.from} onChange={(from) => onChange(row.terms.map((t) => (t.id === term.id ? { ...t, from } : t)))} />
          <Field label={labels.to} type="date" value={term.to ?? ""} onChange={(to) => onChange(row.terms.map((t) => (t.id === term.id ? { ...t, to: to || null } : t)))} />
          <StatusSelect label={labels.kind} value={term.rateSource} options={[["unknown", labels.unknown], ["mortgage", labels.offset], ["schedule", labels.schedule]]} onChange={(rateSource) => onChange(row.terms.map((t) => (t.id === term.id ? { ...t, rateSource: rateSource as ArrangementTerm["rateSource"] } : t)))} />
          <Field label={labels.spread} value={term.spread ?? ""} onChange={(v) => onChange(row.terms.map((t) => (t.id === term.id ? { ...t, spread: num(v) } : t)))} inputMode="decimal" />
          <StatusSelect label={labels.spread} value={term.spreadStatus} options={[["unknown", labels.unknown], ["verified", labels.yes]]} onChange={(spreadStatus) => onChange(row.terms.map((t) => (t.id === term.id ? { ...t, spreadStatus: statusOf(spreadStatus) } : t)))} />
          <Field label={labels.checkedOn} type="date" value={term.verifiedAt ?? ""} onChange={(verifiedAt) => onChange(row.terms.map((t) => (t.id === term.id ? { ...t, verifiedAt: verifiedAt || null } : t)))} />
          <StatusSelect label={labels.capBasis} value={term.capBasis} options={[["unknown", labels.unknown], ["stated", labels.stated], ["mortgage_outstanding", labels.outstanding]]} onChange={(capBasis) => onChange(row.terms.map((t) => (t.id === term.id ? { ...t, capBasis: capBasis as ArrangementTerm["capBasis"] } : t)))} />
        </div>
      ))}
    </div>
  );
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

function Field({ label, value, onChange, type = "text", inputMode }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; inputMode?: "decimal" }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function StatusSelect({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <select className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([id, text]) => (
          <option key={id} value={id}>{text}</option>
        ))}
      </select>
    </label>
  );
}

function AccountSelect({ label, accounts, value, onChange, allowEmpty = false, emptyLabel = "" }: { label: string; accounts: Account[]; value: string; onChange: (id: string) => void; allowEmpty?: boolean; emptyLabel?: string }) {
  const locale = useUi((s) => s.locale);
  return (
    <label className="block text-xs text-muted">
      {label}
      <select className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{pickName(locale, a.name, a.nameZh)}</option>
        ))}
      </select>
    </label>
  );
}
