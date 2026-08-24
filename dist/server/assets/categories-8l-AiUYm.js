//#region src/lib/categories.ts
function parentCategoryName(name) {
	return splitCategoryLabel(name).group;
}
function childLabel(name) {
	const split = splitCategoryLabel(name);
	return split.sub ?? split.group;
}
/** Collapse “X X”, “X: Y X: Y”, and leftover doubled BTP labels. */
function collapseRepeatedLabel(raw) {
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
function splitCategoryLabel(name) {
	const s = collapseRepeatedLabel(name);
	const i = s.indexOf(":");
	if (i > 0) {
		const group = s.slice(0, i).trim();
		const sub = s.slice(i + 1).trim();
		if (group && sub) return {
			group,
			sub
		};
	}
	return { group: s };
}
function normKey(s) {
	return collapseRepeatedLabel(s).toLowerCase();
}
function uniqueByName(rows) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const c of rows) {
		const k = normKey(c.nameZh || c.name);
		if (!k || seen.has(k)) continue;
		seen.add(k);
		out.push(c);
	}
	return out;
}
function leafName(c) {
	const split = splitCategoryLabel(c.nameZh || c.name);
	return split.sub || split.group;
}
/** Unique main groups for the add picker. Colon “main: sub” rows become children, never extra mains. */
function pickerGroups(categories, kind) {
	const rows = kind ? categories.filter((c) => c.kind === kind) : categories;
	const byId = new Map(rows.map((c) => [c.id, c]));
	const buckets = /* @__PURE__ */ new Map();
	function bucket(name) {
		const key = normKey(name);
		let b = buckets.get(key);
		if (!b) {
			b = {
				label: collapseRepeatedLabel(name),
				children: []
			};
			buckets.set(key, b);
		}
		return b;
	}
	for (const c of rows) {
		const split = splitCategoryLabel(c.nameZh || c.name);
		const linked = c.parentId ? byId.get(c.parentId) : void 0;
		if (linked) {
			const g = bucket(linked.nameZh || linked.name);
			if (!g.parent) g.parent = linked;
			const leaf = leafName(c);
			if (normKey(leaf) !== normKey(linked.nameZh || linked.name)) g.children.push({
				...c,
				name: leaf,
				nameZh: leaf
			});
			continue;
		}
		if (split.sub) {
			bucket(split.group).children.push({
				...c,
				name: split.sub,
				nameZh: split.sub
			});
			continue;
		}
		const g = bucket(split.group);
		if (!g.parent) g.parent = {
			...c,
			name: collapseRepeatedLabel(c.name),
			nameZh: collapseRepeatedLabel(c.nameZh)
		};
	}
	const out = [];
	for (const [key, b] of buckets) {
		const children = uniqueByName(b.children);
		const parent = b.parent ?? (children[0] ? {
			...children[0],
			id: children[0].parentId || children[0].id,
			name: b.label,
			nameZh: b.label,
			parentId: void 0
		} : void 0);
		if (!parent) continue;
		out.push({
			key,
			parent,
			children
		});
	}
	return out;
}
function displayCategoryName(cat, locale) {
	return locale === "zh-HK" ? cat.nameZh : cat.name;
}
function categoryPath(categories, cat, locale) {
	const split = splitCategoryLabel(displayCategoryName(cat, locale));
	if (cat.parentId) {
		const parent = categories.find((c) => c.id === cat.parentId);
		if (parent) return `${displayCategoryName(parent, locale)} · ${split.sub ?? split.group}`;
	}
	if (split.sub) return `${split.group} · ${split.sub}`;
	return split.group;
}
var ICON_TINT = {
	utensils: {
		fg: "var(--cat-orange)",
		bg: "var(--cat-orange-soft)"
	},
	shopping: {
		fg: "var(--cat-rose)",
		bg: "var(--cat-rose-soft)"
	},
	train: {
		fg: "var(--cat-teal)",
		bg: "var(--cat-teal-soft)"
	},
	car: {
		fg: "var(--cat-teal)",
		bg: "var(--cat-teal-soft)"
	},
	home: {
		fg: "var(--cat-amber)",
		bg: "var(--cat-amber-soft)"
	},
	wrench: {
		fg: "var(--cat-slate)",
		bg: "var(--cat-slate-soft)"
	},
	zap: {
		fg: "var(--cat-amber)",
		bg: "var(--cat-amber-soft)"
	},
	wifi: {
		fg: "var(--cat-sky)",
		bg: "var(--cat-sky-soft)"
	},
	heart: {
		fg: "var(--cat-green)",
		bg: "var(--cat-green-soft)"
	},
	shield: {
		fg: "var(--cat-green)",
		bg: "var(--cat-green-soft)"
	},
	graduation: {
		fg: "var(--cat-teal)",
		bg: "var(--cat-teal-soft)"
	},
	film: {
		fg: "var(--cat-amber)",
		bg: "var(--cat-amber-soft)"
	},
	sparkles: {
		fg: "var(--cat-rose)",
		bg: "var(--cat-rose-soft)"
	},
	plane: {
		fg: "var(--cat-sky)",
		bg: "var(--cat-sky-soft)"
	},
	building: {
		fg: "var(--cat-orange)",
		bg: "var(--cat-orange-soft)"
	},
	map: {
		fg: "var(--cat-teal)",
		bg: "var(--cat-teal-soft)"
	},
	ticket: {
		fg: "var(--cat-violet)",
		bg: "var(--cat-violet-soft)"
	},
	umbrella: {
		fg: "var(--cat-sky)",
		bg: "var(--cat-sky-soft)"
	},
	bag: {
		fg: "var(--cat-rose)",
		bg: "var(--cat-rose-soft)"
	},
	landmark: {
		fg: "var(--cat-green)",
		bg: "var(--cat-green-soft)"
	},
	piggy: {
		fg: "var(--cat-green)",
		bg: "var(--cat-green-soft)"
	},
	repeat: {
		fg: "var(--cat-slate)",
		bg: "var(--cat-slate-soft)"
	},
	wallet: {
		fg: "var(--cat-sky)",
		bg: "var(--cat-sky-soft)"
	},
	gift: {
		fg: "var(--cat-orange)",
		bg: "var(--cat-orange-soft)"
	},
	coins: {
		fg: "var(--cat-amber)",
		bg: "var(--cat-amber-soft)"
	},
	trending: {
		fg: "var(--cat-teal)",
		bg: "var(--cat-teal-soft)"
	},
	briefcase: {
		fg: "var(--cat-sky)",
		bg: "var(--cat-sky-soft)"
	},
	gamepad: {
		fg: "var(--cat-violet)",
		bg: "var(--cat-violet-soft)"
	},
	user: {
		fg: "var(--cat-orange)",
		bg: "var(--cat-orange-soft)"
	},
	broom: {
		fg: "var(--cat-slate)",
		bg: "var(--cat-slate-soft)"
	},
	tent: {
		fg: "var(--cat-teal)",
		bg: "var(--cat-teal-soft)"
	},
	cup: {
		fg: "var(--cat-amber)",
		bg: "var(--cat-amber-soft)"
	},
	book: {
		fg: "var(--cat-teal)",
		bg: "var(--cat-teal-soft)"
	},
	file: {
		fg: "var(--cat-slate)",
		bg: "var(--cat-slate-soft)"
	},
	clock: {
		fg: "var(--cat-sky)",
		bg: "var(--cat-sky-soft)"
	},
	dollar: {
		fg: "var(--cat-green)",
		bg: "var(--cat-green-soft)"
	}
};
function categoryTint(icon) {
	return icon && ICON_TINT[icon] || ICON_TINT.wallet;
}
//#endregion
export { displayCategoryName as a, collapseRepeatedLabel as i, categoryTint as n, parentCategoryName as o, childLabel as r, pickerGroups as s, categoryPath as t };
