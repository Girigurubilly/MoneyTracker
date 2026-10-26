import { useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Group, Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { money, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { bookAccountId, holdingMarketValue, holdingTitle, applyListing, defaultListingCurrency, listingOf, sortHoldingsBySymbol, type HoldingListing } from "@/lib/holdings";
import { buildHoldingsBrief, renderHoldingsBriefMarkdown } from "@/lib/calc/holdings-brief";
import { copyPlainText, sharePlainText } from "@/lib/copy-text";
import { downloadBlob } from "@/lib/backup";
import type { Currency, Holding } from "@/lib/types";
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
  const [addMarket, setAddMarket] = useState<HoldingListing>("hk");
  const [addCcy, setAddCcy] = useState<Currency>("HKD");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<BookFilter>("both");
  const [editing, setEditing] = useState<Holding | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [ai, setAi] = useState(false);
  const invest = accounts.filter((a) => a.type === "investment" && !a.hidden);

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
        backTo="/more"
        right={
          <button
            type="button"
            className="tr-press inline-flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-accent"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {sortDir === "asc" ? <ArrowDownAZ className="size-4" /> : <ArrowUpAZ className="size-4" />}
            {t.holdings.sortCode}
          </button>
        }
      />

      <p className="rt-enter px-5 pb-3 text-xs leading-5 text-muted">{t.holdings.hint}</p>

      <div className="rt-enter flex gap-2 overflow-x-auto px-5 pb-3">
        {(["both", "hk", "us"] as BookFilter[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rt-chip-pill tr-press inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-xs font-medium",
              filter === id ? "bg-accent text-on-accent" : "bg-elevated text-muted",
            )}
          >
            {id === "both" ? t.prices.both : id === "hk" ? t.holdings.hk : t.holdings.us}
          </button>
        ))}
      </div>

      <div className="rt-enter mx-4 mb-3 rounded-2xl bg-elevated px-4 py-3">
        <div className="text-[11px] text-muted">{t.holdings.bookValue}</div>
        <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{money(totalHkd, "HKD")}</div>
        <div className="mt-0.5 text-xs text-muted">{t.prices.heldCount.replace("{n}", String(visible.length))}</div>
      </div>

      <div className="rt-enter-delay mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
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
          className="tr-press flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60"
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
          className="tr-press flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-xl bg-elevated text-sm disabled:opacity-50"
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
        className="tr-press mx-4 mt-2 flex h-11 min-h-11 w-[calc(100%-2rem)] items-center justify-center rounded-xl bg-elevated text-sm font-medium"
        onClick={() => setAi(true)}
      >
        {t.reports.exportBrief}
      </button>
      {ai ? <HoldingsBriefSheet onClose={() => setAi(false)} /> : null}

      <button
        type="button"
        className="tr-press mx-4 mt-3 flex h-11 min-h-11 w-[calc(100%-2rem)] items-center justify-center gap-1.5 rounded-xl bg-elevated text-sm"
        onClick={() => setShowAdd(true)}
      >
        <Plus className="size-4" />
        {t.holdings.manual}
      </button>
      {showAdd ? (
        <AddHoldingSheet
          market={addMarket}
          currency={addCcy}
          symbol={symbol}
          qty={qty}
          onMarket={(id) => {
            setAddMarket(id);
            setAddCcy(defaultListingCurrency(id));
          }}
          onCurrency={setAddCcy}
          onSymbol={setSymbol}
          onQty={setQty}
          onClose={() => setShowAdd(false)}
          onAdd={() => {
            const q = Number(qty.replace(/,/g, ""));
            const s = symbol.trim().toUpperCase();
            if (!s || !q) {
              toast(t.holdings.needFields);
              return;
            }
            const listed = applyListing(addMarket, s);
            void upsert({
              id: newId(),
              symbol: listed.symbol,
              name: listed.symbol,
              market: listed.market,
              source: "manual",
              quantity: q,
              currency: addCcy,
              lastPrice: 0,
            });
            setSymbol("");
            setQty("");
            setShowAdd(false);
          }}
        />
      ) : null}

      <div className="rt-enter-delay pt-4">
        {!visible.length ? (
          <div className="mx-4 rounded-2xl bg-elevated px-4 py-6 text-center">
            <p className="text-sm font-medium">{t.holdings.empty}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{t.holdings.emptyHint}</p>
            <button
              type="button"
              className="tr-press mx-auto mt-3 flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="size-4" />
              {t.holdings.manual}
            </button>
          </div>
        ) : (
          <Group>
            {visible.map((h, i) => (
              <div key={h.id}>
                {i > 0 ? <Hairline /> : null}
                <div className="flex min-h-11 items-center gap-1 px-3 py-2.5">
                  <button type="button" className="tr-press min-w-0 flex-1 text-left" onClick={() => setEditing(h)}>
                    <div className="truncate text-sm font-medium">{listingOf(h) === "us" ? h.symbol : holdingTitle(h)}</div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-muted">
                      {listingOf(h) === "lse" ? t.holdings.lse : h.market === "us" ? t.holdings.us : h.symbol}
                      {` · ${h.currency}`}
                      {" · "}
                      {h.quantity} × {h.lastPrice ? money(h.lastPrice, h.currency) : "—"}
                      {h.avgCost != null ? ` · ${t.holdings.avgCost} ${money(h.avgCost, h.currency)}` : ""}
                    </div>
                  </button>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{money(h.quantity * (h.lastPrice || 0), h.currency)}</div>
                  </div>
                  <button type="button" className="tr-press grid size-11 shrink-0 place-items-center text-muted" onClick={() => setEditing(h)} aria-label={t.common.edit}>
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

function AddHoldingSheet({
  market,
  currency,
  symbol,
  qty,
  onMarket,
  onCurrency,
  onSymbol,
  onQty,
  onClose,
  onAdd,
}: {
  market: HoldingListing;
  currency: Currency;
  symbol: string;
  qty: string;
  onMarket: (id: HoldingListing) => void;
  onCurrency: (c: Currency) => void;
  onSymbol: (v: string) => void;
  onQty: (v: string) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const t = useT();
  return (
    <Overlay open onClose={onClose} title={t.holdings.manual} variant="sheet">
      <div className="rt-enter space-y-3 px-5 pb-4 pt-1">
        <div className="flex gap-2">
          {(["hk", "us", "lse"] as HoldingListing[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onMarket(id)}
              className={cn(
                "rt-chip-pill tr-press flex h-11 min-h-11 flex-1 items-center justify-center rounded-xl text-sm font-medium",
                market === id ? "bg-accent text-on-accent" : "bg-elevated",
              )}
            >
              {id === "hk" ? t.holdings.hk : id === "lse" ? t.holdings.lse : t.holdings.us}
            </button>
          ))}
        </div>
        <label className="block text-[11px] text-muted">{t.holdings.symbol}</label>
        <input
          value={symbol}
          onChange={(e) => onSymbol(e.target.value)}
          placeholder={market === "lse" ? "VXUS" : t.holdings.symbol}
          className="h-11 min-h-11 w-full rounded-xl bg-elevated px-3 text-sm"
          autoFocus
        />
        <label className="block text-[11px] text-muted">{t.holdings.qty}</label>
        <input
          value={qty}
          onChange={(e) => onQty(e.target.value)}
          placeholder={t.holdings.qty}
          inputMode="decimal"
          className="h-11 min-h-11 w-full rounded-xl bg-elevated px-3 text-sm"
        />
        <label className="block text-[11px] text-muted">{t.holdings.currency}</label>
        <select
          value={currency}
          onChange={(e) => onCurrency(e.target.value as Currency)}
          className="h-11 min-h-11 w-full rounded-xl bg-elevated px-3 text-sm"
          aria-label={t.holdings.currency}
        >
          {holdingCurrencies(currency).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="button" className="tr-press h-12 min-h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={onAdd}>
          {t.holdings.add}
        </button>
      </div>
    </Overlay>
  );
}

function HoldingsBriefSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const holdings = useApp((s) => s.holdings);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const markdown = useMemo(
    () => renderHoldingsBriefMarkdown(buildHoldingsBrief({ today: todayISO(), holdings, accounts, rates })),
    [holdings, accounts, rates],
  );
  async function copy() {
    if (await copyPlainText(markdown)) {
      toast(t.assets.copied);
      return;
    }
    const shared = await sharePlainText(markdown, t.reports.exportBrief);
    if (shared === "shared" || shared === "aborted") return;
    toast(t.assets.copyFailed);
  }
  return (
    <Overlay open onClose={onClose} title={t.reports.exportBrief} variant="page">
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.holdings.exportAiHint}</p>
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        <button type="button" className="tr-press h-11 min-h-11 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void copy()}>
          {t.assets.copyBrief}
        </button>
        <button
          type="button"
          className="tr-press h-11 min-h-11 rounded-xl bg-elevated text-sm font-medium"
          onClick={() => downloadBlob(`hk-life-holdings-${todayISO()}.md`, markdown, "text/markdown")}
        >
          {t.assets.downloadBrief}
        </button>
      </div>
      <pre className="mx-4 mb-8 max-h-[70dvh] select-text overflow-auto whitespace-pre-wrap rounded-2xl bg-elevated p-4 text-[11px] leading-4 text-muted">{markdown}</pre>
    </Overlay>
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

function holdingCurrencies(current: Currency): Currency[] {
  const base: Currency[] = ["HKD", "USD", "GBP", "EUR"];
  return base.includes(current) ? base : [current, ...base];
}

function HoldingEditor({ holding, onClose }: { holding: Holding; onClose: () => void }) {
  const t = useT();
  const upsert = useApp((s) => s.upsertHolding);
  const remove = useApp((s) => s.deleteHolding);
  const [listing, setListing] = useState<HoldingListing>(listingOf(holding));
  const [symbol, setSymbol] = useState(holding.symbol);
  const [name, setName] = useState(holding.name);
  const [qty, setQty] = useState(String(holding.quantity));
  const [price, setPrice] = useState(holding.lastPrice ? String(holding.lastPrice) : "");
  const [cost, setCost] = useState(holding.avgCost == null ? "" : String(holding.avgCost));
  const [policyNote, setPolicyNote] = useState(holding.policyNote ?? "");
  const [currency, setCurrency] = useState<Currency>(holding.currency);

  function save() {
    const quantity = Number(qty.replace(/,/g, ""));
    const lastPrice = Number(price.replace(/,/g, "")) || 0;
    const avgCost = cost.trim() === "" ? undefined : Number(cost.replace(/,/g, ""));
    if (!symbol.trim() || !Number.isFinite(quantity) || quantity === 0) {
      toast(t.holdings.needFields);
      return;
    }
    const listed = applyListing(listing, symbol);
    void upsert({
      ...holding,
      market: listed.market,
      symbol: listed.symbol,
      name: listing === "hk" ? name.trim() || listed.symbol : listed.symbol,
      quantity,
      lastPrice,
      avgCost: avgCost != null && Number.isFinite(avgCost) ? avgCost : undefined,
      policyNote: policyNote.trim() || undefined,
      currency,
      accountId: undefined,
      lastPriceAt: lastPrice ? new Date().toISOString() : holding.lastPriceAt,
    });
    onClose();
  }

  return (
    <Overlay open onClose={onClose} variant="page" title={t.holdings.edit}>
      <div className="rt-enter space-y-3 px-5 pt-4 pb-10">
        <div className="flex gap-2">
          {(["hk", "us", "lse"] as HoldingListing[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setListing(id);
                setCurrency(defaultListingCurrency(id));
              }}
              className={cn("rt-chip-pill tr-press flex h-11 min-h-11 flex-1 items-center justify-center rounded-xl text-sm font-medium", listing === id ? "bg-accent text-on-accent" : "bg-elevated")}
            >
              {id === "hk" ? t.holdings.hk : id === "lse" ? t.holdings.lse : t.holdings.us}
            </button>
          ))}
        </div>
        <label className="block text-[11px] text-muted">{t.holdings.symbol}</label>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={listing === "lse" ? "VXUS" : t.holdings.symbol} className="h-11 min-h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        {listing === "hk" ? (
          <>
            <label className="block text-[11px] text-muted">{t.holdings.stockName}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.holdings.stockName} className="h-11 min-h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
          </>
        ) : null}
        <label className="block text-[11px] text-muted">{t.holdings.currency}</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          className="h-11 min-h-11 w-full rounded-xl bg-elevated px-3 text-sm"
          aria-label={t.holdings.currency}
        >
          {holdingCurrencies(currency).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="block text-[11px] text-muted">{t.holdings.qty}</label>
        <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t.holdings.qty} inputMode="decimal" className="h-11 min-h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        <label className="block text-[11px] text-muted">{t.holdings.price}</label>
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t.holdings.price} inputMode="decimal" className="h-11 min-h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        <label className="block text-[11px] text-muted">{t.holdings.avgCost}</label>
        <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder={t.holdings.avgCost} inputMode="decimal" className="h-11 min-h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        <label className="block text-[11px] text-muted">{t.holdings.policyNote}</label>
        <input value={policyNote} onChange={(e) => setPolicyNote(e.target.value)} placeholder={t.holdings.policyNote} className="h-11 min-h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        <p className="text-[11px] leading-4 text-muted">{t.holdings.policyNoteHint}</p>
        <button type="button" className="tr-press h-12 min-h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={save}>
          {t.common.done}
        </button>
        <button
          type="button"
          className="tr-press flex h-11 min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm text-expense"
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
