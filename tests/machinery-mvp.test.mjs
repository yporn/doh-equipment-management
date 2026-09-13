import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("rental history filters combine fiscal year, month, machinery and search", async () => {
  const { fiscalYearOf, matchesRentalHistory } = await import("../lib/rental-history.mjs");
  assert.equal(fiscalYearOf("2025-09-30"), 2568);
  assert.equal(fiscalYearOf("2025-10-01"), 2569);
  assert.equal(fiscalYearOf("2026-01-01"), 2569);
  assert.equal(fiscalYearOf("2026-09-30"), 2569);
  assert.equal(fiscalYearOf("2026-10-01"), 2570);
  const record = { startDate: "2025-10-01", machineryCode: "01-0225-95-0", machineryName: null, renterName: "ฝ่ายเครื่องกล", approver: "Admin" };
  const all = { query: "", fiscalYear: "", month: "", machinery: "" };
  assert.equal(matchesRentalHistory(record, all), true);
  const combined = { query: " ADMIN ", fiscalYear: "2569", month: "10", machinery: " 01-0225 " };
  assert.equal(matchesRentalHistory(record, combined), true);
  for (const wrong of [{ fiscalYear: "2568" }, { month: "9" }, { machinery: "99-9999" }, { query: "ไม่พบ" }]) {
    assert.equal(matchesRentalHistory(record, { ...combined, ...wrong }), false);
  }
  const page = await readFile(new URL("app/rentals/page.tsx", root), "utf8");
  for (const label of ["กรองตามปีงบประมาณ", "กรองตามเดือน", "กรองตามหมายเลขเครื่องจักร", "ล้างตัวกรอง", "ไม่พบประวัติการเช่าตามตัวกรอง"]) assert.ok(page.includes(label));
  assert.match(page, /list="rental-history-machineries"/);
});

test("rental type filters combine with existing filters and replace the status column", async () => {
  const { matchesRentalHistory } = await import("../lib/rental-history.mjs");
  const record = { startDate: "2025-10-01", machineryCode: "01-0225", machineryName: null, renterName: "ฝ่ายเครื่องกล", approver: "Admin", rentalMode: "W" };
  const filters = { query: "Admin", fiscalYear: "2569", month: "10", machinery: "01", rentalMode: "W" };
  assert.equal(matchesRentalHistory(record, filters), true);
  assert.equal(matchesRentalHistory(record, { ...filters, rentalMode: "M" }), false);
  assert.equal(matchesRentalHistory({ ...record, rentalMode: "M" }, { ...filters, rentalMode: "M" }), true);
  assert.equal(matchesRentalHistory(record, { ...filters, rentalMode: "" }), true);
  assert.equal(matchesRentalHistory(record, { ...filters, month: "9" }), false);
  const page = await readFile(new URL("app/rentals/page.tsx", root), "utf8");
  assert.match(page, /กรองตามประเภทการเช่า/);
  assert.match(page, /<th>ประเภทการเช่า<\/th>/);
  assert.doesNotMatch(page, /<th>สถานะ<\/th>/);
  assert.match(page, /setRentalModeFilter\(""\)/);
  // The create/edit modals still use native <option> elements; the filter bar uses
  // the shared Select component, so its choices are a { value, label } options array.
  assert.equal((page.match(/<option value="W">W-เช่าใช้งาน<\/option>/g) || []).length, 2);
  assert.equal((page.match(/<option value="M">M-ขอใช้งาน<\/option>/g) || []).length, 2);
  assert.match(page, /\{ value: "W", label: "W-เช่าใช้งาน" \}/);
  assert.match(page, /\{ value: "M", label: "M-ขอใช้งาน" \}/);
  assert.doesNotMatch(page, /W-การขอเช่า|M-การขอใช้/);
});

test("Machinery MVP defines every production machinery status", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  for (const status of ["AVAILABLE", "RENTED", "IN_SERVICE", "UNDER_REPAIR", "INACTIVE"]) {
    assert.match(page, new RegExp(`\\b${status}\\b`));
  }
});

