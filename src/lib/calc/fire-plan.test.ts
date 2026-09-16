import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fireSpendLevels,
  fireTargets,
  fireBuckets,
  parentLiability,
  simulateFirePath,
  runFireStress,
  fireGates,
  inferFireSpendKind,
  FIRE_SWR_BASE,
  FIRE_SWR_COMFORT,
  type FireSpendRow,
} from "./fire-plan.ts";
import type { Category } from "../types.ts";

function row(partial: Partial<FireSpendRow> & { kind: FireSpendRow["kind"]; monthly: number }): FireSpendRow {
  return { id: partial.id ?? "x", name: "x", nameZh: "x", inferred: true, ...partial };
}

describe("FIRE spend levels and targets", () => {
  it("splits work vs core vs flex and drops work from retirement spend", () => {
    const levels = fireSpendLevels([
      row({ kind: "work", monthly: 10000 }),
      row({ kind: "core", monthly: 8000 }),
      row({ kind: "flex", monthly: 6000 }),
      row({ kind: "irregular", monthly: 2000 }),
    ]);
    assert.equal(levels.work, 10000);
    assert.equal(levels.core, 8000);
    assert.equal(levels.flex, 6000);
    assert.equal(levels.base, 14000);
    assert.equal(levels.floor, 8000 + 6000 * 0.7);
    assert.equal(levels.comfort, 8000 + 6000 * 1.3);
  });

  it("builds three FIRE numbers with 3.5% / 3.25% SWR", () => {
    const levels = fireSpendLevels([row({ kind: "core", monthly: 10000 }), row({ kind: "flex", monthly: 5000 })]);
    const t = fireTargets(levels);
    assert.equal(t.floor, (levels.floor * 12) / FIRE_SWR_BASE);
    assert.equal(t.base, (15000 * 12) / 0.035);
    assert.equal(t.comfort, (levels.comfort * 12) / FIRE_SWR_COMFORT);
  });

  it("adds parent support into core when included", () => {
    const levels = fireSpendLevels([row({ kind: "core", monthly: 5000 })], 3000, "include");
    assert.equal(levels.core, 8000);
    const reserved = fireSpendLevels([row({ kind: "core", monthly: 5000 })], 3000, "reserve");
    assert.equal(reserved.core, 5000);
  });
});

describe("infer spend kind", () => {
  it("tags mortgage as work and management fee as core", () => {
    const cats: Category[] = [
      { id: "p-housing", name: "Housing", nameZh: "房屋", theme: "living", kind: "expense", icon: "home", essential: true },
      { id: "mortgage-i", name: "Mortgage interest", nameZh: "按揭利息", theme: "living", kind: "expense", icon: "home", parentId: "p-housing" },
      { id: "mgmt", name: "Management fee", nameZh: "管理費", theme: "living", kind: "expense", icon: "building" },
      { id: "dining", name: "Dining", nameZh: "外出就餐", theme: "living", kind: "expense", icon: "utensils" },
    ];
    assert.equal(inferFireSpendKind(cats[1], cats), "work");
    assert.equal(inferFireSpendKind(cats[2], cats), "core");
    assert.equal(inferFireSpendKind(cats[3], cats), "flex");
  });
});

describe("timeline and stress", () => {
  it("grows to retire then withdraws, and reports SWR", () => {
    const r = simulateFirePath({
      currentAge: 42,
      retireAge: 50,
      deathAge: 85,
      investable: 5_000_000,
      monthlySave: 30_000,
      preReturn: 0.05,
      postReturn: 0.03,
      inflation: 0,
      monthlySpend: 15_000,
    });
    assert.ok(r.corpusAtRetire > 2_000_000);
    assert.ok(r.firstYearSwr > 0);
    assert.equal(r.depletes, false);
  });

  it("bear-market shock can deplete a thin plan", () => {
    const thin = {
      currentAge: 49,
      retireAge: 50,
      deathAge: 85,
      investable: 400_000,
      monthlySave: 0,
      preReturn: 0.03,
      postReturn: 0.03,
      inflation: 0,
      monthlySpend: 20_000,
    };
    const base = simulateFirePath(thin);
    const shocked = simulateFirePath({ ...thin, shockAtRetire: -0.3 });
    assert.equal(base.depletes, true);
    assert.equal(shocked.depletes, true);
    assert.ok((shocked.depletionAge ?? 99) <= (base.depletionAge ?? 99));
  });

  it("runs four stress cases", () => {
    const rows = runFireStress({
      currentAge: 42,
      retireAge: 50,
      deathAge: 85,
      investable: 8_000_000,
      monthlySave: 30_000,
      preReturn: 0.05,
      postReturn: 0.03,
      inflation: 0.025,
      monthlySpend: 25_000,
    });
    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.map((r) => r.id),
      ["bear", "lowReturn", "highInflation", "longevity"],
    );
  });
});

