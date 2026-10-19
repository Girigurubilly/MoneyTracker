import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/shared";
import { asMoneyCurrency, linkFromHash, plannerTripUrl, proposalFromHash, type TripSpendItem } from "@/lib/trip-link";
import { CURRENCIES, type MoneyUnit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { newId, useApp } from "@/store/app";
import { useT } from "@/store/ui";

type Draft = TripSpendItem & { id: string; kind: "adhoc" | "planned"; on: boolean; currency: MoneyUnit };

export function TripProposal() {
  const t = useT();
  const addTx = useApp((s) => s.addTransaction);
  const addAdhoc = useApp((s) => s.addAdhocBudget);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const trips = useApp((s) => s.trips);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [backUrl, setBackUrl] = useState("");
  const [tripName, setTripName] = useState("");
  const [tripId, setTripId] = useState("");
  const [rows, setRows] = useState<Draft[]>([]);

  useEffect(() => {
    const parsed = proposalFromHash(window.location.hash);
    if (!parsed) return;
    setTripName(parsed.trip);
    setTripId(parsed.tripId);
    setRows(
      parsed.items.map((item) => ({
        ...item,
        id: newId(),
        currency: asMoneyCurrency(item.currency),
        kind: "adhoc",
        on: true,
      })),
    );
    setDone(false);
    setBackUrl("");
    setOpen(true);
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, []);

  function patch(id: string, next: Partial<Draft>) {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  async function save() {
    const picked = rows.filter((row) => row.on && row.amount > 0);
    if (!picked.length) {
      setOpen(false);
      return;
    }
    const accountId = accounts.find((a) => a.type === "cash" || a.type === "current" || a.type === "savings")?.id || accounts[0]?.id || "";
    const categoryId = categories.find((c) => c.kind === "expense" && c.theme === "travel")?.id;
    const knownTrip = Boolean(tripId) && trips.some((trip) => trip.id === tripId);
    for (const row of picked) {
      if (row.kind === "planned") {
        if (!accountId) {
          toast(t.add.account);
          return;
        }
        await addTx({
          type: "expense",
          amount: row.amount,
          currency: row.currency,
          accountId,
          categoryId,
          date: row.date,
          payee: row.label,
          payeeZh: row.label,
          note: tripName,
          planned: true,
          tripId: knownTrip ? tripId : undefined,
          tripManual: knownTrip,
        });
      } else {
        await addAdhoc({
          id: newId(),
          label: row.label,
          labelZh: row.label,
          amount: row.amount,
          currency: row.currency,
          month: row.date.slice(0, 7),
          date: row.date,
          categoryId,
        });
      }
    }
    toast(t.reports.proposalDone);
    const day = picked[0]?.date || "";
    const trip = trips.find((row) => row.id === tripId);
    setBackUrl(trip && day ? plannerTripUrl(trip, { day }) : "");
    setDone(true);
  }

  return (
    <Overlay open={open} onClose={() => setOpen(false)} title={t.reports.proposalTitle}>
      <div className="px-5 pb-8">
        {done ? (
          <>
            <p className="text-sm leading-6">{t.reports.proposalDone}</p>
            {backUrl ? (
              <a href={backUrl} target="trip-planner" className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent">
                {t.reports.proposalBack}
              </a>
            ) : null}
            <button type="button" className="mt-2 h-11 w-full text-sm text-muted" onClick={() => setOpen(false)}>
              {t.reports.proposalStay}
            </button>
          </>
        ) : (
          <>
        <p className="text-xs leading-5 text-muted">
          {tripName ? `${tripName} · ` : ""}
          {t.reports.proposalHint}
        </p>
        <div className="mt-3 space-y-3">
          {rows.map((row) => (
            <div key={row.id} className={cn("rounded-xl bg-elevated px-3 py-3", !row.on && "opacity-50")}>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={row.on} onChange={(e) => patch(row.id, { on: e.target.checked })} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{row.label}</span>
                  <span className="text-xs text-muted">{row.date}</span>
                </span>
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  inputMode="decimal"
                  value={String(row.amount)}
                  onChange={(e) => patch(row.id, { amount: Number(e.target.value) || 0 })}
                  className="h-10 min-w-0 flex-1 rounded-lg bg-background px-2 text-sm tabular-nums"
                />
                <select
                  value={row.currency}
                  onChange={(e) => patch(row.id, { currency: e.target.value as MoneyUnit })}
                  className="h-10 rounded-lg bg-background px-2 text-sm"
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={cn("h-8 flex-1 rounded-full text-xs font-medium", row.kind === "adhoc" ? "bg-accent text-on-accent" : "bg-background")}
                  onClick={() => patch(row.id, { kind: "adhoc" })}
                >
                  {t.reports.proposalAdhoc}
                </button>
                <button
                  type="button"
                  className={cn("h-8 flex-1 rounded-full text-xs font-medium", row.kind === "planned" ? "bg-accent text-on-accent" : "bg-background")}
                  onClick={() => patch(row.id, { kind: "planned" })}
                >
                  {t.reports.proposalPlanned}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void save()}>
          {t.reports.proposalSave}
        </button>
        <button type="button" className="mt-2 h-11 w-full text-sm text-muted" onClick={() => setOpen(false)}>
          {t.reports.proposalSkip}
        </button>
          </>
        )}
      </div>
    </Overlay>
  );
}

export function TripLinkCatcher() {
  const t = useT();
  const trips = useApp((s) => s.trips);
  const update = useApp((s) => s.updateTrip);
  useEffect(() => {
    const link = linkFromHash(window.location.hash);
    if (!link) return;
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    const trip = trips.find((row) => row.id === link.tripId);
    if (!trip) {
      toast(t.reports.plannerMissing);
      return;
    }
    void update({ ...trip, plannerId: link.bookId, plannerTitle: link.title || trip.plannerTitle });
    toast(t.reports.plannerSaved);
  }, [trips, update, t]);
  return null;
}
