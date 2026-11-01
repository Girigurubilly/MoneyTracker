import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { dateRangeLabel, money, todayISO } from "@/lib/format";
import { toHkd } from "@/lib/calc/fx";
import { pickName } from "@/lib/i18n";
import {
  MONEY_CHANNEL,
  carriedTrip,
  clearTripHash,
  estimateFromHash,
  estimateInHkd,
  pendingTripHash,
  type TripEstimate as Estimate,
} from "@/lib/trip-link";
import type { Trip } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

const KINDS = ["hotel", "ride", "meal", "sight", "other"] as const;

/** `#estimate=` from TripPlanner's 費用 view → preview 行程預計 vs 預算, then set or just save it. */
export function TripEstimateSheet() {
  const t = useT();
  const trips = useApp((s) => s.trips);
  const rates = useApp((s) => s.fxRates);
  const updateTrip = useApp((s) => s.updateTrip);
  const locale = useUi((s) => s.locale);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const parsed = estimateFromHash(pendingTripHash());
    if (!parsed) return;
    setEstimate(parsed);
    setPick(null);
    clearTripHash("estimate", true);
  }, []);

  useEffect(() => {
    function onHash() {
      const parsed = estimateFromHash(window.location.hash);
      if (!parsed) return;
      setEstimate(parsed);
      setPick(null);
      clearTripHash("estimate", true);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const alive = trips.filter((trip) => trip.status !== "cancelled");
  const guess = estimate
    ? carriedTrip(trips, {
        trip: estimate.trip,
        tripId: estimate.tripId,
        bookId: estimate.bookId,
        items: [estimate.start, estimate.end].filter(Boolean).map((date) => ({ date })),
      })
    : undefined;
  const trip = alive.find((row) => row.id === (pick ?? guess?.id ?? ""));
  const sum = useMemo(
    () => (estimate ? estimateInHkd(estimate, (amount, currency) => toHkd(amount, currency, rates)) : null),
    [estimate, rates],
  );

  function close() {
    clearTripHash("estimate");
    setEstimate(null);
  }

  async function apply(setBudget: boolean) {
    if (!estimate || !sum || !trip || busy) return;
    setBusy(true);
    const next: Trip = {
      ...trip,
      plannerEstimate: { amount: sum.total, at: new Date().toISOString(), count: estimate.count },
      ...(setBudget ? { cashBudget: sum.total } : {}),
      ...(!trip.plannerId && estimate.bookId ? { plannerId: estimate.bookId, plannerTitle: estimate.trip || trip.plannerTitle } : {}),
    };
    try {
      await updateTrip(next);
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel(MONEY_CHANNEL);
        ch.postMessage({ type: "trip", id: trip.id });
        ch.close();
      }
      toast(setBudget ? t.reports.estimateBudgetSaved.replace("{amount}", money(sum.total, "HKD")) : t.reports.estimateSaved);
      close();
    } finally {
      setBusy(false);
    }
  }

  if (!estimate || !sum) return null;
  const budget = trip?.cashBudget || 0;
  const diff = budget - sum.total;
  const today = todayISO();

  return (
    <Overlay open={Boolean(estimate)} onClose={close} title={t.reports.estimateTitle}>
      <div className="px-5 pb-8">
        <p className="text-xs leading-5 text-muted">
          {estimate.trip ? `${estimate.trip} · ` : ""}
          {t.reports.estimateHint}
        </p>
        {!alive.length ? (
          <>
            <p className="mt-4 text-sm leading-6">{t.reports.estimateNoTrips}</p>
            <button type="button" className="mt-4 h-11 w-full rounded-xl bg-elevated text-sm font-medium" onClick={close}>
              {t.reports.proposalStay}
            </button>
          </>
        ) : (
          <>
            <label className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-muted">{t.add.trip}</span>
              <select
                value={trip?.id ?? ""}
                onChange={(e) => setPick(e.target.value)}
                className="h-10 max-w-[16rem] bg-transparent text-right text-sm font-medium text-accent outline-none"
              >
                <option value="">{t.reports.estimateNoTrip}</option>
                {alive.map((row) => {
                  const status =
                    row.start <= today && today <= row.end ? t.reports.onTrip : row.end < today ? t.reports.tripEnded : t.reports.tripUpcoming;
                  return (
                    <option key={row.id} value={row.id}>
                      {pickName(locale, row.name, row.nameZh)} · {dateRangeLabel(row.start, row.end, locale)} · {status}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-elevated px-3 py-2">
                <div className="text-[11px] text-muted">{t.reports.estimatePlanned}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">{money(sum.total, "HKD")}</div>
              </div>
              <div className="rounded-xl bg-elevated px-3 py-2">
                <div className="text-[11px] text-muted">{t.reports.estimateBudget}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">{trip ? money(budget, "HKD") : "—"}</div>
              </div>
            </div>
            {trip ? (
              <p
                className={cn(
                  "mt-2 rounded-xl px-3 py-2 text-sm font-medium",
                  !budget ? "bg-elevated text-muted" : diff < 0 ? "bg-expense-soft text-expense" : "bg-success-soft text-income",
                )}
              >
                {!budget
                  ? t.reports.estimateNoBudget
                  : diff < 0
                    ? t.reports.estimateOver.replace("{amount}", money(-diff, "HKD"))
                    : t.reports.estimateUnder.replace("{amount}", money(diff, "HKD"))}
              </p>
            ) : null}

            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl bg-elevated">
              {KINDS.filter((kind) => (sum.byCategory[kind] || 0) > 0).map((kind) => (
                <li key={kind} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{t.reports[`estimateKind_${kind}`]}</span>
                  <span className="tabular-nums">{money(sum.byCategory[kind] || 0, "HKD")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-5 text-muted">
              {t.reports.estimateItems.replace("{n}", String(estimate.count))}
              {estimate.guess ? ` · ${t.reports.estimateGuess.replace("{n}", String(estimate.guess))}` : ""}
            </p>
            {sum.unknown.length ? (
              <p className="mt-1 text-xs leading-5 text-watch">{t.reports.estimateUnknown.replace("{codes}", sum.unknown.join(", "))}</p>
            ) : null}

            <button
              type="button"
              disabled={!trip || busy}
              className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-50"
              onClick={() => void apply(true)}
            >
              {t.reports.estimateSetBudget}
            </button>
            <button
              type="button"
              disabled={!trip || busy}
              className="mt-2 h-11 w-full rounded-xl bg-elevated text-sm font-medium disabled:opacity-50"
              onClick={() => void apply(false)}
            >
              {t.reports.estimateKeep}
            </button>
            <button type="button" className="mt-2 h-11 w-full text-sm text-muted" onClick={close}>
              {t.reports.proposalSkip}
            </button>
          </>
        )}
      </div>
    </Overlay>
  );
}
