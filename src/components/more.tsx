import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Archive,
  Download,
  FolderTree,
  Globe,
  KeyRound,
  LayoutGrid,
  Lock,
  Plus,
  Repeat,
  Shield,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import {
  CategoryGlyph,
  Disclaimer,
  Group,
  Hairline,
  Overlay,
  Row,
  ScreenHeader,
} from "@/components/shared";
import { money } from "@/lib/format";
import { pickName } from "@/lib/i18n";
import { decryptSnapshot, downloadBlob, encryptSnapshot, parseCsv } from "@/lib/backup";
import { transactionsToCsv } from "@/lib/derived";
import { convertBtp, isAppSnapshot, isBtpFile } from "@/lib/import-btp";
import { publicUrl } from "@/lib/public-url";
import { cn } from "@/lib/utils";
import { useApp, newId, type AppSnapshot } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import type {
  Category,
  CategoryIconName,
  LifeTheme,
  Transaction,
  TxType,
} from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/types";

export function MoreScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const resetSample = useApp((s) => s.resetSample);
  const clearAll = useApp((s) => s.clearAll);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.title} large />
      <h2 className="px-5 pb-1 text-sm font-medium text-muted">{t.more.setup}</h2>
      <Group>
        <Row icon={<FolderTree className="size-4" />} title={t.more.categories} to="/more/categories" chevron />
        <Hairline />
        <Row icon={<Repeat className="size-4" />} title={t.more.recurring} to="/more/recurring" chevron />
        <Hairline />
        <Row icon={<Wallet className="size-4" />} title={t.more.budgets} to="/budget" chevron />
        <Hairline />
        <Row icon={<Globe className="size-4" />} title={t.more.fx} to="/more/fx" chevron />
      </Group>

      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.more.data}</h2>
      <Group>
        <Row icon={<Upload className="size-4" />} title={t.more.import} to="/more/import" chevron />
        <Hairline />
        <Row icon={<Archive className="size-4" />} title={t.more.backup} to="/more/backup" chevron />
        <Hairline />
        <Row icon={<Lock className="size-4" />} title={t.more.security} to="/more/security" chevron />
        <Hairline />
        <button
          type="button"
          onClick={() => void resetSample().then(() => toast(t.more.loaded))}
          className="flex w-full items-center gap-3 px-5 py-3 text-left"
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-background text-foreground">
            <Download className="size-4" />
          </span>
          <span className="flex-1 text-[15px]">{t.more.resetSample}</span>
        </button>
        <Hairline />
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="flex w-full items-center gap-3 px-5 py-3 text-left"
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-background text-expense">
            <Trash2 className="size-4" />
          </span>
          <span className="flex-1 text-[15px] text-expense">{t.more.clearAll}</span>
        </button>
      </Group>

      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.more.display}</h2>
      <Group>
        <button
          type="button"
          onClick={() => setLocale(locale === "zh-HK" ? "en" : "zh-HK")}
          className="flex w-full items-center gap-3 px-5 py-3 text-left"
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-background text-foreground">
            <Globe className="size-4" />
          </span>
          <span className="flex-1 text-[15px]">{t.more.language}</span>
          <span className="text-sm text-muted">{locale === "zh-HK" ? "繁體中文" : "English"}</span>
        </button>
        <Hairline />
        <Row icon={<SlidersHorizontal className="size-4" />} title={t.more.preferences} to="/more/preferences" chevron />
      </Group>

      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.more.about}</h2>
      <Group>
        <Row icon={<LayoutGrid className="size-4" />} title={t.more.screens} to="/more/screens" chevron />
        <Hairline />
        <Row icon={<KeyRound className="size-4" />} title={t.more.onboarding} to="/onboarding" chevron />
      </Group>
      <Disclaimer>{t.more.privacy}</Disclaimer>
      <StorageFooter />

      <Overlay open={confirm} onClose={() => setConfirm(false)} title={t.more.clearAll}>
        <div className="px-5 pb-8">
          <p className="text-sm text-muted">{t.more.confirmClear}</p>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-expense text-sm font-semibold text-on-accent"
            onClick={async () => {
              await clearAll();
              setConfirm(false);
              toast(t.more.cleared);
            }}
          >
            {t.more.clearAll}
          </button>
        </div>
      </Overlay>
    </div>
  );
}

