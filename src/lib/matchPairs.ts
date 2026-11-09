import { completeJson } from "./deepseek";
import { matchPairMessages, type SourceSnippet } from "./prompts";
import { queryMany, queryOne } from "./db";
import { snippetsFor } from "./retrieval";
import { getChapterDetail } from "./repo";

const MIN_PAIRS = 12;
/** Kapitel vi redan försökt fylla på i den här processen (undviker extra AI-anrop). */
const attempted = new Set<string>();
const MAX_PAIRS_PER_CHAPTER = 40;

export type MatchPair = {
  id: string;
  term: string;
  definition: string;
  chapterTitle: string;
};

type PairResponse = {
  pairs?: { term?: string; definition?: string }[];
};

async function existingPairs(chapterId: string) {
  return queryMany<{ term: string; definition: string }>(
    `SELECT term, definition FROM match_pairs WHERE chapter_id = $1 ORDER BY id`,
    [chapterId],
  );
}

/** Fyller på begreppspar för ett kapitel med hjälp av DeepSeek (cachas i databasen). */
export async function ensureMatchPairs(
  userId: string,
  chapterId: string,
): Promise<number> {
  const current = await existingPairs(chapterId);
  if (current.length >= MIN_PAIRS) return current.length;
  if (current.length >= MAX_PAIRS_PER_CHAPTER) return current.length;
  if (attempted.has(chapterId)) return current.length;
  attempted.add(chapterId);

  const detail = await getChapterDetail(chapterId, userId);
  if (!detail) return current.length;

  const chapterCtx = {
    chapterTitle: detail.chapter.title,
    courseTitle: detail.course.title,
    summary: detail.chapter.summary,
    objectives: detail.objectives.map((o) => `${o.code ?? ""} ${o.title}`.trim()),
  };

  let snippets: SourceSnippet[] = [];
  try {
    snippets = await snippetsFor(userId, chapterId, detail.chapter.title, 2);
  } catch {
    snippets = [];
  }

  const want = Math.min(12, MAX_PAIRS_PER_CHAPTER - current.length);
  const parsed = await completeJson<PairResponse>(
    matchPairMessages({
      chapter: chapterCtx,
      count: want,
      avoid: current.map((p) => p.term),
    }),
    { temperature: 0.7, maxTokens: 1200 },
  );

  let added = 0;
  for (const p of parsed.pairs ?? []) {
    const term = String(p.term ?? "").trim();
    const definition = String(p.definition ?? "").trim();
    if (!term || !definition) continue;
    if (term.length > 60 || definition.length > 120) continue;
    if (current.some((c) => c.term.toLowerCase() === term.toLowerCase())) continue;

    const row = await queryOne<{ id: string }>(
      `INSERT INTO match_pairs (chapter_id, term, definition, origin)
       VALUES ($1,$2,$3,'ai')
       ON CONFLICT (chapter_id, term) DO NOTHING
       RETURNING id::text AS id`,
      [chapterId, term, definition],
    );
    if (row) {
      current.push({ term, definition });
      added++;
    }
  }

  // snippets används för framtida källgrundning; behålls medvetet enkelt här.
  void snippets;
  return current.length;
}

/** Hämtar (och vid behov genererar) begreppspar för ett urval. */
export async function matchPairsForScope(opts: {
  userId: string;
  chapterId?: string | null;
  courseId?: string | null;
  limit?: number;
}): Promise<MatchPair[]> {
  const limit = Math.min(12, Math.max(3, opts.limit ?? 6));

  // Välj kapitel: givet kapitel, annars slumpa inom kurs/allt
  let chapterId = opts.chapterId ?? null;
  if (!chapterId) {
    const row = await queryOne<{ id: string; title: string }>(
      `SELECT ch.id, ch.title FROM chapters ch
        WHERE ($1::text IS NULL OR ch.course_id = $1)
          AND ch.archived = false
          AND EXISTS (SELECT 1 FROM chapter_cards cc WHERE cc.chapter_id = ch.id)
        ORDER BY random() LIMIT 1`,
      [opts.courseId ?? null],
    );
    chapterId = row?.id ?? null;
  }
  if (!chapterId) return [];

  try {
    await ensureMatchPairs(opts.userId, chapterId);
  } catch {
    // Går genereringen inte igenom använder vi det som redan finns.
  }

  const rows = await queryMany<{
    id: string;
    term: string;
    definition: string;
    chapterTitle: string;
  }>(
    `SELECT mp.id::text AS id, mp.term, mp.definition, ch.title AS "chapterTitle"
       FROM match_pairs mp
       JOIN chapters ch ON ch.id = mp.chapter_id
      WHERE mp.chapter_id = $1
      ORDER BY random()
      LIMIT $2`,
    [chapterId, limit],
  );

  return rows;
}
