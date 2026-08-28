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
  console.log("\n==", name, "==\n", text.slice(0, 1500));
  return text;
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("link", { name: "更多" }).click();
await page.waitForTimeout(300);
if ((await page.getByText("載入示範資料").count()) > 0) {
  await page.getByText("載入示範資料").click();
  await page.waitForTimeout(1000);
}

await page.evaluate(async () => {
  await new Promise((resolve, reject) => {
    const req = indexedDB.open("hk-life-money-v1");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("categories", "readwrite");
      const store = tx.objectStore("categories");
      store.delete("mortgage-p");
      store.delete("mortgage-i");
      store.put({
        id: "cat-user-p",
        name: "按揭本金",
        nameZh: "按揭本金",
        theme: "living",
        kind: "expense",
        icon: "home",
      });
      store.put({
        id: "cat-user-i",
        name: "按揭利息",
        nameZh: "按揭利息",
        theme: "living",
        kind: "expense",
        icon: "home",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

await page.getByRole("link", { name: "預算", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "新增定期項目" }).click();
await page.waitForTimeout(400);
await page.locator("label").filter({ hasText: "分類（選填）" }).getByRole("button").click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "房屋", exact: true }).click();
await page.waitForTimeout(400);
const subs = await shot("qa17-subs");
console.log("user 按揭本金 in 房屋", subs.includes("按揭本金"));
console.log("user 按揭利息 in 房屋", subs.includes("按揭利息"));

await page.getByRole("button", { name: /^按揭本金$/ }).first().click();
await page.waitForTimeout(500);
const principalForm = await shot("qa17-principal");
console.log("split after 按揭本金", principalForm.includes("分拆本金"));
console.log("principal/interest fields", principalForm.includes("本金") && principalForm.includes("利息"));
console.log("path 按揭本金", /房屋\s*·\s*按揭本金/.test(principalForm) || principalForm.includes("按揭本金"));

await page.locator("label").filter({ hasText: "分類（選填）" }).getByRole("button").click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "房屋", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^按揭利息$/ }).first().click();
await page.waitForTimeout(500);
const interestForm = await shot("qa17-interest");
console.log("split after 按揭利息", interestForm.includes("分拆本金"));
console.log("path 按揭利息", interestForm.includes("按揭利息"));

await browser.close();
