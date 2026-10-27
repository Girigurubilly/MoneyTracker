import { assetUrl } from "./base";

export const THEME_IDS = ["normal", "dark", "mist", "ink", "pinky", "anime", "cyberpunk", "shiba", "cat", "panda", "hongkong"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const FONT_IDS = ["theme", "system", "nunito", "zen-maru", "rajdhani", "noto", "serif"] as const;
export type FontId = (typeof FONT_IDS)[number];

export const FONT_SIZE_IDS = ["sm", "md", "lg", "xl"] as const;
export type FontSizeId = (typeof FONT_SIZE_IDS)[number];

export const RADIUS_IDS = ["tight", "regular", "round"] as const;
export type RadiusId = (typeof RADIUS_IDS)[number];

export const MOTION_IDS = ["off", "soft", "lively"] as const;
export type MotionId = (typeof MOTION_IDS)[number];

export const DEPTH_IDS = ["flat", "soft", "lifted"] as const;
export type DepthId = (typeof DEPTH_IDS)[number];

export const GLOW_IDS = ["off", "soft", "strong"] as const;
export type GlowId = (typeof GLOW_IDS)[number];

export const FONT_SIZE_PX: Record<FontSizeId, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
  xl: "20px",
};

export const FONT_STACKS: Record<Exclude<FontId, "theme">, string> = {
  system: '"SF Pro Text", "PingFang HK", "Noto Sans TC", "Segoe UI", system-ui, sans-serif',
  nunito: 'Nunito, ui-rounded, "Hiragino Maru Gothic ProN", "PingFang HK", "Noto Sans TC", system-ui, sans-serif',
  "zen-maru": '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "PingFang HK", "Noto Sans TC", system-ui, sans-serif',
  rajdhani: 'Rajdhani, "Segoe UI", "PingFang HK", "Noto Sans TC", system-ui, sans-serif',
  noto: '"Noto Sans TC", "PingFang HK", "Hiragino Sans", "Segoe UI", system-ui, sans-serif',
  serif: '"Noto Serif TC", "Songti SC", "PingFang HK", Georgia, "Times New Roman", serif',
};

export type ThemeColorKey = "background" | "foreground" | "elevated" | "muted" | "accent" | "income" | "expense" | "line" | "onAccent" | "chart";

export type ThemeCustom = {
  background?: string;
  foreground?: string;
  elevated?: string;
  muted?: string;
  accent?: string;
  income?: string;
  expense?: string;
  line?: string;
  onAccent?: string;
  chart?: string;
  fontId?: FontId;
  fontSize?: FontSizeId;
  wallpaper?: string;
  wallpaperMode?: "none" | "theme" | "custom";
  wallpaperOpacity?: number;
  radius?: RadiusId;
  motion?: MotionId;
  depth?: DepthId;
  glow?: GlowId;
};

export const ACCESS_MODES = ["standard", "elderly", "kid"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];
export const ACCESS_KEY = "hk-life-money-access";
export const THEME_KEY = "hk-life-money-theme";
export const THEME_CUSTOM_KEY = "hk-life-money-theme-custom";

export function isAccessMode(v: string | null | undefined): v is AccessMode {
  return ACCESS_MODES.includes(v as AccessMode);
}

export function readSavedAccess(): AccessMode {
  try {
    const v = localStorage.getItem(ACCESS_KEY);
    if (isAccessMode(v)) return v;
  } catch {
    /* ignore */
  }
  return "standard";
}

export function applyAccess(mode: AccessMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "standard") root.removeAttribute("data-access");
  else root.setAttribute("data-access", mode);
}

export const COLOR_CSS: Record<ThemeColorKey, string> = {
  background: "--color-background",
  foreground: "--color-foreground",
  elevated: "--color-elevated",
  muted: "--color-muted",
  accent: "--color-accent",
  income: "--color-income",
  expense: "--color-expense",
  line: "--color-line",
  onAccent: "--color-on-accent",
  chart: "--color-chart-1",
};

export const THEME_PRESETS: Record<
  ThemeId,
  Record<ThemeColorKey, string>
