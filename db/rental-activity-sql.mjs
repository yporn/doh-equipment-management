// Rental status follows the rental's own recorded date range, in Thailand time, so a
// multi-month contract (e.g. a 1-year lease booked once) stays "current" for its whole
// term instead of only the calendar month it started in.
// Do not mutate historical records or manufacture a physical return date.
export const currentRentalSql = "status = 'ACTIVE' AND start_date <= strftime('%Y-%m-%d','now','+7 hours') AND expected_return_date >= strftime('%Y-%m-%d','now','+7 hours')";
