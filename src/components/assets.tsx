import { useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Group, Hairline, Overlay, ScreenHeader, SectionLabel, TransactionRow } from "@/components/shared";
import { AmountWithHkd } from "@/components/currency-field";
import { money } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { netWorthNow } from "@/lib/calc/networth";
import { accountsInGroup, BALANCE_GROUP_ORDER, nextSortOrder } from "@/lib/accounts";
import {
  ACCOUNT_TYPE_OPTIONS,
  CURRENCIES,
  groupForType,
  type Account,
  type AccountType,
  type MoneyUnit,
} from "@/lib/types";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function AssetsScreen() {
  const t = useT();
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const nw = netWorthNow(accounts, rates);
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const labels: Record<Account["group"], string> = {
    cash: t.assets.cash,
    credit: t.assets.credit,
    assets: t.assets.investments,
    housing: t.assets.housing,
    loyalty: t.assets.loyalty,
  };
  const groups = BALANCE_GROUP_ORDER.map((id) => ({ id, label: labels[id] }));
  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.assets.title}
        large
        right={
          <div className="flex items-center">
            <button type="button" className="h-11 px-2 text-sm font-medium text-accent" onClick={() => setReorder((v) => !v)}>
              {reorder ? t.common.done : t.common.edit}
            </button>
            <button type="button" aria-label={t.assets.addAccount} onClick={() => setEditingId("new")} className="grid size-11 place-items-center text-accent">
              <Plus className="size-6" />
            </button>
          </div>
        }
      />
      <div className="mx-4 mb-4 rounded-xl bg-elevated px-4 py-4">
        <div className="text-sm text-muted">{t.assets.netWorth}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{money(nw.net, "HKD")}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
          <span>
            {t.assets.totalAssets} {money(nw.assets, "HKD")}
          </span>
          <span>
            {t.assets.totalLiab} {money(nw.liab, "HKD")}
          </span>
        </div>
      </div>
      {groups.map((g) => {
        const rows = accountsInGroup(accounts, g.id).filter((a) => showHidden || !a.hidden);
        if (!rows.length) return null;
        return (
          <div key={g.id} className="mb-4">
            <h2 className="px-5 pb-1 text-sm font-medium text-muted">{g.label}</h2>
            <Group>
              {rows.map((a, i) => (
                <AccountRow
                  key={a.id}
                  a={a}
                  reorder={reorder}
                  canUp={i > 0 && rows[i - 1].type === a.type}
                  canDown={i < rows.length - 1 && rows[i + 1].type === a.type}
                  onEdit={() => setViewingId(a.id)}
                />
              ))}
            </Group>
          </div>
        );
      })}
      <button type="button" className="mx-5 mt-2 text-sm text-accent" onClick={() => setShowHidden((v) => !v)}>
        {showHidden ? t.assets.hideHidden : t.assets.showHidden}
      </button>
      {viewingId && !editingId ? (
        <AccountDetail
          account={accounts.find((a) => a.id === viewingId) ?? null}
          onClose={() => setViewingId(null)}
          onEdit={() => setEditingId(viewingId)}
        />
      ) : null}
      <AccountEditor
        key={editingId ?? "closed"}
        open={editingId !== null}
        account={editingId && editingId !== "new" ? accounts.find((a) => a.id === editingId) ?? null : null}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}

