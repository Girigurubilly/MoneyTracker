import { F as useUi, P as useT, i as useApp } from "./app-C4vqMmxY.js";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Building2, Plane, Umbrella } from "lucide-react";
//#region src/components/onboarding.tsx
function OnboardingScreen() {
	const t = useT();
	const nav = useNavigate();
	const [step, setStep] = useState(0);
	const resetSample = useApp((s) => s.resetSample);
	const clearAll = useApp((s) => s.clearAll);
	const setAddAccount = useUi((s) => s.setAddAccountOpen);
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto flex min-h-dvh max-w-md flex-col bg-background px-6 pb-10 pt-[max(3rem,env(safe-area-inset-top))]",
		children: [
			step === 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
				className: "flex-1 pt-10",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-xs font-medium uppercase tracking-[0.18em] text-muted",
						children: t.app
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "mt-4 text-4xl font-semibold tracking-tight",
						children: t.onboarding.welcome
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-4 max-w-sm text-base leading-relaxed text-muted",
						children: t.onboarding.tagline
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-10 rounded-xl bg-elevated p-4",
						children: [/* @__PURE__ */ jsx("div", {
							className: "text-xs text-muted",
							children: t.onboarding.currency
						}), /* @__PURE__ */ jsx("div", {
							className: "mt-1 text-lg font-medium",
							children: "HKD · HK$"
						})]
					})
				]
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => setStep(1),
				className: "h-12 rounded-xl bg-accent text-sm font-semibold text-on-accent",
				children: t.onboarding.next
			})] }) : null,
			step === 1 ? /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("div", {
				className: "flex-1 pt-6",
				children: [/* @__PURE__ */ jsx("h1", {
					className: "text-3xl font-semibold tracking-tight",
					children: t.onboarding.start
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-6 space-y-3",
					children: [
						/* @__PURE__ */ jsx(Choice, {
							title: t.onboarding.sample,
							onClick: async () => {
								await resetSample();
								setStep(2);
							}
						}),
						/* @__PURE__ */ jsx(Choice, {
							title: t.onboarding.account,
							onClick: async () => {
								await clearAll();
								setAddAccount(true);
								setStep(2);
							}
						}),
						/* @__PURE__ */ jsx(Choice, {
							title: t.onboarding.import,
							onClick: async () => {
								await clearAll();
								nav({
									to: "/more/$page",
									params: { page: "import" }
								});
							}
						})
					]
				})]
			}) }) : null,
			step === 2 ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex-1 pt-6",
					children: [
						/* @__PURE__ */ jsx("h1", {
							className: "text-3xl font-semibold tracking-tight",
							children: t.onboarding.later
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-2 text-sm text-muted",
							children: t.prototypeShort
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-6 space-y-3",
							children: [
								/* @__PURE__ */ jsx(Choice, {
									icon: /* @__PURE__ */ jsx(Building2, { className: "size-5" }),
									title: t.onboarding.home,
									onClick: () => nav({ to: "/reports/living" })
								}),
								/* @__PURE__ */ jsx(Choice, {
									icon: /* @__PURE__ */ jsx(Plane, { className: "size-5" }),
									title: t.onboarding.travel,
									onClick: () => nav({ to: "/reports/travel" })
								}),
								/* @__PURE__ */ jsx(Choice, {
									icon: /* @__PURE__ */ jsx(Umbrella, { className: "size-5" }),
									title: t.onboarding.retire,
									onClick: () => nav({ to: "/reports/retirement" })
								})
							]
						})
					]
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => nav({ to: "/" }),
					className: "h-12 rounded-xl bg-accent text-sm font-semibold text-on-accent",
					children: t.onboarding.enter
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => nav({ to: "/" }),
					className: "mt-2 h-11 text-sm text-muted",
					children: t.onboarding.skip
				})
			] }) : null
		]
	});
}
function Choice({ title, onClick, icon }) {
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		onClick,
		className: "flex min-h-14 w-full items-center gap-3 rounded-xl bg-elevated px-4 text-left text-[15px] font-medium",
		children: [icon, title]
	});
}
//#endregion
//#region src/routes/onboarding.tsx?tsr-split=component
var SplitComponent = OnboardingScreen;
//#endregion
export { SplitComponent as component };
