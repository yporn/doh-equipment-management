import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { ensureAuthSchema } from "../../../../db";

export async function GET() {
  await ensureAuthSchema();
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  return NextResponse.json({ setupRequired: Number(row?.count ?? 0) === 0 });
}
