import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureTransferSchema, getDb } from "../../../db";
import { machineries, transferRecords } from "../../../db/schema";
import { registryVisibilitySql } from "../../../db/disposal-sql.mjs";
import { requireUser } from "../../../lib/auth";
import { transferVersion, validateTransfer } from "../../../lib/transfers.mjs";

function failure(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ message: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  console.error("Transfer request failed", error);
  return NextResponse.json({ message: "ไม่สามารถดำเนินการข้อมูลขนย้ายได้ กรุณาลองใหม่" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureTransferSchema();
    const records = await getDb().select().from(transferRecords).orderBy(desc(transferRecords.transferDate), desc(transferRecords.createdAt));
    return NextResponse.json(records.map(row => ({ id: row.id, transferDate: row.transferDate, createdAt: row.createdAt, version: transferVersion(row), transporters: JSON.parse(row.transportersJson), items: JSON.parse(row.itemsJson) })));
  } catch (error) { return failure(error); }
}

async function change(request: Request, deleting: boolean) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    const input = await request.json();
    if (!input || typeof input.id !== "string" || !input.id.trim() || typeof input.version !== "string" || !input.version) return NextResponse.json({ message: "กรุณาระบุรายการขนย้ายและโหลดข้อมูลล่าสุดก่อนดำเนินการ" }, { status: 400 });
    await ensureTransferSchema();
    const db = getDb();
    const [existing] = await db.select().from(transferRecords).where(eq(transferRecords.id, input.id)).limit(1);
    if (!existing) return NextResponse.json({ message: "ไม่พบรายการขนย้าย อาจถูกลบแล้ว กรุณาโหลดข้อมูลใหม่" }, { status: 404 });
    const conflict = () => NextResponse.json({ message: "รายการนี้มีการเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่ก่อนแก้ไขหรือลบ" }, { status: 409 });
    if (input.version !== transferVersion(existing)) return conflict();
    // Match the entire saved state so a concurrent edit cannot be overwritten or deleted.
    const unchanged = and(eq(transferRecords.id, existing.id), eq(transferRecords.transferDate, existing.transferDate), eq(transferRecords.transportersJson, existing.transportersJson), eq(transferRecords.itemsJson, existing.itemsJson));
    if (deleting) {
      const removed = await db.delete(transferRecords).where(unchanged).returning({ id: transferRecords.id });
      if (!removed.length) return conflict();
      return NextResponse.json({ message: "ลบรายการขนย้ายแล้ว" });
    }
    const machines = await db.select({ code: machineries.code, typeCode: machineries.typeCode, currentDepartment: machineries.currentDepartment }).from(machineries).where(sql.raw(registryVisibilitySql));
    // Allow existing historical references even if machinery was later disposed or a department renamed.
    const previous = { transporters: JSON.parse(existing.transportersJson), items: JSON.parse(existing.itemsJson) };
    const validation = validateTransfer(input, machines, previous);
    if (validation.error || !validation.record) return NextResponse.json({ message: validation.error }, { status: 400 });
    const record = validation.record;
    const updated = await db.update(transferRecords).set({ transferDate: record.transferDate, transportersJson: JSON.stringify(record.transporters), itemsJson: JSON.stringify(record.items) }).where(unchanged).returning({ id: transferRecords.id });
    if (!updated.length) return conflict();
    return NextResponse.json({ id: existing.id, message: "แก้ไขรายการขนย้ายแล้ว" });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) { return change(request, false); }
export async function DELETE(request: Request) { return change(request, true); }

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    const input = await request.json();
    await ensureTransferSchema();
    const db = getDb();
    const machines = await db.select({ code: machineries.code, typeCode: machineries.typeCode, currentDepartment: machineries.currentDepartment }).from(machineries).where(sql.raw(registryVisibilitySql));
    const validation = validateTransfer(input, machines);
    if (validation.error || !validation.record) return NextResponse.json({ message: validation.error }, { status: 400 });
    const record = validation.record;
    const id = crypto.randomUUID();
    // One row holds the whole trip: all transporters and item-specific locations save atomically.
    await db.insert(transferRecords).values({ id, transferDate: record.transferDate, transportersJson: JSON.stringify(record.transporters), itemsJson: JSON.stringify(record.items), createdBy: auth.user.id, createdAt: new Date().toISOString() });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return failure(error); }
}
