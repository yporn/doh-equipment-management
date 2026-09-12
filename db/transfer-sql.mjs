export const transferSchemaSql = [
  `CREATE TABLE IF NOT EXISTS transfer_records (
    id TEXT PRIMARY KEY NOT NULL,
    transfer_date TEXT NOT NULL,
    transporters_json TEXT NOT NULL,
    items_json TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_transfer_records_date ON transfer_records (transfer_date)",
  `CREATE TABLE IF NOT EXISTS transfer_department_baselines (
    machinery_code TEXT PRIMARY KEY NOT NULL,
    department TEXT NOT NULL,
    current_department TEXT
  )`,
];

// Correlated with the machinery being updated. A date tie uses original creation order;
// editing an older trip must not silently move it ahead of a later trip.
const latestDestination = `(SELECT json_extract(item.value, '$.to.name')
  FROM transfer_records trip, json_each(trip.items_json) item
  WHERE json_extract(item.value, '$.machineryCode') = machineries.code
  ORDER BY trip.transfer_date DESC, trip.created_at DESC, trip.rowid DESC LIMIT 1)`;
const referencedCodes = json => `SELECT json_extract(value, '$.machineryCode') FROM json_each(${json})`;
const captureBaseline = codes => `INSERT OR IGNORE INTO transfer_department_baselines (machinery_code, department, current_department)
  SELECT code, department, current_department FROM machineries WHERE code IN (${codes});`;
const syncDepartments = codes => `UPDATE machineries SET
  department = COALESCE(${latestDestination}, (SELECT department FROM transfer_department_baselines WHERE machinery_code = machineries.code)),
  current_department = CASE WHEN ${latestDestination} IS NOT NULL THEN ${latestDestination}
    ELSE (SELECT current_department FROM transfer_department_baselines WHERE machinery_code = machineries.code) END,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE code IN (${codes}) AND EXISTS (SELECT 1 FROM transfer_department_baselines WHERE machinery_code = machineries.code);`;
const clearUnusedBaselines = codes => `DELETE FROM transfer_department_baselines WHERE machinery_code IN (${codes})
  AND NOT EXISTS (SELECT 1 FROM transfer_records trip, json_each(trip.items_json) item
    WHERE json_extract(item.value, '$.machineryCode') = transfer_department_baselines.machinery_code);`;
const newCodes = referencedCodes('NEW.items_json');
const oldCodes = referencedCodes('OLD.items_json');

// Each entry is one prepared statement, including the full trigger body. D1 executes
// the record write and its register updates in the same transaction.
export const transferTriggerSql = [
  `CREATE TRIGGER IF NOT EXISTS transfer_baseline_sync AFTER INSERT ON transfer_department_baselines BEGIN
    ${syncDepartments('SELECT NEW.machinery_code')}
  END`,
  `CREATE TRIGGER IF NOT EXISTS transfer_insert_departments AFTER INSERT ON transfer_records BEGIN
    ${captureBaseline(newCodes)}
    ${syncDepartments(newCodes)}
  END`,
  `CREATE TRIGGER IF NOT EXISTS transfer_update_departments AFTER UPDATE OF items_json, transfer_date ON transfer_records BEGIN
    ${captureBaseline(newCodes)}
    ${syncDepartments(`${oldCodes} UNION ${newCodes}`)}
    ${clearUnusedBaselines(oldCodes)}
  END`,
  `CREATE TRIGGER IF NOT EXISTS transfer_delete_departments AFTER DELETE ON transfer_records BEGIN
    ${syncDepartments(oldCodes)}
    ${clearUnusedBaselines(oldCodes)}
  END`,
];

// Upgrade existing trips once per machine; INSERT OR IGNORE does not reapply old trips
// on every GET, or override later rental/manual changes merely by opening a page.
export const transferBackfillSql = `INSERT OR IGNORE INTO transfer_department_baselines (machinery_code, department, current_department)
  SELECT code, department, current_department FROM machineries
  WHERE EXISTS (SELECT 1 FROM transfer_records trip, json_each(trip.items_json) item
    WHERE json_extract(item.value, '$.machineryCode') = machineries.code)`;
