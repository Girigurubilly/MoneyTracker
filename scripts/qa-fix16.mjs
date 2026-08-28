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
  console.log("\n==", name, "==\n", text.slice(0, 1600));
  return text;
}
async function closeSheet() {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.getByRole("link", { name: "更多" }).click();
await page.waitForTimeout(300);
if ((await page.getByText("載入示範資料").count()) > 0) {
  await page.getByText("載入示範資料").click();
  await page.waitForTimeout(1000);
}

await page.getByRole("link", { name: "分類與主題" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "新增分類" }).first().click();
await page.waitForTimeout(300);
await page.locator("input").first().fill("自訂按揭本金");
const parentSelect = page.locator("select").first();
const parentVal = await parentSelect.evaluate((el) => {
  const opt = [...el.options].find((o) => /房屋|housing/i.test(o.text));
  return opt?.value ?? "";
});
if (parentVal) await parentSelect.selectOption(parentVal);
await page.getByRole("button", { name: "儲存" }).click();
await page.waitForTimeout(600);

await page.getByRole("link", { name: "預算", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "新增定期項目" }).click();
await page.waitForTimeout(400);
await page.locator("label").filter({ hasText: "分類（選填）" }).getByRole("button").click();
await page.waitForTimeout(500);
const mains = await shot("qa16-mains");
console.log("housing main", mains.includes("房屋"));
console.log("custom as main", mains.includes("自訂按揭本金"));

if (mains.includes("自訂按揭本金") && !mains.includes("子分類")) {
  await page.getByRole("button", { name: /自訂按揭本金/ }).first().click();
} else {
  await page.getByRole("button", { name: "房屋", exact: true }).click();
  await page.waitForTimeout(400);
  const subs = await shot("qa16-subs");
  console.log("subs has custom", subs.includes("自訂按揭本金"));
  const customBtn = page.getByRole("button", { name: /自訂按揭本金/ });
  if (await customBtn.count()) await customBtn.first().click();
  else await page.getByRole("button", { name: /^按揭本金$/ }).first().click();
}
await page.waitForTimeout(500);
const form = await shot("qa16-split");
console.log("split toggle", form.includes("分拆本金"));
console.log("principal field", form.includes("本金") && form.includes("利息"));
console.log("mortgage dest", form.includes("按揭帳戶"));
console.log("picked path", form.includes("自訂按揭本金") || form.includes("按揭本金"));

await closeSheet();
await browser.close();
