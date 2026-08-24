import { r as Route } from "./router-Des7-i-O.js";
import { c as ScreensPage, i as ImportPage, l as SecurityPage, n as CategoriesPage, o as PreferencesPage, r as FxPage, s as RecurringPage, t as BackupPage } from "./more-CyUiMWeu.js";
import { jsx } from "react/jsx-runtime";
//#region src/routes/_app/more.$page.tsx?tsr-split=component
function MorePageRoute() {
	const { page } = Route.useParams();
	switch (page) {
		case "categories": return /* @__PURE__ */ jsx(CategoriesPage, {});
		case "recurring": return /* @__PURE__ */ jsx(RecurringPage, {});
		case "fx": return /* @__PURE__ */ jsx(FxPage, {});
		case "import": return /* @__PURE__ */ jsx(ImportPage, {});
		case "backup": return /* @__PURE__ */ jsx(BackupPage, {});
		case "security": return /* @__PURE__ */ jsx(SecurityPage, {});
		case "preferences": return /* @__PURE__ */ jsx(PreferencesPage, {});
		case "screens": return /* @__PURE__ */ jsx(ScreensPage, {});
		default: return /* @__PURE__ */ jsx(ScreensPage, {});
	}
}
//#endregion
export { MorePageRoute as component };
