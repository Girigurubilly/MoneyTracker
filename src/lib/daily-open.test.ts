import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fxDue, quotesDue, runDailyOpen } from "./daily-open.ts";

describe("daily open", () => {
  it("is due until that local day is marked", () => {
    assert.equal(fxDue(null, "2026-10-03"), true);
    assert.equal(fxDue("2026-10-02", "2026-10-03"), true);
    assert.equal(fxDue("2026-10-03", "2026-10-03"), false);
    assert.equal(quotesDue(null, 0, "2026-10-03"), false);
    assert.equal(quotesDue(null, 2, "2026-10-03"), true);
    assert.equal(quotesDue("2026-10-03", 2, "2026-10-03"), false);
  });

  it("updates rates before Drive, and refreshes again after a pull", async () => {
    const order: string[] = [];
    const first = await runDailyOpen({
      today: "2026-10-03",
      holdingCount: 1,
      refreshFx: async () => {
        order.push("fx");
      },
      refreshQuotes: async () => {
        order.push("quotes");
        return 1;
      },
      drive: async () => {
        order.push("drive");
        return "pulled";
      },
      resync: async () => {
        order.push("resync");
        return "pushed";
      },
    });
    const driveAt = order.indexOf("drive");
    assert.ok(driveAt > 0);
    assert.ok(order.slice(0, driveAt).includes("fx"));
    assert.ok(order.slice(0, driveAt).includes("quotes"));
    assert.equal(order.at(-1), "resync");
    assert.equal(first.drive, "pulled");
    order.length = 0;
    const second = await runDailyOpen({
      today: "2026-10-03",
      holdingCount: 1,
      refreshFx: async () => {
        order.push("fx");
      },
      refreshQuotes: async () => {
        order.push("quotes");
        return 1;
      },
      drive: async () => {
        order.push("drive");
        return "ok";
      },
    });
    assert.deepEqual(order, ["drive"]);
    assert.equal(second.fx, false);
    assert.equal(second.quotes, false);
  });
});
