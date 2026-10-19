import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachTripLibrary, laterIso, readTripLibrary, writeTripLibrary, type TripLibrary } from "./trip-library.ts";

function memory() {
  const bag = new Map<string, string>();
  return {
    getItem: (key: string) => (bag.has(key) ? bag.get(key)! : null),
    setItem: (key: string, value: string) => {
      bag.set(key, value);
    },
  };
}

describe("trip library", () => {
  it("keeps the later clock", () => {
    assert.equal(laterIso("2026-04-02T00:00:00.000Z", "2026-04-03T00:00:00.000Z"), "2026-04-03T00:00:00.000Z");
    assert.equal(laterIso("", "2026-04-03T00:00:00.000Z"), "2026-04-03T00:00:00.000Z");
  });

  it("round-trips the itinerary stored beside the money app", () => {
    const storage = memory();
    const library: TripLibrary = {
      schemaVersion: 1,
      kind: "trip-book",
      exportedAt: "2026-04-02T01:00:00.000Z",
      trips: [{ id: "osaka" }],
      notes: { osaka: { d1: "帶現金" } },
      visits: { osaka: { "d1:0": "2026-04-02T02:00:00.000Z" } },
      links: { osaka: "osaka-book" },
    };
    writeTripLibrary(library, storage);
    const back = readTripLibrary(storage);
    assert.equal(back?.trips.length, 1);
    assert.equal((back?.notes.osaka as { d1: string }).d1, "帶現金");
    assert.equal(back?.links?.osaka, "osaka-book");
    assert.equal(back?.exportedAt, "2026-04-02T01:00:00.000Z");
  });

  it("does not drop a remote itinerary when this phone has none", () => {
    const remote = { tripLibrary: { schemaVersion: 1 as const, kind: "trip-book" as const, exportedAt: "", trips: [{ id: "a" }], notes: {} } };
    const kept = attachTripLibrary({}, remote);
    assert.equal(kept.tripLibrary?.trips.length, 1);
    const local = { tripLibrary: { schemaVersion: 1 as const, kind: "trip-book" as const, exportedAt: "", trips: [], notes: {} } };
    assert.equal(attachTripLibrary(local, remote).tripLibrary?.trips.length, 0);
  });
});
