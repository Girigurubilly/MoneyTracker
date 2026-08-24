import { M as roundMoney } from "./app-C4vqMmxY.js";
//#region src/lib/calc/mortgage.ts
function effectiveRate(m) {
	if (m.rateType === "fixed") return m.effectiveRate;
	return roundMoney(m.benchmark + m.adjustment, 4);
}
function monthlyPayment(principal, annualPct, months) {
	if (months <= 0) return 0;
	const r = annualPct / 100 / 12;
	if (Math.abs(r) < 1e-12) return roundMoney(principal / months);
	const pow = (1 + r) ** months;
	return roundMoney(principal * r * pow / (pow - 1));
}
function pad2(n) {
	return String(n).padStart(2, "0");
}
function isoFromParts(y, m, d) {
	const last = new Date(y, m, 0).getDate();
	return `${y}-${pad2(m)}-${pad2(Math.min(d, last))}`;
}
/** Day of month the mortgage is charged. Taken from a full end date, else 1. */
function paymentDayOf(end, fallback = 1) {
	if (end && end.length >= 10) {
		const d = Number(end.slice(8, 10));
		if (Number.isFinite(d) && d >= 1) return Math.min(31, d);
	}
	return fallback;
}
function normalizeEndDate(end, paymentDay = 1) {
	if (!end) return void 0;
	if (/^\d{4}-\d{2}-\d{2}$/.test(end)) return end;
	if (/^\d{4}-\d{2}$/.test(end)) return `${end}-${pad2(Math.min(28, Math.max(1, paymentDay)))}`;
	return end;
}
function addMonthsIso(iso, delta) {
	const [y, m, d] = iso.split("-").map(Number);
	const dt = new Date(y, m - 1 + delta, 1);
	return isoFromParts(dt.getFullYear(), dt.getMonth() + 1, d);
}
/** Next charged date on or after `fromIso` (if today is before the charged day, this month still counts). */
function nextPaymentIso(paymentDay, fromIso) {
	const y = Number(fromIso.slice(0, 4));
	const m = Number(fromIso.slice(5, 7));
	const day = Number(fromIso.slice(8, 10));
	const dueThis = isoFromParts(y, m, paymentDay);
	const dueDay = Number(dueThis.slice(8, 10));
	if (Number.isFinite(day) && day < dueDay) return dueThis;
	return addMonthsIso(isoFromParts(y, m, paymentDay), 1);
}
function remainingPayments(endIso, fromIso, paymentDay) {
	const day = paymentDay ?? paymentDayOf(endIso);
	const end = normalizeEndDate(endIso, day);
	if (!end) return 0;
	const next = nextPaymentIso(day, fromIso);
	if (next > end) return 0;
	const [ey, em] = end.split("-").map(Number);
	const [ny, nm] = next.split("-").map(Number);
	return Math.max(0, (ey - ny) * 12 + (em - nm) + 1);
}
function amortize(principal, annualPct, months, take = months, paymentOverride, firstDueIso) {
	const pay = paymentOverride && paymentOverride > 0 ? paymentOverride : monthlyPayment(principal, annualPct, months);
	const r = annualPct / 100 / 12;
	const rows = [];
	let bal = principal;
	const n = Math.min(months, take);
	const startDue = firstDueIso ?? "";
	for (let i = 0; i < n; i++) {
		const interest = roundMoney(bal * r);
		let principalPaid = roundMoney(pay - interest);
		if (principalPaid > bal) principalPaid = bal;
		const close = roundMoney(Math.max(0, bal - principalPaid));
		rows.push({
			monthIndex: i + 1,
			due: startDue ? addMonthsIso(startDue, i) : "",
			open: bal,
			pay: roundMoney(principalPaid + interest),
			interest,
			principal: principalPaid,
			close
		});
		bal = close;
		if (bal <= 0) break;
	}
	return rows;
}
function remainingInterest(principal, annualPct, months, paymentOverride) {
	const rows = amortize(principal, annualPct, months, months, paymentOverride);
	return roundMoney(rows.reduce((s, r) => s + r.interest, 0));
}
function stress(m, shockPct) {
	const base = effectiveRate(m);
	const shocked = base + shockPct;
	const payment = monthlyPayment(m.outstanding, shocked, m.remainingMonths);
	const interest = remainingInterest(m.outstanding, shocked, m.remainingMonths);
	const baseInterest = remainingInterest(m.outstanding, base, m.remainingMonths, m.monthlyPayment);
	return {
		shock: shockPct,
		rate: shocked,
		payment,
		extraInterest: roundMoney(interest - baseInterest)
	};
}
/** Remaining monthly payments until `endYm` (YYYY-MM or YYYY-MM-DD). Includes this month when the charged day has not passed. */
function monthsUntil(endYm, from = /* @__PURE__ */ new Date()) {
	const fromIso = isoFromParts(from.getFullYear(), from.getMonth() + 1, from.getDate());
	const day = paymentDayOf(endYm.length >= 10 ? endYm : `${endYm}-01`);
	return remainingPayments(normalizeEndDate(endYm, day) ?? endYm, fromIso, day);
}
function endMonthFromRemaining(months, from = /* @__PURE__ */ new Date()) {
	const d = new Date(from.getFullYear(), from.getMonth() + Math.max(0, months), 1);
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function endDateFromRemaining(months, from = /* @__PURE__ */ new Date(), paymentDay = 1) {
	return addMonthsIso(nextPaymentIso(paymentDay, isoFromParts(from.getFullYear(), from.getMonth() + 1, from.getDate())), Math.max(0, months - 1));
}
//#endregion
export { monthsUntil as a, paymentDayOf as c, stress as d, endMonthFromRemaining as i, remainingInterest as l, effectiveRate as n, nextPaymentIso as o, endDateFromRemaining as r, normalizeEndDate as s, amortize as t, remainingPayments as u };
