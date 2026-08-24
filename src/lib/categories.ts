import type { Category, CategoryIconName } from "@/lib/types";

export function parentCategoryName(name: string): string {
  return splitCategoryLabel(name).group;
}

export function childLabel(name: string): string {
  const split = splitCategoryLabel(name);
  return split.sub ?? split.group;
}

/** Collapse “X X”, “X: Y X: Y”, and leftover doubled BTP labels. */
export function collapseRepeatedLabel(raw: string): string {
  let s = (raw ?? "").replace(/：/g, ":").replace(/\s+/g, " ").trim();
  if (!s) return "";
  for (let i = 0; i < 8; i++) {
    const whole = s.match(/^(.+?)(?:\s+\1)+$/);
    if (whole) {
      s = whole[1].trim();
      continue;
    }
    break;
  }
  const samePairs = s.match(/^([^:]+:\s*.+?)(?:\s+\1)+$/);
  if (samePairs) s = samePairs[1].trim();
  const colons = [...s.matchAll(/:/g)];
  if (colons.length >= 2) {
    const group = s.slice(0, colons[0].index).trim();
    const after = s.slice(colons[0].index + 1);
    const marker = ` ${group}:`;
    const cut = after.indexOf(marker);
    const child = (cut >= 0 ? after.slice(0, cut) : after.split(":")[0]).trim();
    s = child ? `${group}: ${child}` : group;
  }
  return s;
}

export function splitCategoryLabel(name: string): { group: string; sub?: string } {
  const s = collapseRepeatedLabel(name);
  const i = s.indexOf(":");
  if (i > 0) {
    const group = s.slice(0, i).trim();
    const sub = s.slice(i + 1).trim();
    if (group && sub) return { group, sub };
  }
  return { group: s };
}

function normKey(s: string): string {
  return collapseRepeatedLabel(s).toLowerCase();
}

export function topLevelCategories(categories: Category[], kind?: Category["kind"]): Category[] {
  return pickerGroups(categories, kind).map((g) => g.parent);
}

export function childrenOf(categories: Category[], parentId: string): Category[] {
  const group = pickerGroups(categories).find((g) => g.parent.id === parentId);
  if (group) return group.children;
  return categories.filter((c) => c.parentId === parentId);
}

export type PickerGroup = {
  key: string;
  parent: Category;
  children: Category[];
};

