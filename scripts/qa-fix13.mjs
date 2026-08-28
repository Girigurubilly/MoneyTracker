import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function shot(name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("\n==", name, "==\n", text.slice(0, 1400));
  return text;
}
async function closeSheet() {
  const close = page.getByRole("button", { name: /關閉|Close/i }).last();
  if (await close.count()) await close.click({ force: true }).catch(() => {});
  else await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
const today = await shot("qa13-today");
console.log("projected spend", today.includes("預計本月尚餘開支"));

await page.getByRole("button", { name: "新增" }).last().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "費用" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /房屋|Housing/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /按揭本金|Mortgage principal/ }).first().click();
await page.waitForTimeout(500);
const form = await shot("qa13-add-mortgage");
console.log("scheduled", form.includes("預定"));
console.log("split toggle", form.includes("分拆本金"));
console.log("principal field", form.includes("本金") && form.includes("利息"));
console.log("has account", !form.includes("帳戶 —"));
await closeSheet();

await page.goto("http://127.0.0.1:8080/budget", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const budget = await shot("qa13-budget");
console.log("monthly regulars", budget.includes("每月定期"));
console.log("adhoc", budget.includes("本月臨時"));

await page.goto("http://127.0.0.1:8080/more", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.getByText("載入示範資料").click();
await page.waitForTimeout(1500);
await page.goto("http://127.0.0.1:8080/budget", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const budget2 = await shot("qa13-budget-sample");
console.log("sample regulars", budget2.includes("按揭供款") || budget2.includes("薪金"));
console.log("scheduled chip", budget2.includes("預定") || budget2.includes("即將扣帳"));

await page.goto("http://127.0.0.1:8080/more/fx", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await shot("qa13-fx");
await page.getByRole("button", { name: "更新匯率" }).click();
await page.waitForTimeout(5000);
const fx2 = await shot("qa13-fx-after");
console.log("fx updated", fx2.includes("Frankfurter") || fx2.includes("ExchangeRate") || fx2.includes("已更新") || /2026-08-2[6-9]|2026-08-27/.test(fx2));

await page.goto("http://127.0.0.1:8080/more/import", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const imp = await shot("qa13-import");
console.log("no bundled filename", !imp.includes("budget-tracker-pro.json"));
console.log("json import", imp.includes("JSON 匯入"));

await page.goto("http://127.0.0.1:8080/reports/retirement", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const ret = await shot("qa13-retire-sample");
console.log("oaa", ret.includes("生果金"));
console.log("save needed", ret.includes("額外每月儲蓄"));

console.log("\nPAGE ERRORS", errors.slice(0, 12));
await browser.close();