export function CategoriesPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const categories = useApp((s) => s.categories);
  const accounts = useApp((s) => s.accounts);
  const addCategory = useApp((s) => s.addCategory);
  const updateCategory = useApp((s) => s.updateCategory);
  const themes = ["living", "travel", "retirement", "other"] as const;
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  function accountName(id?: string) {
    if (!id) return "";
    const a = accounts.find((x) => x.id === id);
    return a ? pickName(locale, a.name, a.nameZh) : "";
  }

  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.more.categories}
        backTo="/more"
        right={
          <button
            type="button"
            aria-label={t.more.addCategory}
            onClick={() => setEditing("new")}
            className="grid size-11 place-items-center text-accent"
          >
            <Plus className="size-6" />
          </button>
        }
      />
      {themes.map((theme) => {
        const themeRows = categories.filter((c) => c.theme === theme);
        if (!themeRows.length) return null;
        const roots = themeRows.filter((c) => !c.parentId || !themeRows.some((p) => p.id === c.parentId));
        const ordered = roots.flatMap((p) => [p, ...themeRows.filter((c) => c.parentId === p.id)]);
        return (
          <div key={theme}>
            <h2 className="px-5 pb-1 pt-4 text-sm font-medium text-muted">{t.themes[theme]}</h2>
            <Hairline />
            {ordered.map((c, i) => (
              <div key={c.id}>
                {i > 0 ? <Hairline /> : null}
                <button
                  type="button"
                  className={cn("flex w-full items-center gap-3 px-5 py-3 text-left", c.parentId && "pl-10")}
                  onClick={() => setEditing(c)}
                >
                  <span className="grid size-9 place-items-center rounded-full bg-elevated">
                    <CategoryGlyph name={c.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">{pickName(locale, c.name, c.nameZh)}</span>
                    {c.defaultAccountId ? (
                      <span className="block truncate text-xs text-muted">{accountName(c.defaultAccountId)}</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted">
                    {c.kind === "income" ? t.add.income : t.add.expense}
                    {c.essential ? ` · ${t.budget.essential}` : ""}
                  </span>
                </button>
              </div>
            ))}
          </div>
        );
      })}
      <div className="px-5 pt-6">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        >
          {t.more.addCategory}
        </button>
      </div>
      <CategoryEditor
        open={editing != null}
        initial={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSave={async (c) => {
          if (editing === "new") await addCategory(c);
          else await updateCategory(c);
          toast(t.add.savedToast);
          setEditing(null);
        }}
      />
    </div>
  );
}

function CategoryEditor({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: Category | null;
  onClose: () => void;
  onSave: (c: Category) => Promise<void>;
}) {
  const t = useT();
  return (
    <Overlay open={open} onClose={onClose} title={initial ? t.more.editCategory : t.more.addCategory}>
      {open ? <CategoryEditorBody key={initial?.id ?? "new"} initial={initial} onSave={onSave} /> : null}
    </Overlay>
  );
}

function CategoryEditorBody({
  initial,
  onSave,
}: {
  initial: Category | null;
  onSave: (c: Category) => Promise<void>;
}) {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const [name, setName] = useState(initial ? pickName(locale, initial.name, initial.nameZh) : "");
  const [theme, setTheme] = useState<LifeTheme>(initial?.theme ?? "living");
  const [kind, setKind] = useState<"expense" | "income">(initial?.kind ?? "expense");
  const [icon, setIcon] = useState<CategoryIconName>(initial?.icon ?? "wallet");
  const [accountId, setAccountId] = useState(initial?.defaultAccountId ?? "");
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const moneyAccounts = accounts.filter((a) => a.currency !== "MILES");
  const parents = categories.filter((c) => c.kind === kind && !c.parentId && c.id !== initial?.id);

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
      <div className="py-2">
        <span className="text-xs text-muted">{t.budget.byTheme}</span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["living", "travel", "retirement", "other"] as const).map((th) => (
            <button
              key={th}
              type="button"
              onClick={() => setTheme(th)}
              className={cn(
                "h-10 rounded-lg text-sm",
                theme === th ? "bg-accent text-on-accent" : "bg-elevated",
              )}
            >
              {t.themes[th]}
            </button>
          ))}
        </div>
      </div>
      <div className="py-2">
        <span className="text-xs text-muted">{t.more.kind}</span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind("expense")}
            className={cn(
              "h-10 rounded-lg text-sm",
              kind === "expense" ? "bg-accent text-on-accent" : "bg-elevated",
            )}
          >
            {t.add.expense}
          </button>
          <button
            type="button"
            onClick={() => setKind("income")}
            className={cn(
              "h-10 rounded-lg text-sm",
              kind === "income" ? "bg-accent text-on-accent" : "bg-elevated",
            )}
          >
            {t.add.income}
          </button>
        </div>
      </div>
      <div className="py-2">
        <span className="text-xs text-muted">{t.more.icon}</span>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {CATEGORY_ICONS.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={id}
              onClick={() => setIcon(id)}
              className={cn(
                "grid size-10 place-items-center rounded-lg",
                icon === id ? "bg-accent-soft text-accent" : "bg-elevated",
              )}
            >
              <CategoryGlyph name={id} className="size-4" />
            </button>
          ))}
        </div>
      </div>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.add.parentCategory}</span>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        >
          <option value="">{t.common.none}</option>
          {parents.map((c) => (
            <option key={c.id} value={c.id}>
              {pickName(locale, c.name, c.nameZh)}
            </option>
          ))}
        </select>
      </label>
      <label className="block py-2">
        <span className="text-xs text-muted">{t.more.defaultAccount}</span>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
        >
          <option value="">{t.common.none}</option>
          {moneyAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {pickName(locale, a.name, a.nameZh)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-faint">{t.more.defaultAccountHint}</p>
      </label>
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        onClick={async () => {
          const n = name.trim();
          if (!n) return;
          await onSave({
            id: initial?.id ?? `cat-${newId().slice(0, 8)}`,
            name: n,
            nameZh: n,
            theme,
            kind,
            icon,
            essential: initial?.essential,
            defaultAccountId: accountId || undefined,
            parentId: parentId || undefined,
          });
        }}
      >
        {t.common.save}
      </button>
    </div>
  );
}

