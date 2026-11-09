/**
 * Tolkar kursernas lärandemåls-PDF:er ("Sammanställda lärandemål") till struktur:
 *   kurs → modul → sektion (kapitel) → lärandemål
 *
 *   node scripts/parse-objectives.mjs /tmp/bv1.txt …   (skriver src/content/_objectives/<kurs>.json)
 *
 * Används som underlag när kapitelindelningen ska spegla hela kursens moduler.
 */
import fs from "node:fs";
import path from "node:path";

const TOC_LINE = /^(.*?)[.\s]{3,}\s*(\d{1,3})\s*$/;

function joinWrapped(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const complete = TOC_LINE.test(line) && /\.{3,}/.test(line);
    if (complete) {
      out.push(line);
      continue;
    }
    // Rubrik som brutits över två rader: "1.8.3 ... utveckling .... 24"
    if (/^\s*[\d.]+\s*\S/.test(line) && !/\.{3,}/.test(line)) {
      let merged = line.trim();
      let j = i + 1;
      while (j < lines.length && j <= i + 2 && !/\.{3,}/.test(merged)) {
        merged += " " + lines[j].trim();
        j++;
      }
      if (/\.{3,}/.test(merged)) {
        out.push(merged);
        i = j - 1;
        continue;
      }
    }
  }
  return out;
}

function cleanTitle(t) {
  return t
    .replace(/\s+/g, " ")
    .replace(/^[\s.:–-]+/, "")
    .replace(/[\s.]+$/, "")
    .trim();
}

export function parseObjectives(text, courseLabel) {
  const lines = text.split(/\r?\n/);

  // TOC börjar efter "Innehåll"
  const start = lines.findIndex((l) => /^\s*Innehåll\s*$/.test(l));
  const body = lines.slice(start > 0 ? start + 1 : 0).slice(0, 500);

  const entries = joinWrapped(body)
    .map((line) => {
      const m = TOC_LINE.exec(line.trim());
      if (!m) return null;
      const title = cleanTitle(m[1]);
      if (!title || title.length < 2) return null;
      const num = /^(\d+(?:\.\d+){0,2})\b/.exec(title);
      if (!num) return null;
      const code = num[1];
      const rest = cleanTitle(title.slice(code.length));
      // Sidnummer som råkat hamna först i raden (t.ex. "31 1.3 ...") ger orimliga koder
      if (Number(code.split(".")[0]) > 20) return null;
      if (!rest || rest.length < 2) return null;
      return { code, title: rest, page: Number(m[2]) };
    })
    .filter(Boolean)
    .filter((e) => e.page > 0);

  const modules = [];
  const byNumber = new Map();

  // Modultitlar: plocka från rader som "1 Modul 1 – Sensorik"
  const moduleTitles = new Map();
  for (const line of body) {
    const m = /^\s*(\d{1,2})\s+Modul\s*(\d{1,2})\s*[–-]?\s*(.*?)\.{3,}\s*\d+\s*$/.exec(line);
    if (m) {
      const num = Number(m[1]);
      const name = cleanTitle(m[3]);
      if (name && name.length > 2) moduleTitles.set(num, name);
    }
  }

  const seenSections = new Set();

  for (const e of entries) {
    const depth = e.code.split(".").length;
    if (depth !== 2) continue; // sektioner; målen hänger på sektionen

    const modNum = Number(e.code.split(".")[0]);
    if (!Number.isFinite(modNum) || modNum < 1 || modNum > 20) continue;

    const key = e.code;
    if (seenSections.has(key)) continue;
    seenSections.add(key);

    if (!byNumber.has(modNum)) {
      const mod = {
        code: `Modul ${modNum}`,
        title: moduleTitles.get(modNum) ?? "",
        sections: [],
      };
      byNumber.set(modNum, mod);
      modules.push(mod);
    }
    byNumber.get(modNum).sections.push({ code: e.code, title: e.title, objectives: [] });
  }

  // Lärandemål (nivå 3) kopplas till rätt sektion
  for (const e of entries) {
    const depth = e.code.split(".").length;
    if (depth !== 3) continue;
    const modNum = Number(e.code.split(".")[0]);
    const mod = byNumber.get(modNum);
    if (!mod) continue;
    const secCode = e.code.split(".").slice(0, 2).join(".");
    const sec = mod.sections.find((s) => s.code === secCode);
    if (sec) sec.objectives.push(`${e.code} ${e.title}`.trim());
  }

  // Städa: ta bort tomma moduler, sortera på kod
  const sortByCode = (a, b) => {
    const pa = a.code.split(".").map(Number);
    const pb = b.code.split(".").map(Number);
    return pa[0] - pb[0] || (pa[1] ?? 0) - (pb[1] ?? 0);
  };

  // Fyll luckor: rubriker som finns i brödtexten men missats i innehållsförteckningen
  for (const line of lines) {
    const m = /^\s{0,6}(\d{1,2}\.\d{1,2})\s+([A-ZÅÄÖ][^\t]{2,80})$/.exec(line);
    if (!m) continue;
    const code = m[1];
    const modNum = Number(code.split(".")[0]);
    if (modNum < 1 || modNum > 20) continue;
    const mod = byNumber.get(modNum);
    if (!mod) continue;
    if (mod.sections.some((s) => s.code === code)) continue;
    const title = cleanTitle(m[2]);
    if (!title || /\.{3,}|\d$/.test(title)) continue;
    mod.sections.push({ code, title, objectives: [] });
    seenSections.add(code);
  }

  for (const m of modules) {
    m.sections.sort(sortByCode);
    if (!m.title) m.title = `Modul ${m.code.replace(/\D/g, "")}`;
  }
  modules.sort((a, b) => Number(a.code.replace(/\D/g, "")) - Number(b.code.replace(/\D/g, "")));

  return {
    course: courseLabel,
    modules: modules.filter((m) => m.sections.length > 0),
  };
}

// CLI
if (process.argv[2]) {
  const outDir = path.join(process.cwd(), "src", "content", "_objectives");
  fs.mkdirSync(outDir, { recursive: true });

  for (const file of process.argv.slice(2)) {
    const name = path.basename(file, ".txt");
    const parsed = parseObjectives(fs.readFileSync(file, "utf8"), name);
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(parsed, null, 2) + "\n");
    const sections = parsed.modules.reduce((n, m) => n + m.sections.length, 0);
    const objectives = parsed.modules.reduce(
      (n, m) => n + m.sections.reduce((k, s) => k + s.objectives.length, 0),
      0,
    );
    console.log(`${name}: ${parsed.modules.length} moduler · ${sections} sektioner · ${objectives} mål`);
  }
}
