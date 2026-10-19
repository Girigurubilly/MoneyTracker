import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeProposal, encodeProposal, plannerTripUrl, proposalFromHash } from "./trip-link.ts";

describe("trip link", () => {
  it("opens the planner on this money trip, not the bare home page", () => {
    const url = new URL(plannerTripUrl({ id: "osaka", name: "Osaka", nameZh: "大阪", destination: "大阪", start: "2026-04-02", end: "2026-04-08" }));
    assert.equal(url.origin + url.pathname, "https://girigurubilly.github.io/TripPlanner/");
    assert.equal(url.searchParams.get("money"), "osaka");
    assert.equal(url.searchParams.get("name"), "大阪");
    assert.equal(url.searchParams.get("start"), "2026-04-02");
    assert.equal(url.searchParams.get("end"), "2026-04-08");
  });

  it("round-trips a spend proposal", () => {
    const token = encodeProposal({
      v: 1,
      trip: "大阪",
      tripId: "osaka",
      items: [{ date: "2026-04-03", label: "地鐵", amount: 12.5, currency: "JPY" }],
    });
    const back = proposalFromHash(`#proposal=${token}`);
    assert.equal(back?.tripId, "osaka");
    assert.equal(back?.items[0]?.label, "地鐵");
    assert.equal(back?.items[0]?.amount, 12.5);
    assert.equal(decodeProposal("nope"), null);
  });
});
