"use client";

import McqBlock from "@/components/McqBlock";
import type { GradeResult } from "@/lib/types";

export default function Message({
  role,
  content,
  streaming,
  onAnswer,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  onAnswer: (text: string) => void;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="claude-user-bubble max-w-[82%] whitespace-pre-wrap px-4 py-2.5 text-[15px] leading-relaxed">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="claude-avatar mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px]">
        K
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="mb-1 text-2xs font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--claude-muted)" }}
        >
          Karolina
        </p>
        <div className="claude-prose">
          {content ? (
            <McqBlock text={content} onAnswer={onAnswer} />
          ) : (
            <TypingDots />
          )}
          {streaming && content && (
            <span
              className="ml-0.5 inline-block h-4 w-[2px] animate-pulse align-text-bottom"
              style={{ background: "var(--claude-accent)" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full"
          style={{ background: "var(--claude-accent)", animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export function GradeCard({ grade }: { grade: GradeResult }) {
  const label = ["", "Igen", "Svårt", "Bra", "Lätt"][grade.rating];
  const tone =
    grade.rating >= 4
      ? { bg: "var(--claude-accent)", color: "#fff" }
      : grade.rating === 3
        ? { bg: "var(--claude-accent-soft)", color: "var(--claude-accent)" }
        : grade.rating === 2
          ? { bg: "var(--claude-accent-soft)", color: "var(--claude-ink)" }
          : { bg: "var(--claude-user-bubble)", color: "var(--claude-ink)" };

  return (
    <div
      className="animate-fade-in-up rounded-2xl p-4"
      style={{ border: "1px solid var(--claude-border)", background: "var(--claude-input)" }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-2xs font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--claude-muted)" }}
        >
          Examinatorns bedömning
        </p>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: tone.bg, color: tone.color }}
        >
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium" style={{ color: "var(--claude-ink)" }}>
        {grade.verdict}
      </p>

      {grade.strengths.length > 0 && (
        <div className="mt-3">
          <p className="text-2xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--claude-accent)" }}>
            Styrkor
          </p>
          <ul className="mt-1 space-y-0.5">
            {grade.strengths.map((s) => (
              <li key={s} className="text-xs" style={{ color: "var(--claude-ink)" }}>
                ✓ {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {grade.gaps.length > 0 && (
        <div className="mt-3">
          <p className="text-2xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--claude-muted)" }}>
            Luckor
          </p>
          <ul className="mt-1 space-y-0.5">
            {grade.gaps.map((s) => (
              <li key={s} className="text-xs" style={{ color: "var(--claude-ink)" }}>
                • {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {grade.reference_answer && (
        <div className="mt-3 rounded-xl p-3" style={{ background: "var(--claude-accent-soft)" }}>
          <p className="text-2xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--claude-muted)" }}>
            Referenssvar
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--claude-ink)" }}>
            {grade.reference_answer}
          </p>
        </div>
      )}

      {grade.next_question && (
        <p className="mt-3 text-xs italic" style={{ color: "var(--claude-muted)" }}>
          Nästa gång: {grade.next_question}
        </p>
      )}
    </div>
  );
}
