// Rental status follows the month of the recorded start date, in Thailand time.
// Do not mutate historical records or manufacture a physical return date.
export const currentRentalSql = "status = 'ACTIVE' AND substr(start_date, 1, 7) = strftime('%Y-%m','now','+7 hours')";
