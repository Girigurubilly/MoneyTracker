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

/** Prefer an existing mortgage / loan account as the 本金 transfer destination. */
export function defaultMortgageAccountId(
  accounts: Account[],
  preferred?: string,
  linkedMortgageId?: string,
): string | undefined {
  const isLoanLike = (id?: string) => {
    if (!id) return false;
    const a = accounts.find((x) => x.id === id);
    return Boolean(a && (a.type === "mortgage" || a.type === "loan"));
  };
  if (isLoanLike(linkedMortgageId)) return linkedMortgageId;
  if (isLoanLike(preferred)) return preferred;
  const vis = accounts.filter((a) => !a.hidden);
  return (
    vis.find((a) => a.type === "mortgage")?.id ??
    accounts.find((a) => a.type === "mortgage")?.id ??
    vis.find((a) => a.type === "loan")?.id ??
    (preferred && accounts.some((a) => a.id === preferred) ? preferred : undefined)
  );
}
