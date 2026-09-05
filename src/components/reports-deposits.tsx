import { useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Hairline, Overlay, ScreenHeader, SectionLabel } from "@/components/shared";
import { moneyAccountsForPicker } from "@/lib/accounts";
import { MONTHS_S, suggestedInterest, summarizeDeposits } from "@/lib/calc/deposits";
import { money, todayISO } from "@/lib/format";
import { resolveAmountInput } from "@/lib/money-expr";
import { CURRENCIES, type Currency, type TimeSaving } from "@/lib/types";
import {
  AccountLine,
  ActiveKeypad,
  ComposerHeader,
  ComposerShell,
  LineRow,
  SelectLine,
  TextLine,
} from "@/components/txn-composer";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function DepositsPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const deposits = useApp((s) => s.deposits);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const lastFx = useApp((s) => s.lastFxSyncAt);
  const deleteDeposit = useApp((s) => s.deleteDeposit);
  const refreshFx = useApp((s) => s.refreshFx);
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const [editing, setEditing] = useState<TimeSaving | null | "new">(null);
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
        backTo="/reports"
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

      <h2 className="px-5 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t.reports.depositRecords}</h2>
      {grouped.length === 0 ? (
        <p className="px-5 text-sm text-muted">{t.reports.noDepositsHint}</p>
      ) : (
        grouped.map(([yr, rows]) => (
          <div key={yr} className="mb-4">
            <SectionLabel>{yr}</SectionLabel>
            <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
              {rows.map((r, i) => {
                const realized = !!r.endDate && r.endDate <= today;
                const d = r.endDate ? new Date(`${r.endDate}T00:00:00`) : null;
                const rm = d && !Number.isNaN(d.getTime()) ? `${MONTHS_S[d.getMonth()]} ${d.getFullYear()}` : "—";
                const tone = realized ? "text-income" : d && d.getFullYear() === year ? "text-accent" : "text-muted";
                return (
                  <div key={r.id}>
                    {i > 0 ? <Hairline /> : null}
                    <div className="flex items-start gap-3 px-4 py-3">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(r)}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{r.bank}</span>
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
        ))
      )}

      {note || lastFx ? <p className="px-5 pt-3 text-xs text-muted">{note || lastFx}</p> : null}

      <DepositEditor
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        open={editing !== null}
        initial={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function DepositEditor({ open, initial, onClose }: { open: boolean; initial: TimeSaving | null; onClose: () => void }) {
  const t = useT();
  const accounts = useApp((s) => s.accounts);
  const addDeposit = useApp((s) => s.addDeposit);
  const updateDeposit = useApp((s) => s.updateDeposit);
  const picker = moneyAccountsForPicker(accounts);
  const today = todayISO();
  const [bank, setBank] = useState(initial?.bank ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? today);
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [rate, setRate] = useState(initial ? String(initial.rate) : "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "HKD");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [interest, setInterest] = useState(initial ? String(initial.interest) : "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? picker[0]?.id ?? "");
  const [interestTouched, setInterestTouched] = useState(Boolean(initial));
  const [field, setField] = useState<"amount" | "dest" | "principal" | "interest">("amount");

  function suggest(nextAmt = amount, nextRate = rate, nextStart = startDate, nextEnd = endDate) {
    return suggestedInterest(resolveAmountInput(nextAmt), parseFloat(nextRate) || 0, nextStart, nextEnd);
  }

  async function save() {
    const amt = resolveAmountInput(amount);
    if (!bank.trim() || !startDate || !endDate || amt <= 0 || !accountId) return;
    let int = resolveAmountInput(interest);
    if (!int) int = suggest();
    const row = {
      bank: bank.trim(),
      startDate,
      endDate,
      rate: parseFloat(rate) || 0,
      currency,
      amount: amt,
      interest: int,
      accountId,
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
        <TextLine value={bank} onChange={setBank} placeholder={t.reports.bank} />
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm text-muted">{t.reports.startDate}</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
        </div>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm text-muted">{t.reports.endDate}</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
        </div>
        <SelectLine label={t.reports.currency} value={currency} onChange={(v) => setCurrency(v as Currency)} options={CURRENCIES.map((c) => ({ id: c, label: c }))} />
        <LineRow label={t.reports.depositAmount} amount={amount} active={field === "amount"} onFocusAmount={() => setField("amount")} />
        <LineRow label={t.reports.interest} amount={interest} active={field === "interest"} onFocusAmount={() => setField("interest")} />
        <AccountLine accounts={accounts} value={accountId} onChange={setAccountId} placeholder={t.reports.creditAccount} />
      </ComposerShell>
    </Overlay>
  );
}
