import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 360);
  console.log(name, "=>", text);
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot("qa-today");

await page.getByRole("button", { name: "新增" }).last().click();
await page.waitForTimeout(400);
await shot("qa-add-picker");
await page.getByRole("button", { name: "支出" }).click();
await page.waitForTimeout(500);
await shot("qa-add-cats");
const travel = page.getByRole("button", { name: "旅遊" });
if (await travel.count()) {
  await travel.first().click();
  await page.waitForTimeout(400);
  await shot("qa-add-travel");
}
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "關閉" }).first().click().catch(() => {});
await page.waitForTimeout(300);

await page.goto("http://127.0.0.1:8080/budget", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await shot("qa-budget");
await page.getByRole("button", { name: "新增定期項目" }).click();
await page.waitForTimeout(400);
await shot("qa-regular-add");
await page.getByRole("button", { name: "關閉" }).first().click().catch(() => {});

await page.goto("http://127.0.0.1:8080/assets", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await shot("qa-assets");
await page.getByRole("button", { name: /隱藏/ }).click();
await page.waitForTimeout(300);
await shot("qa-assets-hidden");

await page.goto("http://127.0.0.1:8080/reports/living", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await shot("qa-living");
await page.getByRole("button", { name: "更新按揭" }).click();
await page.waitForTimeout(400);
await shot("qa-living-edit");
await page.getByRole("button", { name: "關閉" }).first().click().catch(() => {});

await page.goto("http://127.0.0.1:8080/more", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("qa-more");

await browser.close();
