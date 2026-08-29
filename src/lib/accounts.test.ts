import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { accountsInBalanceOrder, moneyAccountsForPicker } from "./accounts.ts";
import type { Account } from "./types.ts";

function acc(partial: Partial<Account> & Pick<Account, "id" | "group" | "type">): Account {
  return {
    name: partial.id,
    nameZh: partial.id,
    currency: partial.currency ?? "HKD",
    balance: 0,
    includeInNetWorth: true,
    ...partial,
  };
}

describe("accountsInBalanceOrder", () => {
  it("follows 餘額 group order then sortOrder", () => {
    const rows: Account[] = [
      acc({ id: "miles", group: "loyalty", type: "miles", currency: "MILES", sortOrder: 0 }),
      acc({ id: "mortgage", group: "housing", type: "mortgage", sortOrder: 1 }),
      acc({ id: "mpf", group: "assets", type: "mpf", sortOrder: 0 }),
      acc({ id: "visa", group: "credit", type: "credit", sortOrder: 0 }),
      acc({ id: "save", group: "cash", type: "savings", sortOrder: 1 }),
      acc({ id: "cash", group: "cash", type: "cash", sortOrder: 0 }),
      acc({ id: "flat", group: "housing", type: "property", sortOrder: 0 }),
      acc({ id: "broker", group: "assets", type: "investment", sortOrder: 1 }),
    ];
    assert.deepEqual(
      accountsInBalanceOrder(rows).map((a) => a.id),
      ["cash", "save", "visa", "mpf", "broker", "flat", "mortgage", "miles"],
    );
  });

  it("picker skips miles and hidden unless selected", () => {
    const rows: Account[] = [
      acc({ id: "cash", group: "cash", type: "cash", sortOrder: 0 }),
      acc({ id: "old", group: "cash", type: "savings", sortOrder: 1, hidden: true }),
      acc({ id: "miles", group: "loyalty", type: "miles", currency: "MILES", sortOrder: 0 }),
    ];
    assert.deepEqual(
      moneyAccountsForPicker(rows).map((a) => a.id),
      ["cash"],
    );
    assert.deepEqual(
      moneyAccountsForPicker(rows, { includeId: "old" }).map((a) => a.id),
      ["cash", "old"],
    );
  });
});
