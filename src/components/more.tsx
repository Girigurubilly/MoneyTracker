import { useRef, useState } from "react";
import { Archive, FolderTree, Globe, Lock, Repeat, Upload, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Disclaimer, Group, Hairline, Row, ScreenHeader } from "@/components/shared";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryEditor } from "@/components/category-editor";
import { pickName } from "@/lib/i18n";
import { decryptSnapshot, downloadBlob, encryptSnapshot } from "@/lib/backup";
import { transactionsToCsv } from "@/lib/derived";
import { convertBtp, isAppSnapshot, isBtpFile } from "@/lib/import-btp";
import type { Category } from "@/lib/types";
import { useApp, type AppSnapshot } from "@/store/app";
import { useT, useUi } from "@/store/ui";

export function MoreScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const resetSample = useApp((s) => s.resetSample);
  const clearAll = useApp((s) => s.clearAll);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.title} large />
      <h2 className="px-5 pb-1 text-sm font-medium text-muted">{t.more.setup}</h2>
      <Group>
        <Row icon={<FolderTree className="size-4" />} title={t.more.categories} to="/more/categories" chevron />
        <Hairline />
        <Row icon={<Repeat className="size-4" />} title={t.more.recurring} to="/budget" chevron />
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
      </Group>
      <div className="px-5 pt-6">
        <button type="button" className="h-11 w-full rounded-xl bg-elevated text-sm" onClick={() => setLocale(locale === "zh-HK" ? "en" : "zh-HK")}>
          {t.more.language}: {locale === "zh-HK" ? "繁體中文" : "English"}
        </button>
        <button type="button" className="mt-3 h-11 w-full rounded-xl bg-elevated text-sm" onClick={() => void resetSample()}>
          {t.more.sample}
        </button>
        <button type="button" className="mt-3 h-11 w-full rounded-xl bg-elevated text-sm text-expense" onClick={() => void clearAll()}>
          {t.more.clear}
        </button>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const cats = useApp((s) => s.categories);
  const accounts = useApp((s) => s.accounts);
  const [edit, setEdit] = useState<Category | null | "new-main" | "new-sub">(null);
  const [subParent, setSubParent] = useState<string>("");
  const parents = cats.filter((c) => !c.parentId);
  const editing = typeof edit === "object" ? edit : null;
  function accountLabel(id?: string) {
    const a = accounts.find((x) => x.id === id);
    return a ? pickName(locale, a.name, a.nameZh) : "";
  }
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.categories} />
      {parents.map((p) => {
        const kids = cats.filter((c) => c.parentId === p.id);
        const pAcc = accountLabel(p.defaultAccountId);
        return (
          <div key={p.id} className="mb-4">
            <button type="button" className="flex w-full items-center gap-3 px-5 py-2 text-left" onClick={() => setEdit(p)}>
              <span className="grid size-10 place-items-center rounded-full bg-elevated">
                <CategoryIcon name={p.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{pickName(locale, p.name, p.nameZh)}</span>
                <span className="text-xs text-muted">
                  {p.kind === "income" ? t.add.income : t.add.expense}
                  {pAcc ? ` · ${pAcc}` : ""}
                </span>
              </span>
            </button>
            {kids.map((c) => {
              const acc = accountLabel(c.defaultAccountId ?? p.defaultAccountId);
              return (
                <button key={c.id} type="button" className="flex w-full items-center gap-3 py-2 pl-14 pr-5 text-left" onClick={() => setEdit(c)}>
                  <span className="grid size-9 place-items-center rounded-full bg-elevated">
                    <CategoryIcon name={c.icon} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm">{pickName(locale, c.name, c.nameZh)}</span>
                    {acc ? <span className="text-xs text-muted">{acc}</span> : null}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className="px-5 py-2 text-sm text-accent"
              onClick={() => {
                setSubParent(p.id);
                setEdit("new-sub");
              }}
            >
              {t.add.newSub}
            </button>
          </div>
        );
      })}
      <div className="px-5">
        <button type="button" className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => setEdit("new-main")}>
          {t.add.newMain}
        </button>
      </div>
      <CategoryEditor
        open={edit !== null}
        onClose={() => setEdit(null)}
        initial={editing}
        defaultParentId={edit === "new-sub" ? subParent : undefined}
        defaultKind="expense"
      />
    </div>
  );
}

export function FxPage() {
  const t = useT();
  const rates = useApp((s) => s.fxRates);
  const refresh = useApp((s) => s.refreshFx);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.fx.title} />
      <p className="px-5 pb-3 text-xs text-muted">{t.fx.hint}</p>
      {rates.map((r) => (
        <div key={r.currency} className="flex justify-between px-5 py-2 text-sm">
          <span>{r.currency}</span>
          <span className="tabular-nums">{r.perHkd.toPrecision(4)}</span>
        </div>
      ))}
      <button type="button" className="mx-5 mt-4 h-11 w-[calc(100%-2.5rem)] rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => void refresh()}>
        {t.fx.refresh}
      </button>
    </div>
  );
}

