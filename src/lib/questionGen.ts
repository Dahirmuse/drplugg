import { completeJson, DeepSeekError } from "./deepseek";
import { factCheckMessages, questionGenMessages, type SourceSnippet } from "./prompts";
import { snippetsFor } from "./retrieval";
import {
  countAiQuestions,
  getChapterDetail,
  saveAiQuestions,
  type GeneratedQuestion,
} from "./repo";
import { queryMany } from "./db";

const MAX_AI_PER_CHAPTER = 24;
const COOLDOWN_MS = 2 * 60 * 1000;

/** Kort cooldown per användare+urval så att man inte kan spamma generering. */
const lastRun = new Map<string, number>();

export type GenResult = {
  generated: number;
  checked: number;
  rejected: number;
  questions: {
    id: string;
    kind: "mcq";
    prompt: string;
    options: string[];
    answer: string;
    explanation: string;
  }[];
  message: string;
};

type GenResponse = {
  questions?: {
    prompt?: string;
    options?: unknown;
    answerIndex?: unknown;
    explanation?: string;
  }[];
};

type FactResponse = {
  results?: {
    index?: number;
    verdict?: string;
    correctedAnswerIndex?: number | null;
    note?: string;
  }[];
};

/** Ett kapitel: generera → faktagranska → spara. */
async function generateForChapter(
  userId: string,
  chapterId: string,
  count: number,
): Promise<{ generated: number; checked: number; rejected: number; questions: GenResult["questions"] }> {
  const detail = await getChapterDetail(chapterId, userId);
  if (!detail) return { generated: 0, checked: 0, rejected: 0, questions: [] };

  const existing = await countAiQuestions(chapterId);
  const room = Math.max(0, MAX_AI_PER_CHAPTER - existing);
  const n = Math.min(count, room);
  if (n <= 0) return { generated: 0, checked: 0, rejected: 0, questions: [] };

  const chapterCtx = {
    chapterTitle: detail.chapter.title,
    courseTitle: detail.course.title,
    summary: detail.chapter.summary,
    objectives: detail.objectives.map((o) => `${o.code ?? ""} ${o.title}`.trim()),
  };
  const snippets: SourceSnippet[] = await snippetsFor(
    userId,
    chapterId,
    `${detail.chapter.title} ${chapterCtx.objectives.join(" ")}`,
    3,
  );

  let raw: GenResponse | null = null;
  let askFor = n;
  for (let attempt = 0; attempt < 2 && !raw; attempt++) {
    try {
      raw = await completeJson<GenResponse>(
        questionGenMessages({ chapter: chapterCtx, snippets, count: askFor }),
        { temperature: 0.8, maxTokens: 3000 },
      );
    } catch (err) {
      // Oftast avklippt/oparsbart svar: försök en gång till med färre frågor
      if (attempt === 1) throw err;
      askFor = Math.max(1, askFor - 1);
    }
  }
  if (!raw) return { generated: 0, checked: 0, rejected: 0, questions: [] };

  const candidates: GeneratedQuestion[] = (raw.questions ?? [])
    .map((q) => ({
      prompt: String(q.prompt ?? "").trim(),
      options: Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [],
      answerIndex: Number(q.answerIndex),
      explanation: String(q.explanation ?? "").trim(),
    }))
    .filter(
      (q) =>
        q.prompt.length > 15 &&
        q.options.length === 4 &&
        new Set(q.options).size === 4 &&
        Number.isInteger(q.answerIndex) &&
        q.answerIndex >= 0 &&
        q.answerIndex < 4 &&
        q.explanation.length > 10,
    );

  if (candidates.length === 0) {
    return { generated: 0, checked: 0, rejected: 0, questions: [] };
  }

  let verdicts: FactResponse;
  try {
    verdicts = await completeJson<FactResponse>(
      factCheckMessages({ chapter: chapterCtx, questions: candidates, snippets }),
      { temperature: 0.1, maxTokens: 2200 },
    );
  } catch {
    // Utan granskning sparas inget – hellre inga frågor än ogranskade.
    return { generated: 0, checked: candidates.length, rejected: candidates.length, questions: [] };
  }

  const byIndex = new Map<number, { verdict: string; corrected?: number }>();
  for (const r of verdicts.results ?? []) {
    const i = Number(r.index);
    if (Number.isInteger(i)) {
      byIndex.set(i, {
        verdict: String(r.verdict ?? "").toLowerCase(),
        corrected: r.correctedAnswerIndex ?? undefined,
      });
    }
  }

  const approved: GeneratedQuestion[] = [];
  let rejected = 0;
  candidates.forEach((q, i) => {
    const v = byIndex.get(i);
    if (!v) {
      rejected++;
      return;
    }
    if (v.verdict === "ok") {
      approved.push(q);
    } else if (
      typeof v.corrected === "number" &&
      Number.isInteger(v.corrected) &&
      v.corrected >= 0 &&
      v.corrected < q.options.length
    ) {
      approved.push({ ...q, answerIndex: v.corrected });
    } else {
      rejected++;
    }
  });

  const saved = await saveAiQuestions(chapterId, approved);

  return {
    generated: saved,
    checked: candidates.length,
    rejected,
    questions: approved.map((q, i) => ({
      id: `new-${chapterId}-${i}`,
      kind: "mcq" as const,
      prompt: q.prompt,
      options: q.options,
      answer: q.options[q.answerIndex],
      explanation: q.explanation,
    })),
  };
}

