import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { colorsOnly, isFontId, isFontSizeId, isThemeId, normalizeHex, onAccentFor, relativeLuminance } from "./theme.ts";

describe("theme helpers", () => {
  it("normalizes 3- and 6-digit hex", () => {
    assert.equal(normalizeHex("#AbC"), "#aabbcc");
    assert.equal(normalizeHex("#00E5FF"), "#00e5ff");
    assert.equal(normalizeHex("red"), undefined);
  });

  it("known theme ids", () => {
    assert.equal(isThemeId("pinky"), true);
    assert.equal(isThemeId("neon"), false);
  });

  it("known font and size ids", () => {
    assert.equal(isFontId("nunito"), true);
    assert.equal(isFontId("comic"), false);
    assert.equal(isFontSizeId("lg"), true);
    assert.equal(isFontSizeId("xxl"), false);
  });

  it("keeps type settings when clearing colours", () => {
    const next = colorsOnly({ background: "#111111", fontId: "noto", fontSize: "lg" });
    assert.equal(next.background, undefined);
    assert.equal(next.fontId, "noto");
    assert.equal(next.fontSize, "lg");
  });

  it("picks dark on-accent for bright highlights", () => {
    assert.ok(relativeLuminance("#00e5ff") > 0.45);
    assert.equal(onAccentFor("#00e5ff"), "#1c1c1e");
    assert.equal(onAccentFor("#db2777"), "#ffffff");
  });
});