> = {
  normal: { background: "#f2f2f7", foreground: "#1c1c1e", elevated: "#ffffff", muted: "#8e8e93", accent: "#007aff", income: "#248a3d", expense: "#d70015", line: "#e5e5ea", onAccent: "#ffffff", chart: "#30d158" },
  dark: { background: "#2a3139", foreground: "#f4f7f8", elevated: "#3a424c", muted: "#9aa3ad", accent: "#2ec9be", income: "#c6e15a", expense: "#e15b6c", line: "#4a535e", onAccent: "#102226", chart: "#2ad4c4" },
  mist: { background: "#e4eef0", foreground: "#1c2a33", elevated: "#f7fbfa", muted: "#6f8688", accent: "#2f9d74", income: "#3d8ec4", expense: "#7a68b8", line: "#d3e3e4", onAccent: "#ffffff", chart: "#7dce9a" },
  ink: { background: "#ece8f2", foreground: "#161616", elevated: "#f8f6fb", muted: "#7d7886", accent: "#c6ee55", income: "#161616", expense: "#c45d62", line: "#e3deea", onAccent: "#161616", chart: "#171717" },
  pinky: { background: "#fde8f0", foreground: "#4a2438", elevated: "#fff7fa", muted: "#a56b86", accent: "#e85a8c", income: "#2f9a84", expense: "#c43b5a", line: "#f3d0de", onAccent: "#ffffff", chart: "#f48cb0" },
  anime: { background: "#f4eef8", foreground: "#2a1838", elevated: "#fff8fc", muted: "#8a7098", accent: "#e85aa0", income: "#3aa89a", expense: "#e14b6a", line: "#eadcf2", onAccent: "#ffffff", chart: "#c9a4ff" },
  cyberpunk: { background: "#07140c", foreground: "#f4fff6", elevated: "#102418", muted: "#7d9a86", accent: "#b6ff6a", income: "#7dff6a", expense: "#ff5a6a", line: "#1a3324", onAccent: "#06210c", chart: "#7dff6a" },
  shiba: { background: "#fff3e4", foreground: "#3f2914", elevated: "#fffaf3", muted: "#a87848", accent: "#e07a2f", income: "#3d9a62", expense: "#d4532a", line: "#f0dcc4", onAccent: "#ffffff", chart: "#f0a04a" },
  cat: { background: "#f6efe6", foreground: "#3a2a22", elevated: "#fffdf8", muted: "#9a7b6c", accent: "#e08a4a", income: "#3f8f6e", expense: "#d46a62", line: "#eadcd4", onAccent: "#ffffff", chart: "#7dba8a" },
  panda: { background: "#eef2ec", foreground: "#1c2420", elevated: "#fbfcfa", muted: "#6d7c72", accent: "#2f6b45", income: "#1f8a62", expense: "#c4473a", line: "#d7e0d6", onAccent: "#ffffff", chart: "#1a1a1a" },
  hongkong: { background: "#14080e", foreground: "#ffe9c4", elevated: "#241018", muted: "#c49278", accent: "#ff4b5c", income: "#f0c14b", expense: "#ff7ad9", line: "#4a2430", onAccent: "#ffffff", chart: "#ff5a8a" },
};

export function isThemeId(v: string | null): v is ThemeId {
  return THEME_IDS.includes(v as ThemeId);
}

export function isFontId(v: string | null | undefined): v is FontId {
  return FONT_IDS.includes(v as FontId);
}

export function isFontSizeId(v: string | null | undefined): v is FontSizeId {
  return FONT_SIZE_IDS.includes(v as FontSizeId);
}

export function isRadiusId(v: string | null | undefined): v is RadiusId {
  return RADIUS_IDS.includes(v as RadiusId);
}

export function isMotionId(v: string | null | undefined): v is MotionId {
  return MOTION_IDS.includes(v as MotionId);
}

export function isDepthId(v: string | null | undefined): v is DepthId {
  return DEPTH_IDS.includes(v as DepthId);
}

export function isGlowId(v: string | null | undefined): v is GlowId {
  return GLOW_IDS.includes(v as GlowId);
}

export function readSavedTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (isThemeId(v)) return v;
  } catch {
    /* ignore */
  }
  return "normal";
}

