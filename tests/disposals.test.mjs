import { freezeRentalMonth } from "./helpers/rental-clock.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { validateDisposal, validDisposalDate, matchesDisposal } from "../lib/disposals.mjs";
import { disposalSchemaSql, disposalTriggerSql, registryVisibilitySql } from "../db/disposal-sql.mjs";

const root = new URL("../", import.meta.url);
const draft = { machineryCode: "01-0001", proposedDate: "2026-09-03", reason: "ชำรุดไม่คุ้มค่าซ่อม", responsiblePerson: "เจ้าหน้าที่", status: "AWAITING_DISPOSAL" };
const approved = { ...draft, status: "DISPOSAL_APPROVED", approvalDate: "2026-09-04" };

test("disposal validates dates without requiring removed document and approver fields", () => {
  assert.ok(validateDisposal(draft).record);
  assert.ok(validateDisposal(approved).record);
  assert.equal(validDisposalDate("2026-02-30"), false);
  assert.equal(validDisposalDate("2024-02-29"), true);
  assert.equal(validDisposalDate("not-a-date"), false);
  for (const invalid of [{ reason: " " }, { responsiblePerson: "" }, { status: "SOLD" }, { proposedDate: "2026-13-01" }]) assert.ok(validateDisposal({ ...draft, ...invalid }).error);
  for (const invalid of [{ approvalDate: "2026-09-02" }, { approvalDate: "2026-02-30" }]) assert.ok(validateDisposal({ ...approved, ...invalid }).error);
  assert.equal(validateDisposal({ ...approved, status: "AWAITING_DISPOSAL" }).record.approvalDate, "");
  for (const field of ["documentNumber", "approvalDocument", "approver"]) assert.equal(Object.hasOwn(validateDisposal(approved).record, field), false);
});

test("disposal filters use proposal fiscal year and combine with status and search", () => {
  const record = { ...draft, proposedDate: "2025-10-01" };
  const filters = { query: " 01-0001 ", fiscalYear: "2569", status: "AWAITING_DISPOSAL" };
  assert.equal(matchesDisposal(record, filters), true);
  for (const mismatch of [{ query: "absent" }, { fiscalYear: "2568" }, { status: "DISPOSAL_APPROVED" }]) assert.equal(matchesDisposal(record, { ...filters, ...mismatch }), false);
  assert.equal(matchesDisposal(record, { query: "", fiscalYear: "", status: "" }), true);
});

async function database() {
  const db = new DatabaseSync(":memory:");
  const journal = JSON.parse(await readFile(new URL("drizzle/meta/_journal.json", root), "utf8"));
  for (const entry of journal.entries) db.exec(await readFile(new URL(`drizzle/${entry.tag}.sql`, root), "utf8"));
  // Match ensureRentalSchema's legacy runtime column upgrade before installing triggers.
  if (!db.prepare("PRAGMA table_info(rentals)").all().some(column => column.name === "rental_mode")) db.exec("ALTER TABLE rentals ADD COLUMN rental_mode TEXT DEFAULT 'W' NOT NULL");
  // Runtime initialization is idempotent after deployment migrations.
  for (let repeat = 0; repeat < 2; repeat++) for (const sql of [...disposalSchemaSql, ...disposalTriggerSql]) db.exec(freezeRentalMonth(sql));
  db.exec("PRAGMA optimize");
  return db;
}
function machine(db, code, condition = "AVAILABLE", status = "AVAILABLE") {
  db.prepare("INSERT INTO machineries (id,code,name,brand,serial_number,department,condition,status,created_at,updated_at) VALUES (?,?, 'รถทดสอบ','TEST','','ศูนย์',?,?, 'now','now')").run(code, code, condition, status);
}
function insert(db, code, status = "AWAITING_DISPOSAL") {
  db.prepare(`INSERT INTO disposal_records (id,machinery_code,proposed_date,document_number,reason,responsible_person,status,approval_date,approval_document,approver,created_by,updated_by,created_at,updated_at)
    VALUES (?,?,'2026-09-03','154/01','ชำรุด','เจ้าหน้าที่',?,'2026-09-04','154/02','ผู้อนุมัติ','user','user','now','now')`).run(`disposal:${code}`, code, status);
}

