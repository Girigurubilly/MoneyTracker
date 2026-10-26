import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Overlay, ScreenHeader } from "@/components/shared";
import { AssetBriefButton } from "@/components/asset-brief";
import { prefersReducedMotion } from "@/components/retire-ux";
import { useRetirementHeadline } from "@/components/reports-retire";
import { money, pct, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { investableNow, netWorthBreakdown, netWorthNow, type WorthRow } from "@/lib/calc/networth";
import { depositsOutsideBalances } from "@/lib/calc/deposits";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/types";
import { toHkd } from "@/lib/calc/fx";
import { cn } from "@/lib/utils";
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

type PieRow = {
  id: string;
  name: string;
  value: number;
  colorIndex: number;
};

export function BalancePage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const deposits = useApp((s) => s.deposits);
  const nw = netWorthNow(accounts, rates, deposits);
  const parts = netWorthBreakdown(accounts, rates, deposits);
  const head = useRetirementHeadline();
  const investable = investableNow(accounts, rates, deposits);
  const animate = !prefersReducedMotion();
  const [focus, setFocus] = useState<"assets" | "liab" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const debtRatio = nw.assets > 0 ? nw.liab / nw.assets : null;

  function typeLabel(type: string) {
    const o = ACCOUNT_TYPE_OPTIONS.find((x) => x.id === type);
    return o ? (locale === "zh-HK" ? o.zh : o.en) : type;
  }

  function pickSide(side: "assets" | "liab") {
    if (focus === side) {
      setFocus(null);
      setOpenId(null);
      return;
    }
    setOpenId(null);
    setFocus(side);
  }

  function clearFocus() {
    setFocus(null);
    setOpenId(null);
  }

  const rootPie: PieRow[] = [
    { id: "assets", name: t.assets.totalAssets, value: Math.max(0, nw.assets), colorIndex: 0 },
    { id: "liab", name: t.assets.totalLiab, value: Math.max(0, nw.liab), colorIndex: 1 },
  ].filter((r) => r.value > 0);

  const typed = (focus === "assets" ? parts.assets : focus === "liab" ? parts.liabilities : []).map((r, i) => ({
    ...r,
    name: r.id === "deposits" ? (locale === "zh-HK" ? r.labelZh : r.label) : typeLabel(r.type),
    value: r.amount,
    colorIndex: i % 8,
  }));

  const openRow = typed.find((r) => r.id === openId) ?? null;
  const focusLabel = focus === "assets" ? t.assets.totalAssets : t.assets.totalLiab;
  const focusTotal = focus === "assets" ? nw.assets : nw.liab;
  const chartRows: PieRow[] = focus
    ? typed.map((r) => ({ id: r.id, name: r.name, value: r.value, colorIndex: r.colorIndex }))
    : rootPie;
  const centerValue = focus ? focusTotal : nw.net;
  const centerLabel = focus ? focusLabel : t.assets.netWorth;
  const listRows: PieRow[] = focus
    ? typed.map((r) => ({ id: r.id, name: r.name, value: r.value, colorIndex: r.colorIndex }))
    : rootPie;
  const listDenom = focus ? focusTotal : nw.assets + nw.liab;
  const drillKey = focus ?? "root";

  return (
    <div className="pb-28">
      <ScreenHeader title={t.reports.balance} backTo="/reports" right={<AssetBriefButton className="px-2 text-sm font-medium text-accent" />} />
      <div className="rt-enter mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="text-xs text-muted">{t.assets.netWorth}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(nw.net, "HKD")}</div>
        <div className="mt-2 text-xs text-muted">
          {debtRatio == null
            ? t.reports.debtRatioZero
            : t.reports.debtRatio.replace("{pct}", pct(debtRatio))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={cn(
              "tr-press rounded-xl bg-success-soft px-3 py-2 text-left transition",
              focus === "assets" && "ring-2 ring-accent",
            )}
            onClick={() => pickSide("assets")}
          >
            <div className="text-[11px] text-income">{t.assets.totalAssets}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(nw.assets, "HKD")}</div>
          </button>
          <button
            type="button"
            className={cn(
              "tr-press rounded-xl bg-expense-soft px-3 py-2 text-left transition",
              focus === "liab" && "ring-2 ring-accent",
            )}
            onClick={() => pickSide("liab")}
          >
            <div className="text-[11px] text-expense">{t.assets.totalLiab}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{money(nw.liab, "HKD")}</div>
          </button>
        </div>
        <div className="mt-3 rounded-xl bg-background px-3 py-2.5 text-sm text-muted">
          {t.reports.balanceInvestable.replace("{amount}", money(investable || head.investable, "HKD"))}
        </div>
      </div>

      <div className="rt-drill-stage mx-0">
        <div
          className={cn(
            "overflow-hidden px-4",
            animate && "rt-drill-chrome",
            focus ? "max-h-14 opacity-100" : "pointer-events-none max-h-0 opacity-0",
          )}
          aria-hidden={!focus}
        >
          <div className="mb-2 flex min-h-11 items-center gap-1">
            <button
              type="button"
              className="tr-press inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-accent"
              onClick={clearFocus}
              aria-label={t.common.back}
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{focusLabel}</div>
              <div className="text-xs tabular-nums text-muted">{money(focusTotal, "HKD")}</div>
            </div>
          </div>
        </div>

        <div
          key={`chart-${drillKey}`}
          className={cn("relative mx-auto h-56 w-56", animate && "rt-drill-swap rt-chart-draw")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartRows.length ? chartRows : [{ id: "empty", value: 1, name: "—" }]}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="88%"
                stroke="none"
                paddingAngle={chartRows.length > 1 ? 1.2 : 0}
                isAnimationActive={animate}
                animationDuration={420}
                animationBegin={0}
                onClick={(_, index) => {
                  const row = chartRows[index];
                  if (!row || row.id === "empty") return;
                  if (!focus) {
                    if (row.id === "assets" || row.id === "liab") pickSide(row.id);
                    return;
                  }
                  setOpenId(row.id);
                }}
              >
                {(chartRows.length ? chartRows : [{ id: "empty", colorIndex: 0 }]).map((r) => (
                  <Cell
                    key={r.id}
                    fill={CHART[r.colorIndex % 8]}
                    opacity={openId && r.id !== openId && r.id !== "empty" ? 0.45 : 1}
                    className={r.id === "empty" ? undefined : "cursor-pointer outline-none"}
                    style={animate ? { transition: "opacity 200ms ease" } : undefined}
                    onClick={() => {
                      if (r.id === "empty") return;
                      if (!focus) {
                        if (r.id === "assets" || r.id === "liab") pickSide(r.id as "assets" | "liab");
                        return;
                      }
                      setOpenId(r.id);
                    }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div key={`center-${drillKey}`} className={cn(animate && "rt-drill-swap")}>
              <div className="text-base font-semibold tabular-nums">{money(centerValue, "HKD")}</div>
              <div className="text-xs text-muted">{centerLabel}</div>
            </div>
          </div>
        </div>

        <div key={`list-${drillKey}`} className={cn("px-5 pt-2", animate && "rt-drill-swap")}>
          {listRows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                if (!focus) {
                  if (r.id === "assets" || r.id === "liab") pickSide(r.id);
                  return;
                }
                setOpenId(r.id);
              }}
              className={cn(
                "tr-press flex min-h-11 w-full items-center justify-between gap-3 rounded-lg py-2.5 text-left transition",
                (focus ? openId === r.id : focus === r.id) && "bg-accent-soft/60 px-2",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART[r.colorIndex % 8] }} />
                <span className="truncate text-sm">{r.name}</span>
              </div>
              <span className="flex shrink-0 items-center gap-1">
                <span className="text-sm tabular-nums text-muted">
                  {money(r.value, "HKD")}
                  <span className="ml-2 text-xs text-faint">{listDenom > 0 ? pct(r.value / listDenom) : "—"}</span>
                </span>
                <ChevronRight className="size-4 text-faint" />
              </span>
            </button>
          ))}
          {focus && listRows.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t.common.none}</p> : null}
        </div>
      </div>

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
  const accounts = useApp((s) => s.accounts);
  const deposits = useApp((s) => s.deposits);
  const today = todayISO();
  const outside =
    row.id === "deposits" && row.accounts.length === 0
      ? depositsOutsideBalances(deposits, accounts, rates, today)
      : [];

  return (
    <Overlay open onClose={onClose} variant="sheet" layer="stack">
      <header className="flex items-center justify-between px-3 pt-2">
        <button type="button" className="tr-press h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.common.close}
        </button>
        <h2 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{row.name}</h2>
        <span className="min-w-11" />
      </header>
      <div className="rt-enter mx-4 mb-4 mt-1 rounded-xl bg-elevated px-4 py-4">
        <div className="text-xs text-muted">{side === "assets" ? t.assets.totalAssets : t.assets.totalLiab}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(row.value, "HKD")}</div>
      </div>
      <div className="rt-enter-delay px-5 pb-2">
        {row.accounts.map((a, i) => (
          <div
            key={a.id}
            className="rt-drill-row flex min-h-11 items-center justify-between gap-3 py-2.5"
            style={{ animationDelay: `${i * 28}ms` }}
          >
            <span className="truncate text-sm">{pickName(locale, a.name, a.nameZh)}</span>
            <span className="text-sm tabular-nums text-muted">
              {money(Math.abs(toHkd(a.balance, a.currency, rates)), "HKD")}
              <span className="ml-2 text-xs text-faint">
                {row.value > 0 ? pct(Math.abs(toHkd(a.balance, a.currency, rates)) / row.value) : "—"}
              </span>
            </span>
          </div>
        ))}
        {outside.length ? (
          <>
            <p className="pb-1 pt-2 text-xs text-muted">{t.reports.balanceTdOutside}</p>
            {outside.map((d, i) => (
              <div
                key={d.id}
                className="rt-drill-row flex min-h-11 items-center justify-between gap-3 py-2.5"
                style={{ animationDelay: `${(row.accounts.length + i) * 28}ms` }}
              >
                <span className="min-w-0 truncate text-sm">
                  {d.bank}
                  {d.endDate ? <span className="ml-1 text-xs text-faint">{d.endDate}</span> : null}
                </span>
                <span className="text-sm tabular-nums text-muted">{money(Math.abs(toHkd(d.amount, d.currency, rates)), "HKD")}</span>
              </div>
            ))}
          </>
        ) : null}
        {row.accounts.length === 0 && outside.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t.common.none}</p> : null}
      </div>
    </Overlay>
  );
}
