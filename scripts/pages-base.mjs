/**
 * Shared GitHub Pages / Vite `base` helpers.
 * Used by vite.config.ts and prepare-gh-pages.mjs.
 */

export function isGitHubPagesBuild(env = process.env) {
  const preset = String(env.NITRO_PRESET ?? env.NITRO_PRESET_NAME ?? "").replace(/-/g, "_");
  return preset === "github_pages";
}

/** Vite `base` with trailing slash. */
export function resolvePublicBase(env = process.env) {
  const raw = String(env.VITE_BASE_PATH || env.BASE_PATH || "/").trim() || "/";
  if (raw === "./") return "./";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
}

/** TanStack Router basepath (no trailing slash). Empty string = site root. */
export function resolveRouterBasepath(env = process.env) {
  return resolvePublicBase(env).replace(/\/$/, "");
}

function joinBase(base, path) {
  const b = !base || base === "/" ? "/" : base.endsWith("/") ? base : `${base}/`;
  const p = String(path).replace(/^\//, "");
  return `${b}${p}`.replace(/([^:]\/)\/+/g, "$1");
}

export function isUsableShell(html) {
  const s = String(html || "");
  if (s.trim().length < 80) return false;
  return s.includes("<script") || s.includes("modulepreload") || s.includes('id="app"');
}

export function pickClientEntry(assetFileNames) {
  const files = Array.isArray(assetFileNames) ? assetFileNames : [];
  const js = files
    .filter((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f))
    .sort((a, b) => b.length - a.length)[0];
  const css = files.filter((f) => /^styles-[A-Za-z0-9_-]+\.css$/.test(f))[0];
  return { js, css };
}

/** Minimal SPA document the client bundle can hydrate (no Nitro prerender). */
export function buildSpaShell({ base = "/", js, css }) {
  if (!js) throw new Error("buildSpaShell: missing client entry");
  const stylesheet = css ? `<link rel="stylesheet" href="${joinBase(base, `assets/${css}`)}"/>` : "";
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>HK Life Money</title>
<meta name="theme-color" content="#f2f2f7"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-title" content="HK Life Money"/>
${stylesheet}
<link rel="modulepreload" href="${joinBase(base, `assets/${js}`)}"/>
<link rel="icon" type="image/svg+xml" href="${joinBase(base, "favicon.svg")}"/>
<link rel="manifest" href="${joinBase(base, "__grok/manifest.webmanifest")}"/>
<link rel="apple-touch-icon" href="${joinBase(base, "__grok/icon-180.png")}"/>
</head>
<body class="bg-background text-foreground antialiased">
<script type="module" async src="${joinBase(base, `assets/${js}`)}"></script>
</body>
</html>
`;
}

/**
 * Prerender HTML can point at an SSR-hashed CSS file that the client build
 * replaced. Rewrite missing `/assets/<stem>-<hash>.<ext>` to the file on disk.
 */
export function rewriteMissingHashedAssets(html, assetFileNames) {
  const files = Array.isArray(assetFileNames) ? assetFileNames : [];
  const present = new Set(files);
  return String(html).replace(/(\/assets\/)([A-Za-z0-9_.@-]+)/g, (all, prefix, name) => {
    if (present.has(name)) return all;
    const m = name.match(/^(.*)-[A-Za-z0-9_-]+\.([A-Za-z0-9]+)$/);
    if (!m) return all;
    const candidates = files.filter((f) => f.startsWith(`${m[1]}-`) && f.endsWith(`.${m[2]}`));
    if (candidates.length === 0) return all;
    return `${prefix}${candidates[0]}`;
  });
}

/**
 * Prefix root-absolute app assets with the Vite base when a project Pages
 * path was requested but the shell still points at `/assets` / `/__grok`.
 */
export function ensureAssetBase(html, base) {
  if (!base || base === "/" || base === "./") return String(html);
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  return String(html).replace(/(["'])(\/(?:assets|__grok|favicon)[^"']*)\1/g, (all, q, path) => {
    if (path === b || path.startsWith(`${b}/`)) return all;
    return `${q}${b}${path}${q}`;
  });
}

/** Map a document href/src to a file under the static output directory. */
export function hrefToPublicFile(href, publicDir, base = "/") {
  let p = String(href || "")
    .split("?")[0]
    .split("#")[0];
  if (!p || p.startsWith("http:") || p.startsWith("https:") || p.startsWith("data:")) return null;
  const b = !base || base === "/" || base === "./" ? "" : base.endsWith("/") ? base.slice(0, -1) : base;
  if (b && (p === b || p.startsWith(`${b}/`))) p = p.slice(b.length) || "/";
  if (p.startsWith("/")) p = p.slice(1);
  return `${String(publicDir).replace(/\/$/, "")}/${p}`;
}
