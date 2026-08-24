#!/usr/bin/env python3
"""Patch the old Nitro Pages build and assemble a static site.

Used by .github/workflows/static.yml (copied into the workflow so pasting
that YAML alone is enough).
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

SPA_CLIENT = """\
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const el = document.getElementById("root");
if (!el) throw new Error("HK Life Money: missing #root");

createRoot(el).render(
  <StrictMode>
    <RouterProvider router={getRouter()} />
  </StrictMode>,
);
"""


def prepare() -> None:
    Path("src").mkdir(exist_ok=True)
    Path("src/spa-client.tsx").write_text(SPA_CLIENT)

    vite_path = Path("vite.config.ts")
    vite = vite_path.read_text()
    if "spa-client.tsx" not in vite:
        if "VITE_GITHUB_PAGES" not in vite:
            vite = vite.replace(
                'const githubPages = process.env.GITHUB_PAGES === "1";',
                'const githubPages = process.env.GITHUB_PAGES === "1";\n'
                "if (githubPages) process.env.VITE_GITHUB_PAGES = \"1\";",
            )
        vite = vite.replace(
            "tanstackStart(githubPages ? { spa: { enabled: true } } : {}),",
            "tanstackStart(githubPages ? { spa: { enabled: false }, prerender: { enabled: false }, client: { entry: \"spa-client.tsx\" } } : {}),",
        )
        vite = vite.replace(
            '...(command === "build" || isPreview\n      ? [\n          nitro({',
            '...(command === "build" || isPreview\n      ? githubPages ? [] : [\n          nitro({',
        )
        vite = vite.replace(
            'preset: githubPages ? "github-pages" : "vercel",',
            'preset: "vercel",',
        )
        vite_path.write_text(vite)
        print("[pages] patched vite.config.ts")
    else:
        print("[pages] vite.config.ts already Pages-ready")

    root_path = Path("src/routes/__root.tsx")
    root = root_path.read_text()
    if "VITE_GITHUB_PAGES" not in root:
        root = root.replace(
            'const APP_NAME = "HK Life Money";',
            'const APP_NAME = "HK Life Money";\n'
            "const spa = import.meta.env.VITE_GITHUB_PAGES === \"1\";",
        )
        old_fn = (
            "function RootDocument() {\n"
            "  return (\n"
            '    <html lang="zh-HK" className="antialiased">'
        )
        new_fn = (
            "function RootDocument() {\n"
            "  if (spa) {\n"
            "    return (\n"
            "      <>\n"
            "        <HeadContent />\n"
            "        <PreviewHostBridge />\n"
            "        <AuthProvider>\n"
            "          <Outlet />\n"
            "        </AuthProvider>\n"
            "      </>\n"
            "    );\n"
            "  }\n"
            "  return (\n"
            '    <html lang="zh-HK" className="antialiased">'
        )
        if old_fn not in root:
            raise SystemExit("could not patch __root.tsx — unexpected file contents")
        root_path.write_text(root.replace(old_fn, new_fn, 1))
        print("[pages] patched src/routes/__root.tsx")
    else:
        print("[pages] __root.tsx already Pages-ready")


def _has_assets(folder: Path) -> bool:
    d = folder / "assets"
    return d.is_dir() and any(d.iterdir())


def assemble() -> None:
    base = os.environ.get("BASE_PATH", "/MoneyTracker/")
    if not base.endswith("/"):
        base += "/"
    pub = Path(".output/public")
    client = Path("dist/client")
    source = client if _has_assets(client) else pub if _has_assets(pub) else None
    if source is None:
        raise SystemExit("No client assets in dist/client or .output/public")
    if source != pub:
        pub.parent.mkdir(parents=True, exist_ok=True)
        if pub.exists():
            shutil.rmtree(pub)
        shutil.copytree(source, pub)
    (pub / ".nojekyll").write_text("")

    names = [p.name for p in (pub / "assets").iterdir()]
    js = [n for n in names if n.startswith("index-") and n.endswith(".js") and n.count(".") == 1]
    if not js:
        js = [n for n in names if n.startswith("index-") and n.endswith(".js") and ".index" not in n]
    if not js:
        raise SystemExit("missing assets/index-*.js")
    entry = js[0]
    css_links = "\n".join(
        f'    <link rel="stylesheet" href="{base}assets/{n}" />' for n in names if n.endswith(".css")
    )
    html = "\n".join(
        [
            "<!DOCTYPE html>",
            '<html lang="zh-HK" class="antialiased">',
            "  <head>",
            '    <meta charset="utf-8" />',
            '    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
            '    <meta name="theme-color" content="#0284c7" />',
            "    <title>HK Life Money</title>",
            f'    <link rel="icon" type="image/svg+xml" href="{base}favicon.svg" />',
            '    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Noto+Sans+TC:wght@400;500;600;700&display=swap" />',
            css_links,
            "  </head>",
            '  <body class="bg-background text-foreground">',
            '    <div id="root"></div>',
            f'    <script type="module" src="{base}assets/{entry}"></script>',
            "  </body>",
            "</html>",
            "",
        ]
    )
    (pub / "index.html").write_text(html)
    (pub / "404.html").write_text(html)
    stray = pub / "index"
    if stray.is_file() and stray.stat().st_size == 0:
        stray.unlink()
    print(f"[pages] assembled {pub} entry={entry} base={base} bytes={len(html)}")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "prepare"
    if cmd == "prepare":
        prepare()
    elif cmd == "assemble":
        assemble()
    else:
        raise SystemExit("usage: gh-pages-ci.py prepare|assemble")


if __name__ == "__main__":
    main()
