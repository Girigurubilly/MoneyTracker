import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeProposal, encodeProposal, linkFromHash, plannerTripUrl, proposalFromHash, tripCovering, carriedTrip } from "./trip-link.ts";
import type { Trip } from "./types.ts";

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
    const day = new URL(plannerTripUrl({ id: "osaka", name: "Osaka", nameZh: "大阪", destination: "大阪", start: "2026-04-02", end: "2026-04-08" }, { day: "2026-04-03" }));
    assert.equal(day.searchParams.get("day"), "2026-04-03");
  });

  it("only links a date that sits inside a trip", () => {
    const row = (id: string, start: string, end: string): Trip => ({
      id, name: id, nameZh: id, destination: id, start, end, status: "booked", cashBudget: 0, cashSaved: 0, milesTarget: 0, milesSaved: 0, monthlyCash: 0,
    });
    const trips = [row("early", "2026-04-01", "2026-04-03"), row("later", "2026-04-02", "2026-04-08")];
    assert.equal(tripCovering(trips, "2026-04-04")?.id, "later");
    assert.equal(tripCovering(trips, "2026-04-09"), undefined);
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
    const blank = encodeProposal({ v: 1, trip: "大阪", tripId: "osaka", items: [{ date: "2026-04-03", label: "咖啡", amount: 0, currency: "HKD" }] });
    assert.equal(proposalFromHash(`#proposal=${blank}`)?.items[0]?.amount, 0);
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

  it("attaches a carried cost to the linked trip, or the one with the same name", () => {
    const row = (id: string, nameZh: string, start: string, end: string, plannerId?: string): Trip => ({
      id, name: nameZh, nameZh, destination: nameZh, start, end, status: "booked", cashBudget: 0, cashSaved: 0, milesTarget: 0, milesSaved: 0, monthlyCash: 0, plannerId,
    });
    const trips = [row("money-osaka", "大阪散步", "2026-04-02", "2026-04-08", "book-osaka"), row("other", "東京", "2026-05-01", "2026-05-05")];
    const items = [{ date: "2026-04-03" }];
    assert.equal(carriedTrip(trips, { trip: "大阪散步", tripId: "", bookId: "book-osaka", items })?.id, "money-osaka");
    assert.equal(carriedTrip(trips, { trip: "大阪散步", tripId: "", items })?.id, "money-osaka");
    assert.equal(carriedTrip(trips, { trip: "", tripId: "", items })?.id, "money-osaka");
  });
});
