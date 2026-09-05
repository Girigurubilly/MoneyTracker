import type { Category } from "./types.ts";

function compactHay(s: string): string {
  return s.toLowerCase().replace(/[\s\-_/]/g, "");
}

function mortgageLeaf(c: Category): string {
  return compactHay(`${c.name} ${c.nameZh}`);
}

export function isHousingGroup(c: Category): boolean {
  if (c.parentId) return false;
  return c.id === "p-housing" || /房屋|housing|居住/.test(`${c.name} ${c.nameZh}`);
}

export function housingParentId(categories: Category[]): string | undefined {
  return categories.find((c) => isHousingGroup(c))?.id;
}

export function isMortgagePrincipalCategory(c: Category): boolean {
  const hay = mortgageLeaf(c);
  if (/按揭本金|mortgageprincipal/.test(hay)) return true;
  if (c.parentId && /^(本金|principal)$/.test(hay)) return true;
  return false;
}

export function isMortgageInterestCategory(c: Category): boolean {
  const hay = mortgageLeaf(c);
  if (/收入|income/.test(hay)) return false;
  if (/按揭利息|mortgageinterest/.test(hay)) return true;
  if (c.parentId && /^(利息|interest)$/.test(hay)) return true;
  return false;
}

export function isMortgageSplitCategory(c: Category | undefined, categories: Category[]): boolean {
  if (!c) return false;
  if (isHousingGroup(c)) return false;
  if (isMortgagePrincipalCategory(c) || isMortgageInterestCategory(c)) return true;
  const hay = mortgageLeaf(c);
  if (/按揭|mortgage/.test(hay)) return true;
  const parent = categories.find((x) => x.id === c.parentId);
  if (parent && /按揭|mortgage/.test(mortgageLeaf(parent))) return true;
  if (parent && isHousingGroup(parent) && /^(本金|利息|principal|interest)$/.test(hay)) return true;
  return false;
}

export type MortgageEntryKind = "principal" | "interest" | "split" | null;

export function canSplitMortgage(kind: MortgageEntryKind): boolean {
  return kind === "principal" || kind === "interest" || kind === "split";
}

export function resolvedDefaultAccountId(c: Category | undefined | null, categories: Category[]): string | undefined {
  if (!c) return undefined;
  if (c.defaultAccountId) return c.defaultAccountId;
  if (!c.parentId) return undefined;
  return categories.find((x) => x.id === c.parentId)?.defaultAccountId;
}

export function mortgageEntryKind(c: Category | undefined | null, categories: Category[]): MortgageEntryKind {
  if (!c) return null;
  if (isHousingGroup(c)) return null;
  if (isMortgagePrincipalCategory(c)) return "principal";
  if (isMortgageInterestCategory(c)) return "interest";
  if (isMortgageSplitCategory(c, categories)) return "split";
  return null;
}

export function parentCategoryName(c: Category, categories: Category[], locale: "en" | "zh-HK"): string {
  const p = categories.find((x) => x.id === c.parentId);
  if (!p) return locale === "zh-HK" ? c.nameZh : c.name;
  return locale === "zh-HK" ? `${p.nameZh} · ${c.nameZh}` : `${p.name} · ${c.name}`;
}

export function categoryPath(c: Category, categories: Category[], locale: "en" | "zh-HK"): string {
  return parentCategoryName(c, categories, locale);
}

export function childLabel(raw: string): string {
  return collapseRepeatedLabel(raw);
}

export function collapseRepeatedLabel(raw: string): string {
  const t = raw.trim();
  const half = Math.floor(t.length / 2);
  if (t.length >= 4 && t.slice(0, half) === t.slice(half)) return t.slice(0, half);
  return t;
}

export function pickerGroups(categories: Category[]): { parent: Category; children: Category[] }[] {
  const parents = categories.filter((c) => !c.parentId || c.parentId === c.id);
  const housing = parents.find((c) => isHousingGroup(c));
  const groups: { parent: Category; children: Category[] }[] = [];
  for (const p of parents) {
    if (isMortgagePrincipalCategory(p) || isMortgageInterestCategory(p)) continue;
    const children = categories.filter((c) => c.parentId === p.id);
    groups.push({ parent: p, children });
  }
  if (housing) {
    const g = groups.find((x) => x.parent.id === housing.id);
    if (g) {
      for (const c of categories) {
        if (c.parentId === housing.id) continue;
        if (isMortgagePrincipalCategory(c) || isMortgageInterestCategory(c)) {
          if (!g.children.some((x) => x.id === c.id)) g.children.push(c);
        }
      }
    }
  }
  return groups;
}
