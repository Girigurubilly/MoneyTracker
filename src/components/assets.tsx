import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Pencil, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  CategoryGlyph,
  Disclaimer,
  Group,
  Hairline,
  Overlay,
  Row,
  ScreenHeader,
  TransactionRow,
} from "@/components/shared";
import { money as fmt } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { toHkd } from "@/lib/calc/fx";
import { netWorthNow } from "@/lib/calc/networth";
import type { Account, AccountGroup, AccountType, Currency } from "@/lib/types";
import { ACCOUNT_TYPE_OPTIONS, CURRENCIES, groupForType } from "@/lib/types";
import { accountsInGroup, iconForAccountType } from "@/lib/accounts";
import { cn } from "@/lib/utils";
import { useApp, newId } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { toast } from "sonner";

export function AssetsScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const rates = useApp((s) => s.fxRates);
  const setAdd = useUi((s) => s.setAddAccountOpen);
  const moveAccount = useApp((s) => s.moveAccount);
  const [showHidden, setShowHidden] = useState(false);
  const [editAcc, setEditAcc] = useState<Account | null>(null);
  const nw = netWorthNow(accounts, rates);
  const groups: { id: AccountGroup; title: string }[] = [
    { id: "cash", title: t.assets.cash },
    { id: "credit", title: t.assets.credit },
    { id: "assets", title: t.assets.investments },
    { id: "housing", title: t.assets.housing },
    { id: "loyalty", title: t.assets.loyalty },
  ];

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.assets.title}
        large
        right={
          <button
            type="button"
            className="grid size-11 place-items-center"
            aria-label={t.assets.addAccount}
            onClick={() => setAdd(true)}
          >
            <Plus className="size-6" />
          </button>
        }
      />
      <div className="mx-4 mt-2 rounded-xl bg-elevated px-4 py-4">
        <div className="text-xs text-muted">{t.assets.netWorth}</div>
        <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
          {fmt(nw.net, "HKD")}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted">{t.assets.totalAssets}</div>
            <div className="tabular-nums text-income">{fmt(nw.assets, "HKD")}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.assets.totalLiab}</div>
            <div className="tabular-nums text-expense">{fmt(nw.liab, "HKD")}</div>
          </div>
        </div>
      </div>

      {groups.map((g) => {
        const rows = accountsInGroup(accounts, g.id);
        if (!rows.length) return null;
        return (
          <div key={g.id}>
            <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{g.title}</h2>
            <Hairline />
            {rows.map((a, i) => (
              <div key={a.id}>
                {i > 0 ? <Hairline /> : null}
                <AccountRow
                  account={a}
                  locale={locale}
                  onEdit={() => setEditAcc(a)}
                  onMoveUp={i > 0 ? () => void moveAccount(a.id, -1) : undefined}
                  onMoveDown={i < rows.length - 1 ? () => void moveAccount(a.id, 1) : undefined}
                />
              </div>
            ))}
          </div>
        );
      })}

      <HiddenAccounts
        accounts={accounts}
        locale={locale}
        open={showHidden}
        setOpen={setShowHidden}
        onEdit={setEditAcc}
      />
      {editAcc ? (
        <AccountEditor open account={editAcc} onClose={() => setEditAcc(null)} />
      ) : null}
    </div>
  );
}

function HiddenAccounts({
  accounts,
  locale,
  open,
  setOpen,
  onEdit,
}: {
  accounts: Account[];
  locale: "en" | "zh-HK";
  open: boolean;
  setOpen: (v: boolean) => void;
  onEdit: (a: Account) => void;
}) {
  const t = useT();
  const hidden = accounts.filter((a) => a.hidden);
  return (
    <div className="pt-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-2 text-left"
      >
        <span className="text-sm font-medium text-muted">
          {t.assets.hiddenSection}
          {hidden.length ? ` · ${hidden.length}` : ""}
        </span>
        {open ? <ChevronDown className="size-4 text-muted" /> : <ChevronRight className="size-4 text-muted" />}
      </button>
      {open ? (
        hidden.length ? (
          <>
            <Hairline />
            {hidden.map((a, i) => (
              <div key={a.id}>
                {i > 0 ? <Hairline /> : null}
                <AccountRow account={a} locale={locale} onEdit={() => onEdit(a)} />
              </div>
            ))}
          </>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">{t.assets.hiddenEmpty}</p>
        )
      ) : hidden.length === 0 ? (
        <p className="px-5 pb-4 text-[11px] text-faint">{t.assets.hiddenHint}</p>
      ) : null}
    </div>
  );
}

