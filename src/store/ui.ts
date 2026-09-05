import { create } from "zustand";
import type { Locale, TodayView, TxType } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { messages, type Messages } from "@/lib/i18n";
import {
  applyAccess,
  applyTheme,
  colorsOnly,
  readSavedAccess,
  readSavedCustom,
  readSavedTheme,
  ACCESS_KEY,
  THEME_CUSTOM_KEY,
  THEME_KEY,
  type AccessMode,
  type FontId,
  type FontSizeId,
  type ThemeColorKey,
  type ThemeCustom,
  type ThemeId,
} from "@/lib/theme";

const LOCALE_KEY = "hk-life-money-locale";

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
  searchOpen: boolean;
  txDetailId: string | null;
  infoKey: string | null;
  onboarded: boolean;
  accessMode: AccessMode;
  setLocale: (l: Locale) => void;
  setTheme: (t: ThemeId) => void;
  setCustomColor: (key: ThemeColorKey, hex: string | undefined) => void;
  setFontId: (id: FontId) => void;
  setFontSize: (id: FontSizeId) => void;
  setWallpaper: (mode: "none" | "theme" | "custom", dataUrl?: string) => void;
  resetCustomColors: () => void;
  setSelectedDate: (iso: string) => void;
  setTodayView: (v: TodayView) => void;
  openAddPicker: () => void;
  openAdd: (t: TxType) => void;
  closeAdd: () => void;
  setSearchOpen: (v: boolean) => void;
  setTxDetailId: (id: string | null) => void;
  setInfoKey: (k: string | null) => void;
  setOnboarded: (v: boolean) => void;
  setAccessMode: (mode: AccessMode) => void;
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
  searchOpen: false,
  txDetailId: null,
  infoKey: null,
  onboarded: typeof window === "undefined" ? false : readOnboarded(),
  accessMode: typeof window === "undefined" ? "standard" : readSavedAccess(),
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
  resetCustomColors: () => {
    persistCustom({});
    applyTheme(get().theme, {});
    set({ customColors: {} });
  },
  setSelectedDate: (iso) => set({ selectedDate: iso }),
  setTodayView: (v) => set({ todayView: v }),
  openAddPicker: () => set({ addOpen: true, addType: null }),
  openAdd: (t) => set({ addOpen: true, addType: t }),
  closeAdd: () => set({ addOpen: false, addType: null }),
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
