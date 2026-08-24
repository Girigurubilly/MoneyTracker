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
  console.log("\n==", name, "==\n", text.slice(0, 1100));
  return text;
}
async function closeSheet() {
  await page.locator("h2").locator("xpath=following-sibling::button[1]").first().click({ force: true }).catch(async () => {
    await page.getByText("關閉", { exact: true }).last().click({ force: true });
  });
  await page.waitForTimeout(300);
}
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByRole("link", { name: "報表" }).click();
await page.waitForTimeout(400);
await page.getByRole("link", { name: "旅遊計劃" }).click();
const travel = await shot("qa12-travel");
console.log("taipei range", /2026-11-14 → 2026-11-16/.test(travel));
console.log("japan range", /2027-03-20 → 2027-03-30/.test(travel));
console.log("budget used", travel.includes("預算已用"));
console.log("taipei spent", travel.includes("2,100"));

await page.getByRole("button", { name: "新增旅程" }).click();
await page.waitForTimeout(400);
console.log("add trip date inputs", await page.locator('input[type="date"]').count());
await shot("qa12-travel-add");
await closeSheet();

await page.getByRole("link", { name: "台北週末" }).click();
await page.waitForTimeout(400);
const detail = await shot("qa12-trip-detail");
console.log("detail spent", detail.includes("2,100"));
console.log("detail pct", /26%/.test(detail));

await page.getByRole("link", { name: "報表" }).click();
await page.waitForTimeout(300);
await page.getByRole("link", { name: "退休" }).click();
const ret = await shot("qa12-retire");
console.log("saving12", ret.includes("近 12 個月平均儲蓄"));
console.log("target monthly", ret.includes("目標每月"));
console.log("hint", ret.includes("近 12 個月"));

await page.getByRole("link", { name: "今天" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "新增" }).last().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "費用" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "飲食" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /外出就餐/ }).first().click();
await page.waitForTimeout(500);
const form = await shot("qa12-add-expense");
console.log("form has trip", form.includes("旅程"));
await page.getByRole("button", { name: /旅程/ }).click();
await page.waitForTimeout(400);
const pick = await shot("qa12-trip-pick");
console.log("pick has japan", pick.includes("日本春天"));
console.log("pick has taipei", pick.includes("台北週末"));
console.log("pick ranges", pick.includes("2027-03-20"));

await browser.close();
