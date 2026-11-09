"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type State = "idle" | "loading" | "done" | "error";

/**
 * Panel som visas när en runda är klar: Karolina skriver nya frågor för
 * samma urval (kapitel, kurs eller blandat) och faktagranskar dem.
 */
export default function NewQuestionsPanel({
  chapterId,
  courseId,
  onRestart,
  onCount,
  label = "Spela igen med nya frågor",
  autoStart = true,
}: {
  chapterId: string | null;
  courseId?: string | null;
  onRestart: () => void;
  onCount?: (n: number) => void;
  label?: string;
  autoStart?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const started = useRef(false);

  const run = useCallback(async () => {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, courseId: courseId ?? null, count: 3 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Kunde inte generera nya frågor just nu.");
        return;
      }
      const n = Number(data.generated) || 0;
      setCount(n);
      onCount?.(n);
      setState("done");
      setMessage(data.message ?? null);
    } catch {
      setState("error");
      setMessage("Nätverksfel när nya frågor skulle hämtas.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, courseId]);

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void run();
  }, [autoStart, run]);

  return (
    <div className="mt-4 rounded-2xl border border-[--grey-light] bg-[--orange-light] p-4 text-left">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-plum-dark">
        <span className="text-base">✨</span> Karolina skriver nya frågor
      </p>

      {state === "loading" && (
        <p className="mt-1.5 text-xs text-grey">
          Genererar frågor ur materialet och faktagranskar dem…
        </p>
      )}

      {state !== "loading" && message && <p className="mt-1.5 text-xs text-grey">{message}</p>}

      {state === "done" && count > 0 && (
        <button onClick={onRestart} className="dp-btn dp-btn-primary mt-3 w-full text-xs">
          ✨ {label}
        </button>
      )}

      {state === "error" && (
        <button
          onClick={() => {
            started.current = false;
            void run();
          }}
          className="dp-btn dp-btn-ghost mt-3 w-full text-xs"
        >
          Försök igen
        </button>
      )}
    </div>
  );
}
