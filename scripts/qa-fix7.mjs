import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

async function shot(name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  console.log(name, "ok");
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

await page.getByRole("button", { name: "新增" }).click();
await page.waitForTimeout(700);
await shot("qa-add-cats");
await page.getByRole("button", { name: "旅遊", exact: true }).click();
await page.waitForTimeout(600);
await shot("qa-add-travel");
await page.getByRole("button", { name: "住宿" }).click();
await page.waitForTimeout(600);
await shot("qa-add-amount");
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
await page.keyboard.press("Escape");
await page.waitForTimeout(250);

await page.goto("http://127.0.0.1:8080/budget", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("qa-budget");
await page.getByRole("button", { name: "新增定期項目" }).click();
await page.waitForTimeout(500);
await shot("qa-regular-add");
await page.locator(".relative.z-\\[81\\] input").nth(0).fill("BB mobile");
await page.locator(".relative.z-\\[81\\] input").nth(1).fill("139");
await page.locator(".relative.z-\\[81\\] input").nth(2).fill("1");
await page.locator(".relative.z-\\[81\\]").getByRole("button", { name: "儲存" }).click();
await page.waitForTimeout(700);
await shot("qa-budget-regulars");

await page.goto("http://127.0.0.1:8080/assets", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("qa-assets");
await page.evaluate(() => window.scrollTo(0, 2000));
await page.waitForTimeout(400);
await shot("qa-assets-hidden");
const hiddenBtn = page.getByRole("button", { name: /隱藏/ });
if (await hiddenBtn.count()) await hiddenBtn.first().click();
await page.waitForTimeout(400);
await shot("qa-assets-hidden-open");
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.getByRole("button", { name: "編輯" }).first().click();
await page.waitForTimeout(500);
await shot("qa-assets-edit");
await page.keyboard.press("Escape");

await page.goto("http://127.0.0.1:8080/reports/living", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("qa-living");
await page.getByRole("button", { name: "更新按揭" }).click();
await page.waitForTimeout(500);
await shot("qa-living-edit");

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("qa-today");

console.log("ERRORS", errors);
await browser.close();
