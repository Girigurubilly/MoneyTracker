import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Overlay, ScreenHeader } from "@/components/shared";
import { money } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { netWorthBreakdown, netWorthNow } from "@/lib/calc/networth";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/types";
import { toHkd } from "@/lib/calc/fx";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

const CHART = ["var(--color-income)", "var(--color-expense)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-6)"];

export function BalancePage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const nw = netWorthNow(accounts, rates);
  const parts = netWorthBreakdown(accounts, rates);
  const [side, setSide] = useState<"assets" | "liab" | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const pie = [
    { id: "assets", name: t.assets.totalAssets, value: Math.max(0, nw.assets), color: CHART[0] },
    { id: "liab", name: t.assets.totalLiab, value: Math.max(0, nw.liab), color: CHART[1] },
  ].filter((r) => r.value > 0);
  const openRows = side === "assets" ? parts.assets : side === "liab" ? parts.liabilities : [];
  const openType = openRows.find((r) => r.id === typeId) ?? null;

  function typeLabel(type: string) {
    const o = ACCOUNT_TYPE_OPTIONS.find((x) => x.id === type);
    return o ? (locale === "zh-HK" ? o.zh : o.en) : type;
  }

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.balance} backTo="/reports" />
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="text-xs text-muted">{t.assets.netWorth}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(nw.net, "HKD")}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="rounded-xl bg-success-soft px-3 py-2 text-left" onClick={() => setSide("assets")}>
            <div className="text-[11px] text-income">{t.assets.totalAssets}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(nw.assets, "HKD")}</div>
          </button>
          <button type="button" className="rounded-xl bg-expense-soft px-3 py-2 text-left" onClick={() => setSide("liab")}>
            <div className="text-[11px] text-expense">{t.assets.totalLiab}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(nw.liab, "HKD")}</div>
          </button>
        </div>
      </div>
      <div className="relative mx-auto h-52 w-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pie.length ? pie : [{ id: "empty", value: 1, name: "—" }]} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" stroke="none" paddingAngle={2}>
              {(pie.length ? pie : [{ id: "empty", color: "var(--color-ring-track)" }]).map((r) => (
                <Cell key={r.id} fill={r.color} className="cursor-pointer" onClick={() => { if (r.id === "assets" || r.id === "liab") setSide(r.id); }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div className="text-xs text-muted">{t.reports.balance}</div>
        </div>
      </div>
      <div className="px-5 pt-2">
        {parts.assets.map((r) => (
          <button key={`a-${r.id}`} type="button" className="flex w-full items-center justify-between py-2.5 text-left" onClick={() => { setSide("assets"); setTypeId(r.id); }}>
            <span className="truncate text-sm">{typeLabel(r.type)}</span>
            <span className="text-sm tabular-nums text-income">{money(r.amount, "HKD")}</span>
          </button>
        ))}
        {parts.liabilities.map((r) => (
          <button key={`l-${r.id}`} type="button" className="flex w-full items-center justify-between py-2.5 text-left" onClick={() => { setSide("liab"); setTypeId(r.id); }}>
            <span className="truncate text-sm">{typeLabel(r.type)}</span>
            <span className="text-sm tabular-nums text-expense">{money(r.amount, "HKD")}</span>
          </button>
        ))}
      </div>

      {side && !openType ? (
        <Overlay open onClose={() => setSide(null)} variant="page">
          <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button type="button" className="h-11 px-2 text-sm text-accent" onClick={() => setSide(null)}>{t.common.back}</button>
            <h1 className="text-base font-semibold">{side === "assets" ? t.assets.totalAssets : t.assets.totalLiab}</h1>
            <span className="min-w-11" />
          </header>
          <div className="px-5">
            {openRows.map((r) => (
              <button key={r.id} type="button" className="flex w-full items-center justify-between py-3 text-left" onClick={() => setTypeId(r.id)}>
                <span className="text-sm">{typeLabel(r.type)}</span>
                <span className={`text-sm tabular-nums ${side === "assets" ? "text-income" : "text-expense"}`}>{money(r.amount, "HKD")}</span>
              </button>
            ))}
            {openRows.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t.common.none}</p> : null}
          </div>
        </Overlay>
      ) : null}

      {openType ? (
        <Overlay open onClose={() => setTypeId(null)} variant="page">
          <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button type="button" className="h-11 px-2 text-sm text-accent" onClick={() => setTypeId(null)}>{t.common.back}</button>
            <h1 className="text-base font-semibold">{typeLabel(openType.type)}</h1>
            <span className="min-w-11" />
          </header>
          <div className="mx-4 mb-3 rounded-2xl bg-elevated p-4">
            <div className="text-xs text-muted">{side === "assets" ? t.assets.totalAssets : t.assets.totalLiab}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{money(openType.amount, "HKD")}</div>
          </div>
          <div className="px-5">
            {openType.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <span className="truncate text-sm">{pickName(locale, a.name, a.nameZh)}</span>
                <span className="text-sm tabular-nums">{money(Math.abs(toHkd(a.balance, a.currency, rates)), "HKD")}</span>
              </div>
            ))}
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
