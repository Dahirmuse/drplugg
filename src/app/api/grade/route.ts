import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryMany, queryOne } from "@/lib/db";
import { completeJson, DeepSeekError, hasApiKey } from "@/lib/deepseek";
import { graderMessages } from "@/lib/prompts";
import { getChapterDetail } from "@/lib/repo";
import type { GradeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = [1, 2, 3, 4];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  if (!hasApiKey()) {
    return NextResponse.json({ error: "DEEPSEEK_API_KEY saknas i .env.local." }, { status: 503 });
  }

  const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: "sessionId krävs." }, { status: 400 });

  const session = await queryOne<{ id: string; chapter_id: string | null }>(
    `SELECT id, chapter_id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, user.id],
  );
  if (!session) return NextResponse.json({ error: "Sessionen finns inte." }, { status: 404 });

  const transcript = await queryMany<{ role: "user" | "assistant"; content: string }>(
    `SELECT role, content FROM messages WHERE session_id = $1 ORDER BY id ASC`,
    [sessionId],
  );
  if (transcript.length === 0) {
    return NextResponse.json({ error: "Ingen dialog att bedöma ännu." }, { status: 400 });
  }

  const chapter = session.chapter_id
    ? await getChapterDetail(session.chapter_id, user.id)
    : null;

  let grade: GradeResult;
  try {
    grade = await completeJson<GradeResult>(
      graderMessages({
        chapter: {
          title: chapter?.chapter.title ?? "Allmän medicin",
          courseTitle: chapter?.course.title ?? "Läkarprogrammet",
        },
        objective: chapter?.objectives.map((o) => `${o.code ?? ""} ${o.title}`).join("\n") ?? null,
        transcript,
      }),
      { temperature: 0.1, maxTokens: 900 },
    );
  } catch (err) {
    const e = err as DeepSeekError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 502 });
  }

  const rating = VALID.includes(Number(grade.rating)) ? Number(grade.rating) : 2;
  const normalized: GradeResult = {
    rating: rating as GradeResult["rating"],
    confidence: Number(grade.confidence) || 0.5,
    verdict: grade.verdict ?? "",
    strengths: Array.isArray(grade.strengths) ? grade.strengths.slice(0, 4) : [],
    gaps: Array.isArray(grade.gaps) ? grade.gaps.slice(0, 6) : [],
    misconception: grade.misconception ?? "",
    reference_answer: grade.reference_answer ?? "",
    next_question: grade.next_question ?? "",
  };

  // Spara betyget på det senaste assistentmeddelandet så att det syns i chatten.
  await queryOne(
    `UPDATE messages SET grade = $1
      WHERE id = (SELECT id FROM messages WHERE session_id = $2 AND role = 'assistant'
                   ORDER BY id DESC LIMIT 1)`,
    [JSON.stringify(normalized), sessionId],
  );

  return NextResponse.json({ grade: normalized, chapterTitle: chapter?.chapter.title ?? null });
}
