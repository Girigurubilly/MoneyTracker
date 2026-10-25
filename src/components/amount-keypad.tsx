import { Delete } from "lucide-react";
import { CURRENCIES, type Currency } from "@/lib/types";
import { applyPadKey } from "@/lib/money-expr";
import { cn } from "@/lib/utils";
import { useState } from "react";

const QUICK = ["HKD", "USD", "CNY", "JPY", "GBP", "EUR"] as const;

export function CurrencyChips({ currency, onCurrency }: { currency: Currency; onCurrency: (c: Currency) => void }) {
  const [more, setMore] = useState(!QUICK.includes(currency as (typeof QUICK)[number]));
  const list = more ? CURRENCIES : QUICK;
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
      {list.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onCurrency(c)}
          className={cn(
            "h-8 shrink-0 rounded-full px-3 text-xs font-semibold",
            c === currency ? "bg-accent text-on-accent" : "bg-elevated text-foreground",
          )}
        >
          {c}
        </button>
      ))}
      {more ? null : (
        <button type="button" className="h-8 shrink-0 rounded-full bg-elevated px-3 text-xs font-medium text-accent" onClick={() => setMore(true)}>
          ···
        </button>
      )}
    </div>
  );
}

export function AmountKeypad({
  value,
  onChange,
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
      <div className="grid grid-cols-4 gap-1.5">
        <PadKey onClick={() => press("1")}>1</PadKey>
        <PadKey onClick={() => press("2")}>2</PadKey>
        <PadKey onClick={() => press("3")}>3</PadKey>
        <PadKey tone="op" onClick={() => press("+")}>+</PadKey>

        <PadKey onClick={() => press("4")}>4</PadKey>
        <PadKey onClick={() => press("5")}>5</PadKey>
        <PadKey onClick={() => press("6")}>6</PadKey>
        <PadKey tone="op" onClick={() => press("−")}>−</PadKey>

        <PadKey onClick={() => press("7")}>7</PadKey>
        <PadKey onClick={() => press("8")}>8</PadKey>
        <PadKey onClick={() => press("9")}>9</PadKey>
        <PadKey tone="op" onClick={() => press("×")}>×</PadKey>

        <PadKey onClick={() => press(".")}>.</PadKey>
        <PadKey onClick={() => press("0")}>0</PadKey>
        <PadKey tone="fn" ariaLabel="backspace" onClick={() => press("back")}>
          <Delete className="size-5" />
        </PadKey>
        <PadKey tone="op" onClick={() => press("÷")}>÷</PadKey>
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