import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseOctopusText } from "./octopus.ts";
import type { Category } from "./types.ts";

const cats: Category[] = [
  { id: "dining", name: "Dining", nameZh: "外出就餐", kind: "expense", icon: "utensils", theme: "living" },
  { id: "mtr", name: "MTR / bus", nameZh: "港鐵 / 巴士", kind: "expense", icon: "train", theme: "living" },
];

describe("parseOctopusText", () => {
  it("reads expense and top-up rows from a screenshot dump", () => {
    const text = `
交易紀錄
餐飲/會所
2026-09-05 20:41
-42.0
港鐵
2026-09-05 20:37
-11.8
港鐵
2026-09-04 08:33
0.0
八達通卡有限公司
2026-09-03 13:21
+500.0
百佳
2026-09-03 20:38
-11.4
`;
    const rows = parseOctopusText(text, cats);
    assert.equal(rows.length, 4);
    assert.equal(rows[0].merchant.includes("餐飲"), true);
    assert.equal(rows[0].amount, 42);
    assert.equal(rows[0].kind, "expense");
    assert.equal(rows[0].categoryId, "dining");
    assert.equal(rows[1].categoryId, "mtr");
    const inline = parseOctopusText("港鐵\n2026-09-05 20:37 -11.8", cats);
    assert.equal(inline[0]?.amount, 11.8);
    const unicode = parseOctopusText("太興\n2026-09-03 20:29\n−214.0", cats);
    assert.equal(unicode[0]?.amount, 214);
  });
});
