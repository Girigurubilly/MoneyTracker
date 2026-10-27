import { useEffect, useRef, useState } from "react";
import { Archive, BookOpen, CalendarClock, Check, FolderTree, Globe, Palette, PiggyBank, Settings2, ShoppingBag, SlidersHorizontal, TrendingUp, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Disclaimer, Group, Hairline, Overlay, Row, ScreenHeader, SectionLabel } from "@/components/shared";
import { CurrencySelect } from "@/components/currency-field";
import { CategoryPicker } from "@/components/category-picker";
import { pickName } from "@/lib/i18n";
import { downloadBlob, encryptSnapshot } from "@/lib/backup";
import { copyPlainText } from "@/lib/copy-text";
import {
  downloadBackup,
  downloadBackupById,
  getAccessToken,
  listDriveBackups,
  readGoogleClientId,
  rememberDrivePick,
  startGoogleSignIn,
  storedAccessToken,
  takeDrivePick,
  takePendingDriveAction,
  takeRedirectToken,
  uploadBackup,
  driveFileInstant,
  type DriveBackupRef,
} from "@/lib/google-drive";
import { markDailyDriveSync, markLocalEdit, noteNewestDriveFile, readDrivePass, writeDrivePass, encodeDriveBody, decodeDriveBody, syncWithDrive } from "@/lib/drive-sync";
import { transactionsToCsv } from "@/lib/derived";
import { convertBtp, isAppSnapshot, isBtpFile } from "@/lib/import-btp";
import { CURRENCIES, MONTH_TOTAL_BUDGET_ID, type BudgetTargetMode } from "@/lib/types";
import { ageFromBirthday } from "@/lib/calc/retirement";
import { buildFcBaseline, renderFcBaselineMarkdown, todayHkt } from "@/lib/calc/fc-baseline";
import { todayISO } from "@/lib/format";
import { useApp, type AppSnapshot } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { ACCESS_MODES, DEPTH_IDS, FONT_IDS, FONT_SIZE_IDS, FONT_STACKS, MOTION_IDS, RADIUS_IDS, THEME_IDS, THEME_PRESETS, normalizeHex, type DepthId, type FontId, type FontSizeId, type MotionId, type RadiusId, type ThemeId } from "@/lib/theme";
import { persistPwaIcon, readSavedPwaIcon, resizeImageFile, resizeWallpaperFile } from "@/lib/pwa-icon";
import { assetUrl } from "@/lib/base";
import { cn } from "@/lib/utils";

function driveWhen(iso: string, locale: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return iso || "—";
  return d.toLocaleString(locale === "zh-HK" ? "zh-HK" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function MoreScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const access = useUi((s) => s.accessMode);
  const kid = access === "kid";
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.title} large />
      {kid ? null : (
        <>
          <SectionLabel>{t.more.money}</SectionLabel>
          <Group>
            <Row icon={<Wallet className="size-4" />} title={t.more.budgets} to="/budget" chevron />
            <Hairline />
            <Row icon={<CalendarClock className="size-4" />} title={t.more.adhocPlan} to="/more/adhoc" chevron />
            <Hairline />
            <Row icon={<ShoppingBag className="size-4" />} title={t.more.wishlist} to="/more/wishlist" chevron />
            <Hairline />
            <Row icon={<TrendingUp className="size-4" />} title={t.more.holdings} to="/more/holdings" chevron />
            <Hairline />
            <Row icon={<PiggyBank className="size-4" />} title={t.more.retireAccounts} to="/more/retirement-accounts" chevron />
            <Hairline />
            <Row icon={<PiggyBank className="size-4" />} title={t.more.deposits} to="/more/deposits" chevron />
            <Hairline />
            <Row icon={<Globe className="size-4" />} title={t.more.fx} to="/more/fx" chevron />
          </Group>
        </>
      )}
      <SectionLabel>{t.more.setup}</SectionLabel>
      <Group>
        <Row icon={<SlidersHorizontal className="size-4" />} title={t.more.prefs} to="/more/setup" chevron />
        {kid ? null : (
          <>
            <Hairline />
            <Row icon={<FolderTree className="size-4" />} title={t.more.categories} to="/more/categories" chevron />
          </>
        )}
        <Hairline />
        <Row icon={<Palette className="size-4" />} title={t.more.appearance} to="/more/appearance" chevron />
      </Group>
      {kid ? (
        <>
          <SectionLabel>{t.more.money}</SectionLabel>
          <Group>
            <Row icon={<Wallet className="size-4" />} title={t.more.budgets} to="/budget" chevron />
          </Group>
        </>
      ) : null}
      <SectionLabel>{t.more.quickFix}</SectionLabel>
      <Group>
        <UndoLastRow />
      </Group>
      {kid ? null : (
        <>
          <SectionLabel>{t.more.data}</SectionLabel>
          <Group>
            <Row icon={<Archive className="size-4" />} title={t.more.importBackup} to="/more/backup" chevron />
            <Hairline />
            <Row icon={<Settings2 className="size-4" />} title={t.more.other} to="/more/other" chevron />
          </Group>
        </>
      )}
      <div className="px-5 pt-6">
        <button type="button" className="h-11 w-full rounded-xl bg-elevated text-sm" onClick={() => setLocale(locale === "zh-HK" ? "en" : "zh-HK")}>
          {t.more.language}: {locale === "zh-HK" ? "繁體中文" : "English"}
        </button>
      </div>
    </div>
  );
}

