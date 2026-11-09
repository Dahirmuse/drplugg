import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryMany } from "@/lib/db";
import { quizQuestions } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Frågor till spelen.
 *  ?game=blixtquiz|diagnosduellen|dagsutmaning  ?chapterId=…  ?limit=10
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const url = new URL(req.url);
  const chapterId = url.searchParams.get("chapterId");
  const courseId = url.searchParams.get("courseId");
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || 10)));

  if (url.searchParams.get("kind") === "match") {
    const pairs = await queryMany<{ id: string; front: string; back: string; chapterTitle: string }>(
      `SELECT cc.id, cc.front, cc.back, ch.title AS "chapterTitle"
         FROM chapter_cards cc
         JOIN chapters ch ON ch.id = cc.chapter_id
        WHERE ($1::text IS NULL OR cc.chapter_id = $1)
          AND ($2::text IS NULL OR ch.course_id = $2)
          AND ch.archived = false
        ORDER BY random()
        LIMIT $3`,
      [chapterId, courseId, Math.min(12, limit)],
    );
    return NextResponse.json({ pairs });
  }

  const questions = await quizQuestions({ chapterId, courseId, limit, random: true });
  if (questions.length === 0) {
    return NextResponse.json(
      { questions: [], error: "Inga frågor hittades – välj ett annat kapitel." },
      { status: 200 },
    );
  }
  return NextResponse.json({ questions });
}
