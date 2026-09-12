import { NextResponse } from "next/server";
import { clearSessionCookie, deleteSession } from "../../../../lib/auth";
export async function POST(request: Request) { await deleteSession(request); const response = NextResponse.json({ message: "ออกจากระบบแล้ว" }); response.headers.set("set-cookie", clearSessionCookie()); return response; }