function AccountRow({
  account,
  locale,
  onEdit,
  onMoveUp,
  onMoveDown,
}: {
  account: Account;
  locale: "en" | "zh-HK";
  onEdit?: (a: Account) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const t = useT();
  const rates = useApp((s) => s.fxRates);
  const native =
    account.currency === "MILES"
      ? `${Math.round(account.balance).toLocaleString("en-HK")} ${locale === "zh-HK" ? "里" : "miles"}`
      : fmt(account.balance, account.currency, { sign: true });
  const hkd =
    account.currency !== "HKD" && account.currency !== "MILES"
      ? fmt(toHkd(account.balance, account.currency, rates), "HKD")
      : null;
  const typeLabel = ACCOUNT_TYPE_OPTIONS.find((o) => o.id === account.type);
  return (
    <div className="flex items-center">
      <Link
        to="/assets/$id"
        params={{ id: account.id }}
        className="flex min-w-0 flex-1 items-center gap-3 px-5 py-3"
      >
        <span className="grid size-10 place-items-center rounded-full bg-elevated ring-1 ring-line">
          <CategoryGlyph name={iconForAccountType(account.type)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">
            {pickName(locale, account.name, account.nameZh)}
          </span>
          <span className="text-xs text-muted">
            {typeLabel ? (locale === "zh-HK" ? typeLabel.zh : typeLabel.en) : account.type}
            {account.institution ? ` · ${account.institution}` : ""}
          </span>
        </span>
        <span className="text-right">
          <span
            className={cn(
              "block text-[15px] font-semibold tabular-nums",
              account.balance < 0 ? "text-expense" : "text-foreground",
            )}
          >
            {native}
          </span>
          {hkd ? <span className="text-xs tabular-nums text-muted">{hkd}</span> : null}
        </span>
      </Link>
      {onMoveUp || onMoveDown ? (
        <span className="flex w-11 shrink-0 flex-col">
          <button
            type="button"
            aria-label={t.assets.moveUp}
            disabled={!onMoveUp}
            onClick={onMoveUp}
            className="grid h-6 place-items-center text-accent disabled:text-faint"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t.assets.moveDown}
            disabled={!onMoveDown}
            onClick={onMoveDown}
            className="grid h-6 place-items-center text-accent disabled:text-faint"
          >
            <ChevronDown className="size-4" />
          </button>
        </span>
      ) : null}
      {onEdit ? (
        <button
          type="button"
          aria-label={t.common.edit}
          onClick={() => onEdit(account)}
          className="grid size-11 shrink-0 place-items-center text-accent"
        >
          <Pencil className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function AccountDetail({ id }: { id: string }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setTx = useUi((s) => s.setTxDetailId);
  const accounts = useApp((s) => s.accounts);
  const transactions = useApp((s) => s.transactions);
  const mortgage = useApp((s) => s.mortgage);
  const rates = useApp((s) => s.fxRates);
  const [edit, setEdit] = useState(false);
  const account = accounts.find((a) => a.id === id);
  if (!account) {
    return (
      <div>
        <ScreenHeader title={t.assets.title} backTo="/assets" />
      </div>
    );
  }
  const hist = transactions.filter((x) => x.accountId === id || x.toAccountId === id);
  const native =
    account.currency === "MILES"
      ? `${Math.round(account.balance).toLocaleString("en-HK")}`
      : fmt(account.balance, account.currency, { sign: true });
  const linkedMortgage =
    account.id === mortgage?.accountId || account.id === mortgage?.propertyAccountId;

  return (
    <div className="pb-10">
      <ScreenHeader
        title={pickName(locale, account.name, account.nameZh)}
        backTo="/assets"
        right={
          <button
            type="button"
            aria-label={t.common.edit}
            onClick={() => setEdit(true)}
            className="grid size-11 place-items-center text-accent"
          >
            <Pencil className="size-5" />
          </button>
        }
      />
      <div className="px-5 pb-4 pt-2">
        <div className="text-xs text-muted">{t.assets.current}</div>
        <div className="text-3xl font-semibold tabular-nums">{native}</div>
        {account.currency !== "HKD" && account.currency !== "MILES" ? (
          <div className="mt-1 text-sm text-muted">
            {t.assets.hkdEq}: {fmt(toHkd(account.balance, account.currency, rates), "HKD")}
          </div>
        ) : null}
        {account.hidden ? <div className="mt-1 text-xs text-muted">{t.assets.hiddenSection}</div> : null}
      </div>
      {linkedMortgage ? (
        <Group>
          <Row
            title={t.assets.mortgage}
            subtitle={
              mortgage
                ? `${mortgage.rateType} ${mortgage.adjustment.toFixed(2)}% · ${mortgage.effectiveRate.toFixed(2)}%`
                : undefined
            }
            to="/reports/living"
            chevron
          />
        </Group>
      ) : null}
      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.assets.history}</h2>
      <Hairline />
      {hist.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">—</p>
      ) : (
        hist.map((tx, i) => (
          <div key={tx.id}>
            {i > 0 ? <Hairline /> : null}
            <TransactionRow tx={tx} showDate onClick={() => setTx(tx.id)} />
          </div>
        ))
      )}
      {account.notes ? (
        <Disclaimer>
          {pickName(locale, account.notes, account.notesZh ?? account.notes)}
        </Disclaimer>
      ) : null}
      <AccountEditor open={edit} account={account} onClose={() => setEdit(false)} />
    </div>
  );
}

function AccountEditor({
  open,
  account,
  onClose,
}: {
  open: boolean;
  account: Account;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Overlay open={open} onClose={onClose} title={t.common.edit}>
      {open ? <AccountEditorBody key={account.id} account={account} onClose={onClose} /> : null}
    </Overlay>
  );
}

function AccountEditorBody({ account, onClose }: { account: Account; onClose: () => void }) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const updateAccount = useApp((s) => s.updateAccount);
  const updateMortgage = useApp((s) => s.updateMortgage);
  const mortgage = useApp((s) => s.mortgage);
  const [name, setName] = useState(pickName(locale, account.name, account.nameZh));
  const [type, setType] = useState<AccountType>(account.type);
  const [currency, setCurrency] = useState<Currency | "MILES">(account.currency);
  const [balance, setBalance] = useState(String(account.balance));
  const [institution, setInstitution] = useState(account.institution ?? "");
  const [include, setInclude] = useState(account.includeInNetWorth);
  const [hidden, setHidden] = useState(Boolean(account.hidden));

  return (
    <div className="px-5 pb-8">
      <label className="block py-2">
        <span className="text-xs text-muted">{t.assets.name}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.assets.type}</span>
        <select
          value={type}
          onChange={(e) => {
            const next = e.target.value as AccountType;
            setType(next);
            if (next === "miles") {
              setCurrency("MILES");
              setInclude(false);
            } else if (currency === "MILES") {
              setCurrency("HKD");
              setInclude(true);
            }
          }}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        >
          {ACCOUNT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {locale === "zh-HK" ? opt.zh : opt.en}
            </option>
          ))}
        </select>
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.more.currency}</span>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency | "MILES")}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        >
          {([...CURRENCIES, "MILES"] as const).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.assets.reconcile}</span>
        <input
          inputMode="decimal"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.assets.institution}</span>
        <input
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        />
      </label>
      <label className="mt-1 flex items-center justify-between py-3">
        <span className="text-sm">{t.assets.include}</span>
        <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} />
      </label>
      <label className="flex items-center justify-between py-3">
        <span className="text-sm">{t.assets.hidden}</span>
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
      </label>
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        onClick={async () => {
          const n = name.trim();
          if (!n) return;
          const nextBal = Number(balance);
          const next: Account = {
            ...account,
            name: n,
            nameZh: n,
            type,
            currency,
            balance: Number.isFinite(nextBal) ? nextBal : account.balance,
            includeInNetWorth: type === "miles" ? false : include,
            hidden,
            group: groupForType(type),
            institution: institution.trim() || undefined,
          };
          await updateAccount(next);
          if (mortgage && account.id === mortgage.accountId && Number.isFinite(nextBal)) {
            await updateMortgage({ ...mortgage, outstanding: Math.abs(nextBal) });
          }
          toast(t.add.savedToast);
          onClose();
        }}
      >
        {t.add.save}
      </button>
    </div>
  );
}

