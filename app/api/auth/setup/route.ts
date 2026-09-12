import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { ensureAuthSchema } from "../../../../db";
import { createSession, hashPassword, sessionCookie } from "../../../../lib/auth";

export async function POST(request: Request) {
  await ensureAuthSchema();
  const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  if (Number(existing?.count ?? 0) > 0) return NextResponse.json({ message: "ระบบถูกตั้งค่าแล้ว" }, { status: 409 });
  const input = await request.json() as Record<string, unknown>;
  const username = String(input.username ?? "").trim().toLowerCase(); const displayName = String(input.displayName ?? "").trim(); const password = String(input.password ?? "");
  if (!/^[a-z0-9._-]{4,40}$/.test(username) || !displayName || password.length < 8) return NextResponse.json({ message: "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษอย่างน้อย 4 ตัว และรหัสผ่านอย่างน้อย 8 ตัว" }, { status: 400 });
  const { hash, salt } = await hashPassword(password); const now = new Date().toISOString(); const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (id, username, display_name, password_hash, password_salt, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ADMIN', 1, ?, ?)")
    .bind(id, username, displayName, hash, salt, now, now).run();
  const session = await createSession(id); const response = NextResponse.json({ id, username, displayName, role: "ADMIN" }, { status: 201 });
  response.headers.set("set-cookie", sessionCookie(session.token, session.maxAge)); return response;
}
