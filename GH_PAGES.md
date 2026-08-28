# Host on GitHub Pages

HK Life Money is a **static** app. Ledgers live in the visitor’s **IndexedDB**, not on a server.

Public URL: [https://girigurubilly.github.io/MoneyTracker/](https://girigurubilly.github.io/MoneyTracker/)

## Deploy

`.github/workflows/static.yml` runs `npm run build:pages` (no source patching):

1. **Settings → Pages → Source: GitHub Actions**
2. Push to `main`, or **Actions → Deploy GitHub Pages → Run workflow**

Asset URLs use `/MoneyTracker/` so a project site loads JS/CSS correctly. Deep links (報表, 生活總覽, …) fall back through `404.html`.

## What broke earlier

Two separate CI failures stacked:

1. **`could not patch __root.tsx — unexpected file contents`**  
   An old helper (`scripts/gh-pages-ci.py`) looked for `function RootDocument()` and rewrote `__root.tsx` / `vite.config.ts`. The root route now inlines `<html>` itself, so that patcher exited 1. The workflow no longer runs it.

2. **Conflicting route paths (`/` twice, `/budget` twice, …)**  
   Uploads left a leftover `src/routes/_app/` tree next to the real `src/routes/*.tsx` files. TanStack Router treats both as the same URLs and refuses to build. The `_app` copies were removed; the working routes are the flat files (`src/routes/index.tsx`, `budget.tsx`, …).

## What does not change

- No login, no backend
- Data stays on the device (IndexedDB)
- Import / backup still run in the browser
