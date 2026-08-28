# Host on GitHub Pages

HK Life Money is a **static** app. Ledgers live in the visitor’s **IndexedDB**, not on a server.

Public URL: [https://girigurubilly.github.io/MoneyTracker/](https://girigurubilly.github.io/MoneyTracker/)

## Why the last deploy failed

The **Deploy GitHub Pages** job (`static.yml`) ran `scripts/gh-pages-ci.py prepare`, which looks for an old `function RootDocument()` in `src/routes/__root.tsx`. That helper is gone — the root route now inlines the `<html>` document — so the patcher exited:

```text
could not patch __root.tsx — unexpected file contents
[pages] patched vite.config.ts
```

`npm run build:gh` also does not exist. The working command is `npm run build:pages`.

## What we use now

`.github/workflows/static.yml` builds with `npm run build:pages` (no source patching):

1. **Settings → Pages → Source: GitHub Actions**
2. Push to `main`, or **Actions → Deploy GitHub Pages → Run workflow**

Asset URLs use `/MoneyTracker/` so a project site loads JS/CSS correctly. Deep links (報表, 生活總覽, …) fall back through `404.html`.

## What does not change

- No login, no backend
- Data stays on the device (IndexedDB)
- Import / backup still run in the browser
