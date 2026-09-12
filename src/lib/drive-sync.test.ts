import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickSyncSide } from "./sync-side.ts";

describe("drive sync side", () => {
  it("pulls when Drive is newer", () => {
    assert.equal(pickSyncSide("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z"), "pull");
  });
  it("pushes when this device is newer", () => {
    assert.equal(pickSyncSide("2026-09-03T00:00:00.000Z", "2026-09-02T00:00:00.000Z"), "push");
  });
  it("pushes when Drive has no file", () => {
    assert.equal(pickSyncSide("2026-09-03T00:00:00.000Z", undefined), "push");
  });
  it("pulls when this device has never edited", () => {
    assert.equal(pickSyncSide("", "2026-09-02T00:00:00.000Z"), "pull");
  });
});
