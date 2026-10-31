import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ScreenHeader } from "@/components/shared";
import { DateField } from "@/components/txn-composer";
import { money, pct, shortDate, todayISO } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { periodCategoryTotals, periodRange, type PeriodPreset } from "@/lib/calc/period";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

const IN_COLORS = ["#7eb6ff", "#3d8bfd", "#5ad0a8", "#8b7cff", "#5ec8d8"];
const OUT_COLORS = ["#e8a0a0", "#d4c06a", "#8a7ec8", "#e8a0d0", "#7ec8a0", "#f0b27a"];

export function CashflowPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const cats = useApp((s) => s.categories);
  const rates = useApp((s) => s.fxRates);
  const today = todayISO();
  const [preset, setPreset] = useState<PeriodPreset>("this-month");
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [customTo, setCustomTo] = useState(today);
  const [openIn, setOpenIn] = useState(true);
  const [openOut, setOpenOut] = useState(true);
  const range = periodRange(preset, today, customFrom, customTo);
  const from = preset === "custom" ? customFrom : range.from;
  const to = preset === "custom" ? customTo : range.to;
  const income = useMemo(() => periodCategoryTotals(txs, cats, rates, from, to, "income", true), [txs, cats, rates, from, to]);
  const expense = useMemo(() => periodCategoryTotals(txs, cats, rates, from, to, "expense", true), [txs, cats, rates, from, to]);
  const surplus = income.income - expense.expense;
  const rate = income.income > 0 ? surplus / income.income : null;
  const inRows = topRows(income.rows, 5);
  const outRows = topRows(expense.rows, 6);
  const presets: { id: PeriodPreset; label: string }[] = [
    { id: "this-month", label: t.reports.thisMonth },
    { id: "last-month", label: t.reports.lastMonth },
    { id: "this-year", label: t.reports.thisYear },
    { id: "last-year", label: t.reports.lastYear },
    { id: "all", label: t.reports.all },
    { id: "custom", label: t.reports.custom },
  ];

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.cashflow} backTo="/reports" />
      <div className="mx-4 grid grid-cols-2 overflow-hidden rounded-xl bg-elevated">
        <label className="border-r border-line px-4 py-3">
          <div className="text-xs text-muted">{t.reports.start}</div>
          {preset === "custom" ? (
            <DateField value={customFrom} onChange={setCustomFrom} className="mt-1" />
          ) : (
            <div className="mt-1 text-sm">{shortDate(from, locale)}</div>
          )}
        </label>
        <label className="px-4 py-3">
          <div className="text-xs text-muted">{t.reports.end}</div>
          {preset === "custom" ? (
            <DateField value={customTo} onChange={setCustomTo} className="mt-1" />
          ) : (
            <div className="mt-1 text-sm">{shortDate(to, locale)}</div>
          )}
        </label>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium", preset === p.id ? "bg-accent text-on-accent" : "bg-elevated text-muted")}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mx-4 mt-4 space-y-3">
        <Stat label={t.reports.totalSpend} value={money(expense.expense, "HKD")} />
        <Stat label={surplus < 0 ? t.reports.netDeficit : t.reports.netSurplus} value={money(surplus, "HKD", { sign: true })} tone={surplus >= 0 ? "income" : "expense"} />
        <Stat
          label={t.reports.savingsRate}
          value={rate == null ? "—" : pct(rate)}
          tone={rate == null ? undefined : rate >= 0 ? "income" : "expense"}
        />
        {rate == null && expense.expense > 0.005 ? (
          <p className="px-1 text-[11px] leading-4 text-faint">{t.reports.savingsRateNoIncome}</p>
        ) : null}
      </div>

      <FlowSankey
        incomeLabel={t.reports.flowIncome}
        spendLabel={t.reports.totalSpend}
        surplusLabel={t.reports.surplusSaved}
        deficitLabel={t.reports.flowDeficit}
        inRows={inRows.map((r, i) => ({ name: pickName(locale, r.name, r.nameZh), value: r.value, color: IN_COLORS[i % IN_COLORS.length] }))}
        outRows={outRows.map((r, i) => ({ name: pickName(locale, r.name, r.nameZh), value: r.value, color: OUT_COLORS[i % OUT_COLORS.length] }))}
        income={income.income}
        expense={expense.expense}
        surplus={Math.max(0, surplus)}
      />

      <button type="button" className="mx-4 mt-2 flex w-[calc(100%-2rem)] items-center justify-between rounded-xl bg-elevated px-4 py-3" onClick={() => setOpenIn((v) => !v)}>
        <span className="text-sm">{t.reports.incomeSources}</span>
        <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
          {money(income.income, "HKD")}
          <ChevronDown className={cn("size-4 text-faint transition", openIn && "rotate-180")} />
        </span>
      </button>
      {openIn
        ? inRows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-7 py-2 text-sm">
              <span className="text-muted">{pickName(locale, r.name, r.nameZh)}</span>
              <span className="tabular-nums">{money(r.value, "HKD")}</span>
            </div>
          ))
        : null}

      <button type="button" className="mx-4 mt-2 flex w-[calc(100%-2rem)] items-center justify-between rounded-xl bg-elevated px-4 py-3" onClick={() => setOpenOut((v) => !v)}>
        <span className="text-sm">{t.reports.expenseCats}</span>
        <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
          {money(expense.expense, "HKD")}
          <ChevronDown className={cn("size-4 text-faint transition", openOut && "rotate-180")} />
        </span>
      </button>
      {openOut
        ? outRows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-7 py-2 text-sm">
              <span className="text-muted">{pickName(locale, r.name, r.nameZh)}</span>
              <span className="tabular-nums">{money(r.value, "HKD")}</span>
            </div>
          ))
        : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl bg-elevated px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("text-base font-semibold tabular-nums", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{value}</div>
    </div>
  );
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function topRows<T extends { value: number; id: string; name: string; nameZh: string }>(rows: T[], n: number): T[] {
  if (rows.length <= n) return rows;
  const head = rows.slice(0, n - 1);
  const rest = rows.slice(n - 1).reduce((s, r) => s + r.value, 0);
  return [...head, { ...rows[0], id: "other", name: "Other", nameZh: "其他", value: rest }];
}

