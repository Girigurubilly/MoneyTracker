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
};

function hkd(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function renderYearlyBriefMarkdown(b: YearlyBrief): string {
  const lines = [
    `# Yearly projection ${b.year}`,
    ``,
    `- As of: ${b.asOf}`,
    `- Currency: HKD`,
    `- Full-year income: ${hkd(b.yearIncome)}`,
    `- Full-year expense: ${hkd(b.yearExpense)}`,
    `- Full-year left: ${hkd(b.yearSaving)}`,
    `- Income through the current month: ${hkd(b.asOfIncome)}`,
    `- Expense through the current month: ${hkd(b.asOfExpense)}`,
    `- Left through the current month: ${hkd(b.asOfSaving)}`,
    `- Current-month spending cap: ${b.monthCap > 0 ? hkd(b.monthCap) : "not set"}`,
    ``,
    `Past months use posted transactions. The current month adds regular income that is not yet posted, and deposit interest that is not already in those transactions. Later months are the figures entered on this page, not money already received or spent. If a spending cap is set, the current month uses that cap instead of a typed expense.`,
    ``,
    `| Month | Salary | Other income | Deposit interest | Expense | Left | Income basis | Expense basis |`,
    `| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |`,
  ];
  for (const row of b.rows) {
    const incomeBasis = row.fromLedger ? "posted" : row.isCurrent ? "posted plus upcoming" : "planned";
    const expenseBasis = row.fromLedger ? "posted" : row.isCurrent ? (b.monthCap > 0 ? "spending cap" : "planned") : "planned";
    lines.push(
      `| ${row.id}${row.isCurrent ? " (current)" : ""} | ${hkd(row.salary)} | ${hkd(row.other)} | ${hkd(row.depInt)} | ${hkd(row.expense)} | ${hkd(row.saving)} | ${incomeBasis} | ${expenseBasis} |`,
    );
  }
  lines.push(``);
  return lines.join("\n");
}
