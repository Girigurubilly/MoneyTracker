import type { Category, CategorySpecial } from "./types.ts";

function compactHay(s: string): string {
  return s.toLowerCase().replace(/[\s\-_/]/g, "");
}

function mortgageLeaf(c: Category): string {
  return compactHay(`${c.name} ${c.nameZh}`);
}

function heuristicHousingGroup(c: Category): boolean {
  if (c.parentId) return false;
  return c.id === "p-housing" || /房屋|housing|居住/.test(`${c.name} ${c.nameZh}`);
}

function heuristicTax(c: Category): boolean {
  return /稅|tax/i.test(`${c.id} ${c.name} ${c.nameZh}`);
}

function heuristicSpecial(c: Category, categories: Category[]): CategorySpecial {
  if (c.kind === "income") return "none";
  const hay = mortgageLeaf(c);
  const en = compactHay(c.name);
  const zh = compactHay(c.nameZh);
  const shortPrincipal = /^(本金|principal)$/.test(en) || /^(本金|principal)$/.test(zh);
  const shortInterest = /^(利息|interest)$/.test(en) || /^(利息|interest)$/.test(zh);
  if (/按揭本金|mortgageprincipal/.test(hay) || (c.parentId && shortPrincipal)) return "mortgagePrincipal";
  const incomeLike = /收入|income/.test(hay);
  if (!incomeLike) {
    if (/按揭利息|mortgageinterest/.test(hay) || (c.parentId && shortInterest)) return "mortgageInterest";
  }
  if (heuristicHousingGroup(c)) return "housing";
  if (!incomeLike && /按揭|mortgage/.test(hay)) return "mortgageSplit";
  const parent = categories.find((x) => x.id === c.parentId);
  if (parent && /按揭|mortgage/.test(mortgageLeaf(parent))) return "mortgageSplit";
  if (parent && heuristicHousingGroup(parent) && (shortPrincipal || shortInterest)) {
    return shortPrincipal ? "mortgagePrincipal" : "mortgageInterest";
  }
  return "none";
}

export function resolvedSpecial(c: Category, categories: Category[] = []): CategorySpecial {
  if (c.special) return c.special;
  return heuristicSpecial(c, categories);
}

export function isTaxCategory(c: Category): boolean {
  if (c.tax === true) return true;
  if (c.tax === false) return false;
  return heuristicTax(c);
}

export function taxCategoryIds(categories: Category[]): Set<string> {
  const ids = new Set<string>();
  for (const c of categories) {
    if (isTaxCategory(c)) ids.add(c.id);
  }
  for (const c of categories) {
    if (c.parentId && ids.has(c.parentId) && c.tax !== false) ids.add(c.id);
  }
  return ids;
}

export function isHousingGroup(c: Category): boolean {
  if (c.parentId) return false;
  return resolvedSpecial(c) === "housing";
}

export function housingParentId(categories: Category[]): string | undefined {
  return categories.find((c) => isHousingGroup(c))?.id;
}

export function isMortgagePrincipalCategory(c: Category): boolean {
  return resolvedSpecial(c) === "mortgagePrincipal";
}

export function isMortgageInterestCategory(c: Category): boolean {
  return resolvedSpecial(c) === "mortgageInterest";
}

/** True when a seed mortgage leaf should be inserted. Never if that id already exists. */
export function missingMortgageLeaf(categories: Category[], kind: "principal" | "interest"): boolean {
  const match = kind === "principal" ? isMortgagePrincipalCategory : isMortgageInterestCategory;
  if (categories.some(match)) return false;
  const id = kind === "principal" ? "mortgage-p" : "mortgage-i";
  return !categories.some((c) => c.id === id);
}

export function isMortgageSplitCategory(c: Category | undefined, categories: Category[] = []): boolean {
  if (!c) return false;
  const s = resolvedSpecial(c, categories);
  return s === "mortgagePrincipal" || s === "mortgageInterest" || s === "mortgageSplit";
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
  const s = resolvedSpecial(c, categories);
  if (s === "mortgagePrincipal") return "principal";
  if (s === "mortgageInterest") return "interest";
  if (s === "mortgageSplit") return "split";
  return null;
}

export function isHousingCategory(c: Category, categories: Category[]): boolean {
  if (c.special === "none") return false;
  const s = resolvedSpecial(c, categories);
  if (s === "housing" || s === "mortgagePrincipal" || s === "mortgageInterest" || s === "mortgageSplit") return true;
  if (c.parentId) {
    const parent = categories.find((x) => x.id === c.parentId);
    if (parent && isHousingGroup(parent)) return true;
  }
  return false;
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
