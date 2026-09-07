import type { Account, AccountGroup } from "./types";

export const BALANCE_GROUP_ORDER: AccountGroup[] = ["cash", "credit", "assets", "housing", "loyalty"];

export function accountsInGroup(accounts: Account[], group: AccountGroup): Account[] {
  return accounts
    .filter((a) => a.group === group)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

export function accountsInBalanceOrder(accounts: Account[]): Account[] {
  return BALANCE_GROUP_ORDER.flatMap((group) => accountsInGroup(accounts, group));
}

export const KID_ACCOUNT_GROUPS: AccountGroup[] = ["cash", "credit"];

export function isKidVisibleAccount(a: Account): boolean {
  if (a.currency === "MILES" || a.type === "miles") return false;
  if (a.group === "assets" || a.group === "housing" || a.group === "loyalty") return false;
  if (a.type === "investment" || a.type === "mpf" || a.type === "property" || a.type === "mortgage" || a.type === "loan") return false;
  return a.group === "cash" || a.group === "credit" || a.type === "fx" || a.type === "credit" || a.type === "debit";
}

export function moneyAccountsForPicker(accounts: Account[], opts?: { includeId?: string; kid?: boolean }): Account[] {
  return accountsInBalanceOrder(accounts).filter((a) => {
    if (opts?.includeId && a.id === opts.includeId) return true;
    if (a.hidden) return false;
    if (a.currency === "MILES") return false;
    if (opts?.kid && !isKidVisibleAccount(a)) return false;
    return true;
  });
}

export function nextSortOrder(accounts: Account[], group: AccountGroup): number {
  const rows = accountsInGroup(accounts, group);
  return rows.length ? Math.max(...rows.map((a) => a.sortOrder ?? 0)) + 1 : 0;
}

export function defaultMortgageAccountId(accounts: Account[]): string | undefined {
  const loan = accounts.find((a) => a.type === "mortgage" && !a.hidden) ?? accounts.find((a) => a.type === "loan" && !a.hidden);
  return loan?.id;
}
