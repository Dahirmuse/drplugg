/**
 * Bygger kapitelplan (en kapitel = en modul) från de tolkade lärandemålen.
 *
 *   node scripts/plan-modules.mjs
 *
 * Läser src/content/_objectives/<kurs>.json och skriver
 * src/content/_plans/<kurs>.json med fält som innehållsfilerna behöver.
 */
import fs from "node:fs";
import path from "node:path";

const IN = path.join(process.cwd(), "src", "content", "_objectives");
const OUT = path.join(process.cwd(), "src", "content", "_plans");
fs.mkdirSync(OUT, { recursive: true });

const COURSES = ["bv1", "bv2", "bv3", "bv4", "bv5", "bv6", "mdbi"];

function titleCase(s) {
  if (!s) return s;
  const t = s.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const VERB_START = /^(redogöra|resonera|beskriva|kunna|ge exempel|förklara|identifiera|tillämpa|analysera|värdera|utföra|visa)\b/i;

function moduleTitle(mod) {
  const own = (mod.title ?? "").replace(/^Modul\s*\d+\s*[–-]?\s*/i, "").trim();
  if (own && own.length > 2 && !/^modul\s*\d+$/i.test(own)) return titleCase(own);

  // Härled en kort titel ur sektionerna när PDF:en saknar modulnamn
  const names = mod.sections
    .map((s) => s.title.replace(/^Modul\s*\d+\s*[–-]\s*/i, "").trim())
    .filter((t) => t && t.length <= 42 && !VERB_START.test(t));

  const num = mod.code.replace(/\D/g, "");
  if (names.length === 0) return `Modul ${num}`;
  const base = titleCase(names[0]);
  return mod.sections.length > 1 ? `Modul ${num} – ${base} m.fl.` : `Modul ${num} – ${base}`;
}

for (const course of COURSES) {
  const src = path.join(IN, `${course}.json`);
  if (!fs.existsSync(src)) continue;
  const parsed = JSON.parse(fs.readFileSync(src, "utf8"));

  const chapters = parsed.modules.map((mod, i) => ({
    id: `${course}-m${i + 1}`,
    code: mod.code,
    title: moduleTitle(mod),
    sections: mod.sections.map((s) => ({
      code: s.code,
      title: titleCase(s.title),
    })),
    objectives: mod.sections.flatMap((s) =>
      s.objectives.length
        ? s.objectives
        : [`${s.code} ${titleCase(s.title)}`],
    ),
  }));

  const out = { course, chapters };
  fs.writeFileSync(path.join(OUT, `${course}.json`), JSON.stringify(out, null, 2) + "\n");

  const objCount = chapters.reduce((n, c) => n + c.objectives.length, 0);
  console.log(
    `${course}: ${chapters.length} kapitel (moduler) · ${chapters.reduce(
      (n, c) => n + c.sections.length,
      0,
    )} sektioner · ${objCount} lärandemål`,
  );
}
