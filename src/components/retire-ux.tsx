import { useEffect, useRef, useState, type ReactNode } from "react";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EnoughKind } from "@/lib/calc/retire-view";
import { useT } from "@/store/ui";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Count from previous → next; skip while `paused` (e.g. slider drag). */
export function useCountUp(value: number, paused: boolean, ms = 320): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    if (paused || prefersReducedMotion()) {
      setShown(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    if (from === value) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, paused, ms]);
  return shown;
}

export function EnoughRing({ kind, size = 28 }: { kind: EnoughKind; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const fill = kind === "enough" ? c : kind === "short" ? c * 0.45 : 0;
  const color = kind === "enough" ? "var(--color-income)" : kind === "short" ? "var(--color-expense)" : "var(--color-muted)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ring-track)" strokeWidth={3} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - fill}
        className="rt-ring"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function StickyConclusionBar({
  kind,
  verdict,
  retireAge,
  gap,
  planEndAge,
  dragging,
}: {
  kind: EnoughKind;
  verdict: string;
  retireAge: number;
  gap: number;
  planEndAge: number;
  dragging: boolean;
}) {
  const t = useT();
  const shownGap = useCountUp(gap, dragging, 320);
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-background/95 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center gap-2.5">
        <EnoughRing kind={kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span
              className={cn(
                "font-semibold",
                kind === "enough" && "text-income",
                kind === "short" && "text-expense",
                kind === "setup" && "text-muted",
              )}
            >
              {verdict}
            </span>
            <span className="text-muted">·</span>
            <span className="tabular-nums text-muted">
              {t.reports.retireAge} {retireAge}
            </span>
            {kind === "setup" ? null : (
              <>
                <span className="text-muted">·</span>
                <span className={cn("font-medium tabular-nums", shownGap < 0 ? "text-expense" : "text-income")}>
                  {money(shownGap, "HKD", { sign: true })}
                </span>
                <span className="text-muted">·</span>
                <span className="tabular-nums text-muted">{t.reports.lastsUntil.replace("{age}", String(planEndAge))}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RetireAgeSlider({
  value,
  committed,
  min = 40,
  max = 75,
  onDraft,
  onDragChange,
  onApply,
  onCancel,
}: {
  value: number;
  committed: number;
  min?: number;
  max?: number;
  onDraft: (n: number) => void;
  onDragChange: (dragging: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const dirty = value !== committed;
  const chips = [55, 60, 65].filter((a) => a >= min && a <= max);
  return (
    <div className="mx-4 mb-3 rounded-2xl bg-elevated p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{t.reports.retireAge}</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg bg-background text-lg font-medium"
            aria-label="−"
            onClick={() => onDraft(Math.max(min, value - 1))}
          >
            −
          </button>
          <span className="min-w-[2.5rem] text-center text-lg font-semibold tabular-nums">{value}</span>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg bg-background text-lg font-medium"
            aria-label="+"
            onClick={() => onDraft(Math.min(max, value + 1))}
          >
            +
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        className="mt-3 w-full accent-[var(--color-accent)]"
        onPointerDown={() => onDragChange(true)}
        onPointerUp={() => onDragChange(false)}
        onPointerCancel={() => onDragChange(false)}
        onChange={(e) => onDraft(Number(e.target.value))}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((a) => (
          <button
            key={a}
            type="button"
            className={cn(
              "rt-chip-pill h-8 rounded-full px-3 text-[11px] font-medium",
              value === a ? "bg-accent text-on-accent" : "bg-background text-muted",
            )}
            onClick={() => onDraft(a)}
          >
            {a}
          </button>
        ))}
      </div>
      {dirty ? (
        <div className="mt-3 flex gap-2">
          <button type="button" className="h-11 flex-1 rounded-xl bg-background text-sm font-medium" onClick={onCancel}>
            {t.common.cancel}
          </button>
          <button type="button" className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={onApply}>
            {t.reports.applyRetireAge} · {value}
          </button>
        </div>
      ) : null}
      {dirty ? <p className="mt-2 text-center text-[11px] text-muted">{t.reports.agePreview}</p> : null}
    </div>
  );
}

export type ScenarioId = "keep65" | "retire55" | "part60";

export function ScenarioChips({
  active,
  partTimeReady,
  onPick,
  onApply,
  onCancel,
}: {
  active: ScenarioId | null;
  partTimeReady: boolean;
  onPick: (id: ScenarioId) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const items: { id: ScenarioId; label: string }[] = [
    { id: "keep65", label: t.reports.scenarioKeep65 },
    { id: "retire55", label: t.reports.scenarioRetire55 },
    { id: "part60", label: t.reports.scenarioPart60 },
  ];
  return (
    <div className="mx-4 mb-3">
      <div className="relative flex gap-1.5 overflow-x-auto pb-1">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={cn(
              "rt-chip-pill relative h-9 shrink-0 rounded-full px-3 text-xs font-medium",
              active === it.id ? "bg-accent text-on-accent" : "bg-elevated text-muted",
            )}
            onClick={() => onPick(it.id)}
          >
            {it.label}
          </button>
        ))}
      </div>
      {active === "part60" && !partTimeReady ? (
        <p className="mt-2 text-[11px] leading-4 text-watch">{t.reports.scenarioPartNeed}</p>
      ) : null}
      {active && !(active === "part60" && !partTimeReady) ? (
        <div className="mt-2 flex gap-2">
          <button type="button" className="h-10 flex-1 rounded-xl bg-elevated text-sm font-medium" onClick={onCancel}>
            {t.common.cancel}
          </button>
          <button type="button" className="h-10 flex-1 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={onApply}>
            {t.reports.applyRetireAge}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Prefer 萬 for HK; English uses M/k. */
export function formatAxisWan(n: number, locale: string): string {
  if (locale === "zh-HK") {
    const wan = n / 10_000;
    if (Math.abs(wan) >= 100) return `${Math.round(wan)}萬`;
    return `${wan.toFixed(wan >= 10 ? 0 : 1)}萬`;
  }
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

export function ChartScrubLabel(opts: {
  age: number;
  retireAge: number;
  corpus: number;
  locale: string;
  workingLabel: string;
  retiredLabel: string;
  ageEndLabel: string;
}): string {
  const phase = opts.age < opts.retireAge ? opts.workingLabel : opts.retiredLabel;
  const amt = opts.locale === "zh-HK" ? formatAxisWan(opts.corpus, "zh-HK") : money(opts.corpus, "HKD");
  return opts.ageEndLabel.replace("{age}", String(opts.age)).replace("{phase}", phase).replace("{amount}", amt);
}

export function Enter({ delay, children, className }: { delay?: boolean; children: ReactNode; className?: string }) {
  return <div className={cn(delay ? "rt-enter-delay" : "rt-enter", className)}>{children}</div>;
}
