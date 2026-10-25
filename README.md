# HK Life Money

Private money tracker for Hong Kong: spending, budgets, assets, trips and retirement. The live app is [HK Life Money](https://girigurubilly.github.io/MoneyTracker/).

Records stay in the browser. There is no server ledger and no bank sync.

## Privacy

- The ledger is stored in **IndexedDB** on the device.
- Optional Google Drive backup is encrypted with a password you choose. Setup is in [GH_PAGES.md](GH_PAGES.md).
- Nothing is uploaded unless you sign in and sync yourself.

## Develop

```bash
npm install
npm run dev
```

The dev server listens on port 8080. `npm test` runs the unit tests. `npm run typecheck` checks TypeScript.

## Build and deploy

GitHub Pages does **not** use a committed `dist/` folder. Pushing to `main` runs [`.github/workflows/static.yml`](.github/workflows/static.yml), which builds with `npm run build:pages` and publishes `.output/public`.

Local production build:

```bash
npm run build
```

Pages settings, the `/MoneyTracker/` base path, and the one-time Google client setup are in [GH_PAGES.md](GH_PAGES.md).