function AccountRow({
  a,
  reorder,
  canUp,
  canDown,
  onEdit,
}: {
  a: Account;
  reorder: boolean;
  canUp: boolean;
  canDown: boolean;
  onEdit: () => void;
}) {
  const locale = useUi((s) => s.locale);
  const move = useApp((s) => s.moveAccount);
  const rates = useApp((s) => s.fxRates);
  return (
    <div className="flex items-center">
      <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left" onClick={onEdit}>
        <span className="min-w-0">
          <span className="block truncate text-sm">{pickName(locale, a.name, a.nameZh)}</span>
          {a.hidden ? <span className="text-xs text-muted">{locale === "zh-HK" ? "已隱藏" : "Hidden"}</span> : null}
        </span>
        <AmountWithHkd amount={a.balance} currency={a.currency} rates={rates} className="text-sm font-semibold" />
      </button>
      {reorder ? (
        <div className="flex pr-2">
          <button type="button" aria-label="up" disabled={!canUp} className="grid size-11 place-items-center text-accent disabled:text-faint" onClick={() => void move(a.id, -1)}>
            <ChevronUp className="size-5" />
          </button>
          <button type="button" aria-label="down" disabled={!canDown} className="grid size-11 place-items-center text-accent disabled:text-faint" onClick={() => void move(a.id, 1)}>
            <ChevronDown className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AccountDetail({
  account,
  onClose,
  onEdit,
}: {
  account: Account | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setTx = useUi((s) => s.setTxDetailId);
  const txs = useApp((s) => s.transactions);
  const rates = useApp((s) => s.fxRates);
  if (!account) return null;
  const rows = txs
    .filter((x) => x.accountId === account.id || x.toAccountId === account.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const typeLabel = ACCOUNT_TYPE_OPTIONS.find((o) => o.id === account.type);
  return (
    <Overlay open onClose={onClose} variant="page">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="h-11 min-w-11 px-2 text-sm text-accent" onClick={onClose}>
          {t.common.back}
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{pickName(locale, account.name, account.nameZh)}</h1>
        <button type="button" className="h-11 min-w-11 px-2 text-sm font-medium text-accent" onClick={onEdit}>
          {t.common.edit}
        </button>
      </header>
      <div className="mx-4 mb-4 mt-2 rounded-xl bg-elevated px-4 py-4">
        <div className="text-xs text-muted">{typeLabel ? (locale === "zh-HK" ? typeLabel.zh : typeLabel.en) : account.type}</div>
        <div className="mt-1">
          <AmountWithHkd amount={account.balance} currency={account.currency} rates={rates} align="start" className="text-2xl font-semibold" />
        </div>
        {account.hidden ? <div className="mt-1 text-xs text-muted">{t.assets.hidden}</div> : null}
      </div>
      <SectionLabel>{t.assets.transactions}</SectionLabel>
      <Hairline />
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">{t.assets.noTransactions}</p>
      ) : (
        rows.map((tx, i) => (
          <div key={tx.id}>
            {i > 0 ? <Hairline /> : null}
            <TransactionRow tx={tx} showDate onClick={() => setTx(tx.id)} />
          </div>
        ))
      )}
    </Overlay>
  );
}

function AccountEditor({ open, account, onClose }: { open: boolean; account: Account | null; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const mortgage = useApp((s) => s.mortgage);
  const add = useApp((s) => s.addAccount);
  const update = useApp((s) => s.updateAccount);
  const updateMortgage = useApp((s) => s.updateMortgage);
  const properties = accounts.filter((a) => a.type === "property" && a.id !== account?.id);
  const loans = accounts.filter((a) => (a.type === "mortgage" || a.type === "loan") && a.id !== account?.id);
  const [name, setName] = useState(account ? pickName(locale, account.name, account.nameZh) : "");
  const [type, setType] = useState<AccountType>(account?.type ?? "current");
  const [currency, setCurrency] = useState<MoneyUnit>(account?.currency ?? "HKD");
  const [bal, setBal] = useState(account ? String(account.balance) : "0");
  const [notes, setNotes] = useState(account ? pickName(locale, account.notes ?? "", account.notesZh ?? "") : "");
  const [include, setInclude] = useState(account?.includeInNetWorth ?? true);
  const [hidden, setHidden] = useState(account?.hidden ?? false);
  const [linkedId, setLinkedId] = useState(
    account?.linkedAccountId ?? (account?.type === "mortgage" ? mortgage?.propertyAccountId ?? "" : ""),
  );

  async function save() {
    const n = name.trim() || (locale === "zh-HK" ? "帳戶" : "Account");
    const group = groupForType(type);
    const row: Account = {
      id: account?.id ?? newId(),
      name: n,
      nameZh: n,
      type,
      currency: type === "miles" ? "MILES" : currency === "MILES" ? "HKD" : currency,
      balance: Number(bal) || 0,
      includeInNetWorth: type === "miles" ? false : include,
      group,
      hidden,
      notes: notes || undefined,
      notesZh: notes || undefined,
      sortOrder: account?.group === group ? account.sortOrder : nextSortOrder(accounts, group),
      linkedAccountId: type === "mortgage" || type === "loan" || type === "property" ? linkedId || undefined : undefined,
    };
    if (account) await update(row);
    else await add(row);
    if (mortgage && (row.type === "mortgage" || row.type === "loan") && row.id === mortgage.accountId) {
      await updateMortgage({
        ...mortgage,
        propertyAccountId: row.linkedAccountId,
        outstanding: Math.abs(row.balance),
        accountId: row.id,
      });
    } else if (mortgage && row.type === "property" && row.linkedAccountId === mortgage.accountId) {
      await updateMortgage({ ...mortgage, propertyAccountId: row.id });
    }
    onClose();
  }

  const linkOptions = type === "property" ? loans : type === "mortgage" || type === "loan" ? properties : [];

  return (
    <Overlay open={open} onClose={onClose} title={account ? t.common.edit : t.assets.addAccount} variant="page">
      <div className="px-5 pb-10">
        <label className="block py-2">
          <span className="text-xs text-muted">{t.assets.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.assets.type}</span>
          <select
            value={type}
            onChange={(e) => {
              const next = e.target.value as AccountType;
              setType(next);
              if (next === "miles") setCurrency("MILES");
              else if (currency === "MILES") setCurrency("HKD");
            }}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3"
          >
            {ACCOUNT_TYPE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {locale === "zh-HK" ? o.zh : o.en}
              </option>
            ))}
          </select>
        </label>
        {type !== "miles" ? (
          <label className="block py-2">
            <span className="text-xs text-muted">{t.assets.currency}</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as MoneyUnit)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block py-2">
          <span className="text-xs text-muted">{t.assets.balance}</span>
          <input inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
        </label>
        {linkOptions.length ? (
          <label className="block py-2">
            <span className="text-xs text-muted">{type === "property" ? t.assets.linkedLoan : t.assets.linkedProperty}</span>
            <select value={linkedId} onChange={(e) => setLinkedId(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3">
              <option value="">{t.common.none}</option>
              {linkOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {pickName(locale, a.name, a.nameZh)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block py-2">
          <span className="text-xs text-muted">{t.add.note}</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none" />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} />
          {t.assets.include}
        </label>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          {t.assets.hideAccount}
        </label>
        <button type="button" className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void save()}>
          {t.add.save}
        </button>
      </div>
    </Overlay>
  );
}
