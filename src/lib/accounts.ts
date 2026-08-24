import type { Account, AccountGroup, AccountType, CategoryIconName } from "@/lib/types";

export const ACCOUNT_GROUPS: AccountGroup[] = ["cash", "credit", "assets", "housing", "loyalty"];

export function iconForAccountType(type: AccountType): CategoryIconName {
  if (type === "miles") return "plane";
  if (type === "property" || type === "mortgage") return "home";
  if (type === "mpf") return "shield";
  if (type === "investment") return "trending";
  if (type === "credit") return "wallet";
  if (type === "ewallet") return "repeat";
  return "landmark";
}

export function accountsInGroup(
  accounts: Account[],
  group: AccountGroup,
  opts?: { includeHidden?: boolean },
): Account[] {
  return accounts
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.group === group && (opts?.includeHidden || !a.hidden))
    .sort((x, y) => {
      const ao = x.a.sortOrder ?? x.i;
      const bo = y.a.sortOrder ?? y.i;
      if (ao !== bo) return ao - bo;
      return x.a.name.localeCompare(y.a.name);
    })
    .map(({ a }) => a);
}

export function nextSortOrder(accounts: Account[], group: AccountGroup): number {
  let max = -1;
  accounts.forEach((a, i) => {
    if (a.group !== group) return;
    const n = a.sortOrder ?? i;
    if (n > max) max = n;
  });
  return max + 1;
}
