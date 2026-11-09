"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProgressRing from "@/components/ui/ProgressRing";
import { shuffleOptions } from "@/lib/shuffle";

export interface QuizItem {
  id: string;
  kind: "mcq" | "cloze" | "truefalse";
  prompt: string;
  options: string[] | null;
  answer: string;
  explanation: string | null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:!?"'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type GenState = "idle" | "loading" | "done" | "error";

export default function QuizRunner({
  items,
  chapterId,
  title = "Aktiv återkallning",
  autoGenerate = true,
}: {
  items: QuizItem[];
  chapterId: string;
  title?: string;
  autoGenerate?: boolean;
}) {
  const [pool, setPool] = useState<QuizItem[]>(items);
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  const [genState, setGenState] = useState<GenState>("idle");
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const requested = useRef(false);

  const byId = useMemo(() => new Map(pool.map((i) => [i.id, i])), [pool]);
  const item = byId.get(order[idx]);

  // Blanda svarsalternativen så att rätt svar inte alltid ligger först
  const displayOptions = useMemo(() => {
    if (!item || !item.options) return [];
    return shuffleOptions(item.options, item.answer).options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const generateMore = useCallback(async () => {
    setGenState("loading");
    setGenMessage(null);
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, count: 3 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenState("error");
        setGenMessage(data.error || "Kunde inte generera nya frågor just nu.");
        return;
      }
      const fresh: QuizItem[] = (data.questions ?? []).map(
        (q: { prompt: string; options: string[]; answer: string; explanation: string | null }, i: number) => ({
          id: `gen-${Date.now()}-${i}`,
          kind: "mcq" as const,
          prompt: q.prompt,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
        }),
      );

      if (fresh.length === 0) {
        setGenState("done");
        setGenMessage(data.message || "Inga nya frågor den här gången.");
        return;
      }

      setPool((prev) => [...prev, ...fresh]);
      setNewIds(fresh.map((f) => f.id));
      setGenState("done");
      setGenMessage(
        data.message ??
          `${fresh.length} nya frågor genererade och faktagranskade av Karolina.`,
      );
    } catch {
      setGenState("error");
      setGenMessage("Nätverksfel när nya frågor skulle hämtas.");
    }
  }, [chapterId]);

  // När rundan är klar: låt Karolina skriva nya frågor (en gång per runda)
  useEffect(() => {
    if (!done || !autoGenerate || requested.current) return;
    requested.current = true;
    void generateMore();
  }, [done, autoGenerate, generateMore]);

  if (items.length === 0) {
    return <p className="text-sm text-grey">Inga frågor finns för det här kapitlet ännu.</p>;
  }

  const correctCount = Object.values(results).filter(Boolean).length;

  function report(correct: boolean) {
    if (!item) return;
    setResults((prev) => ({ ...prev, [item.id]: correct }));
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId, correct }),
    }).catch(() => {});
  }

  function choose(option: string) {
    if (revealed || !item) return;
    setPicked(option);
    setRevealed(true);
    report(normalize(option) === normalize(item.answer));
  }

  function checkCloze() {
    if (revealed || !item || !typed.trim()) return;
    setRevealed(true);
    report(normalize(typed).includes(normalize(item.answer)));
  }

  function next() {
    if (idx + 1 >= order.length) {
      setDone(true);
      return;
    }
    setIdx(idx + 1);
    setPicked(null);
    setTyped("");
    setRevealed(false);
  }

  function restart(list: string[]) {
    requested.current = false;
    setOrder(list);
    setResults({});
    setIdx(0);
    setPicked(null);
    setTyped("");
    setRevealed(false);
    setDone(false);
    setGenState("idle");
    setGenMessage(null);
  }

  function restartWith(wrongOnly: boolean) {
    const wrongIds = order.filter((id) => results[id] === false);
    if (wrongOnly && wrongIds.length > 0) restart(wrongIds);
    else restart(pool.map((i) => i.id));
  }

  if (done) {
    const pct = Math.round((correctCount / order.length) * 100);
    const wrong = order.length - correctCount;
    return (
      <div className="animate-scale-in rounded-2xl border border-[--grey-light] bg-white p-8 text-center">
        <ProgressRing
          value={pct}
          size={112}
          color={pct >= 80 ? "#54B986" : pct >= 50 ? "#F59A00" : "#B84145"}
          label={`${correctCount}/${order.length}`}
          sublabel="rätt"
        />
        <h3 className="mt-4 text-lg font-bold text-plum-dark">
          {pct >= 80 ? "Snyggt – det sitter!" : pct >= 50 ? "Bra grund – repetera luckorna" : "Dags att jobba igenom kapitlet igen"}
        </h3>
        <p className="mt-1 text-sm text-grey">
          {pct >= 80
            ? "Lägg korten i repetitionen så att det håller över tid."
            : "Fel svar lär bara om du rättar dem – läs förklaringarna och försök igen."}
        </p>

        {autoGenerate && (
          <div className="mt-5 rounded-2xl border border-[--grey-light] bg-[--orange-light] p-4 text-left">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-plum-dark">
              <span className="text-base">✨</span> Karolina skriver nya frågor
            </p>
            {genState === "loading" && (
              <p className="mt-1.5 text-xs text-grey">
                Genererar frågor ur modulens lärandemål och faktagranskar dem…
              </p>
            )}
            {(genState === "done" || genState === "error") && (
              <p className="mt-1.5 text-xs text-grey">{genMessage}</p>
            )}
            {genState === "done" && newIds.length > 0 && (
              <button
                onClick={() => restart(newIds)}
                className="dp-btn dp-btn-primary mt-3 w-full text-xs"
              >
                ✨ Träna de {newIds.length} nya frågorna
              </button>
            )}
            {genState === "error" && (
              <button
                onClick={() => {
                  requested.current = false;
                  void generateMore();
                }}
                className="dp-btn dp-btn-ghost mt-3 w-full text-xs"
              >
                Försök igen
              </button>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {wrong > 0 && (
            <button onClick={() => restartWith(true)} className="dp-btn dp-btn-primary">
              🔁 Repetera {wrong} fel
            </button>
          )}
          <button onClick={() => restartWith(false)} className="dp-btn dp-btn-ghost">
            Gör om alla
          </button>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const isCloze = item.kind === "cloze";
  const wasCorrect = picked ? normalize(picked) === normalize(item.answer) : undefined;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {order.map((id, i) => (
            <span
              key={id}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                results[id] === true
                  ? "bg-[--green]"
                  : results[id] === false
                    ? "bg-[--red]"
                    : i === idx
                      ? "bg-plum"
                      : "bg-[--grey-light]"
              }`}
            />
          ))}
        </div>
        <span className="text-2xs font-bold uppercase tracking-wider text-grey">
          {title} · {idx + 1}/{order.length}
        </span>
      </div>

      <div className="rounded-2xl border border-[--grey-light] bg-white p-5">
        <p className="text-[15px] font-medium leading-relaxed text-plum-dark whitespace-pre-wrap">
          {item.prompt}
        </p>

        {isCloze ? (
          <div className="mt-4 flex gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && checkCloze()}
              disabled={revealed}
              placeholder="Skriv det som saknas…"
              className="flex-1 rounded-xl border-2 border-[--grey-light] px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-plum disabled:bg-[--grey-light]"
            />
            {!revealed && (
              <button onClick={checkCloze} disabled={!typed.trim()} className="dp-btn dp-btn-primary">
                Kontrollera
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {displayOptions.map((opt, i) => {
              const isAnswer = normalize(opt) === normalize(item.answer);
              const isPicked = picked === opt;
              let cls =
                "flex w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left text-sm transition-all";
              if (!revealed) {
                cls += " border-[--grey-light] hover:border-plum-light hover:bg-[--grey-light]";
              } else if (isAnswer) {
                cls += " border-[--green] bg-[--green-light] text-[--green-dark]";
              } else if (isPicked) {
                cls += " border-[--red] bg-red-50 text-[--red]";
              } else {
                cls += " border-[--grey-light] opacity-60";
              }
              return (
                <button key={opt} onClick={() => choose(opt)} disabled={revealed} className={cls}>
                  <span
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      revealed && isAnswer
                        ? "bg-[--green] text-white"
                        : revealed && isPicked
                          ? "bg-[--red] text-white"
                          : "bg-[--grey-light] text-grey"
                    }`}
                  >
                    {revealed && isAnswer ? "✓" : revealed && isPicked ? "✕" : String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {revealed && (
          <div
            className={`mt-4 animate-fade-in-up rounded-2xl p-4 ${
              (isCloze ? normalize(typed).includes(normalize(item.answer)) : wasCorrect)
                ? "bg-[--green-light]"
                : "bg-red-50"
            }`}
          >
            <p className="text-sm font-bold text-plum-dark">
              {(isCloze ? normalize(typed).includes(normalize(item.answer)) : wasCorrect)
                ? "✓ Rätt!"
                : `✕ Rätt svar: ${item.answer}`}
            </p>
            {item.explanation && (
              <p className="mt-1 text-sm leading-relaxed text-plum-dark/80">{item.explanation}</p>
            )}
          </div>
        )}

        {revealed && (
          <button onClick={next} className="dp-btn dp-btn-primary mt-4 w-full">
            {idx + 1 >= order.length ? "Visa resultat" : "Nästa fråga →"}
          </button>
        )}
      </div>
    </div>
  );
}
