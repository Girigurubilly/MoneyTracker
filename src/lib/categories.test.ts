import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isMortgageInterestCategory,
  isMortgagePrincipalCategory,
  isMortgageSplitCategory,
  pickerGroups,
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

test("user-added 房屋 and 按揭 children trigger mortgage split", () => {
  const housing = { id: "h1", name: "Housing", nameZh: "房屋" };
  const principal = { id: "p1", name: "Principal", nameZh: "按揭本金", parentId: "h1" };
  const interest = { id: "i1", name: "Interest", nameZh: "按揭利息", parentId: "h1" };
  const spaced = { id: "p3", name: "Mortgage principal", nameZh: "按揭 本金" };
  const bareP = { id: "p2", name: "Principal", nameZh: "本金", parentId: "h1" };
  const mgmt = { id: "m1", name: "Fee", nameZh: "管理費", parentId: "h1" };
  const dining = { id: "d1", name: "Dining", nameZh: "外出就餐" };
  const all = [housing, principal, interest, spaced, bareP, mgmt, dining];
  assert.equal(isMortgageSplitCategory(principal, all), true);
  assert.equal(isMortgageSplitCategory(interest, all), true);
  assert.equal(isMortgageSplitCategory(spaced, all), true);
  assert.equal(isMortgageSplitCategory(bareP, all), true);
  assert.equal(isMortgageSplitCategory(mgmt, all), false);
  assert.equal(isMortgageSplitCategory(dining, all), false);
  assert.equal(isMortgagePrincipalCategory(principal), true);
  assert.equal(isMortgagePrincipalCategory(bareP), true);
  assert.equal(isMortgagePrincipalCategory(spaced), true);
  assert.equal(isMortgageInterestCategory(interest), true);
  assert.equal(isMortgageInterestCategory({ id: "inc", name: "Interest income", nameZh: "利息收入" }), false);
});

test("unparented user 按揭本金 / 按揭利息 appear under 房屋 in the picker", () => {
  const cats: Category[] = [
    cat({ id: "p-housing", name: "Housing", nameZh: "房屋" }),
    cat({ id: "cat-user-p", name: "按揭本金", nameZh: "按揭本金" }),
    cat({ id: "cat-user-i", name: "按揭利息", nameZh: "按揭利息" }),
    cat({ id: "dining", name: "Dining", nameZh: "外出就餐", icon: "utensils" }),
  ];
  const groups = pickerGroups(cats, "expense");
  const housing = groups.find((g) => g.parent.id === "p-housing");
  assert.ok(housing);
  const ids = housing!.children.map((c) => c.id);
  assert.ok(ids.includes("cat-user-p"));
  assert.ok(ids.includes("cat-user-i"));
  assert.equal(
    groups.some((g) => g.parent.id === "cat-user-p" || g.parent.id === "cat-user-i"),
    false,
  );
  assert.equal(isMortgageSplitCategory(cats[1], cats), true);
  assert.equal(isMortgageSplitCategory(cats[2], cats), true);
});
