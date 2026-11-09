/**
 * Exporterar ALLT innehåll (kurser, moduler, mål, frågor, kort, begreppspar)
 * till db/content.sql – enbart idempotenta upserts.
 *
 *   node scripts/export-content.mjs
 *
 * Inga användarkonton, ingen progress, inga loggar. Borttaget innehåll
 * arkiveras (archived = true) i stället för att raderas, så att användarnas
 * framsteg och kort aldrig kan kaskadraderas.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { loadEnv, pgConfig } from "./env.mjs";

loadEnv();

const OUT = path.join(process.cwd(), "db", "content.sql");
const CONTENT_DIR = path.join(process.cwd(), "src", "content", "courses");

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonb(value) {
  if (value === null || value === undefined) return "NULL";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `${sqlString(text)}::jsonb`;
}

function officialIds() {
  const courses = new Set();
  const chapters = new Set();
  for (const file of fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json"))) {
    const course = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8"));
    if (course.id) courses.add(course.id);
    for (const ch of course.chapters ?? []) chapters.add(ch.id);
  }
  return { courses, chapters };
}

async function main() {
  const { courses: officialCourses, chapters: officialChapters } = officialIds();

  const client = new Client(pgConfig());
  await client.connect();

  const q = async (sql) => (await client.query(sql)).rows;

  const courses = await q(`SELECT * FROM courses ORDER BY sort_order, code`);
  const chapters = await q(`SELECT * FROM chapters ORDER BY course_id, sort_order`);
  const objectives = await q(`SELECT * FROM objectives ORDER BY chapter_id, sort_order`);
  const recall = await q(`SELECT * FROM recall_items ORDER BY chapter_id, sort_order`);
  const cards = await q(`SELECT * FROM chapter_cards ORDER BY chapter_id, sort_order`);
  const pairs = await q(`SELECT * FROM match_pairs ORDER BY chapter_id, id`);

  await client.end();

  const lines = [];
  lines.push("-- DrPlugg – innehåll exporterat från utvecklingsdatabasen.");
  lines.push("-- Enbart upserts. Innehåll som tagits bort arkiveras, raderas aldrig.");
  lines.push(`-- Genererad: ${new Date().toISOString()}`);
  lines.push(`-- Rader: ${courses.length} kurser, ${chapters.length} moduler, ${objectives.length} mål,`);
  lines.push(`--        ${recall.length} frågor, ${cards.length} kort, ${pairs.length} begreppspar.`);
  lines.push("");
  lines.push("");

  lines.push("-- Kurser");
  for (const c of courses) {
    const archived = officialCourses.has(c.id) ? "false" : "true";
    lines.push(
      `INSERT INTO courses (id, code, title, term, description, icon, color, sort_order, archived)
VALUES (${sqlString(c.id)}, ${sqlString(c.code)}, ${sqlString(c.title)}, ${sqlString(c.term)}, ${sqlString(c.description)}, ${sqlString(c.icon)}, ${sqlString(c.color)}, ${Number(c.sort_order) || 0}, ${archived})
ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, title = EXCLUDED.title, term = EXCLUDED.term,
  description = EXCLUDED.description, icon = EXCLUDED.icon, color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order, archived = EXCLUDED.archived;`,
    );
  }

  lines.push("");
  lines.push("-- Moduler");
  for (const c of chapters) {
    const archived = officialChapters.has(c.id) ? "false" : "true";
    lines.push(
      `INSERT INTO chapters (id, course_id, code, title, summary, est_minutes, sort_order, facts, ninja_topics, sections, archived)
VALUES (${sqlString(c.id)}, ${sqlString(c.course_id)}, ${sqlString(c.code)}, ${sqlString(c.title)}, ${sqlString(c.summary)}, ${Number(c.est_minutes) || 25}, ${Number(c.sort_order) || 0}, ${jsonb(c.facts)}, ${jsonb(c.ninja_topics)}, ${jsonb(c.sections)}, ${archived})
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, code = EXCLUDED.code, title = EXCLUDED.title,
  summary = EXCLUDED.summary, est_minutes = EXCLUDED.est_minutes, sort_order = EXCLUDED.sort_order,
  facts = EXCLUDED.facts, ninja_topics = EXCLUDED.ninja_topics, sections = EXCLUDED.sections,
  archived = EXCLUDED.archived;`,
    );
  }

  lines.push("");
  lines.push("-- Lärandemål");
  for (const o of objectives) {
    lines.push(
      `INSERT INTO objectives (id, chapter_id, code, title, level, sort_order)
VALUES (${sqlString(o.id)}, ${sqlString(o.chapter_id)}, ${sqlString(o.code)}, ${sqlString(o.title)}, ${sqlString(o.level)}, ${Number(o.sort_order) || 0})
ON CONFLICT (id) DO UPDATE SET chapter_id = EXCLUDED.chapter_id, code = EXCLUDED.code,
  title = EXCLUDED.title, level = EXCLUDED.level, sort_order = EXCLUDED.sort_order;`,
    );
  }

  lines.push("");
  lines.push("-- Återkallningsfrågor (kapitelmaterial + AI-genererade, faktagranskade)");
  for (const r of recall) {
    lines.push(
      `INSERT INTO recall_items (id, chapter_id, objective_id, kind, prompt, options, answer, explanation, difficulty, sort_order, origin, fact_checked)
VALUES (${sqlString(r.id)}, ${sqlString(r.chapter_id)}, ${sqlString(r.objective_id)}, ${sqlString(r.kind)}, ${sqlString(r.prompt)}, ${jsonb(r.options)}, ${sqlString(r.answer)}, ${sqlString(r.explanation)}, ${Number(r.difficulty) || 1}, ${Number(r.sort_order) || 0}, ${sqlString(r.origin)}, ${r.fact_checked ? "true" : "false"})
ON CONFLICT (id) DO UPDATE SET chapter_id = EXCLUDED.chapter_id, objective_id = EXCLUDED.objective_id,
  kind = EXCLUDED.kind, prompt = EXCLUDED.prompt, options = EXCLUDED.options, answer = EXCLUDED.answer,
  explanation = EXCLUDED.explanation, difficulty = EXCLUDED.difficulty, sort_order = EXCLUDED.sort_order,
  origin = EXCLUDED.origin, fact_checked = EXCLUDED.fact_checked;`,
    );
  }

  lines.push("");
  lines.push("-- Flashcards (kapitelmaterial + importerat Anki-material)");
  for (const c of cards) {
    lines.push(
      `INSERT INTO chapter_cards (id, chapter_id, front, back, sort_order, origin)
VALUES (${sqlString(c.id)}, ${sqlString(c.chapter_id)}, ${sqlString(c.front)}, ${sqlString(c.back)}, ${Number(c.sort_order) || 0}, ${sqlString(c.origin)})
ON CONFLICT (id) DO UPDATE SET chapter_id = EXCLUDED.chapter_id, front = EXCLUDED.front,
  back = EXCLUDED.back, sort_order = EXCLUDED.sort_order, origin = EXCLUDED.origin;`,
    );
  }

  lines.push("");
  lines.push("-- Begreppspar (Termmatch)");
  for (const p of pairs) {
    lines.push(
      `INSERT INTO match_pairs (chapter_id, term, definition, origin)
VALUES (${sqlString(p.chapter_id)}, ${sqlString(p.term)}, ${sqlString(p.definition)}, ${sqlString(p.origin)})
ON CONFLICT (chapter_id, term) DO UPDATE SET definition = EXCLUDED.definition, origin = EXCLUDED.origin;`,
    );
  }

  lines.push("");
  lines.push("");

  const sql = lines.join("\n");

  // ── Hårda grindar ────────────────────────────────────────
  const forbiddenTables = [
    "users",
    "flashcards",
    "review_logs",
    "chapter_progress",
    "game_attempts",
    "daily_activity",
    "docs",
    "doc_chunks",
    "chat_sessions",
    "messages",
    "admin_audit",
    "mail_outbox",
    "email_verifications",
    "feature_flags",
  ];
  const lower = sql.toLowerCase();
  for (const table of forbiddenTables) {
    if (lower.includes(`insert into ${table}`) || lower.includes(`insert into public.${table}`)) {
      console.error(`✗ content.sql innehåller INSERT i förbjuden tabell: ${table}`);
      process.exit(1);
    }
  }

  if (/\b(delete|truncate|drop)\b/i.test(sql.replace(/--.*$/gm, ""))) {
    console.error("✗ content.sql innehåller DELETE/TRUNCATE/DROP – tillåts inte.");
    process.exit(1);
  }

  const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const emailMatch = sql.match(email);
  if (emailMatch) {
    console.error(`✗ content.sql innehåller en e-postadress (${emailMatch[0]}) – avbryter.`);
    process.exit(1);
  }

  const secrets = ["JWT_SECRET", "PGPASSWORD", "DEEPSEEK_API_KEY", "ADMIN_PASSWORD"]
    .map((key) => process.env[key])
    .filter((v) => typeof v === "string" && v.length >= 8);
  for (const secret of secrets) {
    if (sql.includes(secret)) {
      console.error("✗ content.sql innehåller ett hemligt värde från .env.local – avbryter.");
      process.exit(1);
    }
  }

  fs.writeFileSync(OUT, sql);
  const kb = (Buffer.byteLength(sql) / 1024).toFixed(0);
  console.log(`✓ ${OUT} skriven (${kb} kB)`);
  console.log(
    `  ${courses.length} kurser · ${chapters.length} moduler · ${objectives.length} mål · ${recall.length} frågor · ${cards.length} kort · ${pairs.length} begreppspar`,
  );
  const archivedChapters = chapters.filter((c) => !officialChapters.has(c.id)).length;
  if (archivedChapters > 0) console.log(`  ${archivedChapters} moduler arkiveras (finns inte i innehållsfilerna)`);
}

main().catch((err) => {
  console.error("✗ export misslyckades:", err.message);
  process.exit(1);
});
