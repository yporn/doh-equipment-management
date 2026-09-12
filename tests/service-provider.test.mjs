import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Service provider is a required two-choice field and the API enforces the choices", async () => {
  const root = new URL("../", import.meta.url);
  const [page, api] = await Promise.all([
    readFile(new URL("app/service/page.tsx", root), "utf8"),
    readFile(new URL("app/api/services/route.ts", root), "utf8"),
  ]);
  assert.match(page, /<select name="provider" required/);
  assert.match(page, /<option value="ฝ่ายเครื่องกล">ฝ่ายเครื่องกล<\/option>/);
  assert.match(page, /<option value="ศูนย์บริการ">ศูนย์บริการ<\/option>/);
  assert.doesNotMatch(page, /<input\s+name="provider"/);
  assert.match(api, /const serviceProviders = new Set\(\["ฝ่ายเครื่องกล", "ศูนย์บริการ"\]\)/);
  assert.equal((api.match(/serviceProviders\.has\(provider\)/g) || []).length, 2);
  assert.equal((api.match(/provider,/g) || []).length >= 2, true);
});
