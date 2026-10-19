import { Check } from "lucide-react";
import { BALANCE_GROUP_ORDER, moneyAccountsForPicker } from "@/lib/accounts";
import { pickName } from "@/lib/i18n";
import type { Account, AccountGroup } from "@/lib/types";
import { useT, useUi } from "@/store/ui";

function accountGroups(accounts: Account[], value: string, excludeId?: string) {
  const kid = useUi.getState().accessMode === "kid";
  const rows = moneyAccountsForPicker(accounts, { includeId: value, kid }).filter((a) => a.id !== excludeId);
  return BALANCE_GROUP_ORDER.filter((group) => !kid || group === "cash" || group === "credit")
    .map((group) => ({ group, items: rows.filter((a) => a.group === group) }))
    .filter((g) => g.items.length);
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  excludeId,
  allowEmpty,
  emptyLabel,
  className,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  excludeId?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const kid = useUi((s) => s.accessMode) === "kid";
  const labels: Record<AccountGroup, string> = {
    cash: t.assets.cash,
    credit: t.assets.credit,
    assets: t.assets.investments,
    housing: t.assets.housing,
    loyalty: t.assets.loyalty,
  };
  const groups = accountGroups(accounts, value, excludeId).filter((g) => !kid || g.group === "cash" || g.group === "credit");

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className ?? "mt-1 h-11 w-full rounded-lg bg-elevated px-3"}>
      {allowEmpty ? <option value="">{emptyLabel ?? t.common.none}</option> : null}
      {groups.map((g) => (
        <optgroup key={g.group} label={labels[g.group]}>
          {g.items.map((a) => (
            <option key={a.id} value={a.id}>
              {pickName(locale, a.name, a.nameZh)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function AccountPicker({
  accounts,
  value,
  onClose,
  onSelect,
}: {
  accounts: Account[];
  value: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const labels: Record<AccountGroup, string> = {
    cash: t.assets.cash,
    credit: t.assets.credit,
    assets: t.assets.investments,
    housing: t.assets.housing,
    loyalty: t.assets.loyalty,
  };
  const groups = accountGroups(accounts, value);
  return (
    <div className="fixed inset-0 z-[96] flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.add.cancel}
        </button>
        <div className="text-base font-semibold">{t.add.account}</div>
        <span className="h-11 min-w-11" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        {groups.map((g) => (
          <div key={g.group}>
            <div className="px-5 pb-1 pt-4 text-xs font-medium text-muted">{labels[g.group]}</div>
            {g.items.map((a) => (
              <button
                key={a.id}
                type="button"
                className="flex h-12 w-full items-center gap-3 px-5 text-left text-sm"
                onClick={() => onSelect(a.id)}
              >
                <span className="min-w-0 flex-1 truncate">{pickName(locale, a.name, a.nameZh)}</span>
                {a.id === value ? <Check className="size-4 text-accent" /> : null}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
