import { c as Overlay, d as ScreenHeader, g as cn, m as StatusChip, o as InfoButton } from "./shared-BTv0_jzi.js";
import { F as useUi, K as pickName, P as useT, R as money, T as MONTH_TOTAL_BUDGET_ID, V as pct, W as todayISO, c as asOfForMonth, d as dailySpendable, h as monthlyExpenseRegulars, i as useApp, j as monthKey, l as budgetActuals, r as newId, u as chargedDayOf } from "./app-C4vqMmxY.js";
import { n as travelSpendYtd } from "./trips-DAjb_AyD.js";
import { useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
//#region src/components/budget.tsx
function BudgetScreen() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const budgets = useApp((s) => s.budgets);
	const txs = useApp((s) => s.transactions);
	const rates = useApp((s) => s.fxRates);
	const categories = useApp((s) => s.categories);
	const recurring = useApp((s) => s.recurring);
	const annual = useApp((s) => s.annualTravelBudget);
	const setAnnual = useApp((s) => s.setAnnualTravel);
	const updateBudget = useApp((s) => s.updateBudget);
	const addRecurring = useApp((s) => s.addRecurring);
	const updateRecurring = useApp((s) => s.updateRecurring);
	const deleteRecurring = useApp((s) => s.deleteRecurring);
	const month = monthKey();
	const asOf = asOfForMonth(month, todayISO());
	const actuals = budgetActuals(budgets, txs, month, rates, categories, recurring, asOf);
	const storedTotal = actuals.find((b) => b.id === MONTH_TOTAL_BUDGET_ID);
	const monthSpent = storedTotal?.spent ?? 0;
	const reserved = storedTotal?.reserved ?? 0;
	const projected = storedTotal?.projected ?? 0;
	const monthCap = storedTotal?.monthly ?? 0;
	const monthUsed = monthSpent + reserved + projected;
	const monthRemain = monthCap - monthSpent - reserved;
	const monthRatio = storedTotal?.ratio ?? (monthCap > 0 ? monthUsed / monthCap : 0);
	const daysLeft = dailySpendable(monthRemain, asOf).daysLeft;
	const forecastRemain = monthRemain - projected;
	const overForecast = monthCap > 0 && forecastRemain < 0;
	const forecastDailyGap = forecastRemain / daysLeft;
	const categoryActuals = actuals.filter((b) => b.id !== MONTH_TOTAL_BUDGET_ID);
	const travelIds = new Set(categories.filter((c) => c.theme === "travel").map((c) => c.id));
	const spent = travelSpendYtd(txs, Number(month.slice(0, 4)), travelIds);
	const travelPct = annual > 0 ? spent / annual : 0;
	const [editId, setEditId] = useState(null);
	const [draft, setDraft] = useState("");
	const [travelDraft, setTravelDraft] = useState("");
	const [editTravel, setEditTravel] = useState(false);
	const [editCap, setEditCap] = useState(false);
	const [capDraft, setCapDraft] = useState("");
	const [addOpen, setAddOpen] = useState(false);
	const [addCat, setAddCat] = useState("");
	const [addAmt, setAddAmt] = useState("");
	const [addName, setAddName] = useState("");
	const [regOpen, setRegOpen] = useState(false);
	const [editingReg, setEditingReg] = useState(null);
	const editing = categoryActuals.find((b) => b.id === editId);
	const usedCatIds = new Set(budgets.map((b) => b.categoryId).filter(Boolean));
	const freeCats = categories.filter((c) => c.kind === "expense" && !usedCatIds.has(c.id));
	function openAdd() {
		setAddCat("");
		setAddAmt("");
		setAddName("");
		setAddOpen(true);
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.budget.title,
				large: true,
				right: /* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-label": t.budget.addCategoryBudget,
					onClick: openAdd,
					className: "grid size-11 place-items-center text-accent",
					children: /* @__PURE__ */ jsx(Plus, { className: "size-6" })
				})
			}),
			/* @__PURE__ */ jsx("p", {
				className: "px-5 pb-3 text-xs text-muted",
				children: t.budget.soft
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mx-4 rounded-xl bg-elevated px-4 py-4",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-start justify-between gap-2",
						children: [/* @__PURE__ */ jsxs("button", {
							type: "button",
							className: "min-w-0 flex-1 text-left",
							onClick: () => {
								setCapDraft(String(monthCap || ""));
								setEditCap(true);
							},
							children: [/* @__PURE__ */ jsx("span", {
								className: "text-sm text-muted",
								children: t.budget.monthlyTotal
							}), /* @__PURE__ */ jsxs("div", {
								className: "mt-1 text-xl font-semibold tabular-nums",
								children: [money(monthUsed, "HKD"), /* @__PURE__ */ jsxs("span", {
									className: "ml-2 text-sm font-normal text-muted",
									children: ["/ ", monthCap > 0 ? money(monthCap, "HKD") : "—"]
								})]
							})]
						}), /* @__PURE__ */ jsx(InfoButton, { k: "cap" })]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-2 grid grid-cols-2 gap-2 text-xs text-muted",
						children: [
							/* @__PURE__ */ jsxs("span", { children: [
								t.budget.spent,
								": ",
								money(monthSpent, "HKD")
							] }),
							/* @__PURE__ */ jsxs("span", { children: [
								t.today.reservedRegulars,
								": ",
								money(reserved, "HKD")
							] }),
							projected > 0 ? /* @__PURE__ */ jsxs("span", {
								className: "col-span-2",
								children: [
									t.budget.projected,
									": ",
									money(projected, "HKD")
								]
							}) : null,
							/* @__PURE__ */ jsxs("span", {
								className: "col-span-2 font-medium text-foreground",
								children: [
									t.budget.remaining,
									": ",
									money(monthRemain, "HKD")
								]
							}),
							overForecast ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("span", {
								className: "col-span-2 font-medium text-expense",
								children: [
									t.budget.forecastShortfall,
									": ",
									money(Math.abs(forecastRemain), "HKD")
								]
							}), /* @__PURE__ */ jsxs("span", {
								className: "col-span-2 font-medium text-expense",
								children: [
									t.budget.forecastDailyGap,
									": ",
									money(forecastDailyGap, "HKD", { sign: true })
								]
							})] }) : null
						]
					}),
					monthCap > 0 ? /* @__PURE__ */ jsx(Bar, {
						value: monthRatio,
						tight: true
					}) : /* @__PURE__ */ jsx("p", {
						className: "mt-2 text-xs text-faint",
						children: t.budget.soft
					})
				]
			}),
			/* @__PURE__ */ jsx(RegularsBlock, {
				month,
				onAdd: () => {
					setEditingReg(null);
					setRegOpen(true);
				},
				onEdit: (r) => {
					setEditingReg(r);
					setRegOpen(true);
				},
				onDelete: (id) => void deleteRecurring(id)
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mx-4 mt-3 rounded-xl bg-elevated px-4 py-4",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => {
							setTravelDraft(String(annual));
							setEditTravel(true);
						},
						className: "min-w-0 flex-1 text-left",
						children: [/* @__PURE__ */ jsx("span", {
							className: "text-sm text-muted",
							children: t.budget.annualTravel
						}), /* @__PURE__ */ jsxs("div", {
							className: "mt-1 text-xl font-semibold tabular-nums",
							children: [money(spent, "HKD"), /* @__PURE__ */ jsxs("span", {
								className: "ml-2 text-sm font-normal text-muted",
								children: ["/ ", money(annual, "HKD")]
							})]
						})]
					}), /* @__PURE__ */ jsx(InfoButton, { k: "trip" })]
				}), /* @__PURE__ */ jsx(Bar, { value: travelPct })]
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
				children: t.budget.byCategory
			}),
			/* @__PURE__ */ jsx("div", {
				className: "divide-y divide-line",
				children: categoryActuals.map((b) => {
					const ratio = b.ratio;
					const status = ratio >= 1.2 ? "at-risk" : ratio >= .8 ? "watch" : "on-track";
					return /* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "w-full px-5 py-3 text-left",
						onClick: () => {
							setEditId(b.id);
							setDraft(String(b.monthly));
						},
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsx("div", {
									className: "text-[15px]",
									children: pickName(locale, b.label, b.labelZh)
								}), /* @__PURE__ */ jsxs("div", {
									className: "text-xs text-muted",
									children: [
										money(b.spent, "HKD"),
										" / ",
										money(b.monthly, "HKD"),
										" · ",
										pct(ratio),
										" ",
										t.budget.used
									]
								})]
							}), /* @__PURE__ */ jsx(StatusChip, { status })]
						}), /* @__PURE__ */ jsx(Bar, { value: ratio })]
					}, b.id);
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "px-5 pt-4",
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: openAdd,
					className: "h-11 w-full rounded-xl bg-elevated text-sm font-medium",
					children: t.budget.addCategoryBudget
				})
			}),
			/* @__PURE__ */ jsx(Overlay, {
				open: !!editing,
				onClose: () => setEditId(null),
				title: t.budget.title,
				children: /* @__PURE__ */ jsxs("div", {
					className: "px-5 pb-8",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "text-sm text-muted",
							children: editing ? pickName(locale, editing.label, editing.labelZh) : ""
						}),
						/* @__PURE__ */ jsx("input", {
							inputMode: "decimal",
							value: draft,
							onChange: (e) => setDraft(e.target.value),
							className: "mt-3 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
							onClick: async () => {
								if (!editing) return;
								await updateBudget({
									...editing,
									monthly: Number(draft) || 0,
									spent: editing.spent
								});
								toast(t.add.savedToast);
								setEditId(null);
							},
							children: t.add.save
						})
					]
				})
			}),
			/* @__PURE__ */ jsx(Overlay, {
				open: editCap,
				onClose: () => setEditCap(false),
				title: t.budget.monthlyTotal,
				children: /* @__PURE__ */ jsxs("div", {
					className: "px-5 pb-8",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "text-sm text-muted",
							children: t.budget.soft
						}),
						/* @__PURE__ */ jsx("input", {
							inputMode: "decimal",
							value: capDraft,
							onChange: (e) => setCapDraft(e.target.value),
							className: "mt-3 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
							onClick: async () => {
								await updateBudget({
									id: MONTH_TOTAL_BUDGET_ID,
									label: "Monthly total",
									labelZh: "本月總額",
									monthly: Number(capDraft) || 0,
									spent: monthSpent
								});
								toast(t.add.savedToast);
								setEditCap(false);
							},
							children: t.add.save
						})
					]
				})
			}),
			/* @__PURE__ */ jsx(Overlay, {
				open: editTravel,
				onClose: () => setEditTravel(false),
				title: t.budget.annualTravel,
				children: /* @__PURE__ */ jsxs("div", {
					className: "px-5 pb-8",
					children: [/* @__PURE__ */ jsx("input", {
						inputMode: "decimal",
						value: travelDraft,
						onChange: (e) => setTravelDraft(e.target.value),
						className: "mt-3 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
						onClick: async () => {
							await setAnnual(Number(travelDraft) || 0);
							toast(t.add.savedToast);
							setEditTravel(false);
						},
						children: t.add.save
					})]
				})
			}),
			/* @__PURE__ */ jsx(Overlay, {
				open: addOpen,
				onClose: () => setAddOpen(false),
				title: t.budget.addCategoryBudget,
				children: /* @__PURE__ */ jsxs("div", {
					className: "px-5 pb-8",
					children: [
						/* @__PURE__ */ jsxs("label", {
							className: "block py-2",
							children: [/* @__PURE__ */ jsx("span", {
								className: "text-xs text-muted",
								children: t.budget.pickCategory
							}), /* @__PURE__ */ jsxs("select", {
								value: addCat,
								onChange: (e) => setAddCat(e.target.value),
								className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
								children: [/* @__PURE__ */ jsx("option", {
									value: "",
									children: t.budget.noCategory
								}), freeCats.map((c) => /* @__PURE__ */ jsx("option", {
									value: c.id,
									children: pickName(locale, c.name, c.nameZh)
								}, c.id))]
							})]
						}),
						!addCat ? /* @__PURE__ */ jsxs("label", {
							className: "block py-2",
							children: [/* @__PURE__ */ jsx("span", {
								className: "text-xs text-muted",
								children: t.budget.customName
							}), /* @__PURE__ */ jsx("input", {
								value: addName,
								onChange: (e) => setAddName(e.target.value),
								placeholder: t.budget.monthlyTotal,
								className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
							})]
						}) : null,
						/* @__PURE__ */ jsxs("label", {
							className: "block py-2",
							children: [/* @__PURE__ */ jsx("span", {
								className: "text-xs text-muted",
								children: t.add.amount
							}), /* @__PURE__ */ jsx("input", {
								inputMode: "decimal",
								value: addAmt,
								onChange: (e) => setAddAmt(e.target.value),
								className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
							})]
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
							onClick: async () => {
								const amt = Number(addAmt) || 0;
								if (!addCat) {
									const name = addName.trim();
									if (!name) await updateBudget({
										id: MONTH_TOTAL_BUDGET_ID,
										label: "Monthly total",
										labelZh: "本月總額",
										monthly: amt,
										spent: monthSpent
									});
									else await updateBudget({
										id: `b-${newId().slice(0, 8)}`,
										label: name,
										labelZh: name,
										monthly: amt,
										spent: 0
									});
								} else {
									const cat = categories.find((c) => c.id === addCat);
									if (!cat) return;
									await updateBudget({
										id: `b-${newId().slice(0, 8)}`,
										categoryId: cat.id,
										label: cat.name,
										labelZh: cat.nameZh,
										monthly: amt,
										spent: 0
									});
								}
								toast(t.add.savedToast);
								setAddOpen(false);
							},
							children: t.add.save
						})
					]
				})
			}),
			/* @__PURE__ */ jsx(RegularEditor, {
				open: regOpen,
				initial: editingReg,
				onClose: () => {
					setRegOpen(false);
					setEditingReg(null);
				},
				onSave: async (r) => {
					if (editingReg) await updateRecurring(r);
					else await addRecurring(r);
					toast(t.add.savedToast);
					setRegOpen(false);
					setEditingReg(null);
				},
				onDelete: editingReg ? async () => {
					await deleteRecurring(editingReg.id);
					setRegOpen(false);
					setEditingReg(null);
				} : void 0
			})
		]
	});
}
function Bar({ value, tight }) {
	return /* @__PURE__ */ jsx("div", {
		className: "mt-2 h-1.5 overflow-hidden rounded-full bg-ring-track",
		children: /* @__PURE__ */ jsx("div", {
			className: cn("h-full rounded-full", tight ? value > 1.1 ? "bg-expense" : value > 1 ? "bg-watch" : "bg-income" : value >= 1.2 ? "bg-expense" : value >= 1 ? "bg-watch" : "bg-income"),
			style: { width: `${Math.min(100, value * 100)}%` }
		})
	});
}
function nextDateForDay(day) {
	const charged = Math.min(28, Math.max(1, day));
	const now = /* @__PURE__ */ new Date();
	const pad = (n) => String(n).padStart(2, "0");
	let next = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(charged)}`;
	if (next < now.toISOString().slice(0, 10)) {
		const d = new Date(now.getFullYear(), now.getMonth() + 1, charged);
		next = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}
	return next;
}
function RegularsBlock({ onAdd, onEdit }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const recurring = useApp((s) => s.recurring);
	const today = Number(todayISO().slice(8, 10));
	const rows = [...monthlyExpenseRegulars(recurring)].sort((a, b) => chargedDayOf(a) - chargedDayOf(b) || a.label.localeCompare(b.label));
	return /* @__PURE__ */ jsxs("div", {
		className: "pt-4",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between px-5 pb-1",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "text-sm font-medium text-muted",
					children: t.budget.regulars
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: onAdd,
					className: "text-sm font-medium text-accent",
					children: t.budget.addRegular
				})]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "px-5 pb-2 text-xs text-faint",
				children: t.budget.regularsHint
			}),
			rows.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "px-5 py-4 text-sm text-muted",
				children: t.budget.addRegular
			}) : /* @__PURE__ */ jsx("div", {
				className: "mx-4 overflow-hidden rounded-xl bg-elevated",
				children: rows.map((r) => {
					const day = chargedDayOf(r);
					const charged = day <= today;
					return /* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-0",
						onClick: () => onEdit(r),
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ jsx("div", {
									className: "truncate text-[15px] font-medium",
									children: pickName(locale, r.label, r.labelZh)
								}), /* @__PURE__ */ jsxs("div", {
									className: "mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted",
									children: [
										/* @__PURE__ */ jsx("span", {
											className: "tabular-nums",
											children: money(r.amount, r.currency)
										}),
										/* @__PURE__ */ jsx("span", { children: "·" }),
										/* @__PURE__ */ jsx("span", { children: locale === "zh-HK" ? `${day}日` : `day ${day}` }),
										r.living ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("span", { children: "·" }), /* @__PURE__ */ jsx("span", {
											className: "text-accent",
											children: t.reports.living
										})] }) : null
									]
								})]
							}),
							/* @__PURE__ */ jsx("span", {
								className: cn("shrink-0 rounded-full px-2 py-1 text-xs font-medium", charged ? "bg-success-soft text-income" : "bg-accent-soft text-accent"),
								children: charged ? t.budget.charged : t.budget.upcomingStatus
							}),
							/* @__PURE__ */ jsx(ChevronRight, { className: "size-4 shrink-0 text-faint" })
						]
					}, r.id);
				})
			})
		]
	});
}
function RegularEditor({ open, initial, onClose, onSave, onDelete }) {
	const t = useT();
	return /* @__PURE__ */ jsx(Overlay, {
		open,
		onClose,
		title: initial ? t.common.edit : t.budget.addRegular,
		variant: "page",
		children: open ? /* @__PURE__ */ jsx(RegularEditorBody, {
			initial,
			onSave,
			onDelete
		}, initial?.id ?? "new") : null
	});
}
function RegularEditorBody({ initial, onSave, onDelete }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const accounts = useApp((s) => s.accounts);
	const categories = useApp((s) => s.categories);
	const moneyAccounts = accounts.filter((a) => a.currency !== "MILES" && !a.hidden);
	const [name, setName] = useState(initial ? pickName(locale, initial.label, initial.labelZh) : "");
	const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
	const [day, setDay] = useState(String(initial ? chargedDayOf(initial) : 1));
	const [accountId, setAccountId] = useState(initial?.accountId ?? moneyAccounts[0]?.id ?? "");
	const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
	const [living, setLiving] = useState(Boolean(initial?.living));
	return /* @__PURE__ */ jsxs("div", {
		className: "px-5 pb-8",
		children: [
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.budget.regularName
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
					children: t.add.amount
				}), /* @__PURE__ */ jsx("input", {
					inputMode: "decimal",
					value: amount,
					onChange: (e) => setAmount(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.budget.chargedDay
				}), /* @__PURE__ */ jsx("input", {
					inputMode: "numeric",
					value: day,
					onChange: (e) => setDay(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.add.account
				}), /* @__PURE__ */ jsx("select", {
					value: accountId,
					onChange: (e) => setAccountId(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
					children: moneyAccounts.map((a) => /* @__PURE__ */ jsx("option", {
						value: a.id,
						children: pickName(locale, a.name, a.nameZh)
					}, a.id))
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.budget.pickCategory
				}), /* @__PURE__ */ jsxs("select", {
					value: categoryId,
					onChange: (e) => setCategoryId(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
					children: [/* @__PURE__ */ jsx("option", {
						value: "",
						children: t.common.none
					}), categories.filter((c) => c.kind === "expense").map((c) => /* @__PURE__ */ jsx("option", {
						value: c.id,
						children: pickName(locale, c.name, c.nameZh)
					}, c.id))]
				})]
			}),
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				onClick: () => setLiving((v) => !v),
				className: "mt-2 flex w-full items-start gap-3 rounded-xl bg-elevated px-3 py-3 text-left",
				children: [/* @__PURE__ */ jsx("span", {
					className: cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded border", living ? "border-accent bg-accent text-on-accent" : "border-line bg-background"),
					"aria-hidden": true,
					children: living ? "✓" : ""
				}), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("span", {
					className: "block text-sm font-medium",
					children: t.budget.livingRegular
				}), /* @__PURE__ */ jsx("span", {
					className: "mt-0.5 block text-xs text-muted",
					children: t.budget.livingRegularHint
				})] })]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
				onClick: async () => {
					const n = name.trim();
					if (!n || !accountId) return;
					const charged = Math.min(28, Math.max(1, Number(day) || 1));
					await onSave({
						id: initial?.id ?? `r-${newId().slice(0, 8)}`,
						type: "expense",
						label: n,
						labelZh: n,
						amount: Number(amount) || 0,
						currency: "HKD",
						accountId,
						categoryId: categoryId || void 0,
						frequency: "monthly",
						nextDate: nextDateForDay(charged),
						chargedDay: charged,
						essential: true,
						living
					});
				},
				children: t.add.save
			}),
			initial && onDelete ? /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "mt-3 h-12 w-full rounded-xl text-sm font-medium text-expense",
				onClick: () => void onDelete(),
				children: t.tx.delete
			}) : null
		]
	});
}
//#endregion
//#region src/routes/_app/budget.tsx?tsr-split=component
var SplitComponent = BudgetScreen;
//#endregion
export { SplitComponent as component };