/** Väljer vilka kapitel som ska få nya frågor för ett urval. */
async function resolveChapters(
  chapterId: string | null,
  courseId: string | null,
): Promise<string[]> {
  if (chapterId) return [chapterId];

  const rows = await queryMany<{ id: string }>(
    `SELECT ch.id,
            (SELECT count(*) FROM recall_items r
              WHERE r.chapter_id = ch.id AND r.origin = 'ai')::int AS ai
       FROM chapters ch
      WHERE ($1::text IS NULL OR ch.course_id = $1)
        AND (SELECT count(*) FROM recall_items r WHERE r.chapter_id = ch.id) > 0
      ORDER BY ai ASC, random()
      LIMIT 2`,
    [courseId],
  );
  return rows.map((r) => r.id);
}

export async function generateQuestions(opts: {
  userId: string;
  chapterId?: string | null;
  courseId?: string | null;
  count?: number;
}): Promise<GenResult> {
  const { userId } = opts;
  const chapterId = opts.chapterId ?? null;
  const courseId = chapterId ? null : opts.courseId ?? null;
  const count = Math.min(5, Math.max(1, Number(opts.count) || 3));

  const scopeKey = `${userId}:${chapterId ?? courseId ?? "alla"}`;
  const now = Date.now();
  const previous = lastRun.get(scopeKey);
  if (previous && now - previous < COOLDOWN_MS) {
    return {
      generated: 0,
      checked: 0,
      rejected: 0,
      questions: [],
      message: "Nya frågor skapades nyss för det här urvalet – spela en runda till först.",
    };
  }

  const chapters = await resolveChapters(chapterId, courseId);
  if (chapters.length === 0) {
    return {
      generated: 0,
      checked: 0,
      rejected: 0,
      questions: [],
      message: "Hittade inga kapitel med frågor för det urvalet.",
    };
  }

  let generated = 0;
  let checked = 0;
  let rejected = 0;
  const questions: GenResult["questions"] = [];

  try {
    for (const chId of chapters) {
      const per = chapters.length === 1 ? count : Math.max(1, Math.ceil(count / chapters.length));
      const result = await generateForChapter(userId, chId, per);
      generated += result.generated;
      checked += result.checked;
      rejected += result.rejected;
      questions.push(...result.questions);
    }
  } catch (err) {
    const e = err as DeepSeekError;
    if (generated === 0) {
      lastRun.delete(scopeKey); // låt användaren försöka igen direkt
      throw e;
    }
  }

  if (generated > 0) lastRun.set(scopeKey, now);

  return {
    generated,
    checked,
    rejected,
    questions,
    message:
      generated > 0
        ? `${generated} nya frågor genererade och faktagranskade${
            rejected > 0 ? ` (${rejected} underkändes i granskningen)` : ""
          }.`
        : "Inga frågor klarade faktagranskningen den här gången.",
  };
}
