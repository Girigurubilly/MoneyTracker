import { useState } from "react";
import { Hairline, InfoButton, Overlay, ProgressRing, ScreenHeader, SectionLabel, TxGroupedList } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import {
  formatRatePct,
  housingMonthLines,
  housingTransactions,
  installmentOf,
  linkedLoan,
  linkedProperty,
  livingModeOf,
  loanTimeProgress,
  monthsAgoIso,
  projection12,
  rateLine,
  remainingMonthsLabel,
  stressRows,
} from "@/lib/calc/housing";
import { effectiveRate, endDateFromRemaining, remainingInterest } from "@/lib/calc/mortgage";
import type { Mortgage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function LivingPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rec = useApp((s) => s.recurring);
  const m = useApp((s) => s.mortgage);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const accounts = useApp((s) => s.accounts);
  const txs = useApp((s) => s.transactions);
  const setTx = useUi((s) => s.setTxDetailId);
  const [edit, setEdit] = useState(false);
  const today = todayISO();
  const lines = housingMonthLines(txs, rec, cats, rates, today);
  const cost = lines.reduce((s, r) => s + r.amount, 0);
  const mode = livingModeOf(m);
  const modeLabel =
    mode === "own-mortgage"
      ? t.reports.modeOwnMortgage
      : mode === "own-outright"
        ? t.reports.modeOwnOutright
        : mode === "rent"
          ? t.reports.modeRent
          : t.reports.modeOther;
  const property = linkedProperty(accounts, m);
  const loan = linkedLoan(accounts, m);
  const pmt = m ? installmentOf(m) : 0;
  const rate = m ? effectiveRate(m) : 0;
  const interest = m ? remainingInterest(m.outstanding, rate, m.remainingMonths) : 0;
  const end = m ? endDateFromRemaining(today, m.remainingMonths, m.paymentDay) : "";
  const proj = m ? projection12(m) : null;
  const stress = m ? stressRows(m) : [];
  const paidPct = m ? loanTimeProgress(m, today) : 0;
  const related = housingTransactions(txs, cats, monthsAgoIso(today, 12), today);

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.reports.living}
        backTo="/reports"
        right={
          <div className="flex items-center">
            <InfoButton k="mortgage" />
            <button type="button" className="px-2 text-sm font-medium text-accent" onClick={() => setEdit(true)}>
              {t.reports.updateMortgage}
            </button>
          </div>
        }
      />
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-accent">{modeLabel}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{money(cost, "HKD")}</div>
            <div className="mt-0.5 text-xs text-muted">{t.reports.housingCost}</div>
          </div>
          {m ? (
            <div className="relative shrink-0">
              <ProgressRing
                value={paidPct}
                size={64}
                stroke={5}
                tone={paidPct < 0.3 ? "watch" : "income"}
              />
              <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums">
                {`${Math.round(paidPct * 100)}%`}
              </span>
            </div>
          ) : null}
        </div>
        {property || m ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-success-soft px-3 py-2">
              <div className="text-[11px] text-income">{t.reports.propertyValue}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">{property ? money(property.balance, "HKD") : "—"}</div>
            </div>
            <div className="rounded-xl bg-expense-soft px-3 py-2">
              <div className="text-[11px] text-expense">{t.reports.owedBank}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">{m ? money(m.outstanding, "HKD") : "—"}</div>
            </div>
            <div className="rounded-xl bg-background px-3 py-2">
              <div className="text-[11px] text-muted">{t.reports.installment}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(pmt, "HKD")}</div>
            </div>
            <div className="rounded-xl bg-background px-3 py-2">
              <div className="text-[11px] text-muted">{t.reports.currentRate}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">{m ? rateLine(m) : "—"}</div>
            </div>
          </div>
        ) : null}
        {lines.length ? (
          <div className="mt-3 space-y-1">
            {lines.map((r) => (
              <div key={r.id} className="flex justify-between text-sm">
                <span className="text-muted">{pickName(locale, r.label, r.labelZh)}</span>
                <span className="tabular-nums">{money(r.amount, "HKD")}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {m ? (
        <>
          <SectionLabel>{locale === "zh-HK" ? "按揭" : "Mortgage"}</SectionLabel>
          <div className="mx-4 rounded-xl bg-elevated px-4">
            <Kv label={t.reports.linkedProperty} value={property ? pickName(locale, property.name, property.nameZh) : "—"} />
            <Hairline />
            <Kv label={t.reports.propertyValue} value={property ? money(property.balance, "HKD") : "—"} />
            <Hairline />
            <Kv label={t.reports.originalLoan} value={money(m.original || m.outstanding, "HKD")} />
            <Hairline />
            <Kv label={t.reports.loanStart} value={m.startDate || "—"} />
            <Hairline />
            <Kv label={t.reports.owedBank} value={money(m.outstanding, "HKD")} />
            <Hairline />
            <Kv label={t.reports.loan} value={loan ? pickName(locale, loan.name, loan.nameZh) : pickName(locale, m.name, m.nameZh)} />
            <Hairline />
            <Kv label={t.reports.currentRate} value={rateLine(m)} />
            <Hairline />
            <Kv label={t.reports.installment} value={money(pmt, "HKD")} />
            <Hairline />
            <Kv label={t.reports.mortgageEnd} value={end} />
            <Hairline />
            <Kv label={t.reports.remainingMonths} value={remainingMonthsLabel(m.remainingMonths, locale)} />
            <Hairline />
            <Kv label={t.reports.remainingInterest} value={money(interest, "HKD")} last />
          </div>

          <SectionLabel>{t.reports.stress}</SectionLabel>
          <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
            {stress.map((s, i) => (
              <div key={s.shock}>
                {i > 0 ? <Hairline /> : null}
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">+{formatRatePct(s.shock)}</div>
                    <div className="text-xs text-muted">{t.reports.newInterest}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm tabular-nums">{money(s.payment, "HKD")}</div>
                    <div className="text-xs tabular-nums text-muted">{money(s.interest, "HKD")}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {proj ? (
            <>
              <SectionLabel>{t.reports.projection12}</SectionLabel>
              <div className="mx-4 space-y-2">
                {proj.rows.map((r, i) => {
                  const d = new Date(`${today.slice(0, 7)}-01T00:00:00`);
                  d.setMonth(d.getMonth() + i);
                  const label = locale === "zh-HK" ? `${d.getMonth() + 1}月` : d.toLocaleString("en", { month: "short" });
                  return (
                    <div key={r.n} className="rounded-2xl bg-elevated px-3 py-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold">{label}</span>
                        <span className="text-sm font-semibold tabular-nums">{money(proj.payment, "HKD")}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-muted">{t.reports.interestCol}</div>
                          <div className="mt-0.5 tabular-nums">{money(r.interest, "HKD")}</div>
                        </div>
                        <div>
                          <div className="text-muted">{t.reports.principalCol}</div>
                          <div className="mt-0.5 tabular-nums">{money(r.principal, "HKD")}</div>
                        </div>
                        <div>
                          <div className="text-muted">{t.reports.balanceCol}</div>
                          <div className="mt-0.5 tabular-nums">{money(r.balance, "HKD")}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      <TxGroupedList txs={related} onClick={(tx) => setTx(tx.id)} empty={t.common.none} />
      <MortgageEditor key={edit ? m?.id ?? "new" : "closed"} open={edit} onClose={() => setEdit(false)} />
    </div>
  );
}

function Kv({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-3", last && "pb-3.5")}>
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right text-sm tabular-nums">{value}</span>
    </div>
  );
}

function MortgageEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const m = useApp((s) => s.mortgage);
  const accounts = useApp((s) => s.accounts);
  const update = useApp((s) => s.updateMortgage);
  const properties = accounts.filter((a) => a.type === "property");
  const loans = accounts.filter((a) => a.type === "mortgage" || a.type === "loan");
  const [outstanding, setOutstanding] = useState(String(m?.outstanding ?? 0));
  const [original, setOriginal] = useState(String(m?.original ?? m?.outstanding ?? 0));
  const [startDate, setStartDate] = useState(m?.startDate ?? "");
  const [months, setMonths] = useState(String(m?.remainingMonths ?? 240));
  const [pRate, setPRate] = useState(String(((m?.pRate ?? m?.rate ?? 0.05) * 100).toFixed(2)));
  const [spread, setSpread] = useState(String(((m?.spread ?? 0) * 100).toFixed(2)));
  const [fixed, setFixed] = useState(String(((m?.rate ?? 0.0375) * 100).toFixed(2)));
  const [type, setType] = useState<Mortgage["type"]>(m?.type ?? "p");
  const [mode, setMode] = useState<NonNullable<Mortgage["livingMode"]>>(m?.livingMode ?? "own-mortgage");
  const [propertyId, setPropertyId] = useState(m?.propertyAccountId ?? properties[0]?.id ?? "");
  const [accountId, setAccountId] = useState(m?.accountId ?? loans[0]?.id ?? "");
  const [day, setDay] = useState(String(m?.paymentDay ?? 1));
  const [override, setOverride] = useState(m?.paymentOverride ? String(m.paymentOverride) : "");

  return (
    <Overlay open={open} onClose={onClose} title={t.reports.updateMortgage} variant="page">
      <div className="px-5 pb-10">
        <label className="block py-2 text-xs text-muted">
          {t.reports.livingMode}
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground">
            <option value="own-mortgage">{t.reports.modeOwnMortgage}</option>
            <option value="own-outright">{t.reports.modeOwnOutright}</option>
            <option value="rent">{t.reports.modeRent}</option>
            <option value="other">{t.reports.modeOther}</option>
          </select>
        </label>
        <label className="block py-2 text-xs text-muted">
          {t.reports.linkedProperty}
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground">
            <option value="">{t.common.none}</option>
            {properties.map((a) => (
              <option key={a.id} value={a.id}>
                {pickName(locale, a.name, a.nameZh)}
              </option>
            ))}
          </select>
        </label>
        <label className="block py-2 text-xs text-muted">
          {t.reports.loan}
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground">
            {loans.map((a) => (
              <option key={a.id} value={a.id}>
                {pickName(locale, a.name, a.nameZh)}
              </option>
            ))}
          </select>
        </label>
        <label className="block py-2 text-xs text-muted">
          {t.reports.originalLoan}
          <input inputMode="decimal" value={original} onChange={(e) => setOriginal(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
        </label>
        <label className="block py-2 text-xs text-muted">
          {t.reports.loanStart}
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
        </label>
        <label className="block py-2 text-xs text-muted">
          {t.reports.owedBank}
          <input inputMode="decimal" value={outstanding} onChange={(e) => setOutstanding(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
        </label>
        <label className="block py-2 text-xs text-muted">
          {t.reports.remainingMonths}
          <input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
        </label>
        <label className="block py-2 text-xs text-muted">
          {locale === "zh-HK" ? "利率類型" : "Rate type"}
          <select value={type} onChange={(e) => setType(e.target.value as Mortgage["type"])} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground">
            <option value="p">P</option>
            <option value="h">H</option>
            <option value="fixed">{locale === "zh-HK" ? "固定" : "Fixed"}</option>
          </select>
        </label>
        {type === "fixed" ? (
          <label className="block py-2 text-xs text-muted">
            {t.reports.effectiveRate} (%)
            <input inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="block py-2 text-xs text-muted">
              {type.toUpperCase()} (%)
              <input inputMode="decimal" value={pRate} onChange={(e) => setPRate(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
            </label>
            <label className="block py-2 text-xs text-muted">
              {locale === "zh-HK" ? "息差 (%)" : "Spread (%)"}
              <input inputMode="decimal" value={spread} onChange={(e) => setSpread(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
            </label>
          </div>
        )}
        <label className="block py-2 text-xs text-muted">
          {locale === "zh-HK" ? "供款日" : "Payment day"}
          <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
        </label>
        <label className="block py-2 text-xs text-muted">
          {t.reports.installment} ({locale === "zh-HK" ? "可覆寫" : "optional override"})
          <input inputMode="decimal" value={override} onChange={(e) => setOverride(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
        </label>
        <button
          type="button"
          className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
          onClick={async () => {
            const p = Number(pRate) / 100;
            const sp = Number(spread) / 100;
            const fx = Number(fixed) / 100;
            const next: Mortgage = {
              id: m?.id ?? "m1",
              name: m?.name ?? "Mortgage",
              nameZh: m?.nameZh ?? "按揭",
              accountId: accountId || m?.accountId || "mortgage",
              original: Number(original) || Number(outstanding) || 0,
              startDate: startDate || undefined,
              outstanding: Number(outstanding) || 0,
              rate: type === "fixed" ? fx : p + sp,
              pRate: type === "fixed" ? undefined : p,
              spread: type === "fixed" ? undefined : sp,
              remainingMonths: Math.max(1, Math.round(Number(months) || 1)),
              paymentDay: Math.min(28, Math.max(1, Number(day) || 1)),
              type,
              livingMode: mode,
              propertyAccountId: propertyId || undefined,
              paymentOverride: Number(override) > 0 ? Number(override) : undefined,
            };
            await update(next);
            onClose();
          }}
        >
          {t.add.save}
        </button>
      </div>
    </Overlay>
  );
}

