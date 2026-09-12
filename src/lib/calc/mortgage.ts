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

export function monthsBetween(fromIso: string, toIso: string): number {
  if (!fromIso || !toIso) return 0;
  const [fy, fm] = fromIso.split("-").map(Number);
  const [ty, tm] = toIso.split("-").map(Number);
  if (!fy || !fm || !ty || !tm) return 0;
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

export function originalTermMonths(
  m: { startDate?: string; remainingMonths: number; termYears?: number },
  today: string,
): number {
  if (m.termYears && m.termYears > 0) return Math.max(1, Math.round(m.termYears * 12));
  const elapsed = m.startDate ? monthsBetween(m.startDate, today) : 0;
  return Math.max(m.remainingMonths, elapsed + m.remainingMonths);
}

export function remainingFromStart(
  m: { startDate?: string; remainingMonths: number; termYears?: number; paymentDay?: number },
  today: string,
): { remainingMonths: number; remainingYears: number; paymentsLeft: number } {
  const term = originalTermMonths(m, today);
  const elapsed = m.startDate ? monthsBetween(m.startDate, today) : Math.max(0, term - m.remainingMonths);
  const remainingMonths = Math.max(0, term - elapsed);
  return {
    remainingMonths,
    remainingYears: Math.round((remainingMonths / 12) * 10) / 10,
    paymentsLeft: remainingPayments(remainingMonths, m.paymentDay ?? 1, today),
  };
}

export function originalPrincipal(m: { original?: number; outstanding: number }): number {
  return m.original && m.original > 0 ? m.original : m.outstanding;
}

export function amortizeFrom(principal: number, annualRate: number, months: number, skip: number, take = 12) {
  const full = amortize(principal, annualRate, months, months);
  const start = Math.max(0, Math.min(skip, full.rows.length));
  return {
    payment: full.payment,
    rows: full.rows.slice(start, start + take).map((r, i) => ({ ...r, n: i + 1 })),
  };
}

export type MortgageScheduleRow = {
  date: string;
  payment: number;
  principalPaid: number;
  interestPaid: number;
  remainingPrincipal: number;
};

export function mortgageSchedule(
  m: {
    outstanding: number;
    rate: number;
    pRate?: number;
    spread?: number;
    type: string;
    remainingMonths: number;
    paymentDay: number;
    startDate?: string;
    termYears?: number;
    paymentOverride?: number;
  },
  today: string,
): MortgageScheduleRow[] {
  const left = remainingFromStart(m, today).remainingMonths;
  if (left <= 0 || m.outstanding <= 0) return [];
  const rate = effectiveRate(m);
  const pmt = m.paymentOverride && m.paymentOverride > 0 ? m.paymentOverride : monthlyPayment(m.outstanding, rate, left);
  const r = rate / 12;
  let bal = m.outstanding;
  const day = Math.min(28, Math.max(1, m.paymentDay || 1));
  const [ty, tm] = today.split("-").map(Number);
  const rows: MortgageScheduleRow[] = [];
  for (let i = 0; i < left && bal > 0.5; i++) {
    const d = new Date(ty, (tm || 1) - 1 + i, day);
    const interest = Math.max(0, bal * r);
    const principal = Math.min(Math.max(0, pmt - interest), bal);
    bal = Math.max(0, bal - principal);
    rows.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      payment: principal + interest,
      principalPaid: principal,
      interestPaid: interest,
      remainingPrincipal: bal,
    });
  }
  return rows;
}

export function mortgageFlowForYear(rows: MortgageScheduleRow[], year: number, openingIfEmpty = 0) {
  const ofYear = rows.filter((r) => r.date.startsWith(String(year)));
  const before = rows.filter((r) => Number(r.date.slice(0, 4)) < year);
  const opening = before.length
    ? before[before.length - 1]!.remainingPrincipal
    : rows[0]
      ? rows[0].remainingPrincipal + rows[0].principalPaid
      : openingIfEmpty;
  const paidOff = ofYear.find((r) => r.remainingPrincipal < 0.5);
  return {
    payment: ofYear.reduce((s, r) => s + r.payment, 0),
    principalPaid: ofYear.reduce((s, r) => s + r.principalPaid, 0),
    interestPaid: ofYear.reduce((s, r) => s + r.interestPaid, 0),
    opening,
    remainingAtEnd: ofYear.length ? ofYear[ofYear.length - 1]!.remainingPrincipal : opening,
    paidOffMonth: paidOff?.date.slice(0, 7),
  };
}
