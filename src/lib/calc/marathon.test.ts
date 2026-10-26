import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inclusiveDays, marathonInterest, marathonMonthlyInterest, marathonTiersOverlap, scbMarathonTiers } from "./marathon.ts";

describe("SCB marathon tiers", () => {
  it("starts from the published HKD and USD bands", () => {
    const hkd = scbMarathonTiers("HKD");
    const usd = scbMarathonTiers("USD");
    assert.deepEqual(hkd.map((t) => t.rate), [2.8, 3, 3.2]);
    assert.deepEqual(usd.map((t) => t.rate), [3.3, 3.5, 3.6]);
    assert.deepEqual(hkd.map((t) => [t.from, t.to]), [
      ["2026-10-02", "2026-11-30"],
      ["2026-12-01", "2027-01-03"],
      ["2027-01-04", "2027-02-01"],
    ]);
  });

  it("counts both ends of a tier, so the next tier starts the following day", () => {
    assert.equal(inclusiveDays("2026-10-02", "2026-11-30"), 60);
    assert.equal(inclusiveDays("2026-12-01", "2027-01-03"), 34);
    assert.equal(inclusiveDays("2027-01-04", "2027-02-01"), 29);
    const tiers = scbMarathonTiers("HKD");
    assert.equal(marathonTiersOverlap(tiers), false);
  });

  it("uses the edited date range, not the original promo dates", () => {
    const tiers = scbMarathonTiers("HKD");
    tiers[0] = { ...tiers[0], to: "2026-10-31" };
    const est = marathonInterest(100_000, tiers);
    const first = est.rows[0];
    assert.equal(first.days, 30);
    assert.equal(first.interest, Math.round(100_000 * 0.028 * (30 / 365) * 100) / 100);
    assert.equal(est.total, Math.round(est.rows.reduce((s, r) => s + r.interest, 0) * 100) / 100);
  });

  it("flags overlapping tiers", () => {
    const tiers = scbMarathonTiers("HKD");
    tiers[1] = { ...tiers[1], from: "2026-11-30" };
    assert.equal(marathonTiersOverlap(tiers), true);
    assert.equal(marathonInterest(1, tiers).overlap, true);
  });

  it("pays each month on the 1st, and folds a final 1st into the previous payout", () => {
    const months = marathonMonthlyInterest(100_000, scbMarathonTiers("HKD"));
    assert.deepEqual(
      months.map((m) => [m.month, m.date, m.days]),
      [
        ["2026-10", "2026-11-01", 30],
        ["2026-11", "2026-12-01", 30],
        ["2026-12", "2027-01-01", 31],
        ["2027-01", "2027-02-02", 32],
      ],
    );
    const oct = Math.round(100_000 * 0.028 * (30 / 365) * 100) / 100;
    assert.equal(months[0]?.interest, oct);
    const jan =
      Math.round(
        (Math.round(100_000 * 0.03 * (3 / 365) * 100) / 100 +
          Math.round(100_000 * 0.032 * (28 / 365) * 100) / 100 +
          Math.round(100_000 * 0.032 * (1 / 365) * 100) / 100) *
          100,
      ) / 100;
    assert.equal(months[3]?.interest, jan);
    assert.equal(months.reduce((s, m) => s + m.days, 0), 123);
  });
});
