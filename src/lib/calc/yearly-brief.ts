import type { YearlyMonthRow } from "./deposits.ts";

export type YearlyBrief = {
  asOf: string;
  year: number;
  monthCap: number;
  yearIncome: number;
  yearExpense: number;
  yearSaving: number;
  asOfIncome: number;
  asOfExpense: number;
  asOfSaving: number;
  rows: YearlyMonthRow[];
  locale?: "en" | "zh-HK";
};

function hkd(n: number): string {
  return String(Math.round(n * 100) / 100);
}

const MONTHS_ZH = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function renderYearlyBriefMarkdown(b: YearlyBrief): string {
  const zh = b.locale === "zh-HK";
  const months = zh ? MONTHS_ZH : MONTHS_EN;
  const lines = zh
    ? [
        `# 年度推算 ${b.year}`,
        ``,
        `- 截至：${b.asOf}`,
        `- 貨幣：港元`,
        `- 推算全年收入：${hkd(b.yearIncome)}`,
        `- 推算全年開支：${hkd(b.yearExpense)}`,
        `- 推算全年儲蓄：${hkd(b.yearSaving)}`,
        `- 已入帳收入（至今）：${hkd(b.asOfIncome)}`,
        `- 至今開支（可含本月上限）：${hkd(b.asOfExpense)}`,
        `- 至今結餘：${hkd(b.asOfSaving)}`,
        `- 本月開支上限：${b.monthCap > 0 ? hkd(b.monthCap) : "未設"}`,
        ``,
        `已過月份用已入帳交易。本月會加上未入帳嘅定期收入，以及尚未入帳嘅存款利息。之後月份係呢頁填嘅數字。若設咗本月上限，本月開支跟上限而唔係手填。`,
        ``,
        `| 月份 | 薪金 | 其他收入 | 存款利息 | 開支 | 結餘 | 收入基礎 | 開支基礎 |`,
        `| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |`,
      ]
    : [
        `# Yearly projection ${b.year}`,
        ``,
        `- As of: ${b.asOf}`,
        `- Currency: HKD`,
        `- Projected full-year income: ${hkd(b.yearIncome)}`,
        `- Projected full-year expense: ${hkd(b.yearExpense)}`,
        `- Projected full-year left: ${hkd(b.yearSaving)}`,
        `- Posted income to date: ${hkd(b.asOfIncome)}`,
        `- Expense to date (may include month cap): ${hkd(b.asOfExpense)}`,
        `- Balance to date: ${hkd(b.asOfSaving)}`,
        `- Current-month spending cap: ${b.monthCap > 0 ? hkd(b.monthCap) : "not set"}`,
        ``,
        `Past months use posted transactions. The current month adds regular income that is not yet posted, and deposit interest that is not already in those transactions. Later months are the figures entered on this page, not money already received or spent. If a spending cap is set, the current month uses that cap instead of a typed expense.`,
        ``,
        `| Month | Salary | Other income | Deposit interest | Expense | Left | Income basis | Expense basis |`,
        `| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |`,
      ];
  for (const row of b.rows) {
    const incomeBasis = zh
      ? row.fromLedger
        ? "已入帳"
        : row.isCurrent
          ? "已入帳＋未到"
          : "推算"
      : row.fromLedger
        ? "posted"
        : row.isCurrent
          ? "posted plus upcoming"
          : "planned";
    const expenseBasis = zh
      ? row.fromLedger
        ? "已入帳"
        : row.isCurrent
          ? b.monthCap > 0
            ? "預算上限"
            : "推算"
          : "推算"
      : row.fromLedger
        ? "posted"
        : row.isCurrent
          ? b.monthCap > 0
            ? "spending cap"
            : "planned"
          : "planned";
    const label = `${months[row.month0]}${row.isCurrent ? (zh ? "（本月）" : " (current)") : ""}`;
    lines.push(
      `| ${label} | ${hkd(row.salary)} | ${hkd(row.other)} | ${hkd(row.depInt)} | ${hkd(row.expense)} | ${hkd(row.saving)} | ${incomeBasis} | ${expenseBasis} |`,
    );
  }
  lines.push(``);
  return lines.join("\n");
}
