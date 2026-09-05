import { type ReactNode } from "react";
import { Hash, Home, MessageSquare, Plane } from "lucide-react";
import { AmountKeypad } from "@/components/amount-keypad";
import { AccountSelect } from "@/components/account-select";
import { Overlay } from "@/components/shared";
import { pickName } from "@/lib/i18n";
import { parseMoneyExpr } from "@/lib/money-expr";
import type { Account, Currency } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT, useUi } from "@/store/ui";

export type AmountField = "amount" | "dest" | "principal" | "interest";

export function ComposerHeader({
  onClose,
  onSave,
  title,
  center,
}: {
  onClose: () => void;
  onSave?: () => void;
  title?: string;
  center?: ReactNode;
}) {
  const t = useT();
  return (
    <header className="flex items-center justify-between px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
        {t.add.cancel}
      </button>
      <div className="min-w-0 flex-1 text-center">
        {center ?? <h1 className="truncate text-base font-semibold">{title}</h1>}
      </div>
      {onSave ? (
        <button type="button" className="h-11 min-w-11 px-2 text-sm font-medium text-accent" onClick={onSave}>
          {t.add.save}
        </button>
      ) : (
        <span className="inline-block min-w-11" />
      )}
    </header>
  );
}

export function TextLine({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="border-b border-line px-4 py-1.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
      />
    </div>
  );
}

export function SelectLine({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
      {label ? <span className="shrink-0 text-sm text-muted">{label}</span> : null}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none">
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ComposerShell({
  header,
  children,
  keypad,
}: {
  header: ReactNode;
  children: ReactNode;
  keypad: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      {header}
      <div className="flex-1">{children}</div>
      <div className="sticky bottom-0 z-10">{keypad}</div>
    </div>
  );
}

export function LineRow({
  leading,
  label,
  placeholder,
  amount,
  active,
  onFocusAmount,
  onPressLabel,
}: {
  leading?: ReactNode;
  label: string;
  placeholder?: string;
  amount?: string;
  active?: boolean;
  onFocusAmount?: () => void;
  onPressLabel?: () => void;
}) {
  const preview = amount ? parseMoneyExpr(amount) : null;
  return (
    <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onPressLabel}>
        {leading}
        <span className={cn("truncate text-sm", label ? "text-foreground" : "text-muted")}>{label || placeholder}</span>
      </button>
      {onFocusAmount ? (
        <button
          type="button"
          onClick={onFocusAmount}
          className={cn(
            "min-w-[5.5rem] text-right text-lg font-semibold tabular-nums",
            active ? "text-accent" : "text-foreground",
          )}
        >
          {amount || "0"}
          {preview != null && /[+\-*/]/.test(amount ?? "") ? (
            <span className="mt-0.5 block text-[11px] font-normal text-muted">= {preview}</span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

export function AccountLine({
  accounts,
  value,
  onChange,
  excludeId,
  placeholder,
  amount,
  active,
  onFocusAmount,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  excludeId?: string;
  placeholder: string;
  amount?: string;
  active?: boolean;
  onFocusAmount?: () => void;
}) {
  const locale = useUi((s) => s.locale);
  const acc = accounts.find((a) => a.id === value);
  return (
    <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none truncate text-sm">{acc ? pickName(locale, acc.name, acc.nameZh) : placeholder}</div>
        <AccountSelect
          accounts={accounts}
          value={value}
          onChange={onChange}
          excludeId={excludeId}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      {onFocusAmount ? (
        <button
          type="button"
          onClick={onFocusAmount}
          className={cn("min-w-[5.5rem] shrink-0 text-right text-lg font-semibold tabular-nums", active ? "text-accent" : "")}
        >
          {amount || "0"}
        </button>
      ) : null}
    </div>
  );
}

export function DatePaidRow({
  date,
  paid,
  onDate,
  onPaid,
}: {
  date: string;
  paid: boolean;
  onDate: (v: string) => void;
  onPaid: (v: boolean) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      <input type="date" value={date} onChange={(e) => onDate(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
      <label className="flex items-center gap-1.5 text-sm text-accent">
        {t.add.paid}
        <input type="checkbox" checked={paid} onChange={(e) => onPaid(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
      </label>
    </div>
  );
}

export function ExtraIconBar({
  noteOn,
  tripOn,
  housingOn,
  splitOn,
  showTrip,
  showHousing,
  showSplit,
  onNote,
  onTrip,
  onHousing,
  onSplit,
}: {
  noteOn?: boolean;
  tripOn?: boolean;
  housingOn?: boolean;
  splitOn?: boolean;
  showTrip?: boolean;
  showHousing?: boolean;
  showSplit?: boolean;
  onNote?: () => void;
  onTrip?: () => void;
  onHousing?: () => void;
  onSplit?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {onNote ? (
        <IconBtn active={noteOn} label="note" onClick={onNote}>
          <MessageSquare className="size-5" />
        </IconBtn>
      ) : null}
      {showTrip ? (
        <IconBtn active={tripOn} label="trip" onClick={onTrip}>
          <Plane className="size-5" />
        </IconBtn>
      ) : null}
      {showHousing ? (
        <IconBtn active={housingOn} label="housing" onClick={onHousing}>
          <Home className="size-5" />
        </IconBtn>
      ) : null}
      {showSplit ? (
        <IconBtn active={splitOn} label="split" onClick={onSplit}>
          <Hash className="size-5" />
        </IconBtn>
      ) : null}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  active,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn("grid size-11 place-items-center rounded-lg", active ? "text-accent" : "text-faint")}
    >
      {children}
    </button>
  );
}

export function NoteSheet({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Overlay open={open} onClose={onClose} title={t.add.note} variant="sheet" layer="stack">
      <div className="px-5 pb-8">
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
        <button type="button" className="mt-4 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={onClose}>
          {t.common.done}
        </button>
      </div>
    </Overlay>
  );
}

export function TripSheet({
  open,
  value,
  options,
  onChange,
  onClose,
}: {
  open: boolean;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Overlay open={open} onClose={onClose} title={t.add.trip} variant="sheet" layer="stack">
      <div className="px-5 pb-8">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-lg bg-elevated px-3">
          <option value="">{t.reports.noneTrip}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" className="mt-4 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={onClose}>
          {t.common.done}
        </button>
      </div>
    </Overlay>
  );
}

export function ActiveKeypad({
  field,
  amount,
  dest,
  principal,
  interest,
  setAmount,
  setDest,
  setPrincipal,
  setInterest,
  currency,
  onCurrency,
}: {
  field: AmountField;
  amount: string;
  dest: string;
  principal: string;
  interest: string;
  setAmount: (v: string) => void;
  setDest: (v: string) => void;
  setPrincipal: (v: string) => void;
  setInterest: (v: string) => void;
  currency: Currency;
  onCurrency: (c: Currency) => void;
}) {
  const value = field === "dest" ? dest : field === "principal" ? principal : field === "interest" ? interest : amount;
  const set =
    field === "dest" ? setDest : field === "principal" ? setPrincipal : field === "interest" ? setInterest : setAmount;
  return <AmountKeypad value={value} onChange={set} currency={currency} onCurrency={onCurrency} />;
}
