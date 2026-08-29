export const THEME_IDS = ["normal", "dark", "pinky", "anime", "cyberpunk"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeCustom = {
  background?: string;
  foreground?: string;
  accent?: string;
};

export const THEME_KEY = "hk-life-money-theme";
export const THEME_CUSTOM_KEY = "hk-life-money-theme-custom";

export const THEME_PRESETS: Record<
  ThemeId,
  { background: string; foreground: string; accent: string; elevated: string }
> = {
  normal: { background: "#f2f2f7", foreground: "#1c1c1e", accent: "#007aff", elevated: "#ffffff" },
  dark: { background: "#000000", foreground: "#f5f5f7", accent: "#0a84ff", elevated: "#1c1c1e" },
  pinky: { background: "#fdf2f8", foreground: "#4a044e", accent: "#db2777", elevated: "#ffffff" },
  anime: { background: "#fff1f5", foreground: "#2b1638", accent: "#ff5d8f", elevated: "#ffffff" },
  cyberpunk: { background: "#090414", foreground: "#d8f3ff", accent: "#00e5ff", elevated: "#140c28" },
};

export function isThemeId(v: string | null): v is ThemeId {
  return THEME_IDS.includes(v as ThemeId);
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
      accent: normalizeHex(parsed.accent),
    };
  } catch {
    return {};
  }
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
  return theme === "dark" || theme === "cyberpunk";
}

export function applyTheme(theme: ThemeId, custom: ThemeCustom = {}): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const pairs: [keyof ThemeCustom, string][] = [
    ["background", "--color-background"],
    ["foreground", "--color-foreground"],
    ["accent", "--color-accent"],
  ];
  for (const [key, css] of pairs) {
    const hex = normalizeHex(custom[key]);
    if (hex) root.style.setProperty(css, hex);
    else root.style.removeProperty(css);
  }
  const accent = normalizeHex(custom.accent);
  if (accent) {
    root.style.setProperty("--color-on-accent", onAccentFor(accent));
    root.style.setProperty("--color-accent-soft", `color-mix(in srgb, ${accent} 18%, var(--color-elevated))`);
  } else {
    root.style.removeProperty("--color-on-accent");
    root.style.removeProperty("--color-accent-soft");
  }
  const bg = normalizeHex(custom.background) ?? THEME_PRESETS[theme].background;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", bg);
}
