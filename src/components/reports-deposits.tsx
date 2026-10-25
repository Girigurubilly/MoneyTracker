import { useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { moneyAccountsForPicker } from "@/lib/accounts";
import { downloadBlob } from "@/lib/backup";
import { MONTHS_S, depositYearTotals, suggestedInterest, summarizeDeposits } from "@/lib/calc/deposits";
import { buildDepositBrief, renderDepositBriefMarkdown } from "@/lib/calc/deposit-brief";
import { looksLikePromoDeposit } from "@/lib/calc/fc-baseline";
import { copyPlainText, sharePlainText } from "@/lib/copy-text";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { resolveAmountInput } from "@/lib/money-expr";
import { CURRENCIES, type Currency, type PromoAccessibility, type PromoSaving, type TimeSaving } from "@/lib/types";
import {
  AccountLine,
  ActiveKeypad,
  ComposerHeader,
  ComposerShell,
  LineRow,
  SelectLine,
} from "@/components/txn-composer";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}`;
}

export function DepositsPage({ backTo = "/reports" }: { backTo?: "/reports" | "/more" }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const deposits = useApp((s) => s.deposits);
  const promoSavings = useApp((s) => s.promoSavings);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const lastFx = useApp((s) => s.lastFxSyncAt);
  const deleteDeposit = useApp((s) => s.deleteDeposit);
  const deletePromoSaving = useApp((s) => s.deletePromoSaving);
  const syncPromoFromDeposits = useApp((s) => s.syncPromoFromDeposits);
  const refreshFx = useApp((s) => s.refreshFx);
  const depositCatStored = useApp((s) => s.depositCategoryId);
  const setDepositCategory = useApp((s) => s.setDepositCategory);
  const incomeCats = categories.filter((c) => c.kind === "income");
  const depositCat =
    (depositCatStored && incomeCats.some((c) => c.id === depositCatStored) && depositCatStored) ||
    (incomeCats.some((c) => c.id === "interest-inc") ? "interest-inc" : incomeCats[0]?.id ?? "");
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const [editing, setEditing] = useState<TimeSaving | null | "new">(null);
  const [editingPromo, setEditingPromo] = useState<PromoSaving | null | "new">(null);
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const summary = useMemo(() => summarizeDeposits(deposits, today, rates), [deposits, today, rates]);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof deposits>();
    const rows = [...deposits].sort((a, b) => (a.endDate || a.startDate || "").localeCompare(b.endDate || b.startDate || "") || a.id.localeCompare(b.id));
    for (const r of rows) {
      const key = (r.endDate || r.startDate || "").slice(0, 4) || "—";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [deposits]);
  const promoTotal = useMemo(() => promoSavings.reduce((s, p) => s + (p.residualHkd || 0), 0), [promoSavings]);

  async function fetchFx() {
    setBusy(true);
    try {
      await refreshFx();
      setNote(t.reports.fxUpdated);
    } catch {
      setNote(t.reports.fxFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.reports.deposits}
        backTo={backTo}
        right={
          <button type="button" aria-label={t.reports.addDeposit} className="grid size-11 place-items-center text-accent" onClick={() => setEditing("new")}>
            <Plus className="size-6" />
          </button>
        }
      />

      <div className="mx-4 mb-4 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-accent">{t.reports.activeDeposit}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{money(summary.depHKD, "HKD")}</div>
            <div className="mt-0.5 text-xs text-muted">{t.reports.interestToEarn}: {money(summary.intHKD, "HKD")}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-success-soft px-3 py-2">
            <div className="text-[11px] text-income">{t.reports.interestRealized}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(summary.realizedHKD, "HKD")}</div>
          </div>
          <div className="rounded-xl bg-background px-3 py-2">
            <div className="text-[11px] text-muted">{t.reports.unrealizedThisYear}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(summary.unrealizedThisYearHKD, "HKD")}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted">{t.reports.interestAfterYear.replace("{year}", String(year))}: {money(summary.unrealizedAfterYearHKD, "HKD")}</span>
          <button type="button" onClick={() => void fetchFx()} disabled={busy} className="flex items-center gap-1 text-xs font-medium text-accent">
            <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
            {t.reports.fetchFx}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="mx-4 mb-4 flex h-11 w-[calc(100%-2rem)] items-center justify-center rounded-xl bg-elevated text-sm font-medium"
        onClick={() => setAi(true)}
      >
        {t.reports.exportBrief}
      </button>
      {ai ? <DepositBriefSheet onClose={() => setAi(false)} /> : null}

      <div className="mx-4 mb-5 rounded-2xl bg-elevated px-4 py-3">
        <div className="text-xs text-muted">{t.reports.depositIncomeCat}</div>
        <select
          className="mt-2 h-11 w-full rounded-lg bg-background px-3 text-sm"
          value={depositCat}
          onChange={(e) => void setDepositCategory(e.target.value)}
        >
          {incomeCats.map((c) => (
            <option key={c.id} value={c.id}>
              {pickName(locale, c.name, c.nameZh)}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] leading-4 text-muted">{t.reports.depositIncomeHint}</p>
      </div>

      <div className="mb-2 flex items-center justify-between px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.reports.promoSavings}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs font-medium text-accent"
            onClick={() => void syncPromoFromDeposits().then(() => toast(t.reports.syncPromo))}
          >
            {t.reports.syncPromo}
          </button>
          <button type="button" className="grid size-9 place-items-center text-accent" aria-label={t.reports.addPromo} onClick={() => setEditingPromo("new")}>
            <Plus className="size-5" />
          </button>
        </div>
      </div>
      <p className="px-5 pb-2 text-[11px] leading-4 text-muted">{t.reports.promoHint}</p>
      {promoSavings.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted">{t.reports.noPromos}</p>
      ) : (
        <div className="mx-4 mb-5 overflow-hidden rounded-2xl bg-elevated">
          <div className="flex items-baseline justify-between px-4 py-3">
            <span className="text-xs text-muted">{t.reports.promoResidual}</span>
            <span className="text-sm font-semibold tabular-nums">{money(promoTotal, "HKD")}</span>
          </div>
          {promoSavings.map((p, i) => {
            const acc = accounts.find((a) => a.id === p.accountId);
            const title = p.nameZh || p.name || (acc ? pickName(locale, acc.name, acc.nameZh) : p.id);
            const rate = p.rateSchedule[p.rateSchedule.length - 1]?.rate;
            return (
              <div key={p.id}>
                {i > 0 ? <Hairline /> : null}
                <div className="flex items-start gap-3 px-4 py-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditingPromo(p)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{title}</span>
                      <span className="text-xs text-muted">{p.arrangementEnd || "—"}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {money(p.residualHkd, "HKD")}
                      {rate != null ? ` · ${rate}%` : ""}
                      {` · ${p.accessibility}`}
                    </div>
                  </button>
                  <button type="button" className="mt-1 text-expense" onClick={() => void deletePromoSaving(p.id)} aria-label={locale === "zh-HK" ? "刪除" : "Delete"}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="px-5 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t.reports.depositRecords}</h2>
      {grouped.length === 0 ? (
        <p className="px-5 text-sm text-muted">{t.reports.noDepositsHint}</p>
      ) : (
        grouped.map(([yr, rows]) => {
          const lump = depositYearTotals(rows, rates);
          return (
          <div key={yr} className="mb-4">
            <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-5">
              <h2 className="text-sm font-medium text-muted">{yr}</h2>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">{money(lump.principal, lump.currency)}</div>
                <div className="text-xs font-medium tabular-nums text-income">+{money(lump.interest, lump.currency)}</div>
              </div>
            </div>
            <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
              {rows.map((r, i) => {
                const realized = !!r.endDate && r.endDate <= today;
                const d = r.endDate ? new Date(`${r.endDate}T00:00:00`) : null;
                const rm = d && !Number.isNaN(d.getTime()) ? `${MONTHS_S[d.getMonth()]} ${d.getFullYear()}` : "—";
                const tone = realized ? "text-income" : d && d.getFullYear() === year ? "text-accent" : "text-muted";
                const acc = accounts.find((a) => a.id === r.accountId);
                const title = r.bank || (acc ? pickName(locale, acc.name, acc.nameZh) : "—");
                const promoLike = looksLikePromoDeposit(r, accounts);
                return (
                  <div key={r.id}>
                    {i > 0 ? <Hairline /> : null}
                    <div className="flex items-start gap-3 px-4 py-3">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(r)}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">
                            {title}
                            {promoLike ? <span className="ml-2 text-[10px] font-medium text-accent">promo?</span> : null}
                          </span>
                          <span className={`text-xs font-medium ${tone}`}>{rm}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {money(r.amount, r.currency)} · {r.startDate} → {r.endDate}
                        </div>
                        <div className="mt-1 flex justify-between text-sm tabular-nums">
                          <span className="text-income">+{money(r.interest, r.currency)}</span>
                          <span>{money((r.amount || 0) + (r.interest || 0), r.currency)}</span>
                        </div>
                      </button>
                      <button type="button" className="mt-1 text-expense" onClick={() => void deleteDeposit(r.id)} aria-label={locale === "zh-HK" ? "刪除" : "Delete"}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          );
        })
      )}

      {note || lastFx ? <p className="px-5 pt-3 text-xs text-muted">{note || lastFx}</p> : null}

      <DepositEditor
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        open={editing !== null}
        initial={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
      />
      <PromoEditor
        key={editingPromo === "new" ? "promo-new" : editingPromo?.id ?? "promo-closed"}
        open={editingPromo !== null}
        initial={editingPromo === "new" ? null : editingPromo}
        onClose={() => setEditingPromo(null)}
      />
    </div>
  );
}

function DepositEditor({ open, initial, onClose }: { open: boolean; initial: TimeSaving | null; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const addDeposit = useApp((s) => s.addDeposit);
  const updateDeposit = useApp((s) => s.updateDeposit);
  const deleteDeposit = useApp((s) => s.deleteDeposit);
  const upsertPromoSaving = useApp((s) => s.upsertPromoSaving);
  const picker = moneyAccountsForPicker(accounts);
  const today = todayISO();
  const [startDate, setStartDate] = useState(initial?.startDate ?? today);
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [rate, setRate] = useState(initial ? String(initial.rate) : "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "HKD");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [interest, setInterest] = useState(initial ? String(initial.interest) : "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? picker[0]?.id ?? "");
  const [bank, setBank] = useState(initial?.bank ?? "");
  const [proceeds, setProceeds] = useState(initial?.proceedsDestination ?? "");
  const [asPromo, setAsPromo] = useState(false);
  const [interestTouched, setInterestTouched] = useState(Boolean(initial));
  const [field, setField] = useState<"amount" | "dest" | "principal" | "interest">("amount");
  const asset = accounts.find((a) => a.id === accountId);

  function suggest(nextAmt = amount, nextRate = rate, nextStart = startDate, nextEnd = endDate) {
    return suggestedInterest(resolveAmountInput(nextAmt), parseFloat(nextRate) || 0, nextStart, nextEnd);
  }

  function productLabel(): string {
    const typed = bank.trim();
    if (typed) return typed;
    return asset ? (locale === "zh-HK" ? asset.nameZh || asset.name : asset.name) : "";
  }

  async function save() {
    const amt = resolveAmountInput(amount);
    if (!accountId || !startDate || !endDate || amt <= 0) return;
    let int = resolveAmountInput(interest);
    if (!int) int = suggest();
    const label = productLabel();
    if (asPromo) {
      const id = initial?.id ? (initial.id.startsWith("promo-") ? initial.id : `promo-${initial.id}`) : `promo-${newId()}`;
      const row: PromoSaving = {
        id,
        accountId,
        residualHkd: amt,
        rateSchedule: [{ from: startDate, to: endDate, rate: parseFloat(rate) || 0 }],
        arrangementEnd: endDate,
        accessibility: "unknown",
        distinctFromTd: true,
        name: label,
        nameZh: label,
      };
      await upsertPromoSaving(row);
      if (initial) await deleteDeposit(initial.id);
      onClose();
      return;
    }
    const row = {
      bank: label,
      startDate,
      endDate,
      rate: parseFloat(rate) || 0,
      currency,
      amount: amt,
      interest: int,
      accountId,
      proceedsDestination: proceeds.trim() || null,
    };
    if (initial) await updateDeposit({ ...initial, ...row });
    else await addDeposit(row);
    onClose();
  }

  return (
    <Overlay open={open} onClose={onClose} variant="page">
      <ComposerShell
        header={<ComposerHeader onClose={onClose} onSave={() => void save()} title={initial ? t.common.edit : t.reports.addDeposit} />}
        keypad={
          <ActiveKeypad
            field={field === "interest" ? "interest" : "amount"}
            amount={amount}
            dest=""
            principal=""
            interest={interest}
            setAmount={(v) => {
              setAmount(v);
              if (!interestTouched) setInterest(String(suggest(v) || ""));
            }}
            setDest={() => undefined}
            setPrincipal={() => undefined}
            setInterest={(v) => {
              setInterestTouched(true);
              setInterest(v);
            }}
            currency={currency}
            onCurrency={setCurrency}
          />
        }
      >
        <AccountLine accounts={picker} value={accountId} onChange={setAccountId} placeholder={t.reports.bank} role={t.reports.bank} />
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm text-muted">{t.reports.productLabel}</span>
          <input
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="Marathon / 馬拉松"
            className="h-10 w-[55%] bg-transparent text-right text-sm text-accent outline-none"
          />
        </div>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm text-muted">{t.reports.startDate}</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
        </div>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm text-muted">{t.reports.endDate}</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
        </div>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm text-muted">{t.reports.ratePct}</span>
          <input
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
              if (!interestTouched) setInterest(String(suggest(amount, e.target.value) || ""));
            }}
            inputMode="decimal"
            className="h-10 w-24 bg-transparent text-right text-sm text-accent outline-none"
          />
        </div>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm text-muted">{t.reports.proceedsDest}</span>
          <input
            value={proceeds}
            onChange={(e) => setProceeds(e.target.value)}
            className="h-10 w-[55%] bg-transparent text-right text-sm text-accent outline-none"
          />
        </div>
        <label className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm text-muted">{t.reports.convertToPromo}</span>
          <input type="checkbox" checked={asPromo} onChange={(e) => setAsPromo(e.target.checked)} className="size-5 accent-[var(--accent)]" />
        </label>
        <SelectLine label={t.reports.currency} value={currency} onChange={(v) => setCurrency(v as Currency)} options={CURRENCIES.map((c) => ({ id: c, label: c }))} />
        <LineRow label={t.reports.depositAmount} amount={amount} currency={currency} active={field === "amount"} onFocusAmount={() => setField("amount")} />
        {!asPromo ? (
          <LineRow label={t.reports.interest} amount={interest} currency={currency} active={field === "interest"} onFocusAmount={() => setField("interest")} />
        ) : null}
      </ComposerShell>
    </Overlay>
  );
}

function PromoEditor({ open, initial, onClose }: { open: boolean; initial: PromoSaving | null; onClose: () => void }) {
  const t = useT();
  const accounts = useApp((s) => s.accounts);
  const upsertPromoSaving = useApp((s) => s.upsertPromoSaving);
  const picker = moneyAccountsForPicker(accounts);
  const today = todayISO();
  const last = initial?.rateSchedule[initial.rateSchedule.length - 1];
  const [accountId, setAccountId] = useState(initial?.accountId ?? picker[0]?.id ?? "");
  const [name, setName] = useState(initial?.nameZh || initial?.name || "Marathon");
  const [residual, setResidual] = useState(initial ? String(initial.residualHkd) : "");
  const [end, setEnd] = useState(initial?.arrangementEnd ?? "");
  const [rate, setRate] = useState(last ? String(last.rate) : "");
  const [from, setFrom] = useState(last?.from ?? today);
  const [access, setAccess] = useState<PromoAccessibility>(initial?.accessibility ?? "unknown");

  async function save() {
    const residualHkd = resolveAmountInput(residual);
    if (!accountId || residualHkd <= 0 || !end) return;
    const row: PromoSaving = {
      id: initial?.id ?? `promo-${newId()}`,
      accountId,
      residualHkd,
      rateSchedule: [{ from: from || today, to: end, rate: parseFloat(rate) || 0 }],
      arrangementEnd: end,
      accessibility: access,
      distinctFromTd: true,
      name: name.trim() || "Promo",
      nameZh: name.trim() || "推廣儲蓄",
    };
    await upsertPromoSaving(row);
    onClose();
  }

  return (
    <Overlay open={open} onClose={onClose} variant="page">
      <div className="flex h-full flex-col bg-background">
        <ComposerHeader onClose={onClose} onSave={() => void save()} title={initial ? t.reports.editPromo : t.reports.addPromo} />
        <div className="flex-1 overflow-auto pb-10">
          <AccountLine accounts={picker} value={accountId} onChange={setAccountId} placeholder={t.reports.bank} role={t.reports.bank} />
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm text-muted">{t.reports.promoName}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-[55%] bg-transparent text-right text-sm text-accent outline-none" />
          </div>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm text-muted">{t.reports.promoResidual}</span>
            <input value={residual} onChange={(e) => setResidual(e.target.value)} inputMode="decimal" className="h-10 w-36 bg-transparent text-right text-sm text-accent outline-none" />
          </div>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm text-muted">{t.reports.promoRate}</span>
            <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="h-10 w-24 bg-transparent text-right text-sm text-accent outline-none" />
          </div>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm text-muted">{t.reports.startDate}</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
          </div>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm text-muted">{t.reports.promoEnd}</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
          </div>
          <SelectLine
            label={t.reports.promoAccess}
            value={access}
            onChange={(v) => setAccess(v as PromoAccessibility)}
            options={[
              { id: "unknown", label: "unknown" },
              { id: "accessible", label: "accessible" },
              { id: "restricted", label: "restricted" },
            ]}
          />
        </div>
      </div>
    </Overlay>
  );
}


function DepositBriefSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const deposits = useApp((s) => s.deposits);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const markdown = useMemo(
    () => renderDepositBriefMarkdown(buildDepositBrief({ today: todayISO(), deposits, accounts, rates })),
    [deposits, accounts, rates],
  );
  async function copy() {
    if (await copyPlainText(markdown)) {
      toast(t.assets.copied);
      return;
    }
    const shared = await sharePlainText(markdown, t.reports.exportBrief);
    if (shared === "shared" || shared === "aborted") return;
    toast(t.assets.copyFailed);
  }
  return (
    <Overlay open onClose={onClose} title={t.reports.exportBrief} variant="page">
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.reports.depositAiHint}</p>
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        <button type="button" className="h-11 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void copy()}>
          {t.assets.copyBrief}
        </button>
        <button
          type="button"
          className="h-11 rounded-xl bg-elevated text-sm font-medium"
          onClick={() => downloadBlob(`hk-life-deposits-${todayISO()}.md`, markdown, "text/markdown")}
        >
          {t.assets.downloadBrief}
        </button>
      </div>
      <pre className="mx-4 mb-8 max-h-[70dvh] select-text overflow-auto whitespace-pre-wrap rounded-2xl bg-elevated p-4 text-[11px] leading-4 text-muted">{markdown}</pre>
    </Overlay>
  );
}
