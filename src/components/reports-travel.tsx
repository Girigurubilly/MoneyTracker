import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Hairline, InfoButton, Overlay, ProgressBar, ScreenHeader, SectionLabel, StatusChip } from "@/components/shared";
import { mdLabel, milesLabel, money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import {
  asiaMilesBalance,
  isTripActive,
  spendStatus,
  travelSpendYtd,
  tripBudgetUsed,
  tripCashSpent,
  tripLinkedTxs,
} from "@/lib/calc/trips";
import { cashflowSide } from "@/lib/calc/ledger";
import type { Trip } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function TravelPage() {
  const t = useT();
  const loc = useUi((s) => s.locale);
  const trips = useApp((s) => s.trips);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const accounts = useApp((s) => s.accounts);
  const annual = useApp((s) => s.annualTravelBudget);
  const setAnnual = useApp((s) => s.setAnnualTravel);
  const travelIds = new Set(cats.filter((c) => c.theme === "travel").map((c) => c.id));
  const ytd = travelSpendYtd(txs, Number(todayISO().slice(0, 4)), travelIds, rates);
  const miles = asiaMilesBalance(accounts);
  const yearStatus = spendStatus(ytd, annual);
  const [adding, setAdding] = useState(false);
  const [editAnnual, setEditAnnual] = useState(false);
  const active = trips.filter((tr) => isTripActive(tr, todayISO()));

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.reports.travel}
        backTo="/reports"
        right={
          <div className="flex items-center">
            <InfoButton k="trip" />
            <button type="button" aria-label={t.reports.addTrip} className="grid size-11 place-items-center text-foreground" onClick={() => setAdding(true)}>
              <Plus className="size-6" strokeWidth={1.8} />
            </button>
          </div>
        }
      />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="text-xs text-muted">{t.reports.annualTravel}</div>
        <button type="button" className="mt-1 block text-left" onClick={() => setEditAnnual(true)}>
          <span className="text-xl font-semibold tabular-nums">{money(ytd, "HKD")}</span>
          <span className="text-sm font-normal text-muted"> / {money(annual, "HKD")}</span>
        </button>
        <div className="mt-3 text-sm">
          {loc === "zh-HK" ? "亞洲萬里通" : "Asia Miles"}: {milesLabel(miles, loc)}
        </div>
        <p className="mt-2 text-xs text-muted">{t.reports.milesNote}</p>
        <ProgressBar value={annual > 0 ? ytd / annual : 0} tone={yearStatus === "at-risk" ? "expense" : yearStatus === "watch" ? "watch" : "income"} />
      </div>
      <SectionLabel>{t.reports.trips}</SectionLabel>
      {active.map((tr) => {
        const spent = tripCashSpent(txs, tr.id, rates);
        const used = tripBudgetUsed(spent, tr.cashBudget);
        const st = spendStatus(spent, tr.cashBudget);
        return (
          <Link key={tr.id} to="/reports/travel/$id" params={{ id: tr.id }} className="mx-4 mb-3 block rounded-xl bg-elevated p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-base font-semibold">{pickName(loc, tr.name, tr.nameZh)}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {tr.destination} · {tr.start} → {tr.end}
                </div>
              </div>
              <StatusChip status={st} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted">{t.reports.tripSpent}</div>
                <div className="mt-1 text-sm font-semibold tabular-nums">
                  {money(spent, "HKD")} / {money(tr.cashBudget, "HKD")}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">{t.reports.budgetUsed}</div>
                <div className="mt-1 text-sm font-semibold tabular-nums">{Math.round(used.pct * 100)}%</div>
              </div>
            </div>
            <ProgressBar value={used.pct} tone={st === "at-risk" ? "expense" : "income"} />
            <div className="mt-2 text-xs text-muted">
              {loc === "zh-HK" ? "亞洲萬里通" : "Asia Miles"}: {milesLabel(tr.milesSaved, loc)} / {milesLabel(tr.milesTarget, loc)}
            </div>
          </Link>
        );
      })}
      {active.length === 0 ? <p className="px-5 py-6 text-center text-sm text-muted">{t.common.none}</p> : null}
      <TripEditor key={adding ? "new-trip" : "new-idle"} open={adding} onClose={() => setAdding(false)} />
      <Overlay open={editAnnual} onClose={() => setEditAnnual(false)} title={t.reports.annualTravel}>
        <AnnualEditor current={annual} onSave={async (n) => { await setAnnual(n); setEditAnnual(false); }} onClose={() => setEditAnnual(false)} />
      </Overlay>
    </div>
  );
}

function AnnualEditor({ current, onSave, onClose }: { current: number; onSave: (n: number) => void; onClose: () => void }) {
  const t = useT();
  const [v, setV] = useState(String(current));
  return (
    <div className="px-5 pb-8">
      <input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} className="h-11 w-full rounded-lg bg-elevated px-3" />
      <button type="button" className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => onSave(Number(v) || 0)}>
        {t.add.save}
      </button>
      <button type="button" className="mt-2 h-11 w-full text-sm text-muted" onClick={onClose}>
        {t.add.cancel}
      </button>
    </div>
  );
}

