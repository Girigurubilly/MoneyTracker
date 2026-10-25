import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Transaction } from "./types.ts";
import { recentNoteLabels } from "./recent-notes.ts";

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "categoryId">): Transaction {
  return {
    type: "expense",
    amount: 1,
    currency: "HKD",
    accountId: "a",
    payee: partial.payee ?? "",
    payeeZh: partial.payeeZh ?? partial.payee ?? "",
    ...partial,
  };
}

describe("recent note labels", () => {
  it("returns the three newest distinct remarks for that category only", () => {
    const labels = recentNoteLabels(
      [
        tx({ id: "1", date: "2026-01-01", categoryId: "food", payee: "茶餐廳" }),
        tx({ id: "2", date: "2026-03-01", categoryId: "food", payee: "超市" }),
        tx({ id: "3", date: "2026-02-01", categoryId: "food", payee: "茶餐廳" }),
        tx({ id: "4", date: "2026-04-01", categoryId: "food", payee: "費用" }),
        tx({ id: "5", date: "2026-05-01", categoryId: "other", payee: "其他" }),
        tx({ id: "6", date: "2026-03-02", categoryId: "food", payee: "街市", createdAt: "2026-03-02T01:00:00" }),
        tx({ id: "7", date: "2026-03-02", categoryId: "food", payee: "市場", createdAt: "2026-03-02T02:00:00" }),
      ],
      "food",
    );
    assert.deepEqual(labels, ["市場", "街市", "超市"]);
  });
});
