import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { allocateServiceDocumentNumber, assignMissingServiceDocumentNumbers, ensureServiceSchema, getDb, getFiscalYear } from "../../../db";
import { machineries, serviceRecords } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";

const serviceProviders = new Set(["ฝ่ายเครื่องกล", "ศูนย์บริการ"]);

const serviceTypes = new Set([
  "เปลี่ยนน้ำมันเครื่อง",
  "เปลี่ยนไส้กรองน้ำมันเครื่อง",
  "เปลี่ยนไส้กรองน้ำมันเชื้อเพลิง",
  "เปลี่ยนไส้กรองอากาศ",
  "เปลี่ยนกรองน้ำมันเกียร์",
  "เปลี่ยนน้ำมันเกียร์",
  "เปลี่ยนน้ำมันเฟืองท้าย",
  // Retain the former combined value so existing Service records remain editable.
  "เปลี่ยนน้ำมันเกียร์/เฟืองท้าย",
  "เปลี่ยน/เติม น้ำมันไฮดรอลิค",
  "เปลี่ยนไส้กรองไฮดรอลิค",
  "เปลี่ยนแบตเตอรี่",
  "เปลี่ยนยาง",
]);
const oilTypes = new Set(["SAE 10W-30", "SAE 15W-40", "SAE 30", "SAE 75W-90", "SAE 80W-90", "SAE 90", "SAE 140", "ISO VG 46", "ISO VG 68", "ISO VG 100", "Dot 3", "AUTOMAT"]);
const batterySizes = new Set(["12V 90Ah", "12V 120Ah", "12V 150Ah"]);
const tireSizes = new Set(["9.00-20", "10.00-20", "11.00-20", "11R-22.5", "14.00-24", "215/65R16", "215/70R15", "215/70R16", "265/70R16"]);

type ServiceItem = { serviceType: string; description: string; quantity: number | null; unit: string | null; specification: string | null };

