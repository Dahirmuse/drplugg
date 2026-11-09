"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BlixtQuiz from "@/components/games/BlixtQuiz";
import TermMatch from "@/components/games/TermMatch";
import DiagnosDuellen from "@/components/games/DiagnosDuellen";

type GameKey = "blixtquiz" | "termmatch" | "diagnosduellen" | "dagsutmaning";

const GAMES: {
  key: GameKey;
  title: string;
  icon: string;
  text: string;
  color: string;
  minutes: string;
}[] = [
  {
    key: "blixtquiz",
    title: "Blixtquiz",
    icon: "⚡",
    text: "10 frågor, 15 sekunder var. Streak ger bonus.",
    color: "bg-[--orange-light]",
    minutes: "~3 min",
  },
  {
    key: "termmatch",
    title: "Termmatch",
    icon: "🧩",
    text: "Matcha begrepp mot rätt förklaring – som memory, men medicinskt.",
    color: "bg-[--blue-light]",
    minutes: "~3 min",
  },
  {
    key: "diagnosduellen",
    title: "Diagnosduellen",
    icon: "🩺",
    text: "Kliniska fall. Ledtrådar finns, men de kostar poäng.",
    color: "bg-[--green-light]",
    minutes: "~5 min",
  },
  {
    key: "dagsutmaning",
    title: "Dagens utmaning",
    icon: "🎯",
    text: "Blandade frågor från hela programmet – en runda per dag.",
    color: "bg-plum-light",
    minutes: "~4 min",
  },
];

interface Best {
  game: string;
  best: number;
  plays: number;
}

interface Leader {
  email: string;
  displayName: string | null;
  best: number;
  plays: number;
}

export interface GameCourse {
  id: string;
  code: string;
  title: string;
  icon: string;
}

export interface GameChapter {
  id: string;
  title: string;
  courseId: string;
}

