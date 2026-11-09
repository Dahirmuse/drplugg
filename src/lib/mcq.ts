// Detektering och parsning av flervalsfrågor (MCQ) i AI-svar.

export interface MCQOption {
  letter: string;
  text: string;
}

export interface MCQBlock {
  preamble: string;
  options: MCQOption[];
  correct: string | null;
}

export type MCQParse =
  | { isMcq: false }
  | { isMcq: true; blocks: MCQBlock[]; trailing: string };

export function detectCorrectAnswer(text: string): string | null {
  const patterns = [
    /r[äa]tt\s+svar[:\s]+\**([A-E])\b/i,
    /korrekt\s+svar[:\s]+\**([A-E])\b/i,
    /svaret\s+är\s+\**([A-E])\b/i,
    /facit[:\s]+\**([A-E])\b/i,
    /\*\*([A-E])\)\s/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export function parseMCQ(text: string): MCQParse {
  const optionRe = /^\*{0,2}([A-E])\*{0,2}[).]\*{0,2}\s+(.+)$/gm;
  const allMatches = [...text.matchAll(optionRe)];
  if (allMatches.length < 3) return { isMcq: false };

  const groups: RegExpMatchArray[][] = [];
  let current: RegExpMatchArray[] = [];
  for (const m of allMatches) {
    if (m[1] === "A" && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(m);
  }
  if (current.length > 0) groups.push(current);
  if (groups.length === 0) return { isMcq: false };

  const blocks: MCQBlock[] = [];
  let cursor = 0;

  groups.forEach((group, gi) => {
    const blockStart = group[0].index ?? 0;
    const lastOpt = group[group.length - 1];
    const blockEnd = (lastOpt.index ?? 0) + lastOpt[0].length;

    const preamble = text.slice(cursor, blockStart);
    cursor = blockEnd;

    const nextBlockStart = groups[gi + 1]?.[0].index ?? text.length;
    const afterOptions = text.slice(blockEnd, nextBlockStart);
    const correct =
      detectCorrectAnswer(afterOptions) || detectCorrectAnswer(group.map((m) => m[0]).join("\n"));

    blocks.push({
      preamble,
      correct,
      options: group.map((m) => ({ letter: m[1], text: m[2].trim() })),
    });
  });

  return { isMcq: true, blocks, trailing: text.slice(cursor) };
}
