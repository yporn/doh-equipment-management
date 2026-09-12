import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { ensureAuthSchema } from "../../../db";
import { hashPassword, requireUser } from "../../../lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser(request, "ADMIN"); if (auth.response) return auth.response;
  return NextResponse.json((await env.DB.prepare("SELECT id, username, display_name AS displayName, role, active, created_at AS createdAt FROM users ORDER BY active DESC, display_name").all()).results);
}

export async function POST(request: Request) {
  const auth = await requireUser(request, "ADMIN"); if (auth.response) return auth.response; await ensureAuthSchema();
  const input = await request.json() as Record<string, unknown>; const username = String(input.username ?? "").trim().toLowerCase(); const displayName = String(input.displayName ?? "").trim(); const password = String(input.password ?? ""); const role = String(input.role ?? "");
  if (!/^[a-z0-9._-]{4,40}$/.test(username) || !displayName || password.length < 8 || !["ADMIN", "STAFF"].includes(role)) return NextResponse.json({ message: "กรุณากรอกข้อมูลให้ถูกต้อง รหัสผ่านอย่างน้อย 8 ตัว" }, { status: 400 });
  const { hash, salt } = await hashPassword(password); const now = new Date().toISOString();
  try { await env.DB.prepare("INSERT INTO users (id, username, display_name, password_hash, password_salt, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(crypto.randomUUID(), username, displayName, hash, salt, role, now, now).run(); }
  catch { return NextResponse.json({ message: "ชื่อผู้ใช้นี้มีอยู่แล้ว" }, { status: 409 }); }
  return NextResponse.json({ message: "เพิ่มบัญชีเรียบร้อยแล้ว" }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser(request, "ADMIN"); if (auth.response) return auth.response;
  const input = await request.json() as Record<string, unknown>; const id = String(input.id ?? ""); const active = input.active === true ? 1 : 0;
  if (!id || id === auth.user?.id) return NextResponse.json({ message: "ไม่สามารถปิดบัญชีที่กำลังใช้งานอยู่" }, { status: 400 });
  await env.DB.prepare("UPDATE users SET active = ?, updated_at = ? WHERE id = ?").bind(active, new Date().toISOString(), id).run();
  if (!active) await env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(id).run();
  return NextResponse.json({ message: "อัปเดตบัญชีเรียบร้อยแล้ว" });
}
