# DOH Equipment Management System — Initial data model

This first slice uses the supplied Khon Kaen machinery register as its source.
The production implementation should use PostgreSQL and keep all identifiers as
text so leading zeroes and hyphens are preserved.

## Core entities

- `departments`: owning and borrowing government units.
- `worksites`: road construction projects and operational sites.
- `machinery_types`: DOH category codes and names.
- `machineries`: one row per physical machine or vehicle.
- `rental_rates`: year, month, week, day, and hour rates with effective dates.
- `rentals`: approval, start, due, return, and renter/site information.
- `rental_items`: machines allocated under each rental.
- `utilization_records`: yearly utilization measurements.
- `service_records`: scheduled service events with flexible JSON details.
- `maintenance_orders`: repair and preventive maintenance workflow.
- `attachments`: metadata for photos, receipts, contracts, and documents.
- `audit_logs`: actor, action, entity, before/after values, and timestamp.

## Machinery status

`AVAILABLE`, `RENTED`, `IN_SERVICE`, `UNDER_REPAIR`, `INACTIVE`

Status changes must be executed inside the same database transaction as the
related rental, service, or maintenance operation.

## Import staging

Raw spreadsheet records should enter `machinery_import_rows` first. Each row
keeps the source file, sheet, row number, raw JSON, validation result, and the
matched machinery id. Records with missing prices, invalid lookup values, or
unknown machinery numbers require review before promotion to the main tables.