test("disposal migrations preserve history and synchronize the register atomically", async () => {
  const db = await database();
  try {
    machine(db, "A");
    insert(db, "A");
    assert.deepEqual({ ...db.prepare("SELECT condition,status FROM machineries WHERE code='A'").get() }, { condition: "AWAITING_DISPOSAL", status: "INACTIVE" });
    db.prepare("UPDATE disposal_records SET reason='แก้ไขเหตุผล' WHERE machinery_code='A'").run();
    db.prepare("UPDATE disposal_records SET status='DISPOSAL_APPROVED' WHERE machinery_code='A'").run();
    assert.equal(db.prepare("SELECT condition FROM machineries WHERE code='A'").get().condition, "DISPOSAL_APPROVED");
    assert.throws(() => db.prepare("UPDATE disposal_records SET status='AWAITING_DISPOSAL' WHERE machinery_code='A'").run(), /DISPOSAL_LOCKED/);
    assert.throws(() => db.prepare("UPDATE disposal_records SET reason='changed' WHERE machinery_code='A'").run(), /DISPOSAL_LOCKED/);
    assert.throws(() => db.prepare("UPDATE machineries SET condition='AVAILABLE',status='AVAILABLE' WHERE code='A'").run(), /DISPOSAL_MANAGED/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM machineries").get().n, 1);
    assert.equal(db.prepare("SELECT reason FROM disposal_records").get().reason, "แก้ไขเหตุผล");
    machine(db, "B"); insert(db, "B");
    assert.throws(() => insert(db, "B"), /UNIQUE/);
    assert.throws(() => db.prepare("UPDATE disposal_records SET machinery_code='A' WHERE machinery_code='B'").run(), /DISPOSAL_INVALID_STATUS/);
    assert.match(db.prepare("EXPLAIN QUERY PLAN SELECT * FROM disposal_records WHERE machinery_code='A'").all().map(row => row.detail).join(" "), /INDEX/);
  } finally { db.close(); }
});

test("disposal rejects leased machines, missing codes, downgrades and subsequent rentals", async () => {
  const db = await database();
  try {
    machine(db, "LEASED", "W", "RENTED");
    assert.throws(() => insert(db, "LEASED"), /DISPOSAL_RENTED/);
    machine(db, "ACTIVE");
    const rent = db.prepare("INSERT INTO rentals (id,machinery_code,renter_name,start_date,expected_return_date,rate_type,rate_amount,approver,status,created_at,updated_at) VALUES (?,?,'ศูนย์','2026-09-01','2026-09-10','DAILY',0,'เจ้าหน้าที่','ACTIVE','now','now')");
    rent.run("r1", "ACTIVE");
    assert.throws(() => insert(db, "ACTIVE"), /DISPOSAL_RENTED/);
    assert.throws(() => insert(db, "MISSING"), /DISPOSAL_MACHINE_MISSING/);
    machine(db, "LEGACY", "DISPOSAL_APPROVED", "INACTIVE");
    assert.throws(() => insert(db, "LEGACY"), /DISPOSAL_ALREADY_APPROVED/);
    insert(db, "LEGACY", "DISPOSAL_APPROVED");
    rent.run("r2", "LEGACY");
    assert.throws(() => db.exec("UPDATE disposal_records SET status='DISPOSED' WHERE machinery_code='LEGACY'"), /DISPOSAL_RENTED/);
    db.exec("DELETE FROM rentals WHERE id='r2'");
    db.exec("UPDATE disposal_records SET status='DISPOSED' WHERE machinery_code='LEGACY'");
    assert.throws(() => rent.run("r3", "LEGACY"), /DISPOSAL_MANAGED/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM rentals").get().n, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM disposal_records").get().n, 1);
  } finally { db.close(); }
});

test("disposal deployment SQL supports statement splitting and retry after partial application", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const migration = await readFile(new URL("drizzle/0010_dashing_ironclad.sql", root), "utf8");
    assert.doesNotMatch(migration, /CREATE TRIGGER/);
    const statements = migration.replaceAll("--> statement-breakpoint", "").split(";").map(value => value.trim()).filter(Boolean);
    for (let repeat = 0; repeat < 2; repeat++) for (const statement of statements) db.prepare(freezeRentalMonth(statement)).run();
    assert.equal(db.prepare("SELECT count(*) AS n FROM disposal_records").get().n, 0);
  } finally { db.close(); }
});

