import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Category, Transaction } from "./types.ts";
import { recentLeafCategories, recentNoteLabels } from "./recent-notes.ts";

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

function cat(partial: Pick<Category, "id" | "kind"> & Partial<Category>): Category {
  return {
    name: partial.id,
    nameZh: partial.id,
    theme: "living",
    icon: "wallet",
    ...partial,
  };
}

describe("recent leaf categories", () => {
  it("keeps the newest posted leaves and skips parents and plans", () => {
    const categories = [
      cat({ id: "food", kind: "expense" }),
      cat({ id: "lunch", kind: "expense", parentId: "food", nameZh: "午餐" }),
      cat({ id: "groceries", kind: "expense", parentId: "food" }),
      cat({ id: "salary", kind: "income" }),
    ];
    const rows: Transaction[] = [
      tx({ id: "old", date: "2026-01-01", categoryId: "groceries" }),
      tx({ id: "plan", date: "2026-08-01", categoryId: "lunch", planned: true }),
      tx({ id: "parent", date: "2026-08-02", categoryId: "food" }),
      tx({ id: "new", date: "2026-08-03", categoryId: "lunch" }),
      tx({ id: "pay", date: "2026-08-04", type: "income", categoryId: "salary" }),
    ];
    const leaves = recentLeafCategories(rows, categories, "expense");
    assert.deepEqual(
      leaves.map((c) => c.id),
      ["lunch", "groceries"],
    );
  });
});
