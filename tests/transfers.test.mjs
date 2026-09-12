import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { validateTransfer, transporterChoices, departmentChoices, transferVersion, matchesTransferHistory } from "../lib/transfers.mjs";
import { transferSchemaSql } from "../db/transfer-sql.mjs";

const machines = [
  { code: "15-6479-15-9", typeCode: "15-01", currentDepartment: "ฝ่ายเครื่องกล" },
  { code: "64-0001", typeCode: "64-01", currentDepartment: "ฝ่ายเครื่องกล" },
  { code: "61-6101-19-9", typeCode: "61-01", currentDepartment: "ฝ่ายเครื่องกล" },
  { code: "31-6700-26-2", typeCode: "31-01", currentDepartment: "ฝ่ายเครื่องกล" },
  { code: "82-6239-22-0", typeCode: "82-01", currentDepartment: "2062 บ้านทุ่ม-มัญจาคีรี" },
];
const from = { kind: "DEPARTMENT", name: "ฝ่ายเครื่องกล" };
const to = { kind: "DEPARTMENT", name: "2062 บ้านทุ่ม-มัญจาคีรี" };
const draft = { transferDate: "2026-09-03", transporters: [machines[0].code, machines[2].code], items: [
  { machineryCode: machines[3].code, from, to },
  { machineryCode: machines[4].code, from: to, to: from },
] };

test("transporter groups follow 61-01, 64-01, 15-01 and departments are unique", () => {
  assert.deepEqual(transporterChoices(machines).map(m => m.typeCode), ["61-01", "64-01", "15-01"]);
  assert.equal(departmentChoices(machines).length, 2);
});
test("user example saves multiple carriers and opposite routes on the same date", () => {
  const { record } = validateTransfer(draft, machines);
  assert.deepEqual(record.transporters, [machines[2].code, machines[0].code]);
  assert.deepEqual(record.items, draft.items);
  assert.equal(record.transferDate, "2026-09-03");
});
test("other locations are explicit, trimmed, and retained", () => {
  const item = { ...draft.items[0], to: { kind: "OTHER", name: "  สถานที่ทดสอบ  " } };
  assert.equal(validateTransfer({ ...draft, items: [item] }, machines).record.items[0].to.name, "สถานที่ทดสอบ");
  assert.ok(validateTransfer({ ...draft, items: [{ ...item, to: { kind: "OTHER", name: " " } }] }, machines).error);
});
test("invalid dates, unknown machines, duplicate machines, and missing locations are rejected", () => {
  for (const input of [null, [], {}, { ...draft, transferDate: "2026-02-30" }, { ...draft, transporters: [] }, { ...draft, items: [] }, { ...draft, transporters: [machines[3].code] }, { ...draft, transporters: [machines[0].code, machines[0].code] }, { ...draft, items: [draft.items[0], draft.items[0]] }, { ...draft, items: [{ ...draft.items[0], machineryCode: "missing" }] }, { ...draft, items: [{ ...draft.items[0], machineryCode: machines[0].code }] }, { ...draft, items: [{ ...draft.items[0], to: from }] }, { ...draft, items: [{ ...draft.items[0], to: { kind: "DEPARTMENT", name: "missing" } }] }]) assert.ok(validateTransfer(input, machines).error);
  assert.ok(validateTransfer(draft, machines.filter(m => m.code !== machines[3].code)).error);
});
test("persistent trip stores all items together and schema initialization is idempotent", () => {
  const db = new DatabaseSync(":memory:");
  for (let i = 0; i < 2; i++) for (const statement of transferSchemaSql) db.exec(statement);
  const { record } = validateTransfer(draft, machines);
  db.prepare("INSERT INTO transfer_records VALUES (?, ?, ?, ?, ?, ?)").run("trip1", record.transferDate, JSON.stringify(record.transporters), JSON.stringify(record.items), "staff", "now");
  const row = db.prepare("SELECT * FROM transfer_records WHERE id = ?").get("trip1");
  assert.deepEqual(JSON.parse(row.items_json), draft.items);
  assert.deepEqual(JSON.parse(row.transporters_json), record.transporters);
  assert.throws(() => db.prepare("INSERT INTO transfer_records VALUES (?, ?, ?, ?, ?, ?)").run("trip2", null, "[]", "[]", "staff", "now"));
  assert.equal(db.prepare("SELECT count(*) AS count FROM transfer_records").get().count, 1);
  db.close();
});
test("both API methods require sign-in and creation checks registry visibility", async () => {
  const route = await readFile(new URL("../app/api/transfers/route.ts", import.meta.url), "utf8");
  assert.equal((route.match(/requireUser\(request\)/g) || []).length, 3);
  assert.match(route, /PATCH\(request: Request\).*change\(request, false\)/);
  assert.match(route, /DELETE\(request: Request\).*change\(request, true\)/);
  assert.match(route, /input.version !== transferVersion\(existing\)/);
  assert.match(route, /delete\(transferRecords\).where\(unchanged\)/);
  assert.match(route, /where\(unchanged\).returning/);
  assert.match(route, /where\(sql.raw\(registryVisibilitySql\)\)/);
  assert.doesNotMatch(route, /update\(machineries\)/);
  const sidebar = await readFile(new URL("../app/components/app-sidebar.tsx", import.meta.url), "utf8");
  assert.ok(sidebar.indexOf('link("/repairs"') < sidebar.indexOf('link("/transfers"'));
  assert.ok(sidebar.indexOf('link("/transfers"') < sidebar.indexOf('link("/disposals"'));
});

