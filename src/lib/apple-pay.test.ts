import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseApplePayText } from "./apple-pay.ts";
import type { Account, Category } from "./types.ts";

const accounts: Account[] = [
  { id: "hsbc-red", name: "HSBC Red", nameZh: "滙豐 Red 信用卡", type: "credit", currency: "HKD", balance: 0, includeInNetWorth: true, group: "credit", sortOrder: 1 },
  { id: "scb-cathay", name: "SCB Cathay MC", nameZh: "國泰萬事達卡", type: "credit", currency: "HKD", balance: 0, includeInNetWorth: true, group: "credit", sortOrder: 2 },
  { id: "cash", name: "Cash", nameZh: "現金", type: "cash", currency: "HKD", balance: 0, includeInNetWorth: true, group: "cash", sortOrder: 0 },
];
const cats: Category[] = [
  { id: "dining", name: "Dining", nameZh: "外出就餐", kind: "expense", icon: "utensils", theme: "living" },
  { id: "hotels", name: "Hotels", nameZh: "酒店", kind: "expense", icon: "building", theme: "travel" },
  { id: "internet", name: "Internet / mobile", nameZh: "寬頻 / 流動電話", kind: "expense", icon: "wifi", theme: "living" },
];

describe("parseApplePayText", () => {
  it("reads amount, merchant, date and card from a Wallet receipt", () => {
    const text = `
HK$443.60
Ocean Park 22219, 香港南朗山
5/9/2026 下午 7:09
狀態：已批核
HSBC Red Credit Card 滙豐 Red 信用卡
總計 HK$443.60
Ocean Park 22219
`;
    const row = parseApplePayText(text, accounts, cats);
    assert.ok(row);
    assert.equal(row!.amount, 443.6);
    assert.equal(row!.payee, "Ocean Park 22219, 香港南朗山");
    assert.equal(row!.date, "2026-09-05");
    assert.equal(row!.time, "19:09");
    const hotpot = parseApplePayText(`
HK$2,404.00
樓下火鍋飯店, 九龍尖沙咀
4/9/2026 下午 9:45
狀態：已批核
HSBC Red Credit Card 滙豐 Red 信用卡
總計 HK$2,404.00
DON DON DONKI
樓下火鍋飯店
`, accounts, cats);
    assert.equal(hotpot?.amount, 2404);
    assert.equal(hotpot?.payee.includes("樓下火鍋飯店"), true);
    assert.equal(hotpot?.date, "2026-09-04");
    assert.equal(hotpot?.categoryId, "dining");
    const scb = parseApplePayText(`
支賬
HKD 176.00
由
國泰萬事達卡
*4901
2026年9月4日
交易詳情
簡述
HEADLAND HOTEL HK INT' NT HK
商戶類別
Service Providers - Lodging - Hotels, Motels, and Resorts
服務業 - 住宿服務（酒店、旅館、度假村等）
`, accounts, cats);
    assert.equal(scb?.amount, 176);
    assert.equal(scb?.payee.includes("HEADLAND HOTEL"), true);
    assert.equal(scb?.date, "2026-09-04");
    assert.equal(scb?.accountId, "scb-cathay");
    assert.equal(scb?.categoryId, "hotels");
    const tel = parseApplePayText(`
HKD 139.00
國泰萬事達卡
*4901
2026年8月31日
簡述
HUTCHISON TEL-AUTOPAY TSING YI HK
商戶類別
Utilities - Telecommunication Equipment
電訊及公用事業
`, accounts, cats);
    assert.equal(tel?.amount, 139);
    assert.equal(tel?.payee.includes("HUTCHISON"), true);
    assert.equal(tel?.date, "2026-08-31");
    const messy = parseApplePayText(`
支賬 HKD 176.00
由 國泰萬事達卡 *4901
2026年9月4日
交易詳情
简述
HEADLAND HOTEL HK INT' NT HK
商戶類別 Lodging Hotels
`, accounts, cats);
    assert.equal(messy?.payee, "HEADLAND HOTEL HK INT' NT HK");
  });
});