export function TripDetailPage({ id }: { id: string }) {
  const t = useT();
  const loc = useUi((s) => s.locale);
  const nav = useNavigate();
  const trip = useApp((s) => s.trips.find((x) => x.id === id));
  const del = useApp((s) => s.deleteTrip);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const cats = useApp((s) => s.categories);
  const accs = useApp((s) => s.accounts);
  const setTx = useUi((s) => s.setTxDetailId);
  const [edit, setEdit] = useState(false);
  if (!trip) return <div className="p-5 text-sm text-muted">—</div>;
  const spent = tripCashSpent(txs, trip.id, rates);
  const used = tripBudgetUsed(spent, trip.cashBudget);
  const linked = tripLinkedTxs(txs, trip.id);
  const st = spendStatus(spent, trip.cashBudget);

  return (
    <div className="pb-10">
      <ScreenHeader
        title={pickName(loc, trip.name, trip.nameZh)}
        backTo="/reports/travel"
        right={
          <button type="button" className="px-2 text-sm font-medium text-accent" onClick={() => setEdit(true)}>
            {t.reports.editTrip}
          </button>
        }
      />
      <div className="mx-4 rounded-xl bg-elevated p-4">
        <div className="text-sm">{trip.destination}</div>
        <div className="mt-0.5 text-sm text-muted">
          {trip.start} → {trip.end}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted">{t.reports.cash}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{money(trip.cashBudget, "HKD")}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.reports.tripSpent}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{money(spent, "HKD")}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.reports.budgetUsed}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{Math.round(used.pct * 100)}%</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.reports.remaining}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{money(used.remaining, "HKD")}</div>
          </div>
        </div>
        <ProgressBar value={used.pct} tone={st === "at-risk" ? "expense" : "income"} />
      </div>
      <SectionLabel>{t.reports.related}</SectionLabel>
      <div className="mx-4 overflow-hidden rounded-xl bg-elevated">
        {linked.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{t.common.none}</p>
        ) : (
          linked.map((tx, i) => {
            const cat = cats.find((c) => c.id === tx.categoryId);
            const acc = accs.find((a) => a.id === tx.accountId);
            const spend = cashflowSide(tx) === "expense" || tx.type === "expense";
            return (
              <div key={tx.id}>
                {i > 0 ? <Hairline /> : null}
                <button type="button" onClick={() => setTx(tx.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <div className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-muted">
                    <span className="text-sm">{(cat ? pickName(loc, cat.name, cat.nameZh) : "·").slice(0, 1)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {cat ? pickName(loc, cat.name, cat.nameZh) : pickName(loc, tx.payee, tx.payeeZh)}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {mdLabel(tx.date, loc)}
                      {acc ? ` · ${pickName(loc, acc.name, acc.nameZh)}` : ""}
                    </div>
                  </div>
                  <span className="rounded-full bg-expense-soft px-2.5 py-1 text-sm font-medium tabular-nums text-expense">
                    {money(spend ? -Math.abs(tx.amount) : tx.amount, tx.currency, { sign: true })}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
      <p className="px-5 pt-4 text-xs text-muted">{t.reports.milesNote}</p>
      <TripEditor
        key={edit ? trip.id : "edit-idle"}
        open={edit}
        trip={trip}
        onClose={() => setEdit(false)}
        onDeleted={() => {
          void del(trip.id);
          void nav({ to: "/reports/travel" });
        }}
      />
    </div>
  );
}

function TripEditor({
  open,
  trip,
  onClose,
  onDeleted,
}: {
  open: boolean;
  trip?: Trip;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const t = useT();
  const add = useApp((s) => s.addTrip);
  const update = useApp((s) => s.updateTrip);
  const today = todayISO();
  const [name, setName] = useState(trip?.nameZh || trip?.name || "");
  const [dest, setDest] = useState(trip?.destination || "");
  const [start, setStart] = useState(trip?.start || today);
  const [end, setEnd] = useState(trip?.end || today);
  const [budget, setBudget] = useState(String(trip?.cashBudget ?? 10000));
  const [milesT, setMilesT] = useState(String(trip?.milesTarget ?? 0));
  const [milesS, setMilesS] = useState(String(trip?.milesSaved ?? 0));
  const [monthly, setMonthly] = useState(String(trip?.monthlyCash ?? 0));

  return (
    <Overlay open={open} onClose={onClose} title={trip ? t.reports.editTrip : t.reports.addTrip} variant="page">
      <div className="px-5 pb-10">
        <Field label={t.budget.customName} value={name} onChange={setName} />
        <Field label={t.reports.destination} value={dest} onChange={setDest} />
        <label className="block py-2 text-xs text-muted">
          {t.reports.tripStart}
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
        </label>
        <label className="block py-2 text-xs text-muted">
          {t.reports.tripEnd}
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground" />
        </label>
        <Field label={t.reports.cashBudget} value={budget} onChange={setBudget} numeric />
        <Field label={t.reports.milesTarget} value={milesT} onChange={setMilesT} numeric />
        <Field label={t.reports.milesSaved} value={milesS} onChange={setMilesS} numeric />
        <Field label={t.reports.monthlyCash} value={monthly} onChange={setMonthly} numeric />
        <button
          type="button"
          className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
          onClick={async () => {
            const n = name.trim() || dest.trim();
            if (!n) return;
            const row: Trip = {
              id: trip?.id ?? newId(),
              name: n,
              nameZh: n,
              destination: dest.trim() || n,
              start,
              end: end < start ? start : end,
              status: trip?.status ?? "planning",
              cashBudget: Number(budget) || 0,
              cashSaved: trip?.cashSaved ?? 0,
              milesTarget: Number(milesT) || 0,
              milesSaved: Number(milesS) || 0,
              monthlyCash: Number(monthly) || 0,
            };
            if (trip) await update(row);
            else await add(row);
            onClose();
          }}
        >
          {t.add.save}
        </button>
        {trip && onDeleted ? (
          <button type="button" className="mt-4 h-11 w-full text-sm text-expense" onClick={onDeleted}>
            {t.reports.removeTrip}
          </button>
        ) : null}
      </div>
    </Overlay>
  );
}

function Field({
  label,
  value,
  onChange,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <label className="block py-2 text-xs text-muted">
      {label}
      <input
        inputMode={numeric ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground"
      />
    </label>
  );
}
