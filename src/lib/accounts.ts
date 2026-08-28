import type { Account, AccountGroup } from "./types";

export function accountsInGroup(accounts: Account[], group: AccountGroup): Account[] {
  return accounts
    .filter((a) => a.group === group)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

export function nextSortOrder(accounts: Account[], group: AccountGroup): number {
  const rows = accountsInGroup(accounts, group);
  return rows.length ? Math.max(...rows.map((a) => a.sortOrder ?? 0)) + 1 : 0;
}

export function defaultMortgageAccountId(accounts: Account[]): string | undefined {
  const loan = accounts.find((a) => a.type === "mortgage" && !a.hidden) ?? accounts.find((a) => a.type === "loan" && !a.hidden);
  return loan?.id;
}
