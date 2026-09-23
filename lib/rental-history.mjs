/** @param {string} value ISO date for the rental start. */
export function fiscalYearOf(value) {
  const [year, month] = value.split("-").map(Number);
  return year + (month >= 10 ? 544 : 543);
}

const MONTHS_PER_UNIT = { DAILY: 1 / 30, WEEKLY: 7 / 30, MONTHLY: 1, YEARLY: 12 };

/** Converts a rental's own recorded rate type + duration into an equivalent month count, e.g. 1 YEARLY unit = 12 months (not the number of calendar-month labels its exact dates happen to touch). */
export function monthsSpanned(rateType, duration) {
  return duration * (MONTHS_PER_UNIT[rateType] ?? 1);
}

/** True if the given (month, fiscalYear) is the calendar month a yearly rental's contract actually ends in — the one that carries the closing/remainder figure instead of a regular monthly share. */
export function isYearlyClosingMonth(record, month, fiscalYear) {
  if (!month || !fiscalYear || !record.expectedReturnDate) return false;
  return Number(month) === Number(record.expectedReturnDate.slice(5, 7)) &&
    Number(fiscalYear) === fiscalYearOf(record.expectedReturnDate);
}

/**
 * Spreads a rental's full contract value across the months implied by its own rate type and
 * duration. A rental shorter than a month keeps its full value for the one month it falls in,
 * rather than being inflated into a hypothetical monthly rate.
 *
 * Yearly contracts follow finance's own booking convention rather than calendar-even division:
 * the annual rate is floor-divided by its contract months (e.g. 12 for a 1-year contract) to get
 * a fixed regular-month figure, and the contract's actual closing month (identified by
 * `month`/`fiscalYear`, when given) absorbs whatever the other regular months (one fewer than the
 * contract's month count) didn't cover — so the regular months plus the closing month always add
 * up to exactly the annual contract value with no rounding drift.
 */
export function monthlyEquivalentAmount(record, month, fiscalYear) {
  const months = monthsSpanned(record.rateType, record.duration);
  if (record.rateType === "YEARLY") {
    const roundedMonths = Math.max(Math.round(months), 1);
    const regularAmount = Math.floor(record.totalAmount / roundedMonths);
    const regularMonthCount = Math.max(roundedMonths - 1, 1);
    return isYearlyClosingMonth(record, month, fiscalYear)
      ? record.totalAmount - regularAmount * regularMonthCount
      : regularAmount;
  }
  return record.totalAmount / Math.max(months, 1);
}

function monthRange(year, month) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return [start, end];
}

/** True if the rental's [startDate, expectedReturnDate] span touches the given calendar month, any year it started (or the one year implied by fiscalYear when given). */
export function overlapsCalendarMonth(record, month, fiscalYear) {
  if (!month || !record.expectedReturnDate) return false;
  const targetMonth = Number(month);
  const candidateYears = fiscalYear
    ? [Number(fiscalYear) - (targetMonth >= 10 ? 544 : 543)]
    : range(Number(record.startDate.slice(0, 4)), Number(record.expectedReturnDate.slice(0, 4)));
  return candidateYears.some((year) => {
    const [monthStart, monthEnd] = monthRange(year, targetMonth);
    return record.startDate <= monthEnd && record.expectedReturnDate >= monthStart;
  });
}

/** True if the rental's [startDate, expectedReturnDate] span touches the given Thai fiscal year (Oct-Sep). */
export function overlapsFiscalYear(record, fiscalYear) {
  if (!fiscalYear || !record.expectedReturnDate) return false;
  const fy = Number(fiscalYear);
  const fyStart = `${fy - 544}-10-01`;
  const fyEnd = `${fy - 543}-09-30`;
  return record.startDate <= fyEnd && record.expectedReturnDate >= fyStart;
}

function range(start, end) {
  const years = [];
  for (let year = start; year <= end; year++) years.push(year);
  return years;
}

/**
 * @param {{startDate: string, expectedReturnDate?: string, machineryCode: string, machineryName: string|null, renterName: string, approver: string, rentalMode?: string}} record
 * @param {{query: string, fiscalYear: string, month: string, machinery: string, rentalMode?: string, department?: string}} filters
 */
export function matchesRentalHistory(record, filters) {
  const normalize = (/** @type {string} */ value) => value.trim().toLocaleLowerCase("th");
  const query = normalize(filters.query);
  const matchesFiscalYear = !filters.fiscalYear ||
    fiscalYearOf(record.startDate) === Number(filters.fiscalYear) ||
    overlapsFiscalYear(record, filters.fiscalYear);
  const matchesMonth = !filters.month ||
    Number(record.startDate.slice(5, 7)) === Number(filters.month) ||
    overlapsCalendarMonth(record, filters.month, filters.fiscalYear);
  return (!query || [record.machineryCode, record.machineryName, record.renterName, record.approver]
    .some((value) => value && normalize(value).includes(query))) &&
    matchesFiscalYear &&
    matchesMonth &&
    (!filters.rentalMode || record.rentalMode === filters.rentalMode) &&
    (!filters.department || record.renterName.trim() === filters.department.trim()) &&
    (!normalize(filters.machinery) || normalize(record.machineryCode).includes(normalize(filters.machinery)));
}
