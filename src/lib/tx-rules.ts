import { defaultMortgageAccountId } from "./accounts.ts";
import { housingCategoryIds } from "./calc/housing.ts";
import { mortgageEntryKind, type MortgageEntryKind } from "./categories.ts";
import type { Account, Category, TxType } from "./types.ts";

export type TxRuleFields = {
  type: TxType;
  amount: number;
  accountId: string;
  toAccountId?: string;
  destAmount?: number;
  categoryId?: string;
  countsAsExpense?: boolean;
  housing?: boolean;
};

export function infersHousing(categoryId: string | undefined, categories: Category[]): boolean {
  if (!categoryId) return false;
  const cat = categories.find((c) => c.id === categoryId);
  if (mortgageEntryKind(cat, categories)) return true;
  return housingCategoryIds(categories).has(categoryId);
}

export function applyTxRules<T extends TxRuleFields>(
  draft: T,
  ctx: { categories: Category[]; accounts: Account[] },
): T & TxRuleFields {
  const cat = ctx.categories.find((c) => c.id === draft.categoryId);
  const kind = mortgageEntryKind(cat, ctx.categories);
  const housing =
    draft.housing === false
      ? false
      : draft.housing === true
        ? true
        : infersHousing(draft.categoryId, ctx.categories)
          ? true
          : undefined;

  let next: T & TxRuleFields = { ...draft, housing };

  if (kind === "principal" && (draft.type === "expense" || draft.type === "transfer")) {
    const dest = draft.toAccountId || defaultMortgageAccountId(ctx.accounts);
    return {
      ...next,
      type: "transfer",
      countsAsExpense: true,
      toAccountId: dest,
      destAmount: draft.destAmount != null ? draft.destAmount : Math.abs(draft.amount),
      housing: draft.housing === false ? false : true,
    };
  }

  if (kind === "interest" && draft.type !== "income") {
    next = { ...next, housing: draft.housing === false ? false : true };
  }

  if (next.type !== "transfer") {
    return { ...next, toAccountId: undefined, destAmount: undefined, countsAsExpense: undefined };
  }

  return { ...next, destAmount: next.destAmount ?? Math.abs(next.amount) };
}

export function splitMortgageAmounts(
  principalRaw: string,
  interestRaw: string,
  totalRaw: string,
  prefer?: MortgageEntryKind | null,
): { principal: number; interest: number } {
  const total = Number(totalRaw) || 0;
  let principal = Number(principalRaw) || 0;
  let interest = Number(interestRaw) || 0;
  if (principal > 0 && interest <= 0 && total > principal) {
    interest = Math.round((total - principal + Number.EPSILON) * 100) / 100;
  } else if (interest > 0 && principal <= 0 && total > interest) {
    principal = Math.round((total - interest + Number.EPSILON) * 100) / 100;
  } else if (principal <= 0 && interest <= 0 && total > 0) {
    if (prefer === "interest") interest = total;
    else principal = total;
  }
  return { principal, interest };
}
