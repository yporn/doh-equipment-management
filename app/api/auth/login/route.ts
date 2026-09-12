import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { createSession, sessionCookie, verifyPassword } from "../../../../lib/auth";
import { ensureAuthSchema } from "../../../../db";

type UserRow = { id: string; username: string; displayName: string; passwordHash: string; passwordSalt: string; role: "ADMIN" | "STAFF"; active: number };
export async function POST(request: Request) {
  await ensureAuthSchema(); const input = await request.json() as Record<string, unknown>;
  const username = String(input.username ?? "").trim().toLowerCase(); const password = String(input.password ?? "");
  const user = await env.DB.prepare("SELECT id, username, display_name AS displayName, password_hash AS passwordHash, password_salt AS passwordSalt, role, active FROM users WHERE username = ? LIMIT 1").bind(username).first<UserRow>();
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash, user.passwordSalt))) return NextResponse.json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  const session = await createSession(user.id); const response = NextResponse.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role });
  response.headers.set("set-cookie", sessionCookie(session.token, session.maxAge)); return response;
}
