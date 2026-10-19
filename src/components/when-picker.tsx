import { useEffect, useRef } from "react";
import { from12h, todayISO, to12h, whenDayLabel } from "@/lib/format";
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
      className={cn("h-[180px] snap-y snap-mandatory overflow-y-auto", wide ? "min-w-0 flex-[1.7]" : "w-12 shrink-0")}
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
          className={cn("flex h-9 snap-center items-center justify-center text-[15px]", i === index ? "font-medium text-white" : "text-[#6b6b6b]")}
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
}: {
  date: string;
  time: string;
  locale: "en" | "zh-HK";
  onDate: (iso: string) => void;
  onTime: (time: string) => void;
}) {
  const today = todayISO();
  const days = Array.from({ length: 455 }, (_, i) => shiftDay(today, i - 90));
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
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-white/10" />
      <div className="flex">
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
