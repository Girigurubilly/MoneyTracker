import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeProposal, encodeProposal, linkFromHash, plannerTripUrl, proposalFromHash } from "./trip-link.ts";

describe("trip link", () => {
  it("opens the planner on this money trip, not the bare home page", () => {
    const url = new URL(plannerTripUrl({ id: "osaka", name: "Osaka", nameZh: "大阪", destination: "大阪", start: "2026-04-02", end: "2026-04-08" }));
    assert.equal(url.origin + url.pathname, "https://girigurubilly.github.io/TripPlanner/");
    assert.equal(url.searchParams.get("money"), "osaka");
    assert.equal(url.searchParams.get("name"), "大阪");
    assert.equal(url.searchParams.get("start"), "2026-04-02");
    assert.equal(url.searchParams.get("end"), "2026-04-08");
    const picked = new URL(plannerTripUrl({ id: "osaka", name: "Osaka", nameZh: "大阪", destination: "大阪", start: "2026-04-02", end: "2026-04-08", plannerId: "osaka-book" }, { pick: true }));
    assert.equal(picked.searchParams.get("book"), "osaka-book");
    assert.equal(picked.searchParams.get("pick"), "1");
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

  it("reads a planner link written back from the trip book", () => {
    const token = encodeProposal({ v: 1, trip: "ignored", tripId: "x", items: [{ date: "2026-04-02", label: "a", amount: 1, currency: "HKD" }] });
    assert.equal(proposalFromHash(`#proposal=${token}`)?.tripId, "x");
    const link = linkFromHash(`#link=${token.replace(/^/, "")}`);
    assert.equal(link, null);
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, tripId: "osaka", bookId: "osaka-book", title: "大阪散步" }));
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const back = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    assert.equal(linkFromHash(`#link=${back}`)?.bookId, "osaka-book");
    assert.equal(linkFromHash(`#link=${back}`)?.title, "大阪散步");
  });
});
