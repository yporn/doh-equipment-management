import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { rentalStateTriggerSql, rentalStateRefreshSql } from "../db/rental-state-sql.mjs";
import { rentalDepartmentTriggerSql, rentalDepartmentBackfillSql } from "../db/rental-department-sql.mjs";
import { disposalSchemaSql, disposalTriggerSql, registryVisibilitySql } from "../db/disposal-sql.mjs";
import { bangkokMonth, isCurrentRental, watchBangkokMonth } from "../lib/rental-activity.mjs";

async function fixture(month = "2026-09") {
  const db = new DatabaseSync(":memory:");
  const clock = { month };
  db.function("test_month", () => clock.month);
  const sql = text => text.replaceAll("strftime('%Y-%m','now','+7 hours')", "test_month()");
  const root = new URL("../", import.meta.url);
  const journal = JSON.parse(await readFile(new URL("drizzle/meta/_journal.json", root), "utf8"));
  for (const entry of journal.entries) db.exec(await readFile(new URL(`drizzle/${entry.tag}.sql`, root), "utf8"));
  if (!db.prepare("PRAGMA table_info(rentals)").all().some(c => c.name === "rental_mode")) db.exec("ALTER TABLE rentals ADD rental_mode TEXT NOT NULL DEFAULT 'W'");
  const install = () => {
    db.exec("BEGIN");
    for (const statement of [...rentalDepartmentTriggerSql, rentalDepartmentBackfillSql, ...disposalSchemaSql, ...disposalTriggerSql, ...rentalStateTriggerSql, rentalStateRefreshSql]) db.exec(sql(statement));
    db.exec("COMMIT");
  };
  install();
  const machine = (code, condition = "AVAILABLE") => db.prepare("INSERT INTO machineries (id,code,name,brand,serial_number,department,current_department,owning_department,leasing_department,condition,status,created_at,updated_at) VALUES (?,?,'test','test','','SITE','SITE','OWNER','LENDER',?,'AVAILABLE','now','now')").run(code,code,condition);
  const rent = (id, code, start, mode = "W") => db.prepare("INSERT INTO rentals (id,machinery_code,renter_name,start_date,expected_return_date,rate_type,rate_amount,approver,status,rental_mode,created_at,updated_at) VALUES (?,?,?,?,'2027-12-31','DAILY',0,'staff','ACTIVE',?,'now','now')").run(id,code,id,start,mode);
  const repair = (id, code) => db.prepare("INSERT INTO repair_records (id,machinery_code,repair_date,work_systems_json,symptom,reporter,status,created_at,updated_at) VALUES (?,?,'2026-09-01','[]','broken','staff','IN_PROGRESS','now','now')").run(id,code);
  const dispose = (code, state = "AWAITING_DISPOSAL") => db.prepare("INSERT INTO disposal_records (id,machinery_code,proposed_date,document_number,reason,responsible_person,status,created_by,updated_by,created_at,updated_at) VALUES (?,?,'2026-09-01','','test','staff',?,'staff','staff','now','now')").run(code,code,state);
  const state = code => ({...db.prepare("SELECT condition,status,repair_status,renter_department FROM machineries WHERE code=?").get(code)});
  const refresh = () => db.prepare(sql(rentalStateRefreshSql)).run();
  return {db, clock, machine, rent, repair, dispose, state, refresh, install};
}

test("month rollover releases equipment without modifying rental history or location", async () => {
  const f = await fixture();
  try {
    f.machine("A"); f.rent("sep","A","2026-09-30");
    assert.equal(f.state("A").status,"RENTED");
    const history = f.db.prepare("SELECT * FROM rentals").all();
    f.clock.month = "2026-10"; f.install();
    assert.deepEqual(f.state("A"),{condition:"AVAILABLE",status:"AVAILABLE",repair_status:"NONE",renter_department:null});
    assert.deepEqual(f.db.prepare("SELECT * FROM rentals").all(),history);
    assert.deepEqual({...f.db.prepare("SELECT current_department,department,owning_department,leasing_department FROM machineries").get()},{current_department:"SITE",department:"SITE",owning_department:"OWNER",leasing_department:"LENDER"});
    assert.equal(f.refresh().changes,0);
    f.rent("oct","A","2026-10-01","M");
    assert.equal(f.state("A").condition,"M"); assert.equal(f.state("A").renter_department,"oct");
  } finally { f.db.close(); }
});

test("future and historic months do not override current renter; edits and deletion resynchronize", async () => {
  const f = await fixture("2026-12");
  try {
    f.machine("A"); f.machine("B");
    f.rent("dec","A","2026-12-01"); f.rent("jan","A","2027-01-01","M"); f.rent("old","A","2026-11-01");
    assert.equal(f.state("A").renter_department,"dec");
    f.clock.month = "2027-01"; f.refresh();
    assert.equal(f.state("A").renter_department,"jan");
    f.db.exec("UPDATE rentals SET start_date='2026-12-01' WHERE id='jan'");
    assert.equal(f.state("A").status,"AVAILABLE");
    f.db.exec("UPDATE rentals SET start_date='2027-01-01',machinery_code='B' WHERE id='jan'");
    assert.equal(f.state("B").condition,"M");
    f.db.exec("DELETE FROM rentals WHERE id='old'");
    assert.equal(f.state("B").renter_department,"jan");
    f.db.exec("DELETE FROM rentals WHERE id='jan'");
    assert.equal(f.state("B").status,"AVAILABLE");
  } finally { f.db.close(); }
});

