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
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 280);
  console.log(name, "=>", text);
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("qa-today");

await page.getByRole("button", { name: "上個月" }).click();
await page.waitForTimeout(400);
await shot("qa-today-prev");
await page.getByRole("button", { name: "今天" }).click();
await page.waitForTimeout(400);
await shot("qa-today-jump");

await page.goto("http://127.0.0.1:8080/budget", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("qa-budget");
await page.getByRole("button", { name: "新增預算" }).first().click();
await page.waitForTimeout(500);
await shot("qa-budget-add");
await page.keyboard.press("Escape");

await page.goto("http://127.0.0.1:8080/reports", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("qa-reports");

await page.goto("http://127.0.0.1:8080/reports/spending", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await shot("qa-spending");

await page.getByRole("button", { name: "收入 / 花費" }).click();
await page.waitForTimeout(600);
await shot("qa-spending-both");

await page.getByRole("button", { name: "費用" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "橫條" }).click();
await page.waitForTimeout(400);
await shot("qa-spending-bars");

await page.goto("http://127.0.0.1:8080/more", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("qa-more");

await page.goto("http://127.0.0.1:8080/more/categories", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("qa-categories");

await page.getByRole("button", { name: "新增分類" }).first().click();
await page.waitForTimeout(600);
await shot("qa-category-add");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await page.goto("http://127.0.0.1:8080/more/import", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("qa-import");

await page.getByText("budget-tracker-pro.json").click();
await page.waitForTimeout(400);
const commit = page.getByRole("button", { name: /寫入帳本|匯入|Commit/i }).last();
await commit.click();
try {
  await page.getByText(/已匯入|Imported/).waitFor({ timeout: 25000 });
} catch {
  await page.waitForTimeout(8000);
}
await shot("qa-import-done");

await page.goto("http://127.0.0.1:8080/reports/spending", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await shot("qa-spending-imported");

await page.getByRole("button", { name: "收入 / 花費" }).click();
await page.waitForTimeout(800);
await shot("qa-spending-imported-both");

await page.getByRole("button", { name: "費用" }).click();
await page.getByRole("button", { name: "橫條" }).click();
await page.waitForTimeout(600);
await shot("qa-spending-imported-bars");

await browser.close();
