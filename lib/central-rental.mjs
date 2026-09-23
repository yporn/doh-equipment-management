import { FISCAL_MONTHS } from "./rental-plan.mjs";

/** The renter name that marks a rental as "central" (ส่วนกลาง) — eligible to have its monthly cost redirected to a different project via allocation, instead of always counting against a single fixed department. */
export const CENTRAL_RENTER_NAME = "ส่วนกลาง";

/**
 * Builds a per-month department resolver (for `summarizeRentalPlans`) that redirects every
 * central-office rental's monthly cost to whichever project that fiscal month was allocated to,
 * falling back to "ส่วนกลาง" itself for any month nobody has allocated yet. Non-central rentals are
 * untouched — they keep counting against their own renter name as always.
 * @param {{fiscalYear: number|string, month: string, project: string}[]} allocations
 */
export function createCentralAllocationResolver(allocations) {
  const byKey = new Map(allocations.map((allocation) => [`${allocation.fiscalYear}::${allocation.month}`, allocation.project]));
  return (record, monthIndex, fiscalYear) => {
    const fallback = record.renterName.trim();
    if (fallback !== CENTRAL_RENTER_NAME) return fallback;
    const month = FISCAL_MONTHS[monthIndex];
    return byKey.get(`${fiscalYear}::${month}`) ?? fallback;
  };
}

/**
 * Buckets a rental into one of three cost categories for reporting: central-office rentals always
 * count as "central" regardless of their own rate type (they already get tracked/allocated
 * separately), and everything else splits by its own contract rate type.
 * @param {{renterName: string, rateType: string}} record
 * @returns {"central"|"yearly"|"monthly"}
 */
export function categorizeRentalCost(record) {
  if (record.renterName.trim() === CENTRAL_RENTER_NAME) return "central";
  return record.rateType === "YEARLY" ? "yearly" : "monthly";
}
