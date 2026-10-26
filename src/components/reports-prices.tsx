import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { Enter, useCountUp } from "@/components/retire-ux";
import { Group, Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { toHkd } from "@/lib/calc/fx";
import { holdingTitle, sortHoldingsBySymbol } from "@/lib/holdings";
import { money } from "@/lib/format";
import {
  fetchHoldingMoves,
  fetchPortfolioSparkline,
  inferredQuoteCurrency,
  quoteKey,
  quoteToCurrency,
  type PriceMove,
  type PriceRange,
} from "@/lib/quotes";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT } from "@/store/ui";
import { toast } from "sonner";

type BookFilter = "both" | "hk" | "us";

export function StockPricesPage() {
  const t = useT();
  const holdings = useApp((s) => s.holdings);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const [book, setBook] = useState<BookFilter>("both");
  const [range, setRange] = useState<PriceRange>("1d");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [moves, setMoves] = useState<Map<string, PriceMove>>(new Map());
  const [spark, setSpark] = useState<number[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const refresh = useApp((s) => s.refreshHoldingPrices);

  const hasHoldings = holdings.length > 0;
  const brokerageLump = useMemo(
    () =>
      !hasHoldings &&
      accounts.some((a) => a.type === "investment" && !a.hidden && Math.abs(a.balance) > 0.005),
    [accounts, hasHoldings],
  );

  async function syncPrices() {
    if (!hasHoldings) {
      toast(t.prices.refreshDisabledHint);
      return;
    }
    setSyncing(true);
    try {
      const n = await refresh();
      toast(n ? t.holdings.priced.replace("{n}", String(n)) : t.holdings.priceFail);
    } catch {
      toast(t.holdings.priceFail);
    } finally {
      setSyncing(false);
    }
  }

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
  }, [range, book, holdings, rows]);

  useEffect(() => {
    if (!rows.length) {
      setSpark([]);
      return;
    }
    let live = true;
    void fetchPortfolioSparkline(rows, range, rates).then((pts) => {
      if (live) setSpark(pts);
    });
    return () => {
      live = false;
    };
  }, [rows, range, rates]);

  const totals = useMemo(() => {
    let now = 0;
    let start = 0;
    for (const h of rows) {
      const mv = moves.get(quoteKey(h.market, h.symbol));
      const converted = mv
        ? quoteToCurrency(
            { price: mv.last, prevClose: mv.start, currency: mv.currency, pence: mv.pence },
            h.currency,
            rates,
            inferredQuoteCurrency(h.market, h.symbol),
          )
        : undefined;
      const last = h.lastPrice || 0;
      const open = converted?.prevClose && converted.prevClose > 0 ? converted.prevClose : last;
      now += toHkd(h.quantity * last, h.currency, rates);
      start += toHkd(h.quantity * open, h.currency, rates);
    }
    const change = now - start;
    return { now, start, change, pct: start ? change / start : 0 };
  }, [rows, moves, rates]);

  const shownTotal = useCountUp(totals.now, !rows.length, 420);

  const ranges: { id: PriceRange; label: string }[] = [
    { id: "1d", label: t.prices.r1d },
    { id: "1w", label: t.prices.r1w },
    { id: "1m", label: t.prices.r1m },
    { id: "3m", label: t.prices.r3m },
    { id: "6m", label: t.prices.r6m },
    { id: "1y", label: t.prices.r1y },
    { id: "ytd", label: t.prices.ytd },
  ];

  const chip = (active: boolean, disabled?: boolean) =>
    cn(
      "rt-chip-pill tr-press inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-xs font-medium",
      active ? "bg-accent text-on-accent" : "bg-elevated text-muted",
      disabled && "opacity-40",
    );

  const detail = picked ? rows.find((h) => h.id === picked) : null;
  const detailMv = detail ? moves.get(quoteKey(detail.market, detail.symbol)) : undefined;
  const detailConverted =
    detail && detailMv
      ? quoteToCurrency(
          { price: detailMv.last, prevClose: detailMv.start, currency: detailMv.currency, pence: detailMv.pence },
          detail.currency,
          rates,
          inferredQuoteCurrency(detail.market, detail.symbol),
        )
      : undefined;
  const detailOpen = detailConverted?.prevClose;
  const detailPct =
    detail && detailOpen && detailOpen > 0 && detail.lastPrice ? (detail.lastPrice - detailOpen) / detailOpen : undefined;

  return (
    <div className="pb-24">
      <ScreenHeader
        title={t.prices.title}
        backTo="/reports"
        right={
          <button
            type="button"
            disabled={syncing || !hasHoldings}
            className="tr-press inline-flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-accent disabled:opacity-50"
            onClick={() => void syncPrices()}
            title={!hasHoldings ? t.prices.refreshDisabledHint : undefined}
          >
            <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
            {t.holdings.refreshShort}
          </button>
        }
      />
      <p className="px-5 pb-2 text-xs leading-5 text-muted">{t.prices.hint}</p>
      {!hasHoldings ? <p className="px-5 pb-3 text-[11px] leading-4 text-faint">{t.prices.refreshDisabledHint}</p> : null}

      {hasHoldings ? (
        <>
          <div className="flex flex-wrap gap-2 px-5 pb-2">
            {(["both", "hk", "us"] as BookFilter[]).map((id) => (
              <button key={id} type="button" onClick={() => setBook(id)} className={chip(book === id)}>
                {id === "both" ? t.prices.both : id === "hk" ? t.holdings.hk : t.holdings.us}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 px-5 pb-2">
            {ranges.map((r) => (
              <button key={r.id} type="button" onClick={() => setRange(r.id)} className={chip(range === r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end px-5 pb-2">
            <button type="button" className="tr-press inline-flex min-h-11 items-center px-2 text-xs font-medium text-accent" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {t.holdings.sortCode} {dir === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </>
      ) : null}

      {!hasHoldings ? (
        <Enter>
          <div className="mx-4 rounded-2xl bg-elevated p-4">
            <p className="text-sm font-medium">{t.prices.emptyPerHolding}</p>
            {brokerageLump ? <p className="mt-2 text-xs leading-5 text-muted">{t.prices.emptyBrokerageHint}</p> : null}
            <Link to="/more/holdings" className="tr-press mt-3 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">
              {t.holdings.title}
            </Link>
            <Link to="/assets" className="tr-press mt-2 ml-2 inline-flex min-h-11 items-center rounded-xl bg-background px-4 text-sm font-medium text-accent">
              {t.prices.goAssets}
            </Link>
          </div>
        </Enter>
      ) : (
        <>
          <Enter>
            <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-elevated px-3 py-3">
                <div className="text-[11px] text-muted">{t.prices.total}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">{money(shownTotal, "HKD")}</div>
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
          </Enter>

          {spark.length >= 2 ? (
            <Enter delay>
              <div className="mx-4 mb-3 rounded-2xl bg-elevated px-3 py-3">
                <div className="text-[11px] text-muted">{t.prices.sparklineLabel}</div>
                <Sparkline pts={spark} up={totals.change >= 0} />
              </div>
            </Enter>
          ) : null}

          {busy ? <p className="px-5 py-2 text-sm text-muted">{t.prices.loading}</p> : null}

          {!rows.length ? (
            <p className="px-5 py-6 text-sm text-muted">{t.holdings.empty}</p>
          ) : (
            <Group>
              {rows.map((h, i) => {
                const mv = moves.get(quoteKey(h.market, h.symbol));
                const converted = mv
                  ? quoteToCurrency(
                      { price: mv.last, prevClose: mv.start, currency: mv.currency, pence: mv.pence },
                      h.currency,
                      rates,
                      inferredQuoteCurrency(h.market, h.symbol),
                    )
                  : undefined;
                const last = h.lastPrice;
                const open = converted?.prevClose;
                const pct = open && open > 0 && last ? (last - open) / open : undefined;
                const up = (pct ?? 0) > 0;
                const down = (pct ?? 0) < 0;
                const title = h.market === "us" ? h.symbol : holdingTitle(h);
                return (
                  <div key={h.id}>
                    {i > 0 ? <Hairline /> : null}
                    <button type="button" className="tr-press flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setPicked(h.id)}>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{title}</div>
                        <div className="mt-0.5 text-xs text-muted">{h.symbol}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{last ? money(last, h.currency) : "—"}</div>
                        <div className={cn("text-xs tabular-nums", up ? "text-income" : down ? "text-expense" : "text-muted")}>
                          {pct == null ? "—" : `${up ? "+" : ""}${(pct * 100).toFixed(1)}%`}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </Group>
          )}
        </>
      )}

      {detail ? (
        <Overlay open onClose={() => setPicked(null)} title={t.prices.holdingDetail}>
          <div className="space-y-3 px-5 pb-8">
            <div className="text-base font-semibold">{detail.market === "us" ? detail.symbol : holdingTitle(detail)}</div>
            <div className="text-xs text-muted">{detail.symbol} · {detail.market.toUpperCase()}</div>
            <div className="rounded-xl bg-elevated px-3 py-3">
              <div className="text-[11px] text-muted">{t.prices.marketValue}</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">
                {detail.lastPrice ? money(toHkd(detail.quantity * detail.lastPrice, detail.currency, rates), "HKD") : "—"}
              </div>
              <div className="mt-1 text-xs text-muted">{detail.lastPrice ? money(detail.lastPrice, detail.currency) : "—"}</div>
            </div>
            <div className="rounded-xl bg-elevated px-3 py-3">
              <div className="text-[11px] text-muted">{t.prices.totalChange}</div>
              <div
                className={cn(
                  "mt-0.5 text-lg font-semibold tabular-nums",
                  (detailPct ?? 0) > 0 ? "text-income" : (detailPct ?? 0) < 0 ? "text-expense" : "",
                )}
              >
                {detailPct == null ? "—" : `${detailPct > 0 ? "+" : ""}${(detailPct * 100).toFixed(2)}%`}
              </div>
            </div>
            <div className="rounded-xl bg-elevated px-3 py-3">
              <div className="text-[11px] text-muted">{t.prices.qtyShares}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">{detail.quantity}</div>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}

function Sparkline({ pts, up }: { pts: number[]; up: boolean }) {
  const w = 320;
  const h = 56;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-14 w-full text-accent" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className={cn("rt-spark-draw", up ? "text-income" : "text-expense")} />
    </svg>
  );
}
