import { a as Hairline, c as Overlay, g as cn, h as TransactionRow, n as CategoryGlyph, t as AmountPill } from "./shared-BTv0_jzi.js";
import { F as useUi, I as longDate, K as pickName, N as readSavedLocale, P as useT, R as money, S as ACCOUNT_TYPE_OPTIONS, W as todayISO, a as ACCOUNT_GROUPS, b as rateToHkd, g as spentInMonth, i as useApp, o as accountsInGroup, s as iconForAccountType } from "./app-C4vqMmxY.js";
import { a as displayCategoryName, n as categoryTint, s as pickerGroups, t as categoryPath } from "./categories-8l-AiUYm.js";
import { t as activeTrips } from "./trips-DAjb_AyD.js";
import { n as AddAccountOverlay } from "./assets-B7NLYpN0.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ArrowLeftRight, BarChart3, Calendar, ChevronDown, ChevronLeft, ChevronRight, Copy, List, Minus, Pencil, Plane, Plus, Scale, Trash2, Wallet } from "lucide-react";
import { Toaster, toast } from "sonner";
//#region src/components/category-picker.tsx
function CategoryPicker({ categories, kind, onKindChange, budgets, spentById, onSelect, onClose }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const [open, setOpen] = useState(null);
	const [kindOpen, setKindOpen] = useState(false);
	const kindRef = useRef(null);
	const groups = useMemo(() => pickerGroups(categories, kind), [categories, kind]);
	useEffect(() => {
		setOpen(null);
		setKindOpen(false);
	}, [kind]);
	useEffect(() => {
		if (!kindOpen) return;
		function onDoc(e) {
			if (kindRef.current && !kindRef.current.contains(e.target)) setKindOpen(false);
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, [kindOpen]);
	const ring = kind === "income" ? "var(--income)" : "var(--expense)";
	const original = (c) => categories.find((x) => x.id === c.id) ?? c;
	function ratioFor(c, nested) {
		const ids = nested.length ? nested.map((x) => x.id) : [c.id];
		let spent = 0;
		for (const id of ids) spent += spentById.get(id) ?? 0;
		const cap = budgets.filter((b) => b.categoryId && ids.includes(b.categoryId)).reduce((s, b) => s + b.monthly, 0);
		if (cap > 0) return spent / cap;
		const monthCap = budgets.find((b) => !b.categoryId && !b.theme)?.monthly ?? 0;
		return monthCap > 0 ? spent / monthCap : spent > 0 ? .18 : 0;
	}
	function pickMain(g) {
		if (g.children.length) setOpen(g);
		else onSelect(original(g.parent));
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "flex min-h-[70dvh] flex-col px-3 pb-10 pt-[max(0.35rem,env(safe-area-inset-top))]",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "relative flex items-center justify-between pb-2",
			children: [
				open ? /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setOpen(null),
					className: "grid size-11 place-items-center text-accent",
					"aria-label": t.common.back,
					children: /* @__PURE__ */ jsx(ChevronLeft, {
						className: "size-6",
						strokeWidth: 2
					})
				}) : onClose ? /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: onClose,
					className: "min-h-11 min-w-14 px-2 text-left text-sm font-medium text-accent",
					children: t.add.cancel
				}) : /* @__PURE__ */ jsx("span", { className: "min-w-14" }),
				open ? /* @__PURE__ */ jsx("span", {
					className: "min-w-0 flex-1 truncate px-1 text-center text-lg font-semibold",
					children: displayCategoryName(open.parent, locale)
				}) : onKindChange ? /* @__PURE__ */ jsxs("div", {
					className: "relative",
					ref: kindRef,
					children: [/* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => setKindOpen((v) => !v),
						className: "flex min-h-11 items-center gap-0.5 text-lg font-semibold",
						children: [kind === "income" ? t.add.income : t.add.expense, /* @__PURE__ */ jsx(ChevronDown, { className: "size-5 text-muted" })]
					}), kindOpen ? /* @__PURE__ */ jsx("div", {
						className: "absolute left-1/2 top-full z-20 mt-1 w-40 -translate-x-1/2 overflow-hidden rounded-xl bg-elevated py-1 shadow-lg ring-1 ring-line",
						children: [
							["expense", t.add.expense],
							["income", t.add.income],
							["transfer", t.add.transfer],
							["miles", t.add.miles]
						].map(([id, label]) => /* @__PURE__ */ jsx("button", {
							type: "button",
							className: cn("flex h-11 w-full items-center px-4 text-left text-sm", id === kind && "font-semibold text-accent"),
							onClick: () => {
								setKindOpen(false);
								onKindChange(id);
							},
							children: label
						}, id))
					}) : null]
				}) : /* @__PURE__ */ jsx("span", {
					className: "text-lg font-semibold",
					children: kind === "income" ? t.add.income : t.add.expense
				}),
				/* @__PURE__ */ jsx(Link, {
					to: "/more/$page",
					params: { page: "categories" },
					onClick: onClose,
					className: "grid min-h-11 min-w-14 place-items-center text-sm font-medium text-accent",
					children: t.common.edit
				})
			]
		}), open ? /* @__PURE__ */ jsxs("div", {
			className: "flex-1",
			children: [/* @__PURE__ */ jsx("p", {
				className: "px-2 pb-3 text-center text-xs text-muted",
				children: t.add.subcategory
			}), /* @__PURE__ */ jsx("div", {
				className: "overflow-hidden rounded-xl bg-elevated",
				children: open.children.map((c) => {
					const tint = categoryTint(c.icon);
					return /* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left first:border-0",
						onClick: () => onSelect(original(c)),
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "grid size-10 shrink-0 place-items-center rounded-full",
								style: {
									background: tint.bg,
									color: tint.fg
								},
								children: /* @__PURE__ */ jsx(CategoryGlyph, {
									name: c.icon,
									className: "size-5"
								})
							}),
							/* @__PURE__ */ jsx("span", {
								className: "min-w-0 flex-1 truncate text-[15px]",
								children: displayCategoryName(c, locale)
							}),
							/* @__PURE__ */ jsx(ChevronRight, { className: "size-4 shrink-0 text-faint" })
						]
					}, c.id);
				})
			})]
		}) : /* @__PURE__ */ jsxs(Fragment, { children: [
			/* @__PURE__ */ jsx("p", {
				className: "px-2 pb-4 text-center text-xs text-muted",
				children: t.add.parentCategory
			}),
			/* @__PURE__ */ jsx("div", {
				className: "grid grid-cols-4 gap-x-1 gap-y-5",
				children: groups.map((g) => {
					const ratio = ratioFor(g.parent, g.children);
					const tint = categoryTint(g.parent.icon);
					return /* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "flex flex-col items-center gap-1.5",
						onClick: () => pickMain(g),
						children: [/* @__PURE__ */ jsxs("span", {
							className: "relative",
							children: [/* @__PURE__ */ jsx(UsageRing, {
								ratio,
								stroke: ring,
								children: /* @__PURE__ */ jsx("span", {
									className: "grid size-12 place-items-center rounded-full",
									style: {
										background: tint.bg,
										color: tint.fg
									},
									children: /* @__PURE__ */ jsx(CategoryGlyph, {
										name: g.parent.icon,
										className: "size-6"
									})
								})
							}), g.children.length ? /* @__PURE__ */ jsx("span", {
								className: "absolute -right-0.5 bottom-1 grid size-5 place-items-center rounded-full bg-elevated text-muted shadow-sm ring-1 ring-line",
								children: /* @__PURE__ */ jsx(ChevronRight, {
									className: "size-3",
									strokeWidth: 2.4
								})
							}) : null]
						}), /* @__PURE__ */ jsx("span", {
							className: "w-full px-0.5 text-center text-[10px] leading-tight",
							children: displayCategoryName(g.parent, locale)
						})]
					}, g.key);
				})
			}),
			groups.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "px-2 py-10 text-center text-sm text-muted",
				children: t.reports.noData
			}) : null
		] })]
	});
}
function UsageRing({ ratio, stroke, children }) {
	const size = 72;
	const r = 30;
	const c = 2 * Math.PI * r;
	const p = Math.min(1, Math.max(0, ratio));
	const color = ratio >= 1 ? "var(--expense)" : stroke;
	return /* @__PURE__ */ jsxs("span", {
		className: cn("relative grid size-[4.5rem] place-items-center"),
		children: [/* @__PURE__ */ jsxs("svg", {
			className: "absolute inset-0 -rotate-90",
			width: size,
			height: size,
			viewBox: `0 0 ${size} ${size}`,
			children: [/* @__PURE__ */ jsx("circle", {
				cx: size / 2,
				cy: size / 2,
				r,
				fill: "none",
				stroke: "var(--ring-track)",
				strokeWidth: "3.5"
			}), p > 0 ? /* @__PURE__ */ jsx("circle", {
				cx: size / 2,
				cy: size / 2,
				r,
				fill: "none",
				stroke: color,
				strokeWidth: "3.5",
				strokeLinecap: "round",
				strokeDasharray: `${p * c} ${c}`
			}) : null]
		}), children]
	});
}
//#endregion
//#region src/components/add-sheet.tsx
function AddFlow() {
	const t = useT();
	const picker = useUi((s) => s.addPickerOpen);
	const kind = useUi((s) => s.addKind);
	const editingId = useUi((s) => s.editingId);
	const close = useUi((s) => s.closeAdd);
	const setKind = useUi((s) => s.setAddKind);
	const txs = useApp((s) => s.transactions);
	const editing = editingId ? txs.find((x) => x.id === editingId) : void 0;
	const formKind = kind ?? editing?.type ?? null;
	const [pickedCat, setPickedCat] = useState(null);
	useEffect(() => {
		setPickedCat(null);
	}, [formKind]);
	const catFirst = (formKind === "expense" || formKind === "income") && !editing && pickedCat == null;
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx(Overlay, {
			open: picker,
			onClose: close,
			title: t.add.title,
			children: /* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-3 px-5 pb-8 pt-2",
				children: [
					/* @__PURE__ */ jsx(AddChoice, {
						icon: /* @__PURE__ */ jsx(Minus, { className: "size-6" }),
						label: t.add.expense,
						tone: "expense",
						onClick: () => setKind("expense")
					}),
					/* @__PURE__ */ jsx(AddChoice, {
						icon: /* @__PURE__ */ jsx(Plus, { className: "size-6" }),
						label: t.add.income,
						tone: "income",
						onClick: () => setKind("income")
					}),
					/* @__PURE__ */ jsx(AddChoice, {
						icon: /* @__PURE__ */ jsx(ArrowLeftRight, { className: "size-6" }),
						label: t.add.transfer,
						tone: "transfer",
						onClick: () => setKind("transfer")
					}),
					/* @__PURE__ */ jsx(AddChoice, {
						icon: /* @__PURE__ */ jsx(Plane, { className: "size-6" }),
						label: t.add.miles,
						tone: "miles",
						onClick: () => setKind("miles")
					})
				]
			})
		}),
		/* @__PURE__ */ jsx(Overlay, {
			open: catFirst,
			onClose: close,
			variant: "page",
			children: formKind === "income" || formKind === "expense" ? /* @__PURE__ */ jsx(CategoryFirst, {
				kind: formKind,
				onSelect: setPickedCat,
				onKindChange: (k) => {
					setPickedCat(null);
					setKind(k);
				},
				onClose: close
			}) : null
		}),
		/* @__PURE__ */ jsx(Overlay, {
			open: formKind != null && !catFirst,
			onClose: () => {
				if (pickedCat && !editing) setPickedCat(null);
				else close();
			},
			title: formKind === "expense" ? t.add.expense : formKind === "income" ? t.add.income : formKind === "transfer" ? t.add.transfer : t.add.miles,
			children: formKind ? /* @__PURE__ */ jsx(AddForm, {
				kind: formKind,
				editing,
				presetCategory: pickedCat
			}) : null
		})
	] });
}
function CategoryFirst({ kind, onSelect, onKindChange, onClose }) {
	const categories = useApp((s) => s.categories);
	const budgets = useApp((s) => s.budgets);
	const txs = useApp((s) => s.transactions);
	const fxRates = useApp((s) => s.fxRates);
	const date = useUi((s) => s.selectedDate) || todayISO();
	const spendMap = useMemo(() => {
		const month = date.slice(0, 7);
		const map = /* @__PURE__ */ new Map();
		for (const c of categories) map.set(c.id, spentInMonth(txs, month, fxRates, { categoryId: c.id }));
		return map;
	}, [
		categories,
		txs,
		fxRates,
		date
	]);
	return /* @__PURE__ */ jsx(CategoryPicker, {
		categories,
		kind,
		onKindChange,
		budgets,
		spentById: spendMap,
		onSelect,
		onClose
	});
}
function AddChoice({ icon, label, tone, onClick }) {
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		onClick,
		className: "flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl bg-elevated",
		children: [/* @__PURE__ */ jsx("span", {
			className: cn("grid size-12 place-items-center rounded-full", tone === "expense" && "bg-pill-expense text-expense", tone === "income" && "bg-pill-income text-income", tone === "transfer" && "bg-pill-transfer text-transfer", tone === "miles" && "bg-pill-miles text-miles"),
			children: icon
		}), /* @__PURE__ */ jsx("span", {
			className: "text-sm font-medium",
			children: label
		})]
	});
}
function AddForm({ kind, editing, presetCategory }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const selectedDate = useUi((s) => s.selectedDate);
	const close = useUi((s) => s.closeAdd);
	const accounts = useApp((s) => s.accounts);
	const categories = useApp((s) => s.categories);
	const trips = useApp((s) => s.trips);
	const fxRates = useApp((s) => s.fxRates);
	const budgets = useApp((s) => s.budgets);
	const txs = useApp((s) => s.transactions);
	const addTransaction = useApp((s) => s.addTransaction);
	const updateTransaction = useApp((s) => s.updateTransaction);
	const monetary = kind !== "miles";
	const fromAccounts = accounts.filter((a) => {
		if (!(kind === "miles" ? a.type === "miles" : a.currency !== "MILES")) return false;
		if (a.hidden && a.id !== editing?.accountId && a.id !== editing?.toAccountId) return false;
		return true;
	});
	const cats = categories.filter((c) => kind === "income" ? c.kind === "income" : kind === "expense" ? c.kind === "expense" : true);
	const defaultCatId = kind === "income" ? presetCategory?.id ?? (cats.find((c) => c.id === "salary") ?? cats[0])?.id ?? "" : kind === "expense" ? presetCategory?.id ?? (cats.find((c) => c.id === "dining") ?? cats[0])?.id ?? "" : cats[0]?.id ?? "";
	const defaultFrom = fromAccounts.find((a) => a.currency === "HKD" && a.type === "current")?.id ?? fromAccounts.find((a) => a.currency === "HKD")?.id ?? fromAccounts[0]?.id ?? "";
	function accountForCategory(catId, fallback) {
		const c = categories.find((x) => x.id === catId);
		if (c?.defaultAccountId && fromAccounts.some((a) => a.id === c.defaultAccountId)) return c.defaultAccountId;
		return fallback;
	}
	const [digits, setDigits] = useState(editing ? String(editing.amount) : "0");
	const [accountId, setAccountId] = useState(editing?.accountId ?? accountForCategory(defaultCatId, defaultFrom));
	const [toAccountId, setToAccountId] = useState(editing?.toAccountId ?? fromAccounts.find((a) => a.id !== (editing?.accountId ?? defaultFrom))?.id ?? defaultFrom);
	const [categoryId, setCategoryId] = useState(editing?.categoryId ?? defaultCatId);
	const [date, setDate] = useState(editing?.date ?? selectedDate ?? todayISO());
	const [payee, setPayee] = useState(editing ? locale === "zh-HK" ? editing.payeeZh : editing.payee : "");
	const [tripId, setTripId] = useState(editing?.tripId ?? "");
	const [milesType, setMilesType] = useState(editing?.milesType ?? "earn");
	const [pick, setPick] = useState(null);
	useEffect(() => {
		setDigits(editing ? String(editing.amount) : "0");
		setAccountId(editing?.accountId ?? accountForCategory(defaultCatId, defaultFrom));
		setToAccountId(editing?.toAccountId ?? fromAccounts.find((a) => a.id !== (editing?.accountId ?? defaultFrom))?.id ?? defaultFrom);
		setCategoryId(editing?.categoryId ?? defaultCatId);
		setDate(editing?.date ?? selectedDate ?? todayISO());
		setPayee(editing ? locale === "zh-HK" ? editing.payeeZh : editing.payee : "");
		setTripId(editing?.tripId ?? "");
		setMilesType(editing?.milesType ?? "earn");
	}, [editing?.id, kind]);
	const amount = Number(digits) || 0;
	const from = accounts.find((a) => a.id === accountId);
	const to = accounts.find((a) => a.id === toAccountId);
	const cat = categories.find((c) => c.id === categoryId);
	const currency = from?.currency ?? (kind === "miles" ? "MILES" : "HKD");
	const spendMap = useMemo(() => {
		const month = (date || todayISO()).slice(0, 7);
		const map = /* @__PURE__ */ new Map();
		for (const c of categories) map.set(c.id, spentInMonth(txs, month, fxRates, { categoryId: c.id }));
		return map;
	}, [
		categories,
		txs,
		fxRates,
		date
	]);
	const display = useMemo(() => {
		if (!monetary) return Math.round(amount).toLocaleString("en-HK");
		return money(amount, currency === "MILES" ? "HKD" : currency);
	}, [
		amount,
		monetary,
		currency
	]);
	function tap(k) {
		setDigits((prev) => {
			if (k === "⌫") {
				const next = prev.slice(0, -1);
				return next.length ? next : "0";
			}
			if (k === "." && (prev.includes(".") || !monetary || currency === "JPY")) return prev;
			if (prev === "0" && k !== ".") return k;
			return prev + k;
		});
	}
	async function save() {
		if (amount <= 0 && milesType !== "adjust") {
			toast(t.add.needAmount);
			return;
		}
		if (!accountId) {
			toast(t.add.needAmount);
			return;
		}
		const payeeEn = payee.trim() || cat?.name || t.add.note;
		const payeeZh = payee.trim() || cat?.nameZh || t.add.note;
		let destAmount;
		if (kind === "transfer" && from && to) {
			const fromRate = rateToHkd(from.currency, fxRates);
			const toRate = rateToHkd(to.currency, fxRates) || 1;
			destAmount = from.currency === to.currency ? amount : amount * fromRate / toRate;
		}
		const tx = {
			id: editing?.id ?? crypto.randomUUID(),
			type: kind,
			amount,
			currency,
			accountId,
			toAccountId: kind === "transfer" ? toAccountId : void 0,
			destAmount,
			categoryId: kind === "expense" || kind === "income" ? categoryId : void 0,
			date,
			payee: payeeEn,
			payeeZh,
			note: payee.trim() || void 0,
			tripId: tripId || void 0,
			milesType: kind === "miles" ? milesType : void 0,
			fxToHkd: currency !== "HKD" && currency !== "MILES" ? rateToHkd(currency, fxRates) : void 0
		};
		if (editing) await updateTransaction(tx, editing);
		else await addTransaction(tx);
		toast(t.add.savedToast);
		close();
	}
	const keys = monetary && currency !== "JPY" ? [
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		".",
		"0",
		"⌫"
	] : [
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"⌫",
		"0",
		"⌫"
	];
	return /* @__PURE__ */ jsxs("div", {
		className: "px-5 pb-8",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "py-4 text-center text-4xl font-semibold tabular-nums tracking-tight",
				children: [display, !monetary ? /* @__PURE__ */ jsx("span", {
					className: "ml-2 text-base font-medium text-muted",
					children: locale === "zh-HK" ? "里" : "miles"
				}) : /* @__PURE__ */ jsx("span", {
					className: "ml-2 text-base font-medium text-muted",
					children: currency
				})]
			}),
			/* @__PURE__ */ jsx(Field, {
				label: kind === "transfer" ? t.add.from : t.add.account,
				onClick: () => setPick("from"),
				children: from ? pickName(locale, from.name, from.nameZh) : "—"
			}),
			kind === "transfer" ? /* @__PURE__ */ jsx(Field, {
				label: t.add.to,
				onClick: () => setPick("to"),
				children: to ? pickName(locale, to.name, to.nameZh) : "—"
			}) : null,
			kind === "expense" || kind === "income" ? /* @__PURE__ */ jsx(Field, {
				label: t.add.category,
				onClick: () => setPick("cat"),
				children: cat ? categoryPath(categories, cat, locale) : "—"
			}) : null,
			kind === "miles" ? /* @__PURE__ */ jsx(Field, {
				label: t.add.milesType,
				onClick: () => setPick("miles"),
				children: milesType === "earn" ? t.add.earn : milesType === "burn" ? t.add.burn : milesType === "expiry" ? t.add.expiry : t.add.adjust
			}) : null,
			/* @__PURE__ */ jsxs("label", {
				className: "flex items-center justify-between border-b border-line py-3",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-sm text-muted",
					children: t.add.date
				}), /* @__PURE__ */ jsx("input", {
					type: "date",
					value: date,
					onChange: (e) => setDate(e.target.value),
					className: "bg-transparent text-right text-sm outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "flex items-center justify-between gap-3 border-b border-line py-3",
				children: [/* @__PURE__ */ jsx("span", {
					className: "shrink-0 text-sm text-muted",
					children: t.add.note
				}), /* @__PURE__ */ jsx("input", {
					value: payee,
					onChange: (e) => setPayee(e.target.value),
					placeholder: t.add.payeePlaceholder,
					className: "min-w-0 flex-1 bg-transparent text-right text-sm outline-none"
				})]
			}),
			kind === "expense" ? /* @__PURE__ */ jsx(Field, {
				label: `${t.add.trip} · ${t.add.optional}`,
				onClick: () => setPick("trip"),
				muted: !tripId,
				children: tripId ? pickName(locale, trips.find((x) => x.id === tripId)?.name ?? "", trips.find((x) => x.id === tripId)?.nameZh ?? "") : t.add.none
			}) : null,
			/* @__PURE__ */ jsx("div", {
				className: "mt-4 grid grid-cols-3 gap-2",
				children: keys.map((k, i) => /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => tap(k),
					className: "h-12 rounded-lg bg-elevated text-lg font-medium tabular-nums",
					children: k
				}, `${k}-${i}`))
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => void save(),
				className: "mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent",
				children: t.add.save
			}),
			/* @__PURE__ */ jsx(Overlay, {
				open: pick === "from" || pick === "to",
				onClose: () => setPick(null),
				title: pick === "to" ? t.add.to : t.add.account,
				variant: "page",
				children: /* @__PURE__ */ jsx(AccountPickList, {
					accounts: fromAccounts,
					selectedId: pick === "to" ? toAccountId : accountId,
					onSelect: (id) => {
						if (pick === "from") setAccountId(id);
						else setToAccountId(id);
						setPick(null);
					}
				})
			}),
			/* @__PURE__ */ jsx(Overlay, {
				open: pick === "trip" || pick === "miles",
				onClose: () => setPick(null),
				title: pick === "trip" ? t.add.trip : t.add.milesType,
				children: /* @__PURE__ */ jsxs("div", {
					className: "px-2 pb-6",
					children: [pick === "trip" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "flex w-full px-4 py-3 text-left text-[15px] text-muted",
						onClick: () => {
							setTripId("");
							setPick(null);
						},
						children: t.add.none
					}), activeTrips(trips, todayISO(), tripId || void 0).map((tr) => /* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "flex w-full flex-col px-4 py-3 text-left",
						onClick: () => {
							setTripId(tr.id);
							setPick(null);
						},
						children: [/* @__PURE__ */ jsx("span", {
							className: "text-[15px]",
							children: pickName(locale, tr.name, tr.nameZh)
						}), /* @__PURE__ */ jsxs("span", {
							className: "text-xs text-muted",
							children: [tr.start, tr.end ? ` → ${tr.end}` : ""]
						})]
					}, tr.id))] }) : null, pick === "miles" ? [
						["earn", t.add.earn],
						["burn", t.add.burn],
						["adjust", t.add.adjust],
						["expiry", t.add.expiry]
					].map(([id, label]) => /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "flex w-full px-4 py-3 text-left text-[15px]",
						onClick: () => {
							setMilesType(id);
							setPick(null);
						},
						children: label
					}, id)) : null]
				})
			}),
			/* @__PURE__ */ jsx(Overlay, {
				open: pick === "cat",
				onClose: () => setPick(null),
				variant: "page",
				children: /* @__PURE__ */ jsx(CategoryPicker, {
					categories,
					kind: kind === "income" ? "income" : "expense",
					budgets,
					spentById: spendMap,
					onClose: () => setPick(null),
					onSelect: (c) => {
						setCategoryId(c.id);
						if (c.defaultAccountId && fromAccounts.some((a) => a.id === c.defaultAccountId)) setAccountId(c.defaultAccountId);
						else {
							const parent = categories.find((x) => x.id === c.parentId);
							if (parent?.defaultAccountId && fromAccounts.some((a) => a.id === parent.defaultAccountId)) setAccountId(parent.defaultAccountId);
						}
						setPick(null);
					}
				})
			})
		]
	});
}
function Field({ label, children, muted, onClick }) {
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		onClick,
		className: "flex w-full items-center justify-between border-b border-line py-3 text-left",
		children: [/* @__PURE__ */ jsx("span", {
			className: "text-sm text-muted",
			children: label
		}), /* @__PURE__ */ jsx("span", {
			className: cn("text-sm", muted && "text-faint"),
			children
		})]
	});
}
function AccountPickList({ accounts, selectedId, onSelect }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const titles = {
		cash: t.assets.cash,
		credit: t.assets.credit,
		assets: t.assets.investments,
		housing: t.assets.housing,
		loyalty: t.assets.loyalty
	};
	return /* @__PURE__ */ jsx("div", {
		className: "pb-8",
		children: ACCOUNT_GROUPS.map((g) => {
			const rows = accountsInGroup(accounts, g, { includeHidden: true });
			if (!rows.length) return null;
			return /* @__PURE__ */ jsxs("div", { children: [
				/* @__PURE__ */ jsx("h2", {
					className: "px-5 pb-1 pt-5 text-sm font-medium text-muted",
					children: titles[g]
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				rows.map((a, i) => {
					const typeLabel = ACCOUNT_TYPE_OPTIONS.find((o) => o.id === a.type);
					const native = a.currency === "MILES" ? `${Math.round(a.balance).toLocaleString("en-HK")} ${locale === "zh-HK" ? "里" : "miles"}` : money(a.balance, a.currency, { sign: true });
					return /* @__PURE__ */ jsxs("div", { children: [i > 0 ? /* @__PURE__ */ jsx(Hairline, {}) : null, /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => onSelect(a.id),
						className: cn("flex w-full items-center gap-3 px-5 py-3 text-left", a.id === selectedId && "bg-accent-soft"),
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "grid size-10 shrink-0 place-items-center rounded-full bg-elevated ring-1 ring-line",
								children: /* @__PURE__ */ jsx(CategoryGlyph, { name: iconForAccountType(a.type) })
							}),
							/* @__PURE__ */ jsxs("span", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ jsx("span", {
									className: "block truncate text-[15px] font-medium",
									children: pickName(locale, a.name, a.nameZh)
								}), /* @__PURE__ */ jsxs("span", {
									className: "text-xs text-muted",
									children: [typeLabel ? locale === "zh-HK" ? typeLabel.zh : typeLabel.en : a.type, a.institution ? ` · ${a.institution}` : ""]
								})]
							}),
							/* @__PURE__ */ jsx("span", {
								className: cn("text-[15px] font-semibold tabular-nums", a.balance < 0 ? "text-expense" : "text-foreground"),
								children: native
							})
						]
					})] }, a.id);
				})
			] }, g);
		})
	});
}
//#endregion
//#region src/components/search-sheet.tsx
function SearchFlow() {
	const t = useT();
	const open = useUi((s) => s.searchOpen);
	const setOpen = useUi((s) => s.setSearchOpen);
	const filterOpen = useUi((s) => s.filterOpen);
	const setFilter = useUi((s) => s.setFilterOpen);
	const filterKind = useUi((s) => s.filterKind);
	const setFilterKind = useUi((s) => s.setFilterKind);
	const locale = useUi((s) => s.locale);
	const setTx = useUi((s) => s.setTxDetailId);
	const transactions = useApp((s) => s.transactions);
	const [q, setQ] = useState("");
	const results = useMemo(() => {
		const s = q.trim().toLowerCase();
		return transactions.filter((tx) => filterKind === "all" ? true : tx.type === filterKind).filter((tx) => {
			if (!s) return true;
			return `${tx.payee} ${tx.payeeZh} ${tx.note ?? ""} ${tx.tags?.join(" ") ?? ""}`.toLowerCase().includes(s);
		}).slice(0, 40);
	}, [
		q,
		transactions,
		filterKind
	]);
	const chips = [
		{
			id: "all",
			label: t.common.all
		},
		{
			id: "expense",
			label: t.tx.expense
		},
		{
			id: "income",
			label: t.tx.income
		},
		{
			id: "transfer",
			label: t.tx.transfer
		},
		{
			id: "miles",
			label: t.tx.miles
		}
	];
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Overlay, {
		open,
		onClose: () => setOpen(false),
		title: t.today.search,
		children: /* @__PURE__ */ jsxs("div", {
			className: "px-5 pb-8",
			children: [
				/* @__PURE__ */ jsx("input", {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: t.common.search,
					className: "h-11 w-full rounded-lg bg-elevated px-3 text-base outline-none"
				}),
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => setFilter(true),
					className: "mt-3 text-sm text-accent",
					children: [t.today.filter, filterKind !== "all" ? ` · ${chips.find((c) => c.id === filterKind)?.label}` : ""]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "-mx-5 mt-3",
					children: results.map((tx) => /* @__PURE__ */ jsx(TransactionRow, {
						tx,
						showDate: true,
						onClick: () => {
							setOpen(false);
							setTx(tx.id);
						}
					}, tx.id))
				})
			]
		})
	}), /* @__PURE__ */ jsx(Overlay, {
		open: filterOpen,
		onClose: () => setFilter(false),
		title: t.today.filter,
		children: /* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap gap-2 px-5 pb-8",
			children: [
				chips.map((chip) => /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setFilterKind(chip.id),
					className: cn("rounded-full px-3 py-2 text-sm", filterKind === chip.id ? "bg-accent text-on-accent" : "bg-elevated text-foreground"),
					children: chip.label
				}, chip.id)),
				/* @__PURE__ */ jsx("span", {
					className: "rounded-full bg-elevated px-3 py-2 text-sm text-muted",
					children: pickName(locale, "Travel", "旅遊")
				}),
				/* @__PURE__ */ jsx("span", {
					className: "rounded-full bg-elevated px-3 py-2 text-sm text-muted",
					children: "HKD"
				})
			]
		})
	})] });
}
//#endregion
//#region src/components/tx-detail.tsx
function TxDetail() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const id = useUi((s) => s.txDetailId);
	const setId = useUi((s) => s.setTxDetailId);
	const setEditing = useUi((s) => s.setEditingId);
	const setKind = useUi((s) => s.setAddKind);
	const transactions = useApp((s) => s.transactions);
	const accounts = useApp((s) => s.accounts);
	const categories = useApp((s) => s.categories);
	const trips = useApp((s) => s.trips);
	const remove = useApp((s) => s.deleteTransaction);
	const add = useApp((s) => s.addTransaction);
	const updateTransaction = useApp((s) => s.updateTransaction);
	const [pickTrip, setPickTrip] = useState(false);
	const tx = transactions.find((x) => x.id === id);
	if (!tx) return /* @__PURE__ */ jsx(Overlay, {
		open: false,
		onClose: () => setId(null),
		children: null
	});
	const current = tx;
	const account = accounts.find((a) => a.id === tx.accountId);
	const to = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : void 0;
	const cat = categories.find((c) => c.id === tx.categoryId);
	const trip = trips.find((x) => x.id === tx.tripId);
	const displayType = tx.type === "miles" ? tx.milesType === "earn" ? "income" : tx.milesType === "burn" || tx.milesType === "expiry" ? "expense" : "miles" : tx.type;
	async function setTrip(tripId) {
		const next = {
			...current,
			tripId: tripId || void 0
		};
		if (!tripId) delete next.tripId;
		await updateTransaction(next);
		setPickTrip(false);
		toast(t.add.savedToast);
	}
	return /* @__PURE__ */ jsxs(Overlay, {
		open: true,
		onClose: () => setId(null),
		title: pickName(locale, tx.payee, tx.payeeZh),
		children: [/* @__PURE__ */ jsxs("div", {
			className: "px-5 pb-8",
			children: [
				/* @__PURE__ */ jsx("div", {
					className: "flex justify-center py-4",
					children: /* @__PURE__ */ jsx(AmountPill, {
						type: displayType,
						amount: tx.amount,
						currency: tx.currency
					})
				}),
				/* @__PURE__ */ jsx(Row, {
					label: t.add.date,
					value: longDate(tx.date, locale)
				}),
				/* @__PURE__ */ jsx(Row, {
					label: t.add.account,
					value: account ? pickName(locale, account.name, account.nameZh) : "—"
				}),
				to ? /* @__PURE__ */ jsx(Row, {
					label: t.add.to,
					value: pickName(locale, to.name, to.nameZh)
				}) : null,
				cat ? /* @__PURE__ */ jsx(Row, {
					label: t.add.category,
					value: pickName(locale, cat.name, cat.nameZh)
				}) : null,
				tx.type === "expense" ? /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: "flex w-full items-start justify-between gap-4 border-b border-line py-3 text-left",
					onClick: () => setPickTrip(true),
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-sm text-muted",
						children: t.add.trip
					}), /* @__PURE__ */ jsx("span", {
						className: "max-w-[60%] text-right text-sm text-accent",
						children: trip ? pickName(locale, trip.name, trip.nameZh) : t.add.none
					})]
				}) : trip ? /* @__PURE__ */ jsx(Row, {
					label: t.add.trip,
					value: pickName(locale, trip.name, trip.nameZh)
				}) : null,
				tx.tags?.length ? /* @__PURE__ */ jsx(Row, {
					label: t.add.tags,
					value: tx.tags.join(", ")
				}) : null,
				tx.currency !== "HKD" && tx.currency !== "MILES" ? /* @__PURE__ */ jsx(Row, {
					label: t.add.fx,
					value: money(tx.amount, tx.currency)
				}) : null,
				/* @__PURE__ */ jsxs("div", {
					className: "mt-6 grid grid-cols-3 gap-2",
					children: [
						/* @__PURE__ */ jsx(Action, {
							icon: /* @__PURE__ */ jsx(Pencil, { className: "size-4" }),
							label: t.tx.edit,
							onClick: () => {
								setId(null);
								setEditing(tx.id);
								setKind(tx.type);
							}
						}),
						/* @__PURE__ */ jsx(Action, {
							icon: /* @__PURE__ */ jsx(Copy, { className: "size-4" }),
							label: t.tx.duplicate,
							onClick: async () => {
								const copy = {
									...tx,
									id: crypto.randomUUID()
								};
								await add(copy);
								toast(t.add.savedToast);
								setId(null);
							}
						}),
						/* @__PURE__ */ jsx(Action, {
							icon: /* @__PURE__ */ jsx(Trash2, { className: "size-4" }),
							label: t.tx.delete,
							danger: true,
							onClick: async () => {
								const removed = await remove(tx.id);
								setId(null);
								toast(t.tx.deleted, { action: {
									label: t.tx.undo,
									onClick: () => {
										if (removed) add(removed);
									}
								} });
							}
						})
					]
				})
			]
		}), /* @__PURE__ */ jsx(Overlay, {
			open: pickTrip,
			onClose: () => setPickTrip(false),
			title: t.add.trip,
			variant: "page",
			children: /* @__PURE__ */ jsxs("div", {
				className: "px-2 pb-8",
				children: [/* @__PURE__ */ jsx("button", {
					type: "button",
					className: "flex w-full px-4 py-3 text-left text-[15px] text-muted",
					onClick: () => void setTrip(void 0),
					children: t.add.none
				}), activeTrips(trips, todayISO(), tx.tripId).map((tr) => /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: "flex w-full flex-col px-4 py-3 text-left",
					onClick: () => void setTrip(tr.id),
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-[15px]",
						children: pickName(locale, tr.name, tr.nameZh)
					}), /* @__PURE__ */ jsxs("span", {
						className: "text-xs text-muted",
						children: [tr.start, tr.end ? ` → ${tr.end}` : ""]
					})]
				}, tr.id))]
			})
		})]
	});
}
function Row({ label, value }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-start justify-between gap-4 border-b border-line py-3",
		children: [/* @__PURE__ */ jsx("span", {
			className: "text-sm text-muted",
			children: label
		}), /* @__PURE__ */ jsx("span", {
			className: "max-w-[60%] text-right text-sm",
			children: value
		})]
	});
}
function Action({ icon, label, onClick, danger }) {
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		onClick,
		className: `flex h-16 flex-col items-center justify-center gap-1 rounded-xl bg-elevated text-xs ${danger ? "text-expense" : "text-foreground"}`,
		children: [icon, label]
	});
}
//#endregion
//#region src/components/shell.tsx
var tabs = [
	{
		to: "/",
		id: "today",
		icon: Calendar
	},
	{
		to: "/assets",
		id: "assets",
		icon: Scale
	},
	{
		to: "/budget",
		id: "budget",
		icon: Wallet
	},
	{
		to: "/reports",
		id: "reports",
		icon: BarChart3
	},
	{
		to: "/more",
		id: "more",
		icon: List
	}
];
function isActive(pathname, to) {
	if (to === "/") return pathname === "/";
	return pathname === to || pathname.startsWith(`${to}/`);
}
function TodayGlyph({ day, className }) {
	return /* @__PURE__ */ jsxs("span", {
		className: cn("relative grid place-items-center", className),
		children: [/* @__PURE__ */ jsxs("svg", {
			viewBox: "0 0 24 24",
			className: "size-full",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.7",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": true,
			children: [/* @__PURE__ */ jsx("rect", {
				x: "3.5",
				y: "4.5",
				width: "17",
				height: "16",
				rx: "2"
			}), /* @__PURE__ */ jsx("path", { d: "M8 3v3M16 3v3M3.5 10h17" })]
		}), /* @__PURE__ */ jsx("span", {
			className: "absolute top-[11px] text-[9px] font-semibold leading-none tabular-nums",
			children: day
		})]
	});
}
function AppShell({ children }) {
	const locale = useUi((s) => s.locale);
	const setLocale = useUi((s) => s.setLocale);
	const t = useT();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const day = (/* @__PURE__ */ new Date()).getDate();
	const ready = useApp((s) => s.ready);
	const hydrate = useApp((s) => s.hydrate);
	useEffect(() => {
		hydrate();
		if (typeof navigator !== "undefined") navigator.storage?.persist?.();
	}, [hydrate]);
	useEffect(() => {
		const saved = readSavedLocale();
		if (saved !== locale) setLocale(saved);
	}, []);
	useEffect(() => {
		const root = document.documentElement;
		root.classList.remove("dark");
		root.lang = locale === "zh-HK" ? "zh-HK" : "en";
		const meta = document.querySelector("meta[name=\"theme-color\"]");
		if (meta) meta.setAttribute("content", "#0284c7");
	}, [locale]);
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-dvh bg-background text-foreground",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "mx-auto flex min-h-dvh max-w-6xl",
				children: [/* @__PURE__ */ jsxs("aside", {
					className: "sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line px-3 py-6 lg:flex",
					children: [/* @__PURE__ */ jsx("div", {
						className: "px-3 pb-6 text-sm font-semibold tracking-tight",
						children: t.app
					}), /* @__PURE__ */ jsx("nav", {
						className: "flex flex-1 flex-col gap-1",
						children: tabs.map((tab) => {
							const active = isActive(pathname, tab.to);
							const Icon = tab.icon;
							const label = t.nav[tab.id];
							return /* @__PURE__ */ jsxs(Link, {
								to: tab.to,
								className: cn("flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium", active ? "bg-accent-soft text-accent" : "text-muted"),
								children: [tab.id === "today" ? /* @__PURE__ */ jsx(TodayGlyph, {
									day,
									className: "size-5"
								}) : /* @__PURE__ */ jsx(Icon, {
									className: "size-5",
									strokeWidth: 1.7
								}), label]
							}, tab.id);
						})
					})]
				}), /* @__PURE__ */ jsx("div", {
					className: "flex min-w-0 flex-1 flex-col",
					children: /* @__PURE__ */ jsx("main", {
						className: "flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0",
						children: ready ? children : /* @__PURE__ */ jsx(Loading, {})
					})
				})]
			}),
			/* @__PURE__ */ jsx("nav", {
				className: "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-nav/95 shadow-[0_-8px_24px_rgba(26,35,50,0.06)] backdrop-blur-md lg:hidden",
				children: /* @__PURE__ */ jsx("div", {
					className: "mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]",
					children: tabs.map((tab) => {
						const active = isActive(pathname, tab.to);
						const Icon = tab.icon;
						const label = t.nav[tab.id];
						return /* @__PURE__ */ jsxs(Link, {
							to: tab.to,
							className: cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px]", active ? "text-accent" : "text-muted"),
							children: [tab.id === "today" ? /* @__PURE__ */ jsx(TodayGlyph, {
								day,
								className: "size-6"
							}) : /* @__PURE__ */ jsx(Icon, {
								className: "size-6",
								strokeWidth: active ? 1.9 : 1.6
							}), label]
						}, tab.id);
					})
				})
			}),
			/* @__PURE__ */ jsx(AddFlow, {}),
			/* @__PURE__ */ jsx(SearchFlow, {}),
			/* @__PURE__ */ jsx(TxDetail, {}),
			/* @__PURE__ */ jsx(AddAccountOverlay, {}),
			/* @__PURE__ */ jsx(InfoDialog, {}),
			/* @__PURE__ */ jsx(Toaster, {
				theme: "light",
				position: "top-center",
				richColors: false
			})
		]
	});
}
function Loading() {
	return /* @__PURE__ */ jsx("div", {
		className: "flex min-h-[60dvh] items-center justify-center text-sm text-muted",
		children: "HK Life Money"
	});
}
function InfoDialog() {
	const t = useT();
	const key = useUi((s) => s.infoKey);
	const setInfoKey = useUi((s) => s.setInfoKey);
	const copy = {
		daily: {
			en: "Remaining spendable = spending cap − spending so far − monthly regulars not yet charged. Daily spendable divides that by remaining calendar days this month, including today. Guidance only — not a cash-balance guarantee.",
			zh: "剩餘可動用 = 開支上限 − 本月已花費 − 尚未扣帳的每月定期。每日可花費把該金額除以本月剩餘日數（含今天）。僅供參考，並非現金結餘保證。"
		},
		mortgage: {
			en: "Constant-rate amortisation using the current effective rate. Remaining payments include this month when the charged day has not yet arrived. End date is the last payment day. Not a lender quote.",
			zh: "以現行實際利率作固定利率攤還。若本月扣帳日尚未到，攤還表仍會列出本期供款。完結日為最後一期扣帳日。並非銀行報價。"
		},
		retirement: {
			en: "Pre-retirement saving uses the last 12 months’ average (income − expense). Target monthly is the retirement spend that saving rate can support in today’s HKD. Property is excluded from spendable capital by default.",
			zh: "退休前儲蓄取近 12 個月收入減開支的月均。目標每月是按此儲蓄推算至退休後可持續的每月開支（今日港元）。物業預設不計入可動用退休資金。"
		},
		trip: {
			en: "A trip is a date range. Spent is the sum of expenses linked to that trip. Budget used is spent ÷ cash budget. Link an expense from its detail screen or when adding it.",
			zh: "旅程是一段日期。已花費是連結到該旅程的支出總和。預算已用 = 已花費 ÷ 現金預算。可在新增支出或支出詳情把紀錄連結到進行中的旅程。"
		},
		cap: {
			en: "Remaining = cap − spending so far − monthly regulars whose charged day has not yet arrived. Forecast used also adds projected remaining non-regular spend: (spending − realized regulars) ÷ day of month × remaining days after today. The ring is green if forecast used is within the cap, amber if over by up to 10%, red if over by more.",
			zh: "剩餘 = 上限 − 本月已花費 − 扣帳日尚未到的每月定期。預測已用會再加上預計其餘非定期：（已花費 − 已實現定期）÷ 本月已過日數 × 餘下日數（不含今天）。預測未超出上限為綠，超出 10% 以內為黃，再高為紅。"
		}
	};
	const locale = useUi((s) => s.locale);
	const body = key ? copy[key] : null;
	return /* @__PURE__ */ jsx(Overlay, {
		open: !!key,
		onClose: () => setInfoKey(null),
		title: t.common.info,
		children: /* @__PURE__ */ jsx("p", {
			className: "px-5 pb-6 text-sm leading-relaxed text-muted",
			children: body ? locale === "zh-HK" ? body.zh : body.en : t.common.coming
		})
	});
}
//#endregion
//#region src/routes/_app.tsx?tsr-split=component
function AppLayout() {
	return /* @__PURE__ */ jsx(AppShell, { children: /* @__PURE__ */ jsx(Outlet, {}) });
}
//#endregion
export { AppLayout as component };
