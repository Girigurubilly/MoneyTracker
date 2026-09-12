import { useEffect, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Group, Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { bookAccountId, holdingMarketValue, holdingTitle, normalizeSymbol, sortHoldingsBySymbol } from "@/lib/holdings";
import type { Currency, Holding, HoldingMarket } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { cn } from "@/lib/utils";

type BookFilter = "both" | "hk" | "us";

export function HoldingsPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const holdings = useApp((s) => s.holdings);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const importText = useApp((s) => s.importHoldingsText);
  const refresh = useApp((s) => s.refreshHoldingPrices);
  const upsert = useApp((s) => s.upsertHolding);
  const setBook = useApp((s) => s.setHoldingBook);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [addMarket, setAddMarket] = useState<HoldingMarket>("hk");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<BookFilter>("both");
  const [editing, setEditing] = useState<Holding | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const invest = accounts.filter((a) => a.type === "investment" && !a.hidden);

  useEffect(() => {
    if (!holdings.length) return;
    const today = todayISO();
    try {
      if (sessionStorage.getItem("hk-life-quotes-day") === today) return;
    } catch {
      /* ignore */
    }
    const stale = holdings.some((h) => !h.lastPriceAt || h.lastPriceAt.slice(0, 10) !== today);
    if (!stale) {
      try {
        sessionStorage.setItem("hk-life-quotes-day", today);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      sessionStorage.setItem("hk-life-quotes-day", today);
    } catch {
      /* ignore */
    }
    setBusy(true);
    void refresh()
      .then((n) => {
        if (n) toast(t.holdings.priced.replace("{n}", String(n)));
      })
      .finally(() => setBusy(false));
  }, [holdings.length]);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const n = await importText(text);
      if (!n) toast(t.holdings.parseFail);
      else toast(t.holdings.imported.replace("{n}", String(n)));
    } catch {
      toast(t.holdings.parseFail);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const visible = sortHoldingsBySymbol(
    holdings.filter((h) => filter === "both" || h.market === filter),
    sortDir,
  );
  const totalHkd = visible.reduce((s, h) => s + holdingMarketValue(h, "HKD", rates), 0);

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.holdings.title}
        right={
          <button
            type="button"
            className="flex items-center gap-1 px-2 text-xs font-medium text-accent"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {sortDir === "asc" ? <ArrowDownAZ className="size-4" /> : <ArrowUpAZ className="size-4" />}
            {t.holdings.sortCode}
          </button>
        }
      />

      <div className="flex gap-2 overflow-x-auto px-5 pb-3">
        {(["both", "hk", "us"] as BookFilter[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn("h-8 shrink-0 rounded-full px-3.5 text-xs font-medium", filter === id ? "bg-accent text-on-accent" : "bg-elevated text-muted")}
          >
            {id === "both" ? t.prices.both : id === "hk" ? t.holdings.hk : t.holdings.us}
          </button>
        ))}
      </div>

      <div className="mx-4 mb-3 rounded-2xl bg-elevated px-4 py-3">
        <div className="text-[11px] text-muted">{t.holdings.bookValue}</div>
        <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{money(totalHkd, "HKD")}</div>
        <div className="mt-0.5 text-xs text-muted">{t.prices.heldCount.replace("{n}", String(visible.length))}</div>
      </div>

      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
        <BookAccountRow
          label={t.holdings.bookHk}
          value={bookAccountId(accounts, "hk")}
          invest={invest}
          onChange={(id) => void setBook("hk", id)}
        />
        <Hairline />
        <BookAccountRow
          label={t.holdings.bookUs}
          value={bookAccountId(accounts, "us")}
          invest={invest}
          onChange={(id) => void setBook("us", id)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 px-4">
        <button
          type="button"
          disabled={busy}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          {t.holdings.uploadShort}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.tsv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <button
          type="button"
          disabled={busy || !holdings.length}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-elevated text-sm disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            try {
              const n = await refresh();
              toast(n ? t.holdings.priced.replace("{n}", String(n)) : t.holdings.priceFail);
            } catch {
              toast(t.holdings.priceFail);
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          {t.holdings.refreshShort}
        </button>
      </div>

      <button
        type="button"
        className="mx-4 mt-3 flex h-11 w-[calc(100%-2rem)] items-center justify-center gap-1.5 rounded-xl bg-elevated text-sm"
        onClick={() => setShowAdd((v) => !v)}
      >
        <Plus className="size-4" />
        {t.holdings.manual}
      </button>
      {showAdd ? (
        <div className="mx-4 mt-2 space-y-2">
          <div className="flex gap-2">
            {(["hk", "us"] as HoldingMarket[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setAddMarket(id)}
                className={cn("h-10 flex-1 rounded-xl text-sm font-medium", addMarket === id ? "bg-accent text-on-accent" : "bg-elevated")}
              >
                {id === "hk" ? t.holdings.hk : t.holdings.us}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={t.holdings.symbol} className="h-11 min-w-0 flex-1 rounded-xl bg-elevated px-3 text-sm" />
            <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t.holdings.qty} inputMode="decimal" className="h-11 w-20 shrink-0 rounded-xl bg-elevated px-2 text-sm" />
            <button
              type="button"
              className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent"
              onClick={() => {
                const q = Number(qty.replace(/,/g, ""));
                const s = symbol.trim().toUpperCase();
                if (!s || !q) {
                  toast(t.holdings.needFields);
                  return;
                }
                void upsert({
                  id: newId(),
                  symbol: normalizeSymbol(addMarket, s),
                  name: s,
                  market: addMarket,
                  source: "manual",
                  quantity: q,
                  currency: addMarket === "hk" ? "HKD" : "USD",
                  lastPrice: 0,
                });
                setSymbol("");
                setQty("");
              }}
            >
              {t.holdings.add}
            </button>
          </div>
        </div>
      ) : null}

      <div className="pt-4">
        {!visible.length ? (
          <p className="px-5 py-6 text-sm text-muted">{t.holdings.empty}</p>
        ) : (
          <Group>
            {visible.map((h, i) => (
              <div key={h.id}>
                {i > 0 ? <Hairline /> : null}
                <div className="flex items-center gap-1 px-3 py-2.5">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(h)}>
                    <div className="truncate text-sm font-medium">{h.market === "us" ? h.symbol : holdingTitle(h)}</div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-muted">
                      {h.market === "us" ? t.holdings.us : h.symbol}
                      {" · "}
                      {h.quantity} × {h.lastPrice ? money(h.lastPrice, h.currency) : "—"}
                    </div>
                  </button>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{money(h.quantity * (h.lastPrice || 0), h.currency)}</div>
                  </div>
                  <button type="button" className="grid size-9 shrink-0 place-items-center text-muted" onClick={() => setEditing(h)} aria-label={t.common.edit}>
                    <Pencil className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </Group>
        )}
      </div>
      {editing ? <HoldingEditor holding={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function BookAccountRow({
  label,
  value,
  invest,
  onChange,
}: {
  label: string;
  value: string;
  invest: { id: string; name: string; nameZh: string }[];
  onChange: (id: string) => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  return (
    <label className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-20 shrink-0 text-sm">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg bg-background px-2 text-sm">
        <option value="">{t.holdings.noAccount}</option>
        {invest.map((a) => (
          <option key={a.id} value={a.id}>
            {pickName(locale, a.name, a.nameZh)}
          </option>
        ))}
      </select>
    </label>
  );
}

function HoldingEditor({ holding, onClose }: { holding: Holding; onClose: () => void }) {
  const t = useT();
  const upsert = useApp((s) => s.upsertHolding);
  const remove = useApp((s) => s.deleteHolding);
  const [market, setMarket] = useState<HoldingMarket>(holding.market);
  const [symbol, setSymbol] = useState(holding.symbol);
  const [name, setName] = useState(holding.name);
  const [qty, setQty] = useState(String(holding.quantity));
  const [price, setPrice] = useState(holding.lastPrice ? String(holding.lastPrice) : "");

  function save() {
    const quantity = Number(qty.replace(/,/g, ""));
    const lastPrice = Number(price.replace(/,/g, "")) || 0;
    if (!symbol.trim() || !Number.isFinite(quantity) || quantity === 0) {
      toast(t.holdings.needFields);
      return;
    }
    void upsert({
      ...holding,
      market,
      symbol: normalizeSymbol(market, symbol),
      name: market === "us" ? normalizeSymbol(market, symbol) : name.trim() || symbol.trim(),
      quantity,
      lastPrice,
      currency: (market === "hk" ? "HKD" : "USD") as Currency,
      accountId: undefined,
      lastPriceAt: lastPrice ? new Date().toISOString() : holding.lastPriceAt,
    });
    onClose();
  }

  return (
    <Overlay open onClose={onClose} variant="page" title={t.holdings.edit}>
      <div className="space-y-3 px-5 pt-4">
        <div className="flex gap-2">
          {(["hk", "us"] as HoldingMarket[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMarket(id)}
              className={cn("h-10 flex-1 rounded-xl text-sm font-medium", market === id ? "bg-accent text-on-accent" : "bg-elevated")}
            >
              {id === "hk" ? t.holdings.hk : t.holdings.us}
            </button>
          ))}
        </div>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={t.holdings.symbol} className="h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        {market === "hk" ? (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.holdings.stockName} className="h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        ) : null}
        <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t.holdings.qty} inputMode="decimal" className="h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t.holdings.price} inputMode="decimal" className="h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        <button type="button" className="h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={save}>
          {t.common.done}
        </button>
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm text-expense"
          onClick={() => {
            void remove(holding.id);
            onClose();
          }}
        >
          <Trash2 className="size-4" />
          {t.holdings.remove}
        </button>
      </div>
    </Overlay>
  );
}
