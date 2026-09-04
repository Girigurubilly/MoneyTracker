import { BALANCE_GROUP_ORDER, moneyAccountsForPicker } from "@/lib/accounts";
import { pickName } from "@/lib/i18n";
import type { Account, AccountGroup } from "@/lib/types";
import { useT, useUi } from "@/store/ui";

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
  const labels: Record<AccountGroup, string> = {
    cash: t.assets.cash,
    credit: t.assets.credit,
    assets: t.assets.investments,
    housing: t.assets.housing,
    loyalty: t.assets.loyalty,
  };
  const rows = moneyAccountsForPicker(accounts, { includeId: value }).filter((a) => a.id !== excludeId);
  const groups = BALANCE_GROUP_ORDER.map((group) => ({
    group,
    items: rows.filter((a) => a.group === group),
  })).filter((g) => g.items.length);

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
