import { a as Hairline, c as Overlay, d as ScreenHeader, g as cn, h as TransactionRow, i as Group, n as CategoryGlyph, r as Disclaimer, u as Row } from "./shared-BTv0_jzi.js";
import { E as groupForType, F as useUi, K as pickName, P as useT, R as money, S as ACCOUNT_TYPE_OPTIONS, i as useApp, o as accountsInGroup, r as newId, s as iconForAccountType, w as CURRENCIES, x as toHkd, y as netWorthNow } from "./app-C4vqMmxY.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ChevronDown, ChevronRight, ChevronUp, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
//#region src/components/assets.tsx
function AssetsScreen() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const accounts = useApp((s) => s.accounts);
	const rates = useApp((s) => s.fxRates);
	const setAdd = useUi((s) => s.setAddAccountOpen);
	const moveAccount = useApp((s) => s.moveAccount);
	const [showHidden, setShowHidden] = useState(false);
	const [editAcc, setEditAcc] = useState(null);
	const nw = netWorthNow(accounts, rates);
	const groups = [
		{
			id: "cash",
			title: t.assets.cash
		},
		{
			id: "credit",
			title: t.assets.credit
		},
		{
			id: "assets",
			title: t.assets.investments
		},
		{
			id: "housing",
			title: t.assets.housing
		},
		{
			id: "loyalty",
			title: t.assets.loyalty
		}
	];
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: t.assets.title,
				large: true,
				right: /* @__PURE__ */ jsx("button", {
					type: "button",
					className: "grid size-11 place-items-center",
					"aria-label": t.assets.addAccount,
					onClick: () => setAdd(true),
					children: /* @__PURE__ */ jsx(Plus, { className: "size-6" })
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mx-4 mt-2 rounded-xl bg-elevated px-4 py-4",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "text-xs text-muted",
						children: t.assets.netWorth
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-1 text-3xl font-semibold tabular-nums tracking-tight",
						children: money(nw.net, "HKD")
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-3 grid grid-cols-2 gap-3 text-sm",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
							className: "text-xs text-muted",
							children: t.assets.totalAssets
						}), /* @__PURE__ */ jsx("div", {
							className: "tabular-nums text-income",
							children: money(nw.assets, "HKD")
						})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
							className: "text-xs text-muted",
							children: t.assets.totalLiab
						}), /* @__PURE__ */ jsx("div", {
							className: "tabular-nums text-expense",
							children: money(nw.liab, "HKD")
						})] })]
					})
				]
			}),
			groups.map((g) => {
				const rows = accountsInGroup(accounts, g.id);
				if (!rows.length) return null;
				return /* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("h2", {
						className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
						children: g.title
					}),
					/* @__PURE__ */ jsx(Hairline, {}),
					rows.map((a, i) => /* @__PURE__ */ jsxs("div", { children: [i > 0 ? /* @__PURE__ */ jsx(Hairline, {}) : null, /* @__PURE__ */ jsx(AccountRow, {
						account: a,
						locale,
						onEdit: () => setEditAcc(a),
						onMoveUp: i > 0 ? () => void moveAccount(a.id, -1) : void 0,
						onMoveDown: i < rows.length - 1 ? () => void moveAccount(a.id, 1) : void 0
					})] }, a.id))
				] }, g.id);
			}),
			/* @__PURE__ */ jsx(HiddenAccounts, {
				accounts,
				locale,
				open: showHidden,
				setOpen: setShowHidden,
				onEdit: setEditAcc
			}),
			editAcc ? /* @__PURE__ */ jsx(AccountEditor, {
				open: true,
				account: editAcc,
				onClose: () => setEditAcc(null)
			}) : null
		]
	});
}
function HiddenAccounts({ accounts, locale, open, setOpen, onEdit }) {
	const t = useT();
	const hidden = accounts.filter((a) => a.hidden);
	return /* @__PURE__ */ jsxs("div", {
		className: "pt-6",
		children: [/* @__PURE__ */ jsxs("button", {
			type: "button",
			onClick: () => setOpen(!open),
			className: "flex w-full items-center justify-between px-5 py-2 text-left",
			children: [/* @__PURE__ */ jsxs("span", {
				className: "text-sm font-medium text-muted",
				children: [t.assets.hiddenSection, hidden.length ? ` · ${hidden.length}` : ""]
			}), open ? /* @__PURE__ */ jsx(ChevronDown, { className: "size-4 text-muted" }) : /* @__PURE__ */ jsx(ChevronRight, { className: "size-4 text-muted" })]
		}), open ? hidden.length ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Hairline, {}), hidden.map((a, i) => /* @__PURE__ */ jsxs("div", { children: [i > 0 ? /* @__PURE__ */ jsx(Hairline, {}) : null, /* @__PURE__ */ jsx(AccountRow, {
			account: a,
			locale,
			onEdit: () => onEdit(a)
		})] }, a.id))] }) : /* @__PURE__ */ jsx("p", {
			className: "px-5 py-4 text-sm text-muted",
			children: t.assets.hiddenEmpty
		}) : hidden.length === 0 ? /* @__PURE__ */ jsx("p", {
			className: "px-5 pb-4 text-[11px] text-faint",
			children: t.assets.hiddenHint
		}) : null]
	});
}
function AccountRow({ account, locale, onEdit, onMoveUp, onMoveDown }) {
	const t = useT();
	const rates = useApp((s) => s.fxRates);
	const native = account.currency === "MILES" ? `${Math.round(account.balance).toLocaleString("en-HK")} ${locale === "zh-HK" ? "里" : "miles"}` : money(account.balance, account.currency, { sign: true });
	const hkd = account.currency !== "HKD" && account.currency !== "MILES" ? money(toHkd(account.balance, account.currency, rates), "HKD") : null;
	const typeLabel = ACCOUNT_TYPE_OPTIONS.find((o) => o.id === account.type);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center",
		children: [
			/* @__PURE__ */ jsxs(Link, {
				to: "/assets/$id",
				params: { id: account.id },
				className: "flex min-w-0 flex-1 items-center gap-3 px-5 py-3",
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "grid size-10 place-items-center rounded-full bg-elevated ring-1 ring-line",
						children: /* @__PURE__ */ jsx(CategoryGlyph, { name: iconForAccountType(account.type) })
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ jsx("span", {
							className: "block truncate text-[15px] font-medium",
							children: pickName(locale, account.name, account.nameZh)
						}), /* @__PURE__ */ jsxs("span", {
							className: "text-xs text-muted",
							children: [typeLabel ? locale === "zh-HK" ? typeLabel.zh : typeLabel.en : account.type, account.institution ? ` · ${account.institution}` : ""]
						})]
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "text-right",
						children: [/* @__PURE__ */ jsx("span", {
							className: cn("block text-[15px] font-semibold tabular-nums", account.balance < 0 ? "text-expense" : "text-foreground"),
							children: native
						}), hkd ? /* @__PURE__ */ jsx("span", {
							className: "text-xs tabular-nums text-muted",
							children: hkd
						}) : null]
					})
				]
			}),
			onMoveUp || onMoveDown ? /* @__PURE__ */ jsxs("span", {
				className: "flex w-11 shrink-0 flex-col",
				children: [/* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-label": t.assets.moveUp,
					disabled: !onMoveUp,
					onClick: onMoveUp,
					className: "grid h-6 place-items-center text-accent disabled:text-faint",
					children: /* @__PURE__ */ jsx(ChevronUp, { className: "size-4" })
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-label": t.assets.moveDown,
					disabled: !onMoveDown,
					onClick: onMoveDown,
					className: "grid h-6 place-items-center text-accent disabled:text-faint",
					children: /* @__PURE__ */ jsx(ChevronDown, { className: "size-4" })
				})]
			}) : null,
			onEdit ? /* @__PURE__ */ jsx("button", {
				type: "button",
				"aria-label": t.common.edit,
				onClick: () => onEdit(account),
				className: "grid size-11 shrink-0 place-items-center text-accent",
				children: /* @__PURE__ */ jsx(Pencil, { className: "size-4" })
			}) : null
		]
	});
}
function AccountDetail({ id }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const setTx = useUi((s) => s.setTxDetailId);
	const accounts = useApp((s) => s.accounts);
	const transactions = useApp((s) => s.transactions);
	const mortgage = useApp((s) => s.mortgage);
	const rates = useApp((s) => s.fxRates);
	const [edit, setEdit] = useState(false);
	const account = accounts.find((a) => a.id === id);
	if (!account) return /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(ScreenHeader, {
		title: t.assets.title,
		backTo: "/assets"
	}) });
	const hist = transactions.filter((x) => x.accountId === id || x.toAccountId === id);
	const native = account.currency === "MILES" ? `${Math.round(account.balance).toLocaleString("en-HK")}` : money(account.balance, account.currency, { sign: true });
	const linkedMortgage = account.id === mortgage?.accountId || account.id === mortgage?.propertyAccountId;
	return /* @__PURE__ */ jsxs("div", {
		className: "pb-10",
		children: [
			/* @__PURE__ */ jsx(ScreenHeader, {
				title: pickName(locale, account.name, account.nameZh),
				backTo: "/assets",
				right: /* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-label": t.common.edit,
					onClick: () => setEdit(true),
					className: "grid size-11 place-items-center text-accent",
					children: /* @__PURE__ */ jsx(Pencil, { className: "size-5" })
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "px-5 pb-4 pt-2",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "text-xs text-muted",
						children: t.assets.current
					}),
					/* @__PURE__ */ jsx("div", {
						className: "text-3xl font-semibold tabular-nums",
						children: native
					}),
					account.currency !== "HKD" && account.currency !== "MILES" ? /* @__PURE__ */ jsxs("div", {
						className: "mt-1 text-sm text-muted",
						children: [
							t.assets.hkdEq,
							": ",
							money(toHkd(account.balance, account.currency, rates), "HKD")
						]
					}) : null,
					account.hidden ? /* @__PURE__ */ jsx("div", {
						className: "mt-1 text-xs text-muted",
						children: t.assets.hiddenSection
					}) : null
				]
			}),
			linkedMortgage ? /* @__PURE__ */ jsx(Group, { children: /* @__PURE__ */ jsx(Row, {
				title: t.assets.mortgage,
				subtitle: mortgage ? `${mortgage.rateType} ${mortgage.adjustment.toFixed(2)}% · ${mortgage.effectiveRate.toFixed(2)}%` : void 0,
				to: "/reports/living",
				chevron: true
			}) }) : null,
			/* @__PURE__ */ jsx("h2", {
				className: "px-5 pb-1 pt-6 text-sm font-medium text-muted",
				children: t.assets.history
			}),
			/* @__PURE__ */ jsx(Hairline, {}),
			hist.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "px-5 py-6 text-sm text-muted",
				children: "—"
			}) : hist.map((tx, i) => /* @__PURE__ */ jsxs("div", { children: [i > 0 ? /* @__PURE__ */ jsx(Hairline, {}) : null, /* @__PURE__ */ jsx(TransactionRow, {
				tx,
				showDate: true,
				onClick: () => setTx(tx.id)
			})] }, tx.id)),
			account.notes ? /* @__PURE__ */ jsx(Disclaimer, { children: pickName(locale, account.notes, account.notesZh ?? account.notes) }) : null,
			/* @__PURE__ */ jsx(AccountEditor, {
				open: edit,
				account,
				onClose: () => setEdit(false)
			})
		]
	});
}
function AccountEditor({ open, account, onClose }) {
	const t = useT();
	return /* @__PURE__ */ jsx(Overlay, {
		open,
		onClose,
		title: t.common.edit,
		children: open ? /* @__PURE__ */ jsx(AccountEditorBody, {
			account,
			onClose
		}, account.id) : null
	});
}
function AccountEditorBody({ account, onClose }) {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const updateAccount = useApp((s) => s.updateAccount);
	const updateMortgage = useApp((s) => s.updateMortgage);
	const mortgage = useApp((s) => s.mortgage);
	const [name, setName] = useState(pickName(locale, account.name, account.nameZh));
	const [type, setType] = useState(account.type);
	const [currency, setCurrency] = useState(account.currency);
	const [balance, setBalance] = useState(String(account.balance));
	const [institution, setInstitution] = useState(account.institution ?? "");
	const [include, setInclude] = useState(account.includeInNetWorth);
	const [hidden, setHidden] = useState(Boolean(account.hidden));
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
					children: t.assets.type
				}), /* @__PURE__ */ jsx("select", {
					value: type,
					onChange: (e) => {
						const next = e.target.value;
						setType(next);
						if (next === "miles") {
							setCurrency("MILES");
							setInclude(false);
						} else if (currency === "MILES") {
							setCurrency("HKD");
							setInclude(true);
						}
					},
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
					children: ACCOUNT_TYPE_OPTIONS.map((opt) => /* @__PURE__ */ jsx("option", {
						value: opt.id,
						children: locale === "zh-HK" ? opt.zh : opt.en
					}, opt.id))
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.more.currency
				}), /* @__PURE__ */ jsx("select", {
					value: currency,
					onChange: (e) => setCurrency(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
					children: [...CURRENCIES, "MILES"].map((c) => /* @__PURE__ */ jsx("option", {
						value: c,
						children: c
					}, c))
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.assets.reconcile
				}), /* @__PURE__ */ jsx("input", {
					inputMode: "decimal",
					value: balance,
					onChange: (e) => setBalance(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block py-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-xs text-muted",
					children: t.assets.institution
				}), /* @__PURE__ */ jsx("input", {
					value: institution,
					onChange: (e) => setInstitution(e.target.value),
					className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "mt-1 flex items-center justify-between py-3",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-sm",
					children: t.assets.include
				}), /* @__PURE__ */ jsx("input", {
					type: "checkbox",
					checked: include,
					onChange: (e) => setInclude(e.target.checked)
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "flex items-center justify-between py-3",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-sm",
					children: t.assets.hidden
				}), /* @__PURE__ */ jsx("input", {
					type: "checkbox",
					checked: hidden,
					onChange: (e) => setHidden(e.target.checked)
				})]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
				onClick: async () => {
					const n = name.trim();
					if (!n) return;
					const nextBal = Number(balance);
					const next = {
						...account,
						name: n,
						nameZh: n,
						type,
						currency,
						balance: Number.isFinite(nextBal) ? nextBal : account.balance,
						includeInNetWorth: type === "miles" ? false : include,
						hidden,
						group: groupForType(type),
						institution: institution.trim() || void 0
					};
					await updateAccount(next);
					if (mortgage && account.id === mortgage.accountId && Number.isFinite(nextBal)) await updateMortgage({
						...mortgage,
						outstanding: Math.abs(nextBal)
					});
					toast(t.add.savedToast);
					onClose();
				},
				children: t.add.save
			})
		]
	});
}
function AddAccountOverlay() {
	const t = useT();
	const locale = useUi((s) => s.locale);
	const open = useUi((s) => s.addAccountOpen);
	const setOpen = useUi((s) => s.setAddAccountOpen);
	const add = useApp((s) => s.addAccount);
	const [name, setName] = useState("");
	const [type, setType] = useState("current");
	const [currency, setCurrency] = useState("HKD");
	const [balance, setBalance] = useState("0");
	const [institution, setInstitution] = useState("");
	const [include, setInclude] = useState(true);
	const [hidden, setHidden] = useState(false);
	function reset() {
		setName("");
		setType("current");
		setCurrency("HKD");
		setBalance("0");
		setInstitution("");
		setInclude(true);
		setHidden(false);
	}
	return /* @__PURE__ */ jsx(Overlay, {
		open,
		onClose: () => setOpen(false),
		title: t.assets.addAccount,
		children: /* @__PURE__ */ jsxs("div", {
			className: "px-5 pb-8",
			children: [
				/* @__PURE__ */ jsxs("label", {
					className: "block py-3",
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
						children: t.assets.type
					}), /* @__PURE__ */ jsx("select", {
						value: type,
						onChange: (e) => {
							const next = e.target.value;
							setType(next);
							if (next === "miles") {
								setCurrency("MILES");
								setInclude(false);
							} else if (currency === "MILES") {
								setCurrency("HKD");
								setInclude(true);
							}
						},
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
						children: ACCOUNT_TYPE_OPTIONS.map((opt) => /* @__PURE__ */ jsx("option", {
							value: opt.id,
							children: locale === "zh-HK" ? opt.zh : opt.en
						}, opt.id))
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "block py-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: t.more.currency
					}), /* @__PURE__ */ jsx("select", {
						value: currency,
						onChange: (e) => setCurrency(e.target.value),
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none",
						children: [...CURRENCIES, "MILES"].map((c) => /* @__PURE__ */ jsx("option", {
							value: c,
							children: c
						}, c))
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "block py-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: t.assets.opening
					}), /* @__PURE__ */ jsx("input", {
						inputMode: "decimal",
						value: balance,
						onChange: (e) => setBalance(e.target.value),
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "block py-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-xs text-muted",
						children: t.assets.institution
					}), /* @__PURE__ */ jsx("input", {
						value: institution,
						onChange: (e) => setInstitution(e.target.value),
						className: "mt-1 h-11 w-full rounded-lg bg-elevated px-3 outline-none"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "mt-2 flex items-center justify-between py-3",
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-sm",
						children: t.assets.include
					}), /* @__PURE__ */ jsx("input", {
						type: "checkbox",
						checked: include,
						onChange: (e) => setInclude(e.target.checked)
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "flex items-center justify-between py-3",
					children: [/* @__PURE__ */ jsx("span", {
						className: "text-sm",
						children: t.assets.hidden
					}), /* @__PURE__ */ jsx("input", {
						type: "checkbox",
						checked: hidden,
						onChange: (e) => setHidden(e.target.checked)
					})]
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: "mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent",
					onClick: async () => {
						const n = name.trim();
						if (!n) return;
						await add({
							id: newId(),
							name: n,
							nameZh: n,
							type,
							currency,
							balance: Number(balance) || 0,
							includeInNetWorth: type === "miles" ? false : include,
							hidden,
							group: groupForType(type),
							institution: institution.trim() || void 0
						});
						toast(t.add.savedToast);
						reset();
						setOpen(false);
					},
					children: t.add.save
				})
			]
		})
	});
}
//#endregion
export { AddAccountOverlay as n, AssetsScreen as r, AccountDetail as t };
