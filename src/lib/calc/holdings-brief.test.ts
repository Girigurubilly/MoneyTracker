import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildHoldingsBrief, renderHoldingsBriefMarkdown } from "./holdings-brief.ts";
import type { Holding } from "../types.ts";

function row(p: Partial<Holding>): Holding {
  return {
    id: "h",
    symbol: "2800",
    name: "Tracker",
    market: "hk",
    source: "manual",
    quantity: 10,
    currency: "HKD",
    lastPrice: 20,
    ...p,
  };
}

describe("holdings brief", () => {
  it("weights positions and converts a USD line", () => {
    const brief = buildHoldingsBrief({
      today: "2026-09-29",
      rates: [{ currency: "USD", perHkd: 7.8, asOf: "2026-09-29", source: "test" }],
      accounts: [],
      holdings: [
        row({ id: "a", quantity: 100, lastPrice: 20, avgCost: 10, lastPriceAt: "2026-09-29T01:00:00.000Z" }),
        row({ id: "b", symbol: "VXUS.L", name: "VXUS", market: "us", currency: "USD", quantity: 10, lastPrice: 100, lastPriceAt: "2026-09-28" }),
      ],
    });
    assert.equal(brief.totalHkd, 100 * 20 + 10 * 100 * 7.8);
    assert.equal(brief.rows[0].weight > brief.rows[1].weight, true);
    assert.equal(brief.rows.find((r) => r.symbol === "VXUS.L")?.listing, "lse");
    assert.equal(brief.stalePrice, 1);
    assert.equal(brief.gainHkd, 1000);
    const md = renderHoldingsBriefMarkdown(brief);
    assert.match(md, /VXUS\.L/);
    assert.match(md, /How to use with an LLM/);
  });
});
