import { i as Route } from "./router-Des7-i-O.js";
import { t as AccountDetail } from "./assets-B7NLYpN0.js";
import { jsx } from "react/jsx-runtime";
//#region src/routes/_app/assets.$id.tsx?tsr-split=component
function AccountDetailRoute() {
	const { id } = Route.useParams();
	return /* @__PURE__ */ jsx(AccountDetail, { id });
}
//#endregion
export { AccountDetailRoute as component };
