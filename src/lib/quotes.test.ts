import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferredQuoteCurrency, parseLseInstrument, parseQuoteUnit, quoteToCurrency, unwrapProxiedBody } from "./quotes.ts";
import type { FxRate } from "./types.ts";

const rates: FxRate[] = [{ currency: "GBP", perHkd: 10, asOf: "2026-09-22", source: "test" }, { currency: "USD", perHkd: 7.8, asOf: "2026-09-22", source: "test" }];

describe("holding quotes", () => {
  it("treats Yahoo GBp as pence", () => {
    assert.deepEqual(parseQuoteUnit("GBp"), { currency: "GBP", pence: true });
    assert.deepEqual(parseQuoteUnit("GBP"), { currency: "GBP", pence: false });
  });

  it("converts an LSE GBP quote into a USD holding price", () => {
    assert.equal(inferredQuoteCurrency("us", "VXUS.L"), "GBP");
    const usd = quoteToCurrency({ price: 3.76, currency: "GBP" }, "USD", rates, "GBP");
    assert.equal(Math.round(usd.price * 100) / 100, 4.82);
    const pence = quoteToCurrency({ price: 376, currency: "GBP", pence: true }, "GBP", rates, "GBP");
    assert.equal(pence.price, 3.76);
  });

  it("unwraps allorigins and parses an LSE instrument payload", () => {
    const inner = JSON.stringify({ name: "VG FTSE AW EXUS USD ACC", currency: "GBP", lastprice: 3.76, lastclose: 3.74 });
    const wrapped = JSON.stringify({ contents: inner, status: { http_code: 200 } });
    assert.equal(unwrapProxiedBody(wrapped), inner);
    const hit = parseLseInstrument(wrapped);
    assert.equal(hit?.price, 3.76);
    assert.equal(hit?.currency, "GBP");
    assert.equal(hit?.prevClose, 3.74);
  });
});
