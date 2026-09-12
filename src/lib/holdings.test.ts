import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectMarket, mergeHoldings, normalizeSymbol, parseHoldingsFile, yahooSymbol } from "./holdings.ts";

const IBKR = `Statement,Header,Field Name,Field Value
Open Positions,Header,DataDiscriminator,Asset Category,Currency,Symbol,Quantity,Mark Price,Position Value
Open Positions,Data,Summary,Stocks,USD,AAPL,50,227.12,11356
Open Positions,Data,Summary,Stocks,HKD,700,200,380.4,76080
Open Positions,Data,Total,,USD,,,,,,
`;

const AASTOCKS = `代號,名稱,現價,升跌,持倉數量,市值
00700,騰訊控股,380.40,+1.2,200,76080
AAPL,蘋果,227.12,-0.3,10,2271.2
`;

describe("holdings import", () => {
  it("parses IBKR open positions", () => {
    const { source, rows } = parseHoldingsFile(IBKR);
    assert.equal(source, "ibkr");
    assert.equal(rows.length, 2);
    const us = rows.find((r) => r.symbol === "AAPL");
    const hk = rows.find((r) => r.market === "hk");
    assert.equal(us?.quantity, 50);
    assert.equal(us?.lastPrice, 227.12);
    assert.equal(hk?.symbol, "0700");
    assert.equal(hk?.quantity, 200);
  });

  it("parses AASTOCKS portfolio csv", () => {
    const { source, rows } = parseHoldingsFile(AASTOCKS);
    assert.equal(source, "aastocks");
    assert.equal(rows.find((r) => r.market === "hk")?.symbol, "0700");
    assert.equal(rows.find((r) => r.symbol === "AAPL")?.quantity, 10);
  });

  it("maps yahoo symbols", () => {
    assert.equal(yahooSymbol("hk", "700"), "0700.HK");
    assert.equal(yahooSymbol("us", "aapl"), "AAPL");
    assert.equal(yahooSymbol("us", "CSPX"), "CSPX.L");
    assert.equal(normalizeSymbol("hk", "00700.HK"), "0700");
    assert.equal(detectMarket("00700"), "hk");
    assert.equal(detectMarket("AAPL"), "us");
  });

  it("merges on symbol", () => {
    const { rows } = parseHoldingsFile(IBKR);
    const first = mergeHoldings([], rows, "acc-1");
    const again = mergeHoldings(first, [{ ...rows[0]!, quantity: 80 }], "acc-1");
    assert.equal(again.filter((h) => h.symbol === "AAPL").length, 1);
    assert.equal(again.find((h) => h.symbol === "AAPL")?.quantity, 80);
    assert.equal(again.find((h) => h.symbol === "AAPL")?.id, first.find((h) => h.symbol === "AAPL")?.id);
  });
});
