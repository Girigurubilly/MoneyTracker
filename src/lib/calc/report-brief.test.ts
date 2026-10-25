import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Category, Transaction, YearlyPlan } from "../types.ts";
import { yearlyProjection } from "./deposits.ts";
import { renderYearlyBriefMarkdown } from "./yearly-brief.ts";
import { yearCategoryCompare, yearCompareRanges } from "./period.ts";
import { renderYearCompareMarkdown } from "./compare-brief.ts";

const cats: Category[] = [
  { id: "salary", name: "Salary", nameZh: "薪金", theme: "living", kind: "income", icon: "wallet" },
  { id: "food", name: "Food", nameZh: "飲食", theme: "living", kind: "expense", icon: "utensils" },
  { id: "lunch", name: "Lunch", nameZh: "午餐", theme: "living", kind: "expense", icon: "utensils", parentId: "food" },
];

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "type" | "amount" | "date" | "categoryId">): Transaction {
  return { currency: "HKD", accountId: "a", payee: partial.id, payeeZh: partial.id, ...partial };
}

describe("report briefs", () => {
  it("labels posted months and planned months in the yearly export", () => {
    const plans: YearlyPlan[] = [
      { id: "2026-03", salary: 0, other: 0, expense: 9000 },
      { id: "2026-04", salary: 11000, other: 0, expense: 5000 },
    ];
    const txs = [
      tx({ id: "pay", type: "income", amount: 10000, date: "2026-01-15", categoryId: "salary" }),
      tx({ id: "eat", type: "expense", amount: 4000, date: "2026-01-20", categoryId: "food" }),
    ];
    const data = yearlyProjection(plans, [], [], 2026, 2, txs, cats, 8000, [], "2026-03-15");
    const md = renderYearlyBriefMarkdown({ asOf: "2026-03-15", year: 2026, monthCap: 8000, ...data });
    assert.match(md, /2026-01 \| 10000 \| 0 \| 0 \| 4000 \| 6000 \| posted \| posted/);
    assert.match(md, /2026-03 \(current\).*spending cap/);
    assert.match(md, /2026-04 \| 11000 \| 0 \| 0 \| 5000 \| 6000 \| planned \| planned/);
    assert.match(md, /not money already received/);
  });

  it("exports the same year-comparison totals and does not add subcategory rows to the total", () => {
    const txs = [
      tx({ id: "now", type: "expense", amount: 100, date: "2026-02-01", categoryId: "lunch" }),
      tx({ id: "then", type: "expense", amount: 40, date: "2025-02-01", categoryId: "lunch" }),
    ];
    const today = "2026-03-01";
    const data = yearCategoryCompare(txs, cats, [], today, "same-stage", "expense", true);
    const kids = yearCategoryCompare(txs, cats, [], today, "same-stage", "expense", true, "food");
    const range = yearCompareRanges(today, "same-stage");
    const md = renderYearCompareMarkdown({
      asOf: today,
      mode: "same-stage",
      kind: "expense",
      groupedByParent: true,
      ...range,
      thisTotal: data.thisTotal,
      lastTotal: data.lastTotal,
      rows: data.rows.map((r) => ({ ...r, name: r.nameZh })),
      groups: [{ name: "飲食", rows: kids.rows.map((r) => ({ ...r, name: r.nameZh })) }],
    });
    assert.equal(data.thisTotal, 100);
    assert.equal(data.lastTotal, 40);
    assert.match(md, /This period total: 100/);
    assert.match(md, /Last period total: 40/);
    assert.match(md, /\| 飲食 \| 100 \| 40 \| 60 \| \+150% \|/);
    assert.match(md, /## 飲食/);
    assert.match(md, /not an extra total/);
  });
});
