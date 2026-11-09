import { queryMany, queryOne, execute } from "./db";
import { previewIntervals, rowToCard, schedule, type CardRow, type StoredCard } from "./fsrs";
import type { Course, Chapter, Objective, RecallItem, Flashcard } from "./types";
import type { Grade } from "ts-fsrs";

/* ══════════════════════════ KURSPLAN ══════════════════════════ */

export type CourseWithProgress = Course & {
  chapters: number;
  completed: number;
};

export async function listCourses(userId: string): Promise<CourseWithProgress[]> {
  return queryMany<CourseWithProgress>(
    `SELECT c.id, c.code, c.title, c.term, c.description, c.icon, c.color,
            c.sort_order AS "sortOrder",
            (SELECT count(*) FROM chapters ch WHERE ch.course_id = c.id)::int AS chapters,
            (SELECT count(*) FROM chapters ch
               JOIN chapter_progress cp ON cp.chapter_id = ch.id AND cp.user_id = $1
              WHERE ch.course_id = c.id AND cp.status IN ('completed','mastered'))::int AS completed
       FROM courses c
      WHERE c.archived = false
      ORDER BY c.sort_order, c.code`,
    [userId],
  );
}

export async function getCourse(courseId: string): Promise<Course | null> {
  return queryOne<Course>(
    `SELECT id, code, title, term, description, icon, color, sort_order AS "sortOrder"
       FROM courses WHERE id = $1`,
    [courseId],
  );
}

export type ChapterWithProgress = Chapter & {
  objectiveCount: number;
  recallCount: number;
  cardCount: number;
  status: string | null;
  recallRight: number;
  recallTotal: number;
};

export async function listChapters(
  courseId: string,
  userId: string,
): Promise<ChapterWithProgress[]> {
  return queryMany<ChapterWithProgress>(
    `SELECT ch.id, ch.course_id AS "courseId", ch.code, ch.title, ch.summary,
            ch.est_minutes AS "estMinutes", ch.sort_order AS "sortOrder",
            (SELECT count(*) FROM objectives o WHERE o.chapter_id = ch.id)::int AS "objectiveCount",
            (SELECT count(*) FROM recall_items r WHERE r.chapter_id = ch.id)::int AS "recallCount",
            (SELECT count(*) FROM chapter_cards cc WHERE cc.chapter_id = ch.id)::int AS "cardCount",
            cp.status,
            COALESCE(cp.recall_right, 0) AS "recallRight",
            COALESCE(cp.recall_total, 0) AS "recallTotal"
       FROM chapters ch
       LEFT JOIN chapter_progress cp ON cp.chapter_id = ch.id AND cp.user_id = $2
      WHERE ch.course_id = $1 AND ch.archived = false
      ORDER BY ch.sort_order, ch.id`,
    [courseId, userId],
  );
}

export type ChapterDetail = {
  chapter: Chapter;
  course: Course;
  objectives: Objective[];
  recall: RecallItem[];
  cards: { front: string; back: string; origin: string }[];
  status: string | null;
};

export async function getChapterDetail(
  chapterId: string,
  userId: string,
): Promise<ChapterDetail | null> {
  const chapter = await queryOne<Chapter>(
    `SELECT id, course_id AS "courseId", code, title, summary,
            est_minutes AS "estMinutes", sort_order AS "sortOrder",
            facts, ninja_topics AS "ninjaTopics", sections
       FROM chapters WHERE id = $1`,
    [chapterId],
  );
  if (!chapter) return null;

  const course = await getCourse(chapter.courseId);
  if (!course) return null;

  const objectives = await queryMany<Objective>(
    `SELECT id, chapter_id AS "chapterId", code, title, level, sort_order AS "sortOrder"
       FROM objectives WHERE chapter_id = $1 ORDER BY sort_order, code`,
    [chapterId],
  );

  const recall = await queryMany<RecallItem>(
    `SELECT id, chapter_id AS "chapterId", kind, prompt, options, answer,
            explanation, difficulty, sort_order AS "sortOrder"
       FROM recall_items WHERE chapter_id = $1 ORDER BY sort_order, id`,
    [chapterId],
  );

  const cards = await queryMany<{ front: string; back: string; origin: string }>(
    `SELECT front, back, COALESCE(origin, 'kapitel') AS origin
       FROM chapter_cards WHERE chapter_id = $1 ORDER BY sort_order, id`,
    [chapterId],
  );

  const progress = await queryOne<{ status: string }>(
    `SELECT status FROM chapter_progress WHERE user_id = $1 AND chapter_id = $2`,
    [userId, chapterId],
  );

  return {
    chapter,
    course,
    objectives,
    recall,
    cards,
    status: progress?.status ?? null,
  };
}

