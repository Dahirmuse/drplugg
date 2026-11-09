"use client";

import { useState } from "react";
import Link from "next/link";
import QuizRunner, { type QuizItem } from "@/components/QuizRunner";
import FlashcardTrainer from "@/components/FlashcardTrainer";
import GenerateCardsButton from "@/components/GenerateCardsButton";
import NerdVideos, { type VideoItem, type VideoTopic } from "@/components/NerdVideos";

type Tab = "aterkalla" | "kort" | "video" | "oversikt";

export default function ChapterStudy({
  chapterId,
  chapterTitle,
  chapterCode,
  courseTitle,
  courseId,
  summary,
  objectives,
  sections,
  facts,
  recall,
  cards,
  videos,
  topics,
  status,
}: {
  chapterId: string;
  chapterTitle: string;
  chapterCode?: string | null;
  courseTitle: string;
  courseId: string;
  summary: string | null;
  objectives: { id: string; code: string | null; title: string; level: string }[];
  sections: { code: string; title: string }[];
  facts: string[];
  recall: QuizItem[];
  cards: { front: string; back: string; origin?: string }[];
  videos: VideoItem[];
  topics: VideoTopic[];
  status: string | null;
}) {
  const [tab, setTab] = useState<Tab>("aterkalla");

  const tabs: { key: Tab; label: string; icon: string; badge?: number }[] = [
    { key: "aterkalla", label: "Aktiv återkallning", icon: "🧠", badge: recall.length },
    { key: "kort", label: "Kort", icon: "🃏", badge: cards.length },
    { key: "video", label: "Ninja Nerd", icon: "▶️", badge: videos.length },
    { key: "oversikt", label: "Översikt", icon: "📋" },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/kurs/${courseId}`} className="text-2xs font-bold uppercase tracking-wider text-grey hover:text-plum">
            ← {courseTitle}
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-plum-dark">
            {chapterTitle}
          </h1>
          {summary && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-grey">{summary}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "completed" && (
            <span className="dp-chip bg-[--green-light] text-[--green-dark]">✓ Klar</span>
          )}
          {status === "mastered" && (
            <span className="dp-chip bg-plum text-white">★ Bemästrad</span>
          )}
          <Link href={`/chatt?chapter=${chapterId}`} className="dp-btn dp-btn-ghost">
            💬 Plugga med Karolina
          </Link>
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-[--grey-light] pb-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative whitespace-nowrap rounded-t-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
              tab === t.key
                ? "bg-plum-light text-plum-dark"
                : "text-grey hover:bg-[--grey-light] hover:text-plum-dark"
            }`}
          >
            <span className="mr-1">{t.icon}</span>
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="ml-1 rounded-full bg-white/70 px-1 text-[10px] font-bold text-plum-dark">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "aterkalla" && (
        <div className="animate-fade-in-up">
          <p className="mb-3 text-xs text-grey">
            Svara utan att titta i materialet. Fel svar + förklaring är det som flyttar dig framåt.
          </p>
          <QuizRunner items={recall} chapterId={chapterId} />
        </div>
      )}

      {tab === "kort" && (
        <div className="animate-fade-in-up">
          <p className="mb-3 text-xs leading-relaxed text-grey">
            <strong className="text-plum-dark">{cards.length} kort</strong> i modulen
            {cards.filter((c) => c.origin === "anki-ai").length > 0 && (
              <>
                {" "}· {cards.filter((c) => c.origin === "anki-ai").length} hämtade från
                Anki-materialet och omformulerade av Karolina
              </>
            )}
            . Vänd igenom dem och lägg dem sedan i repetitionen.
          </p>
          <GenerateCardsButton chapterId={chapterId} />
          <FlashcardTrainer cards={cards} chapterId={chapterId} />
        </div>
      )}

      {tab === "video" && (
        <div className="animate-fade-in-up">
          <NerdVideos videos={videos} topics={topics} chapterTitle={chapterTitle} />
        </div>
      )}

      {tab === "oversikt" && (
        <div className="animate-fade-in-up space-y-4">
          <div className="dp-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-plum-dark">
                Modulens delar ({sections.length})
              </h2>
              <span className="text-2xs text-grey">{objectives.length} lärandemål totalt</span>
            </div>

            {sections.length === 0 ? (
              <ul className="mt-3 space-y-2">
                {objectives.map((o) => (
                  <li key={o.id} className="flex gap-2 text-sm leading-relaxed text-plum-dark/90">
                    <span className="mt-0.5 flex-shrink-0 rounded-md bg-[--grey-light] px-1.5 py-0.5 text-2xs font-bold text-grey">
                      {o.code ?? "•"}
                    </span>
                    <span>{o.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 space-y-4">
                {sections.map((s) => {
                  const own = objectives.filter(
                    (o) => o.code && (o.code === s.code || o.code.startsWith(`${s.code}.`)),
                  );
                  return (
                    <div key={s.code}>
                      <p className="text-xs font-bold text-plum-dark">
                        <span className="mr-1.5 rounded bg-plum-light px-1.5 py-0.5 text-2xs text-plum-dark">
                          {s.code}
                        </span>
                        {s.title}
                      </p>
                      {own.length > 0 ? (
                        <ul className="mt-1.5 space-y-1.5 pl-1">
                          {own.map((o) => (
                            <li
                              key={o.id}
                              className="flex gap-2 text-[13px] leading-relaxed text-plum-dark/85"
                            >
                              <span className="text-grey">›</span>
                              <span>{o.title}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 pl-4 text-2xs text-grey">
                          Inga nedbrytna mål – se modulens mål nedan.
                        </p>
                      )}
                    </div>
                  );
                })}
                {objectives.filter(
                  (o) =>
                    !o.code ||
                    !sections.some((s) => o.code === s.code || o.code!.startsWith(`${s.code}.`)),
                ).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-plum-dark">Övriga mål</p>
                    <ul className="mt-1.5 space-y-1.5 pl-1">
                      {objectives
                        .filter(
                          (o) =>
                            !o.code ||
                            !sections.some((s) => o.code === s.code || o.code!.startsWith(`${s.code}.`)),
                        )
                        .map((o) => (
                          <li key={o.id} className="flex gap-2 text-[13px] leading-relaxed text-plum-dark/85">
                            <span className="text-grey">›</span>
                            <span>{o.title}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="dp-card p-5">
            <h2 className="text-sm font-bold text-plum-dark">Högyield – kom ihåg</h2>
            <ul className="mt-2 space-y-2">
              {facts.map((f) => (
                <li key={f} className="flex gap-2 text-sm leading-relaxed text-plum-dark/90">
                  <span className="text-[--orange]">★</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`/spel?chapter=${chapterId}`}
              className="dp-btn dp-btn-ghost mt-4 w-full text-xs"
            >
              🎮 Träna kapitlet som spel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