function UndoLastRow() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const lastId = useApp((s) => s.lastPostedTxId);
  const txs = useApp((s) => s.transactions);
  const undo = useApp((s) => s.undoLastTransaction);
  const last = lastId ? txs.find((tx) => tx.id === lastId) : undefined;
  return (
    <Row
      icon={<Undo2 className="size-4" />}
      title={t.more.undoLast}
      onClick={async () => {
        if (!last) {
          toast(t.more.undoEmpty);
          return;
        }
        const prev = await undo();
        if (prev) toast(t.more.undoDone.replace("{name}", pickName(locale, prev.payee, prev.payeeZh) || t.add.transfer));
        else toast(t.more.undoEmpty);
      }}
    />
  );
}

export function CategoriesPage() {
  const t = useT();
  const cats = useApp((s) => s.categories);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col pb-4">
      <ScreenHeader title={t.more.categories} backTo="/more" />
      <CategoryPicker
        categories={cats}
        kind={kind}
        txType={kind}
        onTxTypeChange={(next) => setKind(next === "income" ? "income" : "expense")}
        onClose={() => undefined}
        onSelect={() => undefined}
        embedded
        manageOnly
      />
    </div>
  );
}

export function FxPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const rates = useApp((s) => s.fxRates);
  const refresh = useApp((s) => s.refreshFx);
  const lastFxSyncAt = useApp((s) => s.lastFxSyncAt);
  const defaultCurrency = useApp((s) => s.defaultCurrency);
  const setDefaultCurrency = useApp((s) => s.setDefaultCurrency);
  const [busy, setBusy] = useState(false);
  const shown = rates
    .filter((r) => (CURRENCIES as readonly string[]).includes(r.currency))
    .sort((a, b) => a.currency.localeCompare(b.currency));
  const asOf = shown.map((r) => r.asOf).filter(Boolean).sort().at(-1);
  async function onRefresh() {
    if (busy) return;
    setBusy(true);
    try {
      await refresh();
      toast.success(t.fx.updated);
    } catch {
      toast.error(t.fx.failed);
    } finally {
      setBusy(false);
    }
  }
  const syncedLabel = lastFxSyncAt
    ? formatFxSync(lastFxSyncAt, locale)
    : t.fx.lastSyncedNever;
  const flags: Record<string, string> = {
    HKD: "🇭🇰",
    USD: "🇺🇸",
    JPY: "🇯🇵",
    CNY: "🇨🇳",
    TWD: "🇹🇼",
    THB: "🇹🇭",
    GBP: "🇬🇧",
    EUR: "🇪🇺",
    AUD: "🇦🇺",
    SGD: "🇸🇬",
    CHF: "🇨🇭",
    MOP: "🇲🇴",
    KRW: "🇰🇷",
    CAD: "🇨🇦",
    NZD: "🇳🇿",
    INR: "🇮🇳",
  };
  return (
    <div className="pb-10">
      <ScreenHeader
        title={t.fx.title}
        backTo="/more"
        right={
          <button type="button" disabled={busy} className="h-11 px-3 text-sm font-medium text-accent disabled:opacity-50" onClick={() => void onRefresh()}>
            {t.fx.refresh}
          </button>
        }
      />
      <p className="px-5 pb-3 text-xs text-muted">{t.fx.hint}</p>
      <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-elevated p-4">
        <div className="text-xs font-medium text-accent">{t.fx.defaultCurrency}</div>
        <p className="mt-1 text-xs text-muted">{t.fx.defaultHint}</p>
        <div className="mt-3">
          <CurrencySelect
            value={defaultCurrency}
            onChange={(c) => void setDefaultCurrency(c)}
            className="h-11 w-full rounded-lg bg-background px-3 text-sm"
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          {asOf ? `${t.fx.asOf} ${asOf}` : null}
          {asOf ? " · " : null}
          {t.fx.lastSynced}: {syncedLabel}
        </p>
      </div>
      <div className="mx-4 space-y-2">
        {shown.map((r) => (
          <div key={r.currency} className="flex items-center gap-3 rounded-2xl bg-elevated px-4 py-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-background text-lg">{flags[r.currency] ?? "💱"}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{r.currency}</span>
              <span className="text-xs text-muted">1 {r.currency} → HKD</span>
            </span>
            <span className="text-right">
              <span className="block text-base font-semibold tabular-nums">{r.perHkd.toPrecision(4)}</span>
              <span className="text-[11px] text-muted">HKD</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatFxSync(iso: string, locale: "en" | "zh-HK"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString(locale === "zh-HK" ? "zh-HK" : "en-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ImportPage() {
  return <BackupPage />;
}

export function BackupPage() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const exportSnap = useApp((s) => s.exportSnapshot);
  const replaceAll = useApp((s) => s.replaceAll);
  const txs = useApp((s) => s.transactions);
  const [password, setPassword] = useState(readDrivePass());
  const [busy, setBusy] = useState(false);
  const [copies, setCopies] = useState<DriveBackupRef[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const fcConfirmedFacts = useApp((s) => s.fcConfirmedFacts);
  const fcOpenGaps = useApp((s) => s.fcOpenGaps);
  const setFcNotes = useApp((s) => s.setFcNotes);
  const syncPromoFromDeposits = useApp((s) => s.syncPromoFromDeposits);
  const [gapsText, setGapsText] = useState(() => fcOpenGaps.join("\n"));

  async function persistGaps() {
    const gaps = gapsText.split("\n").map((l) => l.trim()).filter(Boolean);
    await setFcNotes(fcConfirmedFacts, gaps);
  }

  async function makeFcBaseline() {
    await syncPromoFromDeposits();
    await persistGaps();
    const s = useApp.getState();
    const asOf = todayHkt();
    const monthCap = s.budgets.find((b) => b.id === MONTH_TOTAL_BUDGET_ID)?.monthly ?? 0;
    const snap = buildFcBaseline({
      asOf,
      accounts: s.accounts,
      deposits: s.deposits,
      promo: s.promoSavings,
      holdings: s.holdings,
      mortgage: s.mortgage,
      retirementAccounts: s.retirementAccounts,
      allowances: s.allowances,
      adhoc: s.adhocBudgets,
      rates: s.fxRates,
      plans: s.yearlyPlans,
      txs: s.transactions,
      categories: s.categories,
      recurring: s.recurring,
      monthCap,
      confirmedFacts: s.fcConfirmedFacts.length ? s.fcConfirmedFacts : undefined,
      openGaps: s.fcOpenGaps,
    });
    const warnChecks = snap.checks.filter((c) =>
      ["missing_balance_basis", "holdings_derived_empty", "promo_expected_but_empty", "bank_total_td_promo_overshoot", "holdings_investment_mismatch", "liability_unexplained_diff"].includes(c.code),
    );
    if (warnChecks.length && !window.confirm(`${t.backup.baselineWarn}\n\n${warnChecks.map((c) => c.detail).join("\n")}`)) {
      return null;
    }
    return { snap, asOf };
  }

  function setPass(next: string) {
    setPassword(next);
    writeDrivePass(next.trim());
  }

  async function importPayload(text: string, quiet = false) {
    const pass = password.trim() || readDrivePass();
    let snap: AppSnapshot;
    try {
      snap = await decodeDriveBody(text, pass);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "pass") {
        toast(t.backup.needPassword);
        return;
      }
      if (msg === "bad-pass") {
        toast(t.backup.badPassword);
        return;
      }
      throw err;
    }
    await replaceAll(snap);
    if (!quiet) toast(t.backup.restored);
  }

  async function refreshCopies(token: string) {
    const files = await listDriveBackups(token);
    files.sort((a, b) => driveFileInstant(b).localeCompare(driveFileInstant(a)) || b.id.localeCompare(a.id));
    setCopies(files);
  }

  async function restoreFile(token: string, id: string) {
    const text = await downloadBackupById(token, id);
    await importPayload(text);
    markLocalEdit();
    markDailyDriveSync();
    await refreshCopies(token);
  }

  async function runDrive(action: "save" | "restore" | "sync" | "list", token: string) {
    const pass = password.trim() || readDrivePass();
    if (!pass) {
      toast(t.backup.driveNeedPass);
      return;
    }
    writeDrivePass(pass);
    if (action === "save") {
      await uploadBackup(token, await encodeDriveBody(exportSnap(), pass));
      await noteNewestDriveFile(token);
      markLocalEdit();
      markDailyDriveSync();
      toast(t.backup.driveSaved);
      await refreshCopies(token);
      return;
    }
    if (action === "list") {
      await refreshCopies(token);
      return;
    }
    if (action === "restore") {
      const picked = takeDrivePick();
      if (picked) await restoreFile(token, picked);
      else {
        const text = await downloadBackup(token);
        await importPayload(text);
        markLocalEdit();
        markDailyDriveSync();
        await refreshCopies(token);
      }
      return;
    }
    const result = await syncWithDrive({ exportSnapshot: exportSnap, replaceAll });
    if (result === "need-pass") {
      toast(t.backup.driveNeedPass);
      return;
    }
    if (result === "need-auth") {
      startGoogleSignIn("sync");
      return;
    }
    if (result === "fail" || result === "offline") {
      toast(t.backup.driveFail);
      return;
    }
    markDailyDriveSync();
    await refreshCopies(token);
    toast(t.backup.synced);
  }

  useEffect(() => {
    let token: string | null = null;
    try {
      token = takeRedirectToken();
    } catch {
      toast(t.backup.driveFail);
      return;
    }
    if (!token) return;
    const action = takePendingDriveAction();
    if (!action) {
      void refreshCopies(token).catch(() => undefined);
      return;
    }
    setBusy(true);
    void runDrive(action, token)
      .catch((err) => {
        const msg = (err as Error).message;
        if (msg === "missing") toast(t.backup.driveMissing);
        else if (msg === "auth") {
          try {
            startGoogleSignIn(action);
          } catch {
            toast(t.backup.driveFail);
          }
        } else toast(t.backup.driveFail);
      })
      .finally(() => setBusy(false));
    // snapshot + password from this render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const token = storedAccessToken();
    if (!token) return;
    void refreshCopies(token).catch(() => undefined);
    // load the Drive list when this page already has a session token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function beginDrive(action: "save" | "restore" | "sync" | "list") {
    if (busy) return;
    if (!readGoogleClientId()) {
      toast(t.backup.driveNeedClient);
      return;
    }
    if (!(password.trim() || readDrivePass())) {
      toast(t.backup.driveNeedPass);
      return;
    }
    writeDrivePass(password.trim() || readDrivePass());
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (token) {
        await runDrive(action, token);
        return;
      }
      startGoogleSignIn(action);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "auth") {
        try {
          startGoogleSignIn(action);
          return;
        } catch {
          /* fall through */
        }
      }
      if (msg === "missing") toast(t.backup.driveMissing);
      else toast(t.backup.driveFail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.importBackup} backTo="/more" />
      <SectionLabel>{t.backup.drive}</SectionLabel>
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.backup.driveHint}</p>
      <div className="px-4">
        <label htmlFor="backup-pass" className="text-[11px] font-medium text-muted">
          {t.backup.password}
        </label>
        <input
          id="backup-pass"
          value={password}
          onChange={(e) => setPass(e.target.value)}
          type="password"
          autoComplete="off"
          className="mt-1 h-11 w-full rounded-lg bg-elevated px-3 text-sm"
          placeholder={t.backup.password}
        />
        <p className="mt-2 text-xs leading-5 text-muted">{t.backup.drivePassHint}</p>
        <button
          type="button"
          disabled={busy}
          className="tr-press mt-3 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60"
          onClick={() => beginDrive("sync")}
        >
          {t.backup.driveSync}
        </button>
      </div>
      <div className={cn("mt-3", busy && "pointer-events-none opacity-60")}>
        <Group>
          <Row title={t.backup.driveSave} onClick={() => beginDrive("save")} />
          <Hairline />
          <Row title={t.backup.driveList} onClick={() => beginDrive("list")} />
        </Group>
      </div>
      {copies ? (
        <div className="mx-4 mt-3 overflow-hidden rounded-xl bg-elevated">
          {copies.length ? (
            copies.map((file, i) => {
              const when = driveWhen(driveFileInstant(file), locale);
              return (
                <div key={file.id} className={i > 0 ? "border-t border-line" : ""}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm tabular-nums">{when}</div>
                      {i === 0 ? <div className="text-[11px] text-accent">{t.backup.driveNewest}</div> : null}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      className="tr-press h-9 shrink-0 rounded-lg bg-background px-3 text-xs font-medium disabled:opacity-60"
                      onClick={() => {
                        if (!window.confirm(t.backup.driveConfirm.replace("{time}", when))) return;
                        rememberDrivePick(file.id);
                        void beginDrive("restore");
                      }}
                    >
                      {t.backup.driveRestoreThis}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="px-4 py-3 text-sm text-muted">{t.backup.driveMissing}</p>
          )}
        </div>
      ) : null}
      <div className="px-4 pt-3">
        <button
          type="button"
          disabled={busy}
          className="tr-press h-11 w-full rounded-xl bg-elevated text-sm text-expense disabled:opacity-60"
          onClick={() => {
            if (!window.confirm(t.backup.replaceDevice)) return;
            rememberDrivePick("");
            void beginDrive("restore");
          }}
        >
          {t.backup.driveRestore}
        </button>
      </div>
      <SectionLabel>{t.backup.deviceSection}</SectionLabel>
      <Group>
        <Row title={t.backup.exportJson} onClick={() => downloadBlob("hk-life-money.json", JSON.stringify(exportSnap(), null, 2))} />
        <Hairline />
        <Row title={t.backup.exportCsv} onClick={() => downloadBlob("hk-life-money.csv", transactionsToCsv(txs), "text/csv")} />
        <Hairline />
        <Row
          title={t.backup.encryptedExport}
          onClick={() => {
            void (async () => {
              if (!password) {
                toast(t.backup.needPassword);
                return;
              }
              const payload = await encryptSnapshot(JSON.stringify(exportSnap()), password);
              downloadBlob("hk-life-money.backup.json", payload);
            })();
          }}
        />
        <Hairline />
        <Row title={t.backup.restore} subtitle={t.backup.replaceDevice} onClick={() => fileRef.current?.click()} />
      </Group>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const snap = await decodeDriveBody(await file.text(), password.trim() || readDrivePass());
            if (!window.confirm(t.backup.replaceDevice)) return;
            await replaceAll(snap);
            toast(t.backup.restored);
          } catch {
            toast(t.backup.badPassword);
          }
        }}
      />
      <Disclaimer>{t.backup.aes}</Disclaimer>

      <SectionLabel>{t.import.title}</SectionLabel>
      <Group>
        <Row title={t.import.btp} subtitle={t.backup.replaceDevice} onClick={() => importRef.current?.click()} />
      </Group>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const data: unknown = JSON.parse(await file.text());
            let snap: AppSnapshot;
            if (isBtpFile(data)) snap = convertBtp(data);
            else if (isAppSnapshot(data)) snap = data;
            else throw new Error("format");
            if (!window.confirm(t.backup.replaceDevice)) return;
            const toastId = toast.loading(t.import.replacing);
            await replaceAll(snap);
            toast.success(`${t.import.btpDone} ${snap.transactions.length}`, { id: toastId });
          } catch {
            toast.error(t.import.btpFail);
          }
        }}
      />

      <SectionLabel>{t.backup.baselineSection}</SectionLabel>
      <Group>
        <Row
          title={t.backup.exportBaseline}
          onClick={() => {
            void (async () => {
              const out = await makeFcBaseline();
              if (!out) return;
              const { snap, asOf } = out;
              downloadBlob(`hk-life-fc-baseline-${asOf}.json`, JSON.stringify(snap, null, 2));
              downloadBlob(`hk-life-fc-baseline-${asOf}.md`, renderFcBaselineMarkdown(snap), "text/markdown");
            })();
          }}
        />
        <Hairline />
        <Row
          title={t.backup.copyBaselineJson}
          onClick={() => {
            void (async () => {
              const out = await makeFcBaseline();
              if (!out) return;
              const json = JSON.stringify(out.snap, null, 2);
              if (await copyPlainText(json)) toast(t.backup.baselineCopied);
              else toast(t.backup.copyFailed);
            })();
          }}
        />
      </Group>
      <div className="mx-4 mt-3 rounded-xl bg-elevated p-3">
        <div className="text-xs font-medium text-muted">{t.backup.baselineGaps}</div>
        <textarea
          value={gapsText}
          onChange={(e) => setGapsText(e.target.value)}
          onBlur={() => void persistGaps()}
          rows={3}
          className="mt-2 w-full rounded-lg bg-background px-3 py-2 text-xs leading-5"
        />
        <p className="pt-2 text-[11px] leading-4 text-muted">{t.backup.baselineGapsHint}</p>
      </div>
    </div>
  );
}

