import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { latestTxnCreatedAt, pickSyncSide } from "./sync-side.ts";
import { driveBackupName, driveFileInstant, isDriveBackupName, newestDriveBackup, planDriveBackups, type DriveBackupRef } from "./google-drive.ts";

describe("drive sync side", () => {
  it("pulls when the Drive file was created after the last transaction", () => {
    assert.equal(pickSyncSide("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z"), "pull");
  });
  it("pushes when the last transaction is newer than the Drive file", () => {
    assert.equal(pickSyncSide("2026-09-03T00:00:00.000Z", "2026-09-02T00:00:00.000Z"), "push");
  });
  it("pushes when Drive has no file", () => {
    assert.equal(pickSyncSide("2026-09-03T00:00:00.000Z", undefined), "push");
  });
  it("pulls when this device has no transactions", () => {
    assert.equal(pickSyncSide("", "2026-09-02T00:00:00.000Z"), "pull");
  });
  it("uses the newest posted transaction clock and ignores planned rows", () => {
    const iso = latestTxnCreatedAt([
      { date: "2026-09-01", createdAt: "2026-09-01T01:00:00.000Z" },
      { date: "2026-10-01", createdAt: "2026-10-05T02:00:00.000Z", planned: true },
      { date: "2026-08-01" },
    ]);
    assert.equal(iso, "2026-09-01T01:00:00.000Z");
  });
});

function file(id: string, modifiedTime: string, createdTime = modifiedTime): DriveBackupRef {
  return { id, name: `hk-life-money-${id}.backup.json`, modifiedTime, createdTime };
}

describe("three Drive backups", () => {
  it("keeps creating copies until there are three", () => {
    assert.deepEqual(planDriveBackups([file("a", "2026-09-01T00:00:00.000Z"), file("b", "2026-09-02T00:00:00.000Z")]), { trashIds: [] });
  });

  it("leaves three copies in place", () => {
    const plan = planDriveBackups([
      file("new", "2026-09-03T00:00:00.000Z"),
      file("old", "2026-09-01T00:00:00.000Z"),
      file("mid", "2026-09-02T00:00:00.000Z"),
    ]);
    assert.deepEqual(plan.trashIds, []);
  });

  it("drops the oldest creation once a fourth file exists", () => {
    const plan = planDriveBackups([
      file("a", "2026-09-01T00:00:00.000Z"),
      file("b", "2026-09-02T00:00:00.000Z"),
      file("c", "2026-09-03T00:00:00.000Z"),
      file("d", "2026-09-04T00:00:00.000Z"),
    ]);
    assert.deepEqual(plan.trashIds, ["a"]);
    assert.equal(newestDriveBackup([file("a", "2026-09-01T00:00:00.000Z"), file("c", "2026-09-03T00:00:00.000Z")])?.id, "c");
  });

  it("treats an in-place replace as newer than an older creation", () => {
    const overwritten = file("old", "2026-09-05T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
    const created = file("new", "2026-09-04T00:00:00.000Z", "2026-09-04T00:00:00.000Z");
    assert.equal(newestDriveBackup([overwritten, created])?.id, "old");
    assert.equal(driveFileInstant(created), "2026-09-04T00:00:00.000Z");
    assert.equal(driveFileInstant({ id: "n", name: "hk-life-money-20260903-010203.backup.json", createdTime: "", modifiedTime: "" }), "2026-09-03T01:02:03.000Z");
  });

  it("names a timestamped backup and still accepts the old single file", () => {
    assert.equal(driveBackupName(new Date("2026-09-30T05:45:01.000Z")), "hk-life-money-20260930-054501.backup.json");
    assert.equal(isDriveBackupName("hk-life-money.backup.json"), true);
    assert.equal(isDriveBackupName("notes.txt"), false);
  });
});
