#!/usr/bin/env node
/**
 * Finish a GitHub Pages static export:
 * - pick the Nitro/Vite public dir
 * - ensure index.html (SPA shell, synthesized if prerender skipped it)
 * - rewrite prerender hashes that drifted from the client assets
 * - copy it to 404.html so client routes resolve on Pages
 * - write .nojekyll (underscore assets) and a static web manifest
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSpaShell,
  ensureAssetBase,
  hrefToPublicFile,
  isUsableShell,
  pickClientEntry,
  resolvePublicBase,
  rewriteMissingHashedAssets,
} from "./pages-base.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function listHtml(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".html"));
  } catch {
    return [];
  }
}

function pickPublicDir() {
  const candidates = [
    join(ROOT, ".output", "public"),
    join(ROOT, "dist"),
    join(ROOT, ".vercel", "output", "static"),
  ];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    const html = listHtml(dir);
    const hasAssets = existsSync(join(dir, "assets"));
    if (html.length || hasAssets) return dir;
  }
  return null;
}

function pickShell(dir) {
  const preferred = ["_shell.html", "index.html", "404.html"];
  for (const name of preferred) {
    const p = join(dir, name);
    if (existsSync(p) && statSync(p).isFile() && statSync(p).size > 80) return p;
  }
  const html = listHtml(dir);
  const nested = html.find((f) => f !== "404.html");
  return nested ? join(dir, nested) : null;
}

function listAssetNames(dir) {
  const assets = join(dir, "assets");
  try {
    return readdirSync(assets);
  } catch {
    return [];
  }
}

function rewriteShell(html, publicDir, base) {
  const assets = listAssetNames(publicDir);
  return ensureAssetBase(rewriteMissingHashedAssets(html, assets), base);
}

function collectHrefs(html) {
  const hrefs = [];
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) hrefs.push(m[1]);
  return hrefs;
}

const publicDir = pickPublicDir();
if (!publicDir) {
  console.error("[pages] no static output directory (.output/public, dist, or .vercel/output/static)");
  process.exit(1);
}

const base = resolvePublicBase();
const indexPath = join(publicDir, "index.html");
const leftoverIndex = join(publicDir, "index");
if (existsSync(leftoverIndex) && statSync(leftoverIndex).isFile() && statSync(leftoverIndex).size === 0) {
  unlinkSync(leftoverIndex);
}

const shell = pickShell(publicDir);
let html = "";
if (shell) html = rewriteShell(readFileSync(shell, "utf8"), publicDir, base);

if (!isUsableShell(html)) {
  const entry = pickClientEntry(listAssetNames(publicDir));
  if (!entry.js) {
    console.error(`[pages] no HTML shell and no client entry in ${publicDir}/assets`);
    process.exit(1);
  }
  html = buildSpaShell({ base, js: entry.js, css: entry.css });
  console.warn(`[pages] synthesized SPA shell from ${entry.js}`);
}

writeFileSync(indexPath, html);
copyFileSync(indexPath, join(publicDir, "404.html"));
writeFileSync(join(publicDir, ".nojekyll"), "");

const missing = [];
for (const href of collectHrefs(html)) {
  const file = hrefToPublicFile(href, publicDir, base);
  if (!file) continue;
  if (!existsSync(file)) missing.push(href);
}
if (missing.length) {
  console.error(`[pages] shell references missing files:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}

const start = base === "./" ? "./" : base;
mkdirSync(join(publicDir, "__grok"), { recursive: true });
writeFileSync(
  join(publicDir, "__grok", "manifest.webmanifest"),
  `${JSON.stringify(
    {
      name: "HK Life Money",
      short_name: "HK Life Money",
      id: start,
      start_url: start,
      scope: start,
      display: "standalone",
      background_color: "#f2f2f7",
      theme_color: "#f2f2f7",
      icons: [
        {
          src: `${start === "./" ? "./" : start}__grok/icon-180.png`.replace(/([^:]\/)\/+/g, "$1"),
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    null,
    2,
  )}\n`,
);

console.log(`[pages] static site ready at ${publicDir}`);
console.log(`[pages] base=${base} index=${existsSync(indexPath)} 404=yes .nojekyll=yes`);