export function SecurityPage() {
  const t = useT();
  return (
    <div className="pb-10">
      <ScreenHeader title={t.security.title} backTo="/more" />
      <p className="px-5 text-sm text-muted">{t.security.hint}</p>
    </div>
  );
}

export function SetupPage() {
  const t = useT();
  const mode = useApp((s) => s.budgetTargetMode);
  const setMode = useApp((s) => s.setBudgetTargetMode);
  const ret = useApp((s) => s.retirement);
  const updateRetirement = useApp((s) => s.updateRetirement);
  const birthday = ret?.birthday ?? "";
  function persistBirthday(value: string) {
    const next = value || undefined;
    const base = ret ?? {
      id: "base",
      currentAge: 40,
      retireAge: 65,
      deathAge: 90,
      monthlyIncomeNow: 0,
      monthlySpendNow: 0,
      targetMonthly: 25000,
      preReturn: 0.05,
      postReturn: 0.035,
      inflation: 0.025,
      travelInRetirement: 0,
    };
    void updateRetirement({
      ...base,
      birthday: next,
      currentAge: next ? ageFromBirthday(next, todayISO()) : base.currentAge,
    });
  }
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.prefs} backTo="/more" />
      <h2 className="px-5 pb-2 text-sm font-medium text-muted">{t.more.targetMode}</h2>
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.more.targetModeHint}</p>
      <div className="mx-4 mb-6 grid grid-cols-2 gap-2">
        {(["all", "regular"] as BudgetTargetMode[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => void setMode(id)}
            className={cn(
              "rounded-2xl px-3 py-3 text-left text-sm font-medium",
              mode === id ? "bg-accent text-on-accent" : "bg-elevated ring-1 ring-line",
            )}
          >
            <span className="block">{id === "all" ? t.more.targetAll : t.more.targetRegular}</span>
            <span className={cn("mt-1 block text-[11px] font-normal leading-4", mode === id ? "text-on-accent/80" : "text-muted")}>
              {id === "all" ? t.more.targetAllHint : t.more.targetRegularHint}
            </span>
          </button>
        ))}
      </div>
      <h2 className="px-5 pb-2 text-sm font-medium text-muted">{t.reports.birthday}</h2>
      <p className="px-5 pb-3 text-xs leading-5 text-muted">{t.more.birthdayHint}</p>
      <label className="mx-4 flex items-center justify-between rounded-2xl bg-elevated px-4 py-3">
        <span className="text-sm">{t.reports.birthday}</span>
        <input
          type="date"
          value={birthday}
          onChange={(e) => persistBirthday(e.target.value)}
          className="h-10 bg-transparent text-sm text-accent outline-none"
        />
      </label>
      {birthday ? <p className="px-5 pt-2 text-xs text-muted">{t.reports.currentAge}: {ageFromBirthday(birthday, todayISO())}</p> : null}
    </div>
  );
}

