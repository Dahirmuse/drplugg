/**
 * Importerar Anki-kort, låter DeepSeek omformulera dem till rena svenska
 * flashcards och sorterar dem i rätt modul (kapitel).
 *
 *   python3 scripts/anki-extract.py /tmp/apkg/*.apkg > /tmp/anki-raw.jsonl
 *   npm run anki:import -- --file /tmp/anki-raw.jsonl --max 1200
 *
 * Skriptet är avbrottsbart: det sparar vilka kort som är klara och hoppar
 * över dem nästa gång.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { loadEnv, pgConfig } from "./env.mjs";

loadEnv();

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const FILE = arg("file", "data/anki/anki-raw.jsonl");
const MAX_CARDS = Number(arg("max", 1200));
const BATCH = Number(arg("batch", 10));
const STATE = arg("state", "data/anki/import-state.json");
const MAX_PER_CHAPTER = Number(arg("per-chapter", 160));

const DEEPSEEK_URL = `${(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "")}/v1/chat/completions`;
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

/** Gissa kurs utifrån deckets filnamn. */
function courseFromDeck(deck) {
  const d = decodeURIComponent(deck).toLowerCase();
  if (d.includes("mdbi")) return "mdbi";
  if (d.includes("mvtm")) return "mvtm";
  const bv = d.match(/bv\s*([1-6])/);
  if (bv) return `bv${bv[1]}`;
  const km = d.match(/km\s*([1-7])/);
  if (km) return `km${km[1]}`;
  if (d.includes("klinisk medicin 1")) return "km1";
  if (d.includes("klinisk medicin 2")) return "km2";
  if (d.includes("klinisk medicin 3")) return "km3";
  if (d.includes("klinisk medicin 4")) return "km4";
  if (d.includes("pediatrik")) return "km5";
  if (d.includes("gynekologi")) return "km6";
  if (d.includes("onkologi")) return "km7";
  if (d.includes("t5")) return "km1";
  if (d.includes("t6")) return "km2";
  if (d.includes("t7")) return "km3";
  return null;
}

function loadState() {
  try {
    return new Set(JSON.parse(fs.readFileSync(STATE, "utf8")));
  } catch {
    return new Set();
  }
}

function saveState(set) {
  fs.writeFileSync(STATE, JSON.stringify([...set]));
}

