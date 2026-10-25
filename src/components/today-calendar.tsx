import { cn } from "@/lib/utils";

export function WeekStrip({
  days,
  selected,
  today,
  labels,
  active,
  planned,
  onSelect,
}: {
  days: { iso: string; day: number; label: string }[];
  selected: string;
  today: string;
  labels?: string[];
  active: Set<string>;
  planned: Set<string>;
  onSelect: (iso: string) => void;
}) {
  return (
    <div className="mx-4 mb-2 grid grid-cols-7">
      {days.map((c, i) => (
        <button
          key={c.iso}
          type="button"
          onClick={() => onSelect(c.iso)}
          className="flex min-h-11 flex-col items-center justify-center"
        >
          <span className="text-[11px] text-muted">{labels?.[i] ?? c.label}</span>
          <span
            className={cn(
              "relative mt-0.5 flex size-11 items-center justify-center rounded-full text-sm",
              c.iso === selected && "bg-accent font-semibold text-on-accent",
              c.iso === today && c.iso !== selected && "font-semibold text-accent",
            )}
          >
            {c.day}
            {active.has(c.iso) ? (
              <span className={cn("absolute bottom-1 size-1.5 rounded-full", c.iso === selected ? "bg-on-accent" : "bg-accent")} />
            ) : planned.has(c.iso) ? (
              <span className={cn("absolute bottom-1 size-2 rounded-full border-2", c.iso === selected ? "border-on-accent" : "border-accent")} />
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

export function MonthCalendar({
  weekdays,
  cells,
  selected,
  today,
  active,
  planned,
  onSelect,
}: {
  weekdays: string[];
  cells: ({ iso: string; day: number } | null)[];
  selected: string;
  today: string;
  active: Set<string>;
  planned: Set<string>;
  onSelect: (iso: string) => void;
}) {
  return (
    <div className="mx-4 mb-3 rounded-xl bg-elevated px-2 py-3">
      <div className="grid grid-cols-7 text-center text-xs text-muted">
        {weekdays.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7">
        {cells.map((c, i) =>
          c ? (
            <button
              key={c.iso}
              type="button"
              onClick={() => onSelect(c.iso)}
              className={cn(
                "relative mx-auto flex size-11 flex-col items-center justify-center rounded-full text-sm",
                c.iso === selected && "bg-accent font-semibold text-on-accent",
                c.iso === today && c.iso !== selected && "font-semibold text-accent",
              )}
            >
              {c.day}
              {active.has(c.iso) ? (
                <span className={cn("absolute bottom-1 size-1.5 rounded-full", c.iso === selected ? "bg-on-accent" : "bg-accent")} />
              ) : planned.has(c.iso) ? (
                <span className={cn("absolute bottom-1 size-2 rounded-full border-2", c.iso === selected ? "border-on-accent" : "border-accent")} />
              ) : null}
            </button>
          ) : (
            <div key={`e-${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

export function weekDays(iso: string, firstDay: 0 | 1): { iso: string; day: number }[] {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const offset = (date.getDay() - firstDay + 7) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    const isoDay = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    return { iso: isoDay, day: x.getDate() };
  });
}