export function AppearancePage() {
  const t = useT();
  const theme = useUi((s) => s.theme);
  const custom = useUi((s) => s.customColors);
  const setTheme = useUi((s) => s.setTheme);
  const setCustomColor = useUi((s) => s.setCustomColor);
  const setFontId = useUi((s) => s.setFontId);
  const setFontSize = useUi((s) => s.setFontSize);
  const setWallpaper = useUi((s) => s.setWallpaper);
  const setWallpaperOpacity = useUi((s) => s.setWallpaperOpacity);
  const setRadius = useUi((s) => s.setRadius);
  const setMotion = useUi((s) => s.setMotion);
  const setDepth = useUi((s) => s.setDepth);
  const setAccessMode = useUi((s) => s.setAccessMode);
  const accessMode = useUi((s) => s.accessMode);
  const resetCustomColors = useUi((s) => s.resetCustomColors);
  const labels: Record<ThemeId, string> = {
    normal: t.more.themeNormal,
    dark: t.more.themeDark,
    pinky: t.more.themePinky,
    anime: t.more.themeAnime,
    cyberpunk: t.more.themeCyberpunk,
    shiba: t.more.themeShiba,
    cat: t.more.themeCat,
    panda: t.more.themePanda,
    hongkong: t.more.themeHongkong,
    mist: t.more.themeMist,
    ink: t.more.themeInk,
  };
  const fontLabels: Record<FontId, string> = {
    theme: t.more.fontTheme,
    system: t.more.fontSystem,
    nunito: t.more.fontNunito,
    "zen-maru": t.more.fontZen,
    rajdhani: t.more.fontRajdhani,
    noto: t.more.fontNoto,
    serif: t.more.fontSerif,
  };
  const sizeLabels: Record<FontSizeId, string> = {
    sm: t.more.sizeSm,
    md: t.more.sizeMd,
    lg: t.more.sizeLg,
    xl: t.more.sizeXl,
  };
  const preset = THEME_PRESETS[theme];
  const fontId = custom.fontId ?? "theme";
  const fontSize = custom.fontSize ?? "md";
  const radius = custom.radius ?? "regular";
  const motion = custom.motion ?? "soft";
  const depth = custom.depth ?? (theme === "mist" || theme === "ink" ? "soft" : "flat");
  const wallpaperRef = useRef<HTMLInputElement>(null);
  const radiusLabels: Record<RadiusId, string> = {
    tight: t.more.shapeTight,
    regular: t.more.shapeRegular,
    round: t.more.shapeRound,
  };
  const motionLabels: Record<MotionId, string> = {
    off: t.more.motionOff,
    soft: t.more.motionSoft,
    lively: t.more.motionLively,
  };
  const depthLabels: Record<DepthId, string> = {
    flat: t.more.depthFlat,
    soft: t.more.depthSoft,
    lifted: t.more.depthLifted,
  };
  const themeArt: Partial<Record<ThemeId, string>> = {
    mist: "linear-gradient(135deg,#c8f3d4 0%,#d7ebfb 52%,#ddd4f6 100%)",
    ink: "linear-gradient(135deg,#f3cfcb 0%,#e7f6b0 46%,#171717 100%)",
    dark: "linear-gradient(145deg,#243038 0%,#3a424c 58%,#2ec9be 100%)",
  };
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.appearance} backTo="/more" />
      <p className="px-5 pb-3 text-sm text-muted">{t.more.appearanceHint}</p>
      <div key={`${theme}-${fontId}-${fontSize}-${radius}-${motion}`} className="ap-preview mx-4 mb-5 overflow-hidden rounded-2xl bg-elevated ring-1 ring-line">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-[11px] text-muted">{t.more.previewLook}</div>
            <div className="text-lg font-semibold tabular-nums">HK$12,480</div>
          </div>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent">{t.more.previewSave}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <div className="rounded-xl bg-success-soft px-3 py-2 text-sm text-income">+ HK$8,200</div>
          <div className="rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense">− HK$1,640</div>
        </div>
      </div>
      <h2 className="px-5 pb-2 text-sm font-medium text-muted">{t.more.shape}</h2>
      <div className="mx-4 mb-4 grid grid-cols-3 gap-2">
        {RADIUS_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setRadius(id)}
            className={cn(
              "tr-press h-11 rounded-xl text-sm font-medium transition",
              radius === id ? "bg-accent text-on-accent" : "bg-elevated ring-1 ring-line",
            )}
          >
            {radiusLabels[id]}
          </button>
        ))}
      </div>
      <h2 className="px-5 pb-2 text-sm font-medium text-muted">{t.more.motion}</h2>
      <div className="mx-4 mb-2 grid grid-cols-3 gap-2">
        {MOTION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setMotion(id)}
            className={cn(
              "tr-press h-11 rounded-xl text-sm font-medium transition",
              motion === id ? "bg-accent text-on-accent" : "bg-elevated ring-1 ring-line",
            )}
          >
            {motionLabels[id]}
          </button>
        ))}
      </div>
      <p className="px-5 pb-4 text-xs text-muted">{t.more.motionHint}</p>
      <h2 className="px-5 pb-2 text-sm font-medium text-muted">{t.more.depth}</h2>
      <div className="mx-4 mb-2 grid grid-cols-3 gap-2">
        {DEPTH_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setDepth(id)}
            className={cn(
              "tr-press h-11 rounded-xl text-sm font-medium transition",
              depth === id ? "bg-accent text-on-accent" : "bg-elevated ring-1 ring-line",
            )}
          >
            {depthLabels[id]}
          </button>
        ))}
      </div>
      <p className="px-5 pb-4 text-xs text-muted">{t.more.depthHint}</p>
      <h2 className="px-5 pb-2 text-sm font-medium text-muted">{t.more.accessMode}</h2>
      <div className="mx-4 mb-5 grid grid-cols-3 gap-2">
        {ACCESS_MODES.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setAccessMode(id)}
            className={cn(
              "tr-press min-h-16 rounded-2xl px-2 py-3 text-center text-sm font-medium transition",
              accessMode === id ? "bg-accent text-on-accent" : "bg-elevated ring-1 ring-line",
            )}
          >
            {id === "elderly" ? t.more.modeElderly : id === "kid" ? t.more.modeKid : t.more.modeStandard}
          </button>
        ))}
      </div>
      <p className="px-5 pb-4 text-xs text-muted">{t.more.accessHint}</p>
      <h2 className="px-5 pb-2 text-sm font-medium text-muted">{t.more.appIcon}</h2>
      <AppIconPicker />
      <h2 className="px-5 pb-2 pt-6 text-sm font-medium text-muted">{t.more.theme}</h2>
      <p className="px-5 pb-3 text-xs text-muted">{t.more.themeHint}</p>
      <div className="grid grid-cols-2 gap-3 px-4">
        {THEME_IDS.map((id) => {
          const swatch = THEME_PRESETS[id];
          const on = theme === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              className={cn(
                "tr-press overflow-hidden rounded-2xl text-left ring-1 transition duration-200",
                on ? "scale-[1.02] ring-2 ring-accent" : "ring-line",
              )}
            >
              <span
                className="block h-20 bg-cover bg-center"
                style={{
                  backgroundImage: themeArt[id] ?? (id === "normal" ? "none" : `url("${assetUrl(`wallpapers/${id}.jpg`)}")`),
                  backgroundColor: swatch.background,
                }}
              />
              <span className="flex items-center justify-between gap-2 bg-elevated px-3 py-2">
                <span className="text-sm font-medium">{labels[id]}</span>
                <span className="flex items-center gap-1">
                  {on ? (
                    <span className="ap-pop grid size-5 place-items-center rounded-full bg-accent text-on-accent">
                      <Check className="size-3" />
                    </span>
                  ) : (
                    <>
                      <span className="size-3 rounded-full" style={{ background: swatch.accent }} />
                      <span className="size-3 rounded-full" style={{ background: swatch.income }} />
                    </>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <h2 className="px-5 pb-2 pt-6 text-sm font-medium text-muted">{t.more.wallpaper}</h2>
      <p className="px-5 pb-3 text-xs text-muted">{t.more.wallpaperHint}</p>
      <div className="mx-4 mb-2 grid grid-cols-3 gap-2">
        {(["theme", "none", "custom"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              "tr-press h-11 rounded-xl text-sm font-medium transition",
              (custom.wallpaperMode ?? "theme") === id ? "bg-accent text-on-accent" : "bg-elevated",
            )}
            onClick={() => {
              if (id === "custom") {
                wallpaperRef.current?.click();
                return;
              }
              setWallpaper(id);
            }}
          >
            {id === "theme" ? t.more.wallpaperTheme : id === "none" ? t.more.wallpaperNone : t.more.wallpaperCustom}
          </button>
        ))}
      </div>
      <div className="mx-4 mb-3 rounded-2xl bg-elevated p-4">
        <div className="text-sm font-medium">{t.more.chooseWallpaper}</div>
        <p className="mt-1 text-xs leading-5 text-muted">{t.more.wallpaperSizeHint}</p>
        <label className="mt-3 inline-flex h-11 items-center rounded-xl bg-background px-4 text-sm font-medium ring-1 ring-line">
          {t.more.chooseWallpaper}
          <input
            ref={wallpaperRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const data = await resizeWallpaperFile(file);
              setWallpaper("custom", data);
            }}
          />
        </label>
        {custom.wallpaperMode === "custom" && custom.wallpaper ? (
          <div className="mt-3 h-28 overflow-hidden rounded-xl bg-background bg-cover bg-center" style={{ backgroundImage: `url("${custom.wallpaper}")` }} />
        ) : null}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span>{t.more.wallpaperOpacity}</span>
          <span className="tabular-nums text-muted">{custom.wallpaperOpacity ?? 15}%</span>
        </div>
        <input
          type="range"
          min={8}
          max={80}
          value={custom.wallpaperOpacity ?? 15}
          onChange={(e) => setWallpaperOpacity(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--color-accent)]"
        />
      </div>
      <h2 className="px-5 pb-2 pt-4 text-sm font-medium text-muted">{t.more.typography}</h2>
      <Group>
        <div className="px-4 py-3">
          <div className="text-sm">{t.more.fontType}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {FONT_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFontId(id)}
                className={cn(
                  "tr-press h-8 rounded-full px-3 text-sm transition",
                  fontId === id ? "bg-accent text-on-accent" : "bg-background text-foreground ring-1 ring-line",
                )}
                style={id === "theme" ? undefined : { fontFamily: FONT_STACKS[id] }}
              >
                {fontLabels[id]}
              </button>
            ))}
          </div>
        </div>
        <Hairline />
        <div className="px-4 py-3">
          <div className="text-sm">{t.more.fontSize}</div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {FONT_SIZE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFontSize(id)}
                className={cn(
                  "tr-press h-11 rounded-xl text-sm font-medium transition",
                  fontSize === id ? "bg-accent text-on-accent" : "bg-background ring-1 ring-line",
                )}
              >
                {sizeLabels[id]}
              </button>
            ))}
          </div>
        </div>
      </Group>
      <h2 className="px-5 pb-2 pt-6 text-sm font-medium text-muted">{t.more.colors}</h2>
      <p className="px-5 pb-3 text-xs text-muted">{t.more.colorsHint}</p>
      <Group>
        <ColorRow label={t.more.colorBackground} value={custom.background} fallback={preset.background} onChange={(hex) => setCustomColor("background", hex)} />
        <Hairline />
        <ColorRow label={t.more.colorElevated} value={custom.elevated} fallback={preset.elevated} onChange={(hex) => setCustomColor("elevated", hex)} />
        <Hairline />
        <ColorRow label={t.more.colorFont} value={custom.foreground} fallback={preset.foreground} onChange={(hex) => setCustomColor("foreground", hex)} />
        <Hairline />
        <ColorRow label={t.more.colorMuted} value={custom.muted} fallback={preset.muted} onChange={(hex) => setCustomColor("muted", hex)} />
        <Hairline />
        <ColorRow label={t.more.colorLine} value={custom.line} fallback={preset.line} onChange={(hex) => setCustomColor("line", hex)} />
      </Group>
      <h2 className="px-5 pb-2 pt-6 text-sm font-medium text-muted">{t.more.colorAccentGroup}</h2>
      <Group>
        <ColorRow label={t.more.colorHighlight} value={custom.accent} fallback={preset.accent} onChange={(hex) => setCustomColor("accent", hex)} />
        <Hairline />
        <ColorRow label={t.more.colorOnAccent} value={custom.onAccent} fallback={preset.onAccent} onChange={(hex) => setCustomColor("onAccent", hex)} />
        <Hairline />
        <ColorRow label={t.more.colorIncome} value={custom.income} fallback={preset.income} onChange={(hex) => setCustomColor("income", hex)} />
        <Hairline />
        <ColorRow label={t.more.colorExpense} value={custom.expense} fallback={preset.expense} onChange={(hex) => setCustomColor("expense", hex)} />
        <Hairline />
        <ColorRow label={t.more.colorChart} value={custom.chart} fallback={preset.chart} onChange={(hex) => setCustomColor("chart", hex)} />
      </Group>
      <div className="px-5 pt-4">
        <button type="button" className="h-11 w-full rounded-xl bg-elevated text-sm" onClick={resetCustomColors}>
          {t.more.resetColors}
        </button>
      </div>
    </div>
  );
}

