import { asc, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import registry from "../../../data/machineries.json";
import { ensureDisposalSchema, ensureTransferSchema, refreshMachineryState, getDb } from "../../../db";
import { disposalRecords, machineries } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";
import { registryVisibilitySql } from "../../../db/disposal-sql.mjs";
import { acquisitionInfo, currentMachine, validDate } from "../../../lib/age-rates.mjs";

function validateAcquisition(input: Record<string, unknown>) {
  if (input.acquisitionDate != null && input.acquisitionDate !== "" && !validDate(input.acquisitionDate)) return false;
  if (input.standardLifeYears != null && input.standardLifeYears !== "" && (!Number.isInteger(Number(input.standardLifeYears)) || Number(input.standardLifeYears) <= 0)) return false;
  return true;
}

type MachineryStatus = "AVAILABLE" | "RENTED" | "IN_SERVICE" | "UNDER_REPAIR" | "INACTIVE";
type MachineryCondition = "W" | "M" | "AVAILABLE" | "DAMAGED" | "MAINTENANCE" | "AWAITING_DISPOSAL" | "DISPOSAL_APPROVED";
const validConditions = new Set(["W", "M", "AVAILABLE", "DAMAGED", "MAINTENANCE", "AWAITING_DISPOSAL", "DISPOSAL_APPROVED"]);
const officialSource = "เวิร์กบุ๊ก1.xlsx — สภาพเครื่องจักร (2 ก.ย. 2569)";
const workbook2DamagedCodes = ["16-6005-95-5","16-6011-96-3","16-6013-96-5","23-6159-97-7","23-6237-04-9","23-6239-04-0","23-6244-04-8","23-6262-08-8","25-0753-97-9","25-6609-97-5","25-6612-97-0","25-6727-02-2","26-6007-95-6","31-0504-85-4","31-0556-96-5","31-6219-95-3","31-6274-97-0","31-6287-97-4","31-6515-15-8","31-6517-15-0","35-6036-94-5","35-6078-97-4","35-6098-99-8","41-6072-08-9","41-6077-10-6","41-6079-10-8","41-6080-10-1","64-6024-02-1","77-6136-11-4","82-6021-94-0","82-6023-94-2","82-6058-01-2","82-6060-01-7","82-6074-02-7","82-6081-08-2","82-6169-18-0"];
const workbook2ImportKey = "workbook2-damaged-2026-09-01-v2";

async function importWorkbook2DamagedStatus() {
  const db = getDb();
  await db.run(sql`CREATE TABLE IF NOT EXISTS app_data_imports (import_key TEXT PRIMARY KEY NOT NULL, imported_at TEXT NOT NULL)`);
  const inserted = await db.run(sql`INSERT OR IGNORE INTO app_data_imports (import_key, imported_at) VALUES (${workbook2ImportKey}, ${new Date().toISOString()})`);
  if (!inserted.meta.changes) return;
  const codes = sql.join(workbook2DamagedCodes.map(code => sql`${code}`), sql`, `);
  await db.run(sql`UPDATE machineries
    SET condition = 'DAMAGED', status = CASE WHEN repair_status = 'ACTIVE' THEN 'UNDER_REPAIR' ELSE 'AVAILABLE' END,
        updated_at = ${new Date().toISOString()}
    WHERE code IN (${codes}) AND condition NOT IN ('W', 'M', 'AWAITING_DISPOSAL', 'DISPOSAL_APPROVED')`);
}
const systemStateOf = (condition: MachineryCondition) => ({
  status: (["W", "M"].includes(condition) ? "RENTED" : condition === "MAINTENANCE" ? "UNDER_REPAIR" : ["AWAITING_DISPOSAL", "DISPOSAL_APPROVED"].includes(condition) ? "INACTIVE" : "AVAILABLE") as MachineryStatus,
  repairStatus: condition === "MAINTENANCE" ? "ACTIVE" as const : "NONE" as const,
});

async function syncOfficialRegistry() {
  await ensureTransferSchema();
  const db = getDb();
  const [{ value }] = await db.select({ value: count() }).from(machineries).where(eq(machineries.source, officialSource));
  if (value === registry.length) return;
  const now = new Date().toISOString();
  // Keep each statement below D1's bound-parameter ceiling.
  for (let index = 0; index < registry.length; index += 2) {
    const values = registry.slice(index, index + 2).map((item) => ({
      id: `registry:${item.code}`, code: item.code, typeCode: item.typeCode, name: item.name, brand: item.brand,
      ...acquisitionInfo(item),
      model: item.model, engineModel: item.engineModel, registrationNumber: item.registrationNumber, serialNumber: "",
      department: item.currentDepartment, owningDepartment: item.owningDepartment, leasingDepartment: item.leasingDepartment,
      currentDepartment: item.currentDepartment, condition: item.condition as MachineryCondition, status: item.status as MachineryStatus, acquiredYear: null,
      repairStatus: item.repairStatus as "NONE" | "ACTIVE", fuelRate: item.fuelRate, fuelUnit: item.fuelUnit,
      fuelConsumption: item.fuelConsumption, purchasePrice: item.purchasePrice,
      utilization2563: item.utilization2563, utilization2564: item.utilization2564, utilization2565: item.utilization2565,
      yearlyRate: item.yearlyRate, monthlyRate: item.monthlyRate, weeklyRate: item.weeklyRate,
      dailyRate: item.dailyRate ?? 0, hourlyRate: item.hourlyRate, note: item.note,
      source: officialSource, createdAt: now, updatedAt: now,
    }));
    await db.insert(machineries).values(values).onConflictDoUpdate({
      target: machineries.code,
      setWhere: sql`NOT EXISTS (SELECT 1 FROM disposal_records WHERE machinery_code = machineries.code) AND NOT EXISTS (SELECT 1 FROM transfer_department_baselines WHERE machinery_code = machineries.code) AND NOT EXISTS (SELECT 1 FROM rentals WHERE machinery_code = machineries.code)`,
      set: {
        typeCode: sql`excluded.type_code`, name: sql`excluded.name`, brand: sql`excluded.brand`, model: sql`excluded.model`,
        engineModel: sql`excluded.engine_model`, registrationNumber: sql`excluded.registration_number`,
        department: sql`excluded.department`, owningDepartment: sql`excluded.owning_department`, leasingDepartment: sql`excluded.leasing_department`, currentDepartment: sql`excluded.current_department`,
        condition: sql`excluded.condition`, status: sql`excluded.status`, repairStatus: sql`excluded.repair_status`, fuelRate: sql`excluded.fuel_rate`, fuelUnit: sql`excluded.fuel_unit`,
        fuelConsumption: sql`excluded.fuel_consumption`, purchasePrice: sql`excluded.purchase_price`,
        utilization2563: sql`excluded.utilization_2563`, utilization2564: sql`excluded.utilization_2564`, utilization2565: sql`excluded.utilization_2565`,
        yearlyRate: sql`excluded.yearly_rate`, monthlyRate: sql`excluded.monthly_rate`, weeklyRate: sql`excluded.weekly_rate`,
        dailyRate: sql`excluded.daily_rate`, hourlyRate: sql`excluded.hourly_rate`, note: sql`excluded.note`, source: sql`excluded.source`, updatedAt: now,
      },
    });
  }
  await db.delete(machineries).where(sql`${machineries.source} = 'ทะเบียนเครื่องจักร 25/2/68' AND NOT EXISTS (SELECT 1 FROM disposal_records WHERE machinery_code = machineries.code) AND NOT EXISTS (SELECT 1 FROM transfer_department_baselines WHERE machinery_code = machineries.code) AND NOT EXISTS (SELECT 1 FROM rentals WHERE machinery_code = machineries.code)`);
  await refreshMachineryState();
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await syncOfficialRegistry();
    await importWorkbook2DamagedStatus();
    const rows = await getDb().select().from(machineries).where(sql.raw(registryVisibilitySql)).orderBy(asc(machineries.code));
    return NextResponse.json(rows.map(currentMachine));
  } catch (error) {
    console.error("Unable to list machineries", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดข้อมูลเครื่องจักรได้" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await syncOfficialRegistry();
    const input = await request.json() as Record<string, unknown>;
    if (input.condition === "MAINTENANCE") return NextResponse.json({ message: "สถานะซ่อมบำรุงกำหนดจากระบบงานซ่อมเท่านั้น" }, { status: 400 });
    if (!validateAcquisition(input)) return NextResponse.json({ message: "วันที่จัดหาหรืออายุการใช้งานมาตรฐานไม่ถูกต้อง" }, { status: 400 });
    const required = ["code", "name", "brand", "currentDepartment"] as const;
    if (required.some((field) => typeof input[field] !== "string" || !String(input[field]).trim())) {
      return NextResponse.json({ message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบ" }, { status: 400 });
    }
    if (!validConditions.has(String(input.condition)) || !Number.isInteger(input.dailyRate) || Number(input.dailyRate) < 0) {
      return NextResponse.json({ message: "สถานะหรือค่าเช่าไม่ถูกต้อง" }, { status: 400 });
    }
    const code = String(input.code).trim();
    const db = getDb();
    if ((await db.select({ id: machineries.id }).from(machineries).where(eq(machineries.code, code)).limit(1)).length) {
      return NextResponse.json({ message: "หมายเลขเครื่องจักรนี้มีอยู่ในระบบแล้ว" }, { status: 409 });
    }
    const now = new Date().toISOString();
    const currentDepartment = String(input.currentDepartment).trim();
    const condition = String(input.condition) as MachineryCondition;
    const systemState = systemStateOf(condition);
    const machine = {
      id: crypto.randomUUID(), code, typeCode: String(input.typeCode ?? "").trim() || null,
      acquisitionDate: String(input.acquisitionDate ?? "").trim() || null, standardLifeYears: Number(input.standardLifeYears) || null,
      name: String(input.name).trim(), brand: String(input.brand).trim().toUpperCase(), model: String(input.model ?? "").trim() || null,
      engineModel: String(input.engineModel ?? "").trim() || null, registrationNumber: String(input.registrationNumber ?? "").trim() || null,
      serialNumber: String(input.serialNumber ?? "").trim(), department: currentDepartment,
      owningDepartment: String(input.owningDepartment ?? "").trim() || currentDepartment,
      leasingDepartment: String(input.leasingDepartment ?? "").trim() || null, currentDepartment, condition,
      status: systemState.status, repairStatus: systemState.repairStatus, acquiredYear: Number(input.acquiredYear) || null,
      purchasePrice: Number(input.purchasePrice) || null, yearlyRate: Number(input.yearlyRate) || null,
      monthlyRate: Number(input.monthlyRate) || null, weeklyRate: Number(input.weeklyRate) || null,
      dailyRate: Number(input.dailyRate), hourlyRate: Number(input.hourlyRate) || null,
      source: "เพิ่มผ่านระบบ", createdAt: now, updatedAt: now,
    };
    await db.insert(machineries).values(machine);
    await refreshMachineryState();
    const [saved] = await db.select().from(machineries).where(eq(machineries.code, code)).limit(1);
    return NextResponse.json(currentMachine(saved), { status: 201 });
  } catch (error) {
    console.error("Unable to create machinery", error);
    return NextResponse.json({ message: "ไม่สามารถบันทึกเครื่องจักรได้" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await syncOfficialRegistry();
    await ensureDisposalSchema();
    const input = await request.json() as Record<string, unknown>;
    if (!validateAcquisition(input)) return NextResponse.json({ message: "วันที่จัดหาหรืออายุการใช้งานมาตรฐานไม่ถูกต้อง" }, { status: 400 });
    const required = ["code", "name", "brand", "currentDepartment"] as const;
    if (required.some((field) => typeof input[field] !== "string" || !String(input[field]).trim())) {
      return NextResponse.json({ message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบ" }, { status: 400 });
    }
    if (!validConditions.has(String(input.condition)) || !Number.isInteger(input.dailyRate) || Number(input.dailyRate) < 0) {
      return NextResponse.json({ message: "สถานะหรือค่าเช่าไม่ถูกต้อง" }, { status: 400 });
    }
    const nullableNumber = (value: unknown) => value === "" || value === null || value === undefined ? null : Number(value);
    const numericFields = ["acquiredYear", "purchasePrice", "yearlyRate", "monthlyRate", "weeklyRate", "dailyRate", "hourlyRate"];
    if (numericFields.some((field) => nullableNumber(input[field]) !== null && (!Number.isFinite(nullableNumber(input[field])) || Number(nullableNumber(input[field])) < 0))) {
      return NextResponse.json({ message: "ข้อมูลตัวเลขต้องเป็นศูนย์หรือจำนวนบวก" }, { status: 400 });
    }
    const code = String(input.code).trim();
    const db = getDb();
    const [existingMachine] = await db.select({ id: machineries.id, repairStatus: machineries.repairStatus }).from(machineries).where(eq(machineries.code, code)).limit(1);
    if (!existingMachine) {
      return NextResponse.json({ message: "ไม่พบเครื่องจักรที่ต้องการแก้ไข" }, { status: 404 });
    }
    if (input.condition === "MAINTENANCE" && existingMachine.repairStatus !== "ACTIVE") {
      return NextResponse.json({ message: "สถานะซ่อมบำรุงกำหนดจากระบบงานซ่อมเท่านั้น" }, { status: 400 });
    }
    const currentDepartment = String(input.currentDepartment).trim();
    const condition = String(input.condition) as MachineryCondition;
    const systemState = systemStateOf(condition);
    const updates = {
      ...(input.acquisitionDate !== undefined ? { acquisitionDate: String(input.acquisitionDate ?? "").trim() || null } : {}),
      ...(input.standardLifeYears !== undefined ? { standardLifeYears: Number(input.standardLifeYears) || null } : {}),
      typeCode: String(input.typeCode ?? "").trim() || null,
      name: String(input.name).trim(), brand: String(input.brand).trim().toUpperCase(),
      model: String(input.model ?? "").trim() || null, engineModel: String(input.engineModel ?? "").trim() || null,
      registrationNumber: String(input.registrationNumber ?? "").trim() || null, serialNumber: String(input.serialNumber ?? "").trim(),
      department: currentDepartment, owningDepartment: String(input.owningDepartment ?? "").trim() || currentDepartment,
      leasingDepartment: String(input.leasingDepartment ?? "").trim() || null,
      currentDepartment, condition, status: systemState.status, repairStatus: systemState.repairStatus,
      acquiredYear: nullableNumber(input.acquiredYear), purchasePrice: nullableNumber(input.purchasePrice),
      yearlyRate: nullableNumber(input.yearlyRate), monthlyRate: nullableNumber(input.monthlyRate),
      weeklyRate: nullableNumber(input.weeklyRate), dailyRate: Number(input.dailyRate), hourlyRate: nullableNumber(input.hourlyRate),
      note: String(input.note ?? "").trim() || null, updatedAt: new Date().toISOString(),
    };
    const [disposal] = await db.select({ status: disposalRecords.status }).from(disposalRecords).where(eq(disposalRecords.machineryCode, code)).limit(1);
    if (disposal && condition !== disposal.status) return NextResponse.json({ message: "เครื่องจักรนี้มีรายการจำหน่าย กรุณาเปลี่ยนสถานะผ่านระบบจำหน่ายเครื่องจักร" }, { status: 409 });
    await db.update(machineries).set(updates).where(eq(machineries.code, code));
    await refreshMachineryState();
    const [updated] = await db.select().from(machineries).where(eq(machineries.code, code)).limit(1);
    return NextResponse.json(currentMachine(updated));
  } catch (error) {
    console.error("Unable to update machinery", error);
    return NextResponse.json({ message: "ไม่สามารถแก้ไขข้อมูลเครื่องจักรได้" }, { status: 500 });
  }
}
