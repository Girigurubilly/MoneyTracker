import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSpendBrief, renderSpendBriefMarkdown } from "./spend-brief.ts";
import type { Category, FxRate, Transaction } from "../types.ts";

const rates: FxRate[] = [{ currency: "HKD", perHkd: 1, asOf: "2026-09-01", source: "Base" }];

function cat(partial: Partial<Category> & Pick<Category, "id" | "name">): Category {
  return {
    nameZh: partial.nameZh ?? partial.name,
    theme: "living",
    kind: "expense",
    icon: "wallet",
    ...partial,
  };
}

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "type" | "amount" | "date">): Transaction {
  return { currency: "HKD", planned: false, accountId: "bank", payee: "", payeeZh: "", ...partial };
}

const categories: Category[] = [
  cat({ id: "p-food", name: "Food", nameZh: "飲食" }),
  cat({ id: "dining", name: "Dining", nameZh: "外出用餐", parentId: "p-food" }),
  cat({ id: "groceries", name: "Groceries", nameZh: "超市", parentId: "p-food" }),
  cat({ id: "p-gadget", name: "Gadgets", nameZh: "電子", adhocDefault: true, fireSpendKind: "irregular" }),
  cat({ id: "phone", name: "Phone", nameZh: "電話", parentId: "p-gadget", fireSpendKind: "irregular" }),
  cat({ id: "salary", name: "Salary", nameZh: "薪金", kind: "income", theme: "other" }),
];

const txs: Transaction[] = [
  tx({ id: "i1", type: "income", amount: 40_000, date: "2026-09-01", categoryId: "salary", payee: "Employer" }),
  tx({ id: "e1", type: "expense", amount: 800, date: "2026-09-04", categoryId: "dining", payee: "Cafe" }),
  tx({ id: "e2", type: "expense", amount: 1_200, date: "2026-09-08", categoryId: "groceries", payee: "Wellcome" }),
  tx({ id: "e3", type: "expense", amount: 18_000, date: "2026-09-12", categoryId: "phone", payee: "Apple", adhoc: true }),
  tx({ id: "e4", type: "expense", amount: 600, date: "2026-09-18", categoryId: "dining", payee: "Noodles" }),
];

describe("spend brief", () => {
  it("summarises the selected period and lists biggest spend per category", () => {
    const brief = buildSpendBrief({
      today: "2026-09-20",
      from: "2026-09-01",
      to: "2026-09-20",
      preset: "this-month",
      hideAdhoc: false,
      txs,
      categories,
      rates,
    });
    assert.equal(brief.flow.income, 40_000);
    assert.equal(brief.flow.expense, 20_600);
    assert.equal(brief.flow.net, 19_400);
    assert.equal(brief.adhoc.filterOn, false);
    assert.equal(brief.adhoc.includedCount, 1);
    assert.equal(brief.adhoc.includedAmount, 18_000);
    const food = brief.categories.find((c) => c.id === "p-food");
    const gadget = brief.categories.find((c) => c.id === "p-gadget");
    assert.ok(food);
    assert.ok(gadget);
    assert.equal(gadget!.amount, 18_000);
    assert.equal(gadget!.largest[0]?.payee, "Apple");
    assert.equal(food!.amount, 2_600);
    assert.equal(food!.largest[0]?.amount, 1_200);
    assert.ok(food!.children.some((c) => c.id === "dining" && c.amount === 1_400));
    const md = renderSpendBriefMarkdown(brief);
    assert.match(md, /period income & expense brief/);
    assert.match(md, /hide ad-hoc \/ 唔計臨時大額 = OFF/);
    assert.match(md, /Gadgets \/ 電子/);
    assert.match(md, /Apple/);
    assert.match(md, /key,income,spend,net/);
  });

  it("honours hide-adhoc so big one-off spend drops from totals and largest lists", () => {
    const brief = buildSpendBrief({
      today: "2026-09-20",
      from: "2026-09-01",
      to: "2026-09-20",
      preset: "this-month",
      hideAdhoc: true,
      txs,
      categories,
      rates,
    });
    assert.equal(brief.hideAdhoc, true);
    assert.equal(brief.flow.income, 40_000);
    assert.equal(brief.flow.expense, 2_600);
    assert.equal(brief.flow.net, 37_400);
    assert.equal(brief.adhoc.excludedCount, 1);
    assert.equal(brief.adhoc.excludedAmount, 18_000);
    assert.equal(brief.categories.some((c) => c.id === "p-gadget"), false);
    const food = brief.categories[0];
    assert.equal(food?.id, "p-food");
    assert.equal(food?.largest[0]?.payee, "Wellcome");
    assert.equal(brief.topExpenses.some((x) => x.payee === "Apple"), false);
    const md = renderSpendBriefMarkdown(brief);
    assert.match(md, /hide ad-hoc \/ 唔計臨時大額 = ON/);
    assert.match(md, /Ad-hoc excluded: 1 txs, 18000/);
    assert.doesNotMatch(md, /Apple/);
  });
});
