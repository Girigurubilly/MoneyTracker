#!/usr/bin/env node
/**
 * Static GitHub Pages build. Same UI as the Vercel app — client IndexedDB,
 * no server. Usage:
 *   BASE_PATH=/repo-name/ npm run build:gh
 * For a user/org site (name.github.io) leave BASE_PATH unset or "/".
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { injectGrokPwaHead } from "./grok-pwa-shared.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

process.env.GITHUB_PAGES = "1";
process.env.VITE_GITHUB_PAGES = "1";
if (!process.env.BASE_PATH) process.env.BASE_PATH = "/";

const base = process.env.BASE_PATH.endsWith("/")
  ? process.env.BASE_PATH
  : `${process.env.BASE_PATH}/`;

const result = spawnSync(
  process.execPath,
  ["scripts/with-app-env.mjs", "vite", "build"],
  { stdio: "inherit", env: process.env },
);

const pub = join(root, ".output", "public");
const clientDir = join(root, "dist", "client");

function dirHasAssets(dir) {
  try {
    return existsSync(join(dir, "assets")) && readdirSync(join(dir, "assets")).length > 0;
  } catch {
    return false;
  }
}

const source = dirHasAssets(clientDir)
  ? clientDir
  : dirHasAssets(pub)
    ? pub
    : null;

if (!source) {
  console.error(
    "[build:gh] No client assets found in dist/client or .output/public. Vite build status:",
    result.status,
  );
  process.exit(result.status ?? 1);
}

if (source !== pub) {
  mkdirSync(join(root, ".output"), { recursive: true });
  rmSync(pub, { recursive: true, force: true });
  cpSync(source, pub, { recursive: true });
}

writeFileSync(join(pub, ".nojekyll"), "");

const assetsDir = join(pub, "assets");
const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
const jsEntry =
  assetFiles.find((f) => /^index-[^.]+\.js$/.test(f)) ||
  assetFiles.find((f) => f.startsWith("index-") && f.endsWith(".js") && !f.includes(".index"));
const cssFiles = assetFiles.filter((f) => f.endsWith(".css"));

if (!jsEntry) {
  console.error("[build:gh] Could not find client entry (assets/index-*.js). Have:", assetFiles.slice(0, 20));
  process.exit(1);
}

const cssLinks = cssFiles
  .map((f) => `    <link rel="stylesheet" href="${base}assets/${f}" />`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="zh-HK" class="antialiased">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0284c7" />
    <meta name="description" content="Privacy-first personal finance for Hong Kong — daily tracking, home, travel, and retirement planning." />
    <title>HK Life Money</title>
    <link rel="icon" type="image/svg+xml" href="${base}favicon.svg" />
    <link rel="manifest" href="${base}__grok/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="${base}__grok/icon-180.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Noto+Sans+TC:wght@400;500;600;700&display=swap" />
${cssLinks}
    <script src="https://grok.com/grok-app-builder/extensions.js" async></script>
  </head>
  <body class="bg-background text-foreground">
    <div id="root"></div>
    <script type="module" src="${base}assets/${jsEntry}"></script>
  </body>
</html>
`;

let outHtml = html;
try {
  outHtml = injectGrokPwaHead(html, { cwd: root, appName: "HK Life Money" });
} catch (err) {
  console.warn("[build:gh] PWA head inject skipped:", err?.message ?? err);
}

// Prefix platform-absolute /__grok paths with the Pages base.
outHtml = outHtml.replaceAll('href="/__grok/', `href="${base}__grok/`);
outHtml = outHtml.replaceAll("href='/__grok/", `href='${base}__grok/`);

writeFileSync(join(pub, "index.html"), outHtml);
writeFileSync(join(pub, "404.html"), outHtml);

// Nitro/prerender may have written a 0-byte `index` (no extension). Remove it
// so Pages never serves an empty document instead of index.html.
const strayIndex = join(pub, "index");
if (existsSync(strayIndex) && statSync(strayIndex).isFile()) {
  const size = statSync(strayIndex).size;
  if (size === 0) rmSync(strayIndex);
}

const written = readFileSync(join(pub, "index.html"), "utf8");
if (!written.includes(jsEntry) || written.length < 200) {
  console.error("[build:gh] index.html looks invalid");
  process.exit(1);
}

console.log(`[build:gh] Published static site → .output/public`);
console.log(`[build:gh] base=${base} entry=assets/${jsEntry} css=${cssFiles.length}`);

if (result.status && result.status !== 0) {
  console.warn(
    "[build:gh] vite build exited",
    result.status,
    "but a usable static site was assembled.",
  );
}

process.exit(0);
