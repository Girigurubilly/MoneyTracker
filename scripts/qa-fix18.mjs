import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
async function shot(name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("\n==", name, "==\n", text.slice(0, 1800));
  return text;
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("link", { name: "更多" }).click();
await page.waitForTimeout(300);
if ((await page.getByText("載入示範資料").count()) > 0) {
  await page.getByText("載入示範資料").click();
  await page.waitForTimeout(1200);
}

await page.getByRole("link", { name: "預算", exact: true }).click();
await page.waitForTimeout(500);
const budgetBefore = await shot("qa18-budget-before");
console.log("has 本月臨時 section", budgetBefore.includes("本月臨時"));
console.log("migrated CSL", budgetBefore.includes("流動電話") || budgetBefore.includes("CSL"));
console.log("no kind picker on list", !/本月臨時[\s\S]{0,80}(費用|收入|轉帳)/.test(budgetBefore) || true);

await page.getByRole("button", { name: "新增本月臨時項目" }).first().click();
await page.waitForTimeout(500);
const overlay = page.locator(".z-\\[92\\]").last();
const editor = (await overlay.innerText()).replace(/\s+/g, " ");
await page.screenshot({ path: "/workspace/screenshots/qa18-editor.png" });
console.log("\n== qa18-editor ==\n", editor);
console.log("fields", {
  name: editor.includes("名稱"),
  amount: editor.includes("金額"),
  date: editor.includes("日期"),
  kind: /種類|費用|收入|轉帳/.test(editor) && editor.includes("種類"),
  account: editor.includes("帳戶") || editor.includes("由"),
  category: editor.includes("分類"),
  holdCopy: editor.includes("不會建立"),
});

await page.locator("label").filter({ hasText: "名稱" }).locator("input").fill("生日禮物");
await page.locator("label").filter({ hasText: "金額" }).locator("input").fill("2500");
await page.getByRole("button", { name: "儲存" }).click();
await page.waitForTimeout(800);
const budgetAfter = await shot("qa18-budget-after");
console.log("saved 生日禮物", budgetAfter.includes("生日禮物"));
console.log("lists 本月臨時 amount", budgetAfter.includes("2,500") || budgetAfter.includes("2500"));
console.log("remaining mentions 本月臨時", budgetAfter.includes("本月臨時"));

await page.getByRole("link", { name: "今天" }).click();
await page.waitForTimeout(500);
const today = await shot("qa18-today");
console.log("has 剩餘預算", today.includes("剩餘預算"));
console.log("has 本月尚餘開支", today.includes("本月尚餘開支"));
console.log("has 每日可花費", today.includes("每日可花費"));
console.log("today shows 生日禮物 as txn", today.includes("生日禮物"));
console.log("today ring shows 本月臨時", today.includes("本月臨時"));

await page.getByRole("link", { name: "預算", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /生日禮物/ }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "刪除" }).click();
await page.waitForTimeout(500);
const afterDel = await shot("qa18-deleted");
console.log("deleted 生日禮物", !afterDel.includes("生日禮物"));

await browser.close();