/* ══════════════════════════ FRAMSTEG ══════════════════════════ */

export async function recordRecallAnswer(
  userId: string,
  chapterId: string,
  correct: boolean,
): Promise<void> {
  await execute(
    `INSERT INTO chapter_progress (user_id, chapter_id, status, recall_right, recall_total)
     VALUES ($1, $2, 'started', $3, 1)
     ON CONFLICT (user_id, chapter_id) DO UPDATE
       SET recall_right = chapter_progress.recall_right + $3,
           recall_total = chapter_progress.recall_total + 1,
           updated_at = now()`,
    [userId, chapterId, correct ? 1 : 0],
  );
}

export async function setChapterStatus(
  userId: string,
  chapterId: string,
  status: "started" | "completed" | "mastered",
): Promise<void> {
  await execute(
    `INSERT INTO chapter_progress (user_id, chapter_id, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, chapter_id) DO UPDATE
       SET status = CASE
             WHEN chapter_progress.status = 'mastered' THEN 'mastered'
             WHEN $3 = 'started' THEN chapter_progress.status
             WHEN chapter_progress.status = 'completed' AND $3 = 'completed' THEN 'completed'
             ELSE $3 END,
           updated_at = now()`,
    [userId, chapterId, status],
  );
}

/* ══════════════════════════ FLASHCARDS / FSRS ══════════════════════════ */

/** Lägger kapitlets kort i användarens repetition (idempotent). */
export async function ensureDeck(userId: string, chapterId: string): Promise<number> {
  const inserted = await execute(
    `INSERT INTO flashcards (user_id, chapter_id, front, back, origin)
     SELECT $1, cc.chapter_id, cc.front, cc.back, 'kapitel'
       FROM chapter_cards cc
      WHERE cc.chapter_id = $2
     ON CONFLICT (user_id, chapter_id, front) DO NOTHING`,
    [userId, chapterId],
  );
  return inserted;
}

export async function listDueCards(userId: string, limit = 30): Promise<Flashcard[]> {
  return queryMany<Flashcard>(
    `SELECT id, chapter_id AS "chapterId", front, back, origin, due, state, reps, lapses,
            scheduled_days AS "scheduledDays", stability, difficulty,
            last_review AS "lastReview"
       FROM flashcards
      WHERE user_id = $1 AND status = 'active' AND due <= now()
      ORDER BY due ASC
      LIMIT $2`,
    [userId, limit],
  );
}

export async function getCard(userId: string, cardId: string): Promise<CardRow | null> {
  return queryOne<CardRow>(
    `SELECT id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses,
            state, last_review
       FROM flashcards WHERE id = $1 AND user_id = $2`,
    [cardId, userId],
  );
}

export async function reviewCard(
  userId: string,
  cardId: string,
  rating: 1 | 2 | 3 | 4,
  opts: { source?: string; elapsedMs?: number; note?: string } = {},
): Promise<{ stored: StoredCard; preview: Record<1 | 2 | 3 | 4, number> }> {
  const row = await getCard(userId, cardId);
  if (!row) throw new Error("Kortet finns inte");

  const card = rowToCard(row);
  const next = schedule(card, rating as Grade);

  await execute(
    `UPDATE flashcards
        SET due = $2, stability = $3, difficulty = $4, elapsed_days = $5,
            scheduled_days = $6, reps = $7, lapses = $8, state = $9, last_review = $10
      WHERE id = $1 AND user_id = $11`,
    [
      cardId,
      next.due,
      next.stability,
      next.difficulty,
      next.elapsedDays,
      next.scheduledDays,
      next.reps,
      next.lapses,
      next.state,
      next.lastReview,
      userId,
    ],
  );

  await execute(
    `INSERT INTO review_logs (user_id, card_id, chapter_id, rating, source, elapsed_ms, note)
     SELECT $1, f.id, f.chapter_id, $3, $4, $5, $6 FROM flashcards f WHERE f.id = $2`,
    [userId, cardId, rating, opts.source ?? "sjalv", opts.elapsedMs ?? null, opts.note ?? null],
  );

  return { stored: next, preview: previewIntervals(next.card) };
}

