import { useEffect, useMemo, useState } from "react";
import { ScreenHeader, Group, Hairline } from "@/components/shared";
import { money } from "@/lib/format";
import { toHkd } from "@/lib/calc/fx";
import { holdingTitle, sortHoldingsBySymbol } from "@/lib/holdings";
import { fetchHoldingMoves, type PriceMove, type PriceRange } from "@/lib/quotes";
import type { HoldingMarket } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT } from "@/store/ui";

type BookFilter = "both" | "hk" | "us";

export function StockPricesPage() {
  const t = useT();
  const holdings = useApp((s) => s.holdings);
  const rates = useApp((s) => s.fxRates);
  const [book, setBook] = useState<BookFilter>("both");
  const [range, setRange] = useState<PriceRange>("1m");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState<Map<string, PriceMove>>(new Map());

  const rows = useMemo(() => {
    const list = holdings.filter((h) => book === "both" || h.market === book);
    return sortHoldingsBySymbol(list, dir);
  }, [holdings, book, dir]);

  useEffect(() => {
    if (!rows.length) {
      setMoves(new Map());
      return;
    }
    let live = true;
    setBusy(true);
    void fetchHoldingMoves(rows, range)
      .then((m) => {
        if (live) setMoves(m);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [range, book, holdings]);

  const totals = useMemo(() => {
    let now = 0;
    let start = 0;
    for (const h of rows) {
      const mv = moves.get(`${h.market}:${h.symbol}`);
      const last = mv?.last ?? h.lastPrice;
      const open = mv?.start ?? last;
      now += toHkd(h.quantity * (last || 0), h.currency, rates);
      start += toHkd(h.quantity * (open || 0), h.currency, rates);
    }
    const change = now - start;
    return { now, start, change, pct: start ? change / start : 0 };
  }, [rows, moves, rates]);

  const ranges: { id: PriceRange; label: string }[] = [
    { id: "1d", label: t.prices.r1d },
    { id: "1w", label: t.prices.r1w },
    { id: "1m", label: t.prices.r1m },
    { id: "3m", label: t.prices.r3m },
    { id: "6m", label: t.prices.r6m },
    { id: "1y", label: t.prices.r1y },
    { id: "ytd", label: t.prices.ytd },
  ];

  return (
    <div className="pb-10">
      <ScreenHeader title={t.prices.title} backTo="/reports" />
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.prices.hint}</p>
      <div className="flex gap-2 overflow-x-auto px-5 pb-2">
        {(["both", "hk", "us"] as BookFilter[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setBook(id)}
            className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-medium", book === id ? "bg-accent text-on-accent" : "bg-elevated text-muted")}
          >
            {id === "both" ? t.prices.both : id === "hk" ? t.holdings.hk : t.holdings.us}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto px-5 pb-3">
        {ranges.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-medium", range === r.id ? "bg-accent text-on-accent" : "bg-elevated text-muted")}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end px-5 pb-2">
        <button type="button" className="text-xs font-medium text-accent" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}>
          {t.holdings.sortCode} {dir === "asc" ? "↑" : "↓"}
        </button>
      </div>
      {busy ? <p className="px-5 py-4 text-sm text-muted">{t.prices.loading}</p> : null}
      {rows.length ? (
        <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-elevated px-3 py-3">
            <div className="text-[11px] text-muted">{t.prices.total}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{money(totals.now, "HKD")}</div>
          </div>
          <div className="rounded-xl bg-elevated px-3 py-3">
            <div className="text-[11px] text-muted">{t.prices.totalChange}</div>
            <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", totals.change > 0 ? "text-income" : totals.change < 0 ? "text-expense" : "")}>
              {totals.change > 0 ? "+" : ""}
              {money(totals.change, "HKD")}
              <span className="ml-1 text-xs font-medium">
                {totals.change > 0 ? "+" : ""}
                {(totals.pct * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      ) : null}
      {!rows.length ? (
        <p className="px-5 py-6 text-sm text-muted">{t.holdings.empty}</p>
      ) : (
        <Group>
          {rows.map((h, i) => {
            const mv = moves.get(`${h.market}:${h.symbol}`);
            const last = mv?.last ?? h.lastPrice;
            const pct = mv?.pct;
            const up = (pct ?? 0) > 0;
            const down = (pct ?? 0) < 0;
            const title = h.market === "us" ? h.symbol : holdingTitle(h);
            return (
              <div key={h.id}>
                {i > 0 ? <Hairline /> : null}
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{title}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {h.market === "us" ? h.symbol : h.symbol}
                      {h.market === "hk" && h.name && h.name !== h.symbol ? "" : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{last ? money(last, h.currency) : "—"}</div>
                    <div className={cn("text-xs tabular-nums", up ? "text-income" : down ? "text-expense" : "text-muted")}>
                      {pct == null ? "—" : `${up ? "+" : ""}${(pct * 100).toFixed(1)}%`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Group>
      )}
    </div>
  );
}
