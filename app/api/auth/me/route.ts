import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
export async function GET(request: Request) { const user = await getCurrentUser(request); return user ? NextResponse.json(user) : NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401 }); }
