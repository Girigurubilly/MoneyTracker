import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ChevronRight } from "lucide-react";
import { Overlay, ScreenHeader } from "@/components/shared";
import { money } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { netWorthBreakdown, netWorthNow, type WorthRow } from "@/lib/calc/networth";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/types";
import { toHkd } from "@/lib/calc/fx";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

const CHART = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];

export function BalancePage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const nw = netWorthNow(accounts, rates);
  const parts = netWorthBreakdown(accounts, rates);
  const [focus, setFocus] = useState<"assets" | "liab" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  function typeLabel(type: string) {
    const o = ACCOUNT_TYPE_OPTIONS.find((x) => x.id === type);
    return o ? (locale === "zh-HK" ? o.zh : o.en) : type;
  }

  const pie = [
    { id: "assets" as const, name: t.assets.totalAssets, value: Math.max(0, nw.assets), colorIndex: 0 },
    { id: "liab" as const, name: t.assets.totalLiab, value: Math.max(0, nw.liab), colorIndex: 1 },
  ].filter((r) => r.value > 0);
  const typed = (focus === "assets" ? parts.assets : focus === "liab" ? parts.liabilities : []).map((r, i) => ({
    ...r,
    name: typeLabel(r.type),
    value: r.amount,
    colorIndex: i % 8,
  }));
  const openRow = typed.find((r) => r.id === openId) ?? null;
  const focusLabel = focus === "assets" ? t.assets.totalAssets : t.assets.totalLiab;
  const focusTotal = focus === "assets" ? nw.assets : nw.liab;

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.balance} backTo="/reports" />
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="text-xs text-muted">{t.assets.netWorth}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(nw.net, "HKD")}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="rounded-xl bg-success-soft px-3 py-2 text-left" onClick={() => setFocus("assets")}>
            <div className="text-[11px] text-income">{t.assets.totalAssets}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(nw.assets, "HKD")}</div>
          </button>
          <button type="button" className="rounded-xl bg-expense-soft px-3 py-2 text-left" onClick={() => setFocus("liab")}>
            <div className="text-[11px] text-expense">{t.assets.totalLiab}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(nw.liab, "HKD")}</div>
          </button>
        </div>
      </div>
      <div className="relative mx-auto h-56 w-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pie.length ? pie : [{ id: "empty", value: 1, name: "—" }]}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              stroke="none"
              paddingAngle={pie.length > 1 ? 1.2 : 0}
              onClick={(_, index) => {
                const row = pie[index];
                if (row) setFocus(row.id);
              }}
            >
              {(pie.length ? pie : [{ id: "empty", colorIndex: 0 }]).map((r) => (
                <Cell
                  key={r.id}
                  fill={CHART[r.colorIndex]}
                  className={r.id === "empty" ? undefined : "cursor-pointer outline-none"}
                  onClick={() => {
                    if (r.id !== "empty") setFocus(r.id as "assets" | "liab");
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-base font-semibold tabular-nums">{money(nw.net, "HKD")}</div>
            <div className="text-xs text-muted">{t.assets.netWorth}</div>
          </div>
        </div>
      </div>
      <div className="px-5 pt-2">
        {pie.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setFocus(r.id)}
            className="flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART[r.colorIndex] }} />
              <span className="truncate text-sm">{r.name}</span>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              <span className="text-sm tabular-nums text-muted">{money(r.value, "HKD")}</span>
              <ChevronRight className="size-4 text-faint" />
            </span>
          </button>
        ))}
      </div>

      {focus ? (
        <Overlay open onClose={() => { setFocus(null); setOpenId(null); }} variant="page">
          <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={() => { setFocus(null); setOpenId(null); }}>
              {t.common.back}
            </button>
            <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{focusLabel}</h1>
            <span className="min-w-11" />
          </header>
          <div className="relative mx-auto h-56 w-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typed.length ? typed : [{ id: "empty", value: 1, name: "—" }]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="88%"
                  stroke="none"
                  paddingAngle={typed.length > 1 ? 1.2 : 0}
                  onClick={(_, index) => {
                    const row = typed[index];
                    if (row) setOpenId(row.id);
                  }}
                >
                  {(typed.length ? typed : [{ id: "empty", colorIndex: 0 }]).map((r) => (
                    <Cell
                      key={r.id}
                      fill={CHART[r.colorIndex]}
                      className={r.id === "empty" ? undefined : "cursor-pointer outline-none"}
                      onClick={() => {
                        if (r.id !== "empty") setOpenId(r.id);
                      }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-base font-semibold tabular-nums">{money(focusTotal, "HKD")}</div>
                <div className="text-xs text-muted">{focusLabel}</div>
              </div>
            </div>
          </div>
          <div className="px-5 pt-2">
            {typed.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpenId(r.id)}
                className="flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART[r.colorIndex] }} />
                  <span className="truncate text-sm">{r.name}</span>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-sm tabular-nums text-muted">{money(r.value, "HKD")}</span>
                  <ChevronRight className="size-4 text-faint" />
                </span>
              </button>
            ))}
            {typed.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t.common.none}</p> : null}
          </div>
        </Overlay>
      ) : null}

      {openRow ? (
        <TypeAccountList row={openRow} side={focus === "liab" ? "liab" : "assets"} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}

function TypeAccountList({
  row,
  side,
  onClose,
}: {
  row: WorthRow & { name: string; value: number };
  side: "assets" | "liab";
  onClose: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rates = useApp((s) => s.fxRates);
  return (
    <Overlay open onClose={onClose} variant="page" layer="stack">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.common.back}
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{row.name}</h1>
        <span className="min-w-11" />
      </header>
      <div className="mx-4 mb-4 mt-2 rounded-xl bg-elevated px-4 py-4">
        <div className="text-xs text-muted">{side === "assets" ? t.assets.totalAssets : t.assets.totalLiab}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(row.value, "HKD")}</div>
      </div>
      <div className="px-5">
        {row.accounts.map((a) => (
          <div key={a.id} className="flex min-h-11 items-center justify-between gap-3 py-2.5">
            <span className="truncate text-sm">{pickName(locale, a.name, a.nameZh)}</span>
            <span className="text-sm tabular-nums text-muted">{money(Math.abs(toHkd(a.balance, a.currency, rates)), "HKD")}</span>
          </div>
        ))}
        {row.accounts.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t.common.none}</p> : null}
      </div>
    </Overlay>
  );
}