export function readSavedCustom(): ThemeCustom {
  try {
    const raw = localStorage.getItem(THEME_CUSTOM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ThemeCustom;
    return {
      background: normalizeHex(parsed.background),
      foreground: normalizeHex(parsed.foreground),
      elevated: normalizeHex(parsed.elevated),
      muted: normalizeHex(parsed.muted),
      accent: normalizeHex(parsed.accent),
      income: normalizeHex(parsed.income),
      expense: normalizeHex(parsed.expense),
      line: normalizeHex(parsed.line),
      onAccent: normalizeHex(parsed.onAccent),
      chart: normalizeHex(parsed.chart),
      fontId: isFontId(parsed.fontId) ? parsed.fontId : undefined,
      fontSize: isFontSizeId(parsed.fontSize) ? parsed.fontSize : undefined,
      wallpaper: typeof parsed.wallpaper === "string" ? parsed.wallpaper : undefined,
      wallpaperMode: parsed.wallpaperMode === "none" || parsed.wallpaperMode === "custom" || parsed.wallpaperMode === "theme" ? parsed.wallpaperMode : undefined,
      wallpaperOpacity: typeof parsed.wallpaperOpacity === "number" ? parsed.wallpaperOpacity : undefined,
      radius: isRadiusId(parsed.radius) ? parsed.radius : undefined,
      motion: isMotionId(parsed.motion) ? parsed.motion : undefined,
      depth: isDepthId(parsed.depth) ? parsed.depth : undefined,
      glow: isGlowId(parsed.glow) ? parsed.glow : undefined,
    };
  } catch {
    return {};
  }
}

export function colorsOnly(custom: ThemeCustom): ThemeCustom {
  return {
    fontId: custom.fontId,
    fontSize: custom.fontSize,
    wallpaper: custom.wallpaper,
    wallpaperMode: custom.wallpaperMode,
    wallpaperOpacity: custom.wallpaperOpacity,
    radius: custom.radius,
    motion: custom.motion,
    depth: custom.depth,
    glow: custom.glow,
  };
}

function themeWallpaper(id: ThemeId): string {
  if (id === "normal" || id === "mist" || id === "ink" || id === "cyberpunk") return "none";
  return `url("${assetUrl(`wallpapers/${id}.jpg`)}")`;
}

export const THEME_WALLPAPERS: Record<ThemeId, string> = Object.fromEntries(
  THEME_IDS.map((id) => [id, themeWallpaper(id)]),
) as Record<ThemeId, string>;

export function clampWallpaperOpacity(n: number | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 15;
  return Math.min(80, Math.max(8, Math.round(n)));
}

export function normalizeHex(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return undefined;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return {
    r: Number.parseInt(n.slice(1, 3), 16),
    g: Number.parseInt(n.slice(3, 5), 16),
    b: Number.parseInt(n.slice(5, 7), 16),
  };
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

export function onAccentFor(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? "#1c1c1e" : "#ffffff";
}

export function isDarkTheme(theme: ThemeId): boolean {
  return theme === "dark" || theme === "cyberpunk" || theme === "hongkong";
}

export function applyTheme(theme: ThemeId, custom: ThemeCustom = {}): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const keys = Object.keys(COLOR_CSS) as ThemeColorKey[];
  for (const key of keys) {
    const hex = normalizeHex(custom[key]);
    if (hex) root.style.setProperty(COLOR_CSS[key], hex);
    else root.style.removeProperty(COLOR_CSS[key]);
  }
  const accent = normalizeHex(custom.accent);
  const onAccent = normalizeHex(custom.onAccent);
  if (accent) {
    root.style.setProperty("--color-on-accent", onAccent ?? onAccentFor(accent));
    root.style.setProperty("--color-accent-soft", `color-mix(in srgb, ${accent} 18%, var(--color-elevated))`);
  } else {
    if (onAccent) root.style.setProperty("--color-on-accent", onAccent);
    else root.style.removeProperty("--color-on-accent");
    root.style.removeProperty("--color-accent-soft");
  }
  const fontId = isFontId(custom.fontId) ? custom.fontId : "theme";
  if (fontId === "theme") {
    root.removeAttribute("data-font");
    root.style.removeProperty("--font-sans");
    root.style.removeProperty("--font-display");
  } else {
    root.setAttribute("data-font", fontId);
    const stack = FONT_STACKS[fontId];
    root.style.setProperty("--font-sans", stack);
    root.style.setProperty("--font-display", stack);
  }
  const size = isFontSizeId(custom.fontSize) ? custom.fontSize : "md";
  if (size === "md") {
    root.removeAttribute("data-font-size");
    root.style.removeProperty("font-size");
  } else {
    root.setAttribute("data-font-size", size);
    root.style.setProperty("font-size", FONT_SIZE_PX[size]);
  }
  const bg = normalizeHex(custom.background) ?? THEME_PRESETS[theme].background;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", bg);
  const mode = custom.wallpaperMode ?? (custom.wallpaper ? "custom" : "theme");
  const opacity = clampWallpaperOpacity(custom.wallpaperOpacity) / 100;
  root.style.setProperty("--wallpaper-opacity", String(opacity));
  if (mode === "none") {
    root.setAttribute("data-wallpaper", "none");
    root.style.removeProperty("--app-wallpaper");
  } else if (mode === "custom" && custom.wallpaper) {
    root.setAttribute("data-wallpaper", "custom");
    root.style.setProperty("--app-wallpaper", `url("${custom.wallpaper}")`);
  } else if (THEME_WALLPAPERS[theme] === "none") {
    root.setAttribute("data-wallpaper", "none");
    root.style.removeProperty("--app-wallpaper");
  } else {
    root.setAttribute("data-wallpaper", "theme");
    root.style.setProperty("--app-wallpaper", THEME_WALLPAPERS[theme]);
  }
  const radius = isRadiusId(custom.radius) ? custom.radius : "regular";
  if (radius === "regular") root.removeAttribute("data-radius");
  else root.setAttribute("data-radius", radius);
  const motion = isMotionId(custom.motion) ? custom.motion : "soft";
  if (motion === "soft") root.removeAttribute("data-motion");
  else root.setAttribute("data-motion", motion);
  const depth = isDepthId(custom.depth) ? custom.depth : undefined;
  if (!depth) root.removeAttribute("data-depth");
  else root.setAttribute("data-depth", depth);
  const glow = isGlowId(custom.glow) ? custom.glow : undefined;
  if (!glow) root.removeAttribute("data-glow");
  else root.setAttribute("data-glow", glow);
}
