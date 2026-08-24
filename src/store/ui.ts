import { create } from "zustand";
import { messages } from "@/lib/i18n";
import type { Locale, ThemeMode, TodayView, TxType } from "@/lib/types";
import { todayISO } from "@/lib/format";

export type AddKind = TxType | null;

type UiState = {
  locale: Locale;
  theme: ThemeMode;
  selectedDate: string;
  todayView: TodayView;
  firstDayOfWeek: 0 | 1;
  addPickerOpen: boolean;
  searchOpen: boolean;
  filterOpen: boolean;
  filterKind: TxType | "all";
  addKind: AddKind;
  txDetailId: string | null;
  editingId: string | null;
  infoKey: string | null;
  addAccountOpen: boolean;
  addTripOpen: boolean;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeMode) => void;
  setSelectedDate: (iso: string) => void;
  setTodayView: (v: TodayView) => void;
  setFirstDay: (d: 0 | 1) => void;
  openAddPicker: () => void;
  closeAdd: () => void;
  setAddKind: (k: AddKind) => void;
  setSearchOpen: (v: boolean) => void;
  setFilterOpen: (v: boolean) => void;
  setFilterKind: (v: TxType | "all") => void;
  setTxDetailId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setInfoKey: (k: string | null) => void;
  setAddAccountOpen: (v: boolean) => void;
  setAddTripOpen: (v: boolean) => void;
};

export function readSavedLocale(): Locale {
  return readLocale();
}

function persistLocale(locale: Locale) {
  try {
    localStorage.setItem("hk-locale", locale);
  } catch {
    /* ignore */
  }
}

function readLocale(): Locale {
  try {
    const v = localStorage.getItem("hk-locale");
    if (v === "en" || v === "zh-HK") return v;
  } catch {
    /* ignore */
  }
  return "zh-HK";
}

export const useUi = create<UiState>((set) => ({
  locale: "zh-HK",
  theme: "light",
  selectedDate: todayISO(),
  todayView: "month",
  firstDayOfWeek: 0,
  addPickerOpen: false,
  addKind: null,
  searchOpen: false,
  filterOpen: false,
  filterKind: "all",
  txDetailId: null,
  editingId: null,
  infoKey: null,
  addAccountOpen: false,
  addTripOpen: false,
  setLocale: (locale) => {
    persistLocale(locale);
    set({ locale });
  },
  setTheme: (theme) => set({ theme: theme === "dark" ? "light" : "light" }),
  setSelectedDate: (iso) => set({ selectedDate: iso }),
  setTodayView: (todayView) => set({ todayView }),
  setFirstDay: (firstDayOfWeek) => set({ firstDayOfWeek }),
  openAddPicker: () => set({ addPickerOpen: true, addKind: null, editingId: null }),
  closeAdd: () => set({ addPickerOpen: false, addKind: null, editingId: null }),
  setAddKind: (addKind) => set({ addKind, addPickerOpen: false }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setFilterOpen: (filterOpen) => set({ filterOpen }),
  setFilterKind: (filterKind) => set({ filterKind, filterOpen: false }),
  setTxDetailId: (txDetailId) => set({ txDetailId }),
  setEditingId: (editingId) => set({ editingId }),
  setInfoKey: (infoKey) => set({ infoKey }),
  setAddAccountOpen: (addAccountOpen) => set({ addAccountOpen }),
  setAddTripOpen: (addTripOpen) => set({ addTripOpen }),
}));

export function useT() {
  const locale = useUi((s) => s.locale);
  return messages[locale];
}
