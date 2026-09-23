import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureCentralAllocationSchema, getDb } from "../../../db";
import { centralRentalAllocations } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";
import { FISCAL_MONTHS } from "../../../lib/rental-plan.mjs";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureCentralAllocationSchema();
    const rows = await getDb().select().from(centralRentalAllocations);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Unable to list central rental allocations", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดข้อมูลการจัดสรรค่าเช่าส่วนกลางได้" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireUser(request, "ADMIN"); if (auth.response) return auth.response;
    await ensureCentralAllocationSchema();
    const input = await request.json() as Record<string, unknown>;
    const fiscalYear = Number(input.fiscalYear);
    const month = String(input.month ?? "");
    const project = String(input.project ?? "").trim();
    if (!Number.isInteger(fiscalYear) || !FISCAL_MONTHS.includes(month) || !project) {
      return NextResponse.json({ message: "กรุณาระบุปีงบประมาณ เดือน และโครงการให้ถูกต้อง" }, { status: 400 });
    }
    const db = getDb();
    const now = new Date().toISOString();
    const [existing] = await db.select().from(centralRentalAllocations)
      .where(and(eq(centralRentalAllocations.fiscalYear, fiscalYear), eq(centralRentalAllocations.month, month)))
      .limit(1);
    if (existing) {
      await db.update(centralRentalAllocations).set({ project, updatedAt: now }).where(eq(centralRentalAllocations.id, existing.id));
      return NextResponse.json({ ...existing, project, updatedAt: now });
    }
    const record = { id: crypto.randomUUID(), fiscalYear, month, project, createdAt: now, updatedAt: now };
    await db.insert(centralRentalAllocations).values(record);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Unable to save central rental allocation", error);
    return NextResponse.json({ message: "ไม่สามารถบันทึกการจัดสรรค่าเช่าส่วนกลางได้" }, { status: 500 });
  }
}
