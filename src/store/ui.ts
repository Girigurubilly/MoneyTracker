import { create } from "zustand";
import { isCategoryIconName, NAV_SLOTS, type NavSlot } from "@/lib/nav-icons";
import type { CategoryIconName, Locale, TodayView, TxType } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { messages, type Messages } from "@/lib/i18n";
import {
  applyAccess,
  applyTheme,
  clampWallpaperOpacity,
  colorsOnly,
  readSavedAccess,
  readSavedCustom,
  readSavedTheme,
  ACCESS_KEY,
  THEME_CUSTOM_KEY,
  THEME_KEY,
  type AccessMode,
  type DepthId,
  type FontId,
  type GlowId,
  type FontSizeId,
  type MotionId,
  type RadiusId,
  type ThemeColorKey,
  type ThemeCustom,
  type ThemeId,
} from "@/lib/theme";

const LOCALE_KEY = "hk-life-money-locale";
const NAV_ICON_KEY = "hk-life-money-nav-icons";

function readNavIcons(): Partial<Record<NavSlot, CategoryIconName>> {
  try {
    const raw = localStorage.getItem(NAV_ICON_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Partial<Record<NavSlot, CategoryIconName>> = {};
    for (const slot of NAV_SLOTS) {
      if (isCategoryIconName(parsed[slot])) out[slot] = parsed[slot];
    }
    return out;
  } catch {
    return {};
  }
}

export function readSavedLocale(): Locale {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    if (v === "en" || v === "zh-HK") return v;
  } catch {
    /* ignore */
  }
  return "zh-HK";
}

type UiState = {
  locale: Locale;
  theme: ThemeId;
  customColors: ThemeCustom;
  selectedDate: string;
  todayView: TodayView;
  firstDayOfWeek: 0 | 1;
  addOpen: boolean;
  addType: TxType | null;
  addOctopus: boolean;
  searchOpen: boolean;
  txDetailId: string | null;
  infoKey: string | null;
  onboarded: boolean;
  accessMode: AccessMode;
  navIcons: Partial<Record<NavSlot, CategoryIconName>>;
  setLocale: (l: Locale) => void;
  setTheme: (t: ThemeId) => void;
  setCustomColor: (key: ThemeColorKey, hex: string | undefined) => void;
  setFontId: (id: FontId) => void;
  setFontSize: (id: FontSizeId) => void;
  setWallpaper: (mode: "none" | "theme" | "custom", dataUrl?: string) => void;
  setWallpaperOpacity: (n: number) => void;
  setRadius: (id: RadiusId) => void;
  setMotion: (id: MotionId) => void;
  setDepth: (id: DepthId) => void;
  setGlow: (id: GlowId) => void;
  resetCustomColors: () => void;
  setSelectedDate: (iso: string) => void;
  setTodayView: (v: TodayView) => void;
  openAddPicker: () => void;
  openAdd: (t: TxType) => void;
  openOctopus: () => void;
  closeAdd: () => void;
  closeOctopus: () => void;
  setSearchOpen: (v: boolean) => void;
  setTxDetailId: (id: string | null) => void;
  setInfoKey: (k: string | null) => void;
  setOnboarded: (v: boolean) => void;
  setAccessMode: (mode: AccessMode) => void;
  setNavIcon: (slot: NavSlot, name: CategoryIconName) => void;
  resetNavIcons: () => void;
};

