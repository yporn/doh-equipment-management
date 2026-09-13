import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("rental report omits actual return column and keeps rental end date", async () => {
  const report = await readFile(new URL("../app/rentals/rental-report.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(report, /รับคืน|คืนจริง|returnedDate/);
  assert.match(report, /<th>วันสิ้นสุด<\/th>/);
  assert.match(report, /dateLabel\(record.expectedReturnDate\)/);
  assert.equal((report.match(/<th>/g) || []).length, 10);
  assert.equal((report.match(/<col style/g) || []).length, 10);
  assert.match(report, /colSpan=\{isMonthlyView \? 10 : 9\}/);
});

test("create, edit, search and listing use recorder labels without losing saved names and omits return actions", async () => {
  const page = await readFile(new URL("../app/rentals/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /ผู้อนุมัติ|อนุมัติโดย/);
  assert.equal((page.match(/ผู้บันทึกข้อมูล/g) || []).length, 3);
  assert.match(page, /บันทึกโดย \{record.approver\}/);
  assert.match(page, /defaultValue=\{editing.approver\}/);
  assert.equal((page.match(/name="approver"/g) || []).length, 2);
  assert.doesNotMatch(page, /รับคืนเครื่องจักร|setReturning|returnMachine/);
});
