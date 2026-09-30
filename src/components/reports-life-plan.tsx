import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Disclaimer, ScreenHeader, SectionLabel } from "@/components/shared";
import { LifeYearList } from "@/components/life-year-list";
import { LifePlanJobs } from "@/components/life-plan-setup";
import { SharedRetirementStrip, useLifePlanResult } from "@/components/reports-retire";
import { money } from "@/lib/format";
import { emptyLifePlan, type LifePathId, type LifePathResult } from "@/lib/calc/life-plan";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { useT } from "@/store/ui";

export function EarlyRetirementPlanPage() {
  const t = useT();
  const stored = useApp((s) => s.lifePlan);
  const plan = stored ?? emptyLifePlan();
  const { result } = useLifePlanResult();
  const [path, setPath] = useState<LifePathId>("stay");
  const active = path === "switch" ? result.switch : result.stay;
  const chart = mergeSeries(result.stay, result.switch);

  return (
    <div className="pb-10">
      <ScreenHeader title={t.reports.lpTitle} backTo="/reports/retirement" />
      <p className="px-5 pb-1 text-xs leading-5 text-muted">{t.reports.lpStartNote}</p>
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.reports.lpHint}</p>
      <SharedRetirementStrip />
      <LifePlanJobs />
      <Link to="/reports/retirement" className="mx-4 mb-3 flex min-h-11 items-center rounded-2xl bg-elevated px-4 text-sm">
        {t.reports.assumptionsOne}
      </Link>

      {result.ready ? (
        <>
          <div className="mx-4 mb-3 grid grid-cols-1 gap-2">
            {result.stay ? <PathCard title={t.reports.lpStay} row={result.stay} target={plan.personal.targetTerminalFinancialAssets} t={t} /> : null}
            {result.switch ? <PathCard title={t.reports.lpSwitch} row={result.switch} target={plan.personal.targetTerminalFinancialAssets} t={t} /> : null}
          </div>
          <SectionLabel>{t.reports.lpChart}</SectionLabel>
          <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated pt-2">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <XAxis dataKey="age" tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value, name) => [money(Number(value) || 0, "HKD"), name === "stay" ? t.reports.lpStay : t.reports.lpSwitch]}
                    labelFormatter={(age) => `${t.reports.atAge} ${age}`}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--color-line)", background: "var(--color-elevated)", fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="stay" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="switch" stroke="var(--color-income)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {result.switch ? (
            <div className="mx-4 mb-2 grid grid-cols-2 gap-2">
              <button type="button" className={cn("h-11 rounded-xl text-sm font-medium", path === "stay" ? "bg-accent text-on-accent" : "bg-elevated")} onClick={() => setPath("stay")}>
                {t.reports.lpStay}
              </button>
              <button type="button" className={cn("h-11 rounded-xl text-sm font-medium", path === "switch" ? "bg-accent text-on-accent" : "bg-elevated")} onClick={() => setPath("switch")}>
                {t.reports.lpSwitch}
              </button>
            </div>
          ) : null}
          {active ? <LifeYearList years={active.years} /> : null}
        </>
      ) : (
        <p className="mx-4 mb-3 rounded-2xl bg-elevated px-4 py-3 text-sm text-muted">{t.reports.lpNeedData}</p>
      )}

      <Disclaimer>{t.reports.lpDisclaimer}</Disclaimer>
    </div>
  );
}

function PathCard({
  title,
  row,
  target,
  t,
}: {
  title: string;
  row: LifePathResult;
  target: number | null;
  t: ReturnType<typeof useT>;
}) {
  const gap = target == null ? null : row.dwzGap;
  return (
    <div className="rounded-2xl bg-elevated p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Mini k={t.reports.lpRetireAge} v={row.retireAge == null ? "—" : String(row.retireAge)} />
        <Mini k={t.reports.lpAtRetire} v={money(row.assetsAtRetire, "HKD")} />
        <Mini k={t.reports.lpTerminal} v={money(row.terminalAssets, "HKD")} />
        <Mini k={t.reports.lpDeplete} v={row.depletes ? `${t.reports.lpDeplete} ${row.depletionAge}` : t.reports.lpNever} danger={row.depletes} />
        <Mini k={t.reports.lpMin} v={money(row.minFinancial, "HKD")} />
        {gap != null ? <Mini k={t.reports.lpDwzGap} v={`${gap >= 0 ? t.reports.lpOver : t.reports.lpUnder} ${money(Math.abs(gap), "HKD")}`} danger={gap < 0} /> : null}
      </div>
    </div>
  );
}

function Mini({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <div className="text-[11px] text-muted">{k}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", danger && "text-expense")}>{v}</div>
    </div>
  );
}

function mergeSeries(stay: LifePathResult | null, sw: LifePathResult | null) {
  const ages = new Set<number>();
  stay?.series.forEach((s) => ages.add(s.age));
  sw?.series.forEach((s) => ages.add(s.age));
  const stayMap = new Map(stay?.series.map((s) => [s.age, s.financial]));
  const swMap = new Map(sw?.series.map((s) => [s.age, s.financial]));
  return [...ages]
    .sort((a, b) => a - b)
    .map((age) => ({ age, stay: stayMap.get(age), switch: swMap.get(age) }));
}
