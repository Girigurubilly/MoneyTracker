import { useEffect } from "react";
import { HeadContent, Outlet, createFileRoute, createRootRoute, createRouter, lazyRouteComponent, useRouter } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { TriangleAlert } from "lucide-react";
import { z } from "zod";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region src/lib/error-component.tsx
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ jsxs("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "text-expense",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ jsx("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-md text-sm break-words text-muted",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
//#endregion
//#region src/lib/public-url.ts
/** Prefix a public asset path with the Vite base (needed on GitHub Pages project sites). */
function publicUrl(path) {
	return `/MoneyTracker/${path.replace(/^\//, "")}`;
}
function routerBasepath() {
	return "/MoneyTracker/".replace(/\/$/, "");
}
//#endregion
//#region src/lib/auth/provider.tsx
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ jsx(Fragment, { children });
}
//#endregion
//#region src/lib/preview-embedder-origin.ts
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
//#endregion
//#region src/lib/preview-host-bridge.ts
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = z.object({
	channel: z.literal(PREVIEW_BRIDGE_CHANNEL),
	version: z.number().int().positive(),
	type: z.string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: z.literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: z.literal("navigate"),
	path: z.string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: z.literal("history"),
	delta: z.union([z.literal(-1), z.literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
//#endregion
//#region src/components/preview-host-bridge.tsx
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	useEffect(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
//#endregion
//#region src/styles.css?url
var styles_default = "/MoneyTracker/assets/styles-BxdLDbdm.css";
//#endregion
//#region src/routes/__root.tsx
var APP_NAME = "HK Life Money";
var Route$21 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#0284c7"
			},
			{
				name: "description",
				content: "Privacy-first personal finance for Hong Kong — daily tracking, home, travel, and retirement planning."
			},
			{
				name: "apple-mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "default"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: publicUrl("favicon.svg")
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: publicUrl("__grok/manifest.webmanifest")
			},
			{
				rel: "apple-touch-icon",
				href: publicUrl("__grok/icon-180.png")
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Noto+Sans+TC:wght@400;500;600;700&display=swap"
			}
		]
	}),
	component: RootDocument
});
function RootDocument() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx(HeadContent, {}),
		/* @__PURE__ */ jsx(PreviewHostBridge, {}),
		/* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(Outlet, {}) })
	] });
}
//#endregion
//#region src/routes/_app.tsx
var $$splitComponentImporter$20 = () => import("./_app-Cj8LSavn.js");
var Route$20 = createFileRoute("/_app")({ component: lazyRouteComponent($$splitComponentImporter$20, "component") });
//#endregion
//#region src/routes/onboarding.tsx
var $$splitComponentImporter$19 = () => import("./onboarding-BnFELQWT.js");
var Route$19 = createFileRoute("/onboarding")({ component: lazyRouteComponent($$splitComponentImporter$19, "component") });
//#endregion
//#region src/routes/_app/index.tsx
var $$splitComponentImporter$18 = () => import("./_app-DfKQ-6bc.js");
var Route$18 = createFileRoute("/_app/")({ component: lazyRouteComponent($$splitComponentImporter$18, "component") });
//#endregion
//#region src/routes/_app/assets.tsx
var $$splitComponentImporter$17 = () => import("./assets-BQ5j53dP.js");
var Route$17 = createFileRoute("/_app/assets")({ component: lazyRouteComponent($$splitComponentImporter$17, "component") });
//#endregion
//#region src/routes/_app/budget.tsx
var $$splitComponentImporter$16 = () => import("./budget-DqO9ZgFz.js");
var Route$16 = createFileRoute("/_app/budget")({ component: lazyRouteComponent($$splitComponentImporter$16, "component") });
//#endregion
//#region src/routes/_app/more.tsx
var $$splitComponentImporter$15 = () => import("./more-BQpubATd.js");
var Route$15 = createFileRoute("/_app/more")({ component: lazyRouteComponent($$splitComponentImporter$15, "component") });
//#endregion
//#region src/routes/_app/reports.tsx
var $$splitComponentImporter$14 = () => import("./reports-vsvcmrNp.js");
var Route$14 = createFileRoute("/_app/reports")({ component: lazyRouteComponent($$splitComponentImporter$14, "component") });
//#endregion
//#region src/routes/_app/assets.index.tsx
var $$splitComponentImporter$13 = () => import("./assets.index-J25a1Pc9.js");
var Route$13 = createFileRoute("/_app/assets/")({ component: lazyRouteComponent($$splitComponentImporter$13, "component") });
//#endregion
//#region src/routes/_app/assets.$id.tsx
var $$splitComponentImporter$12 = () => import("./assets._id-BHGvlJ9k.js");
var Route$12 = createFileRoute("/_app/assets/$id")({ component: lazyRouteComponent($$splitComponentImporter$12, "component") });
//#endregion
//#region src/routes/_app/more.index.tsx
var $$splitComponentImporter$11 = () => import("./more.index-CIdHhi57.js");
var Route$11 = createFileRoute("/_app/more/")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
//#endregion
//#region src/routes/_app/more.$page.tsx
var $$splitComponentImporter$10 = () => import("./more._page-z9CgqbVY.js");
var Route$10 = createFileRoute("/_app/more/$page")({ component: lazyRouteComponent($$splitComponentImporter$10, "component") });
//#endregion
//#region src/routes/_app/reports.index.tsx
var $$splitComponentImporter$9 = () => import("./reports.index-BB735I3j.js");
var Route$9 = createFileRoute("/_app/reports/")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
//#endregion
//#region src/routes/_app/reports.cashflow.tsx
var $$splitComponentImporter$8 = () => import("./reports.cashflow-tzgBjITv.js");
var Route$8 = createFileRoute("/_app/reports/cashflow")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
//#endregion
//#region src/routes/_app/reports.dashboard.tsx
var $$splitComponentImporter$7 = () => import("./reports.dashboard-yxU5FqeY.js");
var Route$7 = createFileRoute("/_app/reports/dashboard")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
//#endregion
//#region src/routes/_app/reports.history.tsx
var $$splitComponentImporter$6 = () => import("./reports.history-u2YEzYJU.js");
var Route$6 = createFileRoute("/_app/reports/history")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
//#endregion
//#region src/routes/_app/reports.living.tsx
var $$splitComponentImporter$5 = () => import("./reports.living-6q6Xobw1.js");
var Route$5 = createFileRoute("/_app/reports/living")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
//#endregion
//#region src/routes/_app/reports.retirement.tsx
var $$splitComponentImporter$4 = () => import("./reports.retirement-C2DxRnc9.js");
var Route$4 = createFileRoute("/_app/reports/retirement")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
//#endregion
//#region src/routes/_app/reports.spending.tsx
var $$splitComponentImporter$3 = () => import("./reports.spending-B-VEoHhQ.js");
var Route$3 = createFileRoute("/_app/reports/spending")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
//#endregion
//#region src/routes/_app/reports.travel.tsx
var $$splitComponentImporter$2 = () => import("./reports.travel-yWOEuqaZ.js");
var Route$2 = createFileRoute("/_app/reports/travel")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
//#endregion
//#region src/routes/_app/reports.travel.index.tsx
var $$splitComponentImporter$1 = () => import("./reports.travel.index-Ls7d_u-W.js");
var Route$1 = createFileRoute("/_app/reports/travel/")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
//#endregion
//#region src/routes/_app/reports.travel.$id.tsx
var $$splitComponentImporter = () => import("./reports.travel._id-9v_fHNcY.js");
var Route = createFileRoute("/_app/reports/travel/$id")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
//#endregion
//#region src/routeTree.gen.ts
var AppRoute = Route$20.update({
	id: "/_app",
	getParentRoute: () => Route$21
});
var OnboardingRoute = Route$19.update({
	id: "/onboarding",
	path: "/onboarding",
	getParentRoute: () => Route$21
});
var AppIndexRoute = Route$18.update({
	id: "/",
	path: "/",
	getParentRoute: () => AppRoute
});
var AppAssetsRoute = Route$17.update({
	id: "/assets",
	path: "/assets",
	getParentRoute: () => AppRoute
});
var AppBudgetRoute = Route$16.update({
	id: "/budget",
	path: "/budget",
	getParentRoute: () => AppRoute
});
var AppMoreRoute = Route$15.update({
	id: "/more",
	path: "/more",
	getParentRoute: () => AppRoute
});
var AppReportsRoute = Route$14.update({
	id: "/reports",
	path: "/reports",
	getParentRoute: () => AppRoute
});
var AppAssetsIndexRoute = Route$13.update({
	id: "/",
	path: "/",
	getParentRoute: () => AppAssetsRoute
});
var AppAssetsIdRoute = Route$12.update({
	id: "/$id",
	path: "/$id",
	getParentRoute: () => AppAssetsRoute
});
var AppMoreIndexRoute = Route$11.update({
	id: "/",
	path: "/",
	getParentRoute: () => AppMoreRoute
});
var AppMorePageRoute = Route$10.update({
	id: "/$page",
	path: "/$page",
	getParentRoute: () => AppMoreRoute
});
var AppReportsIndexRoute = Route$9.update({
	id: "/",
	path: "/",
	getParentRoute: () => AppReportsRoute
});
var AppReportsCashflowRoute = Route$8.update({
	id: "/cashflow",
	path: "/cashflow",
	getParentRoute: () => AppReportsRoute
});
var AppReportsDashboardRoute = Route$7.update({
	id: "/dashboard",
	path: "/dashboard",
	getParentRoute: () => AppReportsRoute
});
var AppReportsHistoryRoute = Route$6.update({
	id: "/history",
	path: "/history",
	getParentRoute: () => AppReportsRoute
});
var AppReportsLivingRoute = Route$5.update({
	id: "/living",
	path: "/living",
	getParentRoute: () => AppReportsRoute
});
var AppReportsRetirementRoute = Route$4.update({
	id: "/retirement",
	path: "/retirement",
	getParentRoute: () => AppReportsRoute
});
var AppReportsSpendingRoute = Route$3.update({
	id: "/spending",
	path: "/spending",
	getParentRoute: () => AppReportsRoute
});
var AppReportsTravelRoute = Route$2.update({
	id: "/travel",
	path: "/travel",
	getParentRoute: () => AppReportsRoute
});
var AppReportsTravelIndexRoute = Route$1.update({
	id: "/",
	path: "/",
	getParentRoute: () => AppReportsTravelRoute
});
var AppReportsTravelIdRoute = Route.update({
	id: "/$id",
	path: "/$id",
	getParentRoute: () => AppReportsTravelRoute
});
var AppAssetsRouteChildren = {
	AppAssetsIdRoute,
	AppAssetsIndexRoute
};
var AppAssetsRouteWithChildren = AppAssetsRoute._addFileChildren(AppAssetsRouteChildren);
var AppMoreRouteChildren = {
	AppMorePageRoute,
	AppMoreIndexRoute
};
var AppMoreRouteWithChildren = AppMoreRoute._addFileChildren(AppMoreRouteChildren);
var AppReportsTravelRouteChildren = {
	AppReportsTravelIdRoute,
	AppReportsTravelIndexRoute
};
var AppReportsRouteChildren = {
	AppReportsCashflowRoute,
	AppReportsDashboardRoute,
	AppReportsHistoryRoute,
	AppReportsLivingRoute,
	AppReportsRetirementRoute,
	AppReportsSpendingRoute,
	AppReportsTravelRoute: AppReportsTravelRoute._addFileChildren(AppReportsTravelRouteChildren),
	AppReportsIndexRoute
};
var AppRouteChildren = {
	AppAssetsRoute: AppAssetsRouteWithChildren,
	AppBudgetRoute,
	AppMoreRoute: AppMoreRouteWithChildren,
	AppReportsRoute: AppReportsRoute._addFileChildren(AppReportsRouteChildren),
	AppIndexRoute
};
var rootRouteChildren = {
	AppRoute: AppRoute._addFileChildren(AppRouteChildren),
	OnboardingRoute
};
var routeTree = Route$21._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		basepath: routerBasepath(),
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { publicUrl as a, getRouter, Route$12 as i, Route as n, Route$10 as r, router_exports as t };
