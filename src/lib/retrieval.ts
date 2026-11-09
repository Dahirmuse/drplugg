import { queryMany } from "./db";
import type { SourceSnippet } from "./prompts";

/**
 * Enkel, förutsägbar källsökning: vi poängsätter chunkar efter ordöverlapp
 * med frågan och kapiteltillhörighet. Ingen vektordatabas – men snabb,
 * deterministisk och lätt att byta ut mot embeddings senare.
 */
const STOP = new Set([
  "och", "att", "det", "som", "den", "på", "är", "av", "för", "med", "till", "en", "ett",
  "i", "om", "så", "kan", "hur", "vad", "varför", "vilka", "vilken", "the", "and", "of",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export async function snippetsFor(
  userId: string,
  chapterId: string | null,
  query: string,
  limit = 4,
): Promise<SourceSnippet[]> {
  const words = [...new Set(tokens(query))].slice(0, 12);
  if (words.length === 0) return [];

  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

  const rows = await queryMany<{
    heading: string | null;
    chapter_id: string | null;
    text: string;
    score: number;
  }>(
    `SELECT c.heading, c.chapter_id, c.text,
            (SELECT count(*) FROM regexp_matches(lower(c.text), $3, 'g'))::int
              + CASE WHEN c.chapter_id = $2 THEN 3 ELSE 0 END AS score
       FROM doc_chunks c
       JOIN docs d ON d.id = c.doc_id
      WHERE d.user_id = $1 AND lower(c.text) ~ $3
      ORDER BY score DESC, length(c.text) ASC
      LIMIT $4`,
    [userId, chapterId, pattern, limit],
  );

  return rows.map((r) => ({
    heading: r.heading,
    chapterId: r.chapter_id,
    text: r.text.slice(0, 1200),
  }));
}

/** Delar upp text i chunkar på rubriker (markdown) eller ~1200 tecken. */
export function chunkText(
  text: string,
  fallbackHeading: string | null,
): { heading: string | null; text: string }[] {
  const lines = text.split(/\r?\n/);
  const chunks: { heading: string | null; text: string }[] = [];
  let heading = fallbackHeading;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body.length > 40) {
      // Dela alltför långa avsnitt
      if (body.length > 1800) {
        for (let i = 0; i < body.length; i += 1400) {
          chunks.push({ heading, text: body.slice(i, i + 1400) });
        }
      } else {
        chunks.push({ heading, text: body });
      }
    }
    buffer = [];
  };

  for (const line of lines) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line.trim());
    if (m) {
      flush();
      heading = m[2].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return chunks.slice(0, 400);
}