function persistCustom(next: ThemeCustom) {
  try {
    localStorage.setItem(THEME_CUSTOM_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  applyTheme(readSavedTheme(), readSavedCustom());
  applyAccess(readSavedAccess());
}

export const useUi = create<UiState>((set, get) => ({
  locale: "zh-HK",
  theme: typeof window === "undefined" ? "normal" : readSavedTheme(),
  customColors: typeof window === "undefined" ? {} : readSavedCustom(),
  selectedDate: todayISO(),
  todayView: "month",
  firstDayOfWeek: 0,
  addOpen: false,
  addType: null,
  addOctopus: false,
  searchOpen: false,
  txDetailId: null,
  infoKey: null,
  onboarded: typeof window === "undefined" ? false : readOnboarded(),
  accessMode: typeof window === "undefined" ? "standard" : readSavedAccess(),
  navIcons: typeof window === "undefined" ? {} : readNavIcons(),
  setLocale: (l) => {
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* ignore */
    }
    set({ locale: l });
  },
  setTheme: (t) => {
    const kept = colorsOnly(get().customColors);
    persistCustom(kept);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
    applyTheme(t, kept);
    set({ theme: t, customColors: kept });
  },
  setCustomColor: (key, hex) => {
    const next = { ...get().customColors };
    if (hex) next[key] = hex;
    else delete next[key];
    persistCustom(next);
    applyTheme(get().theme, next);
    set({ customColors: next });
  },
  setFontId: (id) => {
    const next = { ...get().customColors, fontId: id === "theme" ? undefined : id };
    if (id === "theme") delete next.fontId;
    persistCustom(next);
    applyTheme(get().theme, next);
    set({ customColors: next });
  },
  setFontSize: (id) => {
    const next = { ...get().customColors, fontSize: id === "md" ? undefined : id };
    if (id === "md") delete next.fontSize;
    persistCustom(next);
    applyTheme(get().theme, next);
    set({ customColors: next });
  },
  setWallpaper: (mode, dataUrl) => {
    const next = { ...get().customColors, wallpaperMode: mode, wallpaper: mode === "custom" ? dataUrl : undefined };
    if (mode !== "custom") delete next.wallpaper;
    persistCustom(next);
    applyTheme(get().theme, next);
    set({ customColors: next });
  },
  setWallpaperOpacity: (n) => {
    const next = { ...get().customColors, wallpaperOpacity: clampWallpaperOpacity(n) };
    persistCustom(next);
    applyTheme(get().theme, next);
    set({ customColors: next });
  },
  setRadius: (id) => {
    const next = { ...get().customColors, radius: id === "regular" ? undefined : id };
    if (id === "regular") delete next.radius;
    persistCustom(next);
    applyTheme(get().theme, next);
    set({ customColors: next });
  },
  setMotion: (id) => {
    const next = { ...get().customColors, motion: id === "soft" ? undefined : id };
    if (id === "soft") delete next.motion;
    persistCustom(next);
    applyTheme(get().theme, next);
    set({ customColors: next });
  },
  setDepth: (id) => {
    const implied = get().theme === "dark" || get().theme === "cyberpunk" || get().theme === "hongkong" || get().theme === "normal" ? "flat" : "soft";
    const next = { ...get().customColors, depth: id === implied ? undefined : id };
    if (id === implied) delete next.depth;
    persistCustom(next);
    applyTheme(get().theme, next);
    set({ customColors: next });
  },
  setGlow: (id) => {
    const implied = get().theme === "cyberpunk" || get().theme === "hongkong" ? "soft" : "off";
    const next = { ...get().customColors, glow: id === implied ? undefined : id };
    if (id === implied) delete next.glow;
    persistCustom(next);
    applyTheme(get().theme, next);
    set({ customColors: next });
  },
  resetCustomColors: () => {
    persistCustom({});
    applyTheme(get().theme, {});
    set({ customColors: {} });
  },
  setSelectedDate: (iso) => set({ selectedDate: iso }),
  setTodayView: (v) => set({ todayView: v }),
  openAddPicker: () => set({ addOpen: true, addType: null, addOctopus: false }),
  openAdd: (t) => set({ addOpen: true, addType: t, addOctopus: false }),
  openOctopus: () => set((s) => ({ addOpen: true, addType: s.addType ?? "expense", addOctopus: true })),
  closeAdd: () => set({ addOpen: false, addType: null, addOctopus: false }),
  closeOctopus: () => set({ addOctopus: false }),
  setSearchOpen: (v) => set({ searchOpen: v }),
  setTxDetailId: (id) => set({ txDetailId: id }),
  setInfoKey: (k) => set({ infoKey: k }),
  setOnboarded: (v) => {
    try {
      localStorage.setItem("hk-life-money-onboarded", v ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ onboarded: v });
  },
  setAccessMode: (mode) => {
    try {
      localStorage.setItem(ACCESS_KEY, mode);
    } catch {
      /* ignore */
    }
    applyAccess(mode);
    const custom = get().customColors;
    if (mode === "elderly") {
      const next = { ...custom, fontSize: "xl" as const };
      persistCustom(next);
      applyTheme(get().theme, next);
      set({ accessMode: mode, customColors: next });
      return;
    }
    set({ accessMode: mode });
  },
  setNavIcon: (slot, name) => {
    const next = { ...get().navIcons, [slot]: name };
    try {
      localStorage.setItem(NAV_ICON_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    set({ navIcons: next });
  },
  resetNavIcons: () => {
    try {
      localStorage.removeItem(NAV_ICON_KEY);
    } catch {
      /* ignore */
    }
    set({ navIcons: {} });
  },
}));

export function useT(): Messages {
  const locale = useUi((s) => s.locale);
  return messages[locale] as Messages;
}

export function readOnboarded(): boolean {
  try {
    return localStorage.getItem("hk-life-money-onboarded") === "1";
  } catch {
    return false;
  }
}