export function RecurringPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const recurring = useApp((s) => s.recurring);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.recurring} backTo="/more" />
      <p className="px-5 pb-3 text-xs text-muted">{t.budget.regularsHint}</p>
      <Hairline />
      {recurring.map((r, i) => (
        <div key={r.id}>
          {i > 0 ? <Hairline /> : null}
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <div className="text-[15px]">{pickName(locale, r.label, r.labelZh)}</div>
              <div className="text-xs text-muted">
                {r.frequency} · {t.budget.chargedDay} {r.chargedDay ?? r.nextDate.slice(8, 10)}
                {r.essential ? ` · ${t.budget.essential}` : ""}
              </div>
            </div>
            <div
              className={cn(
                "tabular-nums text-[15px]",
                r.type === "income" ? "text-income" : "text-foreground",
              )}
            >
              {money(r.type === "expense" ? -r.amount : r.amount, r.currency, { sign: true })}
            </div>
          </div>
        </div>
      ))}
      <div className="px-5 pt-4">
        <Link
          to="/budget"
          className="flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent"
        >
          {t.budget.addRegular}
        </Link>
      </div>
    </div>
  );
}

export function FxPage() {
  const t = useT();
  const fxRates = useApp((s) => s.fxRates);
  const refresh = useApp((s) => s.refreshFx);
  const [busy, setBusy] = useState(false);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.fx.title} backTo="/more" />
      <p className="px-5 text-xs text-muted">{t.fx.indicative}</p>
      <div className="mt-3 divide-y divide-line">
        {fxRates
          .filter((r) => r.currency !== "HKD")
          .map((r) => (
            <div key={r.currency} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="text-[15px]">{r.currency}</div>
                <div className="text-xs text-muted">
                  {t.fx.asOf} {r.asOf} · {r.source}
                </div>
              </div>
              <div className="tabular-nums text-[15px]">{r.perHkd.toFixed(4)}</div>
            </div>
          ))}
      </div>
      <div className="px-5 pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await refresh();
              toast(t.fx.refreshed);
            } catch {
              toast(t.fx.failed);
            } finally {
              setBusy(false);
            }
          }}
          className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60"
        >
          {t.fx.refresh}
        </button>
      </div>
    </div>
  );
}

