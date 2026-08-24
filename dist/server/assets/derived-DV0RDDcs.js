import { A as inMonth, W as todayISO, c as asOfForMonth, d as dailySpendable, k as cashflowSide, l as budgetActuals, m as monthFlow, x as toHkd } from "./app-C4vqMmxY.js";
import { o as parentCategoryName } from "./categories-8l-AiUYm.js";
//#region src/lib/derived.ts
function activityDates(txs) {
	const set = /* @__PURE__ */ new Set();
	for (const tx of txs) if (!tx.planned) set.add(tx.date);
	return set;
}
function monthKeysBack(fromMonth, n) {
	const [y, m] = fromMonth.split("-").map(Number);
	const out = [];
	for (let i = n - 1; i >= 0; i--) {
		const d = new Date(y, m - 1 - i, 1);
		out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
	}
	return out;
}
function monthKeysForward(fromMonth, n) {
	const [y, m] = fromMonth.split("-").map(Number);
	const out = [];
	for (let i = 0; i < n; i++) {
		const d = new Date(y, m - 1 + i, 1);
		out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
	}
	return out;
}
function monthLabel(month, locale) {
	const n = Number(month.slice(5));
	if (locale === "zh-HK") return `${n}月`;
	return [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec"
	][n - 1] ?? month;
}
function lastMonthsFlow(txs, rates, fromMonth, n, locale) {
	return monthKeysBack(fromMonth, n).map((key) => {
		const flow = monthFlow(txs, key, rates);
		return {
			month: monthLabel(key, locale),
			income: flow.income,
			expense: flow.expense
		};
	});
}
function categorySpend(txs, rates, month, categories) {
	const map = /* @__PURE__ */ new Map();
	for (const tx of txs) {
		if (cashflowSide(tx) !== "expense" || !inMonth(tx.date, month)) continue;
		const id = tx.categoryId ?? "other";
		map.set(id, (map.get(id) ?? 0) + Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd)));
	}
	return [...map.entries()].map(([id, value]) => {
		const cat = categories.find((c) => c.id === id);
		return {
			id,
			name: cat?.name ?? id,
			nameZh: cat?.nameZh ?? id,
			value
		};
	}).sort((a, b) => b.value - a.value);
}
function amountInMonth(r, month) {
	if (r.frequency === "monthly") return r.amount;
	if (r.frequency === "weekly") return r.amount * 4;
	if (r.frequency === "quarterly") {
		const m = Number(month.slice(5));
		return [
			1,
			4,
			7,
			10
		].includes(m) ? r.amount : 0;
	}
	if (r.frequency === "yearly") return r.nextDate.slice(5, 7) === month.slice(5) ? r.amount : 0;
	return 0;
}
function forecastFromRecurring(recurring, fromMonth, n, locale) {
	return monthKeysForward(fromMonth, n).map((key) => {
		let inflow = 0;
		let outflow = 0;
		for (const r of recurring) {
			const amt = amountInMonth(r, key);
			if (!amt) continue;
			if (r.type === "income") inflow += amt;
			else if (r.type === "expense") outflow += amt;
		}
		return {
			month: monthLabel(key, locale),
			inflow,
			outflow
		};
	});
}
function rangeFlow(txs, rates, from, to) {
	let income = 0;
	let expense = 0;
	for (const tx of txs) {
		if (tx.date < from || tx.date > to) continue;
		const side = cashflowSide(tx);
		const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
		if (side === "income") income += hkd;
		if (side === "expense") expense += hkd;
	}
	return {
		income,
		expense,
		net: income - expense
	};
}
function rangeCategorySpend(txs, rates, categories, from, to, kind) {
	const map = /* @__PURE__ */ new Map();
	for (const tx of txs) {
		if (tx.date < from || tx.date > to) continue;
		if (cashflowSide(tx) !== kind) continue;
		const id = tx.categoryId ?? "_none";
		map.set(id, (map.get(id) ?? 0) + Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd)));
	}
	return [...map.entries()].map(([id, value]) => {
		if (id === "_none") return {
			id,
			name: "Uncategorised",
			nameZh: "未分類",
			value
		};
		const cat = categories.find((c) => c.id === id);
		return {
			id,
			name: cat?.name ?? id,
			nameZh: cat?.nameZh ?? id,
			value
		};
	}).sort((a, b) => b.value - a.value);
}
function groupSpendByParent(rows, categories = []) {
	const map = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const cat = categories.find((c) => c.id === row.id);
		const parent = cat?.parentId ? categories.find((c) => c.id === cat.parentId) : void 0;
		const name = parent?.name ?? parentCategoryName(row.name);
		const nameZh = parent?.nameZh ?? parentCategoryName(row.nameZh);
		const id = parent?.id ?? `p-${nameZh || name}`;
		const prev = map.get(id);
		if (prev) prev.value += row.value;
		else map.set(id, {
			id,
			name,
			nameZh,
			value: row.value
		});
	}
	return [...map.values()].sort((a, b) => b.value - a.value);
}
function lastDayOfMonth(ym) {
	const [y, m] = ym.split("-").map(Number);
	const d = new Date(y, m, 0).getDate();
	return `${ym}-${String(d).padStart(2, "0")}`;
}
function presetRange(preset, today, txs, custom) {
	const y = Number(today.slice(0, 4));
	const m = Number(today.slice(5, 7));
	if (preset === "thisMonth") {
		const key = today.slice(0, 7);
		return {
			from: `${key}-01`,
			to: lastDayOfMonth(key)
		};
	}
	if (preset === "lastMonth") {
		const d = new Date(y, m - 2, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		return {
			from: `${key}-01`,
			to: lastDayOfMonth(key)
		};
	}
	if (preset === "thisYear") return {
		from: `${y}-01-01`,
		to: `${y}-12-31`
	};
	if (preset === "lastYear") return {
		from: `${y - 1}-01-01`,
		to: `${y - 1}-12-31`
	};
	if (preset === "allTime") {
		if (!txs.length) return {
			from: today,
			to: today
		};
		let min = txs[0].date;
		let max = txs[0].date;
		for (const tx of txs) {
			if (tx.date < min) min = tx.date;
			if (tx.date > max) max = tx.date;
		}
		return {
			from: min,
			to: max
		};
	}
	return {
		from: custom?.from || today,
		to: custom?.to || today
	};
}
function withOtherCategory(rows, other, limit = 8) {
	if (rows.length <= limit) return rows;
	const head = rows.slice(0, limit);
	const rest = rows.slice(limit).reduce((s, r) => s + r.value, 0);
	return [...head, {
		id: "_other",
		name: other.name,
		nameZh: other.nameZh,
		value: rest
	}];
}
function monthStats(txs, budgets, categories, rates, isoDate, recurring = []) {
	const month = isoDate.slice(0, 7);
	const flow = monthFlow(txs, month, rates);
	const asOf = asOfForMonth(month, todayISO());
	const actuals = budgetActuals(budgets, txs, month, rates, categories, recurring, asOf);
	const total = actuals.find((b) => !b.categoryId && !b.theme && b.monthly > 0);
	const remainingBudget = total ? total.remaining : actuals.reduce((s, b) => s + b.remaining, 0);
	const essential = new Set(categories.filter((c) => c.essential).map((c) => c.id));
	const remainingDisc = total ? total.remaining : actuals.filter((b) => !b.categoryId || !essential.has(b.categoryId)).reduce((s, b) => s + b.remaining, 0);
	return {
		month,
		flow,
		actuals,
		remainingBudget,
		remainingDisc,
		daily: dailySpendable(remainingDisc, asOf)
	};
}
function csvEscape(value) {
	if (/[",\n]/.test(value)) return `"${value.replaceAll("\"", "\"\"")}"`;
	return value;
}
function transactionsToCsv(txs) {
	return ["date,amount,currency,type,account,toAccount,category,payee,note,tripId", ...txs.map((tx) => [
		tx.date,
		String(tx.type === "expense" ? -Math.abs(tx.amount) : tx.amount),
		tx.currency,
		tx.type,
		tx.accountId,
		tx.toAccountId ?? "",
		tx.categoryId ?? "",
		csvEscape(tx.payee),
		csvEscape(tx.note ?? ""),
		tx.tripId ?? ""
	].join(","))].join("\n");
}
//#endregion
export { lastMonthsFlow as a, rangeCategorySpend as c, withOtherCategory as d, groupSpendByParent as i, rangeFlow as l, categorySpend as n, monthStats as o, forecastFromRecurring as r, presetRange as s, activityDates as t, transactionsToCsv as u };
