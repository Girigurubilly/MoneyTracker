import { k as cashflowSide, x as toHkd } from "./app-C4vqMmxY.js";
//#region src/lib/calc/trips.ts
function monthsBetween(fromISO, toISO) {
	const [fy, fm] = fromISO.split("-").map(Number);
	const [ty, tm] = toISO.split("-").map(Number);
	return (ty - fy) * 12 + (tm - fm);
}
function isTripActive(trip, todayISO) {
	if (trip.status === "cancelled" || trip.status === "completed") return false;
	return (trip.end || trip.start) >= todayISO;
}
function activeTrips(trips, todayISO, keepId) {
	return trips.filter((t) => t.id === keepId || isTripActive(t, todayISO)).sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}
function tripCashSpent(txs, rates, tripId) {
	let sum = 0;
	for (const tx of txs) {
		if (tx.tripId !== tripId) continue;
		if (cashflowSide(tx) !== "expense") continue;
		sum += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
	}
	return sum;
}
function tripProgress(trip, todayISO, spent) {
	const used = spent ?? trip.cashSaved;
	const cashLeft = Math.max(0, trip.cashBudget - used);
	const milesLeft = Math.max(0, trip.milesTarget - trip.milesSaved);
	const monthsLeft = Math.max(0, monthsBetween(todayISO, trip.start));
	const denom = Math.max(1, monthsLeft);
	const requiredCashMonthly = cashLeft / denom;
	const requiredMilesMonthly = milesLeft / denom;
	const usedRatio = trip.cashBudget > 0 ? used / trip.cashBudget : used > 0 ? 1 : 0;
	return {
		cashLeft,
		milesLeft,
		monthsLeft,
		requiredCashMonthly,
		requiredMilesMonthly,
		cashStatus: spent != null ? usedRatio >= 1.1 ? "at-risk" : usedRatio >= 1 ? "watch" : "on-track" : statusFor(cashLeft, trip.monthlyCash, monthsLeft),
		milesStatus: statusFor(milesLeft, trip.monthlyMiles, monthsLeft),
		spent: used,
		usedRatio
	};
}
function statusFor(left, planned, monthsLeft) {
	if (left <= 0) return "on-track";
	if (monthsLeft <= 0) return "at-risk";
	const projected = planned * monthsLeft;
	if (projected >= left) return "on-track";
	if (projected >= left * .85) return "watch";
	return "at-risk";
}
function travelSpendYtd(txs, year, travelCategoryIds) {
	const prefix = `${year}-`;
	let sum = 0;
	const seen = /* @__PURE__ */ new Set();
	for (const tx of txs) {
		if (tx.planned || tx.type !== "expense") continue;
		if (!tx.date.startsWith(prefix)) continue;
		const travelCat = tx.categoryId ? travelCategoryIds.has(tx.categoryId) : false;
		const linked = Boolean(tx.tripId);
		if (!travelCat && !linked) continue;
		if (seen.has(tx.id)) continue;
		seen.add(tx.id);
		sum += Math.abs(tx.amount);
	}
	return sum;
}
//#endregion
export { tripProgress as i, travelSpendYtd as n, tripCashSpent as r, activeTrips as t };
