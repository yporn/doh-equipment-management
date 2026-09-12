import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { transferSchemaSql, transferTriggerSql, transferBackfillSql } from "../db/transfer-sql.mjs";

const item = (code, from, to) => ({ machineryCode: code, from: { kind: "DEPARTMENT", name: from }, to: { kind: "OTHER", name: to } });
function initialize(db) { for (const sql of [...transferSchemaSql, ...transferTriggerSql, transferBackfillSql]) db.exec(sql); }
function database(legacy = false) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE machineries (code TEXT PRIMARY KEY, department TEXT NOT NULL, current_department TEXT, owning_department TEXT, condition TEXT, status TEXT, updated_at TEXT);
    INSERT INTO machineries VALUES ('M1','A','A','OWNER','DAMAGED','UNDER_REPAIR','before'), ('M2','B','B','OWNER','W','RENTED','before'), ('CARRIER','DEPOT','DEPOT','OWNER','AVAILABLE','AVAILABLE','before');`);
  for (const sql of transferSchemaSql) db.exec(sql);
  if (!legacy) initialize(db);
  return db;
}
function insert(db, id, date, items, created = id) { db.prepare("INSERT INTO transfer_records VALUES (?, ?, ?, ?, ?, ?)").run(id, date, '["CARRIER"]', JSON.stringify(items), "staff", created); }
function update(db, id, date, items) { db.prepare("UPDATE transfer_records SET transfer_date = ?, items_json = ? WHERE id = ?").run(date, JSON.stringify(items), id); }
function remove(db, id) { db.prepare("DELETE FROM transfer_records WHERE id = ?").run(id); }
function location(db, code = "M1") { return db.prepare("SELECT current_department FROM machineries WHERE code = ?").get(code).current_department; }

test("trip insert updates each transported machine atomically without moving carriers or changing status/owner", () => {
  const db = database();
  insert(db, "1", "2026-09-03", [item("M1", "A", "B"), item("M2", "B", "A")]);
  assert.equal(location(db), "B"); assert.equal(location(db, "M2"), "A"); assert.equal(location(db, "CARRIER"), "DEPOT");
  assert.deepEqual({ ...db.prepare("SELECT department, owning_department, condition, status FROM machineries WHERE code='M1'").get() }, { department: "B", owning_department: "OWNER", condition: "DAMAGED", status: "UNDER_REPAIR" });
  assert.equal(db.prepare("SELECT status FROM machineries WHERE code='M2'").get().status, "RENTED");
  db.close();
});

test("latest transfer date wins; same day follows original creation order, not edit time", () => {
  const db = database();
  insert(db, "1", "2026-09-03", [item("M1", "A", "B")], "2026-09-03T01:00:00Z");
  insert(db, "2", "2026-09-05", [item("M1", "B", "C")], "2026-09-03T02:00:00Z");
  insert(db, "3", "2026-09-01", [item("M1", "A", "OLD")], "2026-09-03T03:00:00Z");
  assert.equal(location(db), "C");
  update(db, "1", "2026-09-05", [item("M1", "A", "EDITED")]); assert.equal(location(db), "C");
  update(db, "1", "2026-09-06", [item("M1", "A", "NEWEST")]); assert.equal(location(db), "NEWEST");
  remove(db, "3"); assert.equal(location(db), "NEWEST");
  remove(db, "1"); assert.equal(location(db), "C");
  remove(db, "2"); assert.equal(location(db), "A");
  assert.equal(db.prepare("SELECT count(*) n FROM transfer_department_baselines").get().n, 0);
  db.close();
});

test("changing machines restores removed machines and initializes new machines; deleting last restores baseline", () => {
  const db = database();
  insert(db, "1", "2026-09-03", [item("M1", "A", "B")]);
  update(db, "1", "2026-09-03", [item("M2", "B", "OTHER SITE")]);
  assert.equal(location(db), "A"); assert.equal(location(db, "M2"), "OTHER SITE");
  remove(db, "1"); assert.equal(location(db, "M2"), "B");
  db.exec("UPDATE machineries SET current_department='MANUAL' WHERE code='M1'");
  insert(db, "2", "2026-09-07", [item("M1", "MANUAL", "C")]);
  remove(db, "2"); assert.equal(location(db), "MANUAL");
  db.close();
});

test("existing history is synchronized once and survives repeat initialization and migration", async () => {
  const db = database(true);
  insert(db, "1", "2026-09-03", [item("M1", "A", "B")]);
  insert(db, "2", "2026-09-04", [item("M1", "B", "C")]);
  assert.equal(location(db), "A"); initialize(db); assert.equal(location(db), "C");
  db.exec("UPDATE machineries SET current_department='RENTAL' WHERE code='M1'");
  initialize(db); assert.equal(location(db), "RENTAL");
  const migration = await readFile(new URL("../drizzle/0012_complex_skin.sql", import.meta.url), "utf8");
  db.exec(migration); db.exec(migration);
  remove(db, "2"); assert.equal(location(db), "B"); remove(db, "1"); assert.equal(location(db), "A");
  db.close();
});

test("failed register changes roll back insert, update, and delete with their baseline changes", () => {
  const db = database();
  db.exec("CREATE TRIGGER fail_location BEFORE UPDATE ON machineries WHEN NEW.current_department='FAIL' BEGIN SELECT RAISE(ABORT,'SIMULATED_FAILURE'); END");
  assert.throws(() => insert(db, "bad", "2026-09-03", [item("M1", "A", "B"), item("M2", "B", "FAIL")]), /SIMULATED_FAILURE/);
  assert.equal(location(db), "A"); assert.equal(db.prepare("SELECT count(*) n FROM transfer_records").get().n, 0);
  assert.equal(db.prepare("SELECT count(*) n FROM transfer_department_baselines").get().n, 0);
  insert(db, "1", "2026-09-03", [item("M1", "A", "B")]);
  assert.throws(() => update(db, "1", "2026-09-03", [item("M1", "A", "FAIL")]), /SIMULATED_FAILURE/);
  assert.equal(location(db), "B");
  db.exec("CREATE TRIGGER fail_restore BEFORE UPDATE ON machineries WHEN NEW.current_department='A' BEGIN SELECT RAISE(ABORT,'RESTORE_FAILURE'); END");
  assert.throws(() => remove(db, "1"), /RESTORE_FAILURE/);
  assert.equal(location(db), "B"); assert.equal(db.prepare("SELECT count(*) n FROM transfer_records").get().n, 1);
  db.close();
});

test("stale edit and delete do not execute synchronization triggers", () => {
  const db = database();
  insert(db, "1", "2026-09-03", [item("M1", "A", "B")]);
  const oldItems = JSON.stringify([item("M1", "A", "B")]);
  update(db, "1", "2026-09-03", [item("M1", "A", "C")]);
  assert.equal(db.prepare("DELETE FROM transfer_records WHERE id='1' AND items_json=?").run(oldItems).changes, 0);
  assert.equal(db.prepare("UPDATE transfer_records SET transfer_date='2026-09-09' WHERE id='1' AND items_json=?").run(oldItems).changes, 0);
  assert.equal(location(db), "C");
  db.close();
});
