import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { completeJson, DeepSeekError, hasApiKey } from "@/lib/deepseek";
import { cardGenMessages, type SourceSnippet } from "@/lib/prompts";
import { snippetsFor } from "@/lib/retrieval";
import { getChapterDetail } from "@/lib/repo";
import { execute, queryMany, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_CALL = 15;

type CardResponse = { cards?: { front?: string; back?: string }[] };

/** Genererar nya flashcards för ett kapitel och lägger dem i modulens kortlek. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  if (!hasApiKey()) {
    return NextResponse.json({ error: "DEEPSEEK_API_KEY saknas i .env.local." }, { status: 503 });
  }

  const { chapterId, count = 10, focus } = (await req.json().catch(() => ({}))) as {
    chapterId?: string;
    count?: number;
    focus?: string;
  };
  if (!chapterId) return NextResponse.json({ error: "chapterId krävs." }, { status: 400 });

  const detail = await getChapterDetail(chapterId, user.id);
  if (!detail) return NextResponse.json({ error: "Kapitlet finns inte." }, { status: 404 });

  const n = Math.min(MAX_PER_CALL, Math.max(3, Number(count) || 10));

  const chapterCtx = {
    chapterTitle: detail.chapter.title,
    courseTitle: detail.course.title,
    summary: [detail.chapter.summary, focus ? `Fokus: ${focus}` : null].filter(Boolean).join(" "),
    objectives: detail.objectives.map((o) => `${o.code ?? ""} ${o.title}`.trim()),
  };

  let snippets: SourceSnippet[] = [];
  try {
    snippets = await snippetsFor(user.id, chapterId, `${detail.chapter.title} ${focus ?? ""}`, 3);
  } catch {
    snippets = [];
  }

  let parsed: CardResponse;
  try {
    parsed = await completeJson<CardResponse>(
      cardGenMessages({ chapter: chapterCtx, snippets, count: n }),
      { temperature: 0.8, maxTokens: 3000 },
    );
  } catch (err) {
    const e = err as DeepSeekError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 502 });
  }

  const maxRow = await queryOne<{ max: number }>(
    `SELECT COALESCE(max(sort_order), 0)::int AS max FROM chapter_cards WHERE chapter_id = $1`,
    [chapterId],
  );
  let order = maxRow?.max ?? 0;
  const added: { front: string; back: string }[] = [];

  for (const c of parsed.cards ?? []) {
    const front = String(c.front ?? "").trim();
    const back = String(c.back ?? "").trim();
    if (front.length < 8 || back.length < 8) continue;
    if (front.length > 220 || back.length > 900) continue;

    const dup = await queryMany(
      `SELECT 1 FROM chapter_cards WHERE chapter_id = $1 AND lower(front) = lower($2) LIMIT 1`,
      [chapterId, front],
    );
    if (dup.length) continue;

    order++;
    await execute(
      `INSERT INTO chapter_cards (id, chapter_id, front, back, sort_order, origin)
       VALUES ($1,$2,$3,$4,$5,'ai')`,
      [`ai-card-${chapterId}-${crypto.randomUUID().slice(0, 8)}`, chapterId, front, back, order],
    );
    added.push({ front, back });
  }

  return NextResponse.json({
    added: added.length,
    cards: added,
    message:
      added.length > 0
        ? `${added.length} nya kort tillagda i modulen.`
        : "Inga nya kort den här gången (alla fanns redan).",
  });
}
