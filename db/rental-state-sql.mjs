import { currentRentalSql } from "./rental-activity-sql.mjs";

// Newest saved rental in the current Thai calendar month controls the renter.
const latest = (code, field) => `(SELECT ${field} FROM rentals WHERE machinery_code = ${code} AND ${currentRentalSql} ORDER BY created_at DESC, rowid DESC LIMIT 1)`;
const disposal = code => `COALESCE((SELECT CASE WHEN status = 'DISPOSED' THEN 'DISPOSAL_APPROVED' ELSE status END FROM disposal_records WHERE machinery_code = ${code}), CASE WHEN condition IN ('AWAITING_DISPOSAL','DISPOSAL_APPROVED') THEN condition END)`;
const repair = code => `EXISTS (SELECT 1 FROM repair_records WHERE machinery_code = ${code} AND status != 'COMPLETED')`;
// Repair activity is tracked separately and must never overwrite a condition
// entered in the machinery register (especially DAMAGED).
const condition = code => `COALESCE(${latest(code, "rental_mode")}, ${disposal(code)}, CASE WHEN condition = 'DAMAGED' THEN 'DAMAGED' ELSE 'AVAILABLE' END)`;
const status = code => `CASE WHEN ${latest(code, "id")} IS NOT NULL THEN 'RENTED' WHEN ${disposal(code)} IS NOT NULL THEN 'INACTIVE' WHEN ${repair(code)} THEN 'UNDER_REPAIR' ELSE 'AVAILABLE' END`;
const sync = code => `UPDATE machineries SET
  condition = ${condition(code)},
  status = ${status(code)},
  repair_status = CASE WHEN ${repair(code)} THEN 'ACTIVE' ELSE 'NONE' END,
  renter_department = ${latest(code, "renter_name")},
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE code = ${code} AND (condition IS NOT ${condition(code)} OR status IS NOT ${status(code)}
    OR repair_status IS NOT CASE WHEN ${repair(code)} THEN 'ACTIVE' ELSE 'NONE' END
    OR renter_department IS NOT ${latest(code, "renter_name")});`;
const syncRepair = code => `UPDATE machineries SET repair_status = CASE WHEN ${repair(code)} THEN 'ACTIVE' ELSE 'NONE' END WHERE code = ${code}; ${sync(code)}`;

// Refresh when a page/API is loaded, even if nobody has written a record this month.
export const rentalStateRefreshSql = sync("machineries.code");
export const rentalStateTriggerSql = [
  ...["insert", "update", "delete"].map(event => `DROP TRIGGER IF EXISTS rental_state_${event}`),
  `CREATE TRIGGER rental_state_insert AFTER INSERT ON rentals BEGIN ${sync("NEW.machinery_code")} END`,
  `CREATE TRIGGER rental_state_update AFTER UPDATE ON rentals BEGIN ${sync("OLD.machinery_code")} ${sync("NEW.machinery_code")} END`,
  `CREATE TRIGGER rental_state_delete AFTER DELETE ON rentals BEGIN ${sync("OLD.machinery_code")} END`,
  ...["insert", "update", "delete"].map(event => `DROP TRIGGER IF EXISTS repair_machine_${event}`),
  `CREATE TRIGGER repair_machine_insert AFTER INSERT ON repair_records BEGIN ${syncRepair("NEW.machinery_code")} END`,
  `CREATE TRIGGER repair_machine_update AFTER UPDATE ON repair_records BEGIN
    UPDATE machineries SET condition = 'AVAILABLE'
      WHERE code = OLD.machinery_code AND OLD.status != 'COMPLETED' AND NEW.status = 'COMPLETED'
        AND condition NOT IN ('W','M','AWAITING_DISPOSAL','DISPOSAL_APPROVED');
    ${syncRepair("OLD.machinery_code")} ${syncRepair("NEW.machinery_code")}
  END`,
  `CREATE TRIGGER repair_machine_delete AFTER DELETE ON repair_records BEGIN ${syncRepair("OLD.machinery_code")} END`,
];
