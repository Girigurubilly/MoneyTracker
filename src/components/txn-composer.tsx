import { type ReactNode, useState } from "react";
import { Check, ChevronRight, Hash, Home, MessageSquare, Plane, Sparkles } from "lucide-react";
import { AmountKeypad } from "@/components/amount-keypad";
import { AccountSelect } from "@/components/account-select";
import { WhenPicker } from "@/components/when-picker";
import { Overlay } from "@/components/shared";
import { clockNow, formatTypingAmount, money, whenStamp } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { parseMoneyExpr } from "@/lib/money-expr";
import { accountBalanceAsOf, isDebtAccount } from "@/lib/calc/ledger";
import type { Account, Currency } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
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
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className="border-b border-line px-4 py-1.5">
      {label ? <div className="pt-1 text-[11px] text-muted">{label}</div> : null}
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
  currency,
  active,
  onFocusAmount,
  onPressLabel,
}: {
  leading?: ReactNode;
  label: string;
  placeholder?: string;
  amount?: string;
  currency?: string;
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
            "tr-press max-w-[58%] shrink-0 whitespace-nowrap text-right text-lg font-bold tabular-nums tracking-tight",
            active ? "text-accent" : "text-foreground",
          )}
        >
          {formatTypingAmount(amount, currency)}
          {preview != null && /[+\-*/]/.test((amount ?? "").replace(/,/g, "").replace(/^-/, "")) ? (
            <span className="mt-0.5 block text-[11px] font-normal text-muted">= {formatTypingAmount(String(preview), currency)}</span>
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
  role,
  amount,
  currency,
  active,
  onFocusAmount,
  asOf,
  excludeTxId,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  excludeId?: string;
  placeholder: string;
  role?: string;
  amount?: string;
  currency?: string;
  active?: boolean;
  onFocusAmount?: () => void;
  asOf?: string;
  excludeTxId?: string;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  const ledgerAccounts = useApp((s) => s.accounts);
  const acc = accounts.find((a) => a.id === value);
  const label = role || t.add.accountRow;
  const shown = acc
    ? asOf
      ? accountBalanceAsOf(acc.id, ledgerAccounts, txs, rates, asOf, excludeTxId)
      : acc.balance
    : 0;
  const balanceText = acc
    ? isDebtAccount(acc) && shown < 0
      ? `${t.assets.owed} ${money(Math.abs(shown), acc.currency)}`
      : `${t.assets.balance} ${money(shown, acc.currency)}`
    : "";
  return (
    <div className="flex min-h-12 items-center gap-2 border-b border-line px-4 py-2.5">
      <div className="relative min-w-0 flex-1">
        <div className="text-[11px] font-medium text-muted">{label}</div>
        <div className="pointer-events-none flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{acc ? pickName(locale, acc.name, acc.nameZh) : placeholder}</span>
          {acc ? (
            <span className="shrink-0 text-[11px] font-normal tabular-nums text-muted">
              {balanceText}
            </span>
          ) : null}
          <ChevronRight className="size-4 shrink-0 text-faint" />
        </div>
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
          className={cn("max-w-[46%] shrink-0 whitespace-nowrap text-right text-base font-semibold tabular-nums", active ? "text-accent" : "")}
        >
          {formatTypingAmount(amount, currency)}
        </button>
      ) : null}
    </div>
  );
}

