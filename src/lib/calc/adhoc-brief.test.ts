import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdhocBudget, Category } from "../types.ts";
import { renderAdhocBriefMarkdown } from "./adhoc-brief.ts";

const food: Category = { id: "food", name: "Food", nameZh: "飲食", theme: "living", kind: "expense", icon: "utensils" };
const lunch: Category = { id: "lunch", name: "Lunch", nameZh: "午餐", theme: "living", kind: "expense", icon: "utensils", parentId: "food" };

function row(partial: Partial<AdhocBudget> & Pick<AdhocBudget, "id" | "amount" | "date">): AdhocBudget {
  return {
    label: partial.id,
    labelZh: partial.id,
    currency: "HKD",
    month: partial.date.slice(0, 7),
    ...partial,
  };
}

describe("adhoc brief", () => {
  it("totals unpaid plans in HKD and keeps a paid row out of that total", () => {
    const md = renderAdhocBriefMarkdown({
      asOf: "2026-10-25",
      locale: "zh-HK",
      categories: [food, lunch],
      rates: [{ currency: "USD", perHkd: 7.8, asOf: "2026-10-25", source: "test" }],
      trips: [{ id: "osaka", name: "Osaka", nameZh: "大阪" }],
      rows: [
        row({ id: "paid", label: "Dinner", labelZh: "晚餐", amount: 100, date: "2026-10-01", paidOn: "2026-10-01", categoryId: "lunch" }),
        row({ id: "later", label: "Ticket", labelZh: "機票", amount: 50, currency: "USD", date: "2026-11-02", tripId: "osaka" }),
      ],
    });
    assert.match(md, /Unpaid, not yet posted: 390/);
    assert.match(md, /Already paid: 100/);
    assert.match(md, /Unpaid in 2026-10: 0/);
    assert.match(md, /Unpaid in later months: 390/);
    assert.match(md, /\| 晚餐 \| 飲食 · 午餐 \| 100 \| HKD \| 100 \| paid 2026-10-01 \|/);
    assert.match(md, /\| 機票 \|  \| 50 \| USD \| 390 \| later \| 大阪 \|/);
    assert.match(md, /does not change an account balance/);
  });
});
