import { useMemo, useState } from "react";
import { Overlay, TxGroupedList } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { TxType } from "@/lib/types";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

const kinds = ["expense", "income", "transfer"] as const;

export function SearchFlow() {
  const t = useT();
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);
  const setTx = useUi((s) => s.setTxDetailId);
  const txs = useApp((s) => s.transactions);
  const categories = useApp((s) => s.categories);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | Extract<TxType, "expense" | "income" | "transfer">>("");
  const labels = { expense: t.add.expense, income: t.add.income, transfer: t.add.transfer };
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s && !kind) return [];
    return txs
      .filter((tx) => {
        if (kind && tx.type !== kind) return false;
        if (!s) return true;
        const cat = categories.find((c) => c.id === tx.categoryId);
        return `${tx.payee} ${tx.payeeZh} ${tx.note ?? ""} ${cat?.name ?? ""} ${cat?.nameZh ?? ""}`.toLowerCase().includes(s);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [q, kind, txs, categories]);
  const idle = !q.trim() && !kind;
  return (
    <Overlay open={open} onClose={() => setOpen(false)} title={t.today.search} variant="page">
      <div className="px-5 pb-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="h-11 w-full rounded-lg bg-elevated px-3" placeholder={t.today.search} />
        <div className="mt-2 flex gap-2">
          {kinds.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={kind === id}
              onClick={() => setKind((cur) => (cur === id ? "" : id))}
              className={cn("h-9 rounded-full px-3 text-sm font-medium", kind === id ? "bg-accent text-on-accent" : "bg-elevated text-muted")}
            >
              {labels[id]}
            </button>
          ))}
        </div>
      </div>
      <TxGroupedList
        txs={rows}
        onClick={(tx) => {
          setTx(tx.id);
          setOpen(false);
        }}
        empty={idle ? t.today.searchPrompt : t.today.noTxDay}
      />
    </Overlay>
  );
}
