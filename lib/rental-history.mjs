/** @param {string} value ISO date for the rental start. */
export function fiscalYearOf(value) {
  const [year, month] = value.split("-").map(Number);
  return year + (month >= 10 ? 544 : 543);
}

/**
 * @param {{startDate: string, machineryCode: string, machineryName: string|null, renterName: string, approver: string, rentalMode?: string}} record
 * @param {{query: string, fiscalYear: string, month: string, machinery: string, rentalMode?: string, department?: string}} filters
 */
export function matchesRentalHistory(record, filters) {
  const normalize = (/** @type {string} */ value) => value.trim().toLocaleLowerCase("th");
  const query = normalize(filters.query);
  return (!query || [record.machineryCode, record.machineryName, record.renterName, record.approver]
    .some((value) => value && normalize(value).includes(query))) &&
    (!filters.fiscalYear || fiscalYearOf(record.startDate) === Number(filters.fiscalYear)) &&
    (!filters.month || Number(record.startDate.slice(5, 7)) === Number(filters.month)) &&
    (!filters.rentalMode || record.rentalMode === filters.rentalMode) &&
    (!filters.department || record.renterName.trim() === filters.department.trim()) &&
    (!normalize(filters.machinery) || normalize(record.machineryCode).includes(normalize(filters.machinery)));
}