type FlowRow = { name: string; value: number; color: string };

const FLOW_FONT = 11;

/** Rough text width at FLOW_FONT so long names can be clipped with an ellipsis. */
function clipLabel(text: string, maxPx: number): string {
  let w = 0;
  let out = "";
  for (const ch of text) {
    const cw = /[\u2E80-\uFFEF]/.test(ch) ? FLOW_FONT : FLOW_FONT * 0.58;
    if (w + cw > maxPx) return `${out.trimEnd()}…`;
    w += cw;
    out += ch;
  }
  return out;
}

function FlowSankey({
  inRows,
  outRows,
  income,
  expense,
  surplus,
  incomeLabel,
  spendLabel,
  surplusLabel,
  deficitLabel,
}: {
  inRows: FlowRow[];
  outRows: FlowRow[];
  income: number;
  expense: number;
  surplus: number;
  incomeLabel: string;
  spendLabel: string;
  surplusLabel: string;
  deficitLabel: string;
}) {
  const w = 360;
  const pad = 18;
  const bar = 12;
  const left = 4;
  const mid1 = 118;
  const mid2 = 168;
  const right = 346;
  const minNode = 16;
  const minUsable = 220;
  // Display only: when spend is higher than income, the gap is drawn as money taken from savings.
  const deficit = Math.max(0, expense - income);
  const base = Math.max(income, expense);
  const roughScale = base > 0 ? minUsable / base : 0;
  const inH0 = inRows.map((r) => Math.max(minNode, r.value * roughScale));
  const outH0 = outRows.map((r) => Math.max(minNode, r.value * roughScale));
  const needed = Math.max(
    minUsable,
    sum(inH0) + Math.max(0, inRows.length - 1) * 8,
    sum(outH0) + Math.max(0, outRows.length - 1) * 8,
  );
  const h = needed + pad * 2 + 32;
  const usable = h - pad * 2 - 20;
  const scale = base > 0 ? usable / base : 0;
  const inH = inRows.map((r) => Math.max(minNode, r.value * scale));
  const outH = outRows.map((r) => Math.max(minNode, r.value * scale));
  const spendH = Math.max(8, expense * scale);
  const saveH = Math.max(surplus > 0 ? 8 : 0, surplus * scale);
  let yIn = pad;
  const inNodes = inRows.map((r, i) => {
    const y = yIn;
    yIn += inH[i] + 6;
    return { ...r, y, h: inH[i] };
  });
  const totalY = pad;
  const totalH = Math.max(12, income * scale);
  const deficitH = deficit > 0 ? Math.max(8, deficit * scale) : 0;
  const deficitY = totalY + totalH;
  const spendY = pad;
  const saveY = spendY + spendH + 10;
  let yOut = pad;
  const outNodes = outRows.map((r, i) => {
    const y = yOut;
    yOut += outH[i] + 6;
    return { ...r, y, h: outH[i] };
  });
  const incomeToSpend = Math.min(totalH, deficit > 0 ? totalH : spendH + 4);

  function ribbon(x0: number, y0: number, h0: number, x1: number, y1: number, h1: number, color: string) {
    const c0 = x0 + (x1 - x0) * 0.45;
    const c1 = x1 - (x1 - x0) * 0.45;
    return (
      <path
        d={`M${x0},${y0} C${c0},${y0} ${c1},${y1} ${x1},${y1} L${x1},${y1 + h1} C${c1},${y1 + h1} ${c0},${y0 + h0} ${x0},${y0 + h0} Z`}
        fill={color}
        opacity="0.45"
      />
    );
  }

  let outOff = 0;
  return (
    <div className="mx-2 mt-3 overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto w-full max-w-lg" style={{ height: Math.min(460, Math.max(280, h * 0.95)) }}>
        {inNodes.map((n) => {
          const link = ribbon(left + bar, n.y, n.h, mid1, totalY + (n.y - pad) * (totalH / Math.max(usable, 1)), n.h * (totalH / Math.max(yIn - pad, 1)), n.color);
          return (
            <g key={n.name}>
              {link}
              <rect x={left} y={n.y} width={bar} height={n.h} rx={3} fill={n.color} />
              <text x={left + bar + 4} y={n.y + Math.min(n.h, FLOW_FONT + 2)} fill="var(--color-muted)" fontSize={FLOW_FONT}>
                <title>{n.name}</title>
                {clipLabel(n.name, mid1 - left - bar - 10)}
              </text>
            </g>
          );
        })}
        {ribbon(mid1 + bar, totalY, incomeToSpend, mid2, spendY, deficit > 0 ? Math.min(spendH, totalH) : spendH, "#c4a4a0")}
        {deficit > 0 ? ribbon(mid1 + bar, deficitY, deficitH, mid2, spendY + Math.min(spendH, totalH), Math.max(4, spendH - Math.min(spendH, totalH)), "#d9a441") : null}
        {surplus > 0 ? ribbon(mid1 + bar, totalY + Math.min(totalH, spendH + 4), Math.max(4, totalH - spendH), mid2, saveY, saveH, "#3d9a6a") : null}
        <rect x={mid1} y={totalY} width={bar} height={totalH} rx={3} fill="#9ec0ff" />
        <text x={mid1 - 2} y={Math.max(FLOW_FONT + 1, totalY - 5)} fill="var(--color-muted)" fontSize={FLOW_FONT} textAnchor="end">
          {incomeLabel}
        </text>
        {deficit > 0 ? (
          <>
            <rect x={mid1} y={deficitY} width={bar} height={deficitH} rx={3} fill="#d9a441" />
            <text x={mid1 + bar / 2} y={deficitY + deficitH + FLOW_FONT + 3} fill="var(--color-muted)" fontSize={FLOW_FONT} textAnchor="middle">
              {deficitLabel}
            </text>
          </>
        ) : null}
        <rect x={mid2} y={spendY} width={bar} height={spendH} rx={3} fill="#e8b4b0" />
        <text x={mid2 + bar / 2} y={Math.max(FLOW_FONT + 1, spendY - 5)} fill="var(--color-muted)" fontSize={FLOW_FONT} textAnchor="start">
          {spendLabel}
        </text>
        {surplus > 0 ? (
          <>
            <rect x={mid2} y={saveY} width={bar} height={saveH} rx={3} fill="#3d9a6a" />
            <text x={mid2 + bar / 2} y={saveY + saveH + FLOW_FONT + 3} fill="var(--color-muted)" fontSize={FLOW_FONT} textAnchor="middle">
              {surplusLabel}
            </text>
          </>
        ) : null}
        {outNodes.map((n) => {
          const share = expense > 0 ? n.value / expense : 0;
          const sy = spendY + outOff;
          const sh = spendH * share;
          outOff += sh;
          return (
            <g key={n.name}>
              {ribbon(mid2 + bar, sy, Math.max(4, sh), right - bar, n.y, n.h, n.color)}
              <rect x={right - bar} y={n.y} width={bar} height={n.h} rx={3} fill={n.color} />
              <text x={right - bar - 4} y={n.y + Math.min(n.h, FLOW_FONT + 1)} fill="var(--color-muted)" fontSize={FLOW_FONT} textAnchor="end">
                <title>{n.name}</title>
                {clipLabel(n.name, right - bar - mid2 - bar - 14)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
