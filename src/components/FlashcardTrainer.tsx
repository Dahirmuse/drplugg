"use client";

import { useState } from "react";

export default function FlashcardTrainer({
  cards,
  chapterId,
}: {
  cards: { front: string; back: string }[];
  chapterId: string;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saved, setSaved] = useState<null | { added: number }>(null);
  const [saving, setSaving] = useState(false);

  if (cards.length === 0) {
    return <p className="text-sm text-grey">Inga kort finns för det här kapitlet ännu.</p>;
  }

  const card = cards[idx];
  const last = idx === cards.length - 1;

  async function saveDeck() {
    setSaving(true);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, addDeck: true }),
      });
      const data = await res.json();
      setSaved({ added: data.added ?? 0 });
    } catch {
      setSaved({ added: 0 });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-2xs font-bold uppercase tracking-wider text-grey">
          Kort {idx + 1}/{cards.length}
        </span>
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-4 rounded-full ${i <= idx ? "bg-plum" : "bg-[--grey-light]"}`}
            />
          ))}
        </div>
      </div>

      <div className="flip-card" onClick={() => setFlipped(!flipped)}>
        <div className={`flip-inner relative min-h-[190px] cursor-pointer ${flipped ? "flipped" : ""}`}>
          <div className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-[--grey-light] bg-white p-6 text-center">
            <p className="text-2xs font-bold uppercase tracking-wider text-grey mb-2">Fråga</p>
            <p className="text-[15px] font-semibold leading-relaxed text-plum-dark">{card.front}</p>
            <p className="mt-4 text-2xs text-grey">Tryck för att vända</p>
          </div>
          <div className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-plum-light bg-[--orange-light] p-6 text-center">
            <p className="text-2xs font-bold uppercase tracking-wider text-[--orange] mb-2">Svar</p>
            <p className="text-sm leading-relaxed text-plum-dark">{card.back}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          onClick={() => {
            setIdx(Math.max(0, idx - 1));
            setFlipped(false);
          }}
          disabled={idx === 0}
          className="dp-btn dp-btn-ghost"
        >
          ← Föregående
        </button>
        {last ? (
          <button onClick={saveDeck} disabled={saving} className="dp-btn dp-btn-primary">
            {saving ? "Sparar…" : "🔁 Lägg korten i repetitionen"}
          </button>
        ) : (
          <button
            onClick={() => {
              setIdx(idx + 1);
              setFlipped(false);
            }}
            className="dp-btn dp-btn-primary"
          >
            Nästa →
          </button>
        )}
      </div>

      {saved && (
        <div className="mt-3 animate-fade-in-up rounded-xl bg-[--green-light] px-4 py-3 text-sm text-[--green-dark]">
          ✓ {saved.added > 0 ? `${saved.added} nya kort` : "Korten fanns redan"} i din repetition.
          De dyker upp under <strong>Repetition</strong> när det är dags.
        </div>
      )}
    </div>
  );
}