export function DatePaidRow({
  date,
  time,
  paid,
  paidLabel,
  onDate,
  onTime,
  onPaid,
}: {
  date: string;
  time?: string;
  paid: boolean;
  paidLabel?: string;
  onDate: (v: string) => void;
  onTime?: (v: string) => void;
  onPaid: (v: boolean) => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const [open, setOpen] = useState(!paid && Boolean(onTime));
  const clock = time || clockNow();
  return (
    <div className="border-b border-line">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        {onTime ? (
          <button type="button" className="h-10 text-left text-sm font-medium text-accent" onClick={() => setOpen((v) => !v)}>
            {whenStamp(date, clock, locale)}
          </button>
        ) : (
          <input type="date" value={date} onChange={(e) => onDate(e.target.value)} className="h-10 bg-transparent text-sm text-accent outline-none" />
        )}
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-medium text-accent"
          onClick={() => {
            if (paid && onTime) setOpen(true);
            onPaid(!paid);
          }}
        >
          {paidLabel || t.add.paid}
          <span className={cn("grid size-6 place-items-center rounded-full border-2 border-accent", paid ? "" : "opacity-40")}>
            {paid ? <Check className="size-3.5" strokeWidth={3} /> : null}
          </span>
        </button>
      </div>
      {onTime && open ? <WhenPicker date={date} time={clock} locale={locale} onDate={onDate} onTime={onTime} /> : null}
    </div>
  );
}

export type ExtraPanel = "note" | "trip" | "housing" | "split" | "adhoc" | null;

export function ExtraIconBar({
  extra,
  onExtra,
  noteOn,
  tripOn,
  housingOn,
  splitOn,
  adhocOn,
  showTrip,
  showHousing,
  showSplit,
  showAdhoc,
  onHousing,
  onSplit,
  onAdhoc,
  noteValue,
  onNoteChange,
  noteSuggestions,
  tripValue,
  tripOptions,
  onTripChange,
}: {
  extra?: ExtraPanel;
  onExtra?: (v: ExtraPanel) => void;
  noteOn?: boolean;
  tripOn?: boolean;
  housingOn?: boolean;
  splitOn?: boolean;
  adhocOn?: boolean;
  showTrip?: boolean;
  showHousing?: boolean;
  showSplit?: boolean;
  showAdhoc?: boolean;
  onHousing?: () => void;
  onSplit?: () => void;
  onAdhoc?: () => void;
  noteValue?: string;
  onNoteChange?: (v: string) => void;
  noteSuggestions?: string[];
  tripValue?: string;
  tripOptions?: { id: string; label: string }[];
  onTripChange?: (id: string) => void;
}) {
  const t = useT();
  function toggle(id: Exclude<ExtraPanel, null>) {
    if (id === "housing") {
      onHousing?.();
      onExtra?.(extra === "housing" ? null : "housing");
      return;
    }
    if (id === "split") {
      onSplit?.();
      onExtra?.(extra === "split" ? null : "split");
      return;
    }
    if (id === "adhoc") {
      onAdhoc?.();
      onExtra?.(extra === "adhoc" ? null : "adhoc");
      return;
    }
    onExtra?.(extra === id ? null : id);
  }
  return (
    <div className="border-b border-line">
      <div className="flex items-start justify-around px-2 py-2">
        {onNoteChange ? (
          <IconBtn active={noteOn || extra === "note"} label={t.add.note} onClick={() => toggle("note")}>
            <MessageSquare className="size-5" />
          </IconBtn>
        ) : null}
        {showTrip ? (
          <IconBtn active={tripOn || extra === "trip"} label={t.add.trip} onClick={() => toggle("trip")}>
            <Plane className="size-5" />
          </IconBtn>
        ) : null}
        {showHousing ? (
          <IconBtn active={housingOn} label={t.add.housing} onClick={() => toggle("housing")}>
            <Home className="size-5" />
          </IconBtn>
        ) : null}
        {showAdhoc ? (
          <IconBtn active={adhocOn} label={t.add.adhoc} onClick={() => toggle("adhoc")}>
            <Sparkles className="size-5" />
          </IconBtn>
        ) : null}
        {showSplit ? (
          <IconBtn active={splitOn} label={t.add.split} onClick={() => toggle("split")}>
            <Hash className="size-5" />
          </IconBtn>
        ) : null}
      </div>
      {extra === "note" && onNoteChange ? (
        <div className="px-4 pb-3">
          <p className="pb-1.5 text-[11px] text-muted">{t.add.noteHint}</p>
          <input value={noteValue ?? ""} onChange={(e) => onNoteChange(e.target.value)} placeholder={t.add.note} className="h-11 w-full rounded-lg bg-elevated px-3 text-sm outline-none" />
          {noteSuggestions?.length ? (
            <div className="mt-2">
              <p className="pb-1.5 text-[11px] text-muted">{t.add.recentNotes}</p>
              <div className="flex flex-wrap gap-2">
                {noteSuggestions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={`max-w-full truncate rounded-full px-3 py-1.5 text-xs ${noteValue === label ? "bg-accent text-on-accent" : "bg-elevated"}`}
                    onClick={() => onNoteChange(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {extra === "trip" && onTripChange ? (
        <div className="px-4 pb-3">
          <p className="pb-1.5 text-[11px] text-muted">{t.add.tripHint}</p>
          <select value={tripValue ?? ""} onChange={(e) => onTripChange(e.target.value)} className="h-11 w-full rounded-lg bg-elevated px-3 text-sm">
            <option value="">{t.reports.noneTrip}</option>
            {(tripOptions ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {extra === "housing" || housingOn ? (
        <p className="px-4 pb-3 text-[11px] leading-relaxed text-muted">{t.add.housingHint}</p>
      ) : null}
      {extra === "adhoc" || adhocOn ? (
        extra === "adhoc" ? <p className="px-4 pb-3 text-[11px] leading-relaxed text-muted">{t.add.adhocHint}</p> : null
      ) : null}
      {extra === "split" || splitOn ? (
        extra === "split" ? <p className="px-4 pb-3 text-[11px] leading-relaxed text-muted">{t.add.splitHint}</p> : null
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
    <button type="button" onClick={onClick} className={cn("flex w-16 flex-col items-center gap-1 py-1", active ? "text-accent" : "text-faint")}>
      <span className="grid size-11 place-items-center rounded-lg">{children}</span>
      <span className="max-w-full truncate text-center text-[10px] leading-tight">{label}</span>
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
  onCurrency?: (c: Currency) => void;
}) {
  const value = field === "dest" ? dest : field === "principal" ? principal : field === "interest" ? interest : amount;
  const set =
    field === "dest" ? setDest : field === "principal" ? setPrincipal : field === "interest" ? setInterest : setAmount;
  return <AmountKeypad value={value} onChange={set} currency={currency} onCurrency={onCurrency} />;
}
