import { overlapsCalendarMonth, monthlyEquivalentAmount } from "./rental-history.mjs";

export const FISCAL_MONTHS = ["10", "11", "12", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
export const FISCAL_MONTH_LABELS = ["ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย."];

/** Splits one rental's contribution to a fiscal year across its 12 fiscal months (Oct-Sep), reusing the same amortization rule the rest of the app uses for monthly income estimates. */
function monthlyContribution(record, fiscalYear) {
  return FISCAL_MONTHS.map((month) => overlapsCalendarMonth(record, month, fiscalYear) ? monthlyEquivalentAmount(record, month, fiscalYear) : 0);
}

/**
 * @param {{plan: number, actual: number}} entry
 * @returns {number} percent used, or Infinity when money was spent against no budget at all.
 */
export function percentUsed(entry) {
  if (entry.plan > 0) return (entry.actual / entry.plan) * 100;
  return entry.actual > 0 ? Infinity : 0;
}

export function planStatus(percent) {
  return percent >= 100 ? "crit" : percent >= 80 ? "warn" : "good";
}

/**
 * Combines a fiscal year's rental plan budgets with the rentals that actually occurred, grouped by
 * department. A department that only has a plan (no rentals yet) or only has rentals (no plan set)
 * still shows up, so nothing silently drops off the summary.
 * @param {{renterName: string, startDate: string, expectedReturnDate?: string, rateType: string, duration: number, totalAmount: number}[]} rentals
 * @param {{department: string, fiscalYear: number|string, planAmount: number}[]} plans
 * @param {number|string} fiscalYear
 * @param {(record: object, monthIndex: number, fiscalYear: number|string) => string} [resolveDepartment]
 *   Which department a rental's given fiscal month (0=Oct..11=Sep) counts against. Defaults to the
 *   rental's own `renterName` for every month; pass a custom resolver (see `lib/rental-groups.mjs`)
 *   to redirect a central-office rental's cost to a different project month by month.
 */
export function summarizeRentalPlans(rentals, plans, fiscalYear, resolveDepartment = (record) => record.renterName.trim()) {
  const byDepartment = new Map();
  const entryFor = (department) => {
    if (!byDepartment.has(department)) byDepartment.set(department, { department, plan: 0, actual: 0, monthly: new Array(FISCAL_MONTHS.length).fill(0) });
    return byDepartment.get(department);
  };
  for (const plan of plans) {
    if (String(plan.fiscalYear) !== String(fiscalYear)) continue;
    const department = plan.department.trim();
    if (department) entryFor(department).plan = plan.planAmount;
  }
  for (const record of rentals) {
    const contribution = monthlyContribution(record, fiscalYear);
    contribution.forEach((value, index) => {
      if (value <= 0) return;
      const department = resolveDepartment(record, index, fiscalYear).trim();
      if (!department) return;
      const entry = entryFor(department);
      entry.monthly[index] += value;
      entry.actual += value;
    });
  }
  return [...byDepartment.values()]
    .map((entry) => ({ ...entry, remaining: entry.plan - entry.actual, percent: percentUsed(entry) }))
    .sort((a, b) => b.percent - a.percent);
}
