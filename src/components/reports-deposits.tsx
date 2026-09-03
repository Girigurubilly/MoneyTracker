import { useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { AccountSelect } from "@/components/account-select";
import { Group, Hairline, ScreenHeader } from "@/components/shared";
import { moneyAccountsForPicker } from "@/lib/accounts";
import { MONTHS_S, suggestedInterest, summarizeDeposits } from "@/lib/calc/deposits";
import { money, todayISO } from "@/lib/format";
import { CURRENCIES, type Currency } from "@/lib/types";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function DepositsPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const deposits = useApp((s) => s.deposits);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const lastFx = useApp((s) => s.lastFxSyncAt);
  const addDeposit = useApp((s) => s.addDeposit);
  const deleteDeposit = useApp((s) => s.deleteDeposit);
  const refreshFx = useApp((s) => s.refreshFx);
  const picker = moneyAccountsForPicker(accounts);
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const [form, setForm] = useState({
    bank: "",
    startDate: today,
    endDate: "",
    rate: "",
    currency: "HKD" as Currency,
    amount: "",
    interest: "",
    accountId: picker[0]?.id ?? "",
    interestTouched: false,
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const summary = useMemo(() => summarizeDeposits(deposits, today, rates), [deposits, today, rates]);
  const sorted = useMemo(() => [...deposits].sort((a, b) => (a.endDate || "").localeCompare(b.endDate || "")), [deposits]);

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if ((key === "amount" || key === "rate" || key === "startDate" || key === "endDate") && !prev.interestTouched) {
        next.interest = String(
          suggestedInterest(parseFloat(String(next.amount)) || 0, parseFloat(String(next.rate)) || 0, next.startDate, next.endDate) || "",
        );
      }
      return next;
    });
  }

  async function add() {
    const amount = parseFloat(form.amount) || 0;
    if (!form.bank.trim() || !form.startDate || !form.endDate || amount <= 0 || !form.accountId) {
      setNote(t.reports.depositNeedFields);
      return;
    }
    let interest = parseFloat(form.interest) || 0;
    if (!interest && form.rate) {
      interest = suggestedInterest(amount, parseFloat(form.rate) || 0, form.startDate, form.endDate);
    }
    await addDeposit({
      bank: form.bank.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      rate: parseFloat(form.rate) || 0,
      currency: form.currency,
      amount,
      interest,
      accountId: form.accountId,
    });
    setForm({
      bank: "",
      startDate: today,
      endDate: "",
      rate: "",
      currency: "HKD",
      amount: "",
      interest: "",
      accountId: form.accountId,
      interestTouched: false,
    });
    setNote("");
  }

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
      <ScreenHeader title={t.reports.deposits} backTo="/reports" />
      <h2 className="px-5 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t.reports.addDeposit}</h2>
      <Group>
        <label className="block px-4 py-3">
          <span className="text-xs text-muted">{t.reports.bank}</span>
          <input value={form.bank} placeholder="HSBC" onChange={(e) => patch("bank", e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-background px-3" />
        </label>
        <Hairline />
        <label className="block px-4 py-3">
          <span className="text-xs text-muted">{t.reports.startDate}</span>
          <input type="date" value={form.startDate} onChange={(e) => patch("startDate", e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-background px-3" />
        </label>
        <Hairline />
        <label className="block px-4 py-3">
          <span className="text-xs text-muted">{t.reports.endDate}</span>
          <input type="date" value={form.endDate} onChange={(e) => patch("endDate", e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-background px-3" />
        </label>
        <Hairline />
        <label className="block px-4 py-3">
          <span className="text-xs text-muted">{t.reports.ratePct}</span>
          <input type="number" step="0.01" value={form.rate} placeholder="3.80" onChange={(e) => patch("rate", e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-background px-3" />
        </label>
        <Hairline />
        <label className="block px-4 py-3">
          <span className="text-xs text-muted">{t.reports.currency}</span>
          <select value={form.currency} onChange={(e) => patch("currency", e.target.value as Currency)} className="mt-1 h-11 w-full rounded-lg bg-background px-3">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <Hairline />
        <label className="block px-4 py-3">
          <span className="text-xs text-muted">{t.reports.depositAmount}</span>
          <input type="number" step="0.01" value={form.amount} placeholder="100000" onChange={(e) => patch("amount", e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-background px-3" />
        </label>
        <Hairline />
        <label className="block px-4 py-3">
          <span className="text-xs text-muted">{t.reports.interest}</span>
          <input
            type="number"
            step="0.01"
            value={form.interest}
            placeholder="0"
            onChange={(e) => setForm((prev) => ({ ...prev, interest: e.target.value, interestTouched: true }))}
            className="mt-1 h-11 w-full rounded-lg bg-background px-3"
          />
          <button
            type="button"
            className="mt-2 text-xs font-medium text-accent"
            onClick={() => {
              const value = suggestedInterest(parseFloat(form.amount) || 0, parseFloat(form.rate) || 0, form.startDate, form.endDate);
              setForm((prev) => ({ ...prev, interest: value ? String(value) : "", interestTouched: false }));
            }}
          >
            {t.reports.suggestInterest}
          </button>
        </label>
        <Hairline />
        <label className="block px-4 py-3">
          <span className="text-xs text-muted">{t.reports.creditAccount}</span>
          <AccountSelect accounts={accounts} value={form.accountId} onChange={(id) => patch("accountId", id)} />
        </label>
      </Group>
      <div className="px-4 pt-3">
        <button type="button" onClick={() => void add()} className="flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-accent text-sm font-semibold text-on-accent">
          <Plus className="size-4" />
          {t.reports.addRecord}
        </button>
      </div>

      <h2 className="px-5 pb-2 pt-6 text-xs font-semibold uppercase tracking-wide text-muted">{t.reports.depositRecords}</h2>
      {sorted.length === 0 ? (
        <p className="px-5 text-sm text-muted">{t.reports.noDepositsHint}</p>
      ) : (
        <Group>
          {sorted.map((r, i) => {
            const realized = !!r.endDate && r.endDate <= today;
            const d = r.endDate ? new Date(`${r.endDate}T00:00:00`) : null;
            const rm = d && !Number.isNaN(d.getTime()) ? `${MONTHS_S[d.getMonth()]} ${d.getFullYear()}` : "—";
            const tone = realized ? "text-income" : d && d.getFullYear() === year ? "text-accent" : "text-muted";
            return (
              <div key={r.id}>
                {i > 0 ? <Hairline /> : null}
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{r.bank}</span>
                      <span className={`text-xs font-medium ${tone}`}>{rm}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {money(r.amount, r.currency)} · {(r.rate || 0).toFixed(2)}% · {r.startDate} → {r.endDate}
                    </div>
                    <div className="mt-1 flex justify-between text-sm tabular-nums">
                      <span className="text-income">+{money(r.interest, r.currency)}</span>
                      <span>{money((r.amount || 0) + (r.interest || 0), r.currency)}</span>
                    </div>
                  </div>
                  <button type="button" className="mt-1 text-expense" onClick={() => void deleteDeposit(r.id)} aria-label={locale === "zh-HK" ? "刪除" : "Delete"}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </Group>
      )}

      <div className="mt-6 flex items-center justify-between px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.reports.hkdSummary}</h2>
        <button type="button" onClick={() => void fetchFx()} disabled={busy} className="flex items-center gap-1 text-xs font-medium text-accent">
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
          {t.reports.fetchFx}
        </button>
      </div>
      <div className="mx-4 mt-2 grid grid-cols-2 gap-2">
        <Metric label={t.reports.activeDeposit} value={money(summary.depHKD, "HKD")} />
        <Metric label={t.reports.interestToEarn} value={money(summary.intHKD, "HKD")} tone="income" />
        <Metric label={t.reports.interestRealized} value={money(summary.realizedHKD, "HKD")} tone="income" />
        <Metric label={t.reports.unrealizedThisYear} value={money(summary.unrealizedThisYearHKD, "HKD")} />
        <Metric label={t.reports.interestAfterYear.replace("{year}", String(year))} value={money(summary.unrealizedAfterYearHKD, "HKD")} />
      </div>
      {note || lastFx ? <p className="px-5 pt-3 text-xs text-muted">{note || lastFx}</p> : null}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "income" }) {
  return (
    <div className="rounded-xl bg-elevated px-3 py-3">
      <div className="text-[11px] leading-snug text-muted">{label}</div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${tone === "income" ? "text-income" : ""}`}>{value}</div>
    </div>
  );
}
