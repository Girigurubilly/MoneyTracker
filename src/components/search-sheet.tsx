import { useMemo, useState } from "react";
import { Overlay, TransactionRow } from "@/components/shared";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function SearchFlow() {
  const t = useT();
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);
  const setTx = useUi((s) => s.setTxDetailId);
  const txs = useApp((s) => s.transactions);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return txs.slice(0, 40);
    return txs.filter((tx) => `${tx.payee} ${tx.payeeZh} ${tx.note ?? ""}`.toLowerCase().includes(s)).slice(0, 40);
  }, [q, txs]);
  return (
    <Overlay open={open} onClose={() => setOpen(false)} title={t.today.search} variant="page">
      <div className="px-5 pb-8">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="h-11 w-full rounded-lg bg-elevated px-3" placeholder={t.today.search} />
        <div className="mt-3">
          {rows.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onClick={() => {
                setTx(tx.id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </div>
    </Overlay>
  );
}
