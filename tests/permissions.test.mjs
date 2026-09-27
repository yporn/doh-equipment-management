import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MODULES, ACTIONS, defaultPermissions, normalizePermissions, hasPermission } from "../lib/permissions.mjs";

test("ADMIN always has every permission regardless of a stored permissions object", () => {
  const admin = { role: "ADMIN", permissions: { machineries: { read: false, edit: false, delete: false } } };
  for (const module of MODULES) for (const action of ACTIONS) assert.equal(hasPermission(admin, module, action), true);
});

test("STAFF defaults to full access on every module when permissions is missing or null (backward compatible)", () => {
  for (const permissions of [undefined, null, {}]) {
    const staff = { role: "STAFF", permissions };
    for (const module of MODULES) for (const action of ACTIONS) assert.equal(hasPermission(staff, module, action), true);
  }
});

test("STAFF respects an explicit false and normalizePermissions fills in the rest as open", () => {
  const staff = { role: "STAFF", permissions: { rentals: { read: true, edit: false, delete: false } } };
  assert.equal(hasPermission(staff, "rentals", "read"), true);
  assert.equal(hasPermission(staff, "rentals", "edit"), false);
  assert.equal(hasPermission(staff, "rentals", "delete"), false);
  // A module never mentioned in the stored object is untouched (still fully open).
  assert.equal(hasPermission(staff, "service", "edit"), true);
  const normalized = normalizePermissions(staff.permissions);
  assert.deepEqual(normalized.rentals, { read: true, edit: false, delete: false });
  assert.deepEqual(normalized.service, { read: true, edit: true, delete: true });
});

test("hasPermission is false for a signed-out user (null)", () => {
  for (const module of MODULES) for (const action of ACTIONS) assert.equal(hasPermission(null, module, action), false);
});

test("defaultPermissions covers every module with every action open", () => {
  const defaults = defaultPermissions();
  for (const module of MODULES) for (const action of ACTIONS) assert.equal(defaults[module][action], true);
});

test("every module API route is gated per module+action, and users stays admin-only", async () => {
  const root = new URL("../", import.meta.url);
  const routes = {
    machineries: { GET: "read", POST: "edit", PATCH: "edit" },
    rentals: { GET: "read", POST: "edit", PATCH: "edit", DELETE: "delete" },
    services: { GET: "read", POST: "edit", PATCH: "edit", DELETE: "delete" },
    repairs: { GET: "read", POST: "edit", PATCH: "edit", DELETE: "delete" },
    disposals: { GET: "read" },
    transfers: { GET: "read" },
  };
  for (const [folder, checks] of Object.entries(routes)) {
    const module = folder === "services" ? "service" : folder;
    const source = await readFile(new URL(`app/api/${folder}/route.ts`, root), "utf8");
    for (const action of Object.values(checks)) {
      assert.match(source, new RegExp(`requirePermission\\(request, "${module}", "${action}"\\)`), `${folder} missing ${action}`);
    }
  }
  const usersApi = await readFile(new URL("app/api/users/route.ts", root), "utf8");
  assert.doesNotMatch(usersApi, /requirePermission/);
  assert.equal((usersApi.match(/requireUser\(request, "ADMIN"\)/g) || []).length, 3);
  assert.match(usersApi, /normalizePermissions/);
});

test("users page can edit a STAFF account's permissions but not an ADMIN's", async () => {
  const root = new URL("../", import.meta.url);
  const page = await readFile(new URL("app/users/page.tsx", root), "utf8");
  assert.match(page, /account\.role === "STAFF" && \(/);
  assert.match(page, /PermissionEditor/);
  assert.match(page, /MODULES\.map\(\(module\)/);
});

test("sidebar hides a module link when the signed-in user lacks read access to it", async () => {
  const root = new URL("../", import.meta.url);
  const sidebar = await readFile(new URL("app/components/app-sidebar.tsx", root), "utf8");
  for (const module of MODULES) assert.match(sidebar, new RegExp(`can\\("${module}", "read"\\)`));
});
