import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("repair form removes retired inputs and requires one of two repair types", async () => {
  const page = await readFile(new URL("../app/repairs/page.tsx", import.meta.url), "utf8");
  const form = page.slice(page.indexOf("{showForm &&"), page.indexOf("{selected &&"));
  for (const name of ["symptom", "cause", "responsiblePerson", "provider", "totalCost"]) {
    assert.doesNotMatch(form, new RegExp(`name=["']${name}["']`));
  }
  assert.doesNotMatch(form, /partsText|อะไหล่ที่ใช้|อาการเสีย|สาเหตุ|ผู้รับผิดชอบ|อู่ \/ ผู้ให้บริการ|ค่าใช้จ่ายรวม/);
  assert.match(form, /<select name="repairType" required/);
  assert.match(form, /<option value="SELF">ซ่อมเอง<\/option>/);
  assert.match(form, /<option value="OUTSOURCED">จ้างซ่อม<\/option>/);
});

test("new repair API validates type, ignores retired input values, and preserves old fields on edits", async () => {
  const api = await readFile(new URL("../app/api/repairs/route.ts", import.meta.url), "utf8");
  assert.match(api, /validRepairTypes = new Set\(\["SELF", "OUTSOURCED"\]\)/);
  assert.match(api, /repairType: valid\.repairType, symptom: "", cause: null/);
  assert.match(api, /responsiblePerson: null, provider: null/);
  assert.match(api, /partsJson: "\[\]", totalCost: 0/);
  const updates = api.slice(api.indexOf("const updates = { machineryCode"), api.indexOf("await db.update(repairRecords).set(updates)"));
  for (const field of ["symptom", "cause", "responsiblePerson", "provider", "partsJson", "totalCost"]) assert.doesNotMatch(updates, new RegExp(`${field}:`));
  assert.doesNotMatch(api, /input\.action === "STATUS"/);
});

test("repair reporter is selected from registry departments and table status is read-only", async () => {
  const [page, api] = await Promise.all([
    readFile(new URL("../app/repairs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/repairs/route.ts", import.meta.url), "utf8"),
  ]);
  const form = page.slice(page.indexOf("{showForm &&"), page.indexOf("{selected &&"));
  assert.match(page, /machine\.currentDepartment\.trim\(\)/);
  assert.match(form, /ผู้แจ้ง<select name="reporter" required/);
  assert.match(form, /repairDepartments\.map/);
  assert.doesNotMatch(page, /onChange=\{\(event\) => void updateStatus/);
  assert.match(page, /<span className=\{`repair-status-select/);
  assert.match(api, /eq\(machineries\.currentDepartment, department\)/);
  assert.match(api, /กรุณาเลือกผู้แจ้งจากหน่วยงานในบัญชีเครื่องจักร/);
});

test("completion date controls completed repair status", async () => {
  const api = await readFile(new URL("../app/api/repairs/route.ts", import.meta.url), "utf8");
  assert.match(api, /requestedCompletedDate \? "COMPLETED" : requestedStatus/);
  assert.match(api, /!requestedCompletedDate && requestedStatus === "COMPLETED"/);
  assert.match(api, /requestedCompletedDate < repairDate/);
  assert.match(api, /completedDate: valid\.completedDate/);
});

test("repair type migration leaves old repair history unchanged", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE repair_records(id TEXT PRIMARY KEY,symptom TEXT,cause TEXT,responsible_person TEXT,provider TEXT,parts_json TEXT,total_cost REAL); INSERT INTO repair_records VALUES ('old','เสีย','สาเหตุ','ช่าง','อู่','[\"อะไหล่\"]',2500)");
  db.exec(await readFile(new URL("../drizzle/0015_flawless_mephisto.sql", import.meta.url), "utf8"));
  assert.deepEqual({ ...db.prepare("SELECT * FROM repair_records").get() }, { id:"old", symptom:"เสีย", cause:"สาเหตุ", responsible_person:"ช่าง", provider:"อู่", parts_json:'["อะไหล่"]', total_cost:2500, repair_type:null });
  db.close();
});
