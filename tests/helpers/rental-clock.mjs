export const freezeRentalMonth = statement => statement.replaceAll("strftime('%Y-%m-%d','now','+7 hours')", "'2026-09-15'");
