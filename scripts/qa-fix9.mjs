import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 800);
  console.log("\n==", name, "==\n", text);
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "新增" }).last().click();
await page.waitForTimeout(500);
await shot("qa-add-maincats");

const diningOnMain = await page.getByText("外出就餐", { exact: true }).count();
const rentOnMain = await page.getByText("租金", { exact: true }).count();
console.log("dining on main", diningOnMain, "rent on main", rentOnMain);

await page.getByRole("button", { name: "飲食" }).click({ force: true });
await page.waitForTimeout(400);
await shot("qa-add-subcats");

await page.getByRole("button", { name: /外出就餐/ }).first().click();
await page.waitForTimeout(500);
await shot("qa-add-amount");

await browser.close();
