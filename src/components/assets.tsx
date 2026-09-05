import { useState, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Globe,
  Home,
  Landmark,
  PiggyBank,
  Plane,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Hairline, Overlay, ScreenHeader, SectionLabel, TxGroupedList } from "@/components/shared";
import { AmountWithHkd } from "@/components/currency-field";
import { money } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { resolveAmountInput } from "@/lib/money-expr";
import {
  ActiveKeypad,
  ComposerHeader,
  ComposerShell,
  ExtraIconBar,
  LineRow,
  NoteSheet,
  SelectLine,
  TextLine,
} from "@/components/txn-composer";
import { netWorthNow } from "@/lib/calc/networth";
import { toHkd } from "@/lib/calc/fx";
import { accountsInGroup, BALANCE_GROUP_ORDER, nextSortOrder } from "@/lib/accounts";
import {
  ACCOUNT_TYPE_OPTIONS,
  CURRENCIES,
  groupForType,
  typesInGroup,
  type Account,
  type AccountGroup,
  type AccountType,
  type Currency,
  type MoneyUnit,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";

const TYPE_TONE: Record<AccountType, string> = {
  cash: "bg-[#e8f8ee] text-[#1f7a3a]",
  current: "bg-[#e8f1ff] text-[#0b63ce]",
  savings: "bg-[#e8f8ee] text-[#1f7a3a]",
  fx: "bg-[#f3e8ff] text-[#7a3db8]",
  ewallet: "bg-[#fff4e0] text-[#b86a00]",
  credit: "bg-[#ffecec] text-[#c0122a]",
  loan: "bg-[#ffecec] text-[#c0122a]",
  investment: "bg-[#e8f1ff] text-[#0b63ce]",
  mpf: "bg-[#eef0ff] text-[#3d4ecf]",
  property: "bg-[#fff4e0] text-[#b86a00]",
  mortgage: "bg-[#ffecec] text-[#c0122a]",
  miles: "bg-[#e8f8f8] text-[#0f7a7a]",
  other_asset: "bg-accent-soft text-accent",
};

function TypeGlyph({ type }: { type: AccountType }) {
  const cls = "size-5";
  const map: Record<AccountType, ReactNode> = {
    cash: <Wallet className={cls} />,
    current: <Landmark className={cls} />,
    savings: <PiggyBank className={cls} />,
    fx: <Globe className={cls} />,
    ewallet: <Wallet className={cls} />,
    credit: <CreditCard className={cls} />,
    loan: <Landmark className={cls} />,
    investment: <TrendingUp className={cls} />,
    mpf: <Building2 className={cls} />,
    property: <Home className={cls} />,
    mortgage: <Home className={cls} />,
    miles: <Plane className={cls} />,
    other_asset: <Wallet className={cls} />,
  };
  return map[type];
}

function isForeignSection(a: Account) {
  return a.type === "fx";
}

export function AssetsScreen() {
  const t = useT();
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const nw = netWorthNow(accounts, rates);
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const labels: Record<AccountGroup, string> = {
    cash: t.assets.cash,
    credit: t.assets.credit,
    assets: t.assets.investments,
    housing: t.assets.housing,
    loyalty: t.assets.loyalty,
  };
  const visible = accounts.filter((a) => !a.hidden);
  const hiddenRows = accounts.filter((a) => a.hidden);
  const fxRows = visible.filter(isForeignSection);
  const fxIds = new Set(fxRows.map((a) => a.id));
  const groups = BALANCE_GROUP_ORDER.filter((id) => id !== "loyalty").map((id) => ({ id, label: labels[id] }));

  function openAccount(id: string) {
    setViewingId(id);
  }

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
      <div className="mx-4 mb-5 overflow-hidden rounded-2xl bg-elevated px-4 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="text-sm text-muted">{t.assets.netWorth}</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{money(nw.net, "HKD")}</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-success-soft px-3 py-2">
            <div className="text-[11px] text-income">{t.assets.totalAssets}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-income">{money(nw.assets, "HKD")}</div>
          </div>
          <div className="rounded-xl bg-expense-soft px-3 py-2">
            <div className="text-[11px] text-expense">{t.assets.totalLiab}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-expense">{money(nw.liab, "HKD")}</div>
          </div>
        </div>
      </div>
      {groups.map((g) => {
        const rows = accountsInGroup(visible, g.id).filter((a) => !fxIds.has(a.id));
        if (!rows.length) return null;
        const total = rows.reduce((s, a) => s + toHkd(a.balance, a.currency, rates), 0);
        return (
          <AssetSection key={g.id} label={g.label} total={total} currencyHint="HKD">
            {rows.map((a, i) => (
              <AccountCard
                key={a.id}
                a={a}
                reorder={reorder}
                canUp={i > 0}
                canDown={i < rows.length - 1}
                onEdit={() => openAccount(a.id)}
              />
            ))}
          </AssetSection>
        );
      })}
      {fxRows.length ? (
        <AssetSection
          label={t.assets.foreign}
          total={fxRows.reduce((s, a) => s + toHkd(a.balance, a.currency, rates), 0)}
          currencyHint="HKD"
        >
          {fxRows.map((a) => (
            <AccountCard key={a.id} a={a} reorder={reorder} canUp={false} canDown={false} onEdit={() => openAccount(a.id)} />
          ))}
        </AssetSection>
      ) : null}
      {hiddenRows.length ? (
        <div className="mb-4">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 pb-2 pt-1 text-left"
            onClick={() => setShowHidden((v) => !v)}
          >
            <span className="text-sm font-medium text-muted">
              {t.assets.hiddenSection}
              <span className="ml-2 text-xs">{hiddenRows.length}</span>
            </span>
            <ChevronDown className={cn("size-4 text-faint transition", showHidden && "rotate-180")} />
          </button>
          {showHidden ? (
            <div className="space-y-2 px-4">
              {hiddenRows.map((a) => (
                <AccountCard key={a.id} a={a} reorder={false} canUp={false} canDown={false} onEdit={() => openAccount(a.id)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
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

function AssetSection({
  label,
  total,
  currencyHint,
  children,
}: {
  label: string;
  total: number;
  currencyHint: MoneyUnit;
  children: ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between px-5 pb-2">
        <h2 className="text-sm font-medium text-muted">{label}</h2>
        <span className="text-xs tabular-nums text-muted">{money(total, currencyHint)}</span>
      </div>
      <div className="space-y-2 px-4">{children}</div>
    </div>
  );
}

function AccountCard({
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
  const t = useT();
  const move = useApp((s) => s.moveAccount);
  const moveTo = useApp((s) => s.moveAccountToGroup);
  const rates = useApp((s) => s.fxRates);
  const groupLabels: Record<AccountGroup, string> = {
    cash: t.assets.cash,
    credit: t.assets.credit,
    assets: t.assets.investments,
    housing: t.assets.housing,
    loyalty: t.assets.loyalty,
  };
  const typeLabel = ACCOUNT_TYPE_OPTIONS.find((o) => o.id === a.type);
  const groupLabel = a.type === "fx" ? t.assets.foreign : groupLabels[a.group];
  const tone = TYPE_TONE[a.type] ?? "bg-accent-soft text-accent";
  const negative = a.balance < 0;
  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl bg-elevated shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left" onClick={onEdit}>
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", tone)}>
          <TypeGlyph type={a.type} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{pickName(locale, a.name, a.nameZh)}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted">
            {groupLabel}
            {typeLabel ? ` · ${locale === "zh-HK" ? typeLabel.zh : typeLabel.en}` : ""}
            {a.currency !== "HKD" ? ` · ${a.currency}` : ""}
            {a.hidden ? (locale === "zh-HK" ? " · 已隱藏" : " · Hidden") : ""}
          </span>
        </span>
        <AmountWithHkd
          amount={a.balance}
          currency={a.currency}
          rates={rates}
          className={cn("text-base font-semibold", negative ? "text-expense" : "")}
        />
      </button>
      {reorder ? (
        <div className="flex flex-col justify-center gap-1 border-l border-line px-1 py-1">
          <select
            aria-label={t.assets.moveTo}
            value={a.type === "fx" ? "fx" : a.group}
            onChange={(e) => void moveTo(a.id, e.target.value as AccountGroup | "fx")}
            className="h-8 max-w-[5.5rem] rounded-md bg-background px-1 text-[10px] text-accent outline-none"
          >
            {(Object.keys(groupLabels) as AccountGroup[]).map((g) => (
              <option key={g} value={g}>
                {groupLabels[g]}
              </option>
            ))}
            <option value="fx">{t.assets.foreign}</option>
          </select>
          <button type="button" aria-label="up" disabled={!canUp} className="grid size-8 place-items-center text-accent disabled:text-faint" onClick={() => void move(a.id, -1)}>
            <ChevronUp className="size-5" />
          </button>
          <button type="button" aria-label="down" disabled={!canDown} className="grid size-8 place-items-center text-accent disabled:text-faint" onClick={() => void move(a.id, 1)}>
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
  const groupLabel =
    account.group === "cash"
      ? t.assets.cash
      : account.group === "credit"
        ? t.assets.credit
        : account.group === "assets"
          ? t.assets.investments
          : account.group === "housing"
            ? t.assets.housing
            : t.assets.loyalty;
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
        <div className="text-xs text-muted">
          {groupLabel}
          {typeLabel ? ` · ${locale === "zh-HK" ? typeLabel.zh : typeLabel.en}` : ""}
        </div>
        <div className="mt-1">
          <AmountWithHkd amount={account.balance} currency={account.currency} rates={rates} align="start" className="text-2xl font-semibold" />
        </div>
        {account.hidden ? <div className="mt-1 text-xs text-muted">{t.assets.hidden}</div> : null}
      </div>
      <TxGroupedList txs={rows} onClick={(tx) => setTx(tx.id)} empty={t.assets.noTransactions} />
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
  const properties = accounts.filter((x) => x.type === "property" && x.id !== account?.id);
  const loans = accounts.filter((x) => (x.type === "mortgage" || x.type === "loan") && x.id !== account?.id);
  const [name, setName] = useState(account ? pickName(locale, account.name, account.nameZh) : "");
  const [type, setType] = useState<AccountType>(account?.type ?? "current");
  const [group, setGroup] = useState<AccountGroup>(account?.group ?? groupForType(account?.type ?? "current"));
  const [currency, setCurrency] = useState<MoneyUnit>(account?.currency ?? "HKD");
  const [bal, setBal] = useState(account ? String(account.balance) : "0");
  const [notes, setNotes] = useState(account ? pickName(locale, account.notes ?? "", account.notesZh ?? "") : "");
  const [include, setInclude] = useState(account?.includeInNetWorth ?? true);
  const [hidden, setHidden] = useState(account?.hidden ?? false);
  const [linkedId, setLinkedId] = useState(
    account?.linkedAccountId ?? (account?.type === "mortgage" ? mortgage?.propertyAccountId ?? "" : ""),
  );
  const [extra, setExtra] = useState<"note" | null>(null);

  async function save() {
    const n = name.trim() || (locale === "zh-HK" ? "帳戶" : "Account");
    const group = groupForType(type);
    const row: Account = {
      id: account?.id ?? newId(),
      name: n,
      nameZh: n,
      type,
      currency: type === "miles" ? "MILES" : currency === "MILES" ? "HKD" : currency,
      balance: resolveAmountInput(bal),
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
  const ccy = (type === "miles" || currency === "MILES" ? "HKD" : currency) as Currency;

  return (
    <Overlay open={open} onClose={onClose} variant="page">
      <ComposerShell
        header={<ComposerHeader onClose={onClose} onSave={() => void save()} title={account ? t.common.edit : t.assets.addAccount} />}
        keypad={
          type === "miles" ? (
            <div />
          ) : (
            <ActiveKeypad
              field="amount"
              amount={bal}
              dest=""
              principal=""
              interest=""
              setAmount={setBal}
              setDest={() => undefined}
              setPrincipal={() => undefined}
              setInterest={() => undefined}
              currency={ccy}
              onCurrency={(c) => setCurrency(c)}
            />
          )
        }
      >
        <TextLine value={name} onChange={setName} placeholder={t.assets.name} />
        <SelectLine
          label={t.assets.type}
          value={type === "fx" ? "fx" : group}
          onChange={(v) => {
            if (v === "fx") {
              setGroup("cash");
              setType("fx");
              if (currency === "MILES") setCurrency("USD");
              return;
            }
            const next = v as AccountGroup;
            setGroup(next);
            const keep = type !== "fx" && typesInGroup(next).includes(type);
            const nextType = keep ? type : typesInGroup(next).filter((id) => id !== "fx")[0] ?? typesInGroup(next)[0];
            setType(nextType);
            if (nextType === "miles") setCurrency("MILES");
            else if (currency === "MILES") setCurrency("HKD");
          }}
          options={[
            { id: "cash", label: t.assets.cash },
            { id: "credit", label: t.assets.credit },
            { id: "assets", label: t.assets.investments },
            { id: "housing", label: t.assets.housing },
            { id: "fx", label: t.assets.foreign },
          ]}
        />
        {type === "fx" ? null : (
          <SelectLine
            label={t.assets.subtype}
            value={type}
            onChange={(v) => {
              const next = v as AccountType;
              setType(next);
              setGroup(groupForType(next));
              if (next === "miles") setCurrency("MILES");
              else if (currency === "MILES") setCurrency("HKD");
            }}
            options={typesInGroup(group)
              .filter((id) => id !== "fx" && id !== "miles")
              .map((id) => {
                const o = ACCOUNT_TYPE_OPTIONS.find((x) => x.id === id)!;
                return { id, label: locale === "zh-HK" ? o.zh : o.en };
              })}
          />
        )}
        <LineRow label={t.assets.balance} amount={bal} active onFocusAmount={() => undefined} />
        {linkOptions.length ? (
          <SelectLine
            label={type === "property" ? t.assets.linkedLoan : t.assets.linkedProperty}
            value={linkedId}
            onChange={setLinkedId}
            options={[{ id: "", label: t.common.none }, ...linkOptions.map((x) => ({ id: x.id, label: pickName(locale, x.name, x.nameZh) }))]}
          />
        ) : null}
        <ExtraIconBar
          extra={extra}
          onExtra={(v) => setExtra(v === "note" ? "note" : extra)}
          noteOn={!!notes}
          housingOn={include}
          showHousing
          onHousing={() => setInclude((v) => !v)}
          noteValue={notes}
          onNoteChange={setNotes}
        />
      </ComposerShell>
    </Overlay>
  );
}
