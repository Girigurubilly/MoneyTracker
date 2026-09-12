import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decryptSnapshot, encryptSnapshot, isEncryptedBackup } from "./backup.ts";

describe("encrypted backup", () => {
  it("round-trips JSON", async () => {
    const raw = JSON.stringify({ schemaVersion: 1, hello: "世界" });
    const blob = await encryptSnapshot(raw, "test-pass");
    assert.equal(isEncryptedBackup(blob), true);
    assert.equal(isEncryptedBackup(raw), false);
    assert.equal(await decryptSnapshot(blob, "test-pass"), raw);
  });
});