export async function createCard(
  userId: string,
  input: { chapterId?: string | null; front: string; back: string; origin?: string },
): Promise<Flashcard> {
  const row = await queryOne<Flashcard>(
    `INSERT INTO flashcards (user_id, chapter_id, front, back, origin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, chapter_id AS "chapterId", front, back, origin, due, state, reps, lapses,
               scheduled_days AS "scheduledDays", stability, difficulty,
               last_review AS "lastReview"`,
    [userId, input.chapterId ?? null, input.front, input.back, input.origin ?? "egen"],
  );
  if (!row) throw new Error("Kunde inte skapa kortet");
  return row;
}

export async function cardPreview(cardId: string, userId: string) {
  const row = await getCard(userId, cardId);
  if (!row) return null;
  return previewIntervals(rowToCard(row));
}

/* ══════════════════════════ STATISTIK ══════════════════════════ */

export type Stats = {
  dueNow: number;
  totalCards: number;
  newCards: number;
  mature: number;
  reviewsToday: number;
  reviews7d: number;
  retention30: number | null;
  accuracy: number | null;
  chaptersStarted: number;
  chaptersCompleted: number;
  pointsToday: number;
  totalPoints: number;
  forecast: { label: string; count: number }[];
  history: { label: string; count: number; good: number }[];
  streak: number;
  longestStreak: number;
};

export async function getStats(userId: string): Promise<Stats> {
  const one = async <T>(sql: string, params: unknown[] = []) =>
    (await queryOne<T>(sql, params)) as T;

  const counts = await one<{
    due: number;
    total: number;
    fresh: number;
    mature: number;
  }>(
    `SELECT
       count(*) FILTER (WHERE status='active' AND due <= now())::int AS due,
       count(*) FILTER (WHERE status='active')::int AS total,
       count(*) FILTER (WHERE status='active' AND state = 0)::int AS fresh,
       count(*) FILTER (WHERE status='active' AND state = 2 AND scheduled_days >= 21)::int AS mature
     FROM flashcards WHERE user_id = $1`,
    [userId],
  );

  const today = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM review_logs
      WHERE user_id = $1 AND reviewed_at >= date_trunc('day', now())`,
    [userId],
  );

  const week = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM review_logs
      WHERE user_id = $1 AND reviewed_at >= now() - interval '7 days'`,
    [userId],
  );

  const retention = await one<{ r: number | null }>(
    `SELECT avg(CASE WHEN rating >= 3 THEN 1.0 ELSE 0.0 END)::float AS r
       FROM review_logs WHERE user_id = $1 AND reviewed_at >= now() - interval '30 days'`,
    [userId],
  );

  const chapters = await one<{ started: number; completed: number }>(
    `SELECT
       count(*)::int AS started,
       count(*) FILTER (WHERE status IN ('completed','mastered'))::int AS completed
     FROM chapter_progress WHERE user_id = $1`,
    [userId],
  );

  const accuracy = await one<{ a: number | null }>(
    `SELECT (CASE WHEN sum(recall_total) > 0
                  THEN sum(recall_right)::float / sum(recall_total) ELSE NULL END) AS a
       FROM chapter_progress WHERE user_id = $1`,
    [userId],
  );

  const points = await one<{ today: number; total: number }>(
    `SELECT COALESCE((SELECT points FROM daily_activity
                       WHERE user_id = $1 AND day = current_date), 0)::int AS today,
            COALESCE((SELECT sum(points) FROM daily_activity WHERE user_id = $1), 0)::int AS total`,
    [userId],
  );

  const forecastRows = await queryMany<{ label: string; count: number }>(
    `SELECT to_char(d.day, 'Dy') AS label,
            (SELECT count(*) FROM flashcards f
              WHERE f.user_id = $1 AND f.status='active'
                AND f.due >= d.day AND f.due < d.day + interval '1 day')::int AS count
       FROM generate_series(date_trunc('day', now()), date_trunc('day', now()) + interval '6 days', interval '1 day') AS d(day)`,
    [userId],
  );

  const historyRows = await queryMany<{ label: string; count: number; good: number }>(
    `SELECT to_char(d.day, 'DD/MM') AS label,
            (SELECT count(*) FROM review_logs r
              WHERE r.user_id = $1 AND r.reviewed_at >= d.day AND r.reviewed_at < d.day + interval '1 day')::int AS count,
            (SELECT count(*) FROM review_logs r
              WHERE r.user_id = $1 AND r.reviewed_at >= d.day AND r.reviewed_at < d.day + interval '1 day'
                AND r.rating >= 3)::int AS good
       FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d(day)`,
    [userId],
  );

  const streak = await getStreak(userId);

  return {
    dueNow: counts.due,
    totalCards: counts.total,
    newCards: counts.fresh,
    mature: counts.mature,
    reviewsToday: today.n,
    reviews7d: week.n,
    retention30: retention.r === null ? null : Number(retention.r),
    accuracy: accuracy.a === null ? null : Number(accuracy.a),
    chaptersStarted: chapters.started,
    chaptersCompleted: chapters.completed,
    pointsToday: points.today,
    totalPoints: points.total,
    forecast: forecastRows,
    history: historyRows,
    streak: streak.current,
    longestStreak: streak.longest,
  };
}