export function AddAccountOverlay() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const open = useUi((s) => s.addAccountOpen);
  const setOpen = useUi((s) => s.setAddAccountOpen);
  const add = useApp((s) => s.addAccount);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("current");
  const [currency, setCurrency] = useState<Currency | "MILES">("HKD");
  const [balance, setBalance] = useState("0");
  const [institution, setInstitution] = useState("");
  const [include, setInclude] = useState(true);
  const [hidden, setHidden] = useState(false);

  function reset() {
    setName("");
    setType("current");
    setCurrency("HKD");
    setBalance("0");
    setInstitution("");
    setInclude(true);
    setHidden(false);
  }

  return (
    <Overlay open={open} onClose={() => setOpen(false)} title={t.assets.addAccount}>
      <div className="px-5 pb-8">
        <label className="block py-3">
          <span className="text-xs text-muted">{t.assets.name}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.assets.type}</span>
          <select
            value={type}
            onChange={(e) => {
              const next = e.target.value as AccountType;
              setType(next);
              if (next === "miles") {
                setCurrency("MILES");
                setInclude(false);
              } else if (currency === "MILES") {
                setCurrency("HKD");
                setInclude(true);
              }
            }}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          >
            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {locale === "zh-HK" ? opt.zh : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.more.currency}</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency | "MILES")}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          >
            {([...CURRENCIES, "MILES"] as const).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.assets.opening}</span>
          <input
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
        </label>
        <label className="block py-2">
          <span className="text-xs text-muted">{t.assets.institution}</span>
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
          />
        </label>
        <label className="mt-2 flex items-center justify-between py-3">
          <span className="text-sm">{t.assets.include}</span>
          <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between py-3">
          <span className="text-sm">{t.assets.hidden}</span>
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
        </label>
        <button
          type="button"
          className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
          onClick={async () => {
            const n = name.trim();
            if (!n) return;
            await add({
              id: newId(),
              name: n,
              nameZh: n,
              type,
              currency,
              balance: Number(balance) || 0,
              includeInNetWorth: type === "miles" ? false : include,
              hidden,
              group: groupForType(type),
              institution: institution.trim() || undefined,
            });
            toast(t.add.savedToast);
            reset();
            setOpen(false);
          }}
        >
          {t.add.save}
        </button>
      </div>
    </Overlay>
  );
}
