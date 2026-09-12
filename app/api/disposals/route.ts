import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDisposalSchema, getDb } from "../../../db";
import { disposalRecords, machineries } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";
import { validateDisposal } from "../../../lib/disposals.mjs";

function failure(error: unknown) {
  const detail = String(error) + String((error as { cause?: unknown })?.cause ?? "");
  const messages: Record<string, string> = {
    DISPOSAL_MACHINE_MISSING: "ไม่พบเครื่องจักรที่เลือก",
    DISPOSAL_RENTED: "เครื่องจักรยังเช่า/ขอใช้งานอยู่ กรุณารับคืนก่อนเสนอจำหน่าย",
    DISPOSAL_ALREADY_APPROVED: "เครื่องจักรนี้อนุมัติจำหน่ายแล้ว กรุณาบันทึกข้อมูลอนุมัติให้ครบ",
    DISPOSAL_LOCKED: "รายการนี้ไม่สามารถแก้ไขหรือย้อนสถานะได้ รายการอนุมัติแล้วให้ใช้ปุ่มจำหน่ายแล้ว",
    DISPOSAL_INVALID_STATUS: "ไม่สามารถเปลี่ยนเครื่องจักรหรือสถานะนี้ได้",
    "UNIQUE constraint": "เครื่องจักรนี้มีรายการจำหน่ายแล้ว กรุณาเปิดรายการเดิม",
  };
  for (const [key, message] of Object.entries(messages)) if (detail.includes(key)) return NextResponse.json({ message }, { status: 409 });
  if (error instanceof SyntaxError) return NextResponse.json({ message: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  console.error("Disposal request failed", error);
  return NextResponse.json({ message: "ไม่สามารถดำเนินการรายการจำหน่ายได้ กรุณาลองใหม่" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureDisposalSchema();
    return NextResponse.json(await getDb().select({ ...getTableColumns(disposalRecords), machineryName: machineries.name, currentDepartment: machineries.currentDepartment, machinery: getTableColumns(machineries) })
      .from(disposalRecords).leftJoin(machineries, eq(disposalRecords.machineryCode, machineries.code))
      .orderBy(desc(disposalRecords.proposedDate), desc(disposalRecords.createdAt)));
  } catch (error) { return failure(error); }
}

async function save(request: Request, editing: boolean) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    if (editing && input.action === "DISPOSE") {
      if (typeof input.id !== "string" || !input.id.trim()) return NextResponse.json({ message: "กรุณาระบุรายการจำหน่าย" }, { status: 400 });
      await ensureDisposalSchema();
      const [record] = await getDb().update(disposalRecords).set({ status: "DISPOSED", updatedAt: new Date().toISOString(), updatedBy: auth.user!.id })
        .where(and(eq(disposalRecords.id, input.id), eq(disposalRecords.status, "DISPOSAL_APPROVED"))).returning();
      if (!record) return NextResponse.json({ message: "ไม่พบรายการที่อนุมัติจำหน่าย หรือรายการถูกเปลี่ยนสถานะแล้ว กรุณาโหลดข้อมูลใหม่" }, { status: 409 });
      return NextResponse.json(record);
    }
    const parsed = validateDisposal(input);
    if (!parsed.record) return NextResponse.json({ message: parsed.error }, { status: 400 });
    await ensureDisposalSchema();
    const db = getDb(); const now = new Date().toISOString();
    const values = { ...parsed.record, status: parsed.record.status as "AWAITING_DISPOSAL" | "DISPOSAL_APPROVED",
      approvalDate: parsed.record.approvalDate || null,
      note: parsed.record.note || null, updatedBy: auth.user!.id, updatedAt: now };
    if (editing) {
      const id = typeof input.id === "string" ? input.id : "";
      const [record] = await db.update(disposalRecords).set(values).where(eq(disposalRecords.id, id)).returning();
      if (!record) return NextResponse.json({ message: "ไม่พบรายการจำหน่าย" }, { status: 404 });
      return NextResponse.json(record);
    }
    // Retain legacy columns for existing records; they are no longer requested in the form.
    const [record] = await db.insert(disposalRecords).values({ ...values, documentNumber: "", approvalDocument: null, approver: null, id: crypto.randomUUID(), createdAt: now, createdBy: auth.user!.id }).returning();
    return NextResponse.json(record, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    const input = await request.json();
    if (!input || typeof input.id !== "string" || !input.id.trim() || typeof input.updatedAt !== "string" || !input.updatedAt.trim()) return NextResponse.json({ message: "กรุณาระบุรายการที่ต้องการลบ" }, { status: 400 });
    await ensureDisposalSchema();
    // The delete trigger restores the machinery in the same atomic statement.
    const [removed] = await getDb().delete(disposalRecords)
      .where(and(eq(disposalRecords.id, input.id), eq(disposalRecords.updatedAt, input.updatedAt))).returning({ id: disposalRecords.id });
    if (!removed) return NextResponse.json({ message: "รายการถูกแก้ไขหรือลบไปแล้ว กรุณาโหลดข้อมูลใหม่ก่อนลบ" }, { status: 409 });
    return NextResponse.json({ message: "ลบรายการจำหน่ายและคืนเครื่องจักรเข้าบัญชีแล้ว" });
  } catch (error) { return failure(error); }
}
