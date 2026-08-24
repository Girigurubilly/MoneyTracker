# Host on GitHub Pages

HK Life Money is a **static** app. Ledgers live in the visitor’s **IndexedDB**, not on a server.

## Why the public URL failed

[https://girigurubilly.github.io/MoneyTracker/](https://girigurubilly.github.io/MoneyTracker/) 404’d because GitHub published the **source repo** (no `index.html`).

After switching to a real build workflow, the run still failed:

1. **The Node 20 line is a warning, not the failure.** `actions/checkout@v4` / `setup-node@v4` mention Node 20; GitHub still runs them. The job is now on **v5/v6** (Node 24).
2. **The real error** is `npm run build:gh` exit 1. Copying only `static.yml` left the old Nitro “github-pages” build in `vite.config.ts`, which crashes on Vite 8 (`rolldownOptions.input should not be an html file when building for SSR`).

## Fix (copy this one file)

Replace **`.github/workflows/static.yml`** with the file in this project. That YAML is **self-contained**:

- Node 24-compatible actions (`checkout@v5`, `setup-node@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`)
- Patches the old Nitro Pages build before compiling
- Builds a client-only app
- Publishes `.output/public` with `/MoneyTracker/` asset URLs

Then:

1. **Settings → Pages → Source: GitHub Actions**
2. Keep **one** workflow only
3. **Actions → Deploy GitHub Pages → Run workflow**

After a green run: [https://girigurubilly.github.io/MoneyTracker/](https://girigurubilly.github.io/MoneyTracker/)

## What does not change

- No login, no backend
- FX still uses the public Frankfurter API
- Import / backup still run in the browser
- Data stays on the device (IndexedDB)
