import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { execute, queryOne } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin återställer en användares lösenord.
 * Lösenordet genereras, returneras EN gång och lagras endast som bcrypt-hash.
 */
export async function POST(req: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  if (actor.role !== "admin") {
    return NextResponse.json({ error: "Kräver adminbehörighet." }, { status: 403 });
  }

  const rl = rateLimit(`admin-reset:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "För många återställningar. Vänta en stund." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "userId krävs." }, { status: 400 });

  const target = await queryOne<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE id = $1`,
    [userId],
  );
  if (!target) return NextResponse.json({ error: "Användaren finns inte." }, { status: 404 });

  // Engångslösen: 4 block, lätt att läsa upp men starkt nog (A-Z a-z 0-9)
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");

  const hash = await hashPassword(password);
  await execute(
    `UPDATE users SET password_hash = $1, verified = true, updated_at = now() WHERE id = $2`,
    [hash, target.id],
  );
  await execute(
    `INSERT INTO admin_audit (actor_email, action, target_email) VALUES ($1, $2, $3)`,
    [actor.email, "reset_password", target.email],
  );

  // Lösenordet skickas tillbaka en enda gång – loggas eller sparas aldrig i klartext.
  return NextResponse.json({ ok: true, email: target.email, password });
}

// bcrypt importeras för att vara tydlig med att hashen kommer därifrån.
void bcrypt;
