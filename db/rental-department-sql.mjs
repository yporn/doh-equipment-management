import { currentRentalSql } from "./rental-activity-sql.mjs";
// The renting organization is independent of the physical location (managed by transfers).
const activeDepartment = code => `(SELECT renter_name FROM rentals WHERE machinery_code = ${code} AND ${currentRentalSql} ORDER BY created_at DESC, rowid DESC LIMIT 1)`;
const sync = code => `UPDATE machineries SET renter_department = ${activeDepartment(code)} WHERE code = ${code};`;
export const rentalDepartmentTriggerSql = [
  ...["insert", "update", "delete"].map(event => `DROP TRIGGER IF EXISTS rental_department_${event}`),
  `CREATE TRIGGER IF NOT EXISTS rental_department_insert AFTER INSERT ON rentals WHEN NEW.status = 'ACTIVE' BEGIN ${sync('NEW.machinery_code')} END`,
  `CREATE TRIGGER IF NOT EXISTS rental_department_update AFTER UPDATE OF renter_name, status, machinery_code, start_date ON rentals WHEN OLD.status = 'ACTIVE' OR NEW.status = 'ACTIVE' BEGIN ${sync('OLD.machinery_code')} ${sync('NEW.machinery_code')} END`,
  `CREATE TRIGGER IF NOT EXISTS rental_department_delete AFTER DELETE ON rentals WHEN OLD.status = 'ACTIVE' BEGIN ${sync('OLD.machinery_code')} END`,
];
export const rentalDepartmentBackfillSql = `UPDATE machineries SET renter_department = ${activeDepartment('machineries.code')}
  WHERE renter_department IS NOT ${activeDepartment('machineries.code')}`;
