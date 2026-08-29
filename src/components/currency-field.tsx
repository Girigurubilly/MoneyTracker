import type { Currency, FxRate, MoneyUnit } from "@/lib/types";
import { CURRENCIES } from "@/lib/types";
import { money } from "@/lib/format";
import { convertAmount, toHkd } from "@/lib/calc/fx";
import { roundMoney } from "@/lib/calc/ledger";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";

export function asFiat(unit: MoneyUnit, fallback: Currency = "HKD"): Currency {
  return unit === "MILES" ? fallback : unit;
}

export function hkdSupplement(
  amount: number,
  currency: MoneyUnit,
  rates: FxRate[],
  fxToHkd?: number,
  locale?: "en" | "zh-HK",
  sign?: boolean,
): string | null {
  if (currency === "HKD" || currency === "MILES") return null;
  if (!Number.isFinite(amount) || amount === 0) return null;
  const hkd = toHkd(amount, currency, rates, fxToHkd);
  const text = money(hkd, "HKD", sign ? { sign: true } : undefined);
  return locale === "zh-HK" ? `約 ${text}` : `≈ ${text}`;
}

export function AmountWithHkd({
  amount,
  currency,
  rates,
  fxToHkd,
  sign,
  className,
  align = "end",
}: {
  amount: number;
  currency: MoneyUnit;
  rates: FxRate[];
  fxToHkd?: number;
  sign?: boolean;
  className?: string;
  align?: "end" | "start";
}) {
  const locale = useUi((s) => s.locale);
  const remark = hkdSupplement(amount, currency, rates, fxToHkd, locale, sign);
  return (
    <span className={cn("inline-flex flex-col leading-tight", align === "end" ? "items-end" : "items-start")}>
      <span className={cn("tabular-nums", className)}>{money(amount, currency, sign ? { sign: true } : undefined)}</span>
      {remark ? <span className="mt-0.5 text-xs font-normal tabular-nums text-muted">{remark}</span> : null}
    </span>
  );
}

export function CurrencySelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: Currency;
  onChange: (c: Currency) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Currency)}
      className={className ?? "h-11 w-[5.5rem] shrink-0 rounded-lg bg-elevated px-2 text-sm disabled:opacity-70"}
    >
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

export function AmountCurrencyRow({
  amount,
  currency,
  onAmount,
  onCurrency,
  rates,
  fxToHkd,
  placeholder,
  currencyDisabled,
}: {
  amount: string;
  currency: Currency;
  onAmount: (v: string) => void;
  onCurrency: (c: Currency) => void;
  rates: FxRate[];
  fxToHkd?: number;
  placeholder?: string;
  currencyDisabled?: boolean;
}) {
  const n = Number(amount) || 0;
  const locale = useUi((s) => s.locale);
  const remark = hkdSupplement(n, currency, rates, fxToHkd, locale);
  return (
    <div>
      <div className="mt-1 flex gap-2">
        <input
          inputMode="decimal"
          value={amount}
          placeholder={placeholder}
          onChange={(e) => onAmount(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-lg bg-elevated px-3 outline-none"
        />
        <CurrencySelect value={currency} onChange={onCurrency} disabled={currencyDisabled} />
      </div>
      {remark ? <p className="mt-1 text-xs tabular-nums text-muted">{remark}</p> : null}
    </div>
  );
}

export function roundedConvert(n: number, currency: MoneyUnit): number {
  return roundMoney(n, currency === "JPY" || currency === "KRW" || currency === "MILES" ? 0 : 2);
}

export function autoDestAmount(
  amount: number,
  from: MoneyUnit,
  to: MoneyUnit,
  rates: FxRate[],
  fxToHkd?: number,
): number {
  return roundedConvert(convertAmount(amount, from, to, rates, fxToHkd), to);
}

export function hkdHint(amount: number, currency: MoneyUnit, rates: FxRate[], fxToHkd?: number): number {
  return toHkd(amount, currency, rates, fxToHkd);
}
