import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureRentalPlanSchema, getDb } from "../../../db";
import { rentalPlans } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request); if (auth.response) return auth.response;
    await ensureRentalPlanSchema();
    const rows = await getDb().select().from(rentalPlans);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Unable to list rental plans", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดข้อมูลแผนค่าเช่าได้" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireUser(request, "ADMIN"); if (auth.response) return auth.response;
    await ensureRentalPlanSchema();
    const input = await request.json() as Record<string, unknown>;
    const department = String(input.department ?? "").trim();
    const fiscalYear = Number(input.fiscalYear);
    const planAmount = Number(input.planAmount);
    if (!department || !Number.isInteger(fiscalYear) || !Number.isFinite(planAmount) || planAmount < 0) {
      return NextResponse.json({ message: "กรุณาระบุหน่วยงาน ปีงบประมาณ และแผนค่าเช่าให้ถูกต้อง" }, { status: 400 });
    }
    const db = getDb();
    const now = new Date().toISOString();
    const [existing] = await db.select().from(rentalPlans)
      .where(and(eq(rentalPlans.department, department), eq(rentalPlans.fiscalYear, fiscalYear))).limit(1);
    if (existing) {
      await db.update(rentalPlans).set({ planAmount, updatedAt: now }).where(eq(rentalPlans.id, existing.id));
      return NextResponse.json({ ...existing, planAmount, updatedAt: now });
    }
    const record = { id: crypto.randomUUID(), department, fiscalYear, planAmount, createdAt: now, updatedAt: now };
    await db.insert(rentalPlans).values(record);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Unable to save rental plan", error);
    return NextResponse.json({ message: "ไม่สามารถบันทึกแผนค่าเช่าได้" }, { status: 500 });
  }
}
