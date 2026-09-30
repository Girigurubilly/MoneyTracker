import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickSyncSide } from "./sync-side.ts";
import { driveBackupName, isDriveBackupName, newestDriveBackup, planDriveBackups, type DriveBackupRef } from "./google-drive.ts";

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

function file(id: string, modifiedTime: string): DriveBackupRef {
  return { id, name: `hk-life-money-${id}.backup.json`, modifiedTime };
}

describe("three Drive backups", () => {
  it("creates a new copy until there are three", () => {
    assert.deepEqual(planDriveBackups([file("a", "2026-09-01T00:00:00.000Z"), file("b", "2026-09-02T00:00:00.000Z")]), { trashIds: [] });
  });

  it("overwrites the earliest of three", () => {
    const plan = planDriveBackups([
      file("new", "2026-09-03T00:00:00.000Z"),
      file("old", "2026-09-01T00:00:00.000Z"),
      file("mid", "2026-09-02T00:00:00.000Z"),
    ]);
    assert.equal(plan.replaceId, "old");
    assert.deepEqual(plan.trashIds, []);
  });

  it("drops extras so only three remain", () => {
    const plan = planDriveBackups([
      file("a", "2026-09-01T00:00:00.000Z"),
      file("b", "2026-09-02T00:00:00.000Z"),
      file("c", "2026-09-03T00:00:00.000Z"),
      file("d", "2026-09-04T00:00:00.000Z"),
    ]);
    assert.equal(plan.replaceId, "a");
    assert.deepEqual(plan.trashIds, ["b"]);
    assert.equal(newestDriveBackup([file("a", "2026-09-01T00:00:00.000Z"), file("c", "2026-09-03T00:00:00.000Z")])?.id, "c");
  });

  it("names a timestamped backup and still accepts the old single file", () => {
    assert.equal(driveBackupName(new Date("2026-09-30T05:45:01.000Z")), "hk-life-money-20260930-054501.backup.json");
    assert.equal(isDriveBackupName("hk-life-money.backup.json"), true);
    assert.equal(isDriveBackupName("notes.txt"), false);
  });
});
