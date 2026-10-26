import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AmountKeypad } from "@/components/amount-keypad";
import { Overlay } from "@/components/shared";
import { money } from "@/lib/format";
import { resolveSignedAmountInput } from "@/lib/money-expr";
import { cn } from "@/lib/utils";
import type { EnoughKind } from "@/lib/calc/retire-view";
import { useT } from "@/store/ui";

export function prefersReducedMotion(): boolean {
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
            className="tr-press grid size-9 place-items-center rounded-lg bg-background text-lg font-medium"
            aria-label="−"
            onClick={() => onDraft(Math.max(min, value - 1))}
          >
            −
          </button>
          <span className="min-w-[2.5rem] text-center text-lg font-semibold tabular-nums">{value}</span>
          <button
            type="button"
            className="tr-press grid size-9 place-items-center rounded-lg bg-background text-lg font-medium"
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
              "tr-press rt-chip-pill h-8 rounded-full px-3 text-[11px] font-medium",
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
          <button type="button" className="tr-press h-11 flex-1 rounded-xl bg-background text-sm font-medium" onClick={onCancel}>
            {t.common.cancel}
          </button>
          <button type="button" className="tr-press h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={onApply}>
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
              "tr-press rt-chip-pill relative h-9 shrink-0 rounded-full px-3 text-xs font-medium",
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
          <button type="button" className="tr-press h-10 flex-1 rounded-xl bg-elevated text-sm font-medium" onClick={onCancel}>
            {t.common.cancel}
          </button>
          <button type="button" className="tr-press h-10 flex-1 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={onApply}>
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


/** Money amount editor: sheet + keypad (mobile-friendly retirement config). */
export function MoneyPadSheet({
  open,
  title,
  initial,
  allowEmpty,
  onClose,
  onCommit,
}: {
  open: boolean;
  title: string;
  initial: number | null;
  allowEmpty?: boolean;
  onClose: () => void;
  onCommit: (n: number | null) => void;
}) {
  const t = useT();
  const [raw, setRaw] = useState(initial == null || initial === 0 ? "" : String(initial));
  useEffect(() => {
    if (open) setRaw(initial == null || initial === 0 ? "" : String(initial));
  }, [open, initial]);
  function finish() {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (allowEmpty) onCommit(null);
      else onCommit(0);
      onClose();
      return;
    }
    const n = resolveSignedAmountInput(trimmed);
    if (Number.isFinite(n)) onCommit(n);
    onClose();
  }
  const preview = (() => {
    const trimmed = raw.trim();
    if (!trimmed) return allowEmpty ? "—" : money(0, "HKD");
    const n = resolveSignedAmountInput(trimmed);
    return Number.isFinite(n) ? money(n, "HKD") : "—";
  })();
  return (
    <Overlay open={open} onClose={onClose} title={title} variant="sheet" layer="stack">
      <div className="px-5 pb-2">
        <div className="rounded-2xl bg-elevated px-4 py-4 text-center">
          <div className="text-3xl font-semibold tabular-nums tracking-tight">{preview}</div>
          <div className="mt-1 text-[11px] text-muted">{raw || "0"}</div>
        </div>
        <button
          type="button"
          className="tr-press mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent"
          onClick={finish}
        >
          {t.common.done}
        </button>
      </div>
      <AmountKeypad value={raw} onChange={setRaw} currency="HKD" />
    </Overlay>
  );
}

/** Config number row: money opens keypad sheet; ages/pcts use large inline field + Done. */
export function ConfigNumRow({
  label,
  value,
  onCommit,
  money: asMoney,
  blankZero,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  money?: boolean;
  blankZero?: boolean;
}) {
  const t = useT();
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value));

  function openEdit() {
    if (asMoney) {
      setSheet(true);
      return;
    }
    setRaw(String(value));
    setEditing(true);
  }

  function commitPlain() {
    setEditing(false);
    const n = Number(raw);
    if (Number.isFinite(n)) onCommit(n);
  }

  const display = blankZero && !value ? "—" : asMoney ? money(value, "HKD") : value;

  return (
    <>
      <div className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5">
        <span className="min-w-0 flex-1 text-sm">{label}</span>
        {editing && !asMoney ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              inputMode="decimal"
              value={raw}
              className="h-10 w-28 rounded-lg bg-background px-2.5 text-right text-base tabular-nums outline-none ring-1 ring-accent/40"
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitPlain();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <button type="button" className="tr-press h-10 rounded-lg bg-accent px-3 text-xs font-semibold text-on-accent" onClick={commitPlain}>
              {t.common.done}
            </button>
          </div>
        ) : (
          <button type="button" className="tr-press h-10 min-w-[5.5rem] rounded-lg bg-background px-3 text-right text-sm font-medium tabular-nums" onClick={openEdit}>
            {display}
          </button>
        )}
      </div>
      {asMoney ? (
        <MoneyPadSheet
          open={sheet}
          title={label}
          initial={value}
          onClose={() => setSheet(false)}
          onCommit={(n) => onCommit(n ?? 0)}
        />
      ) : null}
    </>
  );
}

/** Nullable variant for life-plan fields (blank allowed). */
export function ConfigNullNum({
  label,
  value,
  onCommit,
  money: asMoney,
}: {
  label: string;
  value: number | null;
  onCommit: (n: number | null) => void;
  money?: boolean;
}) {
  const t = useT();
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value == null ? "" : String(value));

  function openEdit() {
    if (asMoney) {
      setSheet(true);
      return;
    }
    setRaw(value == null ? "" : String(value));
    setEditing(true);
  }

  function commitPlain() {
    setEditing(false);
    const trimmed = raw.trim();
    if (!trimmed) onCommit(null);
    else {
      const n = Number(trimmed);
      if (Number.isFinite(n)) onCommit(n);
    }
  }

  const display = value == null ? "—" : asMoney ? money(value, "HKD") : value;

  return (
    <>
      <div className="flex min-h-11 w-full items-center justify-between gap-3 px-4">
        <span className="min-w-0 flex-1 text-sm">{label}</span>
        {editing && !asMoney ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              inputMode="decimal"
              value={raw}
              className="h-10 w-28 rounded-lg bg-background px-2.5 text-right text-base tabular-nums outline-none ring-1 ring-accent/40"
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitPlain();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <button type="button" className="tr-press h-10 rounded-lg bg-accent px-3 text-xs font-semibold text-on-accent" onClick={commitPlain}>
              {t.common.done}
            </button>
          </div>
        ) : (
          <button type="button" className="tr-press h-10 min-w-[5.5rem] rounded-lg bg-background px-3 text-right text-sm tabular-nums text-muted" onClick={openEdit}>
            {display}
          </button>
        )}
      </div>
      {asMoney ? (
        <MoneyPadSheet
          open={sheet}
          title={label}
          initial={value}
          allowEmpty
          onClose={() => setSheet(false)}
          onCommit={onCommit}
        />
      ) : null}
    </>
  );
}

export function ConfigFold({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [on, setOn] = useState(defaultOpen);
  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated">
      <button type="button" className="tr-press flex min-h-11 w-full items-center justify-between px-4 text-left" onClick={() => setOn(!on)}>
        <span className="text-sm font-medium">{title}</span>
<ChevronDown className={cn("size-4 text-muted transition", on && "rotate-180")} />
      </button>
      {on ? (
        <div className="rt-fold border-t border-line">
          <div className="rt-fold-inner">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