export function ImportPage() {
  const t = useT();
  const accounts = useApp((s) => s.accounts);
  const categories = useApp((s) => s.categories);
  const addTx = useApp((s) => s.addTransaction);
  const exportSnap = useApp((s) => s.exportSnapshot);
  const replaceAll = useApp((s) => s.replaceAll);
  const txs = useApp((s) => s.transactions);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "bundled" | File>(null);

  function parseFile(text: string) {
    const parsed = parseCsv(text);
    setRows(parsed.slice(0, 51));
  }

  async function applyJson(source: "bundled" | File) {
    setBusy(true);
    const toastId = toast.loading(t.import.replacing);
    try {
      let data: unknown;
      if (source === "bundled") {
        const res = await fetch(publicUrl("imports/budget-tracker-pro.json"));
        if (!res.ok) throw new Error("fetch");
        data = await res.json();
      } else {
        data = JSON.parse(await source.text());
      }
      let snap: AppSnapshot;
      if (isBtpFile(data)) snap = convertBtp(data);
      else if (isAppSnapshot(data)) snap = data;
      else throw new Error("format");
      await replaceAll(snap);
      toast.success(`${t.import.btpDone} ${snap.transactions.length}`, { id: toastId });
    } catch {
      toast.error(t.import.btpFail, { id: toastId });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <div className="pb-10">
      <ScreenHeader title={t.import.title} backTo="/more" />
      <p className="px-5 text-sm text-muted">{t.import.btpHint}</p>
      <Group>
        <button
          type="button"
          disabled={busy}
          className="flex w-full items-center gap-3 px-5 py-3 text-left disabled:opacity-60"
          onClick={() => setConfirm("bundled")}
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-background">
            <Archive className="size-4" />
          </span>
          <span>
            <span className="block text-[15px]">{t.import.btp}</span>
            <span className="text-xs text-muted">budget-tracker-pro.json</span>
          </span>
        </button>
        <Hairline />
        <button
          type="button"
          disabled={busy}
          className="flex w-full items-center gap-3 px-5 py-3 text-left disabled:opacity-60"
          onClick={() => jsonRef.current?.click()}
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-background">
            <Upload className="size-4" />
          </span>
          <span>
            <span className="block text-[15px]">{t.import.jsonIn}</span>
            <span className="text-xs text-muted">{t.import.chooseJson}</span>
          </span>
        </button>
      </Group>
      <input
        ref={jsonRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) setConfirm(file);
        }}
      />

      <p className="px-5 pt-6 text-sm text-muted">{t.import.wizard}</p>
      <Group>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-5 py-3 text-left"
          onClick={() => fileRef.current?.click()}
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-background">
            <Upload className="size-4" />
          </span>
          <span>
            <span className="block text-[15px]">{t.import.csvIn}</span>
            <span className="text-xs text-muted">date, amount, currency, account, category, note</span>
          </span>
        </button>
        <Hairline />
        <button
          type="button"
          className="flex w-full items-center gap-3 px-5 py-3 text-left"
          onClick={() => {
            downloadBlob("hk-life-money.csv", transactionsToCsv(txs), "text/csv");
            toast(t.import.exported);
          }}
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-background">
            <Download className="size-4" />
          </span>
          <span className="text-[15px]">{t.import.csvOut}</span>
        </button>
        <Hairline />
        <button
          type="button"
          className="flex w-full items-center gap-3 px-5 py-3 text-left"
          onClick={() => {
            downloadBlob("hk-life-money.json", JSON.stringify(exportSnap(), null, 2));
            toast(t.import.exported);
          }}
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-background">
            <Download className="size-4" />
          </span>
          <span className="text-[15px]">{t.import.jsonOut}</span>
        </button>
      </Group>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          parseFile(await file.text());
          e.target.value = "";
        }}
      />
      <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.import.preview}</h2>
      <div className="mx-4 overflow-x-auto rounded-xl bg-elevated">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="text-muted">
            <tr>
              {(rows[0] ?? ["date", "amount", "account", "note"]).slice(0, 4).map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows.length > 1 ? rows.slice(1, 8) : []).map((r, i) => (
              <tr key={i} className="border-t border-line">
                {r.slice(0, 4).map((c, j) => (
                  <td key={j} className="px-3 py-2">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 pt-4">
        <button
          type="button"
          disabled={rows.length < 2 || busy}
          onClick={async () => {
            setBusy(true);
            const mapped = mapCsv(rows, accounts, categories);
            let n = 0;
            for (const tx of mapped.ok) {
              await addTx(tx);
              n += 1;
            }
            toast(`${t.import.committed} ${n} · ${mapped.skipped} ${t.import.skipped}`);
            setRows([]);
            setBusy(false);
          }}
          className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:bg-elevated disabled:text-muted"
        >
          {t.import.commit}
        </button>
      </div>

      <Overlay open={confirm != null} onClose={() => !busy && setConfirm(null)} title={t.import.jsonIn}>
        <div className="px-5 pb-8">
          <p className="text-sm text-muted">{t.import.confirmReplace}</p>
          <button
            type="button"
            disabled={busy}
            className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60"
            onClick={() => confirm && void applyJson(confirm)}
          >
            {busy ? t.import.replacing : t.import.commit}
          </button>
        </div>
      </Overlay>
    </div>
  );
}

function mapCsv(
  rows: string[][],
  accounts: { id: string; name: string; nameZh: string }[],
  categories: { id: string; name: string; nameZh: string }[],
): { ok: Omit<Transaction, "id">[]; skipped: number } {
  if (rows.length < 2) return { ok: [], skipped: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iDate = idx("date");
  const iAmt = idx("amount");
  const iCur = idx("currency");
  const iType = idx("type");
  const iAcc = Math.max(idx("account"), idx("accountid"));
  const iTo = Math.max(idx("toaccount"), idx("toaccountid"));
  const iCat = Math.max(idx("category"), idx("categoryid"));
  const iPayee = Math.max(idx("payee"), idx("note"));
  const iTrip = idx("tripid");
  let skipped = 0;
  const ok: Omit<Transaction, "id">[] = [];
  for (const row of rows.slice(1)) {
    const date = row[iDate]?.trim();
    const amtRaw = Number(row[iAmt]);
    if (!date || Number.isNaN(amtRaw)) {
      skipped += 1;
      continue;
    }
    const accRaw = row[iAcc]?.trim() ?? "";
    const account =
      accounts.find((a) => a.id === accRaw) ??
      accounts.find((a) => a.name.toLowerCase() === accRaw.toLowerCase() || a.nameZh === accRaw);
    if (!account) {
      skipped += 1;
      continue;
    }
    const catRaw = iCat >= 0 ? row[iCat]?.trim() ?? "" : "";
    const category = categories.find(
      (c) => c.id === catRaw || c.name.toLowerCase() === catRaw.toLowerCase() || c.nameZh === catRaw,
    );
    const typeRaw = (iType >= 0 ? row[iType] : "").toLowerCase() as TxType | "";
    const type: TxType =
      typeRaw === "income" || typeRaw === "expense" || typeRaw === "transfer" || typeRaw === "miles"
        ? typeRaw
        : amtRaw < 0
          ? "expense"
          : "income";
    const payee = (iPayee >= 0 ? row[iPayee] : "") || category?.name || "Imported";
    ok.push({
      type,
      amount: Math.abs(amtRaw),
      currency: ((iCur >= 0 ? row[iCur] : "HKD") as Transaction["currency"]) || "HKD",
      accountId: account.id,
      toAccountId: iTo >= 0 && row[iTo] ? row[iTo] : undefined,
      categoryId: category?.id,
      date,
      payee,
      payeeZh: payee,
      tripId: iTrip >= 0 && row[iTrip] ? row[iTrip] : undefined,
    });
  }
  return { ok, skipped };
}

export function BackupPage() {
  const t = useT();
  const exportSnap = useApp((s) => s.exportSnapshot);
  const replaceAll = useApp((s) => s.replaceAll);
  const [password, setPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="pb-10">
      <ScreenHeader title={t.backup.title} backTo="/more" />
      <p className="px-5 text-sm text-muted">{t.backup.warn}</p>
      <div className="px-5 pt-4">
        <label className="text-xs text-muted">{t.backup.password}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={async () => {
            if (!password) {
              toast(t.backup.needPassword);
              return;
            }
            const json = JSON.stringify(exportSnap());
            const payload = await encryptSnapshot(json, password);
            downloadBlob("hk-life-money.backup.json", payload);
            toast(t.backup.exported);
          }}
          className="mt-3 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
        >
          {t.backup.export}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-2 h-11 w-full rounded-xl bg-elevated text-sm"
        >
          {t.backup.restore}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (!password) {
              toast(t.backup.needPassword);
              return;
            }
            try {
              const payload = await file.text();
              const json = await decryptSnapshot(payload, password);
              const snap = JSON.parse(json) as AppSnapshot;
              await replaceAll(snap);
              toast(t.backup.restored);
            } catch {
              toast(t.backup.badPassword);
            }
          }}
        />
      </div>
      <Disclaimer>{t.backup.aes}</Disclaimer>
    </div>
  );
}

export function SecurityPage() {
  const t = useT();
  return (
    <div className="pb-10">
      <ScreenHeader title={t.security.title} backTo="/more" />
      <Group>
        <Row icon={<Shield className="size-4" />} title={t.security.lock} trailing={t.common.no} />
        <Hairline />
        <Row title={t.security.minutes} trailing="5" />
      </Group>
      <Disclaimer>{t.security.note}</Disclaimer>
    </div>
  );
}

export function PreferencesPage() {
  const t = useT();
  const first = useUi((s) => s.firstDayOfWeek);
  const setFirst = useUi((s) => s.setFirstDay);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.preferences} backTo="/more" />
      <Group>
        <button
          type="button"
          onClick={() => setFirst(first === 0 ? 1 : 0)}
          className="flex w-full items-center justify-between px-5 py-3 text-left"
        >
          <span>{t.more.firstDay}</span>
          <span className="text-muted">{first === 0 ? t.more.sunday : t.more.monday}</span>
        </button>
        <Hairline />
        <Row title={t.more.currency} trailing="HKD" />
      </Group>
    </div>
  );
}

