export function monthlyPayment(principal: number, annualRate: number, months: number): number {
  if (months <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  const pow = (1 + r) ** months;
  return (principal * r * pow) / (pow - 1);
}

export function remainingInterest(principal: number, annualRate: number, months: number): number {
  return monthlyPayment(principal, annualRate, months) * months - principal;
}

export function effectiveRate(m: { type: string; rate: number; pRate?: number; spread?: number }): number {
  if (m.type === "p" || m.type === "h") return (m.pRate ?? m.rate) + (m.spread ?? 0);
  return m.rate;
}

export function amortize(principal: number, annualRate: number, months: number, take = 12) {
  const pmt = monthlyPayment(principal, annualRate, months);
  const r = annualRate / 12;
  let bal = principal;
  const rows: { n: number; interest: number; principal: number; balance: number }[] = [];
  for (let i = 1; i <= Math.min(take, months); i++) {
    const interest = bal * r;
    const prin = Math.min(pmt - interest, bal);
    bal = Math.max(0, bal - prin);
    rows.push({ n: i, interest, principal: prin, balance: bal });
  }
  return { payment: pmt, rows };
}

export function monthsUntil(fromIso: string, months: number): number {
  return months;
}

export function endMonthFromRemaining(fromIso: string, remainingMonths: number, paymentDay: number): string {
  return endDateFromRemaining(fromIso, remainingMonths, paymentDay).slice(0, 7);
}

export function endDateFromRemaining(fromIso: string, remainingMonths: number, paymentDay: number): string {
  const [y, m] = fromIso.split("-").map(Number);
  const d = new Date(y, m - 1 + Math.max(0, remainingMonths - 1), Math.min(28, paymentDay || 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nextPaymentIso(fromIso: string, paymentDay: number): string {
  const [y, m] = fromIso.split("-").map(Number);
  const day = Math.min(28, Math.max(1, paymentDay || 1));
  let iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (iso < fromIso) {
    const d = new Date(y, m, day);
    iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return iso;
}

export function remainingPayments(remainingMonths: number, paymentDay: number, today: string): number {
  const day = Number(today.slice(8, 10));
  if (paymentDay >= day) return remainingMonths;
  return Math.max(0, remainingMonths - 1);
}

export function paymentDayOf(m: { paymentDay?: number }): number {
  return Math.min(28, Math.max(1, m.paymentDay || 1));
}
