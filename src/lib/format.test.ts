import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatTypingAmount, money } from "./format.ts";

describe("formatTypingAmount", () => {
  it("groups a plain amount and shows the currency", () => {
    assert.equal(formatTypingAmount("72000", "HKD"), "72,000 / HK$");
  });
  it("keeps a leading minus as a sign", () => {
    assert.equal(formatTypingAmount("-72000", "HKD"), "-72,000 / HK$");
  });
  it("groups an expression without appending the currency", () => {
    assert.equal(formatTypingAmount("72000+300", "HKD"), "72,000+300");
  });
  it("keeps a trailing decimal while typing", () => {
    assert.equal(formatTypingAmount("72000.", "HKD"), "72,000. / HK$");
  });
  it("leaves miles without a unit", () => {
    assert.equal(formatTypingAmount("1200", "MILES"), "1,200");
  });
  it("keeps a minus on miles", () => {
    assert.equal(money(-1200, "MILES"), "−1,200");
    assert.equal(money(1200, "MILES", { sign: true }), "+1,200");
  });
});
