/**
 * Hämtar riktiga Ninja Nerd-videor för varje kapitel.
 *
 *   npm run videos
 *
 * Läser alla kapitels `ninja[].query` i src/content/courses/*.json,
 * söker på YouTube, filtrerar på kanalen "Ninja Nerd" och skriver
 * src/content/ninja-nerd.json (kapitel-id → videor).
 *
 * Skriptet är inkrementellt: kapitel som redan har videor hoppas över,
 * så det går att köra om tills alla är klara.
 */
import fs from "node:fs";
import path from "node:path";

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "courses");
const OUT = path.join(process.cwd(), "src", "content", "ninja-nerd.json");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchOnce(query) {
  const url =
    "https://www.youtube.com/results?search_query=" +
    encodeURIComponent(query) +
    "&sp=EgIQAQ%3D%3D";
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1" },
  });
  if (!res.ok) throw new Error(`YouTube svarade ${res.status}`);
  const html = await res.text();
  const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html);
  if (!m) return [];

  const data = JSON.parse(m[1]);
  const out = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (node.videoRenderer) {
      const v = node.videoRenderer;
      const title = (v.title?.runs ?? []).map((r) => r.text).join("");
      const channel = v.ownerText?.runs?.[0]?.text ?? "";
      if (v.videoId && title) out.push({ id: v.videoId, title, channel });
    }
    Object.values(node).forEach(walk);
  };
  walk(data);
  return out;
}

async function search(query, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await searchOnce(query);
    } catch (err) {
      lastErr = err;
      if (i < attempts) await sleep(5000 * i);
    }
  }
  throw lastErr;
}

function loadChapters() {
  const chapters = [];
  for (const file of fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json"))) {
    const course = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8"));
    for (const ch of course.chapters ?? []) {
      if (Array.isArray(ch.ninja) && ch.ninja.length) chapters.push(ch);
    }
  }
  return chapters;
}

function save(result) {
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
}

async function main() {
  const chapters = loadChapters();
  const result = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

  const todo = chapters.filter((ch) => !(Array.isArray(result[ch.id]) && result[ch.id].length));
  console.log(
    `${chapters.length} kapitel totalt · ${chapters.length - todo.length} har video · ${todo.length} kvar att söka`,
  );

  let found = 0;
  let missing = 0;

  for (const ch of todo) {
    const picks = [];
    for (const topic of ch.ninja) {
      try {
        const results = await search(topic.query);
        const hit = results.find((r) => /^ninja nerd$/i.test(r.channel.trim()));
        if (hit && !picks.some((p) => p.id === hit.id)) {
          picks.push({ id: hit.id, title: hit.title, channel: hit.channel });
        }
      } catch (err) {
        console.warn(`! ${ch.id}: ${err.message}`);
      }
      await sleep(1200 + Math.random() * 900);
    }

    if (picks.length) {
      result[ch.id] = picks;
      found++;
      save(result); // spara direkt så att en avbruten körning inte tappar arbete
      console.log(`✓ ${ch.id}: ${picks.map((p) => p.title).join(" | ")}`);
    } else {
      missing++;
      console.warn(`– ${ch.id}: ingen Ninja Nerd-träff (fallback till kanalsökning i UI:t)`);
    }
  }

  save(result);
  const total = Object.keys(result).length;
  console.log(`\nKlart: ${found} nya kapitel med video, ${missing} utan. ${total} kapitel har video totalt.`);
}

main().catch((err) => {
  console.error("✗ video-hämtning misslyckades:", err.message);
  process.exit(1);
});
