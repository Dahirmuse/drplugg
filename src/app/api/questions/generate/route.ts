import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DeepSeekError, hasApiKey } from "@/lib/deepseek";
import { generateQuestions } from "@/lib/questionGen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Genererar nya faktagranskade frågor.
 *   { chapterId }  – ett kapitel (quiz)
 *   { courseId }   – hela kursen (spel)
 *   { }            – blandat från alla kurser (dagens utmaning)
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  if (!hasApiKey()) {
    return NextResponse.json({ error: "DEEPSEEK_API_KEY saknas i .env.local." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    chapterId?: string | null;
    courseId?: string | null;
    count?: number;
  };

  try {
    const result = await generateQuestions({
      userId: user.id,
      chapterId: body.chapterId ?? null,
      courseId: body.courseId ?? null,
      count: body.count ?? 3,
    });
    return NextResponse.json(result);
  } catch (err) {
    const e = err as DeepSeekError;
    return NextResponse.json(
      { error: e.message || "Kunde inte generera frågor just nu." },
      { status: e.status ?? 502 },
    );
  }
}
