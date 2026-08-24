# Host on GitHub Pages

HK Life Money is a **static** app. Ledgers live in the visitor’s **IndexedDB** (typically hundreds of MB), not in localStorage’s 5–10 MB cap, and not on a server. The screens stay the same.

## One-time setup

1. Push this repo to GitHub.
2. Settings → Pages → Source: **GitHub Actions**.
3. Push to `main` (or run the **Deploy GitHub Pages** workflow).

Project site (`https://USER.github.io/REPO/`): in the workflow, set `BASE_PATH` to `/REPO/`.

User/org site (`https://USER.github.io/`): leave `BASE_PATH` empty or `/`.

## Local static build

```bash
BASE_PATH=/your-repo/ npm run build:gh
```

Output: `.output/public` (includes `404.html` so in-app routes work).

## What does not change

- No login, no backend
- FX still uses the public Frankfurter API
- Import / backup still run in the browser