function uniqueByName(rows: Category[]): Category[] {
  const seen = new Set<string>();
  const out: Category[] = [];
  for (const c of rows) {
    const k = normKey(c.nameZh || c.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function leafName(c: Category): string {
  const split = splitCategoryLabel(c.nameZh || c.name);
  return split.sub || split.group;
}

/** Unique main groups for the add picker. Colon “main: sub” rows become children, never extra mains. */
export function pickerGroups(categories: Category[], kind?: Category["kind"]): PickerGroup[] {
  const rows = kind ? categories.filter((c) => c.kind === kind) : categories;
  const byId = new Map(rows.map((c) => [c.id, c]));
  const buckets = new Map<string, { label: string; parent?: Category; children: Category[] }>();

  function bucket(name: string) {
    const key = normKey(name);
    let b = buckets.get(key);
    if (!b) {
      b = { label: collapseRepeatedLabel(name), children: [] };
      buckets.set(key, b);
    }
    return b;
  }

  for (const c of rows) {
    const split = splitCategoryLabel(c.nameZh || c.name);
    const linked = c.parentId ? byId.get(c.parentId) : undefined;
    if (linked) {
      const g = bucket(linked.nameZh || linked.name);
      if (!g.parent) g.parent = linked;
      const leaf = leafName(c);
      if (normKey(leaf) !== normKey(linked.nameZh || linked.name)) {
        g.children.push({ ...c, name: leaf, nameZh: leaf });
      }
      continue;
    }
    if (split.sub) {
      const g = bucket(split.group);
      g.children.push({ ...c, name: split.sub, nameZh: split.sub });
      continue;
    }
    const g = bucket(split.group);
    if (!g.parent) {
      g.parent = {
        ...c,
        name: collapseRepeatedLabel(c.name),
        nameZh: collapseRepeatedLabel(c.nameZh),
      };
    }
  }

  const out: PickerGroup[] = [];
  for (const [key, b] of buckets) {
    const children = uniqueByName(b.children);
    const parent =
      b.parent ??
      (children[0]
        ? {
            ...children[0],
            id: children[0].parentId || children[0].id,
            name: b.label,
            nameZh: b.label,
            parentId: undefined,
          }
        : undefined);
    if (!parent) continue;
    out.push({ key, parent, children });
  }
  return out;
}

export function displayCategoryName(cat: Category, locale: "en" | "zh-HK"): string {
  return locale === "zh-HK" ? cat.nameZh : cat.name;
}

export function categoryPath(categories: Category[], cat: Category, locale: "en" | "zh-HK"): string {
  const self = displayCategoryName(cat, locale);
  const split = splitCategoryLabel(self);
  if (cat.parentId) {
    const parent = categories.find((c) => c.id === cat.parentId);
    if (parent) return `${displayCategoryName(parent, locale)} · ${split.sub ?? split.group}`;
  }
  if (split.sub) return `${split.group} · ${split.sub}`;
  return split.group;
}

const ICON_TINT: Record<CategoryIconName, { fg: string; bg: string }> = {
  utensils: { fg: "var(--cat-orange)", bg: "var(--cat-orange-soft)" },
  shopping: { fg: "var(--cat-rose)", bg: "var(--cat-rose-soft)" },
  train: { fg: "var(--cat-teal)", bg: "var(--cat-teal-soft)" },
  car: { fg: "var(--cat-teal)", bg: "var(--cat-teal-soft)" },
  home: { fg: "var(--cat-amber)", bg: "var(--cat-amber-soft)" },
  wrench: { fg: "var(--cat-slate)", bg: "var(--cat-slate-soft)" },
  zap: { fg: "var(--cat-amber)", bg: "var(--cat-amber-soft)" },
  wifi: { fg: "var(--cat-sky)", bg: "var(--cat-sky-soft)" },
  heart: { fg: "var(--cat-green)", bg: "var(--cat-green-soft)" },
  shield: { fg: "var(--cat-green)", bg: "var(--cat-green-soft)" },
  graduation: { fg: "var(--cat-teal)", bg: "var(--cat-teal-soft)" },
  film: { fg: "var(--cat-amber)", bg: "var(--cat-amber-soft)" },
  sparkles: { fg: "var(--cat-rose)", bg: "var(--cat-rose-soft)" },
  plane: { fg: "var(--cat-sky)", bg: "var(--cat-sky-soft)" },
  building: { fg: "var(--cat-orange)", bg: "var(--cat-orange-soft)" },
  map: { fg: "var(--cat-teal)", bg: "var(--cat-teal-soft)" },
  ticket: { fg: "var(--cat-violet)", bg: "var(--cat-violet-soft)" },
  umbrella: { fg: "var(--cat-sky)", bg: "var(--cat-sky-soft)" },
  bag: { fg: "var(--cat-rose)", bg: "var(--cat-rose-soft)" },
  landmark: { fg: "var(--cat-green)", bg: "var(--cat-green-soft)" },
  piggy: { fg: "var(--cat-green)", bg: "var(--cat-green-soft)" },
  repeat: { fg: "var(--cat-slate)", bg: "var(--cat-slate-soft)" },
  wallet: { fg: "var(--cat-sky)", bg: "var(--cat-sky-soft)" },
  gift: { fg: "var(--cat-orange)", bg: "var(--cat-orange-soft)" },
  coins: { fg: "var(--cat-amber)", bg: "var(--cat-amber-soft)" },
  trending: { fg: "var(--cat-teal)", bg: "var(--cat-teal-soft)" },
  briefcase: { fg: "var(--cat-sky)", bg: "var(--cat-sky-soft)" },
  gamepad: { fg: "var(--cat-violet)", bg: "var(--cat-violet-soft)" },
  user: { fg: "var(--cat-orange)", bg: "var(--cat-orange-soft)" },
  broom: { fg: "var(--cat-slate)", bg: "var(--cat-slate-soft)" },
  tent: { fg: "var(--cat-teal)", bg: "var(--cat-teal-soft)" },
  cup: { fg: "var(--cat-amber)", bg: "var(--cat-amber-soft)" },
  book: { fg: "var(--cat-teal)", bg: "var(--cat-teal-soft)" },
  file: { fg: "var(--cat-slate)", bg: "var(--cat-slate-soft)" },
  clock: { fg: "var(--cat-sky)", bg: "var(--cat-sky-soft)" },
  dollar: { fg: "var(--cat-green)", bg: "var(--cat-green-soft)" },
};

export function categoryTint(icon?: CategoryIconName): { fg: string; bg: string } {
  return (icon && ICON_TINT[icon]) || ICON_TINT.wallet;
}
