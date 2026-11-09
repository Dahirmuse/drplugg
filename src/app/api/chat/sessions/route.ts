import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { execute, queryMany, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const sessions = await queryMany<{
    id: string;
    title: string;
    mode: string;
    chapterId: string | null;
    updatedAt: string;
    messageCount: number;
  }>(
    `SELECT s.id, s.title, s.mode, s.chapter_id AS "chapterId", s.updated_at AS "updatedAt",
            (SELECT count(*) FROM messages m WHERE m.session_id = s.id)::int AS "messageCount"
       FROM chat_sessions s
      WHERE s.user_id = $1
      ORDER BY s.updated_at DESC
      LIMIT 60`,
    [user.id],
  );

  return NextResponse.json({ sessions });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const { id, title } = (await req.json().catch(() => ({}))) as { id?: string; title?: string };
  if (!id || !title?.trim()) {
    return NextResponse.json({ error: "id och titel krävs." }, { status: 400 });
  }
  await execute(`UPDATE chat_sessions SET title = $1 WHERE id = $2 AND user_id = $3`, [
    title.trim().slice(0, 120),
    id,
    user.id,
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs." }, { status: 400 });

  const owned = await queryOne<{ id: string }>(
    `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!owned) return NextResponse.json({ error: "Sessionen finns inte." }, { status: 404 });

  await execute(`DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2`, [id, user.id]);
  return NextResponse.json({ ok: true });
}
