import { Overlay } from "@/components/shared";
import { money } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { toast } from "sonner";

export function TxDetail() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const id = useUi((s) => s.txDetailId);
  const setId = useUi((s) => s.setTxDetailId);
  const txs = useApp((s) => s.transactions);
  const del = useApp((s) => s.deleteTransaction);
  const add = useApp((s) => s.addTransaction);
  const tx = txs.find((x) => x.id === id);
  if (!tx) return null;
  return (
    <Overlay open={!!id} onClose={() => setId(null)} title={pickName(locale, tx.payee, tx.payeeZh)}>
      <div className="px-5 pb-8">
        <div className="text-2xl font-semibold tabular-nums">{money(tx.type === "expense" || tx.countsAsExpense ? -tx.amount : tx.amount, tx.currency, { sign: true })}</div>
        <p className="mt-2 text-sm text-muted">{tx.date}</p>
        {tx.planned ? <p className="mt-2 text-sm text-accent">{t.add.scheduledHint}</p> : null}
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
