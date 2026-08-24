import { a as Hairline, f as SectionLabel, g as cn, h as TransactionRow, l as ProgressRing, o as InfoButton, p as Segmented, s as Metric } from "./shared-BTv0_jzi.js";
import { B as monthTitle, F as useUi, G as weekdayLabels, I as longDate, K as pickName, N as readSavedLocale, P as useT, R as money, U as shiftMonth, W as todayISO, _ as upcomingExpenseRegulars, c as asOfForMonth, f as forecastTone, i as useApp, u as chargedDayOf, z as monthGrid } from "./app-C4vqMmxY.js";
import { o as monthStats, t as activityDates } from "./derived-DV0RDDcs.js";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ChevronLeft, ChevronRight, Plus, Search, Wallet } from "lucide-react";
//#region src/components/today.tsx
function TodayScreen() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const setLocale = useUi((s) => s.setLocale);
	const selected = useUi((s) => s.selectedDate);
	const setSelected = useUi((s) => s.setSelectedDate);
	const openAdd = useUi((s) => s.openAddPicker);
	const setSearch = useUi((s) => s.setSearchOpen);
	const todayView = useUi((s) => s.todayView === "week" ? "month" : s.todayView);
	const setTodayView = useUi((s) => s.setTodayView);
	const today = todayISO();
	const onThisMonth = selected.slice(0, 7) === today.slice(0, 7);
	useEffect(() => {
		const saved = readSavedLocale();
		if (saved !== locale) setLocale(saved);
	}, []);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex min-h-[calc(100dvh-4.25rem)] flex-col lg:min-h-dvh",
		children: [/* @__PURE__ */ jsxs("header", {
			className: "px-4 pb-2 pt-[max(0.9rem,env(safe-area-inset-top))]",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-end justify-between gap-2",
					children: [/* @__PURE__ */ jsx("h1", {
						className: "whitespace-nowrap text-3xl font-semibold tracking-tight [text-wrap:nowrap]",
						children: monthTitle(selected, locale)
					}), /* @__PURE__ */ jsxs("div", {
						className: "mb-0.5 flex shrink-0 items-center",
						children: [
							/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setLocale(locale === "zh-HK" ? "en" : "zh-HK"),
								className: "grid size-11 place-items-center text-sm font-medium text-accent",
								"aria-label": t.more.language,
								children: locale === "zh-HK" ? "EN" : "中"
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								"aria-label": t.today.search,
								onClick: () => setSearch(true),
								className: "grid size-11 place-items-center text-foreground",
								children: /* @__PURE__ */ jsx(Search, {
									className: "size-6",
									strokeWidth: 1.7
								})
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								"aria-label": t.add.title,
								onClick: openAdd,
								className: "grid size-11 place-items-center text-foreground",
								children: /* @__PURE__ */ jsx(Plus, {
									className: "size-7",
									strokeWidth: 1.7
								})
							})
						]
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-1 flex items-center justify-center",
					children: [
						/* @__PURE__ */ jsx("button", {
							type: "button",
							"aria-label": t.today.prevMonth,
							onClick: () => setSelected(shiftMonth(selected, -1)),
							className: "grid size-11 place-items-center text-accent",
							children: /* @__PURE__ */ jsx(ChevronLeft, {
								className: "size-6",
								strokeWidth: 1.8
							})
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setSelected(today),
							disabled: onThisMonth,
							className: cn("min-w-16 text-center text-sm font-medium", onThisMonth ? "text-faint" : "text-accent"),
							"aria-label": t.today.jumpToday,
							children: t.today.jumpToday
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							"aria-label": t.today.nextMonth,
							onClick: () => setSelected(shiftMonth(selected, 1)),
							className: "grid size-11 place-items-center text-accent",
							children: /* @__PURE__ */ jsx(ChevronRight, {
								className: "size-6",
								strokeWidth: 1.8
							})
						})
					]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "-mx-4 mt-3",
					children: /* @__PURE__ */ jsx(Segmented, {
						value: todayView,
						onChange: (v) => setTodayView(v),
						options: [{
							id: "day",
							label: t.views.day
						}, {
							id: "month",
							label: t.views.month
						}]
					})
				})
			]
		}), /* @__PURE__ */ jsx(TodayBody, {})]
	});
}
function TodayBody() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const selected = useUi((s) => s.selectedDate);
	const setSelected = useUi((s) => s.setSelectedDate);
	const todayView = useUi((s) => s.todayView === "week" ? "month" : s.todayView);
	const firstDay = useUi((s) => s.firstDayOfWeek);
	const setTx = useUi((s) => s.setTxDetailId);
	const transactions = useApp((s) => s.transactions);
	const budgets = useApp((s) => s.budgets);
	const categories = useApp((s) => s.categories);
	const rates = useApp((s) => s.fxRates);
	const recurring = useApp((s) => s.recurring);
	const stats = monthStats(transactions, budgets, categories, rates, selected, recurring);
	const cap = stats.actuals.find((b) => b.id === "b-month-total") ?? stats.actuals.find((b) => !b.categoryId && !b.theme);
	const used = cap ? cap.spent + (cap.reserved ?? 0) + (cap.projected ?? 0) : stats.flow.expense;
	const target = cap?.monthly ?? 0;
	const today = todayISO();
	const asOf = asOfForMonth(selected.slice(0, 7), today);
	const ringTone = forecastTone(target > 0 ? used / target : 0);
	const paid = transactions.filter((x) => x.date === selected && !x.planned && x.type !== "miles").sort((a, b) => b.id.localeCompare(a.id));
	const upcoming = upcomingExpenseRegulars(recurring, asOf);
	const cells = monthGrid(selected, firstDay);
	const active = activityDates(transactions);
	const weekdays = weekdayLabels(locale, firstDay);
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			todayView === "month" ? /* @__PURE__ */ jsxs("div", {
				className: "mx-4 mb-4 rounded-xl bg-elevated px-2 py-3",
				children: [/* @__PURE__ */ jsx("div", {
					className: "grid grid-cols-7 text-center text-[11px] text-muted",
					children: weekdays.map((w) => /* @__PURE__ */ jsx("div", {
						className: "py-1",
						children: w
					}, w))
				}), /* @__PURE__ */ jsx("div", {
					className: "mt-1 grid grid-cols-7",
					children: cells.map((c, i) => c ? /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => setSelected(c.iso),
						className: cn("relative mx-auto flex size-10 flex-col items-center justify-center rounded-full text-sm", c.iso === selected && "bg-accent font-semibold text-on-accent", c.iso === today && c.iso !== selected && "font-semibold text-accent"),
						children: [c.day, active.has(c.iso) ? /* @__PURE__ */ jsx("span", { className: cn("absolute bottom-1 size-1 rounded-full", c.iso === selected ? "bg-on-accent" : "bg-accent") }) : null]
					}, c.iso) : /* @__PURE__ */ jsx("div", {}, `e-${i}`))
				})]
			}) : null,
			/* @__PURE__ */ jsxs("div", {
				className: "mx-4 mb-4 grid grid-cols-3 gap-3 rounded-xl bg-elevated px-4 py-3",
				children: [
					/* @__PURE__ */ jsx(Metric, {
						label: t.today.incomeMonth,
						value: money(stats.flow.income, "HKD"),
						tone: "income"
					}),
					/* @__PURE__ */ jsx(Metric, {
						label: t.today.expenseMonth,
						value: money(stats.flow.expense, "HKD"),
						tone: "expense"
					}),
					/* @__PURE__ */ jsx(Metric, {
						label: t.today.netMonth,
						value: money(stats.flow.net, "HKD", { sign: true }),
						tone: stats.flow.net >= 0 ? "income" : "expense"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mx-4 mb-2 grid grid-cols-3 gap-3 rounded-xl bg-elevated px-4 py-3",
				children: [
					/* @__PURE__ */ jsx(Metric, {
						label: t.today.remainingBudget,
						value: money(stats.remainingBudget, "HKD")
					}),
					/* @__PURE__ */ jsx(Metric, {
						label: t.today.remainingDisc,
						value: money(stats.remainingDisc, "HKD")
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-1 text-[11px] text-muted",
							children: [t.today.dailySpend, /* @__PURE__ */ jsx(InfoButton, { k: "daily" })]
						}), /* @__PURE__ */ jsx("div", {
							className: "mt-1 truncate text-base font-semibold tabular-nums",
							children: money(stats.daily.daily, "HKD")
						})]
					})
				]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "px-5 pb-2 text-[11px] text-faint",
				children: t.today.guidance
			}),
			/* @__PURE__ */ jsx(SectionLabel, { children: t.today.goals }),
			/* @__PURE__ */ jsx(Hairline, {}),
			/* @__PURE__ */ jsxs(Link, {
				to: "/budget",
				className: "flex w-full items-center gap-3 px-5 py-3.5 text-left",
				children: [
					/* @__PURE__ */ jsxs("span", {
						className: "relative",
						children: [/* @__PURE__ */ jsx(ProgressRing, {
							value: target ? used / target : 0,
							size: 40,
							stroke: 3,
							tone: ringTone
						}), /* @__PURE__ */ jsx("span", {
							className: cn("pointer-events-none absolute inset-0 grid place-items-center", ringTone === "expense" ? "text-expense" : ringTone === "watch" ? "text-watch" : "text-income"),
							children: /* @__PURE__ */ jsx(Wallet, {
								className: "size-3.5",
								strokeWidth: 2.2
							})
						})]
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ jsx("span", {
							className: "block text-[15px] font-medium",
							children: t.budget.monthlyTotal
						}), /* @__PURE__ */ jsxs("span", {
							className: "text-xs text-muted",
							children: [
								t.today.reservedRegulars,
								": ",
								money(cap?.reserved ?? 0, "HKD")
							]
						})]
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "text-right",
						children: [/* @__PURE__ */ jsx("span", {
							className: "block text-[15px] font-semibold tabular-nums",
							children: money(used, "HKD")
						}), /* @__PURE__ */ jsx("span", {
							className: "text-xs tabular-nums text-muted",
							children: target > 0 ? money(target, "HKD") : "—"
						})]
					})
				]
			}),
			/* @__PURE__ */ jsx(Hairline, {}),
			upcoming.length ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx(SectionLabel, { children: t.today.upcoming }),
				/* @__PURE__ */ jsx(Hairline, {}),
				upcoming.map((r, i) => /* @__PURE__ */ jsxs("div", { children: [i > 0 ? /* @__PURE__ */ jsx(Hairline, {}) : null, /* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between px-5 py-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
						className: "text-[15px]",
						children: pickName(locale, r.label, r.labelZh)
					}), /* @__PURE__ */ jsxs("div", {
						className: "text-xs text-muted",
						children: [
							t.budget.chargedDay,
							" ",
							chargedDayOf(r)
						]
					})] }), /* @__PURE__ */ jsx("div", {
						className: cn("text-[15px] tabular-nums", r.type === "income" ? "text-income" : "text-foreground"),
						children: money(r.type === "expense" ? -r.amount : r.amount, r.currency, { sign: true })
					})]
				})] }, r.id))
			] }) : null,
			/* @__PURE__ */ jsx(SectionLabel, { children: t.today.dayTx }),
			/* @__PURE__ */ jsx(Hairline, {}),
			/* @__PURE__ */ jsx("p", {
				className: "px-5 pt-2 text-xs text-muted",
				children: longDate(selected, locale)
			}),
			paid.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "px-5 py-6 text-sm text-muted",
				children: t.today.noTxDay
			}) : paid.map((tx, i) => /* @__PURE__ */ jsxs("div", { children: [i > 0 ? /* @__PURE__ */ jsx(Hairline, {}) : null, /* @__PURE__ */ jsx(TransactionRow, {
				tx,
				onClick: () => setTx(tx.id)
			})] }, tx.id))
		]
	});
}
//#endregion
//#region src/routes/_app/index.tsx?tsr-split=component
var SplitComponent = TodayScreen;
//#endregion
export { SplitComponent as component };
