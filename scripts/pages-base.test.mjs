import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSpaShell,
  ensureAssetBase,
  hrefToPublicFile,
  isGitHubPagesBuild,
  isUsableShell,
  pickClientEntry,
  resolvePublicBase,
  resolveRouterBasepath,
  rewriteMissingHashedAssets,
} from "./pages-base.mjs";

describe("pages base", () => {
  it("detects github_pages preset spellings", () => {
    assert.equal(isGitHubPagesBuild({ NITRO_PRESET: "github_pages" }), true);
    assert.equal(isGitHubPagesBuild({ NITRO_PRESET: "github-pages" }), true);
    assert.equal(isGitHubPagesBuild({ NITRO_PRESET: "vercel" }), false);
    assert.equal(isGitHubPagesBuild({}), false);
  });

  it("normalizes Vite base with a trailing slash", () => {
    assert.equal(resolvePublicBase({}), "/");
    assert.equal(resolvePublicBase({ VITE_BASE_PATH: "/hk-life-money" }), "/hk-life-money/");
    assert.equal(resolvePublicBase({ VITE_BASE_PATH: "/hk-life-money/" }), "/hk-life-money/");
    assert.equal(resolvePublicBase({ BASE_PATH: "app" }), "/app/");
  });

  it("strips the trailing slash for the router basepath", () => {
    assert.equal(resolveRouterBasepath({}), "");
    assert.equal(resolveRouterBasepath({ VITE_BASE_PATH: "/hk-life-money/" }), "/hk-life-money");
  });

  it("rewrites a missing hashed CSS file to the one on disk", () => {
    const html = `<link rel="stylesheet" href="/assets/styles-DyHQx9Hm.css"/>`;
    const out = rewriteMissingHashedAssets(html, ["styles-pxICkJ_x.css", "index-B0BZNlCP.js"]);
    assert.equal(out.includes("/assets/styles-pxICkJ_x.css"), true);
    assert.equal(out.includes("styles-DyHQx9Hm"), false);
  });

  it("leaves hashes that already exist on disk", () => {
    const html = `<script src="/assets/index-B0BZNlCP.js"></script>`;
    assert.equal(rewriteMissingHashedAssets(html, ["index-B0BZNlCP.js"]), html);
  });

  it("prefixes root-absolute assets for a project Pages base", () => {
    const html = `<link href="/assets/app.css"/><link rel="icon" href="/favicon.svg"/>`;
    const out = ensureAssetBase(html, "/hk-life-money/");
    assert.equal(out.includes("/hk-life-money/assets/app.css"), true);
    assert.equal(out.includes("/hk-life-money/favicon.svg"), true);
    assert.equal(ensureAssetBase(out, "/hk-life-money/"), out);
  });

  it("maps hrefs onto the static output directory", () => {
    assert.equal(hrefToPublicFile("/assets/a.js", "/out"), "/out/assets/a.js");
    assert.equal(hrefToPublicFile("/hk-life-money/assets/a.js", "/out", "/hk-life-money/"), "/out/assets/a.js");
    assert.equal(hrefToPublicFile("https://cdn.example/a.js", "/out"), null);
  });

  it("synthesizes a project-site SPA shell from the client entry", () => {
    const { js, css } = pickClientEntry(["styles-pxICkJ_x.css", "index-C26L_S3J.js", "shell-abc.js"]);
    assert.equal(js, "index-C26L_S3J.js");
    assert.equal(css, "styles-pxICkJ_x.css");
    const html = buildSpaShell({ base: "/hk-life-money/", js, css });
    assert.equal(isUsableShell(html), true);
    assert.equal(html.includes("/hk-life-money/assets/index-C26L_S3J.js"), true);
    assert.equal(html.includes("/hk-life-money/assets/styles-pxICkJ_x.css"), true);
    assert.equal(html.includes('src="/assets/'), false);
  });

  it("rejects empty prerender leftovers as a shell", () => {
    assert.equal(isUsableShell(""), false);
    assert.equal(isUsableShell("<html></html>"), false);
  });
});
