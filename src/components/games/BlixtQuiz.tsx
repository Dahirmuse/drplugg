"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shuffleIndexed } from "@/lib/shuffle";
import NewQuestionsPanel from "@/components/games/NewQuestionsPanel";

export interface GameQuestion {
  id: string;
  chapterTitle: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string | null;
}

export default function BlixtQuiz({
  chapterId,
  courseId,
  onFinish,
}: {
  chapterId: string | null;
  courseId?: string | null;
  onFinish: () => void;
}) {
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(15);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const startedAt = useRef(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (chapterId) params.set("chapterId", chapterId);
      else if (courseId) params.set("courseId", courseId);
      const res = await fetch(`/api/games/questions?${params.toString()}`);
      const data = await res.json();
      setQuestions(
        (data.questions ?? []).slice(0, 10).map((q: GameQuestion) => {
          const shuffled = shuffleIndexed(q.options, q.answerIndex);
          return { ...q, options: shuffled.options, answerIndex: shuffled.answerIndex };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    load();
  }, [load]);

  const q = questions[idx];

  const answer = useCallback(
    (choice: number) => {
      if (picked !== null || !q) return;
      setPicked(choice);
      const correct = choice === q.answerIndex;
      if (correct) {
        const gain = 10 + Math.min(10, streak * 2) + Math.max(0, Math.round(left / 3));
        setScore((s) => s + gain);
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }
    },
    [left, picked, q, streak],
  );

  const restart = useCallback(() => {
    setQuestions([]);
    setIdx(0);
    setScore(0);
    setStreak(0);
    setPicked(null);
    setLeft(15);
    setDone(false);
    startedAt.current = Date.now();
    load();
  }, [load]);

  // Timer
  useEffect(() => {
    if (!q || picked !== null) return;
    if (left <= 0) {
      answer(-1);
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, q, picked, answer]);

  async function next() {
    if (idx + 1 >= questions.length) {
      setDone(true);
      await fetch("/api/games/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: "blixtquiz",
          chapterId,
          score,
          maxScore: questions.length * 30,
          durationMs: Date.now() - startedAt.current,
        }),
      });
      return;
    }
    setIdx(idx + 1);
    setPicked(null);
    setLeft(15);
  }

  if (loading) return <p className="py-10 text-center text-sm text-grey">Laddar frågor…</p>;

  if (questions.length === 0)
    return (
      <p className="py-10 text-center text-sm text-grey">
        Inga frågor hittades för det valda kapitlet.
      </p>
    );

  if (done) {
    return (
      <div className="animate-scale-in py-8 text-center">
        <p className="text-4xl">⚡</p>
        <h3 className="mt-2 text-xl font-bold text-plum-dark">Blixtquiz klart!</h3>
        <p className="mt-1 text-sm text-grey">
          {score} poäng · {questions.length} frågor
        </p>
        <NewQuestionsPanel
          chapterId={chapterId}
          courseId={courseId ?? null}
          onRestart={restart}
          label="Spela igen med nya frågor"
        />
        <div className="mt-3 flex justify-center gap-2">
          <button onClick={restart} className="dp-btn dp-btn-ghost">
            Spela igen
          </button>
          <button onClick={onFinish} className="dp-btn dp-btn-ghost">
            Till spelen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-plum-dark">
          {idx + 1}/{questions.length}
        </span>
        <span className="flex gap-3">
          <span className="text-grey">
            🔥 streak <strong className="text-plum-dark">{streak}</strong>
          </span>
          <span className="text-grey">
            ⭐ <strong className="text-plum-dark tabular-nums">{score}</strong>
          </span>
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[--grey-light]">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            left <= 5 ? "bg-[--red]" : "bg-plum"
          }`}
          style={{ width: `${(left / 15) * 100}%` }}
        />
      </div>

      <p className="mt-4 text-2xs font-bold uppercase tracking-wider text-grey">
        {q.chapterTitle}
      </p>
      <p className="mt-1 text-[15px] font-medium leading-relaxed text-plum-dark">{q.prompt}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const revealed = picked !== null;
          let cls = "rounded-2xl border-2 bg-white px-3.5 py-2.5 text-left text-sm transition-all";
          if (!revealed) cls += " border-[--grey-light] hover:border-plum hover:bg-[--orange-light]";
          else if (i === q.answerIndex) cls += " border-[--green] bg-[--green-light]";
          else if (i === picked) cls += " border-[--red] bg-red-50";
          else cls += " border-[--grey-light] opacity-50";
          return (
            <button key={opt} onClick={() => answer(i)} disabled={revealed} className={cls}>
              {opt}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="mt-3 animate-fade-in-up">
          {q.explanation && (
            <p className="rounded-xl bg-[--grey-light] p-3 text-xs leading-relaxed text-plum-dark">
              {q.explanation}
            </p>
          )}
          <button onClick={next} className="dp-btn dp-btn-primary mt-3 w-full">
            {idx + 1 >= questions.length ? "Visa resultat" : "Nästa →"}
          </button>
        </div>
      )}
    </div>
  );
}
