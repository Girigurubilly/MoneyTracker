import { a as publicUrl } from "./router-Des7-i-O.js";
import { a as Hairline, c as Overlay, d as ScreenHeader, g as cn, i as Group, n as CategoryGlyph, r as Disclaimer, u as Row } from "./shared-BTv0_jzi.js";
import { C as CATEGORY_ICONS, D as applyDeltas, F as useUi, K as pickName, O as balanceDeltas, P as useT, R as money, T as MONTH_TOTAL_BUDGET_ID, i as useApp, r as newId, w as CURRENCIES } from "./app-C4vqMmxY.js";
import { i as collapseRepeatedLabel, o as parentCategoryName, r as childLabel } from "./categories-8l-AiUYm.js";
import { u as transactionsToCsv } from "./derived-DV0RDDcs.js";
import { i as endMonthFromRemaining } from "./mortgage-Nd1TZLq0.js";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { Archive, Download, FolderTree, Globe, KeyRound, LayoutGrid, Lock, Plus, Repeat, Shield, SlidersHorizontal, Trash2, Upload, Wallet } from "lucide-react";
import { toast } from "sonner";
//#region src/lib/backup.ts
var SCHEMA = 1;
async function deriveKey(password, salt) {
	const enc = new TextEncoder();
	const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
	return crypto.subtle.deriveKey({
		name: "PBKDF2",
		salt,
		iterations: 12e4,
		hash: "SHA-256"
	}, base, {
		name: "AES-GCM",
		length: 256
	}, false, ["encrypt", "decrypt"]);
}
function b64(bytes) {
	let s = "";
	bytes.forEach((b) => {
		s += String.fromCharCode(b);
	});
	return btoa(s);
}
function fromB64(s) {
	const bin = atob(s);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}