test("completed disposal is hidden from register while equipment and service history remain", async () => {
  const db = await database();
  try {
    machine(db, "KEEP"); machine(db, "DONE");
    db.prepare("UPDATE machineries SET brand='CAT',model='D6',current_department='โครงการเดิม',note='ข้อมูลเดิม' WHERE code='DONE'").run();
    db.prepare("INSERT INTO service_records (id,machinery_code,service_date,items_json,created_at,updated_at) VALUES ('service1','DONE','2026-01-01','[]','now','now')").run();
    insert(db, "DONE");
    const visible = () => db.prepare(`SELECT code FROM machineries WHERE ${registryVisibilitySql} ORDER BY code`).all().map(row => row.code);
    assert.deepEqual(visible(), ["DONE", "KEEP"]);
    assert.throws(() => db.prepare("UPDATE disposal_records SET status='DISPOSED' WHERE machinery_code='DONE'").run(), /DISPOSAL_INVALID_STATUS/);
    db.prepare("UPDATE disposal_records SET status='DISPOSAL_APPROVED' WHERE machinery_code='DONE'").run();
    assert.deepEqual(visible(), ["DONE", "KEEP"]);
    assert.throws(() => db.prepare("UPDATE disposal_records SET status='DISPOSED',approver='changed' WHERE machinery_code='DONE'").run(), /DISPOSAL_LOCKED/);
    const result = db.prepare("UPDATE disposal_records SET status='DISPOSED',updated_at='2026-09-05T00:00:00Z',updated_by='user2' WHERE machinery_code='DONE' AND status='DISPOSAL_APPROVED'").run();
    assert.equal(result.changes, 1);
    assert.deepEqual(visible(), ["KEEP"]);
    assert.equal(db.prepare("SELECT count(*) AS n FROM machineries").get().n, 2);
    const history = db.prepare("SELECT d.status,d.approver,d.document_number,m.brand,m.model,m.note,m.current_department FROM disposal_records d LEFT JOIN machineries m ON m.code=d.machinery_code WHERE d.machinery_code='DONE'").get();
    assert.deepEqual({ ...history }, { status: "DISPOSED", approver: "ผู้อนุมัติ", document_number: "154/01", brand: "CAT", model: "D6", note: "ข้อมูลเดิม", current_department: "โครงการเดิม" });
    assert.equal(db.prepare("SELECT count(*) AS n FROM service_records WHERE machinery_code='DONE'").get().n, 1);
    assert.throws(() => db.prepare("UPDATE disposal_records SET status='DISPOSAL_APPROVED' WHERE machinery_code='DONE'").run(), /DISPOSAL_LOCKED/);
    assert.throws(() => db.prepare("UPDATE machineries SET condition='AVAILABLE',status='AVAILABLE' WHERE code='DONE'").run(), /DISPOSAL_MANAGED/);
    assert.equal(db.prepare("UPDATE disposal_records SET status='DISPOSED' WHERE machinery_code='DONE' AND status='DISPOSAL_APPROVED'").run().changes, 0);
    assert.equal(matchesDisposal({ ...draft, status: "DISPOSED" }, { query: "", fiscalYear: "2569", status: "DISPOSED" }), true);
    assert.ok(validateDisposal({ ...approved, status: "DISPOSED" }).error);
  } finally { db.close(); }
});

test("existing approval locks upgrade safely to allow completion without deleting records", async () => {
  const db = await database();
  try {
    machine(db, "OLD"); insert(db, "OLD", "DISPOSAL_APPROVED");
    db.exec("DROP TRIGGER disposal_update_guard");
    db.exec("CREATE TRIGGER disposal_update_guard BEFORE UPDATE ON disposal_records BEGIN SELECT RAISE(ABORT, 'OLD_LOCK'); END");
    assert.throws(() => db.prepare("UPDATE disposal_records SET status='DISPOSED'").run(), /OLD_LOCK/);
    db.exec("BEGIN");
    for (const statement of disposalTriggerSql) db.prepare(statement).run();
    db.exec("COMMIT");
    db.prepare("UPDATE disposal_records SET status='DISPOSED'").run();
    assert.equal(db.prepare("SELECT status FROM disposal_records").get().status, "DISPOSED");
    assert.equal(db.prepare("SELECT count(*) AS n FROM machineries").get().n, 1);
  } finally { db.close(); }
});