export function ScreensPage() {
  const t = useT();
  const screens = [
    { to: "/", label: t.nav.today },
    { to: "/assets", label: t.nav.assets },
    { to: "/budget", label: t.nav.budget },
    { to: "/reports", label: t.nav.reports },
    { to: "/reports/dashboard", label: t.reports.dashboard },
    { to: "/reports/history", label: t.reports.history },
    { to: "/reports/spending", label: t.reports.spending },
    { to: "/reports/living", label: t.reports.living },
    { to: "/reports/travel", label: t.reports.travel },
    { to: "/reports/cashflow", label: t.reports.cashflow },
    { to: "/reports/retirement", label: t.reports.retirement },
    { to: "/more", label: t.nav.more },
    { to: "/more/categories", label: t.more.categories },
    { to: "/more/recurring", label: t.more.recurring },
    { to: "/more/fx", label: t.more.fx },
    { to: "/more/import", label: t.more.import },
    { to: "/more/backup", label: t.more.backup },
    { to: "/more/security", label: t.more.security },
    { to: "/onboarding", label: t.more.onboarding },
  ];
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.screens} backTo="/more" />
      <Group>
        {screens.map((s, i) => (
          <div key={s.to}>
            {i > 0 ? <Hairline /> : null}
            <Link to={s.to} className="flex items-center justify-between px-5 py-3">
              <span>{s.label}</span>
              <span className="text-xs text-faint">{s.to}</span>
            </Link>
          </div>
        ))}
      </Group>
    </div>
  );
}

