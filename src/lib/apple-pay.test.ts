import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseApplePayText } from "./apple-pay.ts";
import type { Account, Category } from "./types.ts";

const accounts: Account[] = [
  { id: "hsbc-red", name: "HSBC Red", nameZh: "滙豐 Red 信用卡", type: "credit", currency: "HKD", balance: 0, includeInNetWorth: true, group: "credit", sortOrder: 1 },
  { id: "cash", name: "Cash", nameZh: "現金", type: "cash", currency: "HKD", balance: 0, includeInNetWorth: true, group: "cash", sortOrder: 0 },
];
const cats: Category[] = [
  { id: "dining", name: "Dining", nameZh: "外出就餐", kind: "expense", icon: "utensils", theme: "living" },
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
    assert.equal(row!.accountId, "hsbc-red");
  });
});
