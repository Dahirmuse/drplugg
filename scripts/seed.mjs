/**
 * Seed: läser in kursplanen från src/content/courses/*.json och skriver
 * kurser, kapitel, lärandemål, återkallningsfrågor och kapitelkort till Postgres.
 *
 *   npm run db:seed      (idempotent – kör om hur ofta du vill)
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { loadEnv, pgConfig } from "./env.mjs";

loadEnv();

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "courses");

function loadCourses() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, f), "utf8");
      try {
        return JSON.parse(raw);
      } catch (err) {
        console.error(`✗ ${f}: ogiltig JSON – ${err.message}`);
        process.exit(1);
      }
    });
}

function validate(course) {
  const problems = [];
  if (!course.id) problems.push("saknar id");
  if (!Array.isArray(course.chapters)) problems.push("saknar chapters[]");

  for (const ch of course.chapters ?? []) {
    if (!ch.id) problems.push("kapitel utan id");
    if (!ch.title) problems.push(`${ch.id}: saknar titel`);
    for (const q of ch.recall ?? []) {
      if (!q.id || !q.prompt || !q.answer) problems.push(`${ch.id}: fråga ${q.id} ofullständig`);
      if (q.kind === "mcq" && (!Array.isArray(q.options) || !q.options.includes(q.answer))) {
        problems.push(`${ch.id}/${q.id}: svaret finns inte bland options`);
      }
    }
    for (const c of ch.cards ?? []) {
      if (!c.front || !c.back) problems.push(`${ch.id}: kort utan front/back`);
    }
  }
  return problems;
}

async function main() {
  const courses = loadCourses();
  if (courses.length === 0) {
    console.error("✗ inga kursfiler i src/content/courses");
    process.exit(1);
  }

  const allProblems = courses.flatMap((c) => validate(c).map((p) => `${c.id}: ${p}`));
  if (allProblems.length) {
    console.error("✗ innehållet är inte giltigt:");
    for (const p of allProblems.slice(0, 25)) console.error("  -", p);
    process.exit(1);
  }

  const client = new Client(pgConfig());
  await client.connect();

  let stats = { courses: 0, chapters: 0, objectives: 0, recall: 0, cards: 0 };

  for (const course of courses) {
    await client.query(
      `INSERT INTO courses (id, code, title, term, description, icon, color, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         code = EXCLUDED.code, title = EXCLUDED.title, term = EXCLUDED.term,
         description = EXCLUDED.description, icon = EXCLUDED.icon,
         color = EXCLUDED.color, sort_order = EXCLUDED.sort_order`,
      [
        course.id,
        course.code ?? course.id.toUpperCase(),
        course.title,
        course.term ?? null,
        course.description ?? null,
        course.icon ?? "📘",
        course.color ?? "plum",
        course.sortOrder ?? 0,
      ],
    );
    stats.courses++;

    let chOrder = 0;
    for (const ch of course.chapters ?? []) {
      chOrder++;
      await client.query(
        `INSERT INTO chapters (id, course_id, code, title, summary, est_minutes, sort_order, facts, ninja_topics, sections)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           course_id = EXCLUDED.course_id, code = EXCLUDED.code, title = EXCLUDED.title,
           summary = EXCLUDED.summary, est_minutes = EXCLUDED.est_minutes,
           sort_order = EXCLUDED.sort_order, facts = EXCLUDED.facts,
           ninja_topics = EXCLUDED.ninja_topics, sections = EXCLUDED.sections`,
        [
          ch.id,
          course.id,
          ch.code ?? null,
          ch.title,
          ch.summary ?? null,
          ch.estMinutes ?? 25,
          chOrder,
          JSON.stringify(ch.facts ?? []),
          JSON.stringify(ch.ninja ?? []),
          JSON.stringify(ch.sections ?? []),
        ],
      );
      stats.chapters++;

      let obOrder = 0;
      for (const raw of ch.objectives ?? []) {
        obOrder++;
        // Målen kan vara färdiga strängar ("1.1.1 Kunna …") eller objekt {code,title,level}
        const ob =
          typeof raw === "string"
            ? (() => {
                const m = /^(\d+(?:\.\d+){1,3})\s+(.*)$/.exec(raw.trim());
                return m ? { code: m[1], title: m[2], level: "kunna" } : { code: null, title: raw, level: "kunna" };
              })()
            : raw;
        if (!ob.title) continue;
        await client.query(
          `INSERT INTO objectives (id, chapter_id, code, title, level, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO UPDATE SET
             chapter_id = EXCLUDED.chapter_id, code = EXCLUDED.code, title = EXCLUDED.title,
             level = EXCLUDED.level, sort_order = EXCLUDED.sort_order`,
          [
            `${ch.id}-ob${obOrder}`,
            ch.id,
            ob.code ?? null,
            ob.title,
            ob.level ?? "kunna",
            obOrder,
          ],
        );
        stats.objectives++;
      }

      let qOrder = 0;
      for (const q of ch.recall ?? []) {
        qOrder++;
        await client.query(
          `INSERT INTO recall_items (id, chapter_id, kind, prompt, options, answer, explanation, difficulty, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET
             chapter_id = EXCLUDED.chapter_id, kind = EXCLUDED.kind, prompt = EXCLUDED.prompt,
             options = EXCLUDED.options, answer = EXCLUDED.answer,
             explanation = EXCLUDED.explanation, difficulty = EXCLUDED.difficulty,
             sort_order = EXCLUDED.sort_order`,
          [
            q.id,
            ch.id,
            q.kind ?? "mcq",
            q.prompt,
            q.options ? JSON.stringify(q.options) : null,
            q.answer,
            q.explanation ?? null,
            q.difficulty ?? 1,
            qOrder,
          ],
        );
        stats.recall++;
      }

      let cOrder = 0;
      for (const c of ch.cards ?? []) {
        cOrder++;
        await client.query(
          `INSERT INTO chapter_cards (id, chapter_id, front, back, sort_order)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO UPDATE SET
             chapter_id = EXCLUDED.chapter_id, front = EXCLUDED.front,
             back = EXCLUDED.back, sort_order = EXCLUDED.sort_order`,
          [`${ch.id}-c${cOrder}`, ch.id, c.front, c.back, cOrder],
        );
        stats.cards++;
      }
    }
  }

  const chapterIds = courses.flatMap((c) => (c.chapters ?? []).map((ch) => ch.id));

  // Ta bort kapitel som inte längre finns i innehållsfilerna (t.ex. vid omläggning
  // till nya moduler). Kaskaderar till mål, frågor och kapitelkort.
  if (chapterIds.length) {
    const removed = await client.query(
      `DELETE FROM chapters WHERE id <> ALL($1::text[]) RETURNING id`,
      [chapterIds],
    );
    if (removed.rowCount) {
      console.log(`- tog bort ${removed.rowCount} kapitel som inte längre finns i innehållet`);
    }
  }

  await client.end();
  console.log(
    `✓ seed klar: ${stats.courses} kurser · ${stats.chapters} kapitel · ${stats.objectives} lärandemål · ${stats.recall} frågor · ${stats.cards} kort`,
  );
}

main().catch((err) => {
  console.error("✗ seed misslyckades:", err.message);
  process.exit(1);
});
