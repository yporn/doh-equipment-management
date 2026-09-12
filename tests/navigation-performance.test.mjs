import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { initializeSchema } from "../db/initialization.mjs";
import * as disposal from "../db/disposal-sql.mjs";
import * as transfer from "../db/transfer-sql.mjs";
import * as department from "../db/rental-department-sql.mjs";
import * as rentalState from "../db/rental-state-sql.mjs";

test("initialization caches only success per database and retries failed work", async () => {
  const db = {}, other = {};
  let calls = 0;
  const initialize = async () => {calls++;};
  await initializeSchema(db,"schema",initialize);
  await initializeSchema(db,"schema",initialize);
  assert.equal(calls,1);
  await initializeSchema(other,"schema",initialize);
  await initializeSchema(db,"new-schema-version",initialize);
  assert.equal(calls,3);
  await assert.rejects(initializeSchema(db,"retry",async () => {throw new Error("offline");}),/offline/);
  await initializeSchema(db,"retry",initialize);
  assert.equal(calls,4);
  await assert.rejects(initializeSchema(null,"schema",initialize),/Database unavailable/);
});

test("concurrent cold requests do not share a request-owned pending promise", async () => {
  const db = {};
  let release, calls = 0;
  const first = initializeSchema(db,"schema",() => new Promise(resolve => {calls++;release = resolve;}));
  await initializeSchema(db,"schema",async () => {calls++;});
  assert.equal(calls,2);
  release(); await first;
  await initializeSchema(db,"schema",async () => {calls++;});
  assert.equal(calls,2);
});

async function databaseModule() {
  const db = new DatabaseSync(":memory:");
  const clock = {month:"2026-09"};
  db.function("test_month",() => clock.month);
  const statements = [];
  let trips = 0;
  const execute = (statement,params,method) => {
    statements.push(statement);
    return db.prepare(statement.replaceAll("strftime('%Y-%m','now','+7 hours')","test_month()"))[method](...params);
  };
  const binding = {
    prepare(statement) {
      let params = [];
      return {
        bind(...values) {params = values;return this;},
        async run() {trips++;return execute(statement,params,"run");},
        async all() {trips++;return {results:execute(statement,params,"all")};},
        async first() {trips++;return execute(statement,params,"get") ?? null;},
        execute() {return execute(statement,params,"run");},
      };
    },
    async batch(items) {
      trips++;
      db.exec("BEGIN");
      try { const result = items.map(item => item.execute()); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
  const source = await readFile(new URL("../db/index.ts",import.meta.url),"utf8");
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  const imports = {
    "cloudflare:workers":{env:{DB:binding}},
    "drizzle-orm/d1":{drizzle:() => ({})},
    "./schema":{},
    "./initialization.mjs":{initializeSchema},
    "./disposal-sql.mjs":disposal,
    "./transfer-sql.mjs":transfer,
    "./rental-department-sql.mjs":department,
    "./rental-state-sql.mjs":rentalState,
  };
  vm.runInNewContext(code,{exports,require:name => {
    if (!(name in imports)) throw new Error(name);
    return imports[name];
  }});
  return {db,clock,api:exports,statements,trips:() => trips,reset:() => {statements.length = 0;trips = 0;}};
}

test("warm module changes skip all schema setup but retain live monthly and transfer refresh", async () => {
  const f = await databaseModule();
  try {
    await f.api.ensureAuthSchema();
    await f.api.ensureTransferSchema();
    await f.api.ensureServiceSchema();
    const coldTrips = f.trips();
    assert.ok(f.statements.some(sql => sql.startsWith("CREATE")));
    f.reset();
    await f.api.ensureAuthSchema();
    await f.api.ensureTransferSchema();
    await f.api.ensureServiceSchema();
    assert.equal(f.trips(),2);
    assert.ok(coldTrips > f.trips() * 4);
    assert.equal(f.statements.some(sql => /^(CREATE|DROP|ALTER|PRAGMA)/.test(sql)),false);
    assert.ok(f.statements.some(sql => sql.includes("renter_department")));
    assert.ok(f.statements.some(sql => sql.includes("transfer_department_baselines")));
    f.reset();
    await f.api.ensureAuthSchema(); await f.api.ensureRepairSchema(); await f.api.ensureRentalSchema();
    assert.equal(f.trips(),0);
  } finally {f.db.close();}
});

test("initialized database still applies new writes and rolls over month without reinstalling schema", async () => {
  const f = await databaseModule();
  try {
    await f.api.ensureTransferSchema();
    f.db.exec("INSERT INTO machineries (id,code,name,brand,serial_number,department,current_department,condition,status,created_at,updated_at) VALUES ('a','A','test','test','','SITE','SITE','AVAILABLE','AVAILABLE','now','now')");
    f.db.exec("INSERT INTO rentals (id,machinery_code,renter_name,start_date,expected_return_date,rate_type,rate_amount,approver,status,created_at,updated_at) VALUES ('r','A','PROJECT','2026-09-01','2026-09-30','MONTHLY',100,'staff','ACTIVE','now','now')");
    assert.equal(f.db.prepare("SELECT status FROM machineries").get().status,"RENTED");
    f.clock.month = "2026-10"; f.reset();
    await f.api.ensureTransferSchema();
    assert.deepEqual({...f.db.prepare("SELECT status,renter_department,current_department FROM machineries").get()},{status:"AVAILABLE",renter_department:null,current_department:"SITE"});
    assert.equal(f.statements.some(sql => /^(CREATE|DROP|ALTER|PRAGMA)/.test(sql)),false);
    assert.equal(f.db.prepare("SELECT count(*) n FROM rentals").get().n,1);
    f.db.exec("UPDATE rentals SET start_date='2026-10-01' WHERE id='r'");
    assert.equal(f.db.prepare("SELECT renter_department FROM machineries").get().renter_department,"PROJECT");
    f.db.exec("DELETE FROM rentals WHERE id='r'");
    assert.equal(f.db.prepare("SELECT status FROM machineries").get().status,"AVAILABLE");
  } finally {f.db.close();}
});

test("sidebar uses native links without router interception and API authorization remains per request", async () => {
  const root = new URL("../",import.meta.url);
  const sidebar = await readFile(new URL("app/components/app-sidebar.tsx",root),"utf8");
  assert.doesNotMatch(sidebar,/next\/link|<Link|prefetch=|<a[^>]*onClick=/);
  assert.match(sidebar,/<a[^>]*href=\{path\}/);
  assert.match(sidebar,/aria-current=/);
  assert.doesNotMatch(sidebar,/window.location|preventDefault/);
  for (const route of ["machineries","rentals","repairs","transfers","disposals","services","users"]) {
    const source = await readFile(new URL(`app/api/${route}/route.ts`,root),"utf8");
    const handlers = source.match(/export async function (GET|POST|PATCH|DELETE)/g) || [];
    assert.ok(handlers.length > 0);
    // Transfer PATCH/DELETE and disposal POST/PATCH share an authenticated mutation helper.
    const sharedHelper = ["transfers","disposals"].includes(route) ? 1 : 0;
    assert.ok((source.match(/await requireUser\(request/g) || []).length >= handlers.length - sharedHelper,route);
  }
  const auth = await readFile(new URL("lib/auth.ts",root),"utf8");
  assert.match(auth,/s.expires_at > \? AND u.active = 1/);
  assert.match(auth,/const user = await getCurrentUser\(request\)/);
});