export async function getStreak(userId: string): Promise<{ current: number; longest: number }> {
  const rows = await queryMany<{ day: string }>(
    `SELECT d.day::text AS day
       FROM (SELECT day FROM daily_activity WHERE user_id = $1
             UNION SELECT date_trunc('day', reviewed_at)::date FROM review_logs WHERE user_id = $1) d
      WHERE d.day IS NOT NULL
      ORDER BY d.day DESC
      LIMIT 400`,
    [userId],
  );

  if (rows.length === 0) return { current: 0, longest: 0 };

  const days = new Set(rows.map((r) => r.day.slice(0, 10)));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);

  let current = 0;
  let cursor = days.has(iso(today)) ? today : days.has(iso(yesterday)) ? yesterday : null;
  while (cursor) {
    if (!days.has(iso(cursor))) break;
    current += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    if (prev) {
      const diff = (new Date(day).getTime() - new Date(prev).getTime()) / 86_400_000;
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = day;
  }

  return { current, longest };
}

export async function addPoints(userId: string, points: number): Promise<void> {
  if (points <= 0) return;
  await execute(
    `INSERT INTO daily_activity (user_id, day, points) VALUES ($1, current_date, $2)
     ON CONFLICT (user_id, day) DO UPDATE SET points = daily_activity.points + $2`,
    [userId, points],
  );
}

/* ══════════════════════════ SPEL ══════════════════════════ */

