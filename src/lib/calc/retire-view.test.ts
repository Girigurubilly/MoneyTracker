import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fireSpendLevels, fireTargets, FIRE_SWR_BASE, type FireSpendRow } from "./fire-plan.ts";
import {
  accessBreakdown,
  allocateTypedSpend,
  annuityClash,
  enoughStory,
  goalsReady,
  mortgageStory,
  pickedFigure,
  pickedTarget,
  suggestMpfFromRecurring,
} from "./retire-view.ts";

function row(kind: FireSpendRow["kind"], monthly: number): FireSpendRow {
  return { id: kind, name: "x", nameZh: "x", inferred: true, kind, monthly };
}

describe("typed spend drives FIRE levels", () => {
  it("scales a small tagged subset onto the typed monthly spend", () => {
    const tagged = fireSpendLevels([row("core", 1000), row("flex", 600), row("work", 8000)]);
    assert.equal(tagged.base, 1600);
    const allocated = allocateTypedSpend(tagged, 25_000);
    assert.equal(allocated.base, 25_000);
    assert.ok(Math.abs(allocated.core - 25_000 * (1000 / 1600)) < 1e-6);
    assert.ok(Math.abs(allocated.flex - 25_000 * (600 / 1600)) < 1e-6);
    assert.equal(allocated.work, 8000);
    const targets = fireTargets(allocated);
    assert.equal(targets.base, (25_000 * 12) / FIRE_SWR_BASE);
    assert.notEqual(targets.base, (1600 * 12) / FIRE_SWR_BASE);
  });

  it("uses the whole typed amount when tags are empty", () => {
    const allocated = allocateTypedSpend(fireSpendLevels([]), 25_000);
    assert.equal(allocated.base, 25_000);
    assert.equal(allocated.flex, 25_000);
    assert.equal(allocated.core, 0);
    assert.equal(fireTargets(allocated).base, (25_000 * 12) / 0.035);
  });

  it("does not let a tagged subset pass when no retirement spend was typed", () => {
    const tagged = fireSpendLevels([row("core", 1000), row("flex", 600)]);
    const allocated = allocateTypedSpend(tagged, 0);
    assert.equal(allocated.base, 0);
    assert.equal(fireTargets(allocated).base, 0);
  });
});

describe("enough story is one ruler", () => {
  it("is short when the path gap is negative, even if a tag target would pass", () => {
    const story = enoughStory({
      ready: true,
      hasPath: true,
      depletes: true,
      plannedMonthly: 25_000,
      surplusMonthly: -18_000,
      planEndAge: 90,
    });
    assert.equal(story.kind, "short");
    assert.equal(story.gap, -18_000);
    assert.equal(story.planned, 25_000);
  });

  it("does not invent a pass without a path or a typed spend", () => {
    assert.equal(
      enoughStory({ ready: false, hasPath: false, depletes: false, plannedMonthly: 0, surplusMonthly: 0, planEndAge: 90 }).kind,
      "setup",
    );
    assert.equal(
      enoughStory({ ready: true, hasPath: false, depletes: false, plannedMonthly: 25_000, surplusMonthly: 0, planEndAge: 90 }).kind,
      "setup",
    );
    assert.equal(goalsReady({ currentAge: 0, targetMonthly: 0 }), false);
    assert.equal(goalsReady({ currentAge: 42, targetMonthly: 25_000 }), true);
    assert.equal(goalsReady({ birthday: "1984-01-01", currentAge: 0, targetMonthly: 25_000 }), true);
  });
});

describe("mortgage label honesty", () => {
  it("never calls a remaining balance paid off", () => {
    const assumed = mortgageStory({ outstanding: 1_000_000, remainingMonths: 240, yearsToRetire: 8, payOffAtRetire: true });
    assert.equal(assumed.paidOffNow, false);
    assert.equal(assumed.kind, "assumed-payoff");
    assert.equal(assumed.gate, "fail");
    assert.equal(assumed.payoffCashInAccountProjection, true);
    assert.equal(assumed.payoffCashInLifePath, false);

    const owing = mortgageStory({ outstanding: 1_000_000, remainingMonths: 240, yearsToRetire: 8, payOffAtRetire: false });
    assert.equal(owing.kind, "owing");
    assert.equal(owing.paidOffNow, false);
    assert.equal(owing.gate, "fail");
  });

  it("can clear before retirement without claiming the balance is already gone", () => {
    const row = mortgageStory({ outstanding: 200_000, remainingMonths: 24, yearsToRetire: 10, payOffAtRetire: false });
    assert.equal(row.kind, "clears-before");
    assert.equal(row.paidOffNow, false);
    assert.equal(row.owingNow, 200_000);
    assert.equal(row.gate, "pass");
  });

  it("is paid only when nothing is owed", () => {
    const row = mortgageStory({ outstanding: 0, remainingMonths: 0, yearsToRetire: 8, payOffAtRetire: true });
    assert.equal(row.kind, "none");
    assert.equal(row.paidOffNow, true);
    assert.equal(row.gate, "pass");
  });
});

describe("income basis and access sum", () => {
  it("labels a typed income as manual and a blank one as ledger", () => {
    assert.deepEqual(pickedFigure(80_000, 10_000), { amount: 80_000, source: "manual" });
    assert.deepEqual(pickedFigure(0, 10_000), { amount: 10_000, source: "ledger" });
    assert.deepEqual(pickedFigure(undefined, 10_000), { amount: 10_000, source: "ledger" });
    assert.equal(pickedTarget(undefined), 0);
    assert.equal(pickedTarget(25_000), 25_000);
  });

  it("access lines sum, and are not a second unnamed corpus", () => {
    assert.deepEqual(accessBreakdown(1_000_000, 400_000), { accessible: 1_000_000, locked: 400_000, total: 1_400_000 });
  });
});

describe("accounts", () => {
  it("suggests an MPF account only when contributions exist and no retirement account does", () => {
    const hit = suggestMpfFromRecurring({
      recurring: [{ categoryId: "mpf-vol", amount: 3000, frequency: "monthly" }],
      categories: [{ id: "mpf-vol", name: "Voluntary MPF", nameZh: "自願性強積金" }],
      hasRetirementAccount: false,
    });
    assert.deepEqual(hit, { monthly: 3000 });
    assert.equal(
      suggestMpfFromRecurring({
        recurring: [{ categoryId: "mpf-vol", amount: 3000, frequency: "monthly" }],
        categories: [{ id: "mpf-vol", name: "Voluntary MPF", nameZh: "自願性強積金" }],
        hasRetirementAccount: true,
      }),
      null,
    );
  });

  it("flags two annuity sources", () => {
    assert.equal(annuityClash([{ id: "ra-inherit-annuity", type: "ANNUITY" }, { id: "a2", type: "ANNUITY" }], []), true);
    assert.equal(annuityClash([{ id: "a2", type: "ANNUITY" }], []), false);
    assert.equal(annuityClash([{ id: "a2", type: "ANNUITY" }], [{ kind: "annuity" }]), true);
  });
});