test("Machinery MVP includes core discovery and create workflows", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const sidebar = await readFile(new URL("app/components/app-sidebar.tsx", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(sidebar, /ศูนย์สร้างทางขอนแก่น/);
  assert.match(sidebar, /<span>กรมทางหลวง<\/span>/);
  assert.match(styles, /url\("\/doh-logo\.png"\)/);
  const logo = await readFile(new URL("public/doh-logo.png", root));
  assert.ok(logo.length > 0);
  assert.match(page, /aria-label="ค้นหาเครื่องจักร"/);
  assert.match(page, /กรองตามหน่วยงาน/);
  assert.match(page, /เรียงข้อมูล/);
  assert.match(page, /function createMachine/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /หมายเลขเครื่องจักรนี้มีอยู่ในระบบแล้ว/);
});

test("production build server-renders the machinery dashboard", async () => {
  const workerUrl = new URL("dist/server/index.js", root);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /DOH Equipment/);
  assert.match(html, /กำลังตรวจสอบการเข้าสู่ระบบ/);
});

test("provides a dedicated paginated machinery route", async () => {
  const [route, page] = await Promise.all([
    readFile(new URL("app/machineries/page.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);
  assert.match(route, /registryOnly/);
  assert.match(page, /pageSize/);
  assert.match(page, /className="pagination"/);
});

test("supports viewing and editing machinery details", async () => {
  const [page, api] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/machineries/route.ts", root), "utf8"),
  ]);
  assert.match(page, /function updateMachine/);
  assert.match(page, /แก้ไขข้อมูลเครื่องจักร/);
  assert.match(page, /บันทึกการแก้ไข/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /ไม่พบเครื่องจักรที่ต้องการแก้ไข/);
});

test("imports the latest machinery registry workbook without losing source fields", async () => {
  const [registryText, page, api, schema, database, migration] = await Promise.all([
    readFile(new URL("data/machineries.json", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/machineries/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
    readFile(new URL("drizzle/0008_import_workbook_registry.sql", root), "utf8"),
  ]);
  const registry = JSON.parse(registryText);
  assert.equal(registry.length, 201);
  assert.equal(new Set(registry.map((item) => item.code)).size, registry.length);
  for (const field of ["engineModel", "registrationNumber", "leasingDepartment", "fuelConsumption", "repairStatus"]) {
    assert.ok(registry.every((item) => Object.hasOwn(item, field)), `missing ${field}`);
    assert.match(page, new RegExp(field));
    assert.match(api, new RegExp(field));
  }
  for (const column of ["engine_model", "registration_number", "leasing_department", "fuel_consumption"]) {
    assert.match(schema, new RegExp(column));
    assert.match(database, new RegExp(column));
    assert.match(migration, new RegExp(column));
  }
  assert.match(api, /เวิร์กบุ๊ก1\.xlsx — สภาพเครื่องจักร \(2 ก\.ย\. 2569\)/);
});

test("imports the damaged machinery statuses from workbook 2 exactly once", async () => {
  const api = await readFile(new URL("app/api/machineries/route.ts", root), "utf8");
  assert.match(api, /workbook2-damaged-2026-09-01-v2/);
  assert.match(api, /INSERT OR IGNORE INTO app_data_imports/);
  assert.match(api, /if \(!inserted\.meta\.changes\) return/);
  assert.match(api, /SET condition = 'DAMAGED'/);
  assert.match(api, /condition NOT IN \('W', 'M', 'AWAITING_DISPOSAL', 'DISPOSAL_APPROVED'\)/);
  const match = api.match(/const workbook2DamagedCodes = (\[[^;]+\]);/);
  assert.ok(match);
  const codes = JSON.parse(match[1]);
  assert.equal(codes.length, 36);
  assert.equal(new Set(codes).size, 36);
});

test("uses the workbook machinery-condition categories in the machinery register", async () => {
  const [registryText, page, api, schema, database, rentalApi, migration] = await Promise.all([
    readFile(new URL("data/machineries.json", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/machineries/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
    readFile(new URL("app/api/rentals/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0009_machinery_condition.sql", root), "utf8"),
  ]);
  const registry = JSON.parse(registryText);
  const conditions = new Set(registry.map((item) => item.condition));
  for (const condition of ["W", "M", "AVAILABLE", "DAMAGED", "AWAITING_DISPOSAL", "DISPOSAL_APPROVED"]) assert.ok(conditions.has(condition));
  for (const label of ["W — เช่าใช้งาน", "M — ขอใช้งาน", "พร้อมใช้งาน (ว่าง)", "ชำรุด", "รอจำหน่าย", "อนุมัติจำหน่าย"]) assert.ok(page.includes(label));
  assert.match(api, /condition === "MAINTENANCE" \? "ACTIVE"/);
  assert.match(api, /condition === "MAINTENANCE" \? "UNDER_REPAIR"/);
  assert.doesNotMatch(api, /condition === "DAMAGED" \? "ACTIVE"/);
  assert.match(page, /status-repair">ซ่อมบำรุง/);
  assert.match(page, /editableConditionLabels/);
  assert.doesNotMatch(page, /ซ่อมบำรุง \(กำหนดจากงานซ่อม\)/);
  assert.match(page, /status === "MAINTENANCE" \? machine\.repairStatus === "ACTIVE"/);
  assert.match(page, /editableConditionLabels\.map/);
  assert.match(api, /สถานะซ่อมบำรุงกำหนดจากระบบงานซ่อมเท่านั้น/);
  assert.match(api, /existingMachine\.repairStatus !== "ACTIVE"/);
  assert.match(page, /machine\.condition === status/);
  assert.match(api, /condition: sql`excluded\.condition`/);
  assert.match(schema, /condition: text\("condition"/);
  assert.match(database, /condition TEXT DEFAULT 'AVAILABLE' NOT NULL/);
  assert.match(rentalApi, /ensureDisposalSchema/);
  assert.match(migration, /ADD `condition` text DEFAULT 'AVAILABLE' NOT NULL/);
});

test("uses stronger status colors for W and approved disposal", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(page, /status-condition-\$\{machine\.condition === "MAINTENANCE" \? "AVAILABLE" : machine\.condition\}/);
  assert.match(styles, /\.status-condition-W\{background:#17609a;color:#fff\}/);
  assert.match(styles, /\.status-condition-M\{background:#e5f1fb;color:#17609a\}/);
  assert.match(styles, /\.status-condition-AWAITING_DISPOSAL\{background:#edf0f2;color:#596674\}/);
  assert.match(styles, /\.status-condition-DISPOSAL_APPROVED\{background:#596674;color:#fff\}/);
});

test("shows and filters machinery type codes without rental rates in the registry table", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /กรองตามรหัสประเภท/);
  assert.match(page, /รหัสประเภททั้งหมด/);
  assert.match(page, /machine\.typeCode === typeCode/);
  assert.match(page, /<th>รหัสประเภท<\/th>/);
  assert.match(page, /machine\.typeCode \|\| "—"/);
  assert.doesNotMatch(page, /<th className="number">ค่าเช่ารายวัน<\/th>/);
  assert.doesNotMatch(page, /<option value="rate-desc">ค่าเช่าสูงสุด<\/option>/);
});

test("provides a persistent Service workflow without changing machinery status", async () => {
  const [page, api, schema, database] = await Promise.all([
    readFile(new URL("app/service/page.tsx", root), "utf8"),
    readFile(new URL("app/api/services/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
  ]);
  assert.match(page, /บันทึก Service/);
  assert.match(page, /name="meterReading"/);
  assert.match(page, /value="KILOMETER"/);
  assert.match(page, /value="HOUR"/);
  assert.match(page, /type="checkbox"/);
  assert.match(page, /เลือกได้หลายรายการ/);
  assert.match(page, /function toggleServiceType/);
  for (const serviceType of ["เปลี่ยนน้ำมันเครื่อง", "เปลี่ยนไส้กรองน้ำมันเครื่อง", "เปลี่ยนไส้กรองน้ำมันเชื้อเพลิง", "เปลี่ยนไส้กรองอากาศ", "เปลี่ยนกรองน้ำมันเกียร์", "เปลี่ยนน้ำมันเกียร์", "เปลี่ยนน้ำมันเฟืองท้าย", "เปลี่ยน/เติม น้ำมันไฮดรอลิค", "เปลี่ยนไส้กรองไฮดรอลิค", "เปลี่ยนแบตเตอรี่", "เปลี่ยนยาง"]) {
    assert.match(page, new RegExp(serviceType));
  }
  assert.ok(page.indexOf('"เปลี่ยนกรองน้ำมันเกียร์"') < page.indexOf('"เปลี่ยนน้ำมันเกียร์"'));
  assert.doesNotMatch(page, /"เปลี่ยนน้ำมันเกียร์\/เฟืองท้าย"/);
  assert.match(page, /isOil \? "ลิตร"/);
  assert.match(page, /ชนิดน้ำมัน/);
  for (const oilType of ["SAE 10W-30", "SAE 15W-40", "SAE 30", "SAE 75W-90", "SAE 80W-90", "SAE 90", "SAE 140", "ISO VG 46", "ISO VG 68", "ISO VG 100", "Dot 3", "AUTOMAT"]) {
    assert.match(page, new RegExp(oilType));
  }
  for (const batterySize of ["12V 90Ah", "12V 120Ah", "12V 150Ah"]) {
    assert.match(page, new RegExp(batterySize));
  }
  for (const tireSize of ["9.00-20", "10.00-20", "11.00-20", "11R-22.5", "14.00-24", "215/65R16", "215/70R15", "215/70R16", "265/70R16"]) {
    assert.match(page, new RegExp(tireSize.replace(/[./-]/g, "\\$&")));
  }
  assert.match(page, /\? oilTypes/);
  assert.match(page, /\? batterySizes/);
  assert.match(page, /: tireSizes/);
  assert.match(page, /isOil \? "ไม่ระบุ" : "เลือกขนาด"/);
  assert.doesNotMatch(page, /ค่าใช้จ่าย/);
  assert.match(page, /list="service-machineries"/);
  assert.match(page, /พิมพ์รหัส ชื่อ ยี่ห้อ หรือรุ่นเพื่อค้นหา/);
  assert.match(page, /function openEdit/);
  assert.match(page, /function deleteService/);
  assert.match(page, /function printService/);
  assert.match(page, /service-row-actions/);
  assert.match(page, /<th>จัดการ<\/th>/);
  assert.match(page, /ConfirmActionButton/);
  assert.doesNotMatch(page, /window\.confirm/);
  assert.match(page, /กรองตามปีงบประมาณ/);
  assert.match(page, /กรองตามเดือน/);
  assert.match(page, /กรองตามหมายเลขเครื่องจักร/);
  assert.match(page, /list="service-history-machineries"/);
  assert.match(page, /พิมพ์หมายเลขเครื่องจักร/);
  assert.match(page, /fiscalYearOf/);
  assert.match(page, /ประวัติตามตัวกรอง/);
  assert.match(page, /window\.print\(\)/);
  assert.match(page, />\s*พิมพ์\s*</);
  assert.match(page, /www\.doh\.go\.th\/layouts\/theme1\/images\/logo\.png/);
  assert.match(page, /ใบสรุปรายการ SERVICE เครื่องจักร/);
  assert.match(page, /ศูนย์สร้างทางขอนแก่น/);
  assert.doesNotMatch(page, /พิมพ์รายงาน/);
  assert.doesNotMatch(page, /รายงานสรุปประวัติ SERVICE เครื่องจักร/);
  assert.doesNotMatch(page, /setShowReport/);
  assert.doesNotMatch(page, /service-summary-report-criteria/);
  assert.doesNotMatch(page, /<th>เลขที่เอกสาร<\/th>/);
  assert.doesNotMatch(page, /createPortal/);
  assert.doesNotMatch(page, /รายการย่อย/);
  assert.match(page, /ผู้ตรวจสอบ/);
  assert.doesNotMatch(page, /ผู้รับรอง/);
  assert.match(page, /selected\.documentNumber/);
  assert.match(api, /export async function POST/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /export async function DELETE/);
  assert.match(api, /export async function DELETE/);
  assert.match(api, /serviceTypes/);
  assert.match(api, /specification/);
  assert.match(api, /isCountedPart && !specification/);
  assert.match(api, /isOil && specification && !oilTypes\.has/);
  assert.match(api, /batterySizes\.has/);
  assert.match(api, /tireSizes\.has/);
  assert.match(api, /allocateServiceDocumentNumber/);
  assert.doesNotMatch(api, /db\.update\(machineries\)/);
  assert.match(schema, /serviceRecords/);
  assert.match(schema, /serviceDocumentCounters/);
  assert.match(database, /month >= 10 \? 544 : 543/);
  assert.match(database, /`154\/\$\{String\(documentSequence\)/);
});

test("production build server-renders the Service page", async () => {
  const workerUrl = new URL("dist/server/index.js", root);
  workerUrl.searchParams.set("service-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/service", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /กำลังตรวจสอบการเข้าสู่ระบบ/);
});

test("provides a persistent rental and return workflow", async () => {
  const [page, api, schema, database] = await Promise.all([
    readFile(new URL("app/rentals/page.tsx", root), "utf8"),
    readFile(new URL("app/api/rentals/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
  ]);
  assert.match(page, /ระบบเช่าเครื่องจักร/);
  assert.match(page, /หน่วยงาน\/โครงการที่เช่า/);
  assert.match(page, /ผู้บันทึกข้อมูล/);
  assert.doesNotMatch(page, /รับคืนเครื่องจักร/);
  assert.match(page, /พิมพ์หมายเลขหรือเลือกเครื่องจักร/);
  assert.match(page, /machineryCode: machineCode/);
  assert.match(page, /name="duration"/);
  assert.match(page, /name="rentalMode"/);
  assert.match(page, /W-เช่าใช้งาน/);
  assert.match(page, /M-ขอใช้งาน/);
  assert.match(page, /calculateEndDate/);
  assert.match(page, /ค่าเช่ารวม/);
  assert.match(page, /rental-duration-field/);
  assert.match(page, /aria-label="หน่วยระยะเวลา"/);
  assert.match(page, /readOnly\s+aria-readonly="true"/);
  assert.doesNotMatch(page, /setRateAmount\(event\.target\.value\)/);
  assert.match(api, /export async function POST/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /export async function DELETE/);
  assert.match(api, /ensureDisposalSchema/);
  assert.doesNotMatch(api, /machine.status !== "AVAILABLE"/);
  assert.match(api, /rentalMode === "M" \? 0 : rentalRate\(machine, typedRate, startDate\)/);
  assert.match(api, /totalAmount = duration \* effectiveRateAmount/);
  assert.match(api, /calculateEndDate\(startDate, duration/);
  assert.match(api, /action === "EDIT"/);
  assert.match(api, /db\.delete\(rentals\)/);
  assert.match(page, /แก้ไขรายการเช่า/);
  assert.match(page, /ยืนยันการลบข้อมูล/);
  assert.match(schema, /export const rentals/);
  assert.match(schema, /totalAmount/);
  assert.match(schema, /rentalMode/);
  assert.match(database, /rental_mode TEXT DEFAULT 'W' NOT NULL/);
  assert.match(database, /ensureRentalSchema/);
});

test("orders registry filters by table columns and shares department choices across rental forms", async () => {
  const registry = await readFile(new URL("app/page.tsx", root), "utf8");
  const rental = await readFile(new URL("app/rentals/page.tsx", root), "utf8");
  const filters = ["กรองตามรหัสประเภท", "กรองตามหน่วยงาน", "กรองตามสถานะ"].map((label) => registry.indexOf(label));
  assert.ok(filters.every((position) => position >= 0));
  assert.ok(filters[0] < filters[1] && filters[1] < filters[2]);
  assert.match(rental, /machines\.map\(\(machine\) => machine\.currentDepartment\?\.trim\(\)\)/);
  assert.equal((rental.match(/id="rental-departments"/g) || []).length, 1);
  assert.equal((rental.match(/name="renterName"\s+required\s+list="rental-departments"/g) || []).length, 2);
  assert.match(rental, /rentalDepartments\.map/);
  assert.match(rental, /defaultValue=\{editing\.renterName\}/);
});

test("production build server-renders the rental page", async () => {
  const workerUrl = new URL("dist/server/index.js", root);
  workerUrl.searchParams.set("rental-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/rentals", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /กำลังตรวจสอบการเข้าสู่ระบบ/);
});

test("provides repair tracking without overwriting rental status", async () => {
  const [page, api, schema, database, sidebar, rentalApi] = await Promise.all([
    readFile(new URL("app/repairs/page.tsx", root), "utf8"),
    readFile(new URL("app/api/repairs/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
    readFile(new URL("app/components/app-sidebar.tsx", root), "utf8"),
    readFile(new URL("app/api/rentals/route.ts", root), "utf8"),
  ]);
  assert.match(page, /ระบบซ่อมบำรุง/);
  assert.match(page, /ระบบช่วงล่าง/);
  assert.match(page, /ระบบเชื้อเพลิง/);
  assert.match(page, /ระบบไฟฟ้า/);
  assert.match(page, /ระบบไฮดรอลิค/);
  assert.match(page, /WAITING_PARTS: "รออะไหล่"/);
  assert.doesNotMatch(page, /function updateStatus/);
  assert.match(page, /<span className={`repair-status-select/);
  assert.match(page, /วันที่เข้าซ่อม/);
  assert.doesNotMatch(page, /วันที่แจ้งซ่อม/);
  assert.match(page, /ConfirmActionButton/);
  assert.match(page, /ConfirmSubmitButton/);
  assert.match(api, /export async function POST/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /export async function DELETE/);
  assert.match(api, /"WAITING_PARTS"/);
  assert.match(api, /ensureDisposalSchema/);
  assert.doesNotMatch(api, /input\.action === "STATUS"/);
  assert.doesNotMatch(api, /status: "UNDER_REPAIR"/);
  assert.match(schema, /repairRecords/);
  assert.match(schema, /repairStatus/);
  assert.match(database, /ensureRepairSchema/);
  assert.match(sidebar, /\/repairs/);
  assert.doesNotMatch(rentalApi, /repairStatus === "ACTIVE"/);
  assert.doesNotMatch(page, /รายงานงานซ่อมบำรุงเครื่องจักร/);
  assert.doesNotMatch(page, /setShowReport/);
  for (const label of ["กรองตามปีงบประมาณ", "กรองตามเดือน", "กรองตามประเภทงานซ่อม", "ล้างตัวกรอง"]) assert.ok(page.includes(label));
  assert.ok(page.indexOf('placeholder="ค้นหาหมายเลขเครื่องจักรหรือระบบงานซ่อม"') < page.indexOf('ariaLabel="กรองตามปีงบประมาณ"'));
  assert.match(page, /fiscalYearOf\(record\.repairDate\)/);
  assert.match(page, /record\.repairType === repairTypeFilter/);
  assert.doesNotMatch(page, />พิมพ์รายงาน<\/button>/);
  assert.doesNotMatch(page, /report-shell\.css/);
});

test("provides multi-account authentication and role-based administration", async () => {
  const [auth, login, users, usersPage, sidebar, dashboardPage, rentalsPage, servicePage, database, machineryApi, rentalApi, serviceApi] = await Promise.all([
    readFile(new URL("lib/auth.ts", root), "utf8"), readFile(new URL("app/login/page.tsx", root), "utf8"),
    readFile(new URL("app/api/users/route.ts", root), "utf8"), readFile(new URL("app/users/page.tsx", root), "utf8"),
    readFile(new URL("app/components/app-sidebar.tsx", root), "utf8"), readFile(new URL("app/page.tsx", root), "utf8"), readFile(new URL("app/rentals/page.tsx", root), "utf8"), readFile(new URL("app/service/page.tsx", root), "utf8"), readFile(new URL("db/index.ts", root), "utf8"),
    readFile(new URL("app/api/machineries/route.ts", root), "utf8"), readFile(new URL("app/api/rentals/route.ts", root), "utf8"), readFile(new URL("app/api/services/route.ts", root), "utf8"),
  ]);
  assert.match(auth, /PBKDF2/); assert.match(auth, /iterations: 100_000/); assert.match(auth, /HttpOnly; Secure; SameSite=Lax/); assert.match(auth, /requireUser/);
  assert.match(login, /ตั้งค่าระบบครั้งแรก/); assert.match(users, /requireUser\(request, "ADMIN"\)/);
  assert.match(sidebar, /<a[^>]*href=\{path\}/); assert.doesNotMatch(sidebar, /next\/link/); for (const path of ["/machineries", "/rentals", "/service"]) assert.match(sidebar, new RegExp(`"${path}"`));
  for (const page of [usersPage, dashboardPage, rentalsPage, servicePage]) assert.match(page, /<AppSidebar active=/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS users/); assert.match(database, /CREATE TABLE IF NOT EXISTS auth_sessions/);
  for (const api of [machineryApi, rentalApi, serviceApi]) assert.match(api, /requireUser\(request\)/);
});