async function encryptSnapshot(json, password) {
	const salt = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16));
	const iv = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(12));
	const key = await deriveKey(password, salt);
	const cipher = await crypto.subtle.encrypt({
		name: "AES-GCM",
		iv
	}, key, new TextEncoder().encode(json));
	return JSON.stringify({
		v: SCHEMA,
		alg: "AES-GCM",
		kdf: "PBKDF2-SHA256",
		salt: b64(salt),
		iv: b64(iv),
		data: b64(new Uint8Array(cipher))
	});
}
async function decryptSnapshot(payload, password) {
	const parsed = JSON.parse(payload);
	const key = await deriveKey(password, fromB64(parsed.salt));
	const plain = await crypto.subtle.decrypt({
		name: "AES-GCM",
		iv: fromB64(parsed.iv)
	}, key, fromB64(parsed.data));
	return new TextDecoder().decode(plain);
}
function downloadBlob(filename, text, mime = "application/json") {
	const blob = new Blob([text], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
function parseCsv(text) {
	const rows = [];
	let row = [];
	let cur = "";
	let q = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (q) {
			if (ch === "\"" && text[i + 1] === "\"") {
				cur += "\"";
				i++;
			} else if (ch === "\"") q = false;
			else cur += ch;
		} else if (ch === "\"") q = true;
		else if (ch === ",") {
			row.push(cur);
			cur = "";
		} else if (ch === "\n") {
			row.push(cur);
			rows.push(row);
			row = [];
			cur = "";
		} else if (ch !== "\r") cur += ch;
	}
	if (cur.length || row.length) {
		row.push(cur);
		rows.push(row);
	}
	return rows.filter((r) => r.some((c) => c.trim()));
}
//#endregion
//#region src/lib/import-btp.ts
function isBtpFile(data) {
	if (!data || typeof data !== "object") return false;
	const d = data;
	if (d.app === "Budget Tracker Pro") return true;
	return Array.isArray(d.ledger?.transactions) || Array.isArray(d.budget?.transactions);
}
function isAppSnapshot(data) {
	if (!data || typeof data !== "object") return false;
	const d = data;
	return Array.isArray(d.accounts) && Array.isArray(d.transactions) && Array.isArray(d.categories) && typeof d.schemaVersion === "number";
}
function cleanCategoryLabel(raw) {
	return collapseRepeatedLabel(raw);
}
function categoryIdFromLabel(label) {
	return `cat-${label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 48) || "uncat"}`;
}
function asCurrency(raw) {
	const c = raw.toUpperCase();
	return CURRENCIES.includes(c) ? c : "HKD";
}
function themeFor(label, kind) {
	if (kind === "income") {
		if (/利息|股息|年金|強積金|mpf/i.test(label)) return "retirement";
		return "other";
	}
	if (/^旅遊/.test(label) || /機票|酒店|住宿/.test(label)) return "travel";
	if (/儲蓄保險|強積金|退休/.test(label)) return "retirement";
	if (/住宅|家居|公用事業|家用|八達通|外出就餐|按揭|管理費|水電|寬頻/.test(label)) return "living";
	return "other";
}
function kindFor(label, txType) {
	if (txType === "income") return "income";
	if (/收入|工資|薪金|股息|贈與|租賃|經營/.test(label) && !/稅/.test(label)) return "income";
	if (/利是/.test(label) && /禮物/.test(label)) return "income";
	return "expense";
}
function iconFor(label, kind) {
	if (kind === "income") {
		if (/股息/.test(label)) return "coins";
		if (/利息/.test(label)) return "piggy";
		if (/工資|薪/.test(label)) return "briefcase";
		if (/贈|利是|禮物/.test(label)) return "gift";
		return "wallet";
	}
	if (/外出就餐|膳食|食物|咖啡/.test(label) && !/家居/.test(label)) return "utensils";
	if (/^八達通$/.test(label)) return "repeat";
	if (/購物|服裝|玩具|電器|攝影/.test(label)) return "bag";
	if (/八達通|交通|地面|港鐵|巴士/.test(label)) return "train";
	if (/空中|機票/.test(label)) return "plane";
	if (/^旅遊$/.test(label) || /旅遊:/.test(label)) return "plane";
	if (/住宿/.test(label)) return "tent";
	if (/酒店/.test(label)) return "building";
	if (/住宅|按揭|抵押|裝修/.test(label)) return "home";
	if (/債務/.test(label)) return "clock";
	if (/家居和食物/.test(label)) return "broom";
	if (/家庭和個人|剪髮|個人/.test(label)) return "user";
	if (/娛樂|電影|遊戲|Netflix|YouTube|Spotify|Disney/i.test(label)) return "gamepad";
	if (/稅|地租/.test(label)) return "landmark";
	if (/醫療|藥|寵物|驗身/.test(label)) return "heart";
	if (/電話|網際|寬頻|行動/.test(label)) return "wifi";
	if (/電氣|用水|天然氣|公用/.test(label)) return "zap";
	if (/學習|教育/.test(label)) return "graduation";
	if (/維護|修理/.test(label)) return "wrench";
	if (/入場/.test(label)) return "ticket";
	if (/保險/.test(label)) return "umbrella";
	if (/禮物/.test(label)) return "gift";
	if (/股票|投資/.test(label)) return "coins";
	if (/雜項/.test(label)) return "shopping";
	if (/管理費/.test(label)) return "building";
	if (/證件/.test(label)) return "file";
	if (/膳食/.test(label)) return "cup";
	return "wallet";
}
function accountType(a) {
	if (a.kind === "credit") return {
		type: "credit",
		group: "credit"
	};
	if (a.kind === "property") return {
		type: "property",
		group: "housing"
	};
	if (a.kind === "asset") return {
		type: "investment",
		group: "assets"
	};
	if (a.currency !== "HKD") return {
		type: "fx",
		group: "cash"
	};
	if (/cash|現金|利是|payme/i.test(a.name)) return {
		type: "cash",
		group: "cash"
	};
	return {
		type: "current",
		group: "cash"
	};
}
function parseArrowTarget(description, arrow) {
	const d = description ?? "";
	const i = d.lastIndexOf(arrow);
	if (i < 0) return "";
	return d.slice(i + arrow.length).trim();
}
function convertBtp(data) {
	const srcAccounts = data.ledger?.accounts?.length ? data.ledger.accounts : data.budget?.accounts ?? [];
	const rawTxs = data.ledger?.transactions?.length ? data.ledger.transactions : data.budget?.transactions ?? [];
	const asOf = (data.exportedAt ?? (/* @__PURE__ */ new Date()).toISOString()).slice(0, 10);
	const accounts = srcAccounts.map((a) => {
		const { type, group } = accountType(a);
		return {
			id: a.id,
			name: a.name,
			nameZh: a.name,
			type,
			currency: a.currency === "MILES" ? "MILES" : asCurrency(a.currency),
			balance: type === "property" ? a.balance : 0,
			includeInNetWorth: !a.hidden,
			hidden: Boolean(a.hidden),
			group,
			notes: a.hidden ? "Hidden in source" : void 0
		};
	});
	const byName = new Map(accounts.map((a) => [a.name, a]));
	for (const a of srcAccounts) if (a.kind === "property" && a.mortgage > 0) {
		const id = `${a.id}-mortgage`;
		if (!accounts.some((x) => x.id === id)) accounts.push({
			id,
			name: `${a.name} 按揭`,
			nameZh: `${a.name} 按揭`,
			type: "mortgage",
			currency: "HKD",
			balance: -Math.abs(a.mortgage),
			includeInNetWorth: true,
			group: "housing",
			institution: a.name
		});
	}
	const categories = /* @__PURE__ */ new Map();
	function ensureCat(label, txType) {
		const raw = cleanCategoryLabel(label);
		if (!raw) return void 0;
		const parentName = parentCategoryName(raw);
		const childName = childLabel(raw);
		const hasChild = Boolean(childName && parentName && childName !== raw);
		const kind = kindFor(raw, txType);
		let parentId;
		if (hasChild) {
			parentId = categoryIdFromLabel(parentName);
			if (!categories.has(parentId)) categories.set(parentId, {
				id: parentId,
				name: parentName,
				nameZh: parentName,
				theme: themeFor(parentName, kind),
				kind,
				icon: iconFor(parentName, kind),
				essential: /按揭|管理費|保險|公用|工資/.test(parentName)
			});
		}
		const id = categoryIdFromLabel(raw);
		if (!categories.has(id)) categories.set(id, {
			id,
			name: hasChild ? childName : raw,
			nameZh: hasChild ? childName : raw,
			theme: themeFor(raw, kind),
			kind,
			icon: iconFor(raw, kind),
			essential: /按揭|管理費|保險|公用|工資/.test(raw),
			parentId
		});
		return id;
	}
	const usedIncoming = /* @__PURE__ */ new Set();
	rawTxs.filter((t) => t.type === "transfer" && (t.description ?? "").includes("→"));
	const incoming = rawTxs.filter((t) => t.type === "transfer" && (t.description ?? "").includes("←"));
	function matchIncoming(out) {
		const toName = parseArrowTarget(out.description, "→");
		return incoming.find((inn) => !usedIncoming.has(inn.id) && inn.iso === out.iso && inn.currency === out.currency && Math.abs(inn.amountOriginal - out.amountOriginal) < .005 && (inn.account === toName || parseArrowTarget(inn.description, "←") === out.account));
	}
	const transactions = [];
	for (const t of rawTxs) {
		if (t.type === "transfer" && (t.description ?? "").includes("←")) continue;
		const from = byName.get(t.account);
		if (!from) continue;
		const currency = t.currency === "MILES" ? "MILES" : asCurrency(t.currency);
		const amount = Math.abs(t.amountOriginal);
		const fxToHkd = currency !== "HKD" && currency !== "MILES" && amount > 0 ? Math.abs(t.amountHKD) / amount : void 0;
		if (t.type === "transfer") {
			const inn = matchIncoming(t);
			if (inn) usedIncoming.add(inn.id);
			const toName = inn?.account || parseArrowTarget(t.description, "→");
			const to = toName ? byName.get(toName) : void 0;
			transactions.push({
				id: t.id,
				type: "transfer",
				amount,
				currency,
				accountId: from.id,
				toAccountId: to?.id,
				destAmount: to ? to.currency === currency ? amount : Math.abs(inn?.amountOriginal ?? amount) : void 0,
				date: t.iso,
				payee: toName ? `→ ${toName}` : t.description || "Transfer",
				payeeZh: toName ? `→ ${toName}` : t.description || "轉帳",
				note: t.description || void 0,
				fxToHkd
			});
			continue;
		}
		const type = t.type === "income" ? "income" : "expense";
		const categoryId = ensureCat(t.category, type);
		const payee = (t.description || "").replace(/^自動產生的交易\s*/, "").trim() || t.category || type;
		transactions.push({
			id: t.id,
			type,
			amount,
			currency,
			accountId: from.id,
			categoryId,
			date: t.iso,
			payee,
			payeeZh: payee,
			note: t.description || void 0,
			fxToHkd
		});
	}
	const catAccountCount = /* @__PURE__ */ new Map();
	for (const tx of transactions) {
		if (!tx.categoryId) continue;
		let m = catAccountCount.get(tx.categoryId);
		if (!m) {
			m = /* @__PURE__ */ new Map();
			catAccountCount.set(tx.categoryId, m);
		}
		m.set(tx.accountId, (m.get(tx.accountId) ?? 0) + 1);
	}
	for (const cat of categories.values()) {
		const m = catAccountCount.get(cat.id);
		if (!m) continue;
		let best = "";
		let n = 0;
		for (const [id, c] of m) if (c > n) {
			best = id;
			n = c;
		}
		if (best) cat.defaultAccountId = best;
	}
	let nextAccounts = accounts.map((a) => ({ ...a }));
	const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
	for (const tx of sorted) nextAccounts = applyDeltas(nextAccounts, balanceDeltas(tx));
	for (const src of srcAccounts) if (src.kind === "property") {
		nextAccounts = nextAccounts.map((a) => a.id === src.id ? {
			...a,
			balance: src.balance
		} : a);
		if (src.mortgage > 0) {
			const mid = `${src.id}-mortgage`;
			nextAccounts = nextAccounts.map((a) => a.id === mid ? {
				...a,
				balance: -Math.abs(src.mortgage)
			} : a);
		}
	}
	const ratesIn = data.ledger?.rates ?? data.budget?.rates ?? {};
	const fxRates = [{
		currency: "HKD",
		perHkd: 1,
		asOf,
		source: "Base"
	}];
	const flat = {};
	for (const [k, v] of Object.entries(ratesIn)) if (typeof v === "number") flat[k] = v;
	else if (v && typeof v === "object") Object.assign(flat, v);
	for (const c of CURRENCIES) {
		if (c === "HKD") continue;
		const perHkdUnit = flat[c];
		if (!perHkdUnit) continue;
		fxRates.push({
			currency: c,
			perHkd: 1 / perHkdUnit,
			asOf,
			source: "Budget Tracker Pro"
		});
	}
	const months = Object.keys(data.budget?.monthly ?? {}).sort();
	const latestMonth = months[months.length - 1];
	const monthlyCap = latestMonth ? data.budget?.monthly?.[latestMonth]?.budget ?? 0 : 0;
	const budgets = [{
		id: MONTH_TOTAL_BUDGET_ID,
		label: "Monthly total",
		labelZh: "本月總額",
		monthly: monthlyCap || 0,
		spent: 0
	}];
	const fallbackAccount = nextAccounts.find((a) => a.currency === "HKD" && a.type === "current")?.id ?? nextAccounts[0]?.id ?? "";
	const recurring = (data.budget?.regular ?? []).map((r) => {
		const day = String(Math.min(28, Math.max(1, r.day))).padStart(2, "0");
		const now = /* @__PURE__ */ new Date();
		let next = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${day}`;
		if (next < now.toISOString().slice(0, 10)) {
			const d = new Date(now.getFullYear(), now.getMonth() + 1, r.day);
			next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		}
		return {
			id: r.id,
			type: "expense",
			label: r.name,
			labelZh: r.name,
			amount: r.amount,
			currency: "HKD",
			accountId: fallbackAccount,
			frequency: "monthly",
			nextDate: next,
			chargedDay: Math.min(28, Math.max(1, r.day)),
			essential: /mortgage|parent|management|insurance|按揭|管理|保險/i.test(r.name),
			living: /mortgage|parent|management|按揭|管理費|差餉|地租|水電|家居保險|住宅/i.test(r.name)
		};
	});
	const property = srcAccounts.find((a) => a.kind === "property" && a.mortgage > 0);
	const mortgage = property ? [{
		id: "imported-mortgage",
		accountId: `${property.id}-mortgage`,
		propertyAccountId: property.id,
		lender: property.name,
		lenderZh: property.name,
		original: Math.abs(property.mortgage),
		outstanding: Math.abs(property.mortgage),
		remainingMonths: 216,
		endDate: endMonthFromRemaining(216),
		rateType: "P",
		benchmark: 5.25,
		adjustment: -3.15,
		effectiveRate: 2.1,
		monthlyPayment: data.budget?.regular?.find((r) => /mortgage|按揭/i.test(r.name))?.amount ?? 14155,
		paymentAccountId: fallbackAccount
	}] : [];
	const goals = [{
		id: "savings",
		name: "Savings",
		nameZh: "儲蓄",
		current: 0,
		target: data.ledger?.goal?.target ?? data.budget?.goal?.target ?? 1e6,
		currency: "HKD",
		change30: 0
	}];
	const travelBudget = (data.budget?.regular ?? []).filter((r) => /travel|旅遊/i.test(r.name)).reduce((s, r) => s + r.amount, 0) * 12 || 8e4;
	return {
		schemaVersion: 1,
		exportedAt: data.exportedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
		accounts: nextAccounts,
		categories: [...categories.values()],
		transactions,
		recurring,
		budgets,
		trips: [],
		goals,
		mortgage,
		retirement: [],
		allowances: [],
		oneOffs: [],
		fxRates,
		snapshots: [],
		annualTravelBudget: travelBudget
	};
}
//#endregion
//#region src/components/more.tsx
function MoreScreen() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const setLocale = useUi((s) => s.setLocale);
	const resetSample = useApp((s) => s.resetSample);
	const clearAll = useApp((s) => s.clearAll);
	const [confirm, setConfirm] = useState(false);
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.more.title,
				large: true
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 text-sm font-medium text-muted",
				children: t.more.setup
			}),
			/* @__PURE__ */ jsxs(Group, { children: [
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(FolderTree, { className: "size-4" }),
					title: t.more.categories,
					to: "/more/categories",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Repeat, { className: "size-4" }),
					title: t.more.recurring,
					to: "/more/recurring",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Wallet, { className: "size-4" }),
					title: t.more.budgets,
					to: "/budget",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Globe, { className: "size-4" }),
					title: t.more.fx,
					to: "/more/fx",
					chevron: true
				})
			] }),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
				children: t.more.data
			}),
			/* @__PURE__ */ jsxs(Group, { children: [
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Upload, { className: "size-4" }),
					title: t.more.import,
					to: "/more/import",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Archive, { className: "size-4" }),
					title: t.more.backup,
					to: "/more/backup",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Lock, { className: "size-4" }),
					title: t.more.security,
					to: "/more/security",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => void resetSample().then(() => toast(t.more.loaded)),
					className: "flex w-full items-center gap-3 px-5 py-3 text-left",
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid size-9 place-items-center rounded-[10px] bg-background text-foreground",
						children: /* @__PURE__ */ jsx(Download, { className: "size-4" })
					}), /* @__PURE__ */ jsx("span", {
						className: "flex-1 text-[15px]",
						children: t.more.resetSample
					})]
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => setConfirm(true),
					className: "flex w-full items-center gap-3 px-5 py-3 text-left",
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid size-9 place-items-center rounded-[10px] bg-background text-expense",
						children: /* @__PURE__ */ jsx(Trash2, { className: "size-4" })
					}), /* @__PURE__ */ jsx("span", {
						className: "flex-1 text-[15px] text-expense",
						children: t.more.clearAll
					})]
				})
			] }),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
				children: t.more.display
			}),
			/* @__PURE__ */ jsxs(Group, { children: [
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => setLocale(locale === "zh-HK" ? "en" : "zh-HK"),
					className: "flex w-full items-center gap-3 px-5 py-3 text-left",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "grid size-9 place-items-center rounded-[10px] bg-background text-foreground",
							children: /* @__PURE__ */ jsx(Globe, { className: "size-4" })
						}),
						/* @__PURE__ */ jsx("span", {
							className: "flex-1 text-[15px]",
							children: t.more.language
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-sm text-muted",
							children: locale === "zh-HK" ? "繁體中文" : "English"
						})
					]
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(SlidersHorizontal, { className: "size-4" }),
					title: t.more.preferences,
					to: "/more/preferences",
					chevron: true
				})
			] }),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
				children: t.more.about
			}),
			/* @__PURE__ */ jsxs(Group, { children: [
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(LayoutGrid, { className: "size-4" }),
					title: t.more.screens,
					to: "/more/screens",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(KeyRound, { className: "size-4" }),
					title: t.more.onboarding,
					to: "/onboarding",
					chevron: true
				})
			] }),
			/* @__PURE__ */ jsx(Disclaimer, { children: t.more.privacy }),
			/* @__PURE__ */ jsx(StorageFooter, {}),
			/* @__PURE__ */ jsx(Overlay, {
				open: confirm,
				onClose: () => setConfirm(false),
				title: t.more.clearAll,
				children: /* @__PURE__ */ jsxs("div", {
					className: "px-5 pb-8",
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-sm text-muted",
						children: t.more.confirmClear
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "mt-4 h-12 w-full rounded-xl bg-expense text-sm font-semibold text-on-accent",
						onClick: async () => {
							await clearAll();
							setConfirm(false);
							toast(t.more.cleared);
						},
						children: t.more.clearAll
					})]
				})
			})
		]
	});
}
function CategoriesPage() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const categories = useApp((s) => s.categories);
	const accounts = useApp((s) => s.accounts);
	const addCategory = useApp((s) => s.addCategory);
	const updateCategory = useApp((s) => s.updateCategory);
	const themes = [
		"living",
		"travel",
		"retirement",
		"other"
	];
	const [editing, setEditing] = useState(null);
	function accountName(id) {
		if (!id) return "";
		const a = accounts.find((x) => x.id === id);
		return a ? pickName(locale, a.name, a.nameZh) : "";
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.more.categories,
				backTo: "/more",
				right: /* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-label": t.more.addCategory,
					onClick: () => setEditing("new"),
					className: "grid size-11 place-items-center text-accent",
					children: /* @__PURE__ */ jsx(Plus, { className: "size-6" })
				})
			}),
			themes.map((theme) => {
				const themeRows = categories.filter((c) => c.theme === theme);
				if (!themeRows.length) return null;
				const ordered = themeRows.filter((c) => !c.parentId || !themeRows.some((p) => p.id === c.parentId)).flatMap((p) => [p, ...themeRows.filter((c) => c.parentId === p.id)]);
				return /* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("h2", {
						className: "px-5 pb-1 pt-4 text-sm font-medium text-muted",
						children: t.themes[theme]
					}),
					/* @__PURE__ */ jsx(Hairline, {}),
					ordered.map((c, i) => /* @__PURE__ */ jsxs("div", { children: [i > 0 ? /* @__PURE__ */ jsx(Hairline, {}) : null, /* @__PURE__ */ jsxs("button", {
						type: "button",
						className: cn("flex w-full items-center gap-3 px-5 py-3 text-left", c.parentId && "pl-10"),
						onClick: () => setEditing(c),
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "grid size-9 place-items-center rounded-full bg-elevated",
								children: /* @__PURE__ */ jsx(CategoryGlyph, { name: c.icon })
							}),
							/* @__PURE__ */ jsxs("span", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ jsx("span", {
									className: "block text-[15px]",
									children: pickName(locale, c.name, c.nameZh)
								}), c.defaultAccountId ? /* @__PURE__ */ jsx("span", {
									className: "block truncate text-xs text-muted",
									children: accountName(c.defaultAccountId)
								}) : null]
							}),
							/* @__PURE__ */ jsxs("span", {
								className: "text-xs text-muted",
								children: [c.kind === "income" ? t.add.income : t.add.expense, c.essential ? ` · ${t.budget.essential}` : ""]
							})
						]
					})] }, c.id))
				] }, theme);
			}),
			/* @__PURE__ */ jsx("div", {
				className: "px-5 pt-6",
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setEditing("new"),
					className: "h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
					children: t.more.addCategory
				})
			}),
			/* @__PURE__ */ jsx(CategoryEditor, {
				open: editing != null,
				initial: editing === "new" ? null : editing,
				onClose: () => setEditing(null),
				onSave: async (c) => {
					if (editing === "new") await addCategory(c);
					else await updateCategory(c);
					toast(t.add.savedToast);
					setEditing(null);
				}
			})
		]
	});
}
function CategoryEditor({ open, initial, onClose, onSave }) {
	const t = useT();
	return /* @__PURE__ */ jsx(Overlay, {
		open,
		onClose,
		title: initial ? t.more.editCategory : t.more.addCategory,
		children: open ? /* @__PURE__ */ jsx(CategoryEditorBody, {
			initial,
			onSave
		}, initial?.id ?? "new") : null
	});
}
function CategoryEditorBody({ initial, onSave }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const accounts = useApp((s) => s.accounts);
	const categories = useApp((s) => s.categories);
	const [name, setName] = useState(initial ? pickName(locale, initial.name, initial.nameZh) : "");
	const [theme, setTheme] = useState(initial?.theme ?? "living");
	const [kind, setKind] = useState(initial?.kind ?? "expense");
	const [icon, setIcon] = useState(initial?.icon ?? "wallet");
	const [accountId, setAccountId] = useState(initial?.defaultAccountId ?? "");
	const [parentId, setParentId] = useState(initial?.parentId ?? "");
	const moneyAccounts = accounts.filter((a) => a.currency !== "MILES");
	const parents = categories.filter((c) => c.kind === kind && !c.parentId && c.id !== initial?.id);
	return /* @__PURE__ */ jsxs("div", {
		className: "px-5 pb-8",
		children: [
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.assets.name
				}), /* @__PURE__ */ jsx("input", {
					value: name,
					onChange: (e) => setName(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.budget.byTheme
				}), /* @__PURE__ */ jsx("div", {
					className: "mt-2 grid grid-cols-2 gap-2",
					children: [
						"living",
						"travel",
						"retirement",
						"other"
					].map((th) => /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setTheme(th),
						className: cn("h-10 rounded-lg text-sm", theme === th ? "bg-accent text-on-accent" : "bg-elevated"),
						children: t.themes[th]
					}, th))
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.more.kind
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-2 grid grid-cols-2 gap-2",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setKind("expense"),
						className: cn("h-10 rounded-lg text-sm", kind === "expense" ? "bg-accent text-on-accent" : "bg-elevated"),
						children: t.add.expense
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setKind("income"),
						className: cn("h-10 rounded-lg text-sm", kind === "income" ? "bg-accent text-on-accent" : "bg-elevated"),
						children: t.add.income
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.more.icon
				}), /* @__PURE__ */ jsx("div", {
					className: "mt-2 grid grid-cols-7 gap-1",
					children: CATEGORY_ICONS.map((id) => /* @__PURE__ */ jsx("button", {
						type: "button",
						"aria-label": id,
						onClick: () => setIcon(id),
						className: cn("grid size-10 place-items-center rounded-lg", icon === id ? "bg-accent-soft text-accent" : "bg-elevated"),
						children: /* @__PURE__ */ jsx(CategoryGlyph, {
							name: id,
							className: "size-4"
						})
					}, id))
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.add.parentCategory
				}), /* @__PURE__ */ jsxs("select", {
					value: parentId,
					onChange: (e) => setParentId(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
					children: [/* @__PURE__ */ jsx("option", {
						value: "",
						children: t.common.none
					}), parents.map((c) => /* @__PURE__ */ jsx("option", {
						value: c.id,
						children: pickName(locale, c.name, c.nameZh)
					}, c.id))]
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: t.more.defaultAccount
					}),
					/* @__PURE__ */ jsxs("select", {
						value: accountId,
						onChange: (e) => setAccountId(e.target.value),
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
						children: [/* @__PURE__ */ jsx("option", {
							value: "",
							children: t.common.none
						}), moneyAccounts.map((a) => /* @__PURE__ */ jsx("option", {
							value: a.id,
							children: pickName(locale, a.name, a.nameZh)
						}, a.id))]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-1 text-[11px] text-faint",
						children: t.more.defaultAccountHint
					})
				]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
				onClick: async () => {
					const n = name.trim();
					if (!n) return;
					await onSave({
						id: initial?.id ?? `cat-${newId().slice(0, 8)}`,
						name: n,
						nameZh: n,
						theme,
						kind,
						icon,
						essential: initial?.essential,
						defaultAccountId: accountId || void 0,
						parentId: parentId || void 0
					});
				},
				children: t.common.save
			})
		]
	});
}
function RecurringPage() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const recurring = useApp((s) => s.recurring);
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.more.recurring,
				backTo: "/more"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "px-5 pb-3 text-xs text-muted",
				children: t.budget.regularsHint
			}),
			/* @__PURE__ */ jsx(Hairline, {}),
			recurring.map((r, i) => /* @__PURE__ */ jsxs("div", { children: [i > 0 ? /* @__PURE__ */ jsx(Hairline, {}) : null, /* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between px-5 py-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
					className: "text-[15px]",
					children: pickName(locale, r.label, r.labelZh)
				}), /* @__PURE__ */ jsxs("div", {
					className: "text-xs text-muted",
					children: [
						r.frequency,
						" · ",
						t.budget.chargedDay,
						" ",
						r.chargedDay ?? r.nextDate.slice(8, 10),
						r.essential ? ` · ${t.budget.essential}` : ""
					]
				})] }), /* @__PURE__ */ jsx("div", {
					className: cn("tabular-nums text-[15px]", r.type === "income" ? "text-income" : "text-foreground"),
					children: money(r.type === "expense" ? -r.amount : r.amount, r.currency, { sign: true })
				})]
			})] }, r.id)),
			/* @__PURE__ */ jsx("div", {
				className: "px-5 pt-4",
				children: /* @__PURE__ */ jsx(Link, {
					to: "/budget",
					className: "flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent",
					children: t.budget.addRegular
				})
			})
		]
	});
}
function FxPage() {
	const t = useT();
	const fxRates = useApp((s) => s.fxRates);
	const refresh = useApp((s) => s.refreshFx);
	const [busy, setBusy] = useState(false);
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.fx.title,
				backTo: "/more"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "px-5 text-xs text-muted",
				children: t.fx.indicative
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mt-3 divide-y divide-line",
				children: fxRates.filter((r) => r.currency !== "HKD").map((r) => /* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between px-5 py-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
						className: "text-[15px]",
						children: r.currency
					}), /* @__PURE__ */ jsxs("div", {
						className: "text-xs text-muted",
						children: [
							t.fx.asOf,
							" ",
							r.asOf,
							" · ",
							r.source
						]
					})] }), /* @__PURE__ */ jsx("div", {
						className: "tabular-nums text-[15px]",
						children: r.perHkd.toFixed(4)
					})]
				}, r.currency))
			}),
			/* @__PURE__ */ jsx("div", {
				className: "px-5 pt-4",
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: busy,
					onClick: async () => {
						setBusy(true);
						try {
							await refresh();
							toast(t.fx.refreshed);
						} catch {
							toast(t.fx.failed);
						} finally {
							setBusy(false);
						}
					},
					className: "h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60",
					children: t.fx.refresh
				})
			})
		]
	});
}
function ImportPage() {
	const t = useT();
	const accounts = useApp((s) => s.accounts);
	const categories = useApp((s) => s.categories);
	const addTx = useApp((s) => s.addTransaction);
	const exportSnap = useApp((s) => s.exportSnapshot);
	const replaceAll = useApp((s) => s.replaceAll);
	const txs = useApp((s) => s.transactions);
	const fileRef = useRef(null);
	const jsonRef = useRef(null);
	const [rows, setRows] = useState([]);
	const [busy, setBusy] = useState(false);
	const [confirm, setConfirm] = useState(null);
	function parseFile(text) {
		const parsed = parseCsv(text);
		setRows(parsed.slice(0, 51));
	}
	async function applyJson(source) {
		setBusy(true);
		const toastId = toast.loading(t.import.replacing);
		try {
			let data;
			if (source === "bundled") {
				const res = await fetch(publicUrl("imports/budget-tracker-pro.json"));
				if (!res.ok) throw new Error("fetch");
				data = await res.json();
			} else data = JSON.parse(await source.text());
			let snap;
			if (isBtpFile(data)) snap = convertBtp(data);
			else if (isAppSnapshot(data)) snap = data;
			else throw new Error("format");
			await replaceAll(snap);
			toast.success(`${t.import.btpDone} ${snap.transactions.length}`, { id: toastId });
		} catch {
			toast.error(t.import.btpFail, { id: toastId });
		} finally {
			setBusy(false);
			setConfirm(null);
		}
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.import.title,
				backTo: "/more"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "px-5 text-sm text-muted",
				children: t.import.btpHint
			}),
			/* @__PURE__ */ jsxs(Group, { children: [
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					disabled: busy,
					className: "flex w-full items-center gap-3 px-5 py-3 text-left disabled:opacity-60",
					onClick: () => setConfirm("bundled"),
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid size-9 place-items-center rounded-[10px] bg-background",
						children: /* @__PURE__ */ jsx(Archive, { className: "size-4" })
					}), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("span", {
						className: "block text-[15px]",
						children: t.import.btp
					}), /* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: "budget-tracker-pro.json"
					})] })]
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					disabled: busy,
					className: "flex w-full items-center gap-3 px-5 py-3 text-left disabled:opacity-60",
					onClick: () => jsonRef.current?.click(),
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid size-9 place-items-center rounded-[10px] bg-background",
						children: /* @__PURE__ */ jsx(Upload, { className: "size-4" })
					}), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("span", {
						className: "block text-[15px]",
						children: t.import.jsonIn
					}), /* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: t.import.chooseJson
					})] })]
				})
			] }),
			/* @__PURE__ */ jsx("input", {
				ref: jsonRef,
				type: "file",
				accept: "application/json,.json",
				className: "hidden",
				onChange: (e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					if (file) setConfirm(file);
				}
			}),
			/* @__PURE__ */ jsx("p", {
				className: "px-5 pt-6 text-sm text-muted",
				children: t.import.wizard
			}),
			/* @__PURE__ */ jsxs(Group, { children: [
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					className: "flex w-full items-center gap-3 px-5 py-3 text-left",
					onClick: () => fileRef.current?.click(),
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid size-9 place-items-center rounded-[10px] bg-background",
						children: /* @__PURE__ */ jsx(Upload, { className: "size-4" })
					}), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("span", {
						className: "block text-[15px]",
						children: t.import.csvIn
					}), /* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: "date, amount, currency, account, category, note"
					})] })]
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					className: "flex w-full items-center gap-3 px-5 py-3 text-left",
					onClick: () => {
						downloadBlob("hk-life-money.csv", transactionsToCsv(txs), "text/csv");
						toast(t.import.exported);
					},
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid size-9 place-items-center rounded-[10px] bg-background",
						children: /* @__PURE__ */ jsx(Download, { className: "size-4" })
					}), /* @__PURE__ */ jsx("span", {
						className: "text-[15px]",
						children: t.import.csvOut
					})]
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					className: "flex w-full items-center gap-3 px-5 py-3 text-left",
					onClick: () => {
						downloadBlob("hk-life-money.json", JSON.stringify(exportSnap(), null, 2));
						toast(t.import.exported);
					},
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid size-9 place-items-center rounded-[10px] bg-background",
						children: /* @__PURE__ */ jsx(Download, { className: "size-4" })
					}), /* @__PURE__ */ jsx("span", {
						className: "text-[15px]",
						children: t.import.jsonOut
					})]
				})
			] }),
			/* @__PURE__ */ jsx("input", {
				ref: fileRef,
				type: "file",
				accept: ".csv,text/csv",
				className: "hidden",
				onChange: async (e) => {
					const file = e.target.files?.[0];
					if (!file) return;
					parseFile(await file.text());
					e.target.value = "";
				}
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
				children: t.import.preview
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mx-4 overflow-x-auto rounded-xl bg-elevated",
				children: /* @__PURE__ */ jsxs("table", {
					className: "w-full min-w-[420px] text-left text-xs",
					children: [/* @__PURE__ */ jsx("thead", {
						className: "text-muted",
						children: /* @__PURE__ */ jsx("tr", { children: (rows[0] ?? [
							"date",
							"amount",
							"account",
							"note"
						]).slice(0, 4).map((h) => /* @__PURE__ */ jsx("th", {
							className: "px-3 py-2",
							children: h
						}, h)) })
					}), /* @__PURE__ */ jsx("tbody", { children: (rows.length > 1 ? rows.slice(1, 8) : []).map((r, i) => /* @__PURE__ */ jsx("tr", {
						className: "border-t border-line",
						children: r.slice(0, 4).map((c, j) => /* @__PURE__ */ jsx("td", {
							className: "px-3 py-2",
							children: c
						}, j))
					}, i)) })]
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "px-5 pt-4",
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: rows.length < 2 || busy,
					onClick: async () => {
						setBusy(true);
						const mapped = mapCsv(rows, accounts, categories);
						let n = 0;
						for (const tx of mapped.ok) {
							await addTx(tx);
							n += 1;
						}
						toast(`${t.import.committed} ${n} · ${mapped.skipped} ${t.import.skipped}`);
						setRows([]);
						setBusy(false);
					},
					className: "h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:bg-elevated disabled:text-muted",
					children: t.import.commit
				})
			}),
			/* @__PURE__ */ jsx(Overlay, {
				open: confirm != null,
				onClose: () => !busy && setConfirm(null),
				title: t.import.jsonIn,
				children: /* @__PURE__ */ jsxs("div", {
					className: "px-5 pb-8",
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-sm text-muted",
						children: t.import.confirmReplace
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						disabled: busy,
						className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60",
						onClick: () => confirm && void applyJson(confirm),
						children: busy ? t.import.replacing : t.import.commit
					})]
				})
			})
		]
	});
}
function mapCsv(rows, accounts, categories) {
	if (rows.length < 2) return {
		ok: [],
		skipped: 0
	};
	const header = rows[0].map((h) => h.trim().toLowerCase());
	const idx = (name) => header.indexOf(name);
	const iDate = idx("date");
	const iAmt = idx("amount");
	const iCur = idx("currency");
	const iType = idx("type");
	const iAcc = Math.max(idx("account"), idx("accountid"));
	const iTo = Math.max(idx("toaccount"), idx("toaccountid"));
	const iCat = Math.max(idx("category"), idx("categoryid"));
	const iPayee = Math.max(idx("payee"), idx("note"));
	const iTrip = idx("tripid");
	let skipped = 0;
	const ok = [];
	for (const row of rows.slice(1)) {
		const date = row[iDate]?.trim();
		const amtRaw = Number(row[iAmt]);
		if (!date || Number.isNaN(amtRaw)) {
			skipped += 1;
			continue;
		}
		const accRaw = row[iAcc]?.trim() ?? "";
		const account = accounts.find((a) => a.id === accRaw) ?? accounts.find((a) => a.name.toLowerCase() === accRaw.toLowerCase() || a.nameZh === accRaw);
		if (!account) {
			skipped += 1;
			continue;
		}
		const catRaw = iCat >= 0 ? row[iCat]?.trim() ?? "" : "";
		const category = categories.find((c) => c.id === catRaw || c.name.toLowerCase() === catRaw.toLowerCase() || c.nameZh === catRaw);
		const typeRaw = (iType >= 0 ? row[iType] : "").toLowerCase();
		const type = typeRaw === "income" || typeRaw === "expense" || typeRaw === "transfer" || typeRaw === "miles" ? typeRaw : amtRaw < 0 ? "expense" : "income";
		const payee = (iPayee >= 0 ? row[iPayee] : "") || category?.name || "Imported";
		ok.push({
			type,
			amount: Math.abs(amtRaw),
			currency: (iCur >= 0 ? row[iCur] : "HKD") || "HKD",
			accountId: account.id,
			toAccountId: iTo >= 0 && row[iTo] ? row[iTo] : void 0,
			categoryId: category?.id,
			date,
			payee,
			payeeZh: payee,
			tripId: iTrip >= 0 && row[iTrip] ? row[iTrip] : void 0
		});
	}
	return {
		ok,
		skipped
	};
}
function BackupPage() {
	const t = useT();
	const exportSnap = useApp((s) => s.exportSnapshot);
	const replaceAll = useApp((s) => s.replaceAll);
	const [password, setPassword] = useState("");
	const fileRef = useRef(null);
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.backup.title,
				backTo: "/more"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "px-5 text-sm text-muted",
				children: t.backup.warn
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "px-5 pt-4",
				children: [
					/* @__PURE__ */ jsx("label", {
						className: "text-xs text-muted",
						children: t.backup.password
					}),
					/* @__PURE__ */ jsx("input", {
						type: "password",
						value: password,
						onChange: (e) => setPassword(e.target.value),
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3",
						placeholder: "••••••••"
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: async () => {
							if (!password) {
								toast(t.backup.needPassword);
								return;
							}
							downloadBlob("hk-life-money.backup.json", await encryptSnapshot(JSON.stringify(exportSnap()), password));
							toast(t.backup.exported);
						},
						className: "mt-3 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
						children: t.backup.export
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => fileRef.current?.click(),
						className: "mt-2 h-11 w-full rounded-xl bg-elevated text-sm",
						children: t.backup.restore
					}),
					/* @__PURE__ */ jsx("input", {
						ref: fileRef,
						type: "file",
						accept: "application/json,.json",
						className: "hidden",
						onChange: async (e) => {
							const file = e.target.files?.[0];
							e.target.value = "";
							if (!file) return;
							if (!password) {
								toast(t.backup.needPassword);
								return;
							}
							try {
								const json = await decryptSnapshot(await file.text(), password);
								const snap = JSON.parse(json);
								await replaceAll(snap);
								toast(t.backup.restored);
							} catch {
								toast(t.backup.badPassword);
							}
						}
					})
				]
			}),
			/* @__PURE__ */ jsx(Disclaimer, { children: t.backup.aes })
		]
	});
}
function SecurityPage() {
	const t = useT();
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.security.title,
				backTo: "/more"
			}),
			/* @__PURE__ */ jsxs(Group, { children: [
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Shield, { className: "size-4" }),
					title: t.security.lock,
					trailing: t.common.no
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					title: t.security.minutes,
					trailing: "5"
				})
			] }),
			/* @__PURE__ */ jsx(Disclaimer, { children: t.security.note })
		]
	});
}
function PreferencesPage() {
	const t = useT();
	const first = useUi((s) => s.firstDayOfWeek);
	const setFirst = useUi((s) => s.setFirstDay);
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [/* @__PURE__ */ jsx(ScreenHeader, {
			title: t.more.preferences,
			backTo: "/more"
		}), /* @__PURE__ */ jsxs(Group, { children: [
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				onClick: () => setFirst(first === 0 ? 1 : 0),
				className: "flex w-full items-center justify-between px-5 py-3 text-left",
				children: [/* @__PURE__ */ jsx("span", { children: t.more.firstDay }), /* @__PURE__ */ jsx("span", {
					className: "text-muted",
					children: first === 0 ? t.more.sunday : t.more.monday
				})]
			}),
			/* @__PURE__ */ jsx(Hairline, {}),
			/* @__PURE__ */ jsx(Row, {
				title: t.more.currency,
				trailing: "HKD"
			})
		] })]
	});
}
function ScreensPage() {
	const t = useT();
	const screens = [
		{
			to: "/",
			label: t.nav.today
		},
		{
			to: "/assets",
			label: t.nav.assets
		},
		{
			to: "/budget",
			label: t.nav.budget
		},
		{
			to: "/reports",
			label: t.nav.reports
		},
		{
			to: "/reports/dashboard",
			label: t.reports.dashboard
		},
		{
			to: "/reports/history",
			label: t.reports.history
		},
		{
			to: "/reports/spending",
			label: t.reports.spending
		},
		{
			to: "/reports/living",
			label: t.reports.living
		},
		{
			to: "/reports/travel",
			label: t.reports.travel
		},
		{
			to: "/reports/cashflow",
			label: t.reports.cashflow
		},
		{
			to: "/reports/retirement",
			label: t.reports.retirement
		},
		{
			to: "/more",
			label: t.nav.more
		},
		{
			to: "/more/categories",
			label: t.more.categories
		},
		{
			to: "/more/recurring",
			label: t.more.recurring
		},
		{
			to: "/more/fx",
			label: t.more.fx
		},
		{
			to: "/more/import",
			label: t.more.import
		},
		{
			to: "/more/backup",
			label: t.more.backup
		},
		{
			to: "/more/security",
			label: t.more.security
		},
		{
			to: "/onboarding",
			label: t.more.onboarding
		}
	];
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [/* @__PURE__ */ jsx(ScreenHeader, {
			title: t.more.screens,
			backTo: "/more"
		}), /* @__PURE__ */ jsx(Group, { children: screens.map((s, i) => /* @__PURE__ */ jsxs("div", { children: [i > 0 ? /* @__PURE__ */ jsx(Hairline, {}) : null, /* @__PURE__ */ jsxs(Link, {
			to: s.to,
			className: "flex items-center justify-between px-5 py-3",
			children: [/* @__PURE__ */ jsx("span", { children: s.label }), /* @__PURE__ */ jsx("span", {
				className: "text-xs text-faint",
				children: s.to
			})]
		})] }, s.to)) })]
	});
}
function StorageFooter() {
	const t = useT();
	const [est, setEst] = useState(null);
	useEffect(() => {
		let alive = true;
		const n = typeof navigator !== "undefined" ? navigator.storage : void 0;
		if (!n?.estimate) return;
		Promise.all([n.estimate(), n.persisted?.() ?? Promise.resolve(void 0)]).then(([e, p]) => {
			if (!alive) return;
			setEst({
				used: e.usage ?? 0,
				quota: e.quota ?? 0,
				persisted: p
			});
		});
		n.persist?.();
		return () => {
			alive = false;
		};
	}, []);
	function fmt(n) {
		if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
		if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
		if (n >= 1e3) return `${Math.round(n / 1e3)} KB`;
		return `${n} B`;
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "px-5 pb-8 pt-2 text-xs text-muted",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "font-medium text-foreground",
				children: t.more.storage
			}),
			est ? /* @__PURE__ */ jsxs("p", {
				className: "mt-1",
				children: [
					t.more.storageUsed,
					" ",
					fmt(est.used),
					est.quota ? ` · ${t.more.storageQuota} ${fmt(est.quota)}` : "",
					est.persisted ? ` · ${t.more.persist}` : ""
				]
			}) : /* @__PURE__ */ jsx("p", {
				className: "mt-1",
				children: t.more.privacy
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-2",
				children: t.more.githubPages
			})
		]
	});
}
//#endregion
export { MoreScreen as a, ScreensPage as c, ImportPage as i, SecurityPage as l, CategoriesPage as n, PreferencesPage as o, FxPage as r, RecurringPage as s, BackupPage as t };
