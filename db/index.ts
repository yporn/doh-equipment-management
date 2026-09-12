import { initializeSchema } from "./initialization.mjs";
import { rentalStateTriggerSql, rentalStateRefreshSql } from "./rental-state-sql.mjs";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { disposalSchemaSql, disposalTriggerSql } from "./disposal-sql.mjs";
import { transferSchemaSql, transferTriggerSql, transferBackfillSql } from "./transfer-sql.mjs";
import { rentalDepartmentTriggerSql, rentalDepartmentBackfillSql } from "./rental-department-sql.mjs";

export async function ensureTransferSchema() {
  await ensureDisposalSchema();
  if (!env.DB) throw new Error("Database unavailable");
  await initializeSchema(env.DB, "transfer", async () => {
    await env.DB.batch([...transferSchemaSql, ...transferTriggerSql].map(statement => env.DB.prepare(statement)));
  });
  // Keep reconciling legacy/newly imported machinery without reinstalling triggers.
  await env.DB.prepare(transferBackfillSql).run();
}

export async function ensureDisposalSchema() {
  await initializeSchema(env.DB, "disposal", async () => {
    await ensureRentalSchema();
    await ensureRepairSchema();
    if (!env.DB) throw new Error("Database unavailable");
    await env.DB.batch([...disposalSchemaSql, ...disposalTriggerSql, ...rentalStateTriggerSql].map(statement => env.DB.prepare(statement)));
  });
  // State depends on today's month and remains fresh on every request.
  await refreshMachineryState();
}

export async function refreshMachineryState() {
  if (!env.DB) throw new Error("Database unavailable");
  await env.DB.prepare(rentalStateRefreshSql).run();
}

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function ensureAuthSchema() {
  await initializeSchema(env.DB, "auth", async () => {
    if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT DEFAULT 'STAFF' NOT NULL,
        active INTEGER DEFAULT 1 NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)"),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_unique ON auth_sessions (token_hash)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS auth_sessions_user_id ON auth_sessions (user_id)"),
    ]);
  });
}

export async function ensureMachinerySchema() {
  await initializeSchema(env.DB, "machinery", async () => {
    if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS machineries (
        id TEXT PRIMARY KEY NOT NULL,
        code TEXT NOT NULL,
        type_code TEXT,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        model TEXT,
        engine_model TEXT,
        registration_number TEXT,
        serial_number TEXT NOT NULL,
        department TEXT NOT NULL,
        owning_department TEXT,
        leasing_department TEXT,
        current_department TEXT,
        condition TEXT DEFAULT 'AVAILABLE' NOT NULL,
        status TEXT DEFAULT 'AVAILABLE' NOT NULL,
        repair_status TEXT DEFAULT 'NONE' NOT NULL,
        acquired_year INTEGER,
        fuel_rate REAL,
        fuel_unit TEXT,
        fuel_consumption TEXT,
        purchase_price INTEGER,
        utilization_2563 REAL,
        utilization_2564 REAL,
        utilization_2565 REAL,
        yearly_rate INTEGER,
        monthly_rate INTEGER,
        weekly_rate INTEGER,
        daily_rate INTEGER DEFAULT 0 NOT NULL,
        hourly_rate INTEGER,
        note TEXT,
        source TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS machineries_code_unique ON machineries (code)"),
    ]);
    const columns = await env.DB.prepare("PRAGMA table_info(machineries)").all<{ name: string }>();
    const columnNames = new Set(columns.results.map((column) => column.name));
    if (!columnNames.has("acquisition_date")) await env.DB.prepare("ALTER TABLE machineries ADD COLUMN acquisition_date TEXT").run();
    if (!columnNames.has("standard_life_years")) await env.DB.prepare("ALTER TABLE machineries ADD COLUMN standard_life_years INTEGER").run();
    if (!columnNames.has("repair_status")) {
      await env.DB.prepare("ALTER TABLE machineries ADD COLUMN repair_status TEXT DEFAULT 'NONE' NOT NULL").run();
    }
    if (!columnNames.has("engine_model")) await env.DB.prepare("ALTER TABLE machineries ADD COLUMN engine_model TEXT").run();
    if (!columnNames.has("registration_number")) await env.DB.prepare("ALTER TABLE machineries ADD COLUMN registration_number TEXT").run();
    if (!columnNames.has("leasing_department")) await env.DB.prepare("ALTER TABLE machineries ADD COLUMN leasing_department TEXT").run();
    if (!columnNames.has("renter_department")) await env.DB.prepare("ALTER TABLE machineries ADD COLUMN renter_department TEXT").run();
    if (!columnNames.has("fuel_consumption")) await env.DB.prepare("ALTER TABLE machineries ADD COLUMN fuel_consumption TEXT").run();
    if (!columnNames.has("condition")) await env.DB.prepare("ALTER TABLE machineries ADD COLUMN condition TEXT DEFAULT 'AVAILABLE' NOT NULL").run();
  });
}

export async function ensureRepairSchema() {
  await initializeSchema(env.DB, "repair", async () => {
    await ensureMachinerySchema();
    if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS repair_records (
        id TEXT PRIMARY KEY NOT NULL,
        machinery_code TEXT NOT NULL,
        repair_date TEXT NOT NULL,
        work_systems_json TEXT NOT NULL,
        repair_type TEXT,
        symptom TEXT NOT NULL,
        cause TEXT,
        repair_details TEXT,
        reporter TEXT NOT NULL,
        responsible_person TEXT,
        provider TEXT,
        parts_json TEXT DEFAULT '[]' NOT NULL,
        total_cost REAL DEFAULT 0 NOT NULL,
        status TEXT DEFAULT 'WAITING' NOT NULL,
        completed_date TEXT,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_repair_records_machinery_date ON repair_records (machinery_code, repair_date)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_repair_records_status_date ON repair_records (status, repair_date)"),
    ]);
    const columns = await env.DB.prepare("PRAGMA table_info(repair_records)").all<{ name: string }>();
    if (!new Set(columns.results.map((column) => column.name)).has("repair_type")) {
      await env.DB.prepare("ALTER TABLE repair_records ADD COLUMN repair_type TEXT").run();
    }
  });
}