async function askDeepSeek(course, chapters, cards) {
  const chapterList = chapters
    .map((c) => `- ${c.id} | ${c.code} | ${c.title}`)
    .join("\n");

  const payload = cards
    .map(
      (c, i) =>
        `#${i}\nFRAM: ${c.front.slice(0, 700)}\nBAK: ${c.back.slice(0, 900)}`,
    )
    .join("\n\n");

  const system = `Du bygger ett svenskt studiebibliotek av flashcards för läkarprogrammet.
Du får kort från en studentens Anki-deck för kursen ${course.toUpperCase()} och ska
1) skriva om varje kort till ett rent flashcard på svenska – FRAM = en entydig fråga (max 25 ord), BAK = 1–3 meningar, korrekt och koncist,
2) rätta faktafel och städa bort sådant som är fel eller oanvändbart,
3) välja vilken modul (chapterId) kortet hör till utifrån listan.

REGLER
- Ett kort = ett faktum. Dela upp kort som innehåller flera fakta i flera kort.
- Hoppa över kort som är tomma, bildberoende, tentamensspecifika ("vilket år…") eller inte går att förstå utan bild.
- FRAM får inte avslöja svaret.
- Använd svensk medicinsk terminologi (latinska begrepp där det hör dit).
- Hitta inte på fakta som inte stöds av kortet.
- chapterId MÅSTE vara ett av id:na i listan.

Svara ENDAST med JSON:
{"cards":[{"i":0,"front":"...","back":"...","chapterId":"..."}]}
Om ett kort ska hoppas över: {"i":2,"skip":true}`;

  const user = `MODULER (chapterId | kod | titel)
${chapterList}

KORT ATT BEARBETA
${payload}`;

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek svarade ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("inget JSON i svaret");
  return JSON.parse(raw.slice(start, end + 1));
}

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("✗ DEEPSEEK_API_KEY saknas i .env.local");
    process.exit(1);
  }
  if (!fs.existsSync(FILE)) {
    console.error(`✗ hittar inte ${FILE}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean);
  const state = loadState();

  const client = new Client(pgConfig());
  await client.connect();

  const { rows: chapterRows } = await client.query(
    `SELECT id, course_id AS "courseId", code, title FROM chapters ORDER BY course_id, sort_order`,
  );
  const byCourse = new Map();
  for (const ch of chapterRows) {
    if (!byCourse.has(ch.courseId)) byCourse.set(ch.courseId, []);
    byCourse.get(ch.courseId).push(ch);
  }

  // Antal kort per kapitel (för att sprida materialet)
  const { rows: counts } = await client.query(
    `SELECT chapter_id AS id, count(*)::int AS n FROM chapter_cards GROUP BY chapter_id`,
  );
  const perChapter = new Map(counts.map((r) => [r.id, r.n]));

  const pending = [];
  for (const line of lines) {
    let card;
    try {
      card = JSON.parse(line);
    } catch {
      continue;
    }
    if (state.has(card.note)) continue;
    const course = courseFromDeck(card.deck || "");
    if (!course || !byCourse.has(course)) continue;
    const front = (card.fields?.[0] ?? "").trim();
    const back = (card.fields?.[1] ?? card.fields?.slice(1).join(" ") ?? "").trim();
    if (front.length < 3 || back.length < 3) continue;
    pending.push({ ...card, course, front, back });
  }

  console.log(
    `${pending.length} kort att bearbeta (max ${MAX_CARDS}), ${state.size} redan klara`,
  );

  let imported = 0;
  let skipped = 0;
  let done = 0;

  const byCoursePending = new Map();
  for (const c of pending) {
    if (!byCoursePending.has(c.course)) byCoursePending.set(c.course, []);
    byCoursePending.get(c.course).push(c);
  }

  for (const [course, cards] of byCoursePending) {
    const chapters = byCourse.get(course);
    const allowed = new Set(chapters.map((c) => c.id));

    for (let i = 0; i < cards.length; i += BATCH) {
      if (imported >= MAX_CARDS) break;
      const batch = cards.slice(i, i + BATCH);

      let parsed;
      try {
        parsed = await askDeepSeek(course, chapters, batch);
      } catch (err) {
        console.warn(`! ${course} batch ${i / BATCH}: ${err.message}`);
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }

      for (const item of parsed.cards ?? []) {
        const src = batch[Number(item.i)];
        if (!src) continue;
        if (item.skip) {
          state.add(src.note);
          skipped++;
          continue;
        }
        const front = String(item.front ?? "").trim();
        const back = String(item.back ?? "").trim();
        const chapterId = String(item.chapterId ?? "").trim();
        if (!front || !back || !allowed.has(chapterId)) {
          state.add(src.note);
          skipped++;
          continue;
        }
        if (front.length > 220 || back.length > 900) {
          state.add(src.note);
          skipped++;
          continue;
        }
        const count = perChapter.get(chapterId) ?? 0;
        if (count >= MAX_PER_CHAPTER) {
          state.add(src.note);
          skipped++;
          continue;
        }

        const dup = await client.query(
          `SELECT 1 FROM chapter_cards WHERE chapter_id = $1 AND lower(front) = lower($2) LIMIT 1`,
          [chapterId, front],
        );
        if (dup.rowCount) {
          state.add(src.note);
          skipped++;
          continue;
        }

        await client.query(
          `INSERT INTO chapter_cards (id, chapter_id, front, back, sort_order, origin)
           VALUES ($1,$2,$3,$4,$5,'anki-ai')
           ON CONFLICT (id) DO NOTHING`,
          [
            `anki-${src.note}-${Math.random().toString(36).slice(2, 6)}`,
            chapterId,
            front,
            back,
            count + 1,
          ],
        );
        perChapter.set(chapterId, count + 1);
        state.add(src.note);
        imported++;
      }

      done += batch.length;
      if ((i / BATCH) % 5 === 0) {
        saveState(state);
        console.log(
          `  ${course}: ${Math.min(i + BATCH, cards.length)}/${cards.length} bearbetade · ${imported} importerade totalt`,
        );
      }
      if (imported >= MAX_CARDS) break;
    }
    saveState(state);
    if (imported >= MAX_CARDS) break;
  }

  saveState(state);
  await client.end();
  console.log(
    `✓ klart: ${imported} kort importerade, ${skipped} överhoppade, ${done} bearbetade.`,
  );
}

main().catch((err) => {
  console.error("✗ import misslyckades:", err.message);
  process.exit(1);
});