function AppIconPicker() {
  const t = useT();
  const [icon, setIcon] = useState<string | null>(() => (typeof window === "undefined" ? null : readSavedPwaIcon()));
  return (
    <div className="mx-4 mb-2 overflow-hidden rounded-2xl bg-elevated p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-16 place-items-center overflow-hidden rounded-2xl bg-background ring-1 ring-line">
          {icon ? <img src={icon} alt="" className="size-16 object-cover" /> : <span className="text-xs text-muted">180</span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm">{t.more.appIconHint}</p>
          <label className="mt-2 inline-flex h-10 items-center rounded-xl bg-accent px-3 text-sm font-medium text-on-accent">
            {t.more.chooseIcon}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const data = await resizeImageFile(file);
                persistPwaIcon(data);
                setIcon(data);
              }}
            />
          </label>
          {icon ? (
            <button
              type="button"
              className="ml-2 h-10 text-sm text-muted"
              onClick={() => {
                persistPwaIcon(null);
                setIcon(null);
              }}
            >
              {t.more.resetIcon}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value?: string;
  fallback: string;
  onChange: (hex: string) => void;
}) {
  const shown = normalizeHex(value) ?? fallback;
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
      <span className="min-w-0 text-sm">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        <input
          value={shown}
          onChange={(e) => {
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
          className="h-9 w-[5.6rem] rounded-lg bg-background px-2 font-mono text-xs uppercase ring-1 ring-line"
          spellCheck={false}
        />
        <span className="relative size-10 overflow-hidden rounded-lg ring-1 ring-line transition">
          <span className="absolute inset-0 transition-colors duration-200" style={{ background: shown }} />
          <input
            type="color"
            value={shown}
            aria-label={label}
            onChange={(e) => {
              const hex = normalizeHex(e.target.value);
              if (hex) onChange(hex);
            }}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </span>
      </span>
    </label>
  );
}

export function OtherSettingsPage() {
  const t = useT();
  const nav = useNavigate();
  const resetSample = useApp((s) => s.resetSample);
  const clearAll = useApp((s) => s.clearAll);
  const [confirm, setConfirm] = useState<"sample" | "clear" | null>(null);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.other} backTo="/more" />
      <p className="px-5 pb-3 text-sm text-muted">{t.more.otherHint}</p>
      <div className="px-5">
        <button
          type="button"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-elevated text-sm font-medium"
          onClick={() => void nav({ to: "/onboarding", search: { replay: true } })}
        >
          <BookOpen className="size-4" />
          {t.more.replayIntro}
        </button>
        <button type="button" className="mt-3 h-12 w-full rounded-xl bg-elevated text-sm font-medium" onClick={() => setConfirm("sample")}>
          {t.more.sample}
        </button>
        <button type="button" className="mt-3 h-12 w-full rounded-xl bg-elevated text-sm font-medium text-expense" onClick={() => setConfirm("clear")}>
          {t.more.clear}
        </button>
      </div>
      <Overlay
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "clear" ? t.more.clear : t.more.sample}
      >
        <div className="px-5 pb-8">
          <p className="text-sm text-muted">{confirm === "clear" ? t.more.confirmClear : t.more.confirmSample}</p>
          <button
            type="button"
            className={cn(
              "mt-5 h-12 w-full rounded-xl text-sm font-semibold",
              confirm === "clear" ? "bg-expense text-on-accent" : "bg-accent text-on-accent",
            )}
            onClick={async () => {
              if (confirm === "clear") {
                await clearAll();
                toast(t.more.cleared);
              } else {
                await resetSample();
                toast(t.more.sampleDone);
              }
              setConfirm(null);
            }}
          >
            {t.more.confirm}
          </button>
          <button type="button" className="mt-2 h-11 w-full text-sm text-muted" onClick={() => setConfirm(null)}>
            {t.add.cancel}
          </button>
        </div>
      </Overlay>
    </div>
  );
}
