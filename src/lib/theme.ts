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
  normal: svgBg('<rect width="390" height="844" fill="#d9eefc"/><circle cx="310" cy="90" r="36" fill="#ffe08a"/><path d="M-10 560 Q120 500 200 560 T400 540 L400 844 L-10 844Z" fill="#9ec9a3"/><path d="M40 560 L150 390 L260 560Z" fill="#7e9ec2"/><circle cx="86" cy="620" r="16" fill="#fff"/><circle cx="78" cy="616" r="3" fill="#334"/><circle cx="94" cy="616" r="3" fill="#334"/><path d="M78 626 Q86 632 94 626" fill="none" stroke="#334" stroke-width="1.4"/>'),
  dark: svgBg('<rect width="390" height="844" fill="#101828"/><circle cx="300" cy="88" r="26" fill="#f1f5f9"/><circle cx="60" cy="140" r="3" fill="#e2e8f0"/><circle cx="120" cy="80" r="2" fill="#e2e8f0"/><path d="M0 620 L80 500 H130 L160 620 H230 L270 430 H330 L390 620 V844 H0Z" fill="#1e293b"/><circle cx="70" cy="680" r="18" fill="#334155"/><circle cx="62" cy="674" r="3" fill="#94a3b8"/><circle cx="78" cy="674" r="3" fill="#94a3b8"/>'),
  pinky: svgBg('<rect width="390" height="844" fill="#ffe4f1"/><circle cx="300" cy="100" r="28" fill="#fecdd3"/><circle cx="70" cy="180" r="8" fill="#fb7185"/><circle cx="120" cy="230" r="5" fill="#f472b6"/><ellipse cx="80" cy="640" rx="28" ry="34" fill="#fff"/><circle cx="80" cy="608" r="18" fill="#fff"/><circle cx="68" cy="600" r="8" fill="#fecdd3"/><circle cx="92" cy="600" r="8" fill="#fecdd3"/><circle cx="74" cy="606" r="2.5" fill="#4a044e"/><circle cx="86" cy="606" r="2.5" fill="#4a044e"/><path d="M74 616 Q80 622 86 616" fill="none" stroke="#db2777" stroke-width="1.5"/>'),
  anime: svgBg('<rect width="390" height="844" fill="#ffd6e8"/><path d="M0 0 H390 V250 Q195 310 0 250Z" fill="#ffb4c8"/><circle cx="320" cy="70" r="30" fill="#ffe08a"/><path d="M0 640 Q80 580 160 640 T390 620 V844 H0Z" fill="#86efac" opacity=".55"/><circle cx="86" cy="610" r="22" fill="#ffe4e6"/><path d="M64 598 Q70 572 86 588 Q102 572 108 598" fill="#4a2a12"/><circle cx="78" cy="608" r="3" fill="#2b1638"/><circle cx="94" cy="608" r="3" fill="#2b1638"/><path d="M78 618 Q86 624 94 618" fill="none" stroke="#db2777" stroke-width="1.6"/>'),
  cyberpunk: svgBg('<rect width="390" height="844" fill="#12081f"/><path d="M0 0 H390 V210 Q200 260 0 210Z" fill="#2a0d3a"/><circle cx="64" cy="70" r="4" fill="#00e5ff"/><circle cx="330" cy="50" r="3" fill="#ff2e97"/><path d="M0 650 L70 520 H120 L150 650 H210 L250 470 H300 L350 650 H390 V844 H0Z" fill="#1b1033"/><circle cx="300" cy="700" r="20" fill="#2a1848"/><rect x="292" y="692" width="7" height="5" fill="#00e5ff"/><rect x="302" y="692" width="7" height="5" fill="#ff2e97"/>'),
  shiba: svgBg('<rect width="390" height="844" fill="#ffe8cc"/><circle cx="318" cy="86" r="32" fill="#ffe08a"/><path d="M0 620 Q200 560 390 640 V844 H0Z" fill="#86efac" opacity=".45"/><ellipse cx="92" cy="668" rx="40" ry="26" fill="#f97316"/><circle cx="92" cy="640" r="24" fill="#fdba74"/><ellipse cx="70" cy="624" rx="10" ry="14" fill="#ea580c"/><ellipse cx="114" cy="624" rx="10" ry="14" fill="#ea580c"/><circle cx="84" cy="638" r="3.2" fill="#3f1d0a"/><circle cx="100" cy="638" r="3.2" fill="#3f1d0a"/><circle cx="92" cy="648" r="3" fill="#9a3412"/><path d="M84 652 Q92 658 100 652" fill="none" stroke="#9a3412" stroke-width="1.6"/>'),
  cat: svgBg('<rect width="390" height="844" fill="#f6e6d3"/><path d="M48 0 H78 V844 H48Z" fill="#e8d2b8" opacity=".45"/><path d="M312 0 H342 V844 H312Z" fill="#e8d2b8" opacity=".35"/><ellipse cx="300" cy="680" rx="30" ry="22" fill="#d6b48e"/><circle cx="300" cy="656" r="20" fill="#e7c9a5"/><polygon points="282,646 288,622 304,646" fill="#d6b48e"/><polygon points="298,646 316,620 322,646" fill="#d6b48e"/><circle cx="293" cy="654" r="2.6" fill="#3b2a24"/><circle cx="307" cy="654" r="2.6" fill="#3b2a24"/><path d="M288 662 L276 658" stroke="#3b2a24" stroke-width="1"/><path d="M312 662 L324 658" stroke="#3b2a24" stroke-width="1"/>'),
  panda: svgBg('<rect width="390" height="844" fill="#eef6ea"/><rect x="78" y="0" width="10" height="844" fill="#86efac" opacity=".35"/><rect x="210" y="0" width="8" height="844" fill="#4ade80" opacity=".28"/><circle cx="300" cy="150" r="28" fill="#f8fafc"/><circle cx="282" cy="138" r="12" fill="#111827"/><circle cx="318" cy="138" r="12" fill="#111827"/><circle cx="292" cy="152" r="3" fill="#111827"/><circle cx="308" cy="152" r="3" fill="#111827"/><ellipse cx="300" cy="164" rx="6" ry="4" fill="#111827"/>'),
  hongkong: svgBg('<rect width="390" height="844" fill="#3a1420"/><circle cx="308" cy="78" r="22" fill="#fbbf24"/><path d="M0 660 L55 520 H95 L120 660 H175 L210 440 H270 L300 660 H350 L390 580 V844 H0Z" fill="#7f1d1d"/><path d="M20 760 Q80 730 140 760 T280 750 L200 700 Z" fill="#f8fafc" opacity=".25"/><circle cx="64" cy="700" r="14" fill="#ffe4e6"/><circle cx="58" cy="696" r="2" fill="#1a0c10"/><circle cx="70" cy="696" r="2" fill="#1a0c10"/>'),
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
