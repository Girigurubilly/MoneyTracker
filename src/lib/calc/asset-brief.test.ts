import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAssetBrief, renderAssetBriefMarkdown } from "./asset-brief.ts";
import type { Account, Category, FxRate, Transaction } from "../types.ts";

const rates: FxRate[] = [{ currency: "HKD", perHkd: 1, asOf: "2026-09-01", source: "Base" }];

function acc(partial: Partial<Account> & Pick<Account, "id" | "type" | "balance">): Account {
  return {
    name: partial.id,
    nameZh: partial.id,
    currency: "HKD",
    includeInNetWorth: true,
    group: partial.type === "credit" || partial.type === "loan" ? "credit" : partial.type === "property" || partial.type === "mortgage" ? "housing" : "cash",
    ...partial,
  };
}

function cat(id: string, name: string, parentId?: string): Category {
  return { id, name, nameZh: name, theme: "living", kind: "expense", icon: "wallet", parentId };
}

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "type" | "amount" | "accountId" | "date">): Transaction {
  return { currency: "HKD", planned: false, ...partial };
}

describe("asset brief", () => {
  it("summarises position, 12-month cash flow and monthly net-worth change", () => {
    const accounts = [
      acc({ id: "bank", type: "current", balance: 100_000, name: "Bank", nameZh: "銀行" }),
      acc({ id: "card", type: "credit", balance: -20_000, name: "Card", nameZh: "卡", group: "credit" }),
    ];
    const categories = [cat("p-food", "Food"), cat("dining", "Dining", "p-food"), cat("salary", "Salary")];
    const txs: Transaction[] = [
      tx({ id: "i1", type: "income", amount: 30_000, accountId: "bank", date: "2026-09-01", categoryId: "salary" }),
      tx({ id: "e1", type: "expense", amount: 8_000, accountId: "bank", date: "2026-09-10", categoryId: "dining" }),
      tx({ id: "i0", type: "income", amount: 30_000, accountId: "bank", date: "2026-08-01", categoryId: "salary" }),
      tx({ id: "e0", type: "expense", amount: 12_000, accountId: "bank", date: "2026-08-10", categoryId: "dining" }),
    ];
    const brief = buildAssetBrief({ today: "2026-09-20", accounts, rates, txs, categories });
    assert.equal(brief.position.net, 80_000);
    assert.equal(brief.position.assets, 100_000);
    assert.equal(brief.position.liab, 20_000);
    assert.equal(brief.position.liquid, 100_000);
    assert.equal(brief.months.length, 12);
    const sep = brief.months.find((m) => m.month === "2026-09");
    assert.ok(sep);
    assert.equal(sep!.income, 30_000);
    assert.equal(sep!.expense, 8_000);
    assert.equal(sep!.cashflow, 22_000);
    assert.equal(brief.flow12.income, 60_000);
    assert.equal(brief.flow12.expense, 20_000);
    assert.equal(brief.flow12.net, 40_000);
    assert.equal(brief.flow12.surplusMonths, 2);
    assert.ok(brief.spendMix[0]?.name === "Food");
    assert.ok(brief.incomeMix[0]?.name === "Salary");
    const md = renderAssetBriefMarkdown(brief);
    assert.match(md, /current assets & cash-flow brief/);
    assert.match(md, /month,income,spend,cashflow_net/);
    assert.match(md, /2026-09,30000,8000,22000/);
    assert.match(md, /Combine this file with the retirement/);
  });

  it("does not treat a renamed mortgage-p style account clash in cash flow", () => {
    const accounts = [acc({ id: "cash", type: "cash", balance: 5000 })];
    const brief = buildAssetBrief({
      today: "2026-09-20",
      accounts,
      rates,
      txs: [],
      categories: [],
    });
    assert.equal(brief.position.net, 5000);
    assert.equal(brief.flow12.net, 0);
    assert.equal(brief.months.at(-1)?.nwChange, 0);
  });
});
