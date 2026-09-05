export const THEME_IDS = ["normal", "dark", "pinky", "anime", "cyberpunk", "shiba", "cat", "panda", "hongkong"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const FONT_IDS = ["theme", "system", "nunito", "zen-maru", "rajdhani", "noto", "serif"] as const;
export type FontId = (typeof FONT_IDS)[number];

export const FONT_SIZE_IDS = ["sm", "md", "lg", "xl"] as const;
export type FontSizeId = (typeof FONT_SIZE_IDS)[number];

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

export type ThemeColorKey = "background" | "foreground" | "elevated" | "muted" | "accent";

export type ThemeCustom = {
  background?: string;
  foreground?: string;
  elevated?: string;
  muted?: string;
  accent?: string;
  fontId?: FontId;
  fontSize?: FontSizeId;
  wallpaper?: string;
  wallpaperMode?: "none" | "theme" | "custom";
  wallpaperOpacity?: number;
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
};

export const THEME_PRESETS: Record<
  ThemeId,
  { background: string; foreground: string; elevated: string; muted: string; accent: string }
> = {
  normal: { background: "#f2f2f7", foreground: "#1c1c1e", elevated: "#ffffff", muted: "#8e8e93", accent: "#007aff" },
  dark: { background: "#000000", foreground: "#f5f5f7", elevated: "#1c1c1e", muted: "#98989d", accent: "#0a84ff" },
  pinky: { background: "#fdf2f8", foreground: "#4a044e", elevated: "#ffffff", muted: "#a15a86", accent: "#db2777" },
  anime: { background: "#fff1f5", foreground: "#2b1638", elevated: "#ffffff", muted: "#8b6b90", accent: "#ff5d8f" },
  cyberpunk: { background: "#090414", foreground: "#d8f3ff", elevated: "#140c28", muted: "#7aa8c4", accent: "#00e5ff" },
  shiba: { background: "#fff4e5", foreground: "#4a2a12", elevated: "#fffaf3", muted: "#b07a4a", accent: "#e67a2e" },
  cat: { background: "#f7efe6", foreground: "#3b2a24", elevated: "#fffdf9", muted: "#9c7b6e", accent: "#d97757" },
  panda: { background: "#f3f6f1", foreground: "#1f2a22", elevated: "#ffffff", muted: "#6f7f72", accent: "#3f7a4e" },
  hongkong: { background: "#1a0c10", foreground: "#ffe9c8", elevated: "#2a1218", muted: "#c08a6a", accent: "#e23d3d" },
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
      fontId: isFontId(parsed.fontId) ? parsed.fontId : undefined,
      fontSize: isFontSizeId(parsed.fontSize) ? parsed.fontSize : undefined,
      wallpaper: typeof parsed.wallpaper === "string" ? parsed.wallpaper : undefined,
      wallpaperMode: parsed.wallpaperMode === "none" || parsed.wallpaperMode === "custom" || parsed.wallpaperMode === "theme" ? parsed.wallpaperMode : undefined,
      wallpaperOpacity: typeof parsed.wallpaperOpacity === "number" ? parsed.wallpaperOpacity : undefined,
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
  };
}

function svgBg(markup: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844">${markup}</svg>`)}")`;
}

export const THEME_WALLPAPERS: Record<ThemeId, string> = {
  normal: svgBg('<rect width="390" height="844" fill="#dbeafe"/><circle cx="320" cy="90" r="120" fill="#93c5fd" opacity=".55"/><circle cx="40" cy="720" r="160" fill="#bfdbfe" opacity=".7"/>'),
  dark: svgBg('<rect width="390" height="844" fill="#020617"/><circle cx="300" cy="80" r="140" fill="#1e3a8a" opacity=".55"/><circle cx="60" cy="760" r="180" fill="#0f172a"/>'),
  pinky: svgBg('<rect width="390" height="844" fill="#fbcfe8"/><circle cx="70" cy="120" r="130" fill="#f9a8d4" opacity=".8"/><circle cx="340" cy="700" r="170" fill="#f472b6" opacity=".45"/>'),
  anime: svgBg('<rect width="390" height="844" fill="#ffe4e6"/><circle cx="310" cy="70" r="110" fill="#fda4af"/><circle cx="30" cy="640" r="150" fill="#c4b5fd" opacity=".55"/>'),
  cyberpunk: svgBg('<rect width="390" height="844" fill="#0b0520"/><rect x="0" y="520" width="390" height="8" fill="#00e5ff" opacity=".5"/><rect x="40" y="200" width="12" height="400" fill="#ff2e97" opacity=".35"/><rect x="300" y="80" width="18" height="520" fill="#00e5ff" opacity=".25"/>'),
  shiba: svgBg('<rect width="390" height="844" fill="#ffedd5"/><ellipse cx="300" cy="140" rx="90" ry="70" fill="#fdba74"/><circle cx="270" cy="120" r="22" fill="#9a3412"/><circle cx="330" cy="120" r="22" fill="#9a3412"/><circle cx="80" cy="680" r="70" fill="#fb923c" opacity=".55"/>'),
  cat: svgBg('<rect width="390" height="844" fill="#fae8d4"/><ellipse cx="80" cy="160" rx="70" ry="50" fill="#e7c9a5"/><polygon points="40,130 55,80 80,130" fill="#d6b48e"/><polygon points="90,130 120,75 140,130" fill="#d6b48e"/><circle cx="320" cy="720" r="90" fill="#f3d5b5"/>'),
  panda: svgBg('<rect width="390" height="844" fill="#ecfdf3"/><rect x="60" y="0" width="18" height="844" fill="#86efac" opacity=".55"/><rect x="200" y="0" width="14" height="844" fill="#4ade80" opacity=".4"/><circle cx="310" cy="150" r="50" fill="#111827"/><circle cx="250" cy="150" r="50" fill="#111827"/><circle cx="280" cy="190" r="48" fill="#f8fafc"/>'),
  hongkong: svgBg('<rect width="390" height="844" fill="#3f0d12"/><rect x="20" y="480" width="40" height="364" fill="#7f1d1d"/><rect x="80" y="360" width="50" height="484" fill="#991b1b"/><rect x="150" y="420" width="36" height="424" fill="#b91c1c"/><rect x="210" y="300" width="70" height="544" fill="#7f1d1d"/><rect x="300" y="390" width="55" height="454" fill="#991b1b"/><circle cx="320" cy="80" r="36" fill="#fbbf24" opacity=".85"/>'),
};

export function clampWallpaperOpacity(n: number | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 40;
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
  if (accent) {
    root.style.setProperty("--color-on-accent", onAccentFor(accent));
    root.style.setProperty("--color-accent-soft", `color-mix(in srgb, ${accent} 18%, var(--color-elevated))`);
  } else {
    root.style.removeProperty("--color-on-accent");
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
  } else {
    root.setAttribute("data-wallpaper", "theme");
    root.style.setProperty("--app-wallpaper", THEME_WALLPAPERS[theme]);
  }
}
