import { useMemo, useState } from "react";
import { Overlay, TransactionRow } from "@/components/shared";
import { pickName } from "@/lib/i18n";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import type { TxType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SearchFlow() {
  const t = useT();
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);
  const filterOpen = useUi((s) => s.filterOpen);
  const setFilter = useUi((s) => s.setFilterOpen);
  const filterKind = useUi((s) => s.filterKind);
  const setFilterKind = useUi((s) => s.setFilterKind);
  const locale = useUi((s) => s.locale);
  const setTx = useUi((s) => s.setTxDetailId);
  const transactions = useApp((s) => s.transactions);
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return transactions
      .filter((tx) => (filterKind === "all" ? true : tx.type === filterKind))
      .filter((tx) => {
        if (!s) return true;
        const blob = `${tx.payee} ${tx.payeeZh} ${tx.note ?? ""} ${tx.tags?.join(" ") ?? ""}`.toLowerCase();
        return blob.includes(s);
      })
      .slice(0, 40);
  }, [q, transactions, filterKind]);

  const chips: { id: TxType | "all"; label: string }[] = [
    { id: "all", label: t.common.all },
    { id: "expense", label: t.tx.expense },
    { id: "income", label: t.tx.income },
    { id: "transfer", label: t.tx.transfer },
    { id: "miles", label: t.tx.miles },
  ];

  return (
    <>
      <Overlay open={open} onClose={() => setOpen(false)} title={t.today.search}>
        <div className="px-5 pb-8">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.common.search}
            className="h-11 w-full rounded-lg bg-elevated px-3 text-base outline-none"
          />
          <button
            type="button"
            onClick={() => setFilter(true)}
            className="mt-3 text-sm text-accent"
          >
            {t.today.filter}
            {filterKind !== "all" ? ` · ${chips.find((c) => c.id === filterKind)?.label}` : ""}
          </button>
          <div className="-mx-5 mt-3">
            {results.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                showDate
                onClick={() => {
                  setOpen(false);
                  setTx(tx.id);
                }}
              />
            ))}
          </div>
        </div>
      </Overlay>
      <Overlay open={filterOpen} onClose={() => setFilter(false)} title={t.today.filter}>
        <div className="flex flex-wrap gap-2 px-5 pb-8">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilterKind(chip.id)}
              className={cn(
                "rounded-full px-3 py-2 text-sm",
                filterKind === chip.id
                  ? "bg-accent text-on-accent"
                  : "bg-elevated text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
          <span className="rounded-full bg-elevated px-3 py-2 text-sm text-muted">
            {pickName(locale, "Travel", "旅遊")}
          </span>
          <span className="rounded-full bg-elevated px-3 py-2 text-sm text-muted">HKD</span>
        </div>
      </Overlay>
    </>
  );
}