export function ImportPage() {
  const t = useT();
  const replaceAll = useApp((s) => s.replaceAll);
  const jsonRef = useRef<HTMLInputElement>(null);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.import.title} />
      <div className="px-5">
        <button type="button" className="h-12 w-full rounded-xl bg-elevated text-sm" onClick={() => jsonRef.current?.click()}>
          {t.import.btp}
        </button>
        <input
          ref={jsonRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const toastId = toast.loading(t.import.replacing);
            try {
              const data: unknown = JSON.parse(await file.text());
              let snap: AppSnapshot;
              if (isBtpFile(data)) snap = convertBtp(data);
              else if (isAppSnapshot(data)) snap = data;
              else throw new Error("format");
              await replaceAll(snap);
              toast.success(`${t.import.btpDone} ${snap.transactions.length}`, { id: toastId });
            } catch {
              toast.error(t.import.btpFail, { id: toastId });
            }
          }}
        />
      </div>
    </div>
  );
}

export function BackupPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const exportSnap = useApp((s) => s.exportSnapshot);
  const replaceAll = useApp((s) => s.replaceAll);
  const txs = useApp((s) => s.transactions);
  const [password, setPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.backup.title} />
      <div className="px-5 space-y-3">
        <button type="button" className="h-11 w-full rounded-xl bg-elevated text-sm" onClick={() => downloadBlob("hk-life-money.json", JSON.stringify(exportSnap(), null, 2))}>
          {t.backup.exportJson}
        </button>
        <button type="button" className="h-11 w-full rounded-xl bg-elevated text-sm" onClick={() => downloadBlob("hk-life-money.csv", transactionsToCsv(txs), "text/csv")}>
          {t.backup.exportCsv}
        </button>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="h-11 w-full rounded-lg bg-elevated px-3" placeholder={t.backup.password} />
        <button
          type="button"
          className="h-11 w-full rounded-xl bg-elevated text-sm"
          onClick={async () => {
            if (!password) {
              toast(t.backup.needPassword);
              return;
            }
            const payload = await encryptSnapshot(JSON.stringify(exportSnap()), password);
            downloadBlob("hk-life-money.backup.json", payload);
          }}
        >
          {locale === "zh-HK" ? "加密匯出" : "Encrypted export"}
        </button>
        <button type="button" className="h-11 w-full rounded-xl bg-elevated text-sm" onClick={() => fileRef.current?.click()}>
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
            if (!file || !password) {
              toast(t.backup.needPassword);
              return;
            }
            try {
              const json = await decryptSnapshot(await file.text(), password);
              await replaceAll(JSON.parse(json) as AppSnapshot);
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
      <ScreenHeader title={t.security.title} />
      <p className="px-5 text-sm text-muted">{t.security.hint}</p>
    </div>
  );
}

export function OnboardingScreen() {
  const t = useT();
  const navigate = useNavigate();
  const ready = useApp((s) => s.ready);
  const setOnboarded = useUi((s) => s.setOnboarded);
  const reset = useApp((s) => s.resetSample);
  const clear = useApp((s) => s.clearAll);
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold">{t.onboarding.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t.onboarding.body}</p>
      <button
        type="button"
        disabled={!ready}
        className="mt-8 h-12 w-full rounded-xl bg-accent font-semibold text-on-accent disabled:opacity-50"
        onClick={async () => {
          await clear();
          setOnboarded(true);
          void navigate({ to: "/" });
        }}
      >
        {t.onboarding.start}
      </button>
      <button
        type="button"
        disabled={!ready}
        className="mt-3 h-12 w-full rounded-xl bg-elevated font-medium disabled:opacity-50"
        onClick={async () => {
          await reset();
          setOnboarded(true);
          void navigate({ to: "/" });
        }}
      >
        {t.onboarding.sample}
      </button>
    </div>
  );
}
