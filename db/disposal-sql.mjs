import { currentRentalSql } from "./rental-activity-sql.mjs";
// Each entry is one prepared statement. Triggers keep register updates atomic with the record.
export const disposalSchemaSql = [
  `CREATE TABLE IF NOT EXISTS disposal_records (
    id TEXT PRIMARY KEY NOT NULL, machinery_code TEXT NOT NULL,
    proposed_date TEXT NOT NULL, document_number TEXT NOT NULL,
    reason TEXT NOT NULL, responsible_person TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AWAITING_DISPOSAL',
    approval_date TEXT, approval_document TEXT, approver TEXT, note TEXT,
    created_by TEXT NOT NULL, updated_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS disposal_records_machinery_code_unique ON disposal_records (machinery_code)`,
  `CREATE INDEX IF NOT EXISTS idx_disposal_records_date ON disposal_records (proposed_date)`,
];

export const registryVisibilitySql = "NOT EXISTS (SELECT 1 FROM disposal_records WHERE disposal_records.machinery_code = machineries.code AND disposal_records.status = 'DISPOSED')";

export const disposalTriggerSql = [
  `DROP TRIGGER IF EXISTS disposal_delete_restore`,
  `DROP TRIGGER IF EXISTS disposal_insert_guard`,
  `DROP TRIGGER IF EXISTS disposal_rental_guard`,
  `CREATE TRIGGER IF NOT EXISTS disposal_delete_guard BEFORE DELETE ON disposal_records
    WHEN NOT EXISTS (SELECT 1 FROM machineries WHERE code = OLD.machinery_code)
    BEGIN SELECT RAISE(ABORT, 'DISPOSAL_MACHINE_MISSING'); END`,
  `CREATE TRIGGER IF NOT EXISTS disposal_delete_restore AFTER DELETE ON disposal_records BEGIN
    UPDATE machineries SET
      condition = COALESCE((SELECT rental_mode FROM rentals WHERE machinery_code = OLD.machinery_code AND ${currentRentalSql} ORDER BY created_at DESC, rowid DESC LIMIT 1),
        CASE WHEN condition = 'DAMAGED' THEN 'DAMAGED' ELSE 'AVAILABLE' END),
      status = CASE WHEN EXISTS (SELECT 1 FROM rentals WHERE machinery_code = OLD.machinery_code AND ${currentRentalSql}) THEN 'RENTED' WHEN EXISTS (SELECT 1 FROM repair_records WHERE machinery_code = OLD.machinery_code AND status != 'COMPLETED') THEN 'UNDER_REPAIR' ELSE 'AVAILABLE' END,
      repair_status = CASE WHEN EXISTS (SELECT 1 FROM repair_records WHERE machinery_code = OLD.machinery_code AND status != 'COMPLETED') THEN 'ACTIVE' ELSE 'NONE' END,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE code = OLD.machinery_code;
  END`,
  // Replaced together in one D1 batch to upgrade the previously deployed guards atomically.
  `DROP TRIGGER IF EXISTS disposal_update_guard`,
  `DROP TRIGGER IF EXISTS disposal_update_sync`,
  `DROP TRIGGER IF EXISTS disposal_machine_guard`,
  `CREATE TRIGGER IF NOT EXISTS disposal_insert_guard BEFORE INSERT ON disposal_records BEGIN
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM machineries WHERE code = NEW.machinery_code) THEN RAISE(ABORT, 'DISPOSAL_MACHINE_MISSING') END;
    SELECT CASE WHEN EXISTS (SELECT 1 FROM machineries WHERE code = NEW.machinery_code AND (status = 'RENTED' OR condition IN ('W','M')))
      OR EXISTS (SELECT 1 FROM rentals WHERE machinery_code = NEW.machinery_code AND ${currentRentalSql}) THEN RAISE(ABORT, 'DISPOSAL_RENTED') END;
    SELECT CASE WHEN NEW.status NOT IN ('AWAITING_DISPOSAL','DISPOSAL_APPROVED') THEN RAISE(ABORT, 'DISPOSAL_INVALID_STATUS') END;
    SELECT CASE WHEN NEW.status != 'DISPOSAL_APPROVED' AND EXISTS (SELECT 1 FROM machineries WHERE code = NEW.machinery_code AND condition = 'DISPOSAL_APPROVED') THEN RAISE(ABORT, 'DISPOSAL_ALREADY_APPROVED') END;
  END`,
  `CREATE TRIGGER IF NOT EXISTS disposal_update_guard BEFORE UPDATE ON disposal_records BEGIN
    SELECT CASE WHEN EXISTS (SELECT 1 FROM rentals WHERE machinery_code = OLD.machinery_code AND ${currentRentalSql}) THEN RAISE(ABORT, 'DISPOSAL_RENTED') END;
    SELECT CASE WHEN OLD.status = 'DISPOSED' OR (OLD.status = 'DISPOSAL_APPROVED' AND NEW.status != 'DISPOSED') THEN RAISE(ABORT, 'DISPOSAL_LOCKED') END;
    SELECT CASE WHEN NEW.machinery_code != OLD.machinery_code OR NEW.status NOT IN ('AWAITING_DISPOSAL','DISPOSAL_APPROVED','DISPOSED') OR (NEW.status = 'DISPOSED' AND OLD.status != 'DISPOSAL_APPROVED') THEN RAISE(ABORT, 'DISPOSAL_INVALID_STATUS') END;
    SELECT CASE WHEN NEW.status = 'DISPOSED' AND (
      NEW.proposed_date IS NOT OLD.proposed_date OR NEW.document_number IS NOT OLD.document_number OR NEW.reason IS NOT OLD.reason
      OR NEW.responsible_person IS NOT OLD.responsible_person OR NEW.approval_date IS NOT OLD.approval_date
      OR NEW.approval_document IS NOT OLD.approval_document OR NEW.approver IS NOT OLD.approver OR NEW.note IS NOT OLD.note
      OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at OR NEW.id IS NOT OLD.id
    ) THEN RAISE(ABORT, 'DISPOSAL_LOCKED') END;
  END`,
  `CREATE TRIGGER IF NOT EXISTS disposal_insert_sync AFTER INSERT ON disposal_records BEGIN
    UPDATE machineries SET condition = NEW.status, status = 'INACTIVE', updated_at = NEW.updated_at WHERE code = NEW.machinery_code;
  END`,
  `CREATE TRIGGER IF NOT EXISTS disposal_update_sync AFTER UPDATE ON disposal_records BEGIN
    UPDATE machineries SET condition = CASE WHEN NEW.status = 'DISPOSED' THEN 'DISPOSAL_APPROVED' ELSE NEW.status END, status = 'INACTIVE', updated_at = NEW.updated_at WHERE code = NEW.machinery_code;
  END`,
  `CREATE TRIGGER IF NOT EXISTS disposal_machine_guard BEFORE UPDATE OF condition, status ON machineries
    WHEN EXISTS (SELECT 1 FROM disposal_records WHERE machinery_code = OLD.code AND NOT COALESCE((status != 'DISPOSED' AND NEW.status = 'RENTED' AND NEW.condition = (SELECT rental_mode FROM rentals WHERE machinery_code = OLD.code AND ${currentRentalSql} ORDER BY created_at DESC, rowid DESC LIMIT 1)), 0) AND ((CASE WHEN status = 'DISPOSED' THEN 'DISPOSAL_APPROVED' ELSE status END) != NEW.condition OR NEW.status != 'INACTIVE'))
    BEGIN SELECT RAISE(ABORT, 'DISPOSAL_MANAGED'); END`,
  `CREATE TRIGGER IF NOT EXISTS disposal_rental_guard BEFORE INSERT ON rentals
    WHEN NEW.status = 'ACTIVE' AND EXISTS (SELECT 1 FROM disposal_records WHERE machinery_code = NEW.machinery_code AND status = 'DISPOSED')
    BEGIN SELECT RAISE(ABORT, 'DISPOSAL_MANAGED'); END`,
];
