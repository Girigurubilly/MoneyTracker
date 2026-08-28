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
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

await page.getByRole("link", { name: "更多" }).click();
await page.waitForTimeout(300);
if ((await page.getByText("載入示範資料").count()) > 0) {
  await page.getByText("載入示範資料").click();
  await page.waitForTimeout(1400);
}

await page.getByRole("link", { name: "今天" }).click();
await page.waitForTimeout(400);
const beforeToday = await shot("qa15-today-before");
const beforeExpense = (beforeToday.match(/本月支出\s*([\d,]+)/) || [])[1];
console.log("expense before", beforeExpense);

await page.getByRole("link", { name: "預算" }).click();
await page.waitForTimeout(400);
await shot("qa15-budget");

await page.getByRole("button", { name: "新增定期項目" }).click();
await page.waitForTimeout(400);
const editor0 = await shot("qa15-reg-empty");
console.log("has kind", editor0.includes("費用"));

const nameInput = page.locator("input").first();
await nameInput.fill("測試按揭分拆");
const catSelect = page.locator("select").nth(2);
await catSelect.selectOption({ label: "按揭利息" });
await page.waitForTimeout(300);
const editorSplit = await shot("qa15-reg-split");
console.log("split toggle", editorSplit.includes("分拆本金"));
console.log("split hint", editorSplit.includes("本金以轉帳"));
console.log("mortgage dest", editorSplit.includes("按揭帳戶"));
console.log("principal field", editorSplit.includes("本金") && editorSplit.includes("利息"));

const moneyInputs = page.locator('input[inputmode="decimal"]');
await moneyInputs.nth(0).fill("9600");
await moneyInputs.nth(1).fill("4980");
await page.getByRole("button", { name: "儲存" }).click();
await page.waitForTimeout(800);
const afterSave = await shot("qa15-reg-list");
console.log("principal row", afterSave.includes("測試按揭分拆 · 本金") || afterSave.includes("本金"));
console.log("interest row", afterSave.includes("測試按揭分拆 · 利息") || afterSave.includes("利息"));
console.log("transfer badge", afterSave.includes("轉帳"));
console.log("counts principal as transfer", afterSave.includes("轉帳 · 本金") || afterSave.includes("轉帳"));

await page.getByRole("link", { name: "今天" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "新增" }).last().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "費用" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "房屋" }).click();
await page.waitForTimeout(300);
const sub = await shot("qa15-subs");
console.log("has 按揭本金", sub.includes("按揭本金"));
await page.getByRole("button", { name: /^按揭本金$/ }).first().click();
await page.waitForTimeout(400);
const form = await shot("qa15-add-split");
console.log("add split", form.includes("分拆本金"));
console.log("add dest", form.includes("按揭帳戶"));
console.log("add hint", form.includes("本金以轉帳"));

const splitInputs = page.locator('input[inputmode="decimal"]');
await splitInputs.nth(0).fill("1000");
await splitInputs.nth(1).fill("200");
await page.getByRole("button", { name: "儲存" }).click();
await page.waitForTimeout(800);
const afterAdd = await shot("qa15-today-after");
console.log("posted principal", afterAdd.includes("按揭本金") || afterAdd.includes("Mortgage principal"));
console.log("posted interest", afterAdd.includes("按揭利息") || afterAdd.includes("Mortgage interest"));
const afterExpense = (afterAdd.match(/本月支出\s*([\d,]+)/) || [])[1];
console.log("expense after", afterExpense, "before", beforeExpense);

await browser.close();
