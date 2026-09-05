import { useRef, useState } from "react";
import { Archive, FolderTree, Globe, Palette, PiggyBank, Repeat, Settings2, ShoppingBag, Upload, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Disclaimer, Group, Hairline, Overlay, Row, ScreenHeader } from "@/components/shared";
import { CurrencySelect } from "@/components/currency-field";
import { CategoryPicker } from "@/components/category-picker";
import { pickName } from "@/lib/i18n";
import { decryptSnapshot, downloadBlob, encryptSnapshot } from "@/lib/backup";
import { transactionsToCsv } from "@/lib/derived";
import { convertBtp, isAppSnapshot, isBtpFile } from "@/lib/import-btp";
import { CURRENCIES } from "@/lib/types";
import { useApp, type AppSnapshot } from "@/store/app";
import { useT, useUi } from "@/store/ui";
import { ACCESS_MODES, THEME_IDS, THEME_PRESETS, FONT_IDS, FONT_SIZE_IDS, normalizeHex, type FontId, type FontSizeId, type ThemeId } from "@/lib/theme";
import { persistPwaIcon, readSavedPwaIcon, resizeImageFile } from "@/lib/pwa-icon";
import { cn } from "@/lib/utils";

export function MoreScreen() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const access = useUi((s) => s.accessMode);
  const kid = access === "kid";
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.title} large />
      <h2 className="px-5 pb-1 text-sm font-medium text-muted">{t.more.setup}</h2>
      <Group>
        {kid ? null : (
          <>
            <Row icon={<FolderTree className="size-4" />} title={t.more.categories} to="/more/categories" chevron />
            <Hairline />
            <Row icon={<Repeat className="size-4" />} title={t.more.recurring} to="/budget" chevron />
            <Hairline />
          </>
        )}
        <Row icon={<Wallet className="size-4" />} title={t.more.budgets} to="/budget" chevron />
        <Hairline />
        <Row icon={<ShoppingBag className="size-4" />} title={t.more.wishlist} to="/more/wishlist" chevron />
        {kid ? null : (
          <>
            <Hairline />
            <Row icon={<PiggyBank className="size-4" />} title={t.more.deposits} to="/reports/deposits" chevron />
            <Hairline />
            <Row icon={<Globe className="size-4" />} title={t.more.fx} to="/more/fx" chevron />
          </>
        )}
        <Hairline />
        <Row icon={<Palette className="size-4" />} title={t.more.appearance} to="/more/appearance" chevron />
      </Group>
      {kid ? null : (
        <>
          <h2 className="px-5 pb-1 pt-6 text-sm font-medium text-muted">{t.more.data}</h2>
          <Group>
            <Row icon={<Upload className="size-4" />} title={t.more.import} to="/more/import" chevron />
            <Hairline />
            <Row icon={<Archive className="size-4" />} title={t.more.backup} to="/more/backup" chevron />
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

export function CategoriesPage() {
  const t = useT();
  const cats = useApp((s) => s.categories);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col pb-4">
      <ScreenHeader title={t.more.categories} />
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

export function AppearancePage() {
  const t = useT();
  const theme = useUi((s) => s.theme);
  const custom = useUi((s) => s.customColors);
  const setTheme = useUi((s) => s.setTheme);
  const setCustomColor = useUi((s) => s.setCustomColor);
  const setFontId = useUi((s) => s.setFontId);
  const setFontSize = useUi((s) => s.setFontSize);
  const setWallpaper = useUi((s) => s.setWallpaper);
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
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.appearance} backTo="/more" />
      <p className="px-5 pb-3 text-sm text-muted">{t.more.appearanceHint}</p>
      <h2 className="px-5 pb-2 text-sm font-medium text-muted">{t.more.accessMode}</h2>
      <div className="mx-4 mb-5 grid grid-cols-3 gap-2">
        {ACCESS_MODES.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setAccessMode(id)}
            className={cn(
              "min-h-16 rounded-2xl px-2 py-3 text-center text-sm font-medium",
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
                "min-h-16 rounded-xl px-3 py-3 text-left",
                on ? "ring-2 ring-accent" : "ring-1 ring-line",
              )}
              style={{ background: swatch.elevated, color: swatch.foreground }}
            >
              <span className="flex items-center gap-2">
                <span className="size-4 rounded-full" style={{ background: swatch.background }} />
                <span className="size-4 rounded-full" style={{ background: swatch.accent }} />
              </span>
              <span className="mt-2 block text-sm font-medium">{labels[id]}</span>
            </button>
          );
        })}
      </div>
      <h2 className="px-5 pb-2 pt-6 text-sm font-medium text-muted">{t.more.wallpaper}</h2>
      <div className="mx-4 mb-2 grid grid-cols-3 gap-2">
        {(["theme", "none", "custom"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (id === "custom") return;
              setWallpaper(id);
            }}
            className={cn(
              "h-11 rounded-xl text-sm font-medium",
              (custom.wallpaperMode ?? "theme") === id ? "bg-accent text-on-accent" : "bg-elevated",
            )}
          >
            {id === "theme" ? t.more.wallpaperTheme : id === "none" ? t.more.wallpaperNone : t.more.wallpaperCustom}
          </button>
        ))}
      </div>
      <div className="px-4 pb-2">
        <label className="inline-flex h-11 items-center rounded-xl bg-elevated px-3 text-sm">
          {t.more.chooseWallpaper}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const data = await resizeImageFile(file, 720);
              setWallpaper("custom", data);
            }}
          />
        </label>
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
                  "h-8 rounded-full px-3 text-sm",
                  fontId === id ? "bg-accent text-on-accent" : "bg-background text-foreground ring-1 ring-line",
                )}
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
                  "h-11 rounded-xl text-sm font-medium",
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
      <Group>
        <ColorRow
          label={t.more.colorBackground}
          value={custom.background}
          fallback={preset.background}
          onChange={(hex) => setCustomColor("background", hex)}
        />
        <Hairline />
        <ColorRow
          label={t.more.colorElevated}
          value={custom.elevated}
          fallback={preset.elevated}
          onChange={(hex) => setCustomColor("elevated", hex)}
        />
        <Hairline />
        <ColorRow
          label={t.more.colorFont}
          value={custom.foreground}
          fallback={preset.foreground}
          onChange={(hex) => setCustomColor("foreground", hex)}
        />
        <Hairline />
        <ColorRow
          label={t.more.colorMuted}
          value={custom.muted}
          fallback={preset.muted}
          onChange={(hex) => setCustomColor("muted", hex)}
        />
        <Hairline />
        <ColorRow
          label={t.more.colorHighlight}
          value={custom.accent}
          fallback={preset.accent}
          onChange={(hex) => setCustomColor("accent", hex)}
        />
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
    <label className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
      <span className="text-sm">{label}</span>
      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg ring-1 ring-line">
        <span className="absolute inset-0" style={{ background: shown }} />
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
    </label>
  );
}

export function OtherSettingsPage() {
  const t = useT();
  const resetSample = useApp((s) => s.resetSample);
  const clearAll = useApp((s) => s.clearAll);
  const [confirm, setConfirm] = useState<"sample" | "clear" | null>(null);
  return (
    <div className="pb-10">
      <ScreenHeader title={t.more.other} backTo="/more" />
      <p className="px-5 pb-3 text-sm text-muted">{t.more.otherHint}</p>
      <div className="px-5">
        <button type="button" className="h-12 w-full rounded-xl bg-elevated text-sm font-medium" onClick={() => setConfirm("sample")}>
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
