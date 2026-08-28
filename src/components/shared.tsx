import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowLeftRight,
  BookOpen,
  Briefcase,
  Brush,
  Building2,
  Car,
  CircleDollarSign,
  Clock,
  Coins,
  CupSoda,
  FileText,
  Film,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Info,
  Landmark,
  Map,
  PiggyBank,
  Plane,
  RefreshCw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tent,
  Ticket,
  TrainFront,
  TrendingUp,
  Umbrella,
  User,
  UtensilsCrossed,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import type { CategoryIconName, Transaction, TxType } from "@/lib/types";
import { accountById as findAccount, categoryById as findCategory, useApp } from "@/store/app";
import { useT, useUi } from "@/store/ui";

const iconMap: Record<CategoryIconName, typeof Home> = {
  utensils: UtensilsCrossed,
  shopping: ShoppingCart,
  train: TrainFront,
  car: Car,
  home: Home,
  wrench: Wrench,
  zap: Zap,
  wifi: Smartphone,
  heart: Heart,
  shield: Shield,
  graduation: GraduationCap,
  film: Film,
  sparkles: Sparkles,
  plane: Plane,
  building: Building2,
  map: Map,
  ticket: Ticket,
  umbrella: Umbrella,
  bag: ShoppingBag,
  landmark: Landmark,
  piggy: PiggyBank,
  repeat: RefreshCw,
  wallet: Wallet,
  gift: Gift,
  coins: Coins,
  trending: TrendingUp,
  briefcase: Briefcase,
  gamepad: Gamepad2,
  user: User,
  broom: Brush,
  tent: Tent,
  cup: CupSoda,
  book: BookOpen,
  file: FileText,
  clock: Clock,
  dollar: CircleDollarSign,
};

export function CategoryGlyph({
  name,
  className,
}: {
  name?: CategoryIconName;
  className?: string;
}) {
  const Icon = name ? iconMap[name] : Wallet;
  return <Icon className={cn("size-5", className)} strokeWidth={1.6} />;
}

export function AmountPill({
  type,
  amount,
  currency,
}: {
  type: TxType;
  amount: number;
  currency: Transaction["currency"];
}) {
  let text: string;
  if (currency === "MILES") {
    const n = Math.round(amount).toLocaleString("en-HK");
    text = type === "income" ? `+${n}` : type === "expense" ? `−${n}` : n;
  } else if (type === "transfer") {
    text = money(Math.abs(amount), currency);
  } else if (type === "expense") {
    text = money(-Math.abs(amount), currency, { sign: true });
  } else {
    text = money(Math.abs(amount), currency, { sign: true });
  }
  return (
    <span
      className={cn(
        "inline-flex min-h-8 min-w-16 items-center justify-center rounded-lg px-2.5 text-sm font-semibold tabular-nums",
        type === "income" && "bg-pill-income text-income",
        type === "expense" && "bg-pill-expense text-expense",
        type === "transfer" && "bg-pill-transfer text-transfer",
        type === "miles" && "bg-pill-miles text-miles",
      )}
    >
      {text}
    </span>
  );
}