export default function GameHub({
  courses,
  chapters,
  initialBest,
  initialCourseId = "",
  initialChapterId = "",
}: {
  courses: GameCourse[];
  chapters: GameChapter[];
  initialBest: Best[];
  initialCourseId?: string;
  initialChapterId?: string;
}) {
  const initialChapter =
    chapters.find((c) => c.id === initialChapterId) ?? null;

  const [active, setActive] = useState<GameKey | null>(null);
  const [courseId, setCourseId] = useState(initialCourseId || initialChapter?.courseId || "");
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [best, setBest] = useState<Best[]>(initialBest);
  const [leaders, setLeaders] = useState<Leader[]>([]);

  const courseChapters = useMemo(
    () => chapters.filter((c) => !courseId || c.courseId === courseId),
    [chapters, courseId],
  );

  const chapter = chapters.find((c) => c.id === chapterId) ?? null;
  const course = courses.find((c) => c.id === (chapter?.courseId ?? courseId)) ?? null;

  const scopeLabel = chapter
    ? course
      ? `${course.code} · ${chapter.title}`
      : chapter.title
    : course
      ? `${course.code} · hela kursen`
      : "Blandat från hela programmet";

  useEffect(() => {
    if (!active) return;
    fetch(`/api/games/score?game=${active === "dagsutmaning" ? "blixtquiz" : active}`)
      .then((r) => r.json())
      .then((d) => {
        setBest(d.best ?? []);
        setLeaders(d.leaderboard ?? []);
      })
      .catch(() => {});
  }, [active]);

  async function refreshBest() {
    const res = await fetch(`/api/games/score?game=${active ?? "blixtquiz"}`);
    const data = await res.json();
    setBest(data.best ?? []);
    setLeaders(data.leaderboard ?? []);
  }

  function pickCourse(next: string) {
    setCourseId(next);
    // Nollställ kapitel om det inte hör till den valda kursen
    if (chapter && next && chapter.courseId !== next) setChapterId("");
    if (!next) setChapterId("");
  }

  if (active) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => setActive(null)}
            className="text-2xs font-bold uppercase tracking-wider text-grey hover:text-plum"
          >
            ← Till spelen
          </button>
          <span className="rounded-full bg-[--grey-light] px-2.5 py-1 text-2xs font-semibold text-plum-dark">
            {GAMES.find((g) => g.key === active)?.title} · {scopeLabel}
          </span>
        </div>
        <div className="dp-card p-5">
          {active === "blixtquiz" && (
            <BlixtQuiz
              chapterId={chapterId || null}
              courseId={courseId || null}
              onFinish={() => {
                setActive(null);
                refreshBest();
              }}
            />
          )}
          {active === "dagsutmaning" && (
            <BlixtQuiz
              chapterId={null}
              courseId={null}
              onFinish={() => {
                setActive(null);
                refreshBest();
              }}
            />
          )}
          {active === "termmatch" && (
            <TermMatch
              chapterId={chapterId || null}
              courseId={courseId || null}
              onFinish={() => {
                setActive(null);
                refreshBest();
              }}
            />
          )}
          {active === "diagnosduellen" && (
            <DiagnosDuellen
              chapterId={chapterId || null}
              courseId={courseId || null}
              onFinish={() => {
                setActive(null);
                refreshBest();
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-plum-dark">Spel</h1>
        <p className="mt-1 text-sm text-grey">
          Välj kurs och modul – eller spela blandat. Frågorna hämtas ur modulens återkallning.
        </p>
      </div>

      {/* Urval */}
      <div className="dp-card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[190px] flex-1">
            <label
              htmlFor="game-course"
              className="block text-2xs font-bold uppercase tracking-wider text-grey"
            >
              1. Kurs
            </label>
            <select
              id="game-course"
              value={courseId}
              onChange={(e) => pickCourse(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[--grey-light] bg-white px-3 py-2 text-sm outline-none focus:border-plum"
            >
              <option value="">Alla kurser (blandat)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.code} – {c.title.split(":").slice(1).join(":").trim() || c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[220px] flex-1">
            <label
              htmlFor="game-chapter"
              className="block text-2xs font-bold uppercase tracking-wider text-grey"
            >
              2. Modul / kapitel
            </label>
            <select
              id="game-chapter"
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              disabled={!courseId}
              className="mt-1 w-full rounded-xl border border-[--grey-light] bg-white px-3 py-2 text-sm outline-none focus:border-plum disabled:opacity-50"
            >
              <option value="">Hela kursen</option>
              {courseChapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setCourseId("");
              setChapterId("");
            }}
            className="dp-btn dp-btn-ghost h-[38px] text-xs"
            disabled={!courseId && !chapterId}
          >
            Nollställ
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[--grey-light] pt-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-grey">Spelar:</span>
          <span className="rounded-full bg-plum-light px-2.5 py-1 text-2xs font-semibold text-plum-dark">
            {scopeLabel}
          </span>
          {chapter && (
            <Link
              href={`/kapitel/${chapter.id}`}
              className="text-2xs font-semibold text-plum hover:underline"
            >
              Öppna modulen →
            </Link>
          )}
          {!courseId && (
            <button
              onClick={() => {
                setCourseId(courses[0]?.id ?? "");
                setChapterId("");
              }}
              className="text-2xs font-semibold text-plum hover:underline"
            >
              Välj kurs i stället
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {GAMES.map((g) => {
          const b = best.find((x) => x.game === (g.key === "dagsutmaning" ? "blixtquiz" : g.key));
          const isDaily = g.key === "dagsutmaning";
          return (
            <button
              key={g.key}
              onClick={() => setActive(g.key)}
              className="dp-card dp-card-hover p-5 text-left"
            >
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${g.color}`}>
                {g.icon}
              </div>
              <p className="mt-3 text-sm font-bold text-plum-dark">{g.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-grey">{g.text}</p>
              <p className="mt-3 flex items-center justify-between text-2xs text-grey">
                <span>
                  {g.minutes}
                  {isDaily ? " · alltid blandat" : ""}
                </span>
                {b && (
                  <span className="font-bold text-plum">
                    bäst {b.best} p · {b.plays} rundor
                  </span>
                )}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="dp-card p-5">
          <h2 className="text-sm font-bold text-plum-dark">Topplista</h2>
          {leaders.length === 0 ? (
            <p className="mt-2 text-xs text-grey">Ingen har spelat ännu – bli den första.</p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {leaders.map((l, i) => (
                <li key={l.email} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-2xs font-bold text-grey">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-plum-dark">
                    {l.displayName || l.email.split("@")[0]}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-plum">{l.best} p</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="dp-card p-5">
          <h2 className="text-sm font-bold text-plum-dark">Tips för poäng</h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-grey">
            <li>⚡ Svara snabbt – tiden ger bonus i blixtquizet.</li>
            <li>🔥 Rätt svar i rad höjer multiplikatorn.</li>
            <li>🧩 Färre drag i termmatch ger högre poäng.</li>
            <li>🩺 Klara diagnosduellen utan ledtråd för full pott.</li>
            <li>
              📈 Poängen räknas in i din streak –{" "}
              <Link href="/framsteg" className="font-semibold text-plum underline">
                se framsteg
              </Link>
              .
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
