import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isMortgageInterestCategory,
  isMortgagePrincipalCategory,
  isMortgageSplitCategory,
} from "./categories.ts";
import type { Category } from "./types.ts";

function cat(partial: Partial<Category> & Pick<Category, "id" | "name" | "nameZh">): Category {
  return {
    theme: "living",
    kind: "expense",
    icon: "home",
    ...partial,
  };
}

describe("mortgage category matching", () => {
  it("matches 按揭本金 / 按揭利息 and housing leaves", () => {
    const housing = cat({ id: "p-housing", name: "Housing", nameZh: "房屋" });
    const principal = cat({ id: "mortgage-p", name: "Mortgage principal", nameZh: "按揭本金", parentId: "p-housing" });
    const interest = cat({ id: "mortgage-i", name: "Mortgage interest", nameZh: "按揭利息", parentId: "p-housing" });
    const named = cat({ id: "user-mortgage", name: "Mortgage", nameZh: "按揭" });
    const cats = [housing, principal, interest, named];
    assert.equal(isMortgagePrincipalCategory(principal), true);
    assert.equal(isMortgageInterestCategory(interest), true);
    assert.equal(isMortgageSplitCategory(named, cats), true);
    assert.equal(isMortgageSplitCategory(principal, cats), true);
  });

  it("does not treat 利息收入 as mortgage interest", () => {
    const income = cat({
      id: "int-inc",
      name: "Interest income",
      nameZh: "利息收入",
      kind: "income",
      theme: "other",
      icon: "coins",
    });
    assert.equal(isMortgageInterestCategory(income), false);
    assert.equal(isMortgageSplitCategory(income, [income]), false);
  });
});
