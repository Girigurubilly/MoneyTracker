import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  largestWorthMove,
  periodNetWorthPoints,
  periodPostedCashflow,
  worthMoveIsCliff,
} from "./networth.ts";
import type { Account, Transaction } from "../types.ts";

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "type" | "amount" | "date">): Transaction {
  return {
    currency: "HKD",
    accountId: "cash",
    time: "12:00",
    ...partial,
  } as Transaction;
}

const cash: Account = {
  id: "cash",
  name: "Cash",
  nameZh: "現金",
  type: "cash",
  currency: "HKD",
  balance: 100_000,
  includeInNetWorth: true,
  group: "cash",
};

describe("periodNetWorthPoints sources", () => {
  it("tags frozen past months as snapshot and today as live", () => {
    const points = periodNetWorthPoints(
      [cash],
      [tx({ id: "out", type: "expense", amount: 20_000, date: "2026-09-15", accountId: "cash" })],
      [],
      "2026-08-01",
      "2026-10-26",
      [],
      [{ month: "2026-08", net: 500_000, assets: 500_000, liab: 0 }],
    );
    const aug = points.find((p) => p.date.startsWith("2026-08"));
    const last = points.at(-1);
    assert.equal(aug?.source, "snapshot");
    assert.equal(aug?.net, 500_000);
    assert.equal(last?.source, "live");
    assert.ok((last?.net ?? 0) < 500_000);
  });

  it("marks reconstructed when no snapshots", () => {
    const points = periodNetWorthPoints(
      [{ ...cash, balance: 80_000 }],
      [tx({ id: "out", type: "expense", amount: 5_000, date: "2026-09-10", accountId: "cash" })],
      [],
      "2026-08-01",
      "2026-10-26",
      [],
      [],
    );
    const aug = points.find((p) => p.date.startsWith("2026-08"));
    assert.equal(aug?.source, "reconstructed");
    assert.ok((aug?.net ?? 0) > 80_000);
  });
});

describe("periodPostedCashflow", () => {
  it("ignores plain transfers and includes spend-like transfers", () => {
    const rows = periodPostedCashflow(
      [
        tx({ id: "in", type: "income", amount: 10_000, date: "2026-09-01", accountId: "cash" }),
        tx({ id: "out", type: "expense", amount: 3_000, date: "2026-09-02", accountId: "cash" }),
        tx({ id: "move", type: "transfer", amount: 1_000, date: "2026-09-03", accountId: "cash", toAccountId: "save" }),
        tx({
          id: "mort",
          type: "transfer",
          amount: 2_000,
          date: "2026-09-04",
          accountId: "cash",
          toAccountId: "mortgage",
          countsAsExpense: true,
        }),
        tx({ id: "plan", type: "expense", amount: 9_999, date: "2026-09-05", accountId: "cash", planned: true }),
      ],
      [],
      "2026-09-01",
      "2026-09-30",
    );
    assert.equal(rows.income, 10_000);
    assert.equal(rows.expense, 5_000);
    assert.equal(rows.net, 5_000);
  });
});

describe("largestWorthMove", () => {
  it("flags a cliff across a snapshot seam", () => {
    const points = periodNetWorthPoints(
      [cash],
      [],
      [],
      "2026-08-01",
      "2026-10-26",
      [],
      [
        { month: "2026-08", net: 2_000_000, assets: 2_000_000, liab: 0 },
        { month: "2026-09", net: 1_900_000, assets: toAssets(1_900_000), liab: 0 },
      ],
    );
    const move = largestWorthMove(points);
    assert.ok(move);
    assert.ok(worthMoveIsCliff(move, points.at(-1)?.net ?? 0));
  });
});

function toAssets(n: number) {
  return n;
}
