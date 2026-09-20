import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isHousingCategory,
  isMortgageInterestCategory,
  isMortgagePrincipalCategory,
  isMortgageSplitCategory,
  isTaxCategory,
  missingMortgageLeaf,
  mortgageEntryKind,
  pickerGroups,
  taxCategoryIds,
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
    assert.equal(mortgageEntryKind(principal, cats), "principal");
    assert.equal(mortgageEntryKind(interest, cats), "interest");
    assert.equal(mortgageEntryKind(named, cats), "split");
    assert.equal(mortgageEntryKind(housing, cats), null);
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

  it("does not recreate mortgage-p when that id was renamed to 家用", () => {
    const housing = cat({ id: "p-housing", name: "Housing", nameZh: "房屋" });
    const family = cat({ id: "mortgage-p", name: "家用", nameZh: "家用", parentId: "p-housing" });
    const interest = cat({ id: "mortgage-i", name: "Mortgage interest", nameZh: "按揭利息", parentId: "p-housing" });
    const cats = [housing, family, interest];
    assert.equal(isMortgagePrincipalCategory(family), false);
    assert.equal(missingMortgageLeaf(cats, "principal"), false);
    assert.equal(missingMortgageLeaf(cats, "interest"), false);
    assert.equal(missingMortgageLeaf([housing], "principal"), true);
  });

  it("honours explicit special and tax flags over name matching", () => {
    const renamed = cat({ id: "gift", name: "家用", nameZh: "家用", special: "mortgagePrincipal" });
    const turnedOff = cat({ id: "mp", name: "Mortgage principal", nameZh: "按揭本金", special: "none" });
    const customTax = cat({ id: "ird", name: "IRD", nameZh: "稅局", tax: true });
    const notTax = cat({ id: "salaries-tax", name: "Salaries tax", nameZh: "薪俸稅", tax: false });
    assert.equal(isMortgagePrincipalCategory(renamed), true);
    assert.equal(isMortgagePrincipalCategory(turnedOff), false);
    assert.equal(isTaxCategory(customTax), true);
    assert.equal(isTaxCategory(notTax), false);
    assert.equal(taxCategoryIds([customTax, notTax]).has("ird"), true);
    assert.equal(taxCategoryIds([customTax, notTax]).has("salaries-tax"), false);
  });

  it("lets a child under 房屋 opt out of housing with special none", () => {
    const housing = cat({ id: "p-housing", name: "Housing", nameZh: "房屋", special: "housing" });
    const mgmt = cat({ id: "mgmt", name: "Management", nameZh: "管理費", parentId: "p-housing" });
    const family = cat({ id: "family", name: "家用", nameZh: "家用", parentId: "p-housing", special: "none" });
    assert.equal(isHousingCategory(mgmt, [housing, mgmt, family]), true);
    assert.equal(isHousingCategory(family, [housing, mgmt, family]), false);
  });
});

describe("pickerGroups two layers", () => {
  it("nests sub-categories under the main group and parks mortgage leaves in 房屋", () => {
    const housing = cat({ id: "p-housing", name: "Housing", nameZh: "房屋" });
    const food = cat({ id: "p-food", name: "Food", nameZh: "飲食", icon: "utensils" });
    const dining = cat({ id: "dining", name: "Dining", nameZh: "外出就餐", icon: "utensils", parentId: "p-food" });
    const principal = cat({ id: "mortgage-p", name: "Mortgage principal", nameZh: "按揭本金" });
    const interest = cat({ id: "mortgage-i", name: "Mortgage interest", nameZh: "按揭利息" });
    const mgmt = cat({ id: "mgmt", name: "Management", nameZh: "管理費", parentId: "p-housing" });
    const groups = pickerGroups([housing, food, dining, principal, interest, mgmt]);
    const house = groups.find((g) => g.parent.id === "p-housing");
    const meals = groups.find((g) => g.parent.id === "p-food");
    assert.ok(house);
    assert.ok(meals);
    assert.deepEqual(
      house!.children.map((c) => c.id).sort(),
      ["mgmt", "mortgage-i", "mortgage-p"].sort(),
    );
    assert.deepEqual(
      meals!.children.map((c) => c.id),
      ["dining"],
    );
    assert.equal(
      groups.some((g) => g.parent.id === "mortgage-p" || g.parent.id === "mortgage-i"),
      false,
    );
  });
});
