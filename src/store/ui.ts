import { create } from "zustand";
import type { Locale, TodayView, TxType } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { messages, type Messages } from "@/lib/i18n";

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
  selectedDate: string;
  todayView: TodayView;
  firstDayOfWeek: 0 | 1;
  addOpen: boolean;
  addType: TxType | null;
  searchOpen: boolean;
  txDetailId: string | null;
  infoKey: string | null;
  onboarded: boolean;
  setLocale: (l: Locale) => void;
  setSelectedDate: (iso: string) => void;
  setTodayView: (v: TodayView) => void;
  openAddPicker: () => void;
  openAdd: (t: TxType) => void;
  closeAdd: () => void;
  setSearchOpen: (v: boolean) => void;
  setTxDetailId: (id: string | null) => void;
  setInfoKey: (k: string | null) => void;
  setOnboarded: (v: boolean) => void;
};

export const useUi = create<UiState>((set) => ({
  locale: "zh-HK",
  selectedDate: todayISO(),
  todayView: "month",
  firstDayOfWeek: 0,
  addOpen: false,
  addType: null,
  searchOpen: false,
  txDetailId: null,
  infoKey: null,
  onboarded: typeof window === "undefined" ? false : readOnboarded(),
  setLocale: (l) => {
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* ignore */
    }
    set({ locale: l });
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
