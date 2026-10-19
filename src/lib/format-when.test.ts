import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { from12h, plannedIsDue, to12h, whenStamp } from "./format.ts";

describe("planned time", () => {
  it("waits until the chosen minute", () => {
    const now = new Date(2026, 9, 19, 21, 45);
    assert.equal(plannedIsDue("2026-10-19", "21:46", now), false);
    assert.equal(plannedIsDue("2026-10-19", "21:45", now), true);
    assert.equal(plannedIsDue("2026-10-18", undefined, now), true);
  });

  it("formats the afternoon clock", () => {
    assert.equal(whenStamp("2026-10-19", "21:46", "zh-HK"), "19/10/2026 下午9:46");
    assert.deepEqual(to12h("21:46"), { ap: 1, hour: 9, minute: 46 });
    assert.equal(from12h(1, 9, 46), "21:46");
    assert.equal(from12h(0, 12, 0), "00:00");
  });
});
