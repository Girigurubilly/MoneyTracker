import { useEffect, useRef, useState } from "react";
import { from12h, todayISO, to12h, whenDayLabel, whenStamp } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROW = 36;
const PAD = ROW * 2;

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function Wheel({
  labels,
  index,
  onChange,
  wide,
}: {
  labels: string[];
  index: number;
  onChange: (index: number) => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = index * ROW;
  }, [index]);
  return (
    <div
      ref={ref}
      className={cn("h-[180px] snap-y snap-mandatory overflow-y-auto [&::-webkit-scrollbar]:hidden", wide ? "min-w-0 flex-[1.7]" : "w-14 shrink-0")}
      style={{ scrollbarWidth: "none" }}
      onScroll={(event) => {
        const el = event.currentTarget;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          const next = Math.max(0, Math.min(labels.length - 1, Math.round(el.scrollTop / ROW)));
          if (next !== index) onChange(next);
        }, 80);
      }}
    >
      <div style={{ height: PAD }} />
      {labels.map((label, i) => (
        <div
          key={`${label}-${i}`}
          className={cn(
            "flex h-9 snap-center items-center justify-center text-[17px]",
            i === index ? "font-semibold text-foreground" : "text-muted",
          )}
        >
          {label}
        </div>
      ))}
      <div style={{ height: PAD }} />
    </div>
  );
}

export function WhenPicker({
  date,
  time,
  locale,
  onDate,
  onTime,
  min,
  max,
}: {
  date: string;
  time: string;
  locale: "en" | "zh-HK";
  onDate: (iso: string) => void;
  onTime: (time: string) => void;
  min?: string;
  max?: string;
}) {
  const today = todayISO();
  const from = min || shiftDay(today, -90);
  const to = max || shiftDay(today, 364);
  const days = daysBetween(date < from ? date : from, date > to ? date : to);
  const dayIndex = Math.max(0, days.indexOf(date));
  const clock = to12h(time);
  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const periods = locale === "zh-HK" ? ["上午", "下午"] : ["AM", "PM"];
  function setClock(ap: 0 | 1, hour: number, minute: number) {
    onTime(from12h(ap, hour, minute));
  }
  return (
    <div className="relative mx-2 mb-2">
      <div className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-9 -translate-y-1/2 rounded-lg bg-[color-mix(in_srgb,var(--color-foreground)_14%,transparent)]" />
      <div className="relative z-10 flex">
        <Wheel
          wide
          labels={days.map((iso) => whenDayLabel(iso, today, locale))}
          index={dayIndex}
          onChange={(index) => onDate(days[index] || date)}
        />
        <Wheel labels={periods} index={clock.ap} onChange={(index) => setClock(index === 1 ? 1 : 0, clock.hour, clock.minute)} />
        <Wheel labels={hours} index={clock.hour - 1} onChange={(index) => setClock(clock.ap, index + 1, clock.minute)} />
        <Wheel labels={minutes} index={clock.minute} onChange={(index) => setClock(clock.ap, clock.hour, index)} />
      </div>
    </div>
  );
}

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  while (cursor <= to && out.length < 800) {
    out.push(cursor);
    cursor = shiftDay(cursor, 1);
  }
  return out.length ? out : [from];
}

export function WhenField({
  date,
  time,
  locale,
  onDate,
  onTime,
  min,
  max,
}: {
  date: string;
  time: string;
  locale: "en" | "zh-HK";
  onDate: (iso: string) => void;
  onTime: (time: string) => void;
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button type="button" className="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-accent" onClick={() => setOpen((value) => !value)}>
        {whenStamp(date, time, locale)}
      </button>
      {open ? <WhenPicker date={date} time={time} locale={locale} onDate={onDate} onTime={onTime} min={min} max={max} /> : null}
    </div>
  );
}
