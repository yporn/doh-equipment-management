import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDisposalSchema, getDb } from "../../../db";
import { machineries, repairRecords } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";

const validStatuses = new Set(["WAITING", "WAITING_PARTS", "IN_PROGRESS", "COMPLETED"]);
const validRepairTypes = new Set(["SELF", "OUTSOURCED"]);
const validSystems = new Set(["ระบบช่วงล่าง", "ระบบเชื้อเพลิง", "ระบบไฟฟ้า", "ระบบไฮดรอลิค", "ระบบเครื่องยนต์", "ระบบส่งกำลัง", "ระบบเบรก", "ระบบบังคับเลี้ยว", "ตัวถัง/โครงสร้าง", "อื่น ๆ"]);
type RepairStatus = "WAITING" | "WAITING_PARTS" | "IN_PROGRESS" | "COMPLETED";
type RepairType = "SELF" | "OUTSOURCED";

function parseList(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}


export async function GET(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureDisposalSchema();
    const rows = await getDb().select({
      id: repairRecords.id, machineryCode: repairRecords.machineryCode, machineryName: machineries.name,
      repairDate: repairRecords.repairDate, workSystemsJson: repairRecords.workSystemsJson,
      repairType: repairRecords.repairType,
      symptom: repairRecords.symptom, cause: repairRecords.cause, repairDetails: repairRecords.repairDetails,
      reporter: repairRecords.reporter, responsiblePerson: repairRecords.responsiblePerson, provider: repairRecords.provider,
      partsJson: repairRecords.partsJson, totalCost: repairRecords.totalCost, status: repairRecords.status,
      completedDate: repairRecords.completedDate, note: repairRecords.note, createdAt: repairRecords.createdAt,
    }).from(repairRecords).leftJoin(machineries, eq(repairRecords.machineryCode, machineries.code))
      .orderBy(desc(repairRecords.repairDate), desc(repairRecords.createdAt));
    return NextResponse.json(rows.map((row) => ({ ...row, workSystems: JSON.parse(row.workSystemsJson), parts: JSON.parse(row.partsJson) })));
  } catch (error) {
    console.error("Unable to list repairs", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดข้อมูลงานซ่อมได้" }, { status: 500 });
  }
}

async function validate(input: Record<string, unknown>) {
  const machineryCode = String(input.machineryCode ?? "").trim();
  const repairDate = String(input.repairDate ?? "").trim();
  const requestedCompletedDate = String(input.completedDate ?? "").trim();
  const workSystems = parseList(input.workSystems);
  const reporter = String(input.reporter ?? "").trim();
  const requestedStatus = String(input.status ?? "WAITING") as RepairStatus;
  const repairType = String(input.repairType ?? "") as RepairType;
  if (!machineryCode || !/^\d{4}-\d{2}-\d{2}$/.test(repairDate) || !workSystems.length || workSystems.some((item) => !validSystems.has(item)) || !reporter || !validStatuses.has(requestedStatus) || !validRepairTypes.has(repairType)) return null;
  if (requestedCompletedDate && (!/^\d{4}-\d{2}-\d{2}$/.test(requestedCompletedDate) || requestedCompletedDate < repairDate)) return null;
  if (!requestedCompletedDate && requestedStatus === "COMPLETED") return null;
  const status: RepairStatus = requestedCompletedDate ? "COMPLETED" : requestedStatus;
  return { machineryCode, repairDate, workSystems, repairType, reporter, status, completedDate: requestedCompletedDate || null };
}

async function isMachineryDepartment(department: string) {
  return (await getDb().select({ id: machineries.id }).from(machineries).where(eq(machineries.currentDepartment, department)).limit(1)).length > 0;
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureDisposalSchema(); const input = await request.json() as Record<string, unknown>; const valid = await validate(input);
    if (!valid) return NextResponse.json({ message: "กรุณากรอกข้อมูลงานซ่อมที่จำเป็นให้ครบและถูกต้อง" }, { status: 400 });
    const db = getDb();
    if (!(await db.select({ id: machineries.id }).from(machineries).where(eq(machineries.code, valid.machineryCode)).limit(1)).length) return NextResponse.json({ message: "ไม่พบเครื่องจักรที่เลือก" }, { status: 404 });
    if (!(await isMachineryDepartment(valid.reporter))) return NextResponse.json({ message: "กรุณาเลือกผู้แจ้งจากหน่วยงานในบัญชีเครื่องจักร" }, { status: 400 });
    const now = new Date().toISOString();
    const record = { id: crypto.randomUUID(), machineryCode: valid.machineryCode, repairDate: valid.repairDate,
      workSystemsJson: JSON.stringify(valid.workSystems), repairType: valid.repairType, symptom: "", cause: null,
      repairDetails: String(input.repairDetails ?? "").trim() || null, reporter: valid.reporter,
      responsiblePerson: null, provider: null,
      partsJson: "[]", totalCost: 0, status: valid.status,
      completedDate: valid.completedDate,
      note: String(input.note ?? "").trim() || null, createdAt: now, updatedAt: now };
    await db.insert(repairRecords).values(record);
    return NextResponse.json(record, { status: 201 });
  } catch (error) { console.error("Unable to create repair", error); return NextResponse.json({ message: "ไม่สามารถบันทึกงานซ่อมได้" }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureDisposalSchema(); const input = await request.json() as Record<string, unknown>; const id = String(input.id ?? "");
    if (!id) return NextResponse.json({ message: "ข้อมูลงานซ่อมไม่ถูกต้อง" }, { status: 400 });
    const db = getDb(); const [previous] = await db.select().from(repairRecords).where(eq(repairRecords.id, id)).limit(1);
    if (!previous) return NextResponse.json({ message: "ไม่พบงานซ่อม" }, { status: 404 });
    const valid = await validate(input);
    if (!valid) return NextResponse.json({ message: "ข้อมูลงานซ่อมไม่ถูกต้อง" }, { status: 400 });
    if (!(await isMachineryDepartment(valid.reporter))) return NextResponse.json({ message: "กรุณาเลือกผู้แจ้งจากหน่วยงานในบัญชีเครื่องจักร" }, { status: 400 });
    const updates = { machineryCode: valid.machineryCode, repairDate: valid.repairDate, workSystemsJson: JSON.stringify(valid.workSystems),
      repairType: valid.repairType, repairDetails: String(input.repairDetails ?? "").trim() || null,
      reporter: valid.reporter, status: valid.status,
      completedDate: valid.completedDate,
      note: String(input.note ?? "").trim() || null, updatedAt: new Date().toISOString() };
    await db.update(repairRecords).set(updates).where(eq(repairRecords.id, id));
    return NextResponse.json({ ...previous, ...updates });
  } catch (error) { console.error("Unable to update repair", error); return NextResponse.json({ message: "ไม่สามารถแก้ไขงานซ่อมได้" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureDisposalSchema(); const input = await request.json() as Record<string, unknown>; const id = String(input.id ?? ""); const db = getDb();
    const [record] = await db.select().from(repairRecords).where(eq(repairRecords.id, id)).limit(1);
    if (!record) return NextResponse.json({ message: "ไม่พบงานซ่อม" }, { status: 404 });
    await db.delete(repairRecords).where(eq(repairRecords.id, id));
    return NextResponse.json({ message: "ลบงานซ่อมเรียบร้อยแล้ว" });
  } catch (error) { console.error("Unable to delete repair", error); return NextResponse.json({ message: "ไม่สามารถลบงานซ่อมได้" }, { status: 500 }); }
}