export async function ensureServiceSchema() {
  await initializeSchema(env.DB, "service", async () => {
    await ensureMachinerySchema();
    if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS service_records (
        id TEXT PRIMARY KEY NOT NULL,
        machinery_code TEXT NOT NULL,
        service_date TEXT NOT NULL,
        document_number TEXT,
        fiscal_year INTEGER,
        document_sequence INTEGER,
        meter_reading REAL,
        meter_unit TEXT,
        provider TEXT,
        technician TEXT,
        items_json TEXT NOT NULL,
        total_cost REAL DEFAULT 0 NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_service_records_machinery_date ON service_records (machinery_code, service_date)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_service_records_date ON service_records (service_date)"),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS service_document_counters (
        fiscal_year INTEGER PRIMARY KEY NOT NULL,
        last_sequence INTEGER DEFAULT 0 NOT NULL
      )`),
    ]);
    const columns = await env.DB.prepare("PRAGMA table_info(service_records)").all<{ name: string }>();
    const columnNames = new Set(columns.results.map((column) => column.name));
    if (!columnNames.has("document_number")) await env.DB.prepare("ALTER TABLE service_records ADD COLUMN document_number TEXT").run();
    if (!columnNames.has("fiscal_year")) await env.DB.prepare("ALTER TABLE service_records ADD COLUMN fiscal_year INTEGER").run();
    if (!columnNames.has("document_sequence")) await env.DB.prepare("ALTER TABLE service_records ADD COLUMN document_sequence INTEGER").run();
    await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS service_records_document_number_unique ON service_records (document_number)").run();
  });
}

export async function ensureRentalSchema() {
  await initializeSchema(env.DB, "rental", async () => {
    await ensureMachinerySchema();
    if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS rentals (
        id TEXT PRIMARY KEY NOT NULL,
        machinery_code TEXT NOT NULL,
        renter_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        expected_return_date TEXT NOT NULL,
        duration INTEGER DEFAULT 1 NOT NULL,
        returned_date TEXT,
        rental_mode TEXT DEFAULT 'W' NOT NULL,
        rate_type TEXT NOT NULL,
        rate_amount REAL NOT NULL,
        total_amount REAL DEFAULT 0 NOT NULL,
        approver TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE' NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_rentals_status_start_date ON rentals (status, start_date)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_rentals_machinery_code ON rentals (machinery_code)"),
    ]);
    const columns = await env.DB.prepare("PRAGMA table_info(rentals)").all<{ name: string }>();
    const columnNames = new Set(columns.results.map((column) => column.name));
    if (!columnNames.has("duration")) await env.DB.prepare("ALTER TABLE rentals ADD COLUMN duration INTEGER DEFAULT 1 NOT NULL").run();
    if (!columnNames.has("total_amount")) await env.DB.prepare("ALTER TABLE rentals ADD COLUMN total_amount REAL DEFAULT 0 NOT NULL").run();
    if (!columnNames.has("rental_mode")) await env.DB.prepare("ALTER TABLE rentals ADD COLUMN rental_mode TEXT DEFAULT 'W' NOT NULL").run();
    await env.DB.prepare("UPDATE rentals SET total_amount = rate_amount * duration WHERE total_amount = 0 AND rate_amount > 0").run();
    await env.DB.batch([...rentalDepartmentTriggerSql, rentalDepartmentBackfillSql].map(statement => env.DB.prepare(statement)));
  });
}

export function getFiscalYear(serviceDate: string) {
  const [year, month] = serviceDate.split("-").map(Number);
  return year + (month >= 10 ? 544 : 543);
}

export async function allocateServiceDocumentNumber(serviceDate: string) {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  const fiscalYear = getFiscalYear(serviceDate);
  const row = await env.DB.prepare(`INSERT INTO service_document_counters (fiscal_year, last_sequence)
    VALUES (?, 1)
    ON CONFLICT(fiscal_year) DO UPDATE SET last_sequence = last_sequence + 1
    RETURNING last_sequence`).bind(fiscalYear).first<{ last_sequence: number }>();
  if (!row) throw new Error("Unable to allocate Service document number");
  const documentSequence = row.last_sequence;
  return { fiscalYear, documentSequence, documentNumber: `154/${String(documentSequence).padStart(2, "0")}/${String(fiscalYear).slice(-2)}` };
}

export async function assignMissingServiceDocumentNumbers() {
  await ensureServiceSchema();
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  const missing = await env.DB.prepare("SELECT id, service_date FROM service_records WHERE document_number IS NULL ORDER BY service_date, created_at").all<{ id: string; service_date: string }>();
  for (const record of missing.results) {
    const document = await allocateServiceDocumentNumber(record.service_date);
    await env.DB.prepare("UPDATE service_records SET document_number = ?, fiscal_year = ?, document_sequence = ? WHERE id = ? AND document_number IS NULL")
      .bind(document.documentNumber, document.fiscalYear, document.documentSequence, record.id).run();
  }
}
