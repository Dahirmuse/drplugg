"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameQuestion } from "@/components/games/BlixtQuiz";
import { shuffleIndexed } from "@/lib/shuffle";
import NewQuestionsPanel from "@/components/games/NewQuestionsPanel";

export default function DiagnosDuellen({
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
  const [hidden, setHidden] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const startedAt = useRef(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "6" });
      if (chapterId) params.set("chapterId", chapterId);
      else if (courseId) params.set("courseId", courseId);
      const res = await fetch(`/api/games/questions?${params.toString()}`);
      const data = await res.json();
      setQuestions(
        (data.questions ?? []).map((q: GameQuestion) => {
          const shuffled = shuffleIndexed(q.options, q.answerIndex);
          return { ...q, options: shuffled.options, answerIndex: shuffled.answerIndex };
        }),
      );
      setIdx(0);
      setScore(0);
      setHidden([]);
      setPicked(null);
      setDone(false);
      startedAt.current = Date.now();
    } finally {
      setLoading(false);
    }
  }, [chapterId, courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const q = questions[idx];

  function hint() {
    if (!q || picked !== null) return;
    const wrong = q.options
      .map((_, i) => i)
      .filter((i) => i !== q.answerIndex && !hidden.includes(i));
    if (wrong.length <= 1) return;
    setHidden((prev) => [...prev, wrong[Math.floor(Math.random() * wrong.length)]]);
  }

  async function answer(choice: number) {
    if (picked !== null || !q) return;
    setPicked(choice);
    if (choice === q.answerIndex) {
      const gain = hidden.length === 0 ? 15 : hidden.length === 1 ? 10 : 6;
      setScore((s) => s + gain);
    }
  }

  async function next() {
    if (idx + 1 >= questions.length) {
      setDone(true);
      await fetch("/api/games/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: "diagnosduellen",
          chapterId,
          score,
          maxScore: questions.length * 15,
          durationMs: Date.now() - startedAt.current,
        }),
      });
      return;
    }
    setIdx(idx + 1);
    setPicked(null);
    setHidden([]);
  }

  if (loading) return <p className="py-10 text-center text-sm text-grey">Laddar patienter…</p>;
  if (questions.length === 0)
    return <p className="py-10 text-center text-sm text-grey">Inga fall tillgängliga.</p>;

  if (done) {
    return (
      <div className="animate-scale-in py-8 text-center">
        <p className="text-4xl">🩺</p>
        <h3 className="mt-2 text-xl font-bold text-plum-dark">Duellen är avgjord</h3>
        <p className="mt-1 text-sm text-grey">
          {score} poäng på {questions.length} fall
        </p>
        <NewQuestionsPanel
          chapterId={chapterId}
          courseId={courseId ?? null}
          onRestart={load}
          label="Ny rond med nya frågor"
        />
        <div className="mt-3 flex justify-center gap-2">
          <button onClick={load} className="dp-btn dp-btn-ghost">
            Ny rond
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
      <div className="flex items-center justify-between text-xs text-grey">
        <span>
          Fall <strong className="text-plum-dark">{idx + 1}/{questions.length}</strong>
        </span>
        <span>
          ⭐ <strong className="text-plum-dark tabular-nums">{score}</strong>
        </span>
      </div>

      <div className="mt-3 rounded-2xl border-2 border-[--grey-light] bg-[--blue-light] p-4">
        <p className="text-2xs font-bold uppercase tracking-wider text-[--blue-dark]">
          🏥 {q.chapterTitle}
        </p>
        <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-plum-dark">{q.prompt}</p>
      </div>

      <div className="mt-3 space-y-2">
        {q.options.map((opt, i) => {
          const revealed = picked !== null;
          const isHidden = hidden.includes(i) && !revealed;
          let cls = "flex w-full items-center gap-2 rounded-xl border-2 bg-white px-3.5 py-2.5 text-left text-sm transition-all";
          if (isHidden) cls += " border-[--grey-light] opacity-30 line-through";
          else if (!revealed) cls += " border-[--grey-light] hover:border-plum hover:bg-[--orange-light]";
          else if (i === q.answerIndex) cls += " border-[--green] bg-[--green-light]";
          else if (i === picked) cls += " border-[--red] bg-red-50";
          else cls += " border-[--grey-light] opacity-50";

          return (
            <button
              key={opt}
              onClick={() => answer(i)}
              disabled={revealed || isHidden}
              className={cls}
            >
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[--grey-light] text-2xs font-bold text-plum-dark">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {picked === null ? (
        <button
          onClick={hint}
          disabled={hidden.length >= 2 || q.options.length - 1 - hidden.length <= 1}
          className="dp-btn dp-btn-ghost mt-3 w-full text-xs"
        >
          💡 Ledtråd ({2 - hidden.length} kvar – sänker poängen)
        </button>
      ) : (
        <div className="mt-3 animate-fade-in-up">
          {q.explanation && (
            <p className="rounded-xl bg-[--grey-light] p-3 text-xs leading-relaxed text-plum-dark">
              {q.explanation}
            </p>
          )}
          <button onClick={next} className="dp-btn dp-btn-primary mt-3 w-full">
            {idx + 1 >= questions.length ? "Visa resultat" : "Nästa fall →"}
          </button>
        </div>
      )}
    </div>
  );
}
