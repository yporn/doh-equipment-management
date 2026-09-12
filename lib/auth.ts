import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { ensureAuthSchema } from "../db";

export type AuthUser = { id: string; username: string; displayName: string; role: "ADMIN" | "STAFF" };
const encoder = new TextEncoder();
const SESSION_COOKIE = "doh_session";

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
  return { hash: bytesToBase64(new Uint8Array(bits)), salt: bytesToBase64(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  const candidate = await hashPassword(password, base64ToBytes(salt));
  const left = encoder.encode(candidate.hash); const right = encoder.encode(hash);
  if (left.length !== right.length) return false;
  let difference = 0; for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function sha256(value: string) {
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

function cookieValue(request: Request, name: string) {
  const match = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  await ensureAuthSchema();
  const token = cookieValue(request, SESSION_COOKIE); if (!token || !env.DB) return null;
  const row = await env.DB.prepare(`SELECT u.id, u.username, u.display_name AS displayName, u.role
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1 LIMIT 1`)
    .bind(await sha256(token), new Date().toISOString()).first<AuthUser>();
  return row ?? null;
}

export async function requireUser(request: Request, role?: "ADMIN") {
  const user = await getCurrentUser(request);
  if (!user) return { user: null, response: NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  if (role && user.role !== role) return { user, response: NextResponse.json({ message: "คุณไม่มีสิทธิ์ดำเนินการนี้" }, { status: 403 }) };
  return { user, response: null };
}

export async function createSession(userId: string) {
  await ensureAuthSchema(); if (!env.DB) throw new Error("Database unavailable");
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date(); const expires = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  await env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(now.toISOString()).run();
  await env.DB.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, await sha256(token), expires.toISOString(), now.toISOString()).run();
  return { token, maxAge: 8 * 60 * 60 };
}

export async function deleteSession(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE); if (!token || !env.DB) return;
  await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

export function sessionCookie(token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
