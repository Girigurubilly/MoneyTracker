/** Vite `base` with a trailing slash, e.g. `/` or `/hk-life-money/`. */
export function viteBase(): string {
  const raw = import.meta.env.BASE_URL || "/";
  if (!raw || raw === "./") return "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/** Router basepath without a trailing slash. `undefined` at the site root. */
export function routerBasepath(): string | undefined {
  const trimmed = viteBase().replace(/\/$/, "");
  return trimmed ? trimmed : undefined;
}

/** Prefix a root-relative public path with the Vite base (GitHub project Pages). */
export function assetUrl(path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${viteBase()}${p}`;
}