export function ProgressRing({
  value,
  size = 36,
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
  const clamped = Math.min(1, Math.max(0, value));
  const offset = c - clamped * c;
  const color =
    tone === "expense" ? "var(--expense)" : tone === "watch" ? "var(--watch)" : "var(--income)";
  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--ring-track)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function StatusChip({
  status,
}: {
  status: "on-track" | "watch" | "at-risk";
}) {
  const t = useT();
  const label =
    status === "on-track"
      ? t.status.onTrack
      : status === "watch"
        ? t.status.watch
        : t.status.atRisk;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        status === "on-track" && "bg-income/15 text-income",
        status === "watch" && "bg-watch/15 text-watch",
        status === "at-risk" && "bg-expense/15 text-expense",
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

export function SectionLabel({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pb-1 pt-5">
      <h2 className="text-sm font-medium text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Hairline() {
  return <div className="h-px bg-line" />;
}

export function ScreenHeader({
  title,
  backTo,
  right,
  large,
}: {
  title: string;
  backTo?: string;
  right?: ReactNode;
  large?: boolean;
}) {
  const t = useT();
  return (
    <header className="flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {backTo ? (
        <Link
          to={backTo as "/"}
          className="inline-flex size-11 items-center justify-center rounded-full text-accent"
          aria-label={t.common.back}
        >
          <ArrowLeft className="size-5" strokeWidth={1.8} />
        </Link>
      ) : null}
      <h1
        className={cn(
          "min-w-0 flex-1 font-semibold tracking-tight text-foreground",
          large ? "text-3xl leading-tight" : "text-lg",
          backTo && !large && "text-center",
        )}
      >
        {title}
      </h1>
      <div className="flex min-w-11 items-center justify-end gap-1">{right}</div>
    </header>
  );
}

export function TransactionRow({
  tx,
  showDate,
  onClick,
}: {
  tx: Transaction;
  showDate?: boolean;
  onClick?: () => void;
}) {
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const cat = findCategory(tx.categoryId, categories);
  const account = findAccount(tx.accountId, accounts);
  const milesType = tx.milesType;
  const displayType: TxType =
    tx.type === "miles"
      ? milesType === "earn"
        ? "income"
        : milesType === "burn" || milesType === "expiry"
          ? "expense"
          : "miles"
      : tx.type === "transfer" && tx.countsAsExpense
        ? "expense"
        : tx.type;
  const iconName: CategoryIconName | undefined =
    tx.type === "miles" ? "plane" : tx.type === "transfer" ? "repeat" : cat?.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-3 text-left"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated text-foreground ring-1 ring-line">
        {tx.type === "transfer" ? (
          <ArrowLeftRight className="size-5" strokeWidth={1.6} />
        ) : (
          <CategoryGlyph name={iconName} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-foreground">
          {pickName(locale, tx.payee, tx.payeeZh)}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {showDate ? (
            <>
              {locale === "zh-HK"
                ? `${Number(tx.date.slice(5, 7))}月 ${Number(tx.date.slice(8, 10))}`
                : tx.date.slice(5)}
              {" · "}
            </>
          ) : null}
          {account ? pickName(locale, account.name, account.nameZh) : null}
          {tx.planned ? (locale === "zh-HK" ? " · 計劃" : " · planned") : null}
        </span>
      </span>
      <AmountPill type={displayType} amount={tx.amount} currency={tx.currency} />
    </button>
  );
}

export function Row({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  to,
  chevron,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  to?: string;
  chevron?: boolean;
}) {
  const inner = (
    <>
      {icon ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-background text-foreground">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-foreground">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="shrink-0 text-[15px] tabular-nums text-muted">{trailing}</span>
      ) : null}
      {chevron ? (
        <span className="pl-1 text-lg leading-none text-faint" aria-hidden>
          ›
        </span>
      ) : null}
    </>
  );
  const cls = "flex w-full items-center gap-3 px-5 py-3 text-left";
  if (to) {
    return (
      <Link to={to as "/"} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function Group({ children }: { children: ReactNode }) {
  return (
    <div className="mx-4 overflow-hidden rounded-xl bg-elevated">{children}</div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-4 text-xs leading-relaxed text-muted">{children}</p>
  );
}

export function InfoButton({ k }: { k: string }) {
  const t = useT();
  const setInfoKey = useUi((s) => s.setInfoKey);
  return (
    <button
      type="button"
      aria-label={t.common.info}
      onClick={() => setInfoKey(k)}
      className="inline-flex size-8 items-center justify-center rounded-full text-muted"
    >
      <Info className="size-4" strokeWidth={1.8} />
    </button>
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
    <div className="mx-4 grid auto-cols-fr grid-flow-col rounded-lg bg-line p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "h-8 rounded-md text-sm font-medium transition-colors duration-150",
            value === o.id ? "bg-elevated text-foreground shadow-sm" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense" | "muted";
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted">{label}</div>
      <div
        className={cn(
          "mt-1 text-base font-semibold tabular-nums leading-snug",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
          !tone && "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function Overlay({
  open,
  onClose,
  children,
  title,
  variant = "sheet",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  variant?: "sheet" | "page";
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
  const sheet = (
    <div
      className={cn(
        "fixed inset-0 grid",
        page ? "z-[92] bg-background" : "z-[90] place-items-end md:place-items-center",
      )}
    >
      {page ? null : (
        <button
          type="button"
          className="absolute inset-0 scrim"
          aria-label={t.common.close}
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          "relative z-[81] w-full overflow-y-auto bg-background",
          page
            ? "h-dvh max-h-dvh pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "max-h-[92dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] md:max-w-md md:rounded-2xl",
        )}
      >
        {page ? null : <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" />}
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

export { Globe };
