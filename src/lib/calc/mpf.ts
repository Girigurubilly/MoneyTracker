import type { RetirementAccount } from "../types.ts";

export type RetirementAccountProjectionYear = {
  retirementAccountId: string;
  calendarYear: number;
  age: number;
  openingBalance: number;
  employeeContribution: number;
  employerContribution: number;
  voluntaryContribution: number;
  totalContribution: number;
  contributionCharge: number;
  withdrawal: number;
  investmentReturn: number;
  closingBalance: number;
  isAccessible: boolean;
  cashFlowAvailableToRetirementPlan: number;
  notes: string[];
};

export function monthlyContribution(amount: number, freq: RetirementAccount["contributionFrequency"]): number {
  if (freq === "annual") return amount / 12;
  if (freq === "quarterly") return amount / 3;
  if (freq === "one_off") return 0;
  return amount;
}

export function contributionMonthsInYear(
  account: RetirementAccount,
  calendarYear: number,
  age: number,
  retireAge: number,
  birthday?: string,
): number {
  if (!account.includeInRetirementProjection) return 0;
  if (account.status === "closed" || account.status === "contribution_stopped" || account.status === "withdrawal_phase") return 0;
  if (age > retireAge) return 0;
  if (account.contributionFrequency === "one_off") {
    if (!account.contributionStartDate) return calendarYear === new Date().getFullYear() ? 1 : 0;
    return Number(account.contributionStartDate.slice(0, 4)) === calendarYear ? 1 : 0;
  }
  let months = 12;
  if (age === retireAge) {
    const bm = birthday ? Number(birthday.slice(5, 7)) : 7;
    months = Math.max(0, Math.min(12, Number.isFinite(bm) ? bm - 1 : 6));
  }
  if (account.contributionEndDate) {
    const endY = Number(account.contributionEndDate.slice(0, 4));
    if (calendarYear > endY) return 0;
    if (calendarYear === endY) months = Math.min(months, Number(account.contributionEndDate.slice(5, 7)) || 0);
  }
  if (account.contributionStartDate) {
    const startY = Number(account.contributionStartDate.slice(0, 4));
    if (calendarYear < startY) return 0;
    if (calendarYear === startY) {
      const startM = Number(account.contributionStartDate.slice(5, 7)) || 1;
      months = Math.min(months, 13 - startM);
    }
  }
  return Math.max(0, Math.min(12, months));
}

