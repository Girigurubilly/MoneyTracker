import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

await page.goto("http://127.0.0.1:8080/budget", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const life = page.locator("button").filter({ hasText: "人壽保險" }).first();
await life.click();
await page.waitForTimeout(400);
const livingToggle = page.locator("button").filter({ hasText: "計入居住" });
console.log("toggle count", await livingToggle.count());
await livingToggle.click();
await page.getByRole("button", { name: "儲存" }).click();
await page.waitForTimeout(600);

await page.goto("http://127.0.0.1:8080/reports/living", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const text = await page.locator("body").innerText();
console.log(text.includes("人壽保險") ? "LIFE_ON_LIVING" : "LIFE_MISSING");
const m = text.match(/每月必要開支\n([^\n]+)/);
console.log("essential line", m?.[1]);
console.log(text.slice(0, 400).replace(/\s+/g, " "));

await page.goto("http://127.0.0.1:8080/budget", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.locator("button").filter({ hasText: "人壽保險" }).first().click();
await page.waitForTimeout(400);
await page.locator("button").filter({ hasText: "計入居住" }).click();
await page.getByRole("button", { name: "儲存" }).click();
await page.waitForTimeout(400);

await browser.close();