describe("buckets, parents, gates", () => {
  it("sets liquidity and stable targets from core / base spend", () => {
    const buckets = fireBuckets({
      accounts: [
        { id: "cash", name: "Cash", nameZh: "現金", type: "cash", currency: "HKD", balance: 240_000, includeInNetWorth: true, group: "cash" },
        { id: "broker", name: "Broker", nameZh: "證券", type: "investment", currency: "HKD", balance: 1_000_000, includeInNetWorth: true, group: "assets" },
      ],
      rates: [],
      deposits: [],
      holdings: [],
      retirementAccounts: [
        {
          id: "ann",
          name: "Annuity",
          type: "ANNUITY",
          currency: "HKD",
          currentBalance: 400_000,
          balanceAsOf: "2026-01-01",
          status: "withdrawal_phase",
          accessibleAge: 65,
          accessRule: "scheduled_income",
          contributionFrequency: "one_off",
          employeeContributionAmount: 0,
          employerContributionAmount: 0,
          voluntaryContributionAmount: 0,
          employeeContributionGrowthRate: 0,
          employerContributionGrowthRate: 0,
          voluntaryContributionGrowthRate: 0,
          expectedAnnualReturnRate: 0,
          withdrawalStrategy: "scheduled_income",
          includeInRetirementProjection: true,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
      coreMonthly: 10_000,
      baseMonthly: 15_000,
      today: "2026-09-01",
    });
    const liq = buckets.find((b) => b.id === "liquidity")!;
    const st = buckets.find((b) => b.id === "stable")!;
    const gr = buckets.find((b) => b.id === "growth")!;
    assert.equal(liq.amount, 240_000);
    assert.equal(liq.target, 10_000 * 30);
    assert.equal(st.amount, 400_000);
    assert.equal(gr.amount, 1_000_000);
  });

  it("parent liability is monthly × 12 × years", () => {
    assert.equal(parentLiability(5000, 10), 600_000);
    assert.equal(parentLiability(0, 10), 0);
  });

  it("gates fail thin liquidity and pass a funded checklist", () => {
    const fail = fireGates({
      mortgage: { id: "m", name: "m", nameZh: "m", accountId: "loan", original: 1, outstanding: 1_000_000, rate: 0, remainingMonths: 240, paymentDay: 1, type: "fixed" },
      currentAge: 42,
      retireAge: 50,
      payOffMortgageAtRetire: false,
      investable: 100_000,
      baseTarget: 5_000_000,
      liquidity: 10_000,
      coreMonthly: 10_000,
      parentMonthly: 0,
      parentYears: undefined,
      parentMode: "include",
      parentLiability: 0,
      concentration: null,
      acceptedFlexCut: false,
      stress: [{ id: "bear", depletes: true, corpusAt80: 0 }],
    });
    assert.equal(fail.find((g) => g.id === "mortgage")?.status, "fail");
    assert.equal(fail.find((g) => g.id === "liquidity")?.status, "fail");
    assert.equal(fail.find((g) => g.id === "parents")?.status, "need");
    assert.equal(fail.find((g) => g.id === "concentration")?.status, "need");
    assert.equal(fail.find((g) => g.id === "flexCut")?.status, "fail");

    const pass = fireGates({
      mortgage: { id: "m", name: "m", nameZh: "m", accountId: "loan", original: 1, outstanding: 0, rate: 0, remainingMonths: 0, paymentDay: 1, type: "fixed" },
      currentAge: 42,
      retireAge: 50,
      payOffMortgageAtRetire: false,
      investable: 6_000_000,
      baseTarget: 5_000_000,
      liquidity: 400_000,
      coreMonthly: 10_000,
      parentMonthly: 0,
      parentYears: 0,
      parentMode: "include",
      parentLiability: 0,
      concentration: 0.02,
      acceptedFlexCut: true,
      stress: [
        { id: "bear", depletes: false, corpusAt80: 1 },
        { id: "lowReturn", depletes: false, corpusAt80: 1 },
        { id: "highInflation", depletes: false, corpusAt80: 1 },
        { id: "longevity", depletes: false, corpusAt80: 1 },
      ],
    });
    assert.ok(pass.every((g) => g.status === "pass"));
  });
});
