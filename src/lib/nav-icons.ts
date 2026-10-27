import type { ThemeId } from "@/lib/theme";
import { CATEGORY_ICONS, type CategoryIconName } from "@/lib/types";

export const NAV_SLOTS = ["today", "assets", "budget", "reports", "more"] as const;
export type NavSlot = (typeof NAV_SLOTS)[number];

const BASE: Record<NavSlot, CategoryIconName> = {
  today: "wallet",
  assets: "cards",
  budget: "pie",
  reports: "bars",
  more: "more",
};

export function defaultNavIcons(theme: ThemeId): Record<NavSlot, CategoryIconName> {
  if (theme === "shiba") return { ...BASE, today: "paw", assets: "bone", budget: "heart", reports: "home" };
  if (theme === "cat") return { ...BASE, today: "cat", assets: "fish", budget: "heart", reports: "home" };
  if (theme === "panda") return { ...BASE, today: "leaf", assets: "tree", budget: "clover", reports: "sprout" };
  if (theme === "hongkong") return { ...BASE, today: "landmark", assets: "sailboat", budget: "pie", reports: "bars" };
  if (theme === "anime") return { ...BASE, today: "sparkles", assets: "wand", budget: "star", reports: "heart" };
  if (theme === "pinky") return { ...BASE, today: "heart", assets: "gem", budget: "flower", reports: "star" };
  if (theme === "cyberpunk") return { ...BASE, today: "atom", assets: "zap", budget: "flame", reports: "orbit" };
  if (theme === "dark") return { ...BASE, today: "chart", assets: "candle", budget: "pie", reports: "trending" };
  if (theme === "mist") return { ...BASE, today: "cloud", assets: "sprout", budget: "clover", reports: "flower" };
  if (theme === "ink") return { ...BASE, today: "pen", assets: "highlighter", budget: "pie", reports: "bars" };
  return BASE;
}

export function isCategoryIconName(v: string | null | undefined): v is CategoryIconName {
  return CATEGORY_ICONS.includes(v as CategoryIconName);
}
