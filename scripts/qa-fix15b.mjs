import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
async function shot(name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
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
await page.waitForTimeout(400);

await page.getByRole("button", { name: /按揭供款/ }).first().click();
await page.waitForTimeout(400);
const exist = await shot("qa15-edit-existing");
console.log("existing split available", exist.includes("分拆本金"));
console.log("existing not auto-split", !exist.includes("按揭帳戶") || exist.includes("分拆本金"));
const splitBtn = page.getByRole("button", { name: /分拆本金/ });
if (await splitBtn.count()) {
  await splitBtn.click();
  await page.waitForTimeout(300);
  const on = await shot("qa15-edit-existing-on");
  console.log("toggled dest", on.includes("按揭帳戶"));
  const moneyInputs = page.locator('input[inputmode="decimal"]');
  await moneyInputs.nth(0).fill("9592");
  await moneyInputs.nth(1).fill("4988");
  await page.getByRole("button", { name: "儲存" }).click();
  await page.waitForTimeout(800);
  const list = await shot("qa15-converted");
  console.log("converted principal", list.includes("按揭供款 · 本金") && list.includes("轉帳 · 本金"));
  console.log("converted interest", list.includes("按揭供款 · 利息"));
  console.log("old single gone", !/\b按揭供款 HK\$14,580/.test(list));
}

await page.getByRole("button", { name: "新增定期項目" }).click();
await page.waitForTimeout(400);
await page.locator("select").nth(2).selectOption({ label: "按揭本金" });
await page.waitForTimeout(300);
await shot("qa15-new-dest");
const destSelects = page.locator("select");
const count = await destSelects.count();
console.log("select count", count);
for (let i = 0; i < count; i++) {
  const label = await destSelects.nth(i).locator("xpath=preceding-sibling::span").textContent().catch(() => "");
  const val = await destSelects.nth(i).inputValue();
  const opt = await destSelects.nth(i).locator("option:checked").textContent();
  console.log("select", i, label, "=>", val, opt);
}

await browser.close();
