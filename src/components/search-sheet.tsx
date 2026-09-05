import { useMemo, useState } from "react";
import { Overlay, TxGroupedList } from "@/components/shared";
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
    const list = !s
      ? [...txs]
      : txs.filter((tx) => `${tx.payee} ${tx.payeeZh} ${tx.note ?? ""}`.toLowerCase().includes(s));
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [q, txs]);
  return (
    <Overlay open={open} onClose={() => setOpen(false)} title={t.today.search} variant="page">
      <div className="px-5 pb-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="h-11 w-full rounded-lg bg-elevated px-3" placeholder={t.today.search} />
      </div>
      <TxGroupedList
        txs={rows}
        onClick={(tx) => {
          setTx(tx.id);
          setOpen(false);
        }}
        empty={t.today.noTxDay}
      />
    </Overlay>
  );
}
