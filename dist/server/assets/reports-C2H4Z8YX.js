import { a as Hairline, c as Overlay, d as ScreenHeader, g as cn, h as TransactionRow, i as Group, m as StatusChip, o as InfoButton, r as Disclaimer, s as Metric, u as Row } from "./shared-BTv0_jzi.js";
import { F as useUi, H as ratePct, K as pickName, L as miles, M as roundMoney, P as useT, R as money, V as pct, W as todayISO, h as monthlyExpenseRegulars, i as useApp, j as monthKey, m as monthFlow, p as livingEssentials, r as newId, v as investableNow } from "./app-C4vqMmxY.js";
import { i as tripProgress, n as travelSpendYtd, r as tripCashSpent } from "./trips-DAjb_AyD.js";
import { a as lastMonthsFlow, c as rangeCategorySpend, d as withOtherCategory, i as groupSpendByParent, l as rangeFlow, n as categorySpend, r as forecastFromRecurring, s as presetRange } from "./derived-DV0RDDcs.js";
import { a as monthsUntil, c as paymentDayOf, d as stress, l as remainingInterest, n as effectiveRate, o as nextPaymentIso, r as endDateFromRemaining, s as normalizeEndDate, t as amortize, u as remainingPayments } from "./mortgage-Nd1TZLq0.js";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { BarChart3, Building2, ChevronRight, Home, LineChart, PieChart, Plane, Plus, TrendingUp, Umbrella, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart as PieChart$1, ResponsiveContainer, Tooltip, XAxis } from "recharts";
//#region src/lib/calc/retirement.ts
function realRate(nominal, inflation) {
	return (1 + nominal) / (1 + inflation) - 1;
}
function oneOffAt(age, items) {
	return items.filter((o) => o.age === age).reduce((s, o) => s + (o.direction === "in" ? o.amount : -o.amount), 0);
}
function allowanceAt(age, items) {
	return items.filter((a) => age >= a.startAge).reduce((s, a) => s + a.monthly * 12, 0);
}
function projectPath(inputs, ctx, spendMonthly = inputs.targetMonthly) {
	const pre = realRate(inputs.preReturn, inputs.inflation);
	const post = realRate(inputs.postReturn, inputs.inflation);
	let assets = ctx.investableNow;
	const series = [{
		age: inputs.currentAge,
		assets,
		phase: "pre"
	}];
	let corpusAtRetire = assets;
	let depletes = false;
	let depletionAge;
	for (let age = inputs.currentAge; age < inputs.deathAge; age++) {
		const retiring = age >= inputs.retireAge;
		if (age === inputs.retireAge) corpusAtRetire = assets;
		assets *= 1 + (retiring ? post : pre);
		if (!retiring) {
			const assumed = inputs.monthlyIncomeNow * 12 - inputs.monthlySpendNow * 12;
			const saving = ctx.monthlySaving != null ? ctx.monthlySaving * 12 : assumed;
			assets += saving;
		} else {
			assets -= spendMonthly * 12;
			assets -= inputs.travelInRetirement;
			assets -= inputs.extraHealth ?? 0;
			assets += allowanceAt(age, ctx.allowances);
		}
		assets += oneOffAt(age + 1, ctx.oneOffs);
		if (assets < 0 && !depletes) {
			depletes = true;
			depletionAge = age + 1;
			assets = 0;
		}
		series.push({
			age: age + 1,
			assets: roundMoney(assets, 0),
			phase: age + 1 >= inputs.retireAge ? "post" : "pre"
		});
	}
	if (inputs.retireAge >= inputs.deathAge) corpusAtRetire = assets;
	return {
		series,
		corpusAtRetire: roundMoney(corpusAtRetire, 0),
		depletes,
		depletionAge
	};
}
function requiredCorpus(inputs, ctx) {
	const years = Math.max(1, inputs.deathAge - inputs.retireAge);
	const post = realRate(inputs.postReturn, inputs.inflation);
	let need = 0;
	for (let i = years; i >= 1; i--) {
		const age = inputs.retireAge + i - 1;
		const spend = inputs.targetMonthly * 12 + inputs.travelInRetirement + (inputs.extraHealth ?? 0) - allowanceAt(age, ctx.allowances) - oneOffAt(age, ctx.oneOffs);
		need = (need + spend) / (1 + post);
	}
	return roundMoney(Math.max(0, need), 0);
}
function sustainableMonthly(inputs, ctx) {
	let lo = 0;
	let hi = Math.max(inputs.targetMonthly * 3, 5e3);
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		if (projectPath(inputs, ctx, mid).depletes) hi = mid;
		else lo = mid;
	}
	return roundMoney(lo, 0);
}
function extraMonthlySaving(gap, yearsToRetire, preReturn, inflation) {
	if (gap >= 0) return 0;
	const need = -gap;
	const n = Math.max(1, yearsToRetire) * 12;
	const r = realRate(preReturn, inflation) / 12;
	if (Math.abs(r) < 1e-8) return roundMoney(need / n);
	const pmt = need * r / ((1 + r) ** n - 1);
	return roundMoney(pmt);
}
function runRetirement(inputs, ctx) {
	if (inputs.retireAge <= inputs.currentAge) return emptyResult("Retirement age must be after current age.");
	if (inputs.deathAge <= inputs.retireAge) return emptyResult("Expected lifespan must be after retirement age.");
	const path = projectPath(inputs, ctx);
	const required = requiredCorpus(inputs, ctx);
	const gap = roundMoney(path.corpusAtRetire - required, 0);
	const sustainable = sustainableMonthly(inputs, ctx);
	const extra = extraMonthlySaving(gap, inputs.retireAge - inputs.currentAge, inputs.preReturn, inputs.inflation);
	const ratio = required > 0 ? path.corpusAtRetire / required : 1;
	const status = path.depletes || ratio < .9 ? "at-risk" : ratio < 1.05 ? "watch" : "on-track";
	return {
		series: path.series,
		corpusAtRetire: path.corpusAtRetire,
		requiredCorpus: required,
		gap,
		sustainableMonthly: sustainable,
		extraMonthlySaving: extra,
		depletes: path.depletes,
		depletionAge: path.depletionAge,
		lasts: !path.depletes,
		status
	};
}
function emptyResult(invalid) {
	return {
		series: [],
		corpusAtRetire: 0,
		requiredCorpus: 0,
		gap: 0,
		sustainableMonthly: 0,
		extraMonthlySaving: 0,
		depletes: true,
		lasts: false,
		status: "at-risk",
		invalid
	};
}
/** Average monthly saving (income − expense) over the last 12 calendar months including `asOfIso`. */
function savingsLast12Months(txs, rates, asOfIso) {
	const [y, m] = asOfIso.slice(0, 7).split("-").map(Number);
	let income = 0;
	let expense = 0;
	for (let i = 11; i >= 0; i--) {
		const d = new Date(y, m - 1 - i, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		const flow = monthFlow(txs, key, rates);
		income += flow.income;
		expense += flow.expense;
	}
	const net = income - expense;
	return {
		income,
		expense,
		net,
		monthly: net / 12,
		months: 12
	};
}
//#endregion
//#region src/components/reports.tsx
var pieColors = [
	"#059669",
	"#0284c7",
	"#d97706",
	"#dc2626",
	"#0369a1",
	"#64748b",
	"#0ea5e9",
	"#14b8a6"
];
var CHART_COLORS = [
	"#34d399",
	"#2dd4bf",
	"#fbbf24",
	"#ef4444",
	"#f97316",
	"#22d3ee",
	"#3b82f6",
	"#8b5cf6",
	"#84cc16",
	"#ec4899"
];
function ReportsHub() {
	const t = useT();
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.reports.title,
				large: true
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-2 text-sm font-medium text-muted",
				children: t.reports.planning
			}),
			/* @__PURE__ */ jsxs(Group, { children: [
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Home, { className: "size-4" }),
					title: t.reports.dashboard,
					to: "/reports/dashboard",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Building2, { className: "size-4" }),
					title: t.reports.living,
					to: "/reports/living",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Plane, { className: "size-4" }),
					title: t.reports.travel,
					to: "/reports/travel",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Wallet, { className: "size-4" }),
					title: t.reports.cashflow,
					to: "/reports/cashflow",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(Umbrella, { className: "size-4" }),
					title: t.reports.retirement,
					to: "/reports/retirement",
					chevron: true
				})
			] }),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
				children: t.reports.history
			}),
			/* @__PURE__ */ jsxs(Group, { children: [
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(PieChart, { className: "size-4" }),
					title: t.reports.spending,
					to: "/reports/spending",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(TrendingUp, { className: "size-4" }),
					title: t.reports.incomeExpense,
					to: "/reports/spending",
					chevron: true
				}),
				/* @__PURE__ */ jsx(Hairline, {}),
				/* @__PURE__ */ jsx(Row, {
					icon: /* @__PURE__ */ jsx(LineChart, { className: "size-4" }),
					title: t.reports.netWorth,
					to: "/reports/history",
					chevron: true
				})
			] })
		]
	});
}
function usePlanning() {
	const accounts = useApp((s) => s.accounts);
	const rates = useApp((s) => s.fxRates);
	const mortgage = useApp((s) => s.mortgage);
	const retirement = useApp((s) => s.retirement);
	const allowances = useApp((s) => s.allowances);
	const oneOffs = useApp((s) => s.oneOffs);
	const recurring = useApp((s) => s.recurring);
	const categories = useApp((s) => s.categories);
	const txs = useApp((s) => s.transactions);
	const trips = useApp((s) => s.trips);
	const annual = useApp((s) => s.annualTravelBudget);
	const snapshots = useApp((s) => s.snapshots);
	const housing = (mortgage?.monthlyPayment ?? 0) + recurring.filter((r) => r.categoryId === "mgmt" || r.categoryId === "rates").reduce((s, r) => s + r.amount, 0);
	const essential = livingEssentials(recurring);
	const travelIds = new Set(categories.filter((c) => c.theme === "travel").map((c) => c.id));
	const ytd = travelSpendYtd(txs, (/* @__PURE__ */ new Date()).getFullYear(), travelIds);
	const milesAcc = accounts.find((a) => a.type === "miles");
	const next = [...trips].sort((a, b) => a.start.localeCompare(b.start))[0];
	const retInputs = retirement ?? {
		id: "base",
		currentAge: 38,
		retireAge: 60,
		deathAge: 90,
		monthlyIncomeNow: 0,
		monthlySpendNow: 0,
		targetMonthly: 0,
		preReturn: .05,
		postReturn: .035,
		inflation: .025,
		travelInRetirement: 0
	};
	const payoffAge = mortgage && retirement ? Math.round(retirement.currentAge + mortgage.remainingMonths / 12) : retInputs.currentAge;
	const saving12 = savingsLast12Months(txs, rates, todayISO());
	const monthlySaving = Math.max(0, saving12.monthly);
	const ctx = {
		investableNow: investableNow(accounts, rates),
		mortgageMonthly: mortgage?.monthlyPayment ?? 0,
		mortgagePayoffAge: payoffAge,
		housingAfterPayoff: recurring.find((r) => r.categoryId === "mgmt")?.amount ?? 0,
		allowances,
		oneOffs,
		monthlySaving
	};
	const probed = runRetirement(retInputs, ctx);
	const targetMonthly = Math.max(0, probed.sustainableMonthly - 50);
	const result = runRetirement({
		...retInputs,
		targetMonthly
	}, ctx);
	return {
		accounts,
		rates,
		mortgage,
		retirement: {
			...retInputs,
			targetMonthly
		},
		result,
		saving12,
		monthlySaving,
		allowances,
		oneOffs,
		recurring,
		categories,
		txs,
		trips,
		annual,
		snapshots,
		housing,
		essential,
		ytd,
		milesAcc,
		next,
		payoffAge
	};
}
function LifeDashboard() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const p = usePlanning();
	const next = p.next;
	const progress = next ? tripProgress(next, todayISO()) : null;
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.reports.dashboard,
				backTo: "/reports"
			}),
			/* @__PURE__ */ jsxs(CardLink, {
				to: "/reports/living",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "text-base font-semibold",
						children: t.dashboard.living
					}), /* @__PURE__ */ jsx(StatusChip, { status: "on-track" })]
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-3 grid grid-cols-2 gap-3",
					children: [
						/* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.housingCost,
							value: money(p.housing, "HKD")
						}),
						/* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.essential,
							value: money(p.essential, "HKD")
						}),
						/* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.mortgageLeft,
							value: money(p.mortgage?.outstanding ?? 0, "HKD")
						}),
						/* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.effective,
							value: p.mortgage ? ratePct(effectiveRate(p.mortgage)) : "—"
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs(CardLink, {
				to: "/reports/travel",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "text-base font-semibold",
							children: t.dashboard.travel
						}), /* @__PURE__ */ jsx(StatusChip, { status: progress?.cashStatus ?? "on-track" })]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-3 grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.ytd,
							value: `${money(p.ytd, "HKD")} / ${money(p.annual, "HKD")}`
						}), /* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.milesBal,
							value: miles(p.milesAcc?.balance ?? 0, locale)
						})]
					}),
					next ? /* @__PURE__ */ jsxs("div", {
						className: "mt-3 text-sm text-muted",
						children: [
							t.dashboard.nextTrip,
							": ",
							pickName(locale, next.name, next.nameZh)
						]
					}) : null
				]
			}),
			/* @__PURE__ */ jsxs(CardLink, {
				to: "/reports/retirement",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "text-base font-semibold",
						children: t.dashboard.retirement
					}), /* @__PURE__ */ jsx(StatusChip, { status: p.result.status })]
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-3 grid grid-cols-2 gap-3",
					children: [
						/* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.corpus,
							value: money(p.result.corpusAtRetire, "HKD", { compact: true })
						}),
						/* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.sustainable,
							value: money(p.result.sustainableMonthly, "HKD")
						}),
						/* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.target,
							value: money(p.retirement.targetMonthly, "HKD")
						})
					]
				})]
			}),
			/* @__PURE__ */ jsx(Disclaimer, { children: t.retirement.disclaimer })
		]
	});
}
function CardLink({ to, children }) {
	return /* @__PURE__ */ jsxs(Link, {
		to,
		className: "mx-4 mt-3 block rounded-xl bg-elevated p-4",
		children: [children, /* @__PURE__ */ jsx("div", {
			className: "mt-3 flex items-center justify-end text-muted",
			children: /* @__PURE__ */ jsx(ChevronRight, { className: "size-4" })
		})]
	});
}
function HistoryReports() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const txs = useApp((s) => s.transactions);
	const rates = useApp((s) => s.fxRates);
	const categories = useApp((s) => s.categories);
	const snapshots = useApp((s) => s.snapshots);
	const month = monthKey();
	const ie = lastMonthsFlow(txs, rates, month, 6, locale);
	const pieData = categorySpend(txs, rates, month, categories).map((s) => ({
		name: locale === "zh-HK" ? s.nameZh : s.name,
		value: s.value
	}));
	const nw = [...snapshots].sort((a, b) => a.month.localeCompare(b.month)).map((s) => ({
		month: s.month,
		value: s.net
	}));
	const tooltip = {
		background: "var(--elevated)",
		border: "1px solid var(--border)",
		borderRadius: 12
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.reports.history,
				backTo: "/reports"
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pt-2 text-sm font-medium text-muted",
				children: t.reports.incomeExpense
			}),
			/* @__PURE__ */ jsx("div", {
				className: "h-52 px-2 py-2",
				children: /* @__PURE__ */ jsx(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ jsxs(BarChart, {
						data: ie,
						children: [
							/* @__PURE__ */ jsx(CartesianGrid, {
								stroke: "var(--line)",
								vertical: false
							}),
							/* @__PURE__ */ jsx(XAxis, {
								dataKey: "month",
								tick: {
									fill: "var(--muted)",
									fontSize: 11
								},
								axisLine: false,
								tickLine: false
							}),
							/* @__PURE__ */ jsx(Tooltip, {
								contentStyle: tooltip,
								formatter: (v) => money(Number(v), "HKD")
							}),
							/* @__PURE__ */ jsx(Bar, {
								dataKey: "income",
								fill: "var(--income)",
								radius: [
									4,
									4,
									0,
									0
								]
							}),
							/* @__PURE__ */ jsx(Bar, {
								dataKey: "expense",
								fill: "var(--expense)",
								radius: [
									4,
									4,
									0,
									0
								]
							})
						]
					})
				})
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pt-2 text-sm font-medium text-muted",
				children: t.reports.spending
			}),
			/* @__PURE__ */ jsx("div", {
				className: "h-52 px-2",
				children: /* @__PURE__ */ jsx(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ jsxs(PieChart$1, { children: [/* @__PURE__ */ jsx(Pie, {
						data: pieData,
						dataKey: "value",
						nameKey: "name",
						innerRadius: 48,
						outerRadius: 72,
						paddingAngle: 2,
						children: pieData.map((row, i) => /* @__PURE__ */ jsx(Cell, { fill: pieColors[i % pieColors.length] }, row.name))
					}), /* @__PURE__ */ jsx(Tooltip, {
						contentStyle: tooltip,
						formatter: (v) => money(Number(v), "HKD")
					})] })
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "px-5 text-xs text-muted",
				children: pieData.slice(0, 4).map((p) => /* @__PURE__ */ jsxs("div", {
					className: "flex justify-between py-1",
					children: [/* @__PURE__ */ jsx("span", { children: p.name }), /* @__PURE__ */ jsx("span", {
						className: "tabular-nums",
						children: money(p.value, "HKD")
					})]
				}, p.name))
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pt-4 text-sm font-medium text-muted",
				children: t.reports.netWorth
			}),
			/* @__PURE__ */ jsx("div", {
				className: "h-48 px-2",
				children: /* @__PURE__ */ jsx(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ jsxs(AreaChart, {
						data: nw,
						children: [
							/* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", {
								id: "nw",
								x1: "0",
								y1: "0",
								x2: "0",
								y2: "1",
								children: [/* @__PURE__ */ jsx("stop", {
									offset: "0%",
									stopColor: "var(--accent)",
									stopOpacity: .35
								}), /* @__PURE__ */ jsx("stop", {
									offset: "100%",
									stopColor: "var(--accent)",
									stopOpacity: 0
								})]
							}) }),
							/* @__PURE__ */ jsx(XAxis, {
								dataKey: "month",
								hide: true
							}),
							/* @__PURE__ */ jsx(Tooltip, {
								contentStyle: tooltip,
								formatter: (v) => money(Number(v), "HKD")
							}),
							/* @__PURE__ */ jsx(Area, {
								type: "monotone",
								dataKey: "value",
								stroke: "var(--accent)",
								fill: "url(#nw)",
								strokeWidth: 2
							})
						]
					})
				})
			}),
			/* @__PURE__ */ jsx(Disclaimer, { children: locale === "zh-HK" ? "轉帳不計入收支。" : "Transfers are excluded from income and spending." })
		]
	});
}
function SpendingScreen() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const txs = useApp((s) => s.transactions);
	const rates = useApp((s) => s.fxRates);
	const categories = useApp((s) => s.categories);
	const today = todayISO();
	const year = today.slice(0, 4);
	const [preset, setPreset] = useState("thisYear");
	const [customFrom, setCustomFrom] = useState(`${year}-01-01`);
	const [customTo, setCustomTo] = useState(`${year}-12-31`);
	const [kind, setKind] = useState("expense");
	const [chart, setChart] = useState("pie");
	const [groupParent, setGroupParent] = useState(true);
	const range = useMemo(() => presetRange(preset, today, txs, {
		from: customFrom,
		to: customTo
	}), [
		preset,
		today,
		txs,
		customFrom,
		customTo
	]);
	const flow = useMemo(() => rangeFlow(txs, rates, range.from, range.to), [
		txs,
		rates,
		range
	]);
	const catRows = useMemo(() => {
		if (kind === "both") return [];
		const rows = rangeCategorySpend(txs, rates, categories, range.from, range.to, kind);
		return groupParent ? groupSpendByParent(rows, categories) : rows;
	}, [
		txs,
		rates,
		categories,
		range,
		kind,
		groupParent
	]);
	const pieRows = useMemo(() => groupParent ? catRows : withOtherCategory(catRows, {
		name: t.reports.other,
		nameZh: t.reports.other
	}, 12), [
		catRows,
		groupParent,
		t.reports.other
	]);
	const total = kind === "income" ? flow.income : flow.expense;
	const pieData = pieRows.map((s) => ({
		name: locale === "zh-HK" ? s.nameZh : s.name,
		value: s.value
	}));
	const maxCat = catRows[0]?.value || 1;
	const maxFlow = Math.max(flow.income, flow.expense, 1);
	const presets = [
		{
			id: "thisMonth",
			label: t.reports.thisMonth
		},
		{
			id: "lastMonth",
			label: t.reports.lastMonth
		},
		{
			id: "thisYear",
			label: t.reports.thisYear
		},
		{
			id: "lastYear",
			label: t.reports.lastYear
		},
		{
			id: "allTime",
			label: t.reports.allTime
		},
		{
			id: "custom",
			label: t.reports.custom
		}
	];
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: kind === "both" ? t.reports.both : kind === "income" ? t.reports.income : t.reports.expenses,
				backTo: "/reports",
				right: kind === "both" ? null : /* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-label": chart === "pie" ? t.reports.bars : t.reports.pie,
					onClick: () => setChart(chart === "pie" ? "bars" : "pie"),
					className: "grid size-11 place-items-center text-accent",
					children: chart === "pie" ? /* @__PURE__ */ jsx(BarChart3, { className: "size-5" }) : /* @__PURE__ */ jsx(PieChart, { className: "size-5" })
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mx-4 overflow-hidden rounded-xl bg-elevated",
				children: /* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-2 divide-x divide-line",
					children: [/* @__PURE__ */ jsxs("label", {
						className: "px-4 py-3",
						children: [/* @__PURE__ */ jsx("span", {
							className: "block text-[11px] text-muted",
							children: t.reports.start
						}), /* @__PURE__ */ jsx("input", {
							type: "date",
							value: range.from,
							onChange: (e) => {
								setPreset("custom");
								setCustomFrom(e.target.value);
							},
							className: "mt-0.5 w-full bg-transparent text-sm outline-none"
						})]
					}), /* @__PURE__ */ jsxs("label", {
						className: "px-4 py-3",
						children: [/* @__PURE__ */ jsx("span", {
							className: "block text-[11px] text-muted",
							children: t.reports.end
						}), /* @__PURE__ */ jsx("input", {
							type: "date",
							value: range.to,
							onChange: (e) => {
								setPreset("custom");
								setCustomTo(e.target.value);
							},
							className: "mt-0.5 w-full bg-transparent text-sm outline-none"
						})]
					})]
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mt-3 flex flex-wrap gap-1.5 px-4",
				children: presets.map((p) => /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setPreset(p.id),
					className: cn("h-8 rounded-full px-3 text-xs font-medium", preset === p.id ? "bg-accent text-on-accent" : "bg-elevated text-muted"),
					children: p.label
				}, p.id))
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mt-3 px-4",
				children: /* @__PURE__ */ jsx("div", {
					className: "grid grid-cols-3 gap-1 rounded-lg bg-line p-0.5",
					children: [
						["expense", t.reports.expenses],
						["income", t.reports.income],
						["both", t.reports.both]
					].map(([id, label]) => /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setKind(id),
						className: cn("h-9 rounded-md text-sm", kind === id ? "bg-elevated font-medium text-foreground shadow-sm" : "text-muted"),
						children: label
					}, id))
				})
			}),
			kind !== "both" ? /* @__PURE__ */ jsx("div", {
				className: "mt-3 px-4",
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setGroupParent((v) => !v),
					className: cn("h-8 rounded-full px-3 text-xs font-medium", groupParent ? "bg-accent text-on-accent" : "bg-elevated text-muted"),
					children: t.reports.groupParent
				})
			}) : null,
			kind === "both" ? /* @__PURE__ */ jsxs("div", {
				className: "mt-5 space-y-3 px-4",
				children: [/* @__PURE__ */ jsx(FlowBar, {
					label: t.reports.income,
					amount: flow.income,
					max: maxFlow,
					tone: "bg-income"
				}), /* @__PURE__ */ jsx(FlowBar, {
					label: t.reports.expenses,
					amount: flow.expense,
					max: maxFlow,
					tone: "bg-expense"
				})]
			}) : catRows.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "px-5 py-12 text-center text-sm text-muted",
				children: t.reports.noData
			}) : chart === "pie" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
				className: "relative mx-auto h-64 w-full max-w-sm",
				children: [/* @__PURE__ */ jsx(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ jsx(PieChart$1, { children: /* @__PURE__ */ jsx(Pie, {
						data: pieData,
						dataKey: "value",
						nameKey: "name",
						innerRadius: 62,
						outerRadius: 92,
						paddingAngle: 1.5,
						stroke: "none",
						label: sliceLabel,
						labelLine: false,
						children: pieData.map((row, i) => /* @__PURE__ */ jsx(Cell, { fill: CHART_COLORS[i % CHART_COLORS.length] }, row.name))
					}) })
				}), /* @__PURE__ */ jsx("div", {
					className: "pointer-events-none absolute inset-0 grid place-items-center",
					children: /* @__PURE__ */ jsxs("div", {
						className: "text-center",
						children: [/* @__PURE__ */ jsx("div", {
							className: "text-sm font-semibold tabular-nums",
							children: money(total, "HKD")
						}), /* @__PURE__ */ jsx("div", {
							className: "text-[11px] text-muted",
							children: kind === "income" ? t.reports.income : t.reports.expenses
						})]
					})
				})]
			}), /* @__PURE__ */ jsx("div", {
				className: "px-5 pb-4",
				children: pieRows.map((row, i) => /* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-3 py-1.5 text-sm",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "size-3 shrink-0 rounded-sm",
							style: { background: CHART_COLORS[i % CHART_COLORS.length] }
						}),
						/* @__PURE__ */ jsx("span", {
							className: "min-w-0 flex-1 truncate",
							children: locale === "zh-HK" ? row.nameZh : row.name
						}),
						/* @__PURE__ */ jsx("span", {
							className: "tabular-nums text-muted",
							children: money(row.value, "HKD")
						})
					]
				}, row.id))
			})] }) : /* @__PURE__ */ jsx("div", {
				className: "mt-4 space-y-2 px-4",
				children: catRows.map((row, i) => {
					const pct = Math.max(12, row.value / maxCat * 100);
					return /* @__PURE__ */ jsx("div", {
						className: "overflow-hidden rounded-md",
						style: {
							width: `${pct}%`,
							background: CHART_COLORS[i % CHART_COLORS.length]
						},
						children: /* @__PURE__ */ jsxs("div", {
							className: "px-3 py-2 text-on-accent",
							children: [/* @__PURE__ */ jsx("div", {
								className: "truncate text-sm font-medium",
								children: locale === "zh-HK" ? row.nameZh : row.name
							}), /* @__PURE__ */ jsx("div", {
								className: "text-xs tabular-nums",
								children: money(row.value, "HKD")
							})]
						})
					}, row.id);
				})
			}),
			/* @__PURE__ */ jsx(Disclaimer, { children: locale === "zh-HK" ? "轉帳不計入收支。" : "Transfers are excluded from income and spending." })
		]
	});
}
function FlowBar({ label, amount, max, tone }) {
	const pct = Math.max(22, amount / max * 100);
	return /* @__PURE__ */ jsx("div", {
		className: cn("overflow-hidden rounded-md", tone),
		style: { width: `${pct}%` },
		children: /* @__PURE__ */ jsxs("div", {
			className: "px-3 py-3 text-on-accent",
			children: [/* @__PURE__ */ jsx("div", {
				className: "text-sm font-medium",
				children: label
			}), /* @__PURE__ */ jsx("div", {
				className: "text-sm tabular-nums",
				children: money(amount, "HKD")
			})]
		})
	});
}
function sliceLabel(props) {
	const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
	if (percent < .04) return null;
	const r = innerRadius + (outerRadius - innerRadius) * .55;
	const rad = -midAngle * Math.PI / 180;
	const x = cx + r * Math.cos(rad);
	const y = cy + r * Math.sin(rad);
	return /* @__PURE__ */ jsx("text", {
		x,
		y,
		fill: "var(--on-accent)",
		textAnchor: "middle",
		dominantBaseline: "central",
		fontSize: 11,
		fontWeight: 600,
		children: `${Math.round(percent * 100)}%`
	});
}
function LivingScreen() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const p = usePlanning();
	const m = p.mortgage;
	const accounts = useApp((s) => s.accounts);
	const rate = m ? effectiveRate(m) : 0;
	const today = todayISO();
	const payDay = m ? paymentDayOf(m.endDate) : 1;
	const endIso = m ? normalizeEndDate(m.endDate, payDay) ?? endDateFromRemaining(m.remainingMonths, /* @__PURE__ */ new Date(), payDay) : void 0;
	const remaining = m && endIso ? remainingPayments(endIso, today, payDay) : m?.remainingMonths ?? 0;
	const firstDue = m ? nextPaymentIso(payDay, today) : "";
	const interestLeft = m ? remainingInterest(m.outstanding, rate, remaining, m.monthlyPayment) : 0;
	const amort = m ? amortize(m.outstanding, rate, remaining, 12, m.monthlyPayment, firstDue) : [];
	const shocks = m ? [
		.5,
		1,
		2
	].map((s) => stress(m, s)) : [];
	const [edit, setEdit] = useState(false);
	const property = accounts.find((a) => a.id === m?.propertyAccountId) ?? accounts.find((a) => a.type === "property");
	const livingRows = monthlyExpenseRegulars(p.recurring).filter((r) => r.living);
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.living.title,
				backTo: "/reports",
				right: /* @__PURE__ */ jsxs("span", {
					className: "flex items-center",
					children: [/* @__PURE__ */ jsx(InfoButton, { k: "mortgage" }), /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "px-2 text-sm font-medium text-accent",
						onClick: () => setEdit(true),
						children: t.living.edit
					})]
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mx-4 rounded-xl bg-elevated p-4",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "text-xs text-muted",
						children: t.living.mode
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-1 text-base font-medium",
						children: t.living.ownerMortgage
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-3 grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.housingCost,
							value: money(p.housing, "HKD")
						}), /* @__PURE__ */ jsx(Metric, {
							label: t.dashboard.essential,
							value: money(p.essential, "HKD")
						})]
					}),
					livingRows.length ? /* @__PURE__ */ jsx("div", {
						className: "mt-3 border-t border-line pt-2",
						children: livingRows.map((r) => /* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between py-1 text-sm",
							children: [/* @__PURE__ */ jsx("span", {
								className: "min-w-0 truncate",
								children: pickName(locale, r.label, r.labelZh)
							}), /* @__PURE__ */ jsx("span", {
								className: "tabular-nums",
								children: money(r.amount, r.currency)
							})]
						}, r.id))
					}) : /* @__PURE__ */ jsx("p", {
						className: "mt-3 text-xs text-faint",
						children: t.budget.livingRegularHint
					})
				]
			}),
			m ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx("h2", {
					className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
					children: t.living.mortgage
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mx-4 rounded-xl bg-elevated p-4 text-sm",
					children: [
						/* @__PURE__ */ jsx(Line, {
							k: t.living.linkProperty,
							v: property ? pickName(locale, property.name, property.nameZh) : "—"
						}),
						/* @__PURE__ */ jsx(Line, {
							k: t.living.propertyValue,
							v: money(property?.balance ?? 0, "HKD")
						}),
						/* @__PURE__ */ jsx(Line, {
							k: t.living.owed,
							v: money(m.outstanding, "HKD")
						}),
						/* @__PURE__ */ jsx(Line, {
							k: locale === "zh-HK" ? "貸款" : "Lender",
							v: pickName(locale, m.lender, m.lenderZh)
						}),
						/* @__PURE__ */ jsx(Line, {
							k: t.living.currentRate,
							v: `${m.rateType} ${m.adjustment}%  →  ${ratePct(rate)}`
						}),
						/* @__PURE__ */ jsx(Line, {
							k: t.living.payment,
							v: money(m.monthlyPayment, "HKD")
						}),
						/* @__PURE__ */ jsx(Line, {
							k: t.living.endDate,
							v: endIso ?? "—"
						}),
						/* @__PURE__ */ jsx(Line, {
							k: t.living.remainingMonths,
							v: `${remaining} · ${Math.round(remaining / 12)} ${locale === "zh-HK" ? "年" : "years"}`
						}),
						/* @__PURE__ */ jsx(Line, {
							k: t.living.totalInterest,
							v: money(interestLeft, "HKD")
						})
					]
				}),
				/* @__PURE__ */ jsx("h2", {
					className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
					children: t.living.stress
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mx-4 overflow-hidden rounded-xl bg-elevated",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-3 px-4 py-2 text-[11px] text-muted",
						children: [
							/* @__PURE__ */ jsx("span", { children: t.living.shock }),
							/* @__PURE__ */ jsx("span", { children: t.living.newPay }),
							/* @__PURE__ */ jsx("span", { children: t.living.extraInterest })
						]
					}), shocks.map((s) => /* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-3 border-t border-line px-4 py-2 text-sm tabular-nums",
						children: [
							/* @__PURE__ */ jsxs("span", { children: [
								"+",
								s.shock.toFixed(1),
								"%"
							] }),
							/* @__PURE__ */ jsx("span", { children: money(s.payment, "HKD") }),
							/* @__PURE__ */ jsx("span", { children: money(s.extraInterest, "HKD") })
						]
					}, s.shock))]
				}),
				/* @__PURE__ */ jsx("h2", {
					className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
					children: t.living.amort
				}),
				/* @__PURE__ */ jsx("div", {
					className: "mx-4 overflow-x-auto rounded-xl bg-elevated",
					children: /* @__PURE__ */ jsxs("table", {
						className: "w-full min-w-[520px] text-left text-xs",
						children: [/* @__PURE__ */ jsx("thead", {
							className: "text-muted",
							children: /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2 font-medium",
									children: t.add.date
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2 font-medium",
									children: t.living.payment
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2 font-medium",
									children: t.living.interest
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2 font-medium",
									children: t.living.principal
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2 font-medium",
									children: t.living.closing
								})
							] })
						}), /* @__PURE__ */ jsx("tbody", {
							className: "tabular-nums",
							children: amort.map((r) => /* @__PURE__ */ jsxs("tr", {
								className: "border-t border-line",
								children: [
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: r.due || r.monthIndex
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: money(r.pay, "HKD")
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: money(r.interest, "HKD")
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: money(r.principal, "HKD")
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: money(r.close, "HKD")
									})
								]
							}, r.monthIndex))
						})]
					})
				})
			] }) : /* @__PURE__ */ jsxs("div", {
				className: "px-5 py-8",
				children: [/* @__PURE__ */ jsx("p", {
					className: "text-sm text-muted",
					children: t.living.noMortgage
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					className: "mt-4 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
					onClick: () => setEdit(true),
					children: t.living.edit
				})]
			}),
			/* @__PURE__ */ jsx(Disclaimer, { children: t.living.disclaimer }),
			/* @__PURE__ */ jsx(MortgageEditor, {
				open: edit,
				onClose: () => setEdit(false)
			})
		]
	});
}
function MortgageEditor({ open, onClose }) {
	const t = useT();
	const mortgage = useApp((s) => s.mortgage);
	return /* @__PURE__ */ jsx(Overlay, {
		open,
		onClose,
		title: t.living.edit,
		children: open ? /* @__PURE__ */ jsx(MortgageEditorBody, { onClose }, mortgage?.id ?? "new") : null
	});
}
function MortgageEditorBody({ onClose }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const accounts = useApp((s) => s.accounts);
	const mortgage = useApp((s) => s.mortgage);
	const updateMortgage = useApp((s) => s.updateMortgage);
	const updateAccount = useApp((s) => s.updateAccount);
	const properties = accounts.filter((a) => a.type === "property");
	const loans = accounts.filter((a) => a.type === "mortgage" || a.type === "loan");
	const [propertyId, setPropertyId] = useState(mortgage?.propertyAccountId ?? properties[0]?.id ?? "");
	const property = accounts.find((a) => a.id === propertyId);
	const [value, setValue] = useState(String(property?.balance ?? 0));
	const [owed, setOwed] = useState(String(mortgage?.outstanding ?? 0));
	const [rate, setRate] = useState(String(mortgage ? effectiveRate(mortgage) : 2.1));
	const [payment, setPayment] = useState(String(mortgage?.monthlyPayment ?? 0));
	const [end, setEnd] = useState(normalizeEndDate(mortgage?.endDate, paymentDayOf(mortgage?.endDate)) ?? endDateFromRemaining(mortgage?.remainingMonths ?? 216));
	const [lender, setLender] = useState(mortgage ? pickName(locale, mortgage.lender, mortgage.lenderZh) : "");
	const [loanId, setLoanId] = useState(mortgage?.accountId ?? loans[0]?.id ?? "");
	return /* @__PURE__ */ jsxs("div", {
		className: "px-5 pb-8",
		children: [
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.living.linkProperty
				}), /* @__PURE__ */ jsx("select", {
					value: propertyId,
					onChange: (e) => {
						setPropertyId(e.target.value);
						const a = accounts.find((x) => x.id === e.target.value);
						if (a) setValue(String(a.balance));
					},
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
					children: properties.map((a) => /* @__PURE__ */ jsx("option", {
						value: a.id,
						children: pickName(locale, a.name, a.nameZh)
					}, a.id))
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.living.propertyValue
				}), /* @__PURE__ */ jsx("input", {
					inputMode: "decimal",
					value,
					onChange: (e) => setValue(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.living.owed
				}), /* @__PURE__ */ jsx("input", {
					inputMode: "decimal",
					value: owed,
					onChange: (e) => setOwed(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.living.currentRate
				}), /* @__PURE__ */ jsx("input", {
					inputMode: "decimal",
					value: rate,
					onChange: (e) => setRate(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.living.payment
				}), /* @__PURE__ */ jsx("input", {
					inputMode: "decimal",
					value: payment,
					onChange: (e) => setPayment(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.living.endDate
				}), /* @__PURE__ */ jsx("input", {
					type: "date",
					value: end.length >= 10 ? end : `${end}-01`,
					onChange: (e) => setEnd(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: locale === "zh-HK" ? "貸款" : "Lender"
				}), /* @__PURE__ */ jsx("input", {
					value: lender,
					onChange: (e) => setLender(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			loans.length ? /* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.assets.mortgage
				}), /* @__PURE__ */ jsx("select", {
					value: loanId,
					onChange: (e) => setLoanId(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
					children: loans.map((a) => /* @__PURE__ */ jsx("option", {
						value: a.id,
						children: pickName(locale, a.name, a.nameZh)
					}, a.id))
				})]
			}) : null,
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
				onClick: async () => {
					const outstanding = Math.abs(Number(owed) || 0);
					const remaining = monthsUntil(end);
					const eff = Number(rate) || 0;
					const rateType = mortgage?.rateType ?? "fixed";
					const benchmark = mortgage?.benchmark ?? eff;
					const next = {
						id: mortgage?.id ?? "imported-mortgage",
						accountId: loanId || mortgage?.accountId || "mortgage",
						propertyAccountId: propertyId || void 0,
						lender: lender.trim() || "Bank",
						lenderZh: lender.trim() || "銀行",
						original: mortgage?.original ?? outstanding,
						outstanding,
						remainingMonths: remaining || mortgage?.remainingMonths || 1,
						endDate: end,
						rateType,
						benchmark,
						adjustment: rateType === "fixed" ? 0 : Math.round((eff - benchmark) * 1e4) / 1e4,
						effectiveRate: eff,
						monthlyPayment: Number(payment) || 0,
						nextReprice: mortgage?.nextReprice,
						paymentAccountId: mortgage?.paymentAccountId ?? ""
					};
					const prop = accounts.find((a) => a.id === propertyId);
					if (prop) await updateAccount({
						...prop,
						balance: Number(value) || 0
					});
					await updateMortgage(next);
					toast(t.add.savedToast);
					onClose();
				},
				children: t.add.save
			})
		]
	});
}
function Line({ k, v }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center justify-between border-b border-line py-2 last:border-0",
		children: [/* @__PURE__ */ jsx("span", {
			className: "text-muted",
			children: k
		}), /* @__PURE__ */ jsx("span", {
			className: "tabular-nums",
			children: v
		})]
	});
}
function TravelScreen() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const p = usePlanning();
	const setAdd = useUi((s) => s.setAddTripOpen);
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.travel.title,
				backTo: "/reports",
				right: /* @__PURE__ */ jsxs("span", {
					className: "flex items-center",
					children: [/* @__PURE__ */ jsx(InfoButton, { k: "trip" }), /* @__PURE__ */ jsx("button", {
						type: "button",
						"aria-label": t.travel.addTrip,
						onClick: () => setAdd(true),
						className: "grid size-11 place-items-center",
						children: /* @__PURE__ */ jsx(Plus, { className: "size-5" })
					})]
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mx-4 rounded-xl bg-elevated p-4",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "text-xs text-muted",
						children: t.travel.annual
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-1 text-xl font-semibold tabular-nums",
						children: [money(p.ytd, "HKD"), /* @__PURE__ */ jsxs("span", {
							className: "ml-2 text-sm font-normal text-muted",
							children: ["/ ", money(p.annual, "HKD")]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-3 text-sm text-muted",
						children: [
							t.travel.miles,
							": ",
							miles(p.milesAcc?.balance ?? 0, locale)
						]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-2 text-xs text-faint",
						children: t.travel.noValue
					})
				]
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
				children: t.travel.trips
			}),
			p.trips.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "px-5 py-6 text-sm text-muted",
				children: t.travel.addTrip
			}) : null,
			p.trips.map((trip) => {
				const spent = tripCashSpent(p.txs, p.rates, trip.id);
				const prog = tripProgress(trip, todayISO(), spent);
				return /* @__PURE__ */ jsxs(Link, {
					to: "/reports/travel/$id",
					params: { id: trip.id },
					className: "mx-4 mb-3 block rounded-xl bg-elevated p-4",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
								className: "font-medium",
								children: pickName(locale, trip.name, trip.nameZh)
							}), /* @__PURE__ */ jsxs("div", {
								className: "text-xs text-muted",
								children: [
									pickName(locale, trip.destinations, trip.destinationsZh),
									" · ",
									trip.start,
									trip.end ? ` → ${trip.end}` : ""
								]
							})] }), /* @__PURE__ */ jsx(StatusChip, { status: prog.cashStatus })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-3 grid grid-cols-2 gap-3 text-sm",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
								className: "text-xs text-muted",
								children: t.travel.spent
							}), /* @__PURE__ */ jsxs("div", {
								className: "tabular-nums",
								children: [
									money(prog.spent, "HKD"),
									" / ",
									money(trip.cashBudget, "HKD")
								]
							})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
								className: "text-xs text-muted",
								children: t.travel.usedPct
							}), /* @__PURE__ */ jsx("div", {
								className: "tabular-nums",
								children: pct(prog.usedRatio)
							})] })]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-2 h-1.5 overflow-hidden rounded-full bg-ring-track",
							children: /* @__PURE__ */ jsx("div", {
								className: cn("h-full rounded-full", prog.usedRatio >= 1.1 ? "bg-expense" : prog.usedRatio >= 1 ? "bg-watch" : "bg-income"),
								style: { width: `${Math.min(100, prog.usedRatio * 100)}%` }
							})
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-2 text-xs text-muted",
							children: [
								t.travel.miles,
								": ",
								miles(trip.milesSaved, locale),
								" / ",
								miles(trip.milesTarget, locale)
							]
						})
					]
				}, trip.id);
			}),
			/* @__PURE__ */ jsx(AddTripOverlay, {})
		]
	});
}
function AddTripOverlay() {
	const t = useT();
	const open = useUi((s) => s.addTripOpen);
	const setOpen = useUi((s) => s.setAddTripOpen);
	const add = useApp((s) => s.addTrip);
	const [name, setName] = useState("");
	const [dest, setDest] = useState("");
	const [start, setStart] = useState("");
	const [end, setEnd] = useState("");
	const [cash, setCash] = useState("0");
	const [milesTarget, setMiles] = useState("0");
	return /* @__PURE__ */ jsx(Overlay, {
		open,
		onClose: () => setOpen(false),
		title: t.travel.addTrip,
		children: /* @__PURE__ */ jsxs("div", {
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
				/* @__PURE__ */ jsxs("label", {
					className: "block py-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: t.travel.title
					}), /* @__PURE__ */ jsx("input", {
						value: dest,
						onChange: (e) => setDest(e.target.value),
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "block py-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: t.travel.start
					}), /* @__PURE__ */ jsx("input", {
						type: "date",
						value: start,
						onChange: (e) => {
							setStart(e.target.value);
							if (end && e.target.value && end < e.target.value) setEnd(e.target.value);
						},
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "block py-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: t.travel.end
					}), /* @__PURE__ */ jsx("input", {
						type: "date",
						value: end,
						onChange: (e) => setEnd(e.target.value),
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "block py-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: t.travel.cash
					}), /* @__PURE__ */ jsx("input", {
						inputMode: "decimal",
						value: cash,
						onChange: (e) => setCash(e.target.value),
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "block py-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: t.travel.miles
					}), /* @__PURE__ */ jsx("input", {
						inputMode: "numeric",
						value: milesTarget,
						onChange: (e) => setMiles(e.target.value),
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
					})]
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
					onClick: async () => {
						if (!name.trim() || !start || !end) return;
						const from = start <= end ? start : end;
						const to = start <= end ? end : start;
						await add({
							id: newId(),
							name: name.trim(),
							nameZh: name.trim(),
							destinations: dest.trim(),
							destinationsZh: dest.trim(),
							start: from,
							end: to,
							status: "planning",
							cashBudget: Number(cash) || 0,
							cashSaved: 0,
							milesTarget: Number(milesTarget) || 0,
							milesSaved: 0,
							monthlyCash: 0,
							monthlyMiles: 0
						});
						toast(t.add.savedToast);
						setName("");
						setDest("");
						setStart("");
						setEnd("");
						setCash("0");
						setMiles("0");
						setOpen(false);
					},
					children: t.add.save
				})
			]
		})
	});
}
function TripDetail({ id }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const setTx = useUi((s) => s.setTxDetailId);
	const trips = useApp((s) => s.trips);
	const txs = useApp((s) => s.transactions);
	const rates = useApp((s) => s.fxRates);
	const updateTrip = useApp((s) => s.updateTrip);
	const [edit, setEdit] = useState(false);
	const trip = trips.find((x) => x.id === id);
	if (!trip) return /* @__PURE__ */ jsx(ScreenHeader, {
		title: t.travel.title,
		backTo: "/reports/travel"
	});
	const spent = tripCashSpent(txs, rates, trip.id);
	const prog = tripProgress(trip, todayISO(), spent);
	const linked = txs.filter((x) => x.tripId === trip.id && x.type === "expense");
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: pickName(locale, trip.name, trip.nameZh),
				backTo: "/reports/travel",
				right: /* @__PURE__ */ jsx("button", {
					type: "button",
					className: "px-2 text-sm font-medium text-accent",
					onClick: () => setEdit(true),
					children: t.travel.editTrip
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mx-4 rounded-xl bg-elevated p-4",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "text-sm text-muted",
						children: pickName(locale, trip.destinations, trip.destinationsZh)
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-1 text-sm",
						children: [trip.start, trip.end ? ` → ${trip.end}` : ""]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-3 grid grid-cols-2 gap-3",
						children: [
							/* @__PURE__ */ jsx(Metric, {
								label: t.travel.cash,
								value: money(trip.cashBudget, "HKD")
							}),
							/* @__PURE__ */ jsx(Metric, {
								label: t.travel.spent,
								value: money(prog.spent, "HKD")
							}),
							/* @__PURE__ */ jsx(Metric, {
								label: t.travel.usedPct,
								value: pct(prog.usedRatio)
							}),
							/* @__PURE__ */ jsx(Metric, {
								label: t.travel.remaining,
								value: money(prog.cashLeft, "HKD")
							})
						]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-3 h-1.5 overflow-hidden rounded-full bg-ring-track",
						children: /* @__PURE__ */ jsx("div", {
							className: cn("h-full rounded-full", prog.usedRatio >= 1.1 ? "bg-expense" : prog.usedRatio >= 1 ? "bg-watch" : "bg-income"),
							style: { width: `${Math.min(100, prog.usedRatio * 100)}%` }
						})
					})
				]
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
				children: t.travel.linked
			}),
			/* @__PURE__ */ jsx(Hairline, {}),
			linked.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "px-5 py-6 text-sm text-muted",
				children: t.travel.linked
			}) : linked.map((tx, i) => /* @__PURE__ */ jsxs("div", { children: [i > 0 ? /* @__PURE__ */ jsx(Hairline, {}) : null, /* @__PURE__ */ jsx(TransactionRow, {
				tx,
				showDate: true,
				onClick: () => setTx(tx.id)
			})] }, tx.id)),
			/* @__PURE__ */ jsx(Disclaimer, { children: t.travel.noValue }),
			/* @__PURE__ */ jsx(Overlay, {
				open: edit,
				onClose: () => setEdit(false),
				title: t.travel.editTrip,
				children: /* @__PURE__ */ jsx(TripEditBody, {
					trip,
					onClose: () => setEdit(false),
					onSave: async (next) => {
						await updateTrip(next);
						toast(t.add.savedToast);
						setEdit(false);
					}
				})
			})
		]
	});
}
function TripEditBody({ trip, onClose, onSave }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const [name, setName] = useState(pickName(locale, trip.name, trip.nameZh));
	const [dest, setDest] = useState(pickName(locale, trip.destinations, trip.destinationsZh));
	const [start, setStart] = useState(trip.start);
	const [end, setEnd] = useState(trip.end ?? trip.start);
	const [cash, setCash] = useState(String(trip.cashBudget));
	const [milesTarget, setMiles] = useState(String(trip.milesTarget));
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
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.travel.title
				}), /* @__PURE__ */ jsx("input", {
					value: dest,
					onChange: (e) => setDest(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.travel.start
				}), /* @__PURE__ */ jsx("input", {
					type: "date",
					value: start,
					onChange: (e) => setStart(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.travel.end
				}), /* @__PURE__ */ jsx("input", {
					type: "date",
					value: end,
					onChange: (e) => setEnd(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.travel.cash
				}), /* @__PURE__ */ jsx("input", {
					inputMode: "decimal",
					value: cash,
					onChange: (e) => setCash(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.travel.miles
				}), /* @__PURE__ */ jsx("input", {
					inputMode: "numeric",
					value: milesTarget,
					onChange: (e) => setMiles(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
				onClick: async () => {
					const n = name.trim();
					if (!n || !start || !end) return;
					const from = start <= end ? start : end;
					const to = start <= end ? end : start;
					await onSave({
						...trip,
						name: n,
						nameZh: n,
						destinations: dest.trim(),
						destinationsZh: dest.trim(),
						start: from,
						end: to,
						cashBudget: Number(cash) || 0,
						milesTarget: Number(milesTarget) || 0
					});
				},
				children: t.add.save
			})
		]
	});
}
function CashflowScreen() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const recurring = useApp((s) => s.recurring);
	const data = forecastFromRecurring(recurring, monthKey(), 6, locale);
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.cashflow.title,
				backTo: "/reports"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "px-5 text-xs text-muted",
				children: t.cashflow.fromRecurring
			}),
			/* @__PURE__ */ jsx("div", {
				className: "h-52 px-2 py-2",
				children: /* @__PURE__ */ jsx(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ jsxs(BarChart, {
						data,
						children: [
							/* @__PURE__ */ jsx(CartesianGrid, {
								stroke: "var(--line)",
								vertical: false
							}),
							/* @__PURE__ */ jsx(XAxis, {
								dataKey: "month",
								tick: {
									fill: "var(--muted)",
									fontSize: 11
								},
								axisLine: false,
								tickLine: false
							}),
							/* @__PURE__ */ jsx(Tooltip, {
								contentStyle: {
									background: "var(--elevated)",
									border: "1px solid var(--border)",
									borderRadius: 12
								},
								formatter: (v) => money(Number(v), "HKD")
							}),
							/* @__PURE__ */ jsx(Bar, {
								dataKey: "inflow",
								fill: "var(--income)",
								radius: [
									4,
									4,
									0,
									0
								]
							}),
							/* @__PURE__ */ jsx(Bar, {
								dataKey: "outflow",
								fill: "var(--expense)",
								radius: [
									4,
									4,
									0,
									0
								]
							})
						]
					})
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mx-4 overflow-hidden rounded-xl bg-elevated",
				children: data.map((r) => /* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-4 border-b border-line px-4 py-2 text-sm last:border-0",
					children: [
						/* @__PURE__ */ jsx("span", { children: r.month }),
						/* @__PURE__ */ jsx("span", {
							className: "tabular-nums text-income",
							children: money(r.inflow, "HKD")
						}),
						/* @__PURE__ */ jsx("span", {
							className: "tabular-nums text-expense",
							children: money(r.outflow, "HKD")
						}),
						/* @__PURE__ */ jsx("span", {
							className: cn("tabular-nums", r.inflow - r.outflow >= 0 ? "text-income" : "text-expense"),
							children: money(r.inflow - r.outflow, "HKD", { sign: true })
						})
					]
				}, r.month))
			})
		]
	});
}
function RetirementScreen() {
	const t = useT();
	const p = usePlanning();
	const update = useApp((s) => s.updateRetirement);
	const r = p.retirement;
	const result = p.result;
	const series = result.series.map((pt) => ({
		age: pt.age,
		assets: pt.assets / 1e6
	}));
	async function patch(partial) {
		await update({
			...r,
			...partial
		});
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.retirement.title,
				backTo: "/reports",
				right: /* @__PURE__ */ jsx(InfoButton, { k: "retirement" })
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mx-4 rounded-xl bg-elevated p-4",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "font-semibold",
							children: t.retirement.outputs
						}), /* @__PURE__ */ jsx(StatusChip, { status: result.status })]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ jsx(Metric, {
								label: t.retirement.corpus,
								value: money(result.corpusAtRetire, "HKD")
							}),
							/* @__PURE__ */ jsx(Metric, {
								label: t.retirement.saving12m,
								value: money(p.monthlySaving, "HKD")
							}),
							/* @__PURE__ */ jsx(Metric, {
								label: t.retirement.target,
								value: money(r.targetMonthly, "HKD")
							}),
							/* @__PURE__ */ jsx(Metric, {
								label: t.retirement.gap,
								value: money(result.gap, "HKD", { sign: true }),
								tone: result.gap >= 0 ? "income" : "expense"
							})
						]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-3 text-xs text-muted",
						children: t.retirement.targetHint
					})
				]
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
				children: t.retirement.chart
			}),
			/* @__PURE__ */ jsx("div", {
				className: "h-52 px-2",
				children: /* @__PURE__ */ jsx(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ jsxs(AreaChart, {
						data: series,
						children: [
							/* @__PURE__ */ jsx(XAxis, {
								dataKey: "age",
								tick: {
									fill: "var(--muted)",
									fontSize: 11
								},
								axisLine: false,
								tickLine: false
							}),
							/* @__PURE__ */ jsx(Tooltip, {
								contentStyle: {
									background: "var(--elevated)",
									border: "1px solid var(--border)",
									borderRadius: 12
								},
								formatter: (v) => `HK$${Number(v).toFixed(2)}M`
							}),
							/* @__PURE__ */ jsx(Area, {
								type: "monotone",
								dataKey: "assets",
								stroke: "var(--accent)",
								fill: "var(--accent)",
								fillOpacity: .2,
								strokeWidth: 2
							})
						]
					})
				})
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-4 text-sm font-medium text-muted",
				children: t.retirement.timeline
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mx-4 rounded-xl bg-elevated p-4 text-sm",
				children: [
					/* @__PURE__ */ jsx(NumLine, {
						k: t.retirement.now,
						v: r.currentAge,
						onChange: (n) => void patch({ currentAge: n })
					}),
					/* @__PURE__ */ jsx(NumLine, {
						k: t.retirement.retire,
						v: r.retireAge,
						onChange: (n) => void patch({ retireAge: n })
					}),
					/* @__PURE__ */ jsx(NumLine, {
						k: t.retirement.death,
						v: r.deathAge,
						onChange: (n) => void patch({ deathAge: n })
					})
				]
			}),
			/* @__PURE__ */ jsx(Disclaimer, { children: t.retirement.disclaimer })
		]
	});
}
function NumLine({ k, v, onChange }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "flex items-center justify-between border-b border-line py-2 last:border-0",
		children: [/* @__PURE__ */ jsx("span", {
			className: "text-muted",
			children: k
		}), /* @__PURE__ */ jsx("input", {
			inputMode: "numeric",
			value: String(v),
			onChange: (e) => onChange(Number(e.target.value) || 0),
			className: "w-24 bg-transparent text-right tabular-nums outline-none"
		})]
	});
}
//#endregion
export { ReportsHub as a, TravelScreen as c, LivingScreen as i, TripDetail as l, HistoryReports as n, RetirementScreen as o, LifeDashboard as r, SpendingScreen as s, CashflowScreen as t };
