import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDepositBrief, renderDepositBriefMarkdown } from "./deposit-brief.ts";
import type { TimeSaving } from "../types.ts";

const rates = [{ currency: "USD" as const, perHkd: 7.8, asOf: "2026-10-06", source: "test" as const }];

function dep(partial: Partial<TimeSaving> & Pick<TimeSaving, "id" | "endDate">): TimeSaving {
  return {
    bank: "HSBC",
    startDate: "2026-01-01",
    rate: 4,
    currency: "HKD",
    amount: 100000,
    interest: 2000,
    accountId: "cash",
    ...partial,
  };
}

describe("deposit brief", () => {
  it("splits active and matured deposits and weights the ladder in HKD", () => {
    const brief = buildDepositBrief({
      today: "2026-10-06",
      rates,
      accounts: [{ id: "cash", name: "HSBC HKD", nameZh: "滙豐", type: "cash", currency: "HKD", balance: 0, includeInNetWorth: true, group: "cash" }],
      deposits: [
        dep({ id: "later", endDate: "2027-01-15", amount: 100000, interest: 2000, rate: 4 }),
        dep({ id: "soon", endDate: "2026-12-01", currency: "USD", amount: 1000, interest: 10, rate: 5, accountId: "usd" }),
        dep({ id: "done", endDate: "2026-06-01", amount: 50000, interest: 500, rate: 3 }),
      ],
    });
    assert.equal(brief.activeCount, 2);
    assert.equal(brief.maturedCount, 1);
    assert.equal(brief.activePrincipalHkd, 100000 + 7800);
    assert.equal(brief.interestToEarnHkd, 2000 + 78);
    assert.equal(brief.realizedInterestHkd, 500);
    assert.equal(brief.unrealizedThisYearHkd, 78);
    assert.equal(brief.unrealizedAfterYearHkd, 2000);
    assert.equal(brief.nextMaturity, "2026-12-01");
    const laterRate = (2000 / 100000) * (365 / 379) * 100;
    const soonRate = (10 / 1000) * (365 / 334) * 100;
    assert.ok(Math.abs((brief.weightedRate ?? 0) - (laterRate * 100000 + soonRate * 7800) / 107800) < 0.0001);
    assert.equal(brief.rateBasisCount, 2);
    assert.equal(brief.rows.find((r) => r.end === "2027-01-15")?.account, "HSBC HKD");
    const md = renderDepositBriefMarkdown(brief);
    assert.match(md, /2027,1,100000,2000,102000/);
    assert.match(md, /2026-12,1,7800,78/);
    assert.match(md, /How to use with an LLM/);
  });

  it("does not treat a blank rate as 0%", () => {
    const brief = buildDepositBrief({
      today: "2026-10-06",
      rates,
      accounts: [],
      deposits: [
        dep({ id: "known", startDate: "2026-01-01", endDate: "2027-01-01", amount: 100000, interest: 3000, rate: 0 }),
        dep({ id: "blank", startDate: "2026-01-01", endDate: "2027-01-01", amount: 900000, interest: 0, rate: 0 }),
      ],
    });
    assert.equal(brief.rateBasisCount, 1);
    assert.ok(Math.abs((brief.weightedRate ?? 0) - 3) < 0.0001);
  });
});