export function projectRetirementAccountYear(opts: {
  account: RetirementAccount;
  openingBalance: number;
  age: number;
  calendarYear: number;
  yearsSinceStart: number;
  retireAge: number;
  birthday?: string;
  alreadyLumpSum?: boolean;
}): RetirementAccountProjectionYear {
  const { account, openingBalance, age, calendarYear, yearsSinceStart, retireAge, birthday } = opts;
  const notes: string[] = [];
  const months = contributionMonthsInYear(account, calendarYear, age, retireAge, birthday);
  const grow = (base: number, rate: number) => base * (1 + rate) ** yearsSinceStart;
  let employee = 0;
  let employer = 0;
  let voluntary = 0;
  if (account.contributionFrequency === "one_off" && months > 0) {
    voluntary = account.voluntaryContributionAmount || account.employeeContributionAmount || 0;
    notes.push("one-off contribution");
  } else {
    employee = monthlyContribution(account.employeeContributionAmount, account.contributionFrequency) * grow(1, account.employeeContributionGrowthRate) * months;
    employer = monthlyContribution(account.employerContributionAmount, account.contributionFrequency) * grow(1, account.employerContributionGrowthRate) * months;
    voluntary = monthlyContribution(account.voluntaryContributionAmount, account.contributionFrequency) * grow(1, account.voluntaryContributionGrowthRate) * months;
  }
  const totalContribution = employee + employer + voluntary;
  const contributionCharge = totalContribution * (account.annualContributionChargeRate ?? 0);
  const isAccessible = age >= account.accessibleAge;
  let withdrawal = 0;
  if (isAccessible && account.withdrawalStrategy !== "do_not_use_in_projection") {
    const startOk = !account.plannedWithdrawalStartAge || age >= account.plannedWithdrawalStartAge;
    const endOk = !account.plannedWithdrawalEndAge || age < account.plannedWithdrawalEndAge;
    if (account.withdrawalStrategy === "lump_sum" && startOk && !opts.alreadyLumpSum) {
      withdrawal = Math.max(0, openingBalance + totalContribution - contributionCharge);
      notes.push("lump sum at access");
    } else if (account.withdrawalStrategy === "annual_drawdown" && startOk && endOk) {
      withdrawal = Math.max(0, account.plannedAnnualWithdrawal ?? 0);
    } else if (account.withdrawalStrategy === "scheduled_income") {
      const s0 = account.scheduledIncomeStartAge ?? account.accessibleAge;
      const s1 = account.scheduledIncomeEndAge ?? 200;
      if (age >= s0 && age < s1) {
        const g = account.scheduledIncomeGrowthRate ?? 0;
        withdrawal = (account.scheduledAnnualIncome ?? 0) * (1 + g) ** Math.max(0, age - s0);
      }
    }
  }
  let pre = openingBalance + totalContribution - contributionCharge - withdrawal;
  if (pre < 0) {
    withdrawal = Math.max(0, withdrawal + pre);
    pre = 0;
    notes.push("withdrawal capped at balance");
  }
  const netReturn = (account.expectedAnnualReturnRate ?? 0) - (account.annualFeeRate ?? 0);
  const investmentReturn = pre * netReturn;
  const closingBalance = Math.max(0, pre + investmentReturn);
  return {
    retirementAccountId: account.id,
    calendarYear,
    age,
    openingBalance,
    employeeContribution: employee,
    employerContribution: employer,
    voluntaryContribution: voluntary,
    totalContribution,
    contributionCharge,
    withdrawal,
    investmentReturn,
    closingBalance,
    isAccessible,
    cashFlowAvailableToRetirementPlan: isAccessible ? withdrawal : 0,
    notes,
  };
}

export function blankRetirementAccount(type: RetirementAccountTypeLike, now = new Date().toISOString()): import("../types.ts").RetirementAccount {
  const accessibleAge = type === "ANNUITY" || type === "QDAP" || type === "PENSION" ? 65 : 65;
  const withdrawalStrategy = type === "ANNUITY" || type === "QDAP" || type === "PENSION" ? "scheduled_income" : "annual_drawdown";
  const names: Record<string, string> = {
    MPF: "MPF",
    ORSO: "ORSO",
    TVC: "TVC",
    QDAP: "QDAP",
    PENSION: "Pension",
    ANNUITY: "Annuity",
    OTHER_LOCKED_RETIREMENT: "Locked retirement",
  };
  return {
    id: `ra-${Math.random().toString(36).slice(2, 10)}`,
    name: names[type] ?? type,
    type,
    currency: "HKD",
    currentBalance: 0,
    balanceAsOf: now.slice(0, 10),
    status: "active",
    accessibleAge,
    accessRule: type === "ANNUITY" || type === "QDAP" ? "scheduled_income" : "age_based",
    contributionFrequency: "monthly",
    employeeContributionAmount: 0,
    employerContributionAmount: 0,
    voluntaryContributionAmount: 0,
    employeeContributionGrowthRate: 0,
    employerContributionGrowthRate: 0,
    voluntaryContributionGrowthRate: 0,
    expectedAnnualReturnRate: 0.05,
    annualFeeRate: type === "MPF" ? 0.008 : 0,
    annualContributionChargeRate: 0,
    withdrawalStrategy,
    scheduledAnnualIncome: 0,
    scheduledIncomeStartAge: 65,
    includeInRetirementProjection: true,
    createdAt: now,
    updatedAt: now,
  };
}

type RetirementAccountTypeLike = import("../types.ts").RetirementAccountType;
