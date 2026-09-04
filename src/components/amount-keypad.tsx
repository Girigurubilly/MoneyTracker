import { Delete } from "lucide-react";
import { CURRENCIES, type Currency } from "@/lib/types";
import { applyPadKey } from "@/lib/money-expr";
import { cn } from "@/lib/utils";

export function AmountKeypad({
  value,
  onChange,
  currency,
  onCurrency,
}: {
  value: string;
  onChange: (next: string) => void;
  currency?: Currency;
  onCurrency?: (c: Currency) => void;
}) {
  function press(key: string) {
    onChange(applyPadKey(value, key));
  }

  return (
    <div className="border-t border-line bg-background px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      <div className="grid grid-cols-5 gap-1.5">
        <PadKey tone="op" onClick={() => press("+")}>
          +
        </PadKey>
        <PadKey onClick={() => press("1")}>1</PadKey>
        <PadKey onClick={() => press("2")}>2</PadKey>
        <PadKey onClick={() => press("3")}>3</PadKey>
        {onCurrency && currency ? (
          <select
            aria-label="currency"
            value={currency}
            onChange={(e) => onCurrency(e.target.value as Currency)}
            className="h-14 appearance-none rounded-lg bg-elevated text-center text-sm font-semibold"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          <PadKey tone="fn" disabled>
            {currency ?? "HKD"}
          </PadKey>
        )}

        <PadKey tone="op" onClick={() => press("−")}>
          −
        </PadKey>
        <PadKey onClick={() => press("4")}>4</PadKey>
        <PadKey onClick={() => press("5")}>5</PadKey>
        <PadKey onClick={() => press("6")}>6</PadKey>
        <PadKey tone="fn" onClick={() => press("±")}>
          ±
        </PadKey>

        <PadKey tone="op" onClick={() => press("×")}>
          ×
        </PadKey>
        <PadKey onClick={() => press("7")}>7</PadKey>
        <PadKey onClick={() => press("8")}>8</PadKey>
        <PadKey onClick={() => press("9")}>9</PadKey>
        <PadKey tone="fn" onClick={() => press("=")}>
          =
        </PadKey>

        <PadKey tone="op" onClick={() => press("÷")}>
          ÷
        </PadKey>
        <PadKey onClick={() => press(".")}>.</PadKey>
        <PadKey className="col-span-2" onClick={() => press("0")}>
          0
        </PadKey>
        <PadKey tone="fn" ariaLabel="backspace" onClick={() => press("back")}>
          <Delete className="size-5" />
        </PadKey>
      </div>
    </div>
  );
}

function PadKey({
  children,
  onClick,
  tone = "num",
  className,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "num" | "op" | "fn";
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-14 items-center justify-center rounded-lg text-xl font-medium tabular-nums active:opacity-80",
        tone === "op" && "bg-watch text-on-accent",
        tone === "num" && "bg-elevated",
        tone === "fn" && "bg-elevated text-base text-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}
