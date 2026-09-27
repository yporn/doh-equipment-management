import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("service meter reading can be marked unreadable, wired through schema, API and UI", async () => {
  const root = new URL("../", import.meta.url);
  const [schema, database, api, page] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
    readFile(new URL("app/api/services/route.ts", root), "utf8"),
    readFile(new URL("app/service/page.tsx", root), "utf8"),
  ]);
  assert.match(schema, /meterUnreadable: integer\("meter_unreadable", \{ mode: "boolean" \}\)\.notNull\(\)\.default\(false\)/);
  assert.match(database, /meter_unreadable INTEGER DEFAULT 0 NOT NULL/);
  assert.match(database, /ALTER TABLE service_records ADD COLUMN meter_unreadable INTEGER DEFAULT 0 NOT NULL/);
  // Both POST and PATCH must force meterReading to null when the checkbox is on, not just store the flag alongside a stale reading.
  assert.match(api, /const meterReading = meterUnreadable \? null : optionalNumber\(input\.meterReading\)/);
  assert.match(api, /const meterReading = meterUnreadable \|\| input\.meterReading === ""/);
  assert.equal((api.match(/meterUnreadable,/g) || []).length >= 2, true);
  assert.match(page, /มิเตอร์เสีย \/ อ่านค่าไม่ได้/);
  assert.match(page, /disabled=\{meterUnreadable\}/);
  assert.match(page, /"มิเตอร์เสีย"/);
});