function StorageFooter() {
  const t = useT();
  const [est, setEst] = useState<{ used: number; quota: number; persisted?: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    const n = typeof navigator !== "undefined" ? navigator.storage : undefined;
    if (!n?.estimate) return;
    void Promise.all([n.estimate(), n.persisted?.() ?? Promise.resolve(undefined)]).then(([e, p]) => {
      if (!alive) return;
      setEst({ used: e.usage ?? 0, quota: e.quota ?? 0, persisted: p });
    });
    void n.persist?.();
    return () => {
      alive = false;
    };
  }, []);

  function fmt(n: number) {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} GB`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
    if (n >= 1_000) return `${Math.round(n / 1_000)} KB`;
    return `${n} B`;
  }

  return (
    <div className="px-5 pb-8 pt-2 text-xs text-muted">
      <div className="font-medium text-foreground">{t.more.storage}</div>
      {est ? (
        <p className="mt-1">
          {t.more.storageUsed} {fmt(est.used)}
          {est.quota ? ` · ${t.more.storageQuota} ${fmt(est.quota)}` : ""}
          {est.persisted ? ` · ${t.more.persist}` : ""}
        </p>
      ) : (
        <p className="mt-1">{t.more.privacy}</p>
      )}
      <p className="mt-2">{t.more.githubPages}</p>
    </div>
  );
}
