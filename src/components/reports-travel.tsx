import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, ChevronDown } from "lucide-react";
import { InfoButton, Overlay, ProgressRing, ScreenHeader, SectionLabel, BudgetChip, TxGroupedList } from "@/components/shared";
import { Enter, useCountUp } from "@/components/retire-ux";
import { ComposerHeader, ComposerShell, LineRow, TextLine, ActiveKeypad } from "@/components/txn-composer";
import { dateRangeLabel, formatTypingAmount, money, shortDate, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { toHkd } from "@/lib/calc/fx";
import { cashflowSide } from "@/lib/calc/ledger";
import {
  isTripActive,
  travelSpendYtdSplit,
  travelUnlinkedTxs,
  tripBudgetUsed,
  tripLinkedTxs,
  tripMoneySplit,
} from "@/lib/calc/trips";
import type { Category, FxRate, Locale, Transaction, Trip } from "@/lib/types";
import { plannerTripUrl } from "@/lib/trip-link";
import { cn } from "@/lib/utils";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function TravelPage() {
  const t = useT();
  const loc = useUi((s) => s.locale);
  const trips = useApp((s) => s.trips);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const annual = useApp((s) => s.annualTravelBudget);
  const setAnnual = useApp((s) => s.setAnnualTravel);
  const updateTx = useApp((s) => s.updateTransaction);
  const setTx = useUi((s) => s.setTxDetailId);
  const travelIds = useMemo(() => new Set(cats.filter((c) => c.theme === "travel").map((c) => c.id)), [cats]);
  const year = Number(todayISO().slice(0, 4));
  const ytd = travelSpendYtdSplit(txs, year, travelIds, rates);
  const annualEff = effectiveAnnualTravelBudget(annual, trips, year);
  const travelBudget = annualEff.budget;
  const yearOver = travelBudget > 0 && ytd.total > travelBudget;
  const [adding, setAdding] = useState(false);
  const [editAnnual, setEditAnnual] = useState(false);
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [showLinked, setShowLinked] = useState(false);
  const [linkTxId, setLinkTxId] = useState<string | null>(null);
  const [countReady, setCountReady] = useState(false);
  const [stickyOn, setStickyOn] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const unlinked = travelUnlinkedTxs(txs, year, travelIds);
  const today = todayISO();
  const grouped = useMemo(() => groupTravelTrips(trips, today, year), [trips, today, year]);
  const { current, pastThisYear, olderYears, pastCount } = grouped;
  const tripsWithSpend = useMemo(() => {
    const ids = new Set(
      txs
        .filter((tx) => tx.tripId && !tx.planned && tx.type === "expense" && tx.date.startsWith(String(year)))
        .map((tx) => tx.tripId as string),
    );
    return trips.filter((tr) => tr.status !== "cancelled" && ids.has(tr.id));
  }, [txs, trips, year]);
  const linkCandidates = useMemo(
    () => trips.filter((tr) => tr.status !== "cancelled" && isTripActive(tr, today)),
    [trips, today],
  );

  useEffect(() => {
    setCountReady(true);
  }, []);

  useEffect(() => {
    const el = summaryRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => setStickyOn(!entry.isIntersecting), {
      root: null,
      threshold: 0,
      rootMargin: "-8px 0px 0px 0px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const shownTotal = useCountUp(countReady ? ytd.total : 0, false, 500);
  const shownUnlinked = useCountUp(countReady ? ytd.unlinked : 0, false, 500);
  const ringPct = travelBudget > 0 ? ytd.total / travelBudget : 0;

  async function attachTrip(txId: string, tripId: string) {
    const tx = txs.find((row) => row.id === txId);
    if (!tx) return;
    await updateTx({ ...tx, tripId, tripManual: true }, tx);
    setLinkTxId(null);
  }

  return (
    <div className="pb-24">
      <ScreenHeader
        title={t.reports.travel}
        backTo="/reports"
        right={
          <div className="flex items-center">
            <InfoButton k="trip" />
            <button type="button" aria-label={t.reports.addTrip} className="tr-press grid size-11 place-items-center text-foreground" onClick={() => setAdding(true)}>
              <Plus className="size-6" strokeWidth={1.8} />
            </button>
          </div>
        }
      />

      {stickyOn ? (
        <div className="tr-sticky flex items-center gap-3 px-4 py-2">
          <div className="relative shrink-0">
            <ProgressRing value={ringPct} size={36} stroke={3} tone={yearOver ? "expense" : "income"} />
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-[9px] font-semibold tabular-nums">
              {travelBudget > 0 ? `${Math.round(ringPct * 100)}%` : "—"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold tabular-nums">{money(ytd.total, "HKD")}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted">
              <span>
                {t.reports.travelLinked} {money(ytd.linked, "HKD")}
              </span>
              <span>
                {t.reports.travelUnlinked} {money(ytd.unlinked, "HKD")}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div ref={summaryRef}>
        <Enter>
          <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
            <div className="flex items-start justify-between gap-3">
              <button type="button" className="tr-press min-w-0 text-left" onClick={() => setEditAnnual(true)}>
                <div className="text-xs font-medium text-accent">{t.reports.annualTravel}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{money(shownTotal, "HKD")}</div>
                <div className="mt-0.5 text-xs text-muted">
                  / {travelBudget > 0 ? money(travelBudget, "HKD") : t.reports.notSet}
                  {annualEff.fromTrips ? <span className="text-faint"> · {t.reports.travelBudgetFromTrips}</span> : null}
                </div>
              </button>
              <div className="relative shrink-0">
                <ProgressRing value={ringPct} size={64} stroke={5} tone={yearOver ? "expense" : "income"} draw />
                <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">
                  {travelBudget > 0 ? `${Math.round(ringPct * 100)}%` : "—"}
                </span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="tr-press rounded-xl bg-background px-3 py-2 text-left disabled:opacity-60"
                disabled={!tripsWithSpend.length}
                onClick={() => setShowLinked(true)}
                aria-label={t.reports.travelLinkedOpen}
              >
                <div className="text-[11px] text-muted">{t.reports.travelLinked}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(ytd.linked, "HKD")}</div>
              </button>
              <button
                type="button"
                className="tr-press rounded-xl bg-background px-3 py-2 text-left disabled:opacity-60"
                disabled={!unlinked.length}
                onClick={() => setShowUnlinked(true)}
                aria-label={t.reports.travelUnlinkedOpen}
              >
                <div className="text-[11px] text-muted">{t.reports.travelUnlinked}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-accent">{money(shownUnlinked, "HKD")}</div>
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-faint">{t.reports.travelSplitNote}</p>
            <p className="mt-1 text-[11px] leading-4 text-faint">{t.reports.mealTravelHint}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-background px-3 py-2">
                <div className="text-[11px] text-muted">{t.reports.trips}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{current.length}</div>
              </div>
              <div className="rounded-xl bg-background px-3 py-2">
                <div className="text-[11px] text-muted">{t.reports.pastTrips}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{pastCount}</div>
              </div>
            </div>
          </div>
        </Enter>
      </div>

      <SectionLabel>{t.reports.trips}</SectionLabel>
      {current.map((tr) => (
        <TripCard key={tr.id} trip={tr} />
      ))}
      {current.length === 0 ? <p className="px-5 py-6 text-center text-sm text-muted">{t.common.none}</p> : null}
      {pastThisYear.length ? (
        <>
          <SectionLabel>{t.reports.pastTrips}</SectionLabel>
          {pastThisYear.map((tr) => (
            <TripCard key={tr.id} trip={tr} />
          ))}
        </>
      ) : null}
      {olderYears.map((group) => (
        <PastYearTrips key={group.year} year={group.year} rows={group.rows} />
      ))}

      <TripEditor key={adding ? "new-trip" : "new-idle"} open={adding} onClose={() => setAdding(false)} />
      <Overlay open={editAnnual} onClose={() => setEditAnnual(false)} title={t.reports.annualTravel}>
        <AnnualEditor current={annual} onSave={async (n) => { await setAnnual(n); setEditAnnual(false); }} onClose={() => setEditAnnual(false)} />
      </Overlay>

      <Overlay open={showUnlinked} onClose={() => setShowUnlinked(false)} title={t.reports.travelUnlinked}>
        <div className="px-1 pb-8">
          <p className="px-4 pb-2 text-xs text-muted">{t.reports.travelUnlinkedHint}</p>
          {unlinked.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">{t.common.none}</p>
          ) : (
            unlinked
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((tx) => (
                <div key={tx.id} className="border-b border-line px-4 py-3 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{pickName(loc, tx.payee, tx.payeeZh) || "—"}</div>
                      <div className="text-xs text-muted">{shortDate(tx.date, loc)}</div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums text-expense">
                      {money(Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd)), "HKD")}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="tr-press h-10 flex-1 rounded-xl bg-accent text-sm font-semibold text-on-accent"
                      onClick={() => setLinkTxId(tx.id)}
                    >
                      {t.reports.linkToTrip}
                    </button>
                    <button
                      type="button"
                      className="tr-press h-10 rounded-xl bg-elevated px-3 text-sm font-medium text-accent"
                      onClick={() => {
                        setShowUnlinked(false);
                        setTx(tx.id);
                      }}
                    >
                      {t.reports.editTxn}
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </Overlay>

      <Overlay open={showLinked} onClose={() => setShowLinked(false)} title={t.reports.travelLinked}>
        <div className="px-1 pb-8">
          <p className="px-4 pb-2 text-xs text-muted">{t.reports.travelLinkedOpen}</p>
          {tripsWithSpend.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">{t.common.none}</p>
          ) : (
            tripsWithSpend.map((tr) => {
              const split = tripMoneySplit(txs, tr.id, rates);
              return (
                <Link
                  key={tr.id}
                  to="/reports/travel/$id"
                  params={{ id: tr.id }}
                  className="tr-press flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0"
                  onClick={() => setShowLinked(false)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{pickName(loc, tr.name, tr.nameZh)}</div>
                    <div className="text-xs text-muted">
                      {tr.destination} · {dateRangeLabel(tr.start, tr.end, loc)}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold tabular-nums">{money(split.paid, "HKD")}</div>
                </Link>
              );
            })
          )}
        </div>
      </Overlay>

      <Overlay
        open={!!linkTxId}
        onClose={() => setLinkTxId(null)}
        title={t.reports.linkToTrip}
        layer="stack"
      >
        <div className="px-1 pb-8">
          <p className="px-4 pb-2 text-xs text-muted">{t.reports.pickTripToLink}</p>
          {linkCandidates.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">{t.common.none}</p>
          ) : (
            linkCandidates.map((tr) => (
              <button
                key={tr.id}
                type="button"
                className="tr-press flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left last:border-0"
                onClick={() => {
                  if (linkTxId) void attachTrip(linkTxId, tr.id);
                }}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{pickName(loc, tr.name, tr.nameZh)}</div>
                  <div className="text-xs text-muted">
                    {tr.destination} · {dateRangeLabel(tr.start, tr.end, loc)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </Overlay>
    </div>
  );
}

function byStartAsc(a: Trip, b: Trip): number {
  return a.start.localeCompare(b.start) || a.end.localeCompare(b.end);
}

function byEndDesc(a: Trip, b: Trip): number {
  return b.end.localeCompare(a.end) || b.start.localeCompare(a.start);
}

function groupTravelTrips(trips: Trip[], today: string, year: number) {
  const visible = trips.filter((tr) => tr.status !== "cancelled");
  const yearKey = String(year);
  const current = visible.filter((tr) => tr.end >= today).sort(byStartAsc);
  const past = visible.filter((tr) => tr.end < today);
  const pastThisYear = past.filter((tr) => tr.end.startsWith(yearKey)).sort(byEndDesc);
  const byYear = new Map<string, Trip[]>();
  for (const tr of past) {
    const y = tr.end.slice(0, 4);
    if (y === yearKey) continue;
    const list = byYear.get(y) ?? [];
    list.push(tr);
    byYear.set(y, list);
  }
  const olderYears = [...byYear.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([y, rows]) => ({ year: y, rows: rows.sort(byEndDesc) }));
  return { current, pastThisYear, olderYears, pastCount: past.length };
}

function PastYearTrips({ year, rows }: { year: string; rows: Trip[] }) {
  const t = useT();
  const loc = useUi((s) => s.locale);
  const [open, setOpen] = useState(false);
  const label = loc === "zh-HK" ? `${year}年` : year;
  return (
    <div>
      <button type="button" className="tr-press flex w-full items-center justify-between px-5 pb-1 pt-5 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="text-sm font-medium text-muted">
          {t.reports.pastTrips} · {label}
        </span>
        <span className="flex items-center gap-1 text-xs text-faint">
          <span className="tabular-nums">{rows.length}</span>
          <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
        </span>
      </button>
      {open ? rows.map((tr) => <TripCard key={tr.id} trip={tr} />) : null}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const t = useT();
  const loc = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const adhoc = useApp((s) => s.adhocBudgets);
  const split = tripMoneySplit(txs, trip.id, rates, adhoc);
  const used = tripBudgetUsed(split.total, trip.cashBudget);
  const paidPct = trip.cashBudget > 0 ? split.paid / trip.cashBudget : 0;
  const scheduledPct = trip.cashBudget > 0 ? split.scheduled / trip.cashBudget : 0;
  const over = trip.cashBudget > 0 && split.total > trip.cashBudget;
  const today = todayISO();
  const live = trip.start <= today && today <= trip.end;
  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
      <Link to="/reports/travel/$id" params={{ id: trip.id }} className="tr-press block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold">
              {pickName(loc, trip.name, trip.nameZh)}
              {live ? (
                <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 align-middle text-[10px] font-medium text-income">{t.reports.onTrip}</span>
              ) : null}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {trip.destination} · {dateRangeLabel(trip.start, trip.end, loc)}
            </div>
          </div>
          <div className="relative shrink-0">
            <ProgressRing value={paidPct} extra={scheduledPct} size={52} stroke={4} tone={over ? "expense" : "income"} draw />
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums">
              {Math.round(used.pct * 100)}%
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MoneyPill label={t.reports.tripPaid} value={split.paid} tone={split.paid > 0 ? "expense" : "muted"} />
          <MoneyPill label={t.reports.tripScheduled} value={split.scheduled} tone={split.scheduled > 0 ? "watch" : "muted"} />
          <MoneyPill label={t.reports.remaining} value={used.remaining} tone="income" />
        </div>
        <div className="mt-2 flex justify-end">
          <BudgetChip over={over} />
        </div>
      </Link>
      <div className="px-4 pb-3">
        <TripPlannerBar trip={trip} compact />
      </div>
    </div>
  );
}

function MoneyPill({ label, value, tone }: { label: string; value: number; tone: "expense" | "watch" | "income" | "muted" }) {
  const labelClass =
    tone === "expense" ? "text-expense" : tone === "watch" ? "text-watch" : tone === "income" ? "text-income" : "text-muted";
  return (
    <div className="rounded-xl bg-background px-2 py-2">
      <div className={`text-[11px] ${labelClass}`}>{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(value, "HKD")}</div>
    </div>
  );
}

function TripPlannerBar({ trip, compact }: { trip: Trip; compact?: boolean }) {
  const t = useT();
  const today = todayISO();
  const live = trip.start <= today && today <= trip.end;
  const linked = Boolean(trip.plannerId);
  const href = plannerTripUrl(trip, { day: live ? today : undefined, pick: !linked });
  const label = !linked ? t.reports.plannerConnect : live ? t.reports.plannerOpenToday : t.reports.planTrip;
  return (
    <div className={compact ? "border-t border-line pt-3" : ""}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-muted">{t.reports.plannerLink}</div>
          <div className="truncate text-sm font-semibold">{linked ? trip.plannerTitle || t.reports.plannerLinked : t.reports.plannerUnlinked}</div>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="tr-press flex h-9 shrink-0 items-center rounded-full bg-accent px-3 text-xs font-medium text-on-accent"
        >
          {label}
        </a>
      </div>
      {linked ? (
        <a href={plannerTripUrl(trip, { pick: true })} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-accent">
          {t.reports.plannerChange}
        </a>
      ) : null}
      {compact ? null : <p className="mt-2 text-xs leading-5 text-muted">{t.reports.plannerOneLine}</p>}
    </div>
  );
}

function AnnualEditor({ current, onSave, onClose }: { current: number; onSave: (n: number) => void; onClose: () => void }) {
  const t = useT();
  const [v, setV] = useState(String(current));
  return (
    <div className="px-5 pb-8">
      <div className="text-[11px] text-muted">HK$</div>
      <input
        inputMode="decimal"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 tabular-nums"
        aria-label={t.reports.annualTravel}
      />
      <div className="mt-1 text-xs text-muted">{formatTypingAmount(v || "0", "HKD")}</div>
      <button type="button" className="tr-press mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => onSave(Number(v) || 0)}>
        {t.add.save}
      </button>
      <button type="button" className="tr-press mt-2 h-11 w-full text-sm text-muted" onClick={onClose}>
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
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const adhoc = useApp((s) => s.adhocBudgets);
  const setTx = useUi((s) => s.setTxDetailId);
  const openAdd = useUi((s) => s.openAdd);
  const setSelected = useUi((s) => s.setSelectedDate);
  const [edit, setEdit] = useState(false);
  const [stickyOn, setStickyOn] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = summaryRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => setStickyOn(!entry.isIntersecting), {
      root: null,
      threshold: 0,
      rootMargin: "-8px 0px 0px 0px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [trip?.id]);

  if (!trip) return <div className="p-5 text-sm text-muted">—</div>;
  const active = trip;
  const split = tripMoneySplit(txs, active.id, rates, adhoc);
  const used = tripBudgetUsed(split.total, active.cashBudget);
  const paidPct = active.cashBudget > 0 ? split.paid / active.cashBudget : 0;
  const scheduledPct = active.cashBudget > 0 ? split.scheduled / active.cashBudget : 0;
  const linked = tripLinkedTxs(txs, active.id);
  const scheduledAdhoc = adhoc.filter((row) => row.tripId === active.id && !row.paidOn);
  const over = active.cashBudget > 0 && split.total > active.cashBudget;
  const empty = linked.length === 0 && scheduledAdhoc.length === 0;

  function logSpend() {
    const today = todayISO();
    const start = active.start;
    const end = active.end;
    const date = today >= start && today <= end ? today : start;
    setSelected(date);
    openAdd("expense");
  }

  return (
    <div className="pb-24">
      <ScreenHeader
        title={pickName(loc, active.name, active.nameZh)}
        backTo="/reports/travel"
        right={
          <button type="button" className="tr-press px-2 text-sm font-medium text-accent" onClick={() => setEdit(true)}>
            {t.reports.editTrip}
          </button>
        }
      />

      {stickyOn ? (
        <div className="tr-sticky flex items-center gap-3 px-4 py-2">
          <div className="relative shrink-0">
            <ProgressRing value={paidPct} extra={scheduledPct} size={36} stroke={3} tone={over ? "expense" : "income"} />
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-[9px] font-semibold tabular-nums">
              {Math.round(used.pct * 100)}%
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{active.destination}</div>
            <div className="mt-0.5 text-[11px] text-muted">
              {Math.round(used.pct * 100)}% · {t.reports.remaining} {money(used.remaining, "HKD")}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-4 mb-3 overflow-hidden rounded-xl bg-elevated px-4 py-3">
        <TripPlannerBar trip={active} />
      </div>
      <div ref={summaryRef}>
        <Enter>
          <div className="mx-4 overflow-hidden rounded-2xl bg-elevated p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{active.destination}</div>
                <div className="mt-0.5 text-xs text-muted">{dateRangeLabel(active.start, active.end, loc)}</div>
              </div>
              <div className="relative shrink-0">
                <ProgressRing value={paidPct} extra={scheduledPct} size={64} stroke={5} tone={over ? "expense" : "income"} draw />
                <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">
                  {Math.round(used.pct * 100)}%
                </span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-background px-3 py-2">
                <div className="text-[11px] text-muted">{t.reports.tripBudget}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(active.cashBudget, "HKD")}</div>
              </div>
              <div className={`rounded-xl px-3 py-2 ${split.paid > 0 ? "bg-expense-soft" : "bg-background"}`}>
                <div className={`text-[11px] ${split.paid > 0 ? "text-expense" : "text-muted"}`}>{t.reports.tripPaid}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(split.paid, "HKD")}</div>
              </div>
              <div className={`rounded-xl px-3 py-2 ${split.scheduled > 0 ? "bg-watch-soft" : "bg-background"}`}>
                <div className={`text-[11px] ${split.scheduled > 0 ? "text-watch" : "text-muted"}`}>{t.reports.tripScheduled}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(split.scheduled, "HKD")}</div>
              </div>
              <div className="rounded-xl bg-success-soft px-3 py-2">
                <div className="text-[11px] text-income">{t.reports.remaining}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(used.remaining, "HKD")}</div>
              </div>
            </div>
          </div>
        </Enter>
      </div>
      {empty ? (
        <div className="mx-4 mt-4 rounded-2xl bg-elevated px-4 py-5 text-center">
          <p className="text-sm text-muted">{t.reports.tripEmptyHint}</p>
          <button type="button" className="tr-press mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent" onClick={logSpend}>
            {t.reports.logTripSpend}
          </button>
        </div>
      ) : null}
      {scheduledAdhoc.length ? (
        <>
          <h2 className="px-5 pb-1 pt-5 text-sm font-medium text-muted">{t.reports.tripScheduled}</h2>
          <div className="mx-4 overflow-hidden rounded-2xl bg-elevated">
            {scheduledAdhoc.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm">{pickName(loc, row.label, row.labelZh)}</div>
                  <div className="text-xs text-muted">{shortDate(row.date, loc)}</div>
                </div>
                <div className="shrink-0 text-sm font-medium tabular-nums text-watch">{money(row.amount, row.currency)}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <h2 className="px-5 pb-1 pt-5 text-sm font-medium text-muted">{t.reports.tripCats}</h2>
      <TripCatRows txs={linked} cats={cats} rates={rates} locale={loc} />
      <h2 className="px-5 pb-1 pt-4 text-sm font-medium text-muted">{t.reports.tripHeat}</h2>
      <TripHeat start={active.start} end={active.end} txs={linked} cats={cats} rates={rates} locale={loc} />
      <TxGroupedList txs={linked} onClick={(tx) => setTx(tx.id)} empty={t.common.none} />
      <TripEditor
        key={edit ? active.id : "edit-idle"}
        open={edit}
        trip={active}
        onClose={() => setEdit(false)}
        onDeleted={() => {
          void del(active.id);
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
  const locale = useUi((s) => s.locale);
  const add = useApp((s) => s.addTrip);
  const update = useApp((s) => s.updateTrip);
  const today = todayISO();
  const [name, setName] = useState(trip?.nameZh || trip?.name || "");
  const [dest, setDest] = useState(trip?.destination || "");
  const [start, setStart] = useState(trip?.start || today);
  const [end, setEnd] = useState(trip?.end || today);
  const [budget, setBudget] = useState(String(trip?.cashBudget ?? 10000));
  const [monthly, setMonthly] = useState(String(trip?.monthlyCash ?? 0));
  const [plannerId, setPlannerId] = useState(trip?.plannerId || "");
  const [field, setField] = useState<"amount" | "dest">("amount");

  async function save() {
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
      milesTarget: trip?.milesTarget ?? 0,
      milesSaved: trip?.milesSaved ?? 0,
      monthlyCash: Number(monthly) || 0,
      plannerId: plannerId.trim() || undefined,
      plannerTitle: plannerId.trim() && plannerId.trim() === (trip?.plannerId || "") ? trip?.plannerTitle : undefined,
    };
    if (trip) await update(row);
    else await add(row);
    onClose();
  }

  function confirmRemove() {
    if (!onDeleted) return;
    const ok = window.confirm(t.reports.removeTripConfirm);
    if (ok) onDeleted();
  }

  return (
    <Overlay open={open} onClose={onClose} variant="page">
      <div className="rt-sheet-in">
        <ComposerShell
          header={<ComposerHeader onClose={onClose} onSave={() => void save()} title={trip ? t.reports.editTrip : t.reports.addTrip} />}
          keypad={
            <>
              {trip && onDeleted ? (
                <button type="button" className="tr-press flex h-11 w-full items-center justify-center border-t border-line bg-background text-sm text-expense" onClick={confirmRemove}>
                  {t.reports.removeTrip}
                </button>
              ) : null}
              <ActiveKeypad
                field={field}
                amount={budget}
                dest={monthly}
                principal=""
                interest=""
                setAmount={setBudget}
                setDest={setMonthly}
                setPrincipal={() => undefined}
                setInterest={() => undefined}
                currency="HKD"
              />
            </>
          }
        >
          <div className="rt-enter space-y-0">
            <TextLine value={name} onChange={setName} label={t.reports.tripName} placeholder={t.budget.customName} />
            <TextLine value={dest} onChange={setDest} label={t.reports.destination} placeholder={locale === "zh-HK" ? "例如 Osaka" : "e.g. Osaka"} />
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-sm text-muted">{t.reports.tripStart}</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
            </div>
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-sm text-muted">{t.reports.tripEnd}</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
            </div>
            <LineRow label={t.reports.cashBudget} amount={budget} currency="HKD" active={field === "amount"} onFocusAmount={() => setField("amount")} />
            <LineRow label={t.reports.monthlyCash} amount={monthly} currency="HKD" active={field === "dest"} onFocusAmount={() => setField("dest")} />
            <TextLine value={plannerId} onChange={setPlannerId} label={t.reports.plannerId} placeholder={locale === "zh-HK" ? "選填" : "Optional"} />
            <p className="px-4 py-2 text-xs leading-5 text-muted">{t.reports.plannerHint}</p>
            {trip ? (
              <a
                href={plannerTripUrl({ ...trip, plannerId: plannerId.trim() || trip.plannerId }, { pick: true })}
                target="_blank"
                rel="noopener noreferrer"
                className="tr-press mx-4 mb-3 flex h-11 items-center justify-center rounded-xl bg-elevated text-sm font-medium text-accent"
              >
                {t.reports.plannerPick}
              </a>
            ) : (
              <p className="px-4 pb-3 text-xs text-muted">{t.reports.plannerSaveFirst}</p>
            )}
          </div>
        </ComposerShell>
      </div>
    </Overlay>
  );
}

function TripCatRows({
  txs,
  cats,
  rates,
  locale,
}: {
  txs: Transaction[];
  cats: Category[];
  rates: FxRate[];
  locale: Locale;
}) {
  const sums = new Map<string, number>();
  let total = 0;
  for (const tx of txs) {
    if (tx.planned || cashflowSide(tx) !== "expense") continue;
    const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
    const id = tx.categoryId ?? "uncat";
    sums.set(id, (sums.get(id) ?? 0) + hkd);
    total += hkd;
  }
  const rows = [...sums.entries()]
    .map(([id, value]) => {
      const cat = cats.find((c) => c.id === id);
      return { id, value, name: cat ? pickName(locale, cat.name, cat.nameZh) : id };
    })
    .sort((a, b) => b.value - a.value);
  if (!rows.length) return <p className="px-5 py-3 text-sm text-muted">—</p>;
  return (
    <div className="px-5">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between py-2 text-sm">
          <span className="truncate pr-3">{r.name}</span>
          <span className="tabular-nums text-muted">
            {money(r.value, "HKD")}
            <span className="ml-2 text-xs text-faint">{total ? `${Math.round((r.value / total) * 100)}%` : ""}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function TripHeat({
  start,
  end,
  txs,
  cats,
  rates,
  locale,
}: {
  start: string;
  end: string;
  txs: Transaction[];
  cats: Category[];
  rates: FxRate[];
  locale: Locale;
}) {
  const t = useT();
  const today = todayISO();
  const days: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cursor.getTime() <= last.getTime() && days.length < 60) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  const daily = new Map<string, number>();
  for (const tx of txs) {
    if (tx.planned || cashflowSide(tx) !== "expense") continue;
    daily.set(tx.date, (daily.get(tx.date) ?? 0) + Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd)));
  }
  const max = Math.max(1, ...daily.values());
  const defaultFocus = days.includes(today) ? today : days[0] ?? start;
  const [focusDay, setFocusDay] = useState(defaultFocus);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [emptyHint, setEmptyHint] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const dayTxs = openDay ? txs.filter((tx) => tx.date === openDay && !tx.planned && cashflowSide(tx) === "expense") : [];

  function syncFocusFromScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const kids = Array.from(el.children) as HTMLElement[];
    if (!kids.length) return;
    const left = el.scrollLeft + 8;
    let best = kids[0];
    let bestDist = Infinity;
    for (const kid of kids) {
      const dist = Math.abs(kid.offsetLeft - left);
      if (dist < bestDist) {
        bestDist = dist;
        best = kid;
      }
    }
    const iso = best.dataset.day;
    if (iso && iso !== focusDay) {
      setFocusDay(iso);
      setEmptyHint(false);
    }
  }

  return (
    <>
      <div className="mx-4 mb-2 flex items-baseline justify-between gap-2 rounded-xl bg-elevated px-3 py-2">
        <div className="text-xs text-muted">
          {shortDate(focusDay, locale)}
          {focusDay === today ? <span className="ml-1 text-accent">{t.reports.todayMark}</span> : null}
        </div>
        <div className="text-sm font-semibold tabular-nums">{money(daily.get(focusDay) ?? 0, "HKD")}</div>
      </div>
      {emptyHint ? <p className="px-5 pb-2 text-xs text-muted">{t.reports.dayNoSpend}</p> : null}
      <div
        ref={stripRef}
        className="tr-day-strip mx-4 mb-4 rounded-xl bg-elevated px-3 py-3"
        onScroll={syncFocusFromScroll}
      >
        {days.map((iso) => {
          const amt = daily.get(iso) ?? 0;
          const heat = amt / max;
          const selected = iso === focusDay;
          return (
            <button
              key={iso}
              type="button"
              data-day={iso}
              className={cn("tr-day-chip tr-press flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-lg", selected && "ring-2 ring-accent ring-offset-1 ring-offset-elevated")}
              onClick={() => {
                setFocusDay(iso);
                if (amt > 0) {
                  setEmptyHint(false);
                  setOpenDay(iso);
                } else {
                  setOpenDay(null);
                  setEmptyHint(true);
                }
              }}
            >
              <span
                className="grid size-12 place-items-center rounded-lg text-sm tabular-nums"
                style={{
                  background: amt ? `color-mix(in srgb, var(--color-expense) ${Math.round(20 + heat * 70)}%, transparent)` : "var(--color-background)",
                  color: heat > 0.55 ? "var(--color-on-accent, #fff)" : undefined,
                }}
              >
                {iso.slice(8)}
              </span>
              {iso === today ? <span className="text-[9px] font-medium text-accent">{t.reports.todayMark}</span> : null}
            </button>
          );
        })}
      </div>
      {openDay ? (
        <Overlay open onClose={() => setOpenDay(null)} title={`${t.reports.tripDaySpend} · ${shortDate(openDay, locale)}`}>
          <div className="px-5 pb-8">
            <div className="mb-3 text-2xl font-semibold tabular-nums">{money(daily.get(openDay) ?? 0, "HKD")}</div>
            <TripCatRows txs={dayTxs} cats={cats} rates={rates} locale={locale} />
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