export async function recordGame(
  userId: string,
  input: { game: string; chapterId?: string | null; score: number; maxScore: number; durationMs?: number; detail?: unknown },
): Promise<void> {
  await execute(
    `INSERT INTO game_attempts (user_id, game, chapter_id, score, max_score, duration_ms, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      input.game,
      input.chapterId ?? null,
      input.score,
      input.maxScore,
      input.durationMs ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
    ],
  );
  await addPoints(userId, Math.max(1, Math.round(input.score)));
}

export async function bestScores(userId: string) {
  return queryMany<{ game: string; best: number; plays: number }>(
    `SELECT game, max(score)::int AS best, count(*)::int AS plays
       FROM game_attempts WHERE user_id = $1 GROUP BY game`,
    [userId],
  );
}

export async function leaderboard(game: string, limit = 10) {
  return queryMany<{ email: string; displayName: string | null; best: number; plays: number }>(
    `SELECT u.email, u.display_name AS "displayName",
            max(g.score)::int AS best, count(*)::int AS plays
       FROM game_attempts g
       JOIN users u ON u.id = g.user_id
      WHERE g.game = $1
      GROUP BY u.id, u.email, u.display_name
      ORDER BY best DESC, plays ASC
      LIMIT $2`,
    [game, limit],
  );
}

/* ══════════════════════════ FRÅGOR TILL SPEL ══════════════════════════ */

export type QuizQuestion = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string | null;
};

export async function quizQuestions(
  opts: {
    chapterId?: string | null;
    courseId?: string | null;
    limit?: number;
    random?: boolean;
  } = {},
): Promise<QuizQuestion[]> {
  const limit = opts.limit ?? 10;
  const rows = await queryMany<{
    id: string;
    chapter_id: string;
    chapter_title: string;
    prompt: string;
    options: string[] | null;
    answer: string;
    explanation: string | null;
    kind: string;
  }>(
    `SELECT r.id, r.chapter_id, ch.title AS chapter_title, r.prompt, r.options, r.answer,
            r.explanation, r.kind
       FROM recall_items r
       JOIN chapters ch ON ch.id = r.chapter_id
      WHERE ($1::text IS NULL OR r.chapter_id = $1)
        AND ($2::text IS NULL OR ch.course_id = $2)
        AND ch.archived = false
      ORDER BY ${opts.random === false ? "r.sort_order" : "random()"}
      LIMIT $3`,
    [opts.chapterId ?? null, opts.courseId ?? null, limit],
  );

  const out: QuizQuestion[] = [];
  for (const r of rows) {
    if (r.kind === "mcq" && Array.isArray(r.options) && r.options.length >= 2) {
      const idx = r.options.findIndex((o) => o === r.answer);
      if (idx >= 0) {
        out.push({
          id: r.id,
          chapterId: r.chapter_id,
          chapterTitle: r.chapter_title,
          prompt: r.prompt,
          options: r.options,
          answerIndex: idx,
          explanation: r.explanation,
        });
      }
    }
  }
  return out;
}

/* ══════════════════════════ KÄLLDOKUMENT ══════════════════════════ */

export async function listDocs(userId: string) {
  return queryMany<{ id: string; name: string; kind: string | null; chars: number; addedAt: string; chunks: number }>(
    `SELECT d.id::text AS id, d.name, d.kind, d.chars, d.added_at AS "addedAt",
            (SELECT count(*) FROM doc_chunks c WHERE c.doc_id = d.id)::int AS chunks
       FROM docs d WHERE d.user_id = $1 ORDER BY d.added_at DESC`,
    [userId],
  );
}

export async function addDoc(
  userId: string,
  name: string,
  kind: string,
  chars: number,
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO docs (user_id, name, kind, chars) VALUES ($1, $2, $3, $4) RETURNING id::text AS id`,
    [userId, name, kind, chars],
  );
  if (!row) throw new Error("Kunde inte spara dokumentet");
  return row.id;
}

export async function addChunks(
  docId: string,
  chapterId: string | null,
  chunks: { heading: string | null; text: string }[],
): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    await execute(
      `INSERT INTO doc_chunks (doc_id, chapter_id, heading, ord, text) VALUES ($1,$2,$3,$4,$5)`,
      [docId, chapterId, chunks[i].heading, i, chunks[i].text],
    );
  }
}

export async function deleteDoc(userId: string, docId: string): Promise<void> {
  await execute(`DELETE FROM docs WHERE id = $1 AND user_id = $2`, [docId, userId]);
}

/* ══════════════════════════ AI-FRÅGOR ══════════════════════════ */

export type GeneratedQuestion = {
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

export async function countAiQuestions(chapterId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM recall_items WHERE chapter_id = $1 AND origin = 'ai'`,
    [chapterId],
  );
  return row?.n ?? 0;
}

/** Sparar faktagranskade AI-frågor så att de finns kvar i quiz och spel. */
export async function saveAiQuestions(
  chapterId: string,
  questions: GeneratedQuestion[],
): Promise<number> {
  if (questions.length === 0) return 0;

  const row = await queryOne<{ max: number }>(
    `SELECT COALESCE(max(sort_order), 0)::int AS max FROM recall_items WHERE chapter_id = $1`,
    [chapterId],
  );
  let order = row?.max ?? 0;
  let saved = 0;

  for (const q of questions) {
    const answer = q.options[q.answerIndex];
    if (!answer) continue;
    order++;
    // Undvik dubbletter (samma fråga två gånger)
    const dup = await queryOne<{ id: string }>(
      `SELECT id FROM recall_items WHERE chapter_id = $1 AND lower(prompt) = lower($2) LIMIT 1`,
      [chapterId, q.prompt.slice(0, 400)],
    );
    if (dup) continue;

    await execute(
      `INSERT INTO recall_items
         (id, chapter_id, kind, prompt, options, answer, explanation, difficulty, sort_order, origin, fact_checked)
       VALUES ($1,$2,'mcq',$3,$4,$5,$6,2,$7,'ai',true)`,
      [
        `ai-${chapterId}-${crypto.randomUUID().slice(0, 8)}`,
        chapterId,
        q.prompt,
        JSON.stringify(q.options),
        answer,
        q.explanation,
        order,
      ],
    );
    saved++;
  }

  return saved;
}
