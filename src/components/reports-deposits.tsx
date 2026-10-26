import { useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { moneyAccountsForPicker } from "@/lib/accounts";
import { downloadBlob } from "@/lib/backup";
import { MONTHS_S, depositYearTotals, depositsOutsideBalances, suggestedInterest, summarizeDeposits } from "@/lib/calc/deposits";
import { buildDepositBrief, renderDepositBriefMarkdown } from "@/lib/calc/deposit-brief";
import { looksLikePromoDeposit } from "@/lib/calc/fc-baseline";
import { toHkd } from "@/lib/calc/fx";
import { inclusiveDays, marathonInterest, scbMarathonTiers, type MarathonTier } from "@/lib/calc/marathon";
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
  const uncoveredIds = useMemo(
    () => new Set(depositsOutsideBalances(deposits, accounts, rates, today).map((d) => d.id)),
    [deposits, accounts, rates, today],
  );
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
  const promoTotal = useMemo(
    () => promoSavings.reduce((s, p) => s + toHkd(p.residualHkd || 0, p.currency ?? "HKD", rates), 0),
    [promoSavings, rates],
  );

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
    <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
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
          <span className="text-xs text-muted">{(t.reports.interestAfterYear ?? "Interest after {year}").replace("{year}", String(year))}: {money(summary.unrealizedAfterYearHKD, "HKD")}</span>
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
        <button
          type="button"
          className="text-xs font-medium text-accent"
          onClick={() => void syncPromoFromDeposits().then(() => toast(t.reports.syncPromo))}
        >
          {t.reports.syncPromo}
        </button>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-muted">{t.reports.promoHint}</p>
      <div className="px-4 pb-3">
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-on-accent"
          onClick={() => setEditingPromo("new")}
        >
          <Plus className="size-4" />
          {t.reports.addMarathon}
        </button>
      </div>
      {promoSavings.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted">{t.reports.noPromos}</p>
      ) : (
        <div className="mx-4 mb-5 overflow-hidden rounded-2xl bg-elevated">
          <div className="flex items-baseline justify-between px-4 py-3">
            <span className="text-xs text-muted">{t.reports.promoResidual}</span>
            <span className="text-sm font-semibold tabular-nums">{money(promoTotal, "HKD")}</span>
          </div>
          {promoSavings.map((p) => {
            const acc = accounts.find((a) => a.id === p.accountId);
            const title = p.nameZh || p.name || (acc ? pickName(locale, acc.name, acc.nameZh) : p.id);
            const ccy = p.currency === "USD" ? "USD" : "HKD";
            const tiers = p.rateSchedule.map((step, index) => ({ id: `saved-${index}`, ...step }));
            const est = marathonInterest(p.residualHkd, tiers);
            const from = [...p.rateSchedule].map((step) => step.from).filter(Boolean).sort()[0] ?? "—";
            const to = [...p.rateSchedule].map((step) => step.to).filter(Boolean).sort().at(-1) ?? "—";
            return (
              <div key={p.id}>
                <Hairline />
                <div className="flex items-start gap-3 px-4 py-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditingPromo(p)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{title}</span>
                      <span className="text-xs text-muted">{ccy}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {acc ? pickName(locale, acc.name, acc.nameZh) : t.reports.bank} · {from} → {to}
                    </div>
                    <div className="mt-1 flex justify-between text-sm tabular-nums">
                      <span>{money(p.residualHkd, ccy)}</span>
                      <span className="text-income">+{money(est.total, ccy)}</span>
                    </div>
                  </button>
                  <button type="button" className="grid size-11 shrink-0 place-items-center text-expense" onClick={() => void deletePromoSaving(p.id)} aria-label={locale === "zh-HK" ? "刪除" : "Delete"}>
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
                        {uncoveredIds.has(r.id) ? (
                          <div className="mt-1 text-[11px] leading-4 text-watch">{t.reports.depositNotCovered}</div>
                        ) : r.accountId ? (
                          <div className="mt-1 text-[11px] leading-4 text-faint">{t.reports.depositCovered}</div>
                        ) : null}
                        <div className="mt-1 flex justify-between text-sm tabular-nums">
                          <span className="text-income">+{money(r.interest, r.currency)}</span>
                          <span>{money((r.amount || 0) + (r.interest || 0), r.currency)}</span>
                        </div>
                      </button>
                      <button type="button" className="grid size-11 shrink-0 place-items-center text-expense" onClick={() => void deleteDeposit(r.id)} aria-label={locale === "zh-HK" ? "刪除" : "Delete"}>
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
      {editingPromo !== null ? (
        <PromoEditor
          key={editingPromo === "new" ? "promo-new" : editingPromo.id}
          open
          initial={editingPromo === "new" ? null : editingPromo}
          onClose={() => setEditingPromo(null)}
        />
      ) : null}
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

function dayAfter(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function PromoEditor({ open, initial, onClose }: { open: boolean; initial: PromoSaving | null; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const upsertPromoSaving = useApp((s) => s.upsertPromoSaving);
  const picker = moneyAccountsForPicker(accounts);
  const defaultName = locale === "zh-HK" ? "渣打馬拉松" : "SCB Marathon";
  const seeded = initial
    ? initial.rateSchedule.map((step, index) => ({ id: `tier-${index + 1}`, from: step.from, to: step.to, rate: step.rate }))
    : scbMarathonTiers("HKD");
  const [accountId, setAccountId] = useState(initial?.accountId || picker[0]?.id || "");
  const [name, setName] = useState(initial?.nameZh || initial?.name || defaultName);
  const [amount, setAmount] = useState(initial ? String(initial.residualHkd) : "");
  const [currency, setCurrency] = useState<"HKD" | "USD">(initial?.currency === "USD" ? "USD" : "HKD");
  const [access, setAccess] = useState<PromoAccessibility>(initial?.accessibility ?? "unknown");
  const [tiers, setTiers] = useState<MarathonTier[]>(seeded.length ? seeded : scbMarathonTiers("HKD"));
  const [rateText, setRateText] = useState<Record<string, string>>(() =>
    Object.fromEntries((seeded.length ? seeded : scbMarathonTiers("HKD")).map((tier) => [tier.id, String(tier.rate)])),
  );
  const priced = tiers.map((tier) => {
    const n = Number(rateText[tier.id]);
    return { ...tier, rate: Number.isFinite(n) ? n : 0 };
  });
  const est = marathonInterest(resolveAmountInput(amount), priced);

  function changeCurrency(next: "HKD" | "USD") {
    setCurrency(next);
    // Keep saved tier rates when editing an existing promo; only seed SCB rates for brand-new ones.
    if (initial) return;
    const published = scbMarathonTiers(next);
    setTiers(published);
    setRateText(Object.fromEntries(published.map((tier) => [tier.id, String(tier.rate)])));
  }

  function patchTier(id: string, patch: Partial<MarathonTier>) {
    setTiers((prev) => prev.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier)));
  }

  async function save() {
    const residualHkd = resolveAmountInput(amount);
    const usable = priced.filter((tier) => inclusiveDays(tier.from, tier.to) > 0 && tier.rate > 0);
    if (!accountId || residualHkd <= 0 || usable.length === 0) return;
    const ends = priced.map((tier) => tier.to).filter(Boolean).sort();
    const row: PromoSaving = {
      id: initial?.id ?? `promo-${newId()}`,
      accountId,
      residualHkd,
      currency,
      rateSchedule: priced.map(({ from, to, rate }) => ({ from, to, rate })),
      arrangementEnd: ends.at(-1) || initial?.arrangementEnd || "",
      accessibility: access,
      distinctFromTd: true,
      name: name.trim() || defaultName,
      nameZh: name.trim() || defaultName,
    };
    await upsertPromoSaving(row);
    onClose();
  }

  return (
    <Overlay open={open} onClose={onClose} variant="page">
      <div className="flex min-h-dvh flex-col bg-background pb-8">
        <ComposerHeader onClose={onClose} onSave={() => void save()} title={initial ? t.reports.editPromo : t.reports.addMarathon} />
        <p className="px-5 pb-2 text-[11px] leading-4 text-muted">{t.reports.marathonSeedNote}</p>
        <label className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4">
          <span className="text-sm text-muted">{t.reports.promoName}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-right text-sm outline-none" />
        </label>
        <AccountLine accounts={picker} value={accountId} onChange={setAccountId} placeholder={t.reports.bank} role={t.reports.bank} />
        <SelectLine
          label={t.reports.currency}
          value={currency}
          onChange={(v) => changeCurrency(v === "USD" ? "USD" : "HKD")}
          options={[{ id: "HKD", label: "HKD" }, { id: "USD", label: "USD" }]}
        />
        <label className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4">
          <span className="text-sm text-muted">{t.reports.depositAmount}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 w-40 bg-transparent text-right text-sm tabular-nums outline-none"
          />
        </label>
        <div className="px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t.reports.marathonTiers}</div>
        <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
          {tiers.map((tier, i) => {
            const row = est.rows.find((item) => item.id === tier.id);
            return (
              <div key={tier.id} className={i > 0 ? "border-t border-line" : ""}>
                <div className="flex items-center justify-between px-4 pt-1">
                  <span className="text-xs font-medium text-muted">{i + 1}</span>
                  <button
                    type="button"
                    className="grid size-11 place-items-center text-expense"
                    aria-label={t.reports.marathonRemove}
                    onClick={() => setTiers((prev) => prev.filter((item) => item.id !== tier.id))}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <label className="flex min-h-11 items-center justify-between gap-3 px-4">
                  <span className="text-sm text-muted">{t.reports.startDate}</span>
                  <input
                    type="date"
                    value={tier.from}
                    onChange={(e) => patchTier(tier.id, { from: e.target.value })}
                    className="h-11 max-w-[11.5rem] bg-transparent text-right text-sm text-accent outline-none"
                  />
                </label>
                <label className="flex min-h-11 items-center justify-between gap-3 px-4">
                  <span className="text-sm text-muted">{t.reports.endDate}</span>
                  <input
                    type="date"
                    value={tier.to}
                    onChange={(e) => patchTier(tier.id, { to: e.target.value })}
                    className="h-11 max-w-[11.5rem] bg-transparent text-right text-sm text-accent outline-none"
                  />
                </label>
                <div className="flex min-h-11 items-center justify-between gap-3 px-4 pb-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted">{t.reports.promoRate}</span>
                    <input
                      inputMode="decimal"
                      value={rateText[tier.id] ?? String(tier.rate)}
                      onChange={(e) => setRateText((prev) => ({ ...prev, [tier.id]: e.target.value }))}
                      className="h-11 w-20 rounded-lg bg-background px-2 text-right text-sm tabular-nums outline-none"
                    />
                    <span className="text-muted">%</span>
                  </label>
                  <div className="text-right">
                    <div className="text-[11px] text-muted">{(t.reports.marathonDays ?? "{n} days").replace("{n}", String(row?.days ?? 0))}</div>
                    <div className="text-sm font-medium tabular-nums text-income">+{money(row?.interest ?? 0, currency)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 pt-3">
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center rounded-xl bg-elevated text-sm font-medium"
            onClick={() => {
              const last = tiers[tiers.length - 1];
              const from = last?.to ? dayAfter(last.to) : todayISO();
              const id = newId();
              setTiers((prev) => [...prev, { id, from, to: from, rate: last?.rate ?? 0 }]);
              setRateText((prev) => ({ ...prev, [id]: last ? (rateText[last.id] ?? String(last.rate)) : "0" }));
            }}
          >
            {t.reports.marathonAddTier}
          </button>
        </div>
        {est.overlap ? <p className="px-5 pt-3 text-xs text-expense">{t.reports.marathonOverlap}</p> : null}
        <div className="mx-4 mt-3 flex items-center justify-between rounded-2xl bg-elevated px-4 py-3">
          <span className="text-sm">{t.reports.marathonEstimate}</span>
          <span className="text-base font-semibold tabular-nums text-income">+{money(est.total, currency)}</span>
        </div>
        <SelectLine
          label={t.reports.promoAccess}
          value={access}
          onChange={(v) => setAccess(v as PromoAccessibility)}
          options={[
            { id: "unknown", label: t.reports.promoAccessUnknown },
            { id: "accessible", label: t.reports.promoAccessAccessible },
            { id: "restricted", label: t.reports.promoAccessRestricted },
          ]}
        />
        <p className="px-5 pt-3 text-[11px] leading-4 text-muted">{t.reports.promoHint}</p>
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
