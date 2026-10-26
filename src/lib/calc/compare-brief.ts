import type { PeriodTab, YearCompareRow } from "./period.ts";

export type CompareBriefGroup = {
  name: string;
  rows: YearCompareRow[];
};

function hkd(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function pct(row: YearCompareRow): string {
  if (row.pct == null) return row.thisYear > 0 ? "n/a" : "0%";
  return `${row.pct >= 0 ? "+" : ""}${Math.round(row.pct * 100)}%`;
}

function table(rows: YearCompareRow[]): string[] {
  const lines = [`| Category | This period | Last period | Change | Percent |`, `| --- | ---: | ---: | ---: | ---: |`];
  for (const row of rows) {
    const name = row.name.replace(/\|/g, "/");
    lines.push(`| ${name} | ${hkd(row.thisYear)} | ${hkd(row.lastYear)} | ${hkd(row.delta)} | ${pct(row)} |`);
  }
  if (!rows.length) lines.push(`| none | 0 | 0 | 0 | 0% |`);
  return lines;
}

export function renderYearCompareMarkdown(input: {
  asOf: string;
  mode: "same-stage" | "full-last-year" | "projected-year";
  kind: PeriodTab;
  groupedByParent: boolean;
  focus?: string;
  thisFrom: string;
  thisTo: string;
  lastFrom: string;
  lastTo: string;
  thisTotal: number;
  lastTotal: number;
  rows: YearCompareRow[];
  groups?: CompareBriefGroup[];
}): string {
  const change = input.thisTotal - input.lastTotal;
  const lines = [
    `# This year against last year`,
    ``,
    `- As of: ${input.asOf}`,
    `- Currency: HKD`,
    `- Kind: ${input.kind}`,
    `- Comparison: ${input.mode === "same-stage" ? "same dates last year" : input.mode === "full-last-year" ? "all of last year" : "full-year projection vs last year"}`,
    `- Grouping: ${input.focus ? `subcategories of ${input.focus}` : input.groupedByParent ? "parent categories" : "categories as posted"}`,
    `- This period: ${input.thisFrom} to ${input.thisTo}`,
    `- Last period: ${input.lastFrom} to ${input.lastTo}`,
    `- This period total: ${hkd(input.thisTotal)}`,
    `- Last period total: ${hkd(input.lastTotal)}`,
    `- Change: ${hkd(change)}`,
    ``,
    input.mode === "projected-year"
      ? `This side uses the Yearly projection (posted months + planned salary, schedule other income, deposit interest, expected spend). Last year is posted only. A positive change means the projected year is higher than last year.`
      : `Posted transactions only. Planned rows are excluded. A positive change means this period is higher than the last period. Subcategory tables are the parts of a parent, not an extra total.`,
    ``,
    ...table(input.rows),
    ``,
  ];
  for (const group of input.groups ?? []) {
    lines.push(`## ${group.name}`, ``, ...table(group.rows), ``);
  }
  return lines.join("\n");
}
