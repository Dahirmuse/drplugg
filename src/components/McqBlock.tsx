"use client";

import { useState } from "react";
import { parseMCQ, type MCQBlock as MCQBlockData } from "@/lib/mcq";
import { formatInline, formatMarkdown } from "@/lib/markdown";
import { LETTERS, shuffleArray } from "@/lib/shuffle";

function Html({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Tar bort "Rätt svar: A"-rader – appen markerar rätt alternativ själv. */
function stripReveal(text: string): string {
  return text
    .split(/\n/)
    .filter(
      (line) =>
        !/^\s*(\*\*)?(rätt svar|korrekt svar|facit|svaret är)(\*\*)?\s*[:\-]/i.test(line),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function Block({ block, onAnswer }: { block: MCQBlockData; onAnswer: (t: string) => void }) {
  // Blanda en gång per fråga (komponenten monteras per block) så att rätt svar
  // inte alltid hamnar först. Bokstäverna räknas om efter den nya ordningen.
  const [display] = useState(() => {
    const shuffled = shuffleArray(block.options);
    const letters = LETTERS.slice(0, shuffled.length);
    const options = shuffled.map((o, i) => ({ ...o, letter: letters[i] }));
    const correctIndex = block.correct
      ? shuffled.findIndex((o) => o.letter === block.correct)
      : -1;
    return { options, correct: correctIndex >= 0 ? letters[correctIndex] : null };
  });

  const [picked, setPicked] = useState<string | null>(null);
  const answered = picked !== null;

  return (
    <>
      {block.preamble.trim() && <Html html={formatMarkdown(stripReveal(block.preamble))} />}
      <div className="my-3 space-y-1.5">
        {display.options.map((opt) => {
          let style: React.CSSProperties | undefined;
          if (answered) {
            if (display.correct) {
              if (opt.letter === display.correct)
                style = { borderColor: "#54B986", background: "rgba(84,185,134,0.12)" };
              else if (opt.letter === picked)
                style = { borderColor: "#B84145", background: "rgba(184,65,69,0.10)" };
              else style = { opacity: 0.55 };
            } else if (opt.letter === picked) {
              style = {
                borderColor: "var(--claude-accent)",
                background: "var(--claude-accent-soft)",
              };
            }
          }
          return (
            <button
              key={opt.letter}
              className="claude-option"
              style={style}
              disabled={answered}
              onClick={() => {
                setPicked(opt.letter);
                onAnswer(`${opt.letter}) ${opt.text}`);
              }}
            >
              <span className="claude-option-letter flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-2xs">
                {opt.letter}
              </span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(opt.text) }} />
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function McqBlock({
  text,
  onAnswer,
}: {
  text: string;
  onAnswer: (text: string) => void;
}) {
  const parsed = parseMCQ(text);
  if (!parsed.isMcq) {
    return <div dangerouslySetInnerHTML={{ __html: formatMarkdown(text) }} />;
  }
  return (
    <>
      {parsed.blocks.map((block, i) => (
        <Block key={i} block={block} onAnswer={onAnswer} />
      ))}
      {stripReveal(parsed.trailing).trim() && (
        <div dangerouslySetInnerHTML={{ __html: formatMarkdown(stripReveal(parsed.trailing)) }} />
      )}
    </>
  );
}