test("editing retains historic references but cannot introduce unknown machines", () => {
  const previous = structuredClone(draft);
  const edited = { ...draft, transferDate: "2026-09-04" };
  assert.ok(validateTransfer(edited, [], previous).record);
  assert.ok(validateTransfer({ ...edited, transporters: ["unknown"] }, [], previous).error);
  assert.ok(validateTransfer({ ...edited, items: [{ ...draft.items[0], machineryCode: "unknown" }] }, [], previous).error);
  assert.ok(validateTransfer(edited, []).error);
});

test("editing and deletion use saved-state guards and affect only the chosen trip", () => {
  const db = new DatabaseSync(":memory:");
  for (const statement of transferSchemaSql) db.exec(statement);
  const transportersJson = JSON.stringify(draft.transporters), itemsJson = JSON.stringify(draft.items);
  for (const id of ["trip1", "trip2"]) db.prepare("INSERT INTO transfer_records VALUES (?, ?, ?, ?, ?, ?)").run(id, draft.transferDate, transportersJson, itemsJson, "staff", "now");
  const before = { transferDate: draft.transferDate, transportersJson, itemsJson };
  const after = { ...before, transferDate: "2026-09-05" };
  assert.notEqual(transferVersion(before), transferVersion(after));
  assert.equal(db.prepare("UPDATE transfer_records SET transfer_date = ? WHERE id = ? AND transfer_date = ? AND transporters_json = ? AND items_json = ?").run(after.transferDate, "trip1", before.transferDate, transportersJson, itemsJson).changes, 1);
  const remove = db.prepare("DELETE FROM transfer_records WHERE id = ? AND transfer_date = ? AND transporters_json = ? AND items_json = ?");
  assert.equal(remove.run("trip1", before.transferDate, transportersJson, itemsJson).changes, 0);
  assert.equal(remove.run("trip1", after.transferDate, transportersJson, itemsJson).changes, 1);
  assert.equal(remove.run("trip1", after.transferDate, transportersJson, itemsJson).changes, 0);
  assert.equal(db.prepare("SELECT id FROM transfer_records").get().id, "trip2");
  db.close();
});

test("list offers confirmed deletion and editing preloads a separate copy of the trip", async () => {
  const page = await readFile(new URL("../app/transfers/page.tsx", import.meta.url), "utf8");
  assert.match(page, /structuredClone\(record.items\)/);
  assert.match(page, /method: editing \? "PATCH" : "POST"/);
  assert.match(page, /onConfirm=\{\(\) => deleteRecord\(record\)\}/);
  assert.match(page, /version: record.version/);
  assert.match(page, /<th>จัดการ<\/th>/);
});

test("transfer report combines fiscal year, month, origin, destination and search filters", async () => {
  const record = { transferDate: "2025-10-03", transporters: ["61-6101-19-9"], items: [
    { machineryCode: "31-6700-26-2", from: { name: "ฝ่ายเครื่องกล" }, to: { name: "2062 บ้านทุ่ม-มัญจาคีรี" } },
    { machineryCode: "82-6239-22-0", from: { name: "2062 บ้านทุ่ม-มัญจาคีรี" }, to: { name: "ฝ่ายเครื่องกล" } },
  ] };
  const filters = { query: "31-6700", fiscalYear: "2569", month: "10", fromDepartment: "ฝ่ายเครื่องกล", toDepartment: "2062 บ้านทุ่ม-มัญจาคีรี" };
  assert.equal(matchesTransferHistory(record, filters), true);
  for (const mismatch of [{ query: "ไม่พบ" }, { fiscalYear: "2568" }, { month: "9" }, { fromDepartment: "ไม่พบ" }, { toDepartment: "ไม่พบ" }]) assert.equal(matchesTransferHistory(record, { ...filters, ...mismatch }), false);
  const page = await readFile(new URL("../app/transfers/page.tsx", import.meta.url), "utf8");
  for (const label of ["กรองตามปีงบประมาณ", "กรองตามเดือน", "กรองตามหน่วยงานต้นทาง", "กรองตามหน่วยงานปลายทาง", "ล้างตัวกรอง"]) assert.ok(page.includes(label));
  assert.doesNotMatch(page, /setShowReport/);
  assert.doesNotMatch(page, /พิมพ์รายงาน/);
  assert.doesNotMatch(page, /report-shell\.css/);
});

test("generated migration can run again after runtime initialization without losing trips", async () => {
  const db = new DatabaseSync(":memory:");
  for (const statement of transferSchemaSql) db.exec(statement);
  db.prepare("INSERT INTO transfer_records VALUES (?, ?, ?, ?, ?, ?)").run("existing", draft.transferDate, JSON.stringify(draft.transporters), JSON.stringify(draft.items), "staff", "now");
  const migration = await readFile(new URL("../drizzle/0011_redundant_cloak.sql", import.meta.url), "utf8");
  for (let i = 0; i < 2; i++) for (const statement of migration.split(";").map(value => value.trim()).filter(Boolean)) db.exec(statement);
  assert.equal(db.prepare("SELECT count(*) AS count FROM transfer_records").get().count, 1);
  db.close();
});

test("production build renders the protected transfers page", async () => {
  const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url).href);
  const response = await worker.fetch(new Request("http://localhost/transfers", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /กำลังตรวจสอบการเข้าสู่ระบบ/);
});
