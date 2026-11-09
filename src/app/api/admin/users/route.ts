import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { execute, queryMany } from "@/lib/db";
import { mailStatus } from "@/lib/mail";
import { hashPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: "Inte inloggad.", status: 401 } as const;
  if (user.role !== "admin") return { error: "Kräver adminbehörighet.", status: 403 } as const;
  return { user } as const;
}

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const users = await queryMany(
    `SELECT u.id, u.email, u.role, u.verified, u.display_name AS "displayName",
            u.created_at AS "createdAt", u.last_login_at AS "lastLoginAt",
            (SELECT count(*) FROM flashcards f WHERE f.user_id = u.id)::int AS cards,
            (SELECT count(*) FROM review_logs r WHERE r.user_id = u.id)::int AS reviews,
            (SELECT count(*) FROM game_attempts g WHERE g.user_id = u.id)::int AS games,
            COALESCE((SELECT sum(points) FROM daily_activity d WHERE d.user_id = u.id), 0)::int AS points
       FROM users u
      ORDER BY u.created_at ASC`,
  );

  const totals = await queryMany<{ key: string; value: number }>(
    `SELECT 'courses' AS key, count(*)::int AS value FROM courses
     UNION ALL SELECT 'chapters', count(*)::int FROM chapters
     UNION ALL SELECT 'recall', count(*)::int FROM recall_items
     UNION ALL SELECT 'cards', count(*)::int FROM chapter_cards
     UNION ALL SELECT 'documents', count(*)::int FROM docs`,
  );

  return NextResponse.json({ users, totals, mail: await mailStatus() });
}

export async function PATCH(req: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { userId, role } = (await req.json().catch(() => ({}))) as {
    userId?: string;
    role?: "student" | "admin";
  };
  if (!userId || !role || !["student", "admin"].includes(role)) {
    return NextResponse.json({ error: "userId och role krävs." }, { status: 400 });
  }
  if (userId === check.user.id && role !== "admin") {
    return NextResponse.json({ error: "Du kan inte ta bort din egen adminroll." }, { status: 400 });
  }

  await execute(`UPDATE users SET role = $1, updated_at = now() WHERE id = $2`, [role, userId]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs." }, { status: 400 });

  if (id === check.user.id) {
    return NextResponse.json({ error: "Du kan inte ta bort ditt eget konto." }, { status: 400 });
  }

  const target = await queryMany<{ email: string; role: string }>(
    `SELECT email, role FROM users WHERE id = $1`,
    [id],
  );
  if (target.length === 0) {
    return NextResponse.json({ error: "Användaren finns inte." }, { status: 404 });
  }

  // Skydda sista admin-kontot
  if (target[0].role === "admin") {
    const admins = await queryMany<{ n: number }>(
      `SELECT count(*)::int AS n FROM users WHERE role = 'admin'`,
    );
    if ((admins[0]?.n ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Kan inte ta bort det sista admin-kontot." },
        { status: 400 },
      );
    }
  }

  await execute(`DELETE FROM users WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true, deleted: target[0].email });
}

/** Admin skapar ett konto (registreringen är stängd på publika servrar). */
export async function POST(req: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const rl = rateLimit(`admin-create:${clientIp(req)}`, 20, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "För många konton skapade nyligen. Vänta en stund." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { email, password: given } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  const normalized = (email ?? "").toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
    return NextResponse.json({ error: "Ogiltig e-postadress." }, { status: 400 });
  }

  const exists = await queryMany<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [
    normalized,
  ]);
  if (exists.length > 0) {
    return NextResponse.json({ error: "Det finns redan ett konto med den adressen." }, { status: 409 });
  }

  // Engångslösen om admin inte anger ett eget
  let password = (given ?? "").trim();
  let generated = false;
  if (!password) {
    const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(14));
    password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    generated = true;
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Lösenordet måste vara minst 8 tecken." }, { status: 400 });
  }

  const hash = await hashPassword(password);
  await execute(
    `INSERT INTO users (email, password_hash, role, verified) VALUES ($1, $2, 'student', true)`,
    [normalized, hash],
  );
  await execute(
    `INSERT INTO admin_audit (actor_email, action, target_email) VALUES ($1, 'create_user', $2)`,
    [check.user.email, normalized],
  );

  // Lösenordet returneras en gång (om det genererades) – lagras bara som hash.
  return NextResponse.json({ ok: true, email: normalized, password: generated ? password : null });
}