test("disposal UI, API authorization and repair integration are wired", async () => {
  const [page, sidebar, api, repairs, machinery] = await Promise.all(["app/disposals/page.tsx", "app/components/app-sidebar.tsx", "app/api/disposals/route.ts", "app/api/repairs/route.ts", "app/api/machineries/route.ts"].map(path => readFile(new URL(path, root), "utf8")));
  assert.ok(sidebar.indexOf('link("/disposals"') > sidebar.indexOf('link("/repairs"'));
  assert.match(page, /AppSidebar active="disposals"/);
  for (const label of ["วันที่เสนอจำหน่าย", "เหตุผลที่เสนอจำหน่าย", "ผู้รับผิดชอบ", "วันที่อนุมัติ", "ปีงบประมาณ", "ล้างตัวกรอง", "ลบข้อมูล", "ลบและคืนเข้าบัญชี"]) assert.ok(page.includes(label));
  for (const field of ["documentNumber", "approvalDocument", "approver"]) assert.ok(!page.includes(field));
  assert.match(page, /ConfirmSubmitButton/);
  assert.match(api, /requireUser\(request\)/);
  assert.match(api, /ensureDisposalSchema/);
  assert.match(api, /export async function DELETE/);
  assert.match(api, /eq\(disposalRecords.updatedAt, input.updatedAt\)/);
  assert.doesNotMatch(api, /delete\(machineries\)/);
  assert.match(repairs, /ensureDisposalSchema/);
  assert.match(machinery, /condition !== disposal.status/);
  assert.match(machinery, /where\(sql.raw\(registryVisibilitySql\)\)/);
  assert.match(machinery, /setWhere: sql`NOT EXISTS/);
  assert.match(api, /input.action === "DISPOSE"/);
  assert.match(api, /eq\(disposalRecords.status, "DISPOSAL_APPROVED"\)/);
  assert.match(api, /machinery: getTableColumns\(machineries\)/);
  assert.match(page, /ConfirmActionButton/);
  assert.match(page, /ยืนยันจำหน่ายแล้ว/);
});

test("disposal list no longer offers the removed summary report", async () => {
  const page = await readFile(new URL("app/disposals/page.tsx", root), "utf8");
  assert.doesNotMatch(page, /setShowReport/);
  assert.doesNotMatch(page, /พิมพ์รายงาน/);
  assert.doesNotMatch(page, /report-shell\.css/);
});

test("deleting any disposal status restores the register without deleting equipment or history", async () => {
  const db = await database();
  try {
    for (const state of ["AWAITING_DISPOSAL", "DISPOSAL_APPROVED", "DISPOSED"]) {
      machine(db, state); insert(db, state);
      if (state !== "AWAITING_DISPOSAL") db.prepare("UPDATE disposal_records SET status='DISPOSAL_APPROVED' WHERE machinery_code=?").run(state);
      if (state === "DISPOSED") db.prepare("UPDATE disposal_records SET status='DISPOSED' WHERE machinery_code=?").run(state);
      db.prepare("INSERT INTO service_records (id,machinery_code,service_date,items_json,created_at,updated_at) VALUES (?,?,'2026-01-01','[]','now','now')").run(`service:${state}`, state);
      assert.equal(db.prepare("DELETE FROM disposal_records WHERE machinery_code=? AND updated_at='stale'").run(state).changes, 0);
      assert.equal(db.prepare("DELETE FROM disposal_records WHERE machinery_code=? AND updated_at='now'").run(state).changes, 1);
      assert.equal(db.prepare(`SELECT count(*) AS n FROM machineries WHERE code=? AND ${registryVisibilitySql}`).get(state).n, 1);
      assert.deepEqual({ ...db.prepare("SELECT condition,status FROM machineries WHERE code=?").get(state) }, { condition: "AVAILABLE", status: "AVAILABLE" });
      assert.equal(db.prepare("SELECT count(*) AS n FROM service_records WHERE machinery_code=?").get(state).n, 1);
      insert(db, state); // Deletion permits a new proposal for the same machine.
    }
    assert.equal(db.prepare("SELECT count(*) AS n FROM machineries").get().n, 3);
  } finally { db.close(); }
});

test("deletion preserves active repairs and rolls back if machinery restoration fails", async () => {
  const db = await database();
  try {
    machine(db, "REPAIR"); insert(db, "REPAIR");
    db.prepare("INSERT INTO repair_records (id,machinery_code,repair_date,work_systems_json,symptom,reporter,status,created_at,updated_at) VALUES ('r','REPAIR','2026-09-01','[]','เสีย','เจ้าหน้าที่','IN_PROGRESS','now','now')").run();
    db.prepare("DELETE FROM disposal_records WHERE machinery_code='REPAIR'").run();
    assert.deepEqual({ ...db.prepare("SELECT condition,status,repair_status FROM machineries WHERE code='REPAIR'").get() }, { condition: "AVAILABLE", status: "UNDER_REPAIR", repair_status: "ACTIVE" });
    assert.equal(db.prepare("SELECT count(*) AS n FROM repair_records").get().n, 1);
    machine(db, "FAIL"); insert(db, "FAIL");
    db.exec("CREATE TRIGGER simulate_restore_failure BEFORE UPDATE ON machineries WHEN OLD.code='FAIL' BEGIN SELECT RAISE(ABORT,'RESTORE_FAILED'); END");
    assert.throws(() => db.prepare("DELETE FROM disposal_records WHERE machinery_code='FAIL'").run(), /RESTORE_FAILED/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM disposal_records WHERE machinery_code='FAIL'").get().n, 1);
    assert.equal(db.prepare("SELECT condition FROM machineries WHERE code='FAIL'").get().condition, "AWAITING_DISPOSAL");
  } finally { db.close(); }
});

test("production build renders the protected disposal page", async () => {
  const { default: worker } = await import(new URL("dist/server/index.js", root).href);
  const response = await worker.fetch(new Request("http://localhost/disposals", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /กำลังตรวจสอบการเข้าสู่ระบบ/);
});
