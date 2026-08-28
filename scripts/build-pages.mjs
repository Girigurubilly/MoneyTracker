#!/usr/bin/env node
/**
 * GitHub Pages static export.
 *
 * TanStack Start + Nitro `static` prerenders a working SPA `index.html` at the
 * site root, then Vite 8 / Rolldown still tries a Nitro server environment and
 * exits 1. Project-site bases (`/repo/`) often skip HTML entirely. If the
 * client assets are on disk we finish the export (and synthesize a shell).
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, ".output", "public");
const INDEX = join(PUBLIC, "index.html");
const ASSETS = join(PUBLIC, "assets");

function hasSpaShell() {
  if (!existsSync(INDEX)) return false;
  const html = readFileSync(INDEX, "utf8");
  return html.includes("<script") || html.includes("modulepreload") || html.includes('id="app"');
}

function hasClientAssets() {
  try {
    return readdirSync(ASSETS).some((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f));
  } catch {
    return false;
  }
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, NITRO_PRESET: process.env.NITRO_PRESET || "github_pages" },
    });
    child.on("exit", (code, signal) => resolve({ code: code ?? 1, signal }));
  });
}

const vite = await run("node", ["scripts/with-app-env.mjs", "vite", "build"]);
if (vite.code !== 0 && !hasSpaShell() && !hasClientAssets()) {
  process.exit(vite.code);
}
if (vite.code !== 0) {
  console.warn("[pages] Nitro server step failed after the client build; finishing the static export");
}

const prep = await run("node", ["scripts/prepare-gh-pages.mjs"]);
process.exit(prep.code);
