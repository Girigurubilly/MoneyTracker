#!/usr/bin/env node
/**
 * Static GitHub Pages build. Same UI as the Vercel app — client IndexedDB,
 * no server. Usage:
 *   BASE_PATH=/repo-name/ npm run build:gh
 * For a user/org site (name.github.io) leave BASE_PATH unset or "/".
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

process.env.GITHUB_PAGES = "1";
if (!process.env.BASE_PATH) process.env.BASE_PATH = "/";

const result = spawnSync(
  process.execPath,
  ["scripts/with-app-env.mjs", "vite", "build"],
  { stdio: "inherit", env: process.env },
);
if (result.status) process.exit(result.status ?? 1);

const pub = join(root, ".output", "public");
mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, ".nojekyll"), "");
const index = join(pub, "index.html");
const fallback = join(pub, "404.html");
if (existsSync(index) && !existsSync(fallback)) {
  copyFileSync(index, fallback);
}
