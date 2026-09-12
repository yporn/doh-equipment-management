import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDisposalSchema, getDb } from "../../../db";
import { machineries, rentals } from "../../../db/schema";
import { registryVisibilitySql } from "../../../db/disposal-sql.mjs";
import { requireUser } from "../../../lib/auth";
import { rentalRate, validDate } from "../../../lib/age-rates.mjs";

const rateTypes = new Set(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
type RateType = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

function calculateEndDate(startDate: string, duration: number, rateType: RateType) {
  const date = new Date(`${startDate}T00:00:00Z`);
  if (rateType === "DAILY") date.setUTCDate(date.getUTCDate() + duration);
  if (rateType === "WEEKLY") date.setUTCDate(date.getUTCDate() + duration * 7);
  if (rateType === "MONTHLY") date.setUTCMonth(date.getUTCMonth() + duration);
  if (rateType === "YEARLY") date.setUTCFullYear(date.getUTCFullYear() + duration);
  // The start date counts as the first day of the rental period.
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureDisposalSchema();
    const rows = await getDb().select({
      id: rentals.id, machineryCode: rentals.machineryCode, machineryName: machineries.name,
      renterName: rentals.renterName, startDate: rentals.startDate, expectedReturnDate: rentals.expectedReturnDate,
      returnedDate: rentals.returnedDate, duration: rentals.duration, rentalMode: rentals.rentalMode, rateType: rentals.rateType, rateAmount: rentals.rateAmount, totalAmount: rentals.totalAmount,
      approver: rentals.approver, status: rentals.status, note: rentals.note, createdAt: rentals.createdAt,
    }).from(rentals).leftJoin(machineries, eq(rentals.machineryCode, machineries.code))
      .orderBy(desc(rentals.startDate), desc(rentals.createdAt));
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Unable to list rentals", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดข้อมูลการเช่าได้" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureDisposalSchema();
    const input = await request.json() as Record<string, unknown>;
    const machineryCode = String(input.machineryCode ?? "").trim();
    const renterName = String(input.renterName ?? "").trim();
    const startDate = String(input.startDate ?? "").trim();
    const approver = String(input.approver ?? "").trim();
    const rentalMode = String(input.rentalMode ?? "");
    const rateType = String(input.rateType ?? "");
    const rateAmount = Number(input.rateAmount);
    const duration = Number(input.duration);
    if (!machineryCode || !renterName || !approver || !["W", "M"].includes(rentalMode) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !rateTypes.has(rateType) || !Number.isInteger(duration) || duration <= 0 || !Number.isFinite(rateAmount) || rateAmount < 0) {
      return NextResponse.json({ message: "กรุณากรอกข้อมูลการเช่าให้ครบและถูกต้อง" }, { status: 400 });
    }
    const db = getDb();
    const [machine] = await db.select().from(machineries).where(sql`machineries.code = ${machineryCode} AND ${sql.raw(registryVisibilitySql)}`).limit(1);
    if (!machine) return NextResponse.json({ message: "ไม่พบเครื่องจักรในบัญชีเครื่องจักร", }, { status: 404 });
    const now = new Date().toISOString();
    const typedRate = rateType as RateType;
    const expectedReturnDate = calculateEndDate(startDate, duration, typedRate);
    if (!validDate(startDate)) return NextResponse.json({ message: "วันที่เริ่มเช่าไม่ถูกต้อง" }, { status: 400 });
    const effectiveRateAmount = rentalMode === "M" ? 0 : rentalRate(machine, typedRate, startDate);
    if (effectiveRateAmount === null) return NextResponse.json({ message: "ไม่มีอัตราค่าเช่าสำหรับหน่วยหรือวันที่เลือก กรุณาเลือกหน่วยอื่นหรือตรวจสอบวันที่จัดหา" }, { status: 400 });
    const totalAmount = duration * effectiveRateAmount;
    const record = { id: crypto.randomUUID(), machineryCode, renterName, startDate, expectedReturnDate, duration,
      returnedDate: null, rentalMode: rentalMode as "W" | "M", rateType: typedRate, rateAmount: effectiveRateAmount, totalAmount, approver, status: "ACTIVE" as const,
      note: String(input.note ?? "").trim() || null, createdAt: now, updatedAt: now };
    await db.insert(rentals).values(record);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Unable to create rental", error);
    return NextResponse.json({ message: "ไม่สามารถบันทึกการเช่าได้" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureDisposalSchema();
    const input = await request.json() as Record<string, unknown>;
    const id = String(input.id ?? "").trim();
    const action = String(input.action ?? "RETURN");
    if (!id) return NextResponse.json({ message: "ไม่พบรหัสรายการเช่า" }, { status: 400 });
    const db = getDb();
    const [record] = await db.select().from(rentals).where(eq(rentals.id, id)).limit(1);
    if (!record) return NextResponse.json({ message: "ไม่พบรายการเช่า" }, { status: 404 });
    if (action === "EDIT") {
      const renterName = String(input.renterName ?? "").trim(); const startDate = String(input.startDate ?? "").trim(); const approver = String(input.approver ?? "").trim();
      const rentalMode = String(input.rentalMode ?? ""); const rateType = String(input.rateType ?? ""); const rateAmount = Number(input.rateAmount); const duration = Number(input.duration);
      if (!renterName || !approver || !["W", "M"].includes(rentalMode) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !rateTypes.has(rateType) || !Number.isInteger(duration) || duration <= 0 || !Number.isFinite(rateAmount) || rateAmount < 0) return NextResponse.json({ message: "กรุณากรอกข้อมูลการเช่าให้ครบและถูกต้อง" }, { status: 400 });
      if (record.returnedDate && startDate > record.returnedDate) return NextResponse.json({ message: "วันเริ่มเช่าต้องไม่หลังวันที่รับคืน" }, { status: 400 });
      if (!validDate(startDate)) return NextResponse.json({ message: "วันที่เริ่มเช่าไม่ถูกต้อง" }, { status: 400 });
      const [machine] = await db.select().from(machineries).where(eq(machineries.code, record.machineryCode)).limit(1);
      if (!machine) return NextResponse.json({ message: "ไม่พบเครื่องจักร" }, { status: 404 });
      const typedRate = rateType as RateType;
      // Keep a saved historical rate when only non-pricing fields or duration change.
      const samePricing = startDate === record.startDate && rateType === record.rateType && rentalMode === record.rentalMode;
      const effectiveRateAmount = rentalMode === "M" ? 0 : samePricing ? record.rateAmount : rentalRate(machine, typedRate, startDate);
      if (effectiveRateAmount === null) return NextResponse.json({ message: "ไม่มีอัตราค่าเช่าสำหรับหน่วยหรือวันที่เลือก" }, { status: 400 });
      const now = new Date().toISOString();
      const updates = { renterName, startDate, expectedReturnDate: calculateEndDate(startDate, duration, typedRate), duration, rentalMode: rentalMode as "W" | "M", rateType: typedRate, rateAmount: effectiveRateAmount, totalAmount: duration * effectiveRateAmount, approver, note: String(input.note ?? "").trim() || null, updatedAt: now };
      await db.update(rentals).set(updates).where(eq(rentals.id, id));
      return NextResponse.json({ ...record, ...updates });
    }
    const returnedDate = String(input.returnedDate ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(returnedDate)) return NextResponse.json({ message: "วันที่คืนไม่ถูกต้อง" }, { status: 400 });
    if (record.status !== "ACTIVE") return NextResponse.json({ message: "รายการนี้คืนเครื่องแล้ว" }, { status: 409 });
    if (returnedDate < record.startDate) return NextResponse.json({ message: "วันที่คืนต้องไม่ก่อนวันเริ่มเช่า" }, { status: 400 });
    const now = new Date().toISOString();
    await db.update(rentals).set({ returnedDate, status: "RETURNED", updatedAt: now }).where(eq(rentals.id, id));
    return NextResponse.json({ message: "รับคืนเครื่องจักรเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Unable to return rental", error);
    return NextResponse.json({ message: "ไม่สามารถรับคืนเครื่องจักรได้" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureDisposalSchema(); const input = await request.json() as Record<string, unknown>; const id = String(input.id ?? "").trim();
    if (!id) return NextResponse.json({ message: "ไม่พบรหัสรายการเช่า" }, { status: 400 });
    const db = getDb(); const [record] = await db.select().from(rentals).where(eq(rentals.id, id)).limit(1);
    if (!record) return NextResponse.json({ message: "ไม่พบรายการเช่า" }, { status: 404 });
    await db.delete(rentals).where(eq(rentals.id, id));
    return NextResponse.json({ message: "ลบรายการเช่าเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Unable to delete rental", error);
    return NextResponse.json({ message: "ไม่สามารถลบรายการเช่าได้" }, { status: 500 });
  }
}
