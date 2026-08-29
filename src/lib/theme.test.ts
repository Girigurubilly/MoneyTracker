import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isThemeId, normalizeHex, onAccentFor, relativeLuminance } from "./theme.ts";

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

  it("picks dark on-accent for bright highlights", () => {
    assert.ok(relativeLuminance("#00e5ff") > 0.45);
    assert.equal(onAccentFor("#00e5ff"), "#1c1c1e");
    assert.equal(onAccentFor("#db2777"), "#ffffff");
  });
});
