import { F as useUi, K as pickName, P as useT, R as money, i as useApp, n as categoryById, t as accountById } from "./app-C4vqMmxY.js";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ArrowLeft, ArrowLeftRight, BookOpen, Briefcase, Brush, Building2, Car, CircleDollarSign, Clock, Coins, CupSoda, FileText, Film, Gamepad2, Gift, GraduationCap, Heart, Home, Info, Landmark, Map, PiggyBank, Plane, RefreshCw, Shield, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Tent, Ticket, TrainFront, TrendingUp, Umbrella, User, UtensilsCrossed, Wallet, Wrench, Zap } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { createPortal } from "react-dom";
//#region src/lib/utils.ts
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
//#region src/components/shared.tsx
var iconMap = {
	utensils: UtensilsCrossed,
	shopping: ShoppingCart,
	train: TrainFront,
	car: Car,
	home: Home,
	wrench: Wrench,
	zap: Zap,
	wifi: Smartphone,
	heart: Heart,
	shield: Shield,
	graduation: GraduationCap,
	film: Film,
	sparkles: Sparkles,
	plane: Plane,
	building: Building2,
	map: Map,
	ticket: Ticket,
	umbrella: Umbrella,
	bag: ShoppingBag,
	landmark: Landmark,
	piggy: PiggyBank,
	repeat: RefreshCw,
	wallet: Wallet,
	gift: Gift,
	coins: Coins,
	trending: TrendingUp,
	briefcase: Briefcase,
	gamepad: Gamepad2,
	user: User,
	broom: Brush,
	tent: Tent,
	cup: CupSoda,
	book: BookOpen,
	file: FileText,
	clock: Clock,
	dollar: CircleDollarSign
};
function CategoryGlyph({ name, className }) {
	const Icon = name ? iconMap[name] : Wallet;
	return /* @__PURE__ */ jsx(Icon, {
		className: cn("size-5", className),
		strokeWidth: 1.6
	});
}
function AmountPill({ type, amount, currency }) {
	let text;
	if (currency === "MILES") {
		const n = Math.round(amount).toLocaleString("en-HK");
		text = type === "income" ? `+${n}` : type === "expense" ? `−${n}` : n;
	} else if (type === "transfer") text = money(Math.abs(amount), currency);
	else if (type === "expense") text = money(-Math.abs(amount), currency, { sign: true });
	else text = money(Math.abs(amount), currency, { sign: true });
	return /* @__PURE__ */ jsx("span", {
		className: cn("inline-flex min-h-8 min-w-16 items-center justify-center rounded-lg px-2.5 text-sm font-semibold tabular-nums", type === "income" && "bg-pill-income text-income", type === "expense" && "bg-pill-expense text-expense", type === "transfer" && "bg-pill-transfer text-transfer", type === "miles" && "bg-pill-miles text-miles"),
		children: text
	});
}
function ProgressRing({ value, size = 36, stroke = 3, tone = "income" }) {
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	const offset = c - Math.min(1, Math.max(0, value)) * c;
	const color = tone === "expense" ? "var(--expense)" : tone === "watch" ? "var(--watch)" : "var(--income)";
	return /* @__PURE__ */ jsxs("svg", {
		width: size,
		height: size,
		className: "shrink-0",
		"aria-hidden": true,
		children: [/* @__PURE__ */ jsx("circle", {
			cx: size / 2,
			cy: size / 2,
			r,
			fill: "none",
			stroke: "var(--ring-track)",
			strokeWidth: stroke
		}), /* @__PURE__ */ jsx("circle", {
			cx: size / 2,
			cy: size / 2,
			r,
			fill: "none",
			stroke: color,
			strokeWidth: stroke,
			strokeDasharray: c,
			strokeDashoffset: offset,
			strokeLinecap: "round",
			transform: `rotate(-90 ${size / 2} ${size / 2})`
		})]
	});
}
function StatusChip({ status }) {
	const t = useT();
	const label = status === "on-track" ? t.status.onTrack : status === "watch" ? t.status.watch : t.status.atRisk;
	return /* @__PURE__ */ jsxs("span", {
		className: cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", status === "on-track" && "bg-income/15 text-income", status === "watch" && "bg-watch/15 text-watch", status === "at-risk" && "bg-expense/15 text-expense"),
		children: [/* @__PURE__ */ jsx("span", { className: cn("size-1.5 rounded-full", status === "on-track" && "bg-income", status === "watch" && "bg-watch", status === "at-risk" && "bg-expense") }), label]
	});
}
function SectionLabel({ children, action }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center justify-between px-5 pb-1 pt-5",
		children: [/* @__PURE__ */ jsx("h2", {
			className: "text-sm font-medium text-muted",
			children
		}), action]
	});
}
function Hairline() {
	return /* @__PURE__ */ jsx("div", { className: "h-px bg-line" });
}
function ScreenHeader({ title, backTo, right, large }) {
	const t = useT();
	return /* @__PURE__ */ jsxs("header", {
		className: "flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]",
		children: [
			backTo ? /* @__PURE__ */ jsx(Link, {
				to: backTo,
				className: "inline-flex size-11 items-center justify-center rounded-full text-accent",
				"aria-label": t.common.back,
				children: /* @__PURE__ */ jsx(ArrowLeft, {
					className: "size-5",
					strokeWidth: 1.8
				})
			}) : null,
			/* @__PURE__ */ jsx("h1", {
				className: cn("min-w-0 flex-1 font-semibold tracking-tight text-foreground", large ? "text-3xl leading-tight" : "text-lg", backTo && !large && "text-center"),
				children: title
			}),
			/* @__PURE__ */ jsx("div", {
				className: "flex min-w-11 items-center justify-end gap-1",
				children: right
			})
		]
	});
}
function TransactionRow({ tx, showDate, onClick }) {
	const locale = useUi((s) => s.locale);
	const accounts = useApp((s) => s.accounts);
	const categories = useApp((s) => s.categories);
	const cat = categoryById(tx.categoryId, categories);
	const account = accountById(tx.accountId, accounts);
	const milesType = tx.milesType;
	const displayType = tx.type === "miles" ? milesType === "earn" ? "income" : milesType === "burn" || milesType === "expiry" ? "expense" : "miles" : tx.type;
	const iconName = tx.type === "miles" ? "plane" : tx.type === "transfer" ? "repeat" : cat?.icon;
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		onClick,
		className: "flex w-full items-center gap-3 px-5 py-3 text-left",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "grid size-10 shrink-0 place-items-center rounded-full bg-elevated text-foreground ring-1 ring-line",
				children: tx.type === "transfer" ? /* @__PURE__ */ jsx(ArrowLeftRight, {
					className: "size-5",
					strokeWidth: 1.6
				}) : /* @__PURE__ */ jsx(CategoryGlyph, { name: iconName })
			}),
			/* @__PURE__ */ jsxs("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ jsx("span", {
					className: "block truncate text-[15px] font-medium text-foreground",
					children: pickName(locale, tx.payee, tx.payeeZh)
				}), /* @__PURE__ */ jsxs("span", {
					className: "mt-0.5 block truncate text-xs text-muted",
					children: [
						showDate ? /* @__PURE__ */ jsxs(Fragment, { children: [locale === "zh-HK" ? `${Number(tx.date.slice(5, 7))}月 ${Number(tx.date.slice(8, 10))}` : tx.date.slice(5), " · "] }) : null,
						account ? pickName(locale, account.name, account.nameZh) : null,
						tx.planned ? locale === "zh-HK" ? " · 計劃" : " · planned" : null
					]
				})]
			}),
			/* @__PURE__ */ jsx(AmountPill, {
				type: displayType,
				amount: tx.amount,
				currency: tx.currency
			})
		]
	});
}
function Row({ icon, title, subtitle, trailing, onClick, to, chevron }) {
	const inner = /* @__PURE__ */ jsxs(Fragment, { children: [
		icon ? /* @__PURE__ */ jsx("span", {
			className: "grid size-9 shrink-0 place-items-center rounded-[10px] bg-background text-foreground",
			children: icon
		}) : null,
		/* @__PURE__ */ jsxs("span", {
			className: "min-w-0 flex-1",
			children: [/* @__PURE__ */ jsx("span", {
				className: "block truncate text-[15px] text-foreground",
				children: title
			}), subtitle ? /* @__PURE__ */ jsx("span", {
				className: "mt-0.5 block truncate text-xs text-muted",
				children: subtitle
			}) : null]
		}),
		trailing ? /* @__PURE__ */ jsx("span", {
			className: "shrink-0 text-[15px] tabular-nums text-muted",
			children: trailing
		}) : null,
		chevron ? /* @__PURE__ */ jsx("span", {
			className: "pl-1 text-lg leading-none text-faint",
			"aria-hidden": true,
			children: "›"
		}) : null
	] });
	const cls = "flex w-full items-center gap-3 px-5 py-3 text-left";
	if (to) return /* @__PURE__ */ jsx(Link, {
		to,
		className: cls,
		children: inner
	});
	if (onClick) return /* @__PURE__ */ jsx("button", {
		type: "button",
		onClick,
		className: cls,
		children: inner
	});
	return /* @__PURE__ */ jsx("div", {
		className: cls,
		children: inner
	});
}
function Group({ children }) {
	return /* @__PURE__ */ jsx("div", {
		className: "mx-4 overflow-hidden rounded-xl bg-elevated",
		children
	});
}
function Disclaimer({ children }) {
	return /* @__PURE__ */ jsx("p", {
		className: "px-5 py-4 text-xs leading-relaxed text-muted",
		children
	});
}
function InfoButton({ k }) {
	const t = useT();
	const setInfoKey = useUi((s) => s.setInfoKey);
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		"aria-label": t.common.info,
		onClick: () => setInfoKey(k),
		className: "inline-flex size-8 items-center justify-center rounded-full text-muted",
		children: /* @__PURE__ */ jsx(Info, {
			className: "size-4",
			strokeWidth: 1.8
		})
	});
}
function Segmented({ value, onChange, options }) {
	return /* @__PURE__ */ jsx("div", {
		className: "mx-4 grid auto-cols-fr grid-flow-col rounded-lg bg-line p-0.5",
		children: options.map((o) => /* @__PURE__ */ jsx("button", {
			type: "button",
			onClick: () => onChange(o.id),
			className: cn("h-8 rounded-md text-sm font-medium transition-colors duration-150", value === o.id ? "bg-elevated text-foreground shadow-sm" : "text-muted"),
			children: o.label
		}, o.id))
	});
}
function Metric({ label, value, tone }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ jsx("div", {
			className: "text-[11px] text-muted",
			children: label
		}), /* @__PURE__ */ jsx("div", {
			className: cn("mt-1 text-base font-semibold tabular-nums leading-snug", tone === "income" && "text-income", tone === "expense" && "text-expense", !tone && "text-foreground"),
			children: value
		})]
	});
}
function Overlay({ open, onClose, children, title, variant = "sheet" }) {
	const t = useT();
	useEffect(() => {
		if (!open) return;
		function onKey(e) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose]);
	if (!open) return null;
	const page = variant === "page";
	const sheet = /* @__PURE__ */ jsxs("div", {
		className: cn("fixed inset-0 grid", page ? "z-[92] bg-background" : "z-[90] place-items-end md:place-items-center"),
		children: [page ? null : /* @__PURE__ */ jsx("button", {
			type: "button",
			className: "absolute inset-0 scrim",
			"aria-label": t.common.close,
			onClick: onClose
		}), /* @__PURE__ */ jsxs("div", {
			className: cn("relative z-[81] w-full overflow-y-auto bg-background", page ? "h-dvh max-h-dvh pb-[max(1rem,env(safe-area-inset-bottom))]" : "max-h-[92dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] md:max-w-md md:rounded-2xl"),
			children: [
				page ? null : /* @__PURE__ */ jsx("div", { className: "mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" }),
				title ? /* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between px-5 pb-2 pt-3",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "text-base font-semibold",
						children: title
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onClose,
						className: "text-sm text-accent",
						children: t.common.close
					})]
				}) : null,
				children
			]
		})]
	});
	if (typeof document === "undefined") return sheet;
	return createPortal(sheet, document.body);
}
//#endregion
export { Hairline as a, Overlay as c, ScreenHeader as d, SectionLabel as f, cn as g, TransactionRow as h, Group as i, ProgressRing as l, StatusChip as m, CategoryGlyph as n, InfoButton as o, Segmented as p, Disclaimer as r, Metric as s, AmountPill as t, Row as u };
