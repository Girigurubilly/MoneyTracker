import { useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Pencil, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Group, Hairline, Overlay, ScreenHeader } from "@/components/shared";
import { money } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { holdingMarketValue, holdingTitle, normalizeSymbol, sortHoldingsBySymbol } from "@/lib/holdings";
import type { Currency, Holding, HoldingMarket } from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { cn } from "@/lib/utils";

export function HoldingsPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const holdings = useApp((s) => s.holdings);
  const accounts = useApp((s) => s.accounts);
  const importText = useApp((s) => s.importHoldingsText);
  const refresh = useApp((s) => s.refreshHoldingPrices);
  const upsert = useApp((s) => s.upsertHolding);
  const fileRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [market, setMarket] = useState<HoldingMarket>("hk");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editing, setEditing] = useState<Holding | "new" | null>(null);
  const invest = accounts.filter((a) => a.type === "investment" && !a.hidden);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const n = await importText(text, accountId || undefined);
      if (!n) toast(t.holdings.parseFail);
      else toast(t.holdings.imported.replace("{n}", String(n)));
    } catch {
      toast(t.holdings.parseFail);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const hk = sortHoldingsBySymbol(holdings.filter((h) => h.market === "hk"), sortDir);
  const us = sortHoldingsBySymbol(holdings.filter((h) => h.market === "us"), sortDir);

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
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.holdings.hint}</p>
      <div className="px-5 space-y-3">
        <label className="block text-xs text-muted">{t.holdings.targetAccount}</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="h-11 w-full rounded-xl bg-elevated px-3 text-sm"
        >
          <option value="">{t.holdings.noAccount}</option>
          {invest.map((a) => (
            <option key={a.id} value={a.id}>
              {pickName(locale, a.name, a.nameZh)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          {t.holdings.upload}
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
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-elevated text-sm disabled:opacity-50"
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
          {t.holdings.refresh}
        </button>
      </div>

      <h2 className="px-5 pb-2 pt-6 text-sm font-medium text-muted">{t.holdings.manual}</h2>
      <div className="mx-4 mb-4 grid grid-cols-2 gap-2">
        <select value={market} onChange={(e) => setMarket(e.target.value as HoldingMarket)} className="h-11 rounded-xl bg-elevated px-3 text-sm">
          <option value="hk">{t.holdings.hk}</option>
          <option value="us">{t.holdings.us}</option>
        </select>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={t.holdings.symbol} className="h-11 rounded-xl bg-elevated px-3 text-sm" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t.holdings.qty} inputMode="decimal" className="h-11 rounded-xl bg-elevated px-3 text-sm" />
        <button
          type="button"
          className="h-11 rounded-xl bg-elevated text-sm font-medium"
          onClick={() => {
            const q = Number(qty.replace(/,/g, ""));
            const s = symbol.trim().toUpperCase();
            if (!s || !q) {
              toast(t.holdings.needFields);
              return;
            }
            const row: Holding = {
              id: newId(),
              symbol: normalizeSymbol(market, s),
              name: s,
              market,
              source: "manual",
              quantity: q,
              currency: market === "hk" ? "HKD" : "USD",
              lastPrice: 0,
              accountId: accountId || undefined,
            };
            void upsert(row);
            setSymbol("");
            setQty("");
          }}
        >
          {t.holdings.add}
        </button>
      </div>

      <Book title={t.holdings.hk} rows={hk} invest={invest} onEdit={setEditing} />
      <Book title={t.holdings.us} rows={us} invest={invest} onEdit={setEditing} usTicker />
      {!holdings.length ? <p className="px-5 py-6 text-sm text-muted">{t.holdings.empty}</p> : null}
      {editing && editing !== "new" ? <HoldingEditor holding={editing} invest={invest} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function Book({
  title,
  rows,
  invest,
  onEdit,
  usTicker,
}: {
  title: string;
  rows: Holding[];
  invest: { id: string; name: string; nameZh: string }[];
  onEdit: (h: Holding) => void;
  usTicker?: boolean;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rates = useApp((s) => s.fxRates);
  const upsert = useApp((s) => s.upsertHolding);
  const remove = useApp((s) => s.deleteHolding);
  if (!rows.length) return null;
  const totalHkd = rows.reduce((s, h) => s + holdingMarketValue(h, "HKD", rates), 0);
  return (
    <div className="pt-4">
      <div className="flex items-baseline justify-between px-5 pb-2">
        <h2 className="text-sm font-medium text-muted">{title}</h2>
        <span className="text-xs tabular-nums text-muted">{money(totalHkd, "HKD")}</span>
      </div>
      <Group>
        {rows.map((h, i) => (
          <div key={h.id}>
            {i > 0 ? <Hairline /> : null}
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(h)}>
                  <div className="text-sm font-medium">{usTicker ? h.symbol : holdingTitle(h)}</div>
                  <div className="mt-0.5 text-xs tabular-nums text-muted">
                    {usTicker ? "" : `${h.symbol} · `}
                    {h.quantity} × {h.lastPrice ? money(h.lastPrice, h.currency) : "—"} = {money(h.quantity * (h.lastPrice || 0), h.currency)}
                  </div>
                </button>
                <button type="button" className="grid size-9 place-items-center text-muted" onClick={() => onEdit(h)} aria-label={t.common.edit}>
                  <Pencil className="size-4" />
                </button>
                <button type="button" className="grid size-9 place-items-center text-muted" onClick={() => void remove(h.id)} aria-label={t.holdings.remove}>
                  <Trash2 className="size-4" />
                </button>
              </div>
              {invest.length ? (
                <select
                  value={h.accountId ?? ""}
                  onChange={(e) => void upsert({ ...h, accountId: e.target.value || undefined })}
                  className="mt-2 h-9 w-full rounded-lg bg-background px-2 text-xs"
                >
                  <option value="">{t.holdings.noAccount}</option>
                  {invest.map((a) => (
                    <option key={a.id} value={a.id}>
                      {pickName(locale, a.name, a.nameZh)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>
        ))}
      </Group>
    </div>
  );
}

function HoldingEditor({
  holding,
  invest,
  onClose,
}: {
  holding: Holding;
  invest: { id: string; name: string; nameZh: string }[];
  onClose: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const upsert = useApp((s) => s.upsertHolding);
  const [market, setMarket] = useState<HoldingMarket>(holding.market);
  const [symbol, setSymbol] = useState(holding.symbol);
  const [name, setName] = useState(holding.name);
  const [qty, setQty] = useState(String(holding.quantity));
  const [price, setPrice] = useState(holding.lastPrice ? String(holding.lastPrice) : "");
  const [accountId, setAccountId] = useState(holding.accountId ?? "");

  function save() {
    const quantity = Number(qty.replace(/,/g, ""));
    const lastPrice = Number(price.replace(/,/g, "")) || 0;
    if (!symbol.trim() || !Number.isFinite(quantity) || quantity === 0) {
      toast(t.holdings.needFields);
      return;
    }
    const next: Holding = {
      ...holding,
      market,
      symbol: normalizeSymbol(market, symbol),
      name: market === "us" ? normalizeSymbol(market, symbol) : name.trim() || symbol.trim(),
      quantity,
      lastPrice,
      currency: (market === "hk" ? "HKD" : "USD") as Currency,
      accountId: accountId || undefined,
      lastPriceAt: lastPrice ? new Date().toISOString() : holding.lastPriceAt,
    };
    void upsert(next);
    onClose();
  }

  return (
    <Overlay open onClose={onClose} variant="page" title={t.holdings.edit}>
      <div className="space-y-3 px-5 pt-4">
        <label className="block text-xs text-muted">{t.holdings.market}</label>
        <select value={market} onChange={(e) => setMarket(e.target.value as HoldingMarket)} className="h-11 w-full rounded-xl bg-elevated px-3 text-sm">
          <option value="hk">{t.holdings.hk}</option>
          <option value="us">{t.holdings.us}</option>
        </select>
        <label className="block text-xs text-muted">{t.holdings.symbol}</label>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        {market === "hk" ? (
          <>
            <label className="block text-xs text-muted">{t.holdings.stockName}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
          </>
        ) : null}
        <label className="block text-xs text-muted">{t.holdings.qty}</label>
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className="h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        <label className="block text-xs text-muted">{t.holdings.price}</label>
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="h-11 w-full rounded-xl bg-elevated px-3 text-sm" />
        <label className="block text-xs text-muted">{t.holdings.targetAccount}</label>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-11 w-full rounded-xl bg-elevated px-3 text-sm">
          <option value="">{t.holdings.noAccount}</option>
          {invest.map((a) => (
            <option key={a.id} value={a.id}>
              {pickName(locale, a.name, a.nameZh)}
            </option>
          ))}
        </select>
        <button type="button" className="h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={save}>
          {t.common.done}
        </button>
      </div>
    </Overlay>
  );
}
