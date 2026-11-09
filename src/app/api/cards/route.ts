import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryMany } from "@/lib/db";
import { createCard, reviewCard } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Listar användarens kort (valfritt filtrerat på kapitel). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const chapterId = new URL(req.url).searchParams.get("chapterId");
  const cards = await queryMany(
    `SELECT id, chapter_id AS "chapterId", front, back, origin, due, state, reps,
            scheduled_days AS "scheduledDays"
       FROM flashcards
      WHERE user_id = $1 AND ($2::text IS NULL OR chapter_id = $2)
      ORDER BY due ASC LIMIT 200`,
    [user.id, chapterId],
  );

  return NextResponse.json({ cards });
}

/** Skapar ett kort – och schemalägger det direkt om ett betyg skickas med. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    chapterId?: string | null;
    front?: string;
    back?: string;
    rating?: number;
    origin?: string;
  };

  if (!body.front?.trim() || !body.back?.trim()) {
    return NextResponse.json({ error: "front och back krävs." }, { status: 400 });
  }

  try {
    const card = await createCard(user.id, {
      chapterId: body.chapterId ?? null,
      front: body.front.trim(),
      back: body.back.trim(),
      origin: body.origin ?? "egen",
    });

    if (body.rating && [1, 2, 3, 4].includes(body.rating)) {
      await reviewCard(user.id, card.id, body.rating as 1 | 2 | 3 | 4, { source: "ai" });
    }

    return NextResponse.json({ card });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
