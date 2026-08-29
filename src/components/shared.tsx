import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { cashflowSide } from "@/lib/calc/ledger";
import type { Transaction } from "@/lib/types";
import { useT, useUi } from "@/store/ui";
import { useApp } from "@/store/app";

export function ScreenHeader({
  title,
  large,
  backTo,
  right,
}: {
  title: string;
  large?: boolean;
  backTo?: string;
  right?: ReactNode;
}) {
  if (backTo) {
    return (
      <header className="relative flex items-center justify-between px-2 pb-2 pt-[max(0.4rem,env(safe-area-inset-top))]">
        <Link to={backTo as never} aria-label="Back" className="grid size-11 shrink-0 place-items-center text-accent">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="absolute left-1/2 max-w-[58%] -translate-x-1/2 truncate text-center text-lg font-semibold tracking-tight">
          {title}
        </h1>
        <div className="flex min-h-11 min-w-11 items-center justify-end pr-2">{right}</div>
      </header>
    );
  }
  return (
    <header className="flex items-end justify-between px-5 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))]">
      <h1 className={cn("font-semibold tracking-tight", large ? "text-3xl" : "text-xl")}>{title}</h1>
      {right}
    </header>
  );
}

export function Hairline() {
  return <div className="h-px bg-line" />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="px-5 pb-1 pt-5 text-sm font-medium text-muted">{children}</h2>;
}

export function Metric({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted">{label}</div>
      <div
        className={cn(
          "mt-1 truncate text-base font-semibold tabular-nums",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  size = 40,
  stroke = 3,
  tone = "income",
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "income" | "watch" | "expense";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1.2, value));
  const color = tone === "expense" ? "var(--color-expense)" : tone === "watch" ? "var(--color-watch)" : "var(--color-income)";
  return (
    <svg width={size} height={size} className="block -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ring-track)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${c * Math.min(1, pct)} ${c}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="mx-4 grid grid-cols-2 rounded-lg bg-elevated p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "h-9 rounded-md text-sm font-medium",
            value === o.id ? "bg-background text-foreground shadow-sm" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function InfoButton({ k }: { k: string }) {
  const set = useUi((s) => s.setInfoKey);
  return (
    <button type="button" aria-label="info" onClick={() => set(k)} className="grid size-8 place-items-center text-faint">
      <Info className="size-4" />
    </button>
  );
}

export function Overlay({
  open,
  onClose,
  children,
  title,
  variant = "sheet",
  layer = "base",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  variant?: "sheet" | "page";
  layer?: "base" | "stack";
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const page = variant === "page";
  const zClass = page
    ? layer === "stack"
      ? "z-[98]"
      : "z-[92]"
    : layer === "stack"
      ? "z-[96]"
      : "z-[90]";
  const sheet = (
    <div className={cn("fixed inset-0 grid", zClass, page ? "bg-background" : "place-items-end md:place-items-center")}>
      {page ? null : (
        <button type="button" className="absolute inset-0 scrim" aria-label={t.common.close} onClick={onClose} />
      )}
      <div
        className={cn(
          "relative z-[81] w-full overflow-y-auto bg-background",
          page
            ? "h-dvh max-h-dvh pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "max-h-[92dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] md:max-w-md md:rounded-2xl",
        )}
      >
        {title ? (
          <div className="flex items-center justify-between px-5 pb-2 pt-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="text-sm text-accent">
              {t.common.close}
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}

export function StatusChip({ status }: { status: "on-track" | "watch" | "at-risk" }) {
  const locale = useUi((s) => s.locale);
  const label =
    status === "on-track"
      ? locale === "zh-HK"
        ? "進度良好"
        : "On track"
      : status === "watch"
        ? locale === "zh-HK"
          ? "需留意"
          : "Watch"
        : locale === "zh-HK"
          ? "有風險"
          : "At risk";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "on-track" && "bg-success-soft text-income",
        status === "watch" && "bg-watch-soft text-watch",
        status === "at-risk" && "bg-expense-soft text-expense",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "on-track" && "bg-income",
          status === "watch" && "bg-watch",
          status === "at-risk" && "bg-expense",
        )}
      />
      {label}
    </span>
  );
}

export function ProgressBar({ value, tone = "income" }: { value: number; tone?: "income" | "watch" | "expense" }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ring-track">
      <div
        className={cn(
          "h-full rounded-full",
          tone === "expense" && "bg-expense",
          tone === "watch" && "bg-watch",
          tone === "income" && "bg-income",
        )}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

export function TransactionRow({ tx, onClick, showDate }: { tx: Transaction; onClick?: () => void; showDate?: boolean }) {
  const locale = useUi((s) => s.locale);
  const cats = useApp((s) => s.categories);
  const accs = useApp((s) => s.accounts);
  const cat = cats.find((c) => c.id === tx.categoryId);
  const acc = accs.find((a) => a.id === tx.accountId);
  const side = cashflowSide(tx);
  const spend = tx.type === "expense" || Boolean(tx.countsAsExpense);
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-5 py-3 text-left">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{pickName(locale, tx.payee, tx.payeeZh)}</div>
        <div className="truncate text-xs text-muted">
          {cat ? pickName(locale, cat.name, cat.nameZh) : acc ? pickName(locale, acc.name, acc.nameZh) : "—"}
          {showDate ? ` · ${tx.date}` : ""}
          {tx.planned ? (locale === "zh-HK" ? " · 計劃" : " · planned") : ""}
        </div>
      </div>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          side === "income" || tx.type === "income" ? "text-income" : "text-foreground",
        )}
      >
        {money(spend ? -tx.amount : tx.type === "income" ? tx.amount : tx.amount, tx.currency, { sign: true })}
      </span>
    </button>
  );
}

export function Group({ children }: { children: ReactNode }) {
  return <div className="mx-4 overflow-hidden rounded-xl bg-elevated">{children}</div>;
}

export function Row({
  title,
  to,
  chevron,
  icon,
  onClick,
}: {
  title: string;
  to?: string;
  chevron?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {icon ? <span className="text-accent">{icon}</span> : null}
      <span className="flex-1 text-sm">{title}</span>
      {chevron ? <ChevronRight className="size-4 text-faint" /> : null}
    </div>
  );
  if (to) {
    return (
      <Link to={to as never} className="block">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {inner}
    </button>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="px-5 py-4 text-xs leading-relaxed text-faint">{children}</p>;
}
