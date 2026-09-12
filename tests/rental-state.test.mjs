import { freezeRentalMonth } from "./helpers/rental-clock.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { rentalStateTriggerSql } from "../db/rental-state-sql.mjs";
import { rentalDepartmentTriggerSql } from "../db/rental-department-sql.mjs";
import { disposalSchemaSql, disposalTriggerSql } from "../db/disposal-sql.mjs";

test("all register states accept rental and latest saved active record controls renter independently of location", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const root = new URL("../", import.meta.url);
    const journal = JSON.parse(await readFile(new URL("drizzle/meta/_journal.json", root), "utf8"));
    for (const entry of journal.entries) db.exec(await readFile(new URL(`drizzle/${entry.tag}.sql`, root), "utf8"));
    if (!db.prepare("PRAGMA table_info(rentals)").all().some(c => c.name === "rental_mode")) db.exec("ALTER TABLE rentals ADD rental_mode TEXT NOT NULL DEFAULT 'W'");
    for (let i = 0; i < 2; i++) for (const sql of [...disposalSchemaSql, ...disposalTriggerSql, ...rentalDepartmentTriggerSql, ...rentalStateTriggerSql]) db.exec(freezeRentalMonth(sql));
    const machine = db.prepare("INSERT INTO machineries (id,code,name,brand,serial_number,department,current_department,condition,status,created_at,updated_at) VALUES (?,?,'test','test','','physical','physical',?,?,'now','now')");
    const rent = db.prepare("INSERT INTO rentals (id,machinery_code,renter_name,start_date,expected_return_date,rate_type,rate_amount,approver,status,rental_mode,created_at,updated_at) VALUES (?,?,?,'2026-09-01','2026-09-02','DAILY',0,'test','ACTIVE',?,'now','now')");
    for (const [index, condition] of ["AVAILABLE","W","M","DAMAGED","AWAITING_DISPOSAL","DISPOSAL_APPROVED"].entries()) {
      const code = String(index);
      machine.run(code, code, condition, "INACTIVE");
      rent.run("r"+code, code, "project", "W");
      assert.deepEqual({...db.prepare("SELECT condition,status,renter_department,current_department FROM machineries WHERE code=?").get(code)}, {condition:"W",status:"RENTED",renter_department:"project",current_department:"physical"});
    }
    rent.run("new", "0", "new project", "M");
    db.exec("UPDATE rentals SET renter_name='old edit' WHERE id='r0'");
    assert.equal(db.prepare("SELECT renter_department FROM machineries WHERE code='0'").get().renter_department, "new project");
    db.exec("DELETE FROM rentals WHERE id='new'");
    assert.equal(db.prepare("SELECT renter_department FROM machineries WHERE code='0'").get().renter_department, "old edit");
    db.exec("UPDATE machineries SET repair_status='ACTIVE' WHERE code='0'");
    db.exec("UPDATE rentals SET status='RETURNED' WHERE id='r0'");
    assert.deepEqual({...db.prepare("SELECT condition,status,repair_status,renter_department FROM machineries WHERE code='0'").get()}, {condition:"AVAILABLE",status:"AVAILABLE",repair_status:"NONE",renter_department:null});
    machine.run("repair-only","repair-only","AVAILABLE","AVAILABLE");
    db.exec("INSERT INTO repair_records (id,machinery_code,repair_date,work_systems_json,symptom,reporter,parts_json,total_cost,status,created_at,updated_at) VALUES ('repair-only','repair-only','2026-09-01','[]','','ฝ่ายเครื่องกล','[]',0,'IN_PROGRESS','now','now')");
    assert.deepEqual({...db.prepare("SELECT condition,status,repair_status FROM machineries WHERE code='repair-only'").get()}, {condition:"AVAILABLE",status:"UNDER_REPAIR",repair_status:"ACTIVE"});
    db.exec("UPDATE repair_records SET status='COMPLETED', completed_date='2026-09-02' WHERE id='repair-only'");
    assert.deepEqual({...db.prepare("SELECT condition,status,repair_status FROM machineries WHERE code='repair-only'").get()}, {condition:"AVAILABLE",status:"AVAILABLE",repair_status:"NONE"});
    machine.run("damaged-repair","damaged-repair","DAMAGED","AVAILABLE");
    db.exec("INSERT INTO repair_records (id,machinery_code,repair_date,work_systems_json,symptom,reporter,parts_json,total_cost,status,created_at,updated_at) VALUES ('damaged-repair','damaged-repair','2026-09-01','[]','','ฝ่ายเครื่องกล','[]',0,'IN_PROGRESS','now','now')");
    assert.deepEqual({...db.prepare("SELECT condition,status,repair_status FROM machineries WHERE code='damaged-repair'").get()}, {condition:"DAMAGED",status:"UNDER_REPAIR",repair_status:"ACTIVE"});
    db.exec("UPDATE repair_records SET status='COMPLETED', completed_date='2026-09-02' WHERE id='damaged-repair'");
    assert.deepEqual({...db.prepare("SELECT condition,status,repair_status FROM machineries WHERE code='damaged-repair'").get()}, {condition:"AVAILABLE",status:"AVAILABLE",repair_status:"NONE"});
    machine.run("rented-repair","rented-repair","AVAILABLE","AVAILABLE");
    rent.run("rr","rented-repair","โครงการเช่า","M");
    db.exec("INSERT INTO repair_records (id,machinery_code,repair_date,work_systems_json,symptom,reporter,parts_json,total_cost,status,created_at,updated_at) VALUES ('rrp','rented-repair','2026-09-01','[]','','ฝ่ายเครื่องกล','[]',0,'WAITING','now','now')");
    assert.deepEqual({...db.prepare("SELECT condition,status,repair_status,renter_department FROM machineries WHERE code='rented-repair'").get()}, {condition:"M",status:"RENTED",repair_status:"ACTIVE",renter_department:"โครงการเช่า"});
    db.exec("UPDATE repair_records SET status='COMPLETED', completed_date='2026-09-03' WHERE id='rrp'");
    assert.deepEqual({...db.prepare("SELECT condition,status,repair_status,renter_department FROM machineries WHERE code='rented-repair'").get()}, {condition:"M",status:"RENTED",repair_status:"NONE",renter_department:"โครงการเช่า"});
    machine.run("d","d","AVAILABLE","AVAILABLE");
    db.exec("INSERT INTO disposal_records (id,machinery_code,proposed_date,document_number,reason,responsible_person,status,created_by,updated_by,created_at,updated_at) VALUES ('d','d','2026-01-01','','test','test','DISPOSAL_APPROVED','u','u','now','now')");
    rent.run("rd","d","project","W");
    assert.throws(() => db.exec("UPDATE disposal_records SET status='DISPOSED' WHERE id='d'"), /DISPOSAL_RENTED/);
    db.exec("DELETE FROM rentals WHERE id='rd'");
    assert.equal(db.prepare("SELECT condition FROM machineries WHERE code='d'").get().condition,"DISPOSAL_APPROVED");
    db.exec("UPDATE disposal_records SET status='DISPOSED' WHERE id='d'");
    assert.throws(() => rent.run("sold","d","project","W"), /DISPOSAL_MANAGED/);
  } finally { db.close(); }
});
