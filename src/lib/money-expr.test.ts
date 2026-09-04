import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPadKey, commitAmountExpr, parseMoneyExpr, resolveAmountInput } from "./money-expr.ts";

describe("parseMoneyExpr", () => {
  it("parses signed numbers", () => {
    assert.equal(parseMoneyExpr("+120"), 120);
    assert.equal(parseMoneyExpr("-80.5"), -80.5);
    assert.equal(parseMoneyExpr("1,200"), 1200);
  });
  it("evaluates + - * / and parentheses", () => {
    assert.equal(parseMoneyExpr("100+50"), 150);
    assert.equal(parseMoneyExpr("200-30"), 170);
    assert.equal(parseMoneyExpr("50*2"), 100);
    assert.equal(parseMoneyExpr("100/4"), 25);
    assert.equal(parseMoneyExpr("(20+5)*2"), 50);
    assert.equal(parseMoneyExpr("10+5*2"), 20);
  });
  it("rejects incomplete or invalid", () => {
    assert.equal(parseMoneyExpr("100+"), null);
    assert.equal(parseMoneyExpr("abc"), null);
    assert.equal(parseMoneyExpr(""), null);
  });
  it("resolveAmountInput uses absolute value", () => {
    assert.equal(resolveAmountInput("-40+10"), 30);
    assert.equal(commitAmountExpr("80+20.5"), "100.5");
  });
  it("applyPadKey builds and evaluates", () => {
    assert.equal(applyPadKey("12", "+"), "12+");
    assert.equal(applyPadKey("12+", "×"), "12*");
    assert.equal(applyPadKey("12*4", "="), "48");
    assert.equal(applyPadKey("12", "back"), "1");
    assert.equal(applyPadKey("8", "±"), "-8");
  });
});