function parseItems(value: unknown): ServiceItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const serviceType = String(record.serviceType ?? record.description ?? "").trim();
    const rawQuantity = record.quantity;
    const quantity = rawQuantity === "" || rawQuantity === null || rawQuantity === undefined ? null : Number(rawQuantity);
    const specification = String(record.specification ?? "").trim() || null;
    if (!serviceTypes.has(serviceType) || (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0))) return [];
    const isOil = serviceType === "เปลี่ยนน้ำมันเครื่อง" || serviceType === "เปลี่ยนน้ำมันเกียร์" || serviceType === "เปลี่ยนน้ำมันเฟืองท้าย" || serviceType === "เปลี่ยนน้ำมันเกียร์/เฟืองท้าย" || serviceType === "เปลี่ยน/เติม น้ำมันไฮดรอลิค";
    const isCountedPart = serviceType === "เปลี่ยนแบตเตอรี่" || serviceType === "เปลี่ยนยาง";
    if ((isOil || isCountedPart) && quantity === null) return [];
    if (isOil && specification && !oilTypes.has(specification)) return [];
    if (isCountedPart && !specification) return [];
    if (serviceType === "เปลี่ยนแบตเตอรี่" && !batterySizes.has(specification!)) return [];
    if (serviceType === "เปลี่ยนยาง" && !tireSizes.has(specification!)) return [];
    if (isCountedPart && !Number.isInteger(quantity)) return [];
    return [{ serviceType, description: serviceType, quantity, unit: isOil ? "ลิตร" : serviceType === "เปลี่ยนแบตเตอรี่" ? "ลูก" : serviceType === "เปลี่ยนยาง" ? "เส้น" : null, specification }];
  });
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await assignMissingServiceDocumentNumbers();
    const rows = await getDb().select({
      id: serviceRecords.id,
      machineryCode: serviceRecords.machineryCode,
      machineryName: machineries.name,
      machineryBrand: machineries.brand,
      machineryModel: machineries.model,
      serviceDate: serviceRecords.serviceDate,
      documentNumber: serviceRecords.documentNumber,
      meterReading: serviceRecords.meterReading,
      meterUnit: serviceRecords.meterUnit,
      provider: serviceRecords.provider,
      technician: serviceRecords.technician,
      itemsJson: serviceRecords.itemsJson,
      note: serviceRecords.note,
      createdAt: serviceRecords.createdAt,
    }).from(serviceRecords)
      .leftJoin(machineries, eq(serviceRecords.machineryCode, machineries.code))
      .orderBy(desc(serviceRecords.serviceDate), desc(serviceRecords.createdAt));
    return NextResponse.json(rows.map((row) => ({ ...row, items: JSON.parse(row.itemsJson) })));
  } catch (error) {
    console.error("Unable to list service records", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดประวัติ Service ได้" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureServiceSchema();
    const input = await request.json() as Record<string, unknown>;
    const machineryCode = String(input.machineryCode ?? "").trim();
    const serviceDate = String(input.serviceDate ?? "").trim();
    const items = parseItems(input.items);
    const submittedItemCount = Array.isArray(input.items) ? input.items.length : 0;
    if (!machineryCode || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || items.length === 0 || items.length !== submittedItemCount) {
      return NextResponse.json({ message: "กรุณาเลือกเครื่องจักร วันที่ และระบุรายการ Service อย่างน้อย 1 รายการ" }, { status: 400 });
    }
    const db = getDb();
    if (!(await db.select({ id: machineries.id }).from(machineries).where(eq(machineries.code, machineryCode)).limit(1)).length) {
      return NextResponse.json({ message: "ไม่พบเครื่องจักรที่เลือก" }, { status: 404 });
    }
    const optionalNumber = (value: unknown) => value === "" || value === null || value === undefined ? null : Number(value);
    const meterReading = optionalNumber(input.meterReading);
    const meterUnit = String(input.meterUnit ?? "");
    if (meterReading !== null && (!Number.isFinite(meterReading) || meterReading < 0)) {
      return NextResponse.json({ message: "ค่ามิเตอร์ต้องเป็นศูนย์หรือจำนวนบวก" }, { status: 400 });
    }
    if (meterReading !== null && !["KILOMETER", "HOUR"].includes(meterUnit)) {
      return NextResponse.json({ message: "กรุณาเลือกหน่วยมิเตอร์" }, { status: 400 });
    }
    const provider = String(input.provider ?? "").trim();
    if (!serviceProviders.has(provider)) return NextResponse.json({ message: "กรุณาเลือกผู้ให้บริการ/อู่ให้ถูกต้อง" }, { status: 400 });
    const now = new Date().toISOString();
    const document = await allocateServiceDocumentNumber(serviceDate);
    const record = {
      id: crypto.randomUUID(), machineryCode, serviceDate,
      ...document,
      meterReading, meterUnit: meterReading === null ? null : meterUnit as "KILOMETER" | "HOUR",
      provider,
      technician: String(input.technician ?? "").trim() || null,
      itemsJson: JSON.stringify(items),
      totalCost: 0,
      note: String(input.note ?? "").trim() || null,
      createdAt: now, updatedAt: now,
    };
    await db.insert(serviceRecords).values(record);
    return NextResponse.json({ ...record, items }, { status: 201 });
  } catch (error) {
    console.error("Unable to create service record", error);
    return NextResponse.json({ message: "ไม่สามารถบันทึก Service ได้" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureServiceSchema();
    const input = await request.json() as Record<string, unknown>;
    const id = String(input.id ?? "").trim();
    const machineryCode = String(input.machineryCode ?? "").trim();
    const serviceDate = String(input.serviceDate ?? "").trim();
    const items = parseItems(input.items);
    const submittedItemCount = Array.isArray(input.items) ? input.items.length : 0;
    if (!id || !machineryCode || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || items.length === 0 || items.length !== submittedItemCount) {
      return NextResponse.json({ message: "ข้อมูล Service ไม่ครบถ้วน" }, { status: 400 });
    }
    const db = getDb();
    const [existing] = await db.select({ id: serviceRecords.id, fiscalYear: serviceRecords.fiscalYear, documentNumber: serviceRecords.documentNumber }).from(serviceRecords).where(eq(serviceRecords.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ message: "ไม่พบรายการ Service" }, { status: 404 });
    }
    if (!(await db.select({ id: machineries.id }).from(machineries).where(eq(machineries.code, machineryCode)).limit(1)).length) {
      return NextResponse.json({ message: "ไม่พบเครื่องจักรที่เลือก" }, { status: 404 });
    }
    const meterReading = input.meterReading === "" || input.meterReading === null || input.meterReading === undefined ? null : Number(input.meterReading);
    const meterUnit = String(input.meterUnit ?? "");
    if (meterReading !== null && (!Number.isFinite(meterReading) || meterReading < 0)) {
      return NextResponse.json({ message: "ค่ามิเตอร์ต้องเป็นศูนย์หรือจำนวนบวก" }, { status: 400 });
    }
    if (meterReading !== null && !["KILOMETER", "HOUR"].includes(meterUnit)) {
      return NextResponse.json({ message: "กรุณาเลือกหน่วยมิเตอร์" }, { status: 400 });
    }
    const provider = String(input.provider ?? "").trim();
    if (!serviceProviders.has(provider)) return NextResponse.json({ message: "กรุณาเลือกผู้ให้บริการ/อู่ให้ถูกต้อง" }, { status: 400 });
    const document = !existing.documentNumber || existing.fiscalYear !== getFiscalYear(serviceDate) ? await allocateServiceDocumentNumber(serviceDate) : {};
    await db.update(serviceRecords).set({
      machineryCode, serviceDate, meterReading,
      ...document,
      meterUnit: meterReading === null ? null : meterUnit as "KILOMETER" | "HOUR",
      provider,
      technician: String(input.technician ?? "").trim() || null,
      itemsJson: JSON.stringify(items), totalCost: 0,
      note: String(input.note ?? "").trim() || null,
      updatedAt: new Date().toISOString(),
    }).where(eq(serviceRecords.id, id));
    return NextResponse.json({ id, message: "แก้ไขข้อมูลเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Unable to update service record", error);
    return NextResponse.json({ message: "ไม่สามารถแก้ไข Service ได้" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureServiceSchema();
    const input = await request.json() as Record<string, unknown>;
    const id = String(input.id ?? "").trim();
    if (!id) return NextResponse.json({ message: "ไม่พบรหัสรายการ Service" }, { status: 400 });
    const db = getDb();
    if (!(await db.select({ id: serviceRecords.id }).from(serviceRecords).where(eq(serviceRecords.id, id)).limit(1)).length) {
      return NextResponse.json({ message: "ไม่พบรายการ Service" }, { status: 404 });
    }
    await db.delete(serviceRecords).where(eq(serviceRecords.id, id));
    return NextResponse.json({ message: "ลบข้อมูลเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Unable to delete service record", error);
    return NextResponse.json({ message: "ไม่สามารถลบ Service ได้" }, { status: 500 });
  }
}
