import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ScreenHeader } from "@/components/shared";
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
  const rate = income.income > 0 ? surplus / income.income : 0;
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
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-1 w-full bg-transparent text-sm outline-none" />
          ) : (
            <div className="mt-1 text-sm">{shortDate(from, locale)}</div>
          )}
        </label>
        <label className="px-4 py-3">
          <div className="text-xs text-muted">{t.reports.end}</div>
          {preset === "custom" ? (
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-1 w-full bg-transparent text-sm outline-none" />
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

      <div className="mx-4 mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label={t.reports.spendCats} value={money(expense.expense, "HKD")} />
        <Stat label={t.reports.netSurplus} value={money(surplus, "HKD", { sign: true })} tone={surplus >= 0 ? "income" : "expense"} />
        <Stat label={t.reports.savingsRate} value={pct(rate)} tone={rate >= 0 ? "income" : "expense"} />
      </div>

      <FlowSankey
        incomeLabel={t.reports.flowIncome}
        spendLabel={t.reports.totalSpend}
        surplusLabel={t.reports.surplusSaved}
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
    <div>
      <div className="text-[11px] leading-4 text-muted">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{value}</div>
    </div>
  );
}

function topRows<T extends { value: number; id: string; name: string; nameZh: string }>(rows: T[], n: number): T[] {
  if (rows.length <= n) return rows;
  const head = rows.slice(0, n - 1);
  const rest = rows.slice(n - 1).reduce((s, r) => s + r.value, 0);
  return [...head, { ...rows[0], id: "other", name: "Other", nameZh: "其他", value: rest }];
}

type FlowRow = { name: string; value: number; color: string };

function FlowSankey({
  inRows,
  outRows,
  income,
  expense,
  surplus,
  incomeLabel,
  spendLabel,
  surplusLabel,
}: {
  inRows: FlowRow[];
  outRows: FlowRow[];
  income: number;
  expense: number;
  surplus: number;
  incomeLabel: string;
  spendLabel: string;
  surplusLabel: string;
}) {
  const w = 360;
  const h = 280;
  const pad = 8;
  const bar = 10;
  const left = 4;
  const mid1 = 118;
  const mid2 = 168;
  const right = 346;
  const usable = h - pad * 2;
  const scale = income > 0 ? usable / income : 0;
  const inH = inRows.map((r) => Math.max(6, r.value * scale));
  const outH = outRows.map((r) => Math.max(6, r.value * scale));
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
  const spendY = pad;
  const saveY = spendY + spendH + 10;
  let yOut = pad;
  const outNodes = outRows.map((r, i) => {
    const y = yOut;
    yOut += outH[i] + 6;
    return { ...r, y, h: outH[i] };
  });

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

  let inOff = 0;
  let outOff = 0;
  return (
    <div className="mx-2 mt-3 overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto h-[18rem] w-full max-w-lg">
        {inNodes.map((n) => {
          const link = ribbon(left + bar, n.y, n.h, mid1, totalY + (n.y - pad) * (totalH / Math.max(usable, 1)), n.h * (totalH / Math.max(yIn - pad, 1)), n.color);
          inOff += n.h;
          return (
            <g key={n.name}>
              {link}
              <rect x={left} y={n.y} width={bar} height={n.h} rx={3} fill={n.color} />
              <text x={left + bar + 4} y={n.y + Math.min(n.h, 14)} fill="var(--color-muted)" fontSize="8">
                {n.name}
              </text>
            </g>
          );
        })}
        {ribbon(mid1 + bar, totalY, Math.min(totalH, spendH + 4), mid2, spendY, spendH, "#c4a4a0")}
        {surplus > 0 ? ribbon(mid1 + bar, totalY + Math.min(totalH, spendH + 4), Math.max(4, totalH - spendH), mid2, saveY, saveH, "#3d9a6a") : null}
        <rect x={mid1} y={totalY} width={bar} height={totalH} rx={3} fill="#9ec0ff" />
        <text x={mid1 - 2} y={Math.max(12, totalY - 4)} fill="var(--color-muted)" fontSize="8" textAnchor="end">
          {incomeLabel}
        </text>
        <rect x={mid2} y={spendY} width={bar} height={spendH} rx={3} fill="#e8b4b0" />
        <text x={mid2 + bar / 2} y={Math.max(12, spendY - 4)} fill="var(--color-muted)" fontSize="8" textAnchor="middle">
          {spendLabel}
        </text>
        {surplus > 0 ? (
          <>
            <rect x={mid2} y={saveY} width={bar} height={saveH} rx={3} fill="#3d9a6a" />
            <text x={mid2 + bar / 2} y={saveY + saveH + 11} fill="var(--color-muted)" fontSize="8" textAnchor="middle">
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
              <text x={right - bar - 4} y={n.y + Math.min(n.h, 12)} fill="var(--color-muted)" fontSize="8" textAnchor="end">
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
