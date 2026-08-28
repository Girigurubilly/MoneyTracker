import { Overlay } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { isTripActive } from "@/lib/calc/trips";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { toast } from "sonner";

export function TxDetail() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const id = useUi((s) => s.txDetailId);
  const setId = useUi((s) => s.setTxDetailId);
  const txs = useApp((s) => s.transactions);
  const trips = useApp((s) => s.trips);
  const del = useApp((s) => s.deleteTransaction);
  const add = useApp((s) => s.addTransaction);
  const update = useApp((s) => s.updateTransaction);
  const tx = txs.find((x) => x.id === id);
  if (!tx) return null;
  const activeTrips = trips.filter((tr) => isTripActive(tr, todayISO()) || tr.id === tx.tripId);
  return (
    <Overlay open={!!id} onClose={() => setId(null)} title={pickName(locale, tx.payee, tx.payeeZh)}>
      <div className="px-5 pb-8">
        <div className="text-2xl font-semibold tabular-nums">{money(tx.type === "expense" || tx.countsAsExpense ? -tx.amount : tx.amount, tx.currency, { sign: true })}</div>
        <p className="mt-2 text-sm text-muted">{tx.date}</p>
        {tx.planned ? <p className="mt-2 text-sm text-accent">{t.add.scheduledHint}</p> : null}
        {tx.type === "expense" ? (
          <label className="mt-4 block text-xs text-muted">
            {t.add.trip}
            <select
              value={tx.tripId ?? ""}
              onChange={(e) => void update({ ...tx, tripId: e.target.value || undefined })}
              className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm text-foreground"
            >
              <option value="">{t.reports.noneTrip}</option>
              {activeTrips.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {pickName(locale, tr.name, tr.nameZh)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className="mt-6 h-12 w-full rounded-xl text-sm font-medium text-expense"
          onClick={async () => {
            const prev = await del(tx.id);
            setId(null);
            toast(t.tx.deleted, {
              action: {
                label: t.tx.undo,
                onClick: () => {
                  if (prev) void add(prev);
                },
              },
            });
          }}
        >
          {t.tx.delete}
        </button>
      </div>
    </Overlay>
  );
}
