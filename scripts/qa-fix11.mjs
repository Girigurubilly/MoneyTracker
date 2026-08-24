import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("\n==", name, "==\n", text.slice(0, 1200));
  return text;
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const today = await shot("qa11-today");
const upcomingIdx = today.indexOf("即將到期");
const upcomingSlice = upcomingIdx >= 0 ? today.slice(upcomingIdx, today.indexOf("當日交易")) : "";
console.log("UPCOMING SLICE:", upcomingSlice);
console.log("has 按揭 in upcoming", upcomingSlice.includes("按揭"));
console.log("has 管理費 in upcoming", upcomingSlice.includes("管理費"));
console.log("has 人壽 in upcoming", upcomingSlice.includes("人壽"));
console.log("has 流動電話", upcomingSlice.includes("流動電話"));
console.log("has 自願性強積金", upcomingSlice.includes("自願性強積金"));
const mobilePos = upcomingSlice.indexOf("流動電話");
const mpfPos = upcomingSlice.indexOf("自願性強積金");
console.log("order mobile then mpf", mobilePos >= 0 && mpfPos > mobilePos);

await page.getByRole("link", { name: /預算/ }).click();
await page.waitForTimeout(800);
const budget = await shot("qa11-budget");
const regIdx = budget.indexOf("每月定期項目");
const regSlice = regIdx >= 0 ? budget.slice(regIdx) : "";
console.log("REGULARS SLICE:", regSlice.slice(0, 500));
const days = [...regSlice.matchAll(/(\d+)日/g)].map((m) => Number(m[1]));
console.log("charged days order", days);
const sorted = [...days].sort((a, b) => a - b);
console.log("regulars sorted", JSON.stringify(days) === JSON.stringify(sorted));
console.log("has 剩餘", budget.includes("剩餘"));
console.log("has 預測", budget.includes("預測缺口") || budget.includes("預測每日"));

await page.getByRole("link", { name: /餘額/ }).click();
await page.waitForTimeout(800);
const assets = await shot("qa11-assets");
console.log("has move up", (await page.getByRole("button", { name: "上移" }).count()) > 0);
console.log("cash header", assets.includes("現金及銀行"));

const firstUp = page.getByRole("button", { name: "上移" }).nth(1);
const namesBefore = await page.locator("a[href^='/assets/'] span.block.truncate").allInnerTexts();
console.log("cash names before", namesBefore.slice(0, 6));
if ((await firstUp.count()) > 0) {
  await firstUp.click();
  await page.waitForTimeout(400);
  const namesAfter = await page.locator("a[href^='/assets/'] span.block.truncate").allInnerTexts();
  console.log("cash names after move", namesAfter.slice(0, 6));
}

await page.getByRole("link", { name: /今天/ }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "新增" }).last().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "支出" }).click();
await page.waitForTimeout(600);
const dining = page.getByRole("button", { name: "飲食" });
if ((await dining.count()) > 0) await dining.click({ force: true });
await page.waitForTimeout(400);
const sub = page.getByRole("button", { name: /外出就餐/ });
if ((await sub.count()) > 0) await sub.first().click();
await page.waitForTimeout(600);
await shot("qa11-add-amount");
await page.getByText("帳戶", { exact: true }).click();
await page.waitForTimeout(600);
const pick = await shot("qa11-account-pick");
console.log("picker cash", pick.includes("現金及銀行"));
console.log("picker credit", pick.includes("信用卡及債務"));
console.log("picker housing", pick.includes("住屋"));
console.log("picker hidden miles?", pick.includes("亞洲萬里通") && !pick.includes("獎賞"));

await browser.close();
