import { useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Overlay, AmountPill } from "@/components/shared";
import { longDate, money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { activeTrips } from "@/lib/calc/trips";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function TxDetail() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const id = useUi((s) => s.txDetailId);
  const setId = useUi((s) => s.setTxDetailId);
  const setEditing = useUi((s) => s.setEditingId);
  const setKind = useUi((s) => s.setAddKind);
  const transactions = useApp((s) => s.transactions);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const trips = useApp((s) => s.trips);
  const remove = useApp((s) => s.deleteTransaction);
  const add = useApp((s) => s.addTransaction);
  const updateTransaction = useApp((s) => s.updateTransaction);
  const [pickTrip, setPickTrip] = useState(false);
  const tx = transactions.find((x) => x.id === id);
  if (!tx) {
    return (
      <Overlay open={false} onClose={() => setId(null)}>
        {null}
      </Overlay>
    );
  }
  const current = tx;
  const account = accounts.find((a) => a.id === tx.accountId);
  const to = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : undefined;
  const cat = categories.find((c) => c.id === tx.categoryId);
  const trip = trips.find((x) => x.id === tx.tripId);
  const displayType =
    tx.type === "miles"
      ? tx.milesType === "earn"
        ? "income"
        : tx.milesType === "burn" || tx.milesType === "expiry"
          ? "expense"
          : "miles"
      : tx.type;

  async function setTrip(tripId?: string) {
    const next = { ...current, tripId: tripId || undefined };
    if (!tripId) delete next.tripId;
    await updateTransaction(next);
    setPickTrip(false);
    toast(t.add.savedToast);
  }

  return (
    <Overlay open onClose={() => setId(null)} title={pickName(locale, tx.payee, tx.payeeZh)}>
      <div className="px-5 pb-8">
        <div className="flex justify-center py-4">
          <AmountPill type={displayType} amount={tx.amount} currency={tx.currency} />
        </div>
        <Row label={t.add.date} value={longDate(tx.date, locale)} />
        <Row
          label={t.add.account}
          value={account ? pickName(locale, account.name, account.nameZh) : "—"}
        />
        {to ? <Row label={t.add.to} value={pickName(locale, to.name, to.nameZh)} /> : null}
        {cat ? <Row label={t.add.category} value={pickName(locale, cat.name, cat.nameZh)} /> : null}
        {tx.type === "expense" ? (
          <button
            type="button"
            className="flex w-full items-start justify-between gap-4 border-b border-line py-3 text-left"
            onClick={() => setPickTrip(true)}
          >
            <span className="text-sm text-muted">{t.add.trip}</span>
            <span className="max-w-[60%] text-right text-sm text-accent">
              {trip ? pickName(locale, trip.name, trip.nameZh) : t.add.none}
            </span>
          </button>
        ) : trip ? (
          <Row label={t.add.trip} value={pickName(locale, trip.name, trip.nameZh)} />
        ) : null}
        {tx.tags?.length ? <Row label={t.add.tags} value={tx.tags.join(", ")} /> : null}
        {tx.currency !== "HKD" && tx.currency !== "MILES" ? (
          <Row label={t.add.fx} value={money(tx.amount, tx.currency)} />
        ) : null}

        <div className="mt-6 grid grid-cols-3 gap-2">
          <Action
            icon={<Pencil className="size-4" />}
            label={t.tx.edit}
            onClick={() => {
              setId(null);
              setEditing(tx.id);
              setKind(tx.type);
            }}
          />
          <Action
            icon={<Copy className="size-4" />}
            label={t.tx.duplicate}
            onClick={async () => {
              const copy = { ...tx, id: crypto.randomUUID() };
              await add(copy);
              toast(t.add.savedToast);
              setId(null);
            }}
          />
          <Action
            icon={<Trash2 className="size-4" />}
            label={t.tx.delete}
            danger
            onClick={async () => {
              const removed = await remove(tx.id);
              setId(null);
              toast(t.tx.deleted, {
                action: {
                  label: t.tx.undo,
                  onClick: () => {
                    if (removed) void add(removed);
                  },
                },
              });
            }}
          />
        </div>
      </div>
      <Overlay open={pickTrip} onClose={() => setPickTrip(false)} title={t.add.trip} variant="page">
        <div className="px-2 pb-8">
          <button
            type="button"
            className="flex w-full px-4 py-3 text-left text-[15px] text-muted"
            onClick={() => void setTrip(undefined)}
          >
            {t.add.none}
          </button>
          {activeTrips(trips, todayISO(), tx.tripId).map((tr) => (
            <button
              key={tr.id}
              type="button"
              className="flex w-full flex-col px-4 py-3 text-left"
              onClick={() => void setTrip(tr.id)}
            >
              <span className="text-[15px]">{pickName(locale, tr.name, tr.nameZh)}</span>
              <span className="text-xs text-muted">
                {tr.start}
                {tr.end ? ` → ${tr.end}` : ""}
              </span>
            </button>
          ))}
        </div>
      </Overlay>
    </Overlay>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[60%] text-right text-sm">{value}</span>
    </div>
  );
}

function Action({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl bg-elevated text-xs ${danger ? "text-expense" : "text-foreground"}`}
    >
      {icon}
      {label}
    </button>
  );
}