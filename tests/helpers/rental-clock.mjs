export const freezeRentalMonth = statement => statement.replaceAll("strftime('%Y-%m','now','+7 hours')", "'2026-09'");
