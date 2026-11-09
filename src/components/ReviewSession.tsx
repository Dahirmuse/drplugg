"use client";

import { useState } from "react";
import Link from "next/link";
import ProgressRing from "@/components/ui/ProgressRing";

export interface DueCard {
  id: string;
  front: string;
  back: string;
  chapterId: string | null;
  chapterTitle: string | null;
  courseTitle: string | null;
}

const RATINGS = [
  { value: 1, label: "Igen", hint: "Kunde inte", cls: "border-[--red] text-[--red] hover:bg-red-50" },
  { value: 2, label: "Svårt", hint: "Med möda", cls: "border-[--yellow-dark] text-[--yellow-dark] hover:bg-amber-50" },
  { value: 3, label: "Bra", hint: "Korrekt", cls: "border-[--green] text-[--green-dark] hover:bg-[--green-light]" },
  { value: 4, label: "Lätt", hint: "Direkt", cls: "border-plum text-plum hover:bg-plum-light" },
] as const;

export default function ReviewSession({
  cards,
  initialDue,
}: {
  cards: DueCard[];
  initialDue: number;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [lastInterval, setLastInterval] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());

  const card = cards[idx];

  async function rate(value: 1 | 2 | 3 | 4) {
    if (!card) return;
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          rating: value,
          elapsedMs: Date.now() - startedAt,
          source: "sjalv",
        }),
      });
      const data = await res.json();
      const next = data?.card;
      if (next?.scheduledDays !== undefined) setLastInterval(next.scheduledDays);
    } catch {
      /* tyst – användaren kan fortsätta */
    }
    setReviewed((n) => n + 1);
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  if (!card) {
    const pct = cards.length ? Math.round((reviewed / cards.length) * 100) : 0;
    return (
      <div className="animate-scale-in rounded-3xl border border-[--grey-light] bg-white p-10 text-center">
        <div className="text-5xl">{reviewed > 0 ? "🎉" : "🌤️"}</div>
        <h2 className="mt-3 text-xl font-bold text-plum-dark">
          {reviewed > 0 ? "Dagens repetition klar!" : "Inget att repetera just nu"}
        </h2>
        <p className="mt-1 text-sm text-grey">
          {reviewed > 0
            ? `Du gick igenom ${reviewed} kort. Kom tillbaka imorgon – då har FSRS räknat ut nästa dos.`
            : "Läs ett kapitel och lägg korten i repetitionen, så dyker de upp här."}
        </p>
        {lastInterval !== null && reviewed > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[--green-light] px-3 py-1.5 text-xs font-semibold text-[--green-dark]">
            Senaste kortet schemalagt om {lastInterval} dagar
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/kurs" className="dp-btn dp-btn-primary">
            📚 Till kursplanen
          </Link>
          <Link href="/spel" className="dp-btn dp-btn-ghost">
            🎮 Spela i stället
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-2xs font-bold uppercase tracking-wider text-grey">
            {card.courseTitle ?? "Läkarprogrammet"}
          </p>
          <p className="text-sm font-semibold text-plum-dark">{card.chapterTitle ?? "Repetition"}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-grey">
            {reviewed}/{cards.length}
          </span>
          <ProgressRing
            value={(reviewed / cards.length) * 100}
            size={44}
            stroke={5}
            label={`${Math.round((reviewed / cards.length) * 100)}%`}
          />
        </div>
      </div>

      <div className="flip-card" onClick={() => setFlipped(!flipped)}>
        <div className={`flip-inner relative min-h-[240px] cursor-pointer ${flipped ? "flipped" : ""}`}>
          <div className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-[--grey-light] bg-white p-8 text-center">
            <p className="text-2xs font-bold uppercase tracking-wider text-grey mb-3">Fråga</p>
            <p className="text-lg font-semibold leading-relaxed text-plum-dark">{card.front}</p>
            <p className="mt-6 text-xs text-grey">Tänk klart – tryck sedan för att se svaret</p>
          </div>
          <div className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-plum-light bg-[--orange-light] p-8 text-center">
            <p className="text-2xs font-bold uppercase tracking-wider text-[--orange] mb-3">Svar</p>
            <p className="text-[15px] leading-relaxed text-plum-dark">{card.back}</p>
          </div>
        </div>
      </div>

      {flipped ? (
        <div className="mt-4">
          <p className="mb-2 text-center text-2xs font-bold uppercase tracking-wider text-grey">
            Hur gick det?
          </p>
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                onClick={() => rate(r.value)}
                className={`rounded-2xl border-2 bg-white py-3 text-center transition-all ${r.cls}`}
              >
                <span className="block text-sm font-bold">{r.label}</span>
                <span className="block text-2xs opacity-70">{r.hint}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 text-center">
          <button onClick={() => setFlipped(true)} className="dp-btn dp-btn-primary px-8">
            Visa svar
          </button>
        </div>
      )}

      {initialDue > cards.length && (
        <p className="mt-3 text-center text-2xs text-grey">
          {initialDue - cards.length} kort väntar i nästa omgång
        </p>
      )}
    </div>
  );
}
