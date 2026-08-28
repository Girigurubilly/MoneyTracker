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
  console.log("\n==", name, "==\n", text.slice(0, 1400));
  return text;
}
async function closeSheet() {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

await page.getByRole("link", { name: "更多" }).click();
await page.waitForTimeout(300);
if ((await page.getByText("載入示範資料").count()) > 0) {
  await page.getByText("載入示範資料").click();
  await page.waitForTimeout(1200);
}

await page.getByRole("link", { name: "分類與主題" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "新增分類" }).first().click();
await page.waitForTimeout(300);
await page.locator("input").first().fill("自訂按揭本金");
await page.getByRole("button", { name: "儲存" }).click();
await page.waitForTimeout(600);
const cats = await shot("qa14-cats");
console.log("custom mortgage cat", cats.includes("自訂按揭本金"));

await page.getByRole("link", { name: "今天" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "新增" }).last().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "費用" }).click();
await page.waitForTimeout(500);
const mains = await shot("qa14-mains");
console.log("has housing", mains.includes("房屋"));
console.log("custom as main", mains.includes("自訂按揭本金"));
if (mains.includes("自訂按揭本金")) {
  await page.getByRole("button", { name: /自訂按揭本金/ }).first().click();
} else {
  await page.getByRole("button", { name: "房屋" }).click();
  await page.waitForTimeout(400);
  const subs = await shot("qa14-subs");
  console.log("subs", subs.slice(0, 400));
  const customBtn = page.getByRole("button", { name: /自訂按揭本金/ }).first();
  if (await customBtn.count()) await customBtn.click();
  else await page.getByRole("button", { name: /按揭本金/ }).first().click();
}
await page.waitForTimeout(500);
const form = await shot("qa14-split");
console.log("split toggle", form.includes("分拆本金"));
console.log("principal field", form.includes("本金") && form.includes("利息"));

await closeSheet();

await page.getByRole("link", { name: "報表" }).click();
await page.waitForTimeout(300);
await page.getByRole("link", { name: "現金流預測" }).click();
await page.waitForTimeout(500);
const cf = await shot("qa14-cashflow");
console.log("has salary-ish", /72,000|72000/.test(cf));
console.log("has mortgage-ish", /14,580|14580/.test(cf));
console.log("hint scheduled", cf.includes("預定"));

await page.getByRole("link", { name: "報表" }).click();
await page.waitForTimeout(300);
await page.getByRole("link", { name: "退休" }).click();
await page.waitForTimeout(500);
const ret = await shot("qa14-retire");
console.log("from12m", ret.includes("近 12 個月平均"));
console.log("income now", ret.includes("現時每月收入"));
console.log("spend now", ret.includes("現時每月開支"));

await page.getByRole("link", { name: "報表" }).click();
await page.waitForTimeout(300);
await page.getByRole("link", { name: "旅遊計劃" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "新增旅程" }).click();
await page.waitForTimeout(400);
await page.locator("input").nth(0).fill("過期東京");
await page.locator("input").nth(1).fill("東京");
await page.locator('input[type="date"]').nth(0).fill("2024-01-01");
await page.locator('input[type="date"]').nth(1).fill("2024-01-10");
await page.getByRole("button", { name: "儲存" }).click();
await page.waitForTimeout(600);
const travel = await shot("qa14-travel");
console.log("expired section", travel.includes("已過期"));
console.log("expired trip", travel.includes("過期東京"));
console.log("remove btn", travel.includes("移除旅程"));

if (travel.includes("移除旅程")) {
  await page.getByRole("button", { name: "移除旅程" }).first().click();
  await page.waitForTimeout(500);
  const after = await shot("qa14-travel-removed");
  console.log("removed", !after.includes("過期東京"));
}

await page.getByRole("link", { name: "今天" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "新增" }).last().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "費用" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "房屋" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^按揭本金$/ }).first().click();
await page.waitForTimeout(400);
const seedForm = await shot("qa14-seed-split");
console.log("seed split", seedForm.includes("分拆本金"));

console.log("\nPAGE ERRORS", []);
await browser.close();