test("repair remains active across rental month rollover and completion restores vacancy atomically", async () => {
  const f = await fixture();
  try {
    f.machine("A"); f.machine("B"); f.repair("repair","A"); f.rent("sep","A","2026-09-01");
    assert.equal(f.state("A").condition,"W");
    f.clock.month = "2026-10"; f.refresh();
    assert.equal(f.state("A").condition,"AVAILABLE");
    f.db.exec("UPDATE repair_records SET machinery_code='B' WHERE id='repair'");
    assert.equal(f.state("A").condition,"AVAILABLE"); assert.equal(f.state("B").condition,"AVAILABLE");
    f.db.exec("UPDATE repair_records SET status='COMPLETED' WHERE id='repair'");
    assert.equal(f.state("B").condition,"AVAILABLE"); assert.equal(f.state("B").repair_status,"NONE");
    f.rent("oct","A","2026-10-01"); f.repair("r2","A");
    f.db.exec("DELETE FROM repair_records WHERE id='r2'");
    assert.equal(f.state("A").condition,"W");
  } finally { f.db.close(); }
});

test("month refresh preserves disposal states and old rentals do not block disposal", async () => {
  const f = await fixture();
  try {
    f.machine("A"); f.dispose("A","DISPOSAL_APPROVED"); f.rent("sep","A","2026-09-01");
    assert.throws(() => f.db.exec("UPDATE disposal_records SET status='DISPOSED' WHERE id='A'"),/DISPOSAL_RENTED/);
    f.clock.month = "2026-10"; f.install();
    assert.equal(f.state("A").condition,"DISPOSAL_APPROVED");
    f.db.exec("UPDATE disposal_records SET status='DISPOSED' WHERE id='A'");
    f.refresh();
    assert.equal(f.db.prepare(`SELECT count(*) n FROM machineries WHERE ${registryVisibilitySql}`).get().n,0);
    f.machine("LEGACY","AWAITING_DISPOSAL"); f.refresh();
    assert.equal(f.state("LEGACY").condition,"AWAITING_DISPOSAL");
    f.machine("B"); f.rent("past","B","2026-09-01"); f.dispose("B");
    assert.equal(f.state("B").condition,"AWAITING_DISPOSAL");
  } finally { f.db.close(); }
});

test("failed register synchronization rolls back rental and repair writes", async () => {
  const f = await fixture();
  try {
    f.machine("A");
    f.db.exec("CREATE TRIGGER simulate_failure BEFORE UPDATE ON machineries BEGIN SELECT RAISE(ABORT,'TEST_FAILED'); END");
    assert.throws(() => f.rent("sep","A","2026-09-01"),/TEST_FAILED/);
    assert.throws(() => f.repair("repair","A"),/TEST_FAILED/);
    assert.equal(f.db.prepare("SELECT count(*) n FROM rentals").get().n,0);
    assert.equal(f.db.prepare("SELECT count(*) n FROM repair_records").get().n,0);
  } finally { f.db.close(); }
});

test("Thai month boundary agrees in SQL and UI, including December to January", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const [instant, month] of [["2026-09-30T16:59:59Z","2026-09"],["2026-09-30T17:00:00Z","2026-10"],["2026-12-31T17:00:00Z","2027-01"]]) {
      assert.equal(bangkokMonth(new Date(instant)),month);
      assert.equal(db.prepare("SELECT strftime('%Y-%m',?,'+7 hours') month").get(instant).month,month);
      assert.equal(isCurrentRental({status:"ACTIVE",startDate:month+"-01"},new Date(instant)),true);
      assert.equal(isCurrentRental({status:"RETURNED",startDate:month+"-01"},new Date(instant)),false);
    }
  } finally { db.close(); }
});

test("open pages refresh once on Thai month changes and stop listening on unmount", () => {
  let current = new Date("2026-09-30T16:59:00Z");
  let calls = 0;
  let tick, focus;
  const target = {
    setInterval(fn, interval) { assert.equal(interval,60_000); tick = fn; return 1; },
    clearInterval(id) { assert.equal(id,1); tick = null; },
    addEventListener(event, fn) { assert.equal(event,"focus"); focus = fn; },
    removeEventListener(event, fn) { assert.equal(event,"focus"); assert.equal(fn,focus); focus = null; },
  };
  const stop = watchBangkokMonth(() => calls++,target,() => current);
  tick(); assert.equal(calls,0);
  current = new Date("2026-09-30T17:00:00Z");
  tick(); focus(); assert.equal(calls,1);
  current = new Date("2026-10-31T17:00:00Z");
  focus(); assert.equal(calls,2);
  stop(); assert.equal(tick,null); assert.equal(focus,null);
});

test("registry, rentals and repairs initialize monthly state and pages remove return controls", async () => {
  const root = new URL("../",import.meta.url);
  const registry = await readFile(new URL("app/api/machineries/route.ts",root),"utf8");
  const repairApi = await readFile(new URL("app/api/repairs/route.ts",root),"utf8");
  const db = await readFile(new URL("db/index.ts",root),"utf8");
  const rentalPage = await readFile(new URL("app/rentals/page.tsx",root),"utf8");
  const registryPage = await readFile(new URL("app/page.tsx",root),"utf8");
  assert.match(registry,/await refreshMachineryState\(\)/);
  assert.match(repairApi,/await ensureDisposalSchema\(\)/);
  assert.doesNotMatch(repairApi,/syncMachineRepairStatus/);
  assert.match(db,/await refreshMachineryState\(\)/);
  assert.doesNotMatch(rentalPage,/รับคืน|setReturning|returnMachine|เกินกำหนดคืน/);
  assert.match(rentalPage,/isCurrentRental\(record\)/);
  for (const page of [rentalPage,registryPage]) assert.match(page,/return watchBangkokMonth/);
});
