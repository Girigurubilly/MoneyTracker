import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeEstimate, estimateFromHash, estimateInHkd, spendCategoryMemoryKey, travelFallbackCategory, decodeProposal, encodeProposal, linkFromHash, plannerTripUrl, proposalFromHash, tripCovering, carriedTrip, categoryFromSpendHint, proposalAction, cleanItemKey, loggedPlannerKeys, isTripHash } from "./trip-link.ts";
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

describe("proposal category and time", () => {
  it("keeps planner category hint and clock time", () => {
    const token = encodeProposal({
      v: 1,
      trip: "大阪",
      tripId: "money-1",
      bookId: "book-1",
      items: [{ date: "2026-04-02", label: "晚餐", amount: 1200, currency: "JPY", category: "meal", time: "19:00" }],
    });
    const decoded = decodeProposal(token);
    assert.equal(decoded?.items[0]?.category, "meal");
    assert.equal(decoded?.items[0]?.time, "19:00");
    const cats = [
      { id: "dining", kind: "expense" as const, name: "Dining", nameZh: "飲食", theme: "living" as const },
      { id: "mtr", kind: "expense" as const, name: "MTR", nameZh: "鐵路", theme: "living" as const },
      { id: "trv", kind: "expense" as const, name: "Travel", nameZh: "旅遊", theme: "travel" as const },
      { id: "trv-food", kind: "expense" as const, name: "Meals", nameZh: "旅途用餐", theme: "other" as const, parentId: "trv" },
      { id: "trv-stay", kind: "expense" as const, name: "Hotels", nameZh: "酒店", theme: "other" as const, parentId: "trv" },
      { id: "trv-go", kind: "expense" as const, name: "Local transport", nameZh: "當地交通", theme: "other" as const, parentId: "trv" },
    ];
    // Only travel-themed categories are picked on their own; never living ones like MTR / Dining.
    assert.equal(categoryFromSpendHint("meal", cats, "trv"), "trv-food");
    assert.equal(categoryFromSpendHint("ride", cats, "trv"), "trv-go");
    assert.equal(categoryFromSpendHint("hotel", cats, "trv"), "trv-stay");
    assert.equal(categoryFromSpendHint("sight", cats, "trv"), "trv");
    assert.equal(categoryFromSpendHint("ride", cats.filter((c) => c.id !== "trv-go"), "trv"), "trv");
    // The user's last pick for that kind wins, even outside travel.
    assert.equal(categoryFromSpendHint("ride", cats, "trv", { remembered: "mtr" }), "mtr");
    assert.equal(categoryFromSpendHint("ride", cats, "trv", { remembered: "gone" }), "trv-go");
    // No hint: guess the kind from the label.
    assert.equal(categoryFromSpendHint("other", cats, "trv", { label: "機場巴士" }), "trv-go");
    assert.equal(spendCategoryMemoryKey("k", "ride"), "k:ride");
    assert.equal(spendCategoryMemoryKey("k", "", "難波酒店"), "k:hotel");
    assert.equal(spendCategoryMemoryKey("k", "", "x"), "k:other");
    assert.equal(travelFallbackCategory(cats as never), "trv");
    assert.equal(travelFallbackCategory(cats as never, "mtr"), "trv");
    assert.equal(travelFallbackCategory(cats as never, "trv-food"), "trv-food");
  });
});

describe("proposal posting and duplicates", () => {
  it("charges today or earlier, schedules later dates", () => {
    assert.equal(proposalAction("2026-10-30", "2026-11-01"), "post");
    assert.equal(proposalAction("2026-11-01", "2026-11-01"), "post");
    assert.equal(proposalAction("2026-11-02", "2026-11-01"), "schedule");
    assert.equal(proposalAction("2025-12-31", "2026-11-01"), "post");
  });

  it("keeps a stable planner item key through the hash", () => {
    const token = encodeProposal({
      v: 1,
      trip: "大阪",
      tripId: "m1",
      bookId: "b1",
      items: [
        { date: "2026-04-02", label: "晚餐", amount: 1200, currency: "JPY", key: "b1:d1:meal:dec18-meal-1" },
        { date: "2026-04-02", label: "壞", amount: 1, currency: "JPY", key: "has space" },
      ],
    });
    const back = decodeProposal(token);
    assert.equal(back?.items[0]?.key, "b1:d1:meal:dec18-meal-1");
    assert.equal(back?.items[1]?.key, undefined);
    assert.equal(cleanItemKey(""), "");
  });

  it("lists logged planner keys once", () => {
    assert.deepEqual(loggedPlannerKeys([{ plannerKey: "b:d:x" }, {}, { plannerKey: "b:d:x" }, { plannerKey: "a:d:y" }]), ["a:d:y", "b:d:x"]);
  });

  it("recognises trip hashes for the onboarding stash", () => {
    assert.equal(isTripHash("#proposal=abc"), true);
    assert.equal(isTripHash("#link=abc"), true);
    assert.equal(isTripHash("#access_token=1"), false);
    assert.equal(isTripHash(""), false);
  });

  it("flags rows whose currency the planner was unsure of", () => {
    const token = encodeProposal({
      v: 1,
      trip: "x",
      tripId: "t",
      items: [
        { date: "2026-04-02", label: "a", amount: 1, currency: "JPY", currencyGuess: true },
        { date: "2026-04-02", label: "b", amount: 1, currency: "VND" },
        { date: "2026-04-02", label: "c", amount: 1, currency: "KRW" },
      ],
    });
    const items = decodeProposal(token)?.items || [];
    assert.deepEqual(items.map((item) => Boolean(item.currencyGuess)), [true, true, false]);
  });
});

describe("trip estimate", () => {
  it("decodes the planner estimate and sums it in HKD", () => {
    const body = {
      v: 1,
      trip: "大阪",
      tripId: "t1",
      bookId: "b1",
      start: "2026-04-02",
      end: "2026-04-08",
      count: 3,
      guess: 1,
      lines: [
        { category: "hotel", currency: "JPY", amount: 10000 },
        { category: "meal", currency: "JPY", amount: 2000 },
        { category: "ride", currency: "HKD", amount: 50 },
        { category: "sight", currency: "VND", amount: 9 },
        { category: "meal", currency: "JPY", amount: -1 },
      ],
    };
    const token = encodeProposal(body as never);
    const decoded = decodeEstimate(token);
    assert.equal(decoded?.lines.length, 4);
    assert.equal(estimateFromHash(`#estimate=${token}`)?.tripId, "t1");
    assert.equal(estimateFromHash("#proposal=abc"), null);
    assert.equal(isTripHash(`#estimate=${token}`), true);
    const sum = estimateInHkd(decoded!, (amount, currency) => (currency === "JPY" ? amount * 0.05 : amount));
    assert.equal(sum.total, 650);
    assert.equal(sum.byCategory.hotel, 500);
    assert.deepEqual(sum.unknown, ["VND"]);
  });
});
