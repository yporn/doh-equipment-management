import { freezeRentalMonth } from "./helpers/rental-clock.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { matchesRentalHistory, monthsSpanned, monthlyEquivalentAmount, overlapsCalendarMonth, overlapsFiscalYear } from "../lib/rental-history.mjs";
import { rentalDepartmentTriggerSql, rentalDepartmentBackfillSql } from "../db/rental-department-sql.mjs";
import { transferSchemaSql, transferTriggerSql } from "../db/transfer-sql.mjs";

test("rental report filters combine fiscal year, month and exact renter department", () => {
  const record = { startDate: "2025-10-01", machineryCode: "M1", machineryName: "รถ", renterName: "โครงการ ก", approver: "หัวหน้า", rentalMode: "W" };
  const filters = { query: "", fiscalYear: "2569", month: "10", machinery: "", department: "โครงการ ก" };
  assert.equal(matchesRentalHistory(record, filters), true);
  for (const mismatch of [{ department: "โครงการ" }, { month: "9" }, { fiscalYear: "2568" }, { rentalMode: "M" }]) assert.equal(matchesRentalHistory(record, { ...filters, ...mismatch }), false);
  assert.equal(matchesRentalHistory({ ...record, startDate: "2026-10-01" }, filters), false);
  assert.equal(matchesRentalHistory(record, { ...filters, month: "", fiscalYear: "" }), true);
});

test("a yearly rental spanning fiscal years contributes an even monthly share to every month it covers", () => {
  const yearly = { startDate: "2025-10-01", expectedReturnDate: "2026-09-30", totalAmount: 120000 };
  assert.equal(monthsSpanned(yearly.startDate, yearly.expectedReturnDate), 12);
  assert.equal(monthlyEquivalentAmount(yearly), 10000);
  // March 2026 falls inside the contract even though it started in FY2569's October.
  assert.equal(overlapsCalendarMonth(yearly, "3", "2569"), true);
  // A March a fiscal year later is outside the contract's span.
  assert.equal(overlapsCalendarMonth(yearly, "3", "2570"), false);
  assert.equal(overlapsFiscalYear(yearly, "2569"), true);
  assert.equal(overlapsFiscalYear(yearly, "2571"), false);
  // matchesRentalHistory now widens month/fiscal-year filters to any month the rental actually covers.
  assert.equal(matchesRentalHistory(yearly, { query: "", fiscalYear: "2569", month: "3", machinery: "" }), true);
  assert.equal(matchesRentalHistory(yearly, { query: "", fiscalYear: "2570", month: "3", machinery: "" }), false);
  // A short daily rental is unaffected: it neither spans nor gets averaged across other months.
  const daily = { startDate: "2026-03-05", expectedReturnDate: "2026-03-07", totalAmount: 900 };
  assert.equal(monthsSpanned(daily.startDate, daily.expectedReturnDate), 1);
  assert.equal(monthlyEquivalentAmount(daily), 900);
});

test("renter organization sync is separate from physical location, lender and owner", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE machineries (code TEXT PRIMARY KEY, renter_department TEXT, current_department TEXT, department TEXT, leasing_department TEXT, owning_department TEXT, updated_at TEXT);
    INSERT INTO machineries VALUES ('M1',NULL,'SITE','SITE','LENDER','OWNER','now');
    CREATE TABLE rentals (id TEXT PRIMARY KEY, machinery_code TEXT, renter_name TEXT, status TEXT, start_date TEXT, created_at TEXT);`);
  for (const statement of rentalDepartmentTriggerSql) db.exec(freezeRentalMonth(statement));
  const state = () => ({ ...db.prepare("SELECT renter_department, current_department, leasing_department, owning_department FROM machineries").get() });
  db.exec("INSERT INTO rentals VALUES ('r1','M1','RENTER A','ACTIVE','2026-09-01','now')");
  assert.deepEqual(state(), { renter_department: "RENTER A", current_department: "SITE", leasing_department: "LENDER", owning_department: "OWNER" });
  db.exec("UPDATE rentals SET renter_name='RENTER B' WHERE id='r1'"); assert.equal(state().renter_department, "RENTER B");
  for (const statement of [...transferSchemaSql, ...transferTriggerSql]) db.exec(freezeRentalMonth(statement));
  db.prepare("INSERT INTO transfer_records VALUES (?,?,?,?,?,?)").run("t1", "2026-09-02", '["TRUCK"]', JSON.stringify([{ machineryCode: "M1", from: { name: "SITE" }, to: { name: "NEW SITE" } }]), "staff", "now");
  assert.equal(state().renter_department, "RENTER B"); assert.equal(state().current_department, "NEW SITE");
  db.exec("UPDATE rentals SET status='RETURNED' WHERE id='r1'"); assert.equal(state().renter_department, null); assert.equal(state().current_department, "NEW SITE");
  db.exec("INSERT INTO rentals VALUES ('r2','M1','RENTER C','ACTIVE','2026-09-03','now')");
  db.exec("UPDATE rentals SET renter_name='HISTORIC' WHERE id='r1'"); assert.equal(state().renter_department, "RENTER C");
  db.exec("DELETE FROM rentals WHERE id='r1'"); assert.equal(state().renter_department, "RENTER C");
  db.exec("DELETE FROM rentals WHERE id='r2'"); assert.equal(state().renter_department, null); assert.equal(state().current_department, "NEW SITE");
  db.close();
});

test("backfill populates existing active renters without changing physical location", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE machineries (code TEXT PRIMARY KEY, renter_department TEXT, current_department TEXT); CREATE TABLE rentals (machinery_code TEXT, renter_name TEXT, status TEXT, start_date TEXT, created_at TEXT); INSERT INTO machineries VALUES ('M1',NULL,'LOCATION'); INSERT INTO rentals VALUES ('M1','RENTER','ACTIVE','2026-09-01','now')");
  db.exec(freezeRentalMonth(rentalDepartmentBackfillSql)); db.exec(freezeRentalMonth(rentalDepartmentBackfillSql));
  assert.deepEqual({ ...db.prepare("SELECT * FROM machineries").get() }, { code: "M1", renter_department: "RENTER", current_department: "LOCATION" });
  db.close();
});

test("print uses filtered records with visible criteria and multipage print styles", async () => {
  const page = await readFile(new URL("../app/rentals/page.tsx", import.meta.url), "utf8");
  const report = await readFile(new URL("../app/rentals/rental-report.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/rentals/rental-report.css", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/rentals/route.ts", import.meta.url), "utf8");
  assert.match(page, /RentalReport records=\{filtered\} criteria=\{reportCriteria\} month=\{monthFilter\}/);
  assert.match(page, /department: departmentFilter/);
  assert.match(report, /window.print\(\)/); assert.match(report, /records.map/);
  assert.match(report, /ไม่ใช่ค่าเช่าเฉลี่ยเฉพาะเดือน/);
  assert.match(report, /monthlyEquivalentAmount/);
  assert.match(report, /เฉลี่ย\/เดือน \(บาท\)/);
  assert.match(css, /A4 landscape/); assert.match(css, /table-header-group/); assert.match(css, /break-inside:avoid/);
  assert.doesNotMatch(api, /currentDepartment:/); assert.match(api, /ensureDisposalSchema/);
});
