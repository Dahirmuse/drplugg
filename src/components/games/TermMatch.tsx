"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NewQuestionsPanel from "@/components/games/NewQuestionsPanel";

interface Pair {
  id: string;
  term: string;
  definition: string;
  chapterTitle: string;
}

interface Tile {
  key: string;
  pairId: string;
  text: string;
  side: "term" | "definition";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TermMatch({
  chapterId,
  courseId,
  onFinish,
}: {
  chapterId: string | null;
  courseId?: string | null;
  onFinish: () => void;
}) {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const startedAt = useRef(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "6" });
      if (chapterId) params.set("chapterId", chapterId);
      else if (courseId) params.set("courseId", courseId);
      const res = await fetch(`/api/games/match?${params.toString()}`);
      const data = await res.json();
      const loaded: Pair[] = data.pairs ?? [];
      setPairs(loaded);
      setTiles(
        shuffle(
          loaded.flatMap((p) => [
            { key: `${p.id}-t`, pairId: p.id, text: p.term, side: "term" as const },
            { key: `${p.id}-d`, pairId: p.id, text: p.definition, side: "definition" as const },
          ]),
        ),
      );
      setMatched([]);
      setSelected([]);
      setMoves(0);
      setSeconds(0);
      setDone(false);
      startedAt.current = Date.now();
    } finally {
      setLoading(false);
    }
  }, [chapterId, courseId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (done || loading || pairs.length === 0) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [done, loading, pairs.length]);

  useEffect(() => {
    if (pairs.length > 0 && matched.length === pairs.length && !done) {
      setDone(true);
      const score = Math.max(10, pairs.length * 20 - moves * 3 - Math.floor(seconds / 3));
      fetch("/api/games/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: "termmatch",
          chapterId,
          score,
          maxScore: pairs.length * 20,
          durationMs: Date.now() - startedAt.current,
          detail: { moves, seconds },
        }),
      }).catch(() => {});
    }
  }, [matched, pairs.length, done, moves, seconds, chapterId]);

  function click(tile: Tile) {
    if (matched.includes(tile.pairId) || selected.includes(tile.key) || selected.length === 2) return;

    const next = [...selected, tile.key];
    setSelected(next);

    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((k) => tiles.find((t) => t.key === k)!);
      if (a.pairId === b.pairId) {
        setTimeout(() => {
          setMatched((prev) => [...prev, a.pairId]);
          setSelected([]);
        }, 260);
      } else {
        setTimeout(() => setSelected([]), 620);
      }
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-grey">Blandar korten…</p>;
  if (pairs.length === 0)
    return (
      <p className="py-10 text-center text-sm text-grey">
        Inga kort att matcha – välj ett annat kapitel eller lägg till kort.
      </p>
    );

  const score = Math.max(10, pairs.length * 20 - moves * 3 - Math.floor(seconds / 3));

  if (done) {
    return (
      <div className="animate-scale-in py-8 text-center">
        <p className="text-4xl">🧩</p>
        <h3 className="mt-2 text-xl font-bold text-plum-dark">Alla par hittade!</h3>
        <p className="mt-1 text-sm text-grey">
          {moves} drag · {seconds} sekunder · <strong className="text-plum-dark">{score} poäng</strong>
        </p>
        <NewQuestionsPanel
          chapterId={chapterId}
          courseId={courseId ?? null}
          onRestart={onFinish}
          label="Till quizet med de nya frågorna"
        />
        <div className="mt-3 flex justify-center gap-2">
          <button onClick={load} className="dp-btn dp-btn-ghost">
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
      <div className="flex items-center justify-between text-xs text-grey">
        <span>
          Par: <strong className="text-plum-dark">{matched.length}/{pairs.length}</strong>
        </span>
        <span>
          Drag: <strong className="text-plum-dark">{moves}</strong> · Tid:{" "}
          <strong className="text-plum-dark tabular-nums">{seconds}s</strong>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => {
          const isMatched = matched.includes(t.pairId);
          const isSelected = selected.includes(t.key);
          return (
            <button
              key={t.key}
              onClick={() => click(t)}
              disabled={isMatched}
              className={`match-tile flex min-h-[86px] items-center justify-center rounded-2xl border-2 p-2.5 text-center text-[11.5px] leading-snug transition-all ${
                isMatched
                  ? "border-[--green] bg-[--green-light] text-[--green-dark] opacity-70"
                  : isSelected
                    ? "border-plum bg-plum-light text-plum-dark"
                    : "border-[--grey-light] bg-white text-plum-dark hover:border-plum-light"
              }`}
            >
              {isMatched ? "✓" : t.text}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-2xs text-grey">
        Matcha begreppet mot rätt definition – ju färre drag, desto högre poäng.
      </p>
    </div>
  );
}
