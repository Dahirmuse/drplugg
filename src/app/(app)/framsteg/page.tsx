import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { bestScores, getStats, listCourses } from "@/lib/repo";
import ProgressRing from "@/components/ui/ProgressRing";

export const dynamic = "force-dynamic";

const GAME_LABELS: Record<string, string> = {
  blixtquiz: "Blixtquiz",
  termmatch: "Termmatch",
  diagnosduellen: "Diagnosduellen",
  dagsutmaning: "Dagens utmaning",
};

export default async function FramstegPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const stats = await getStats(user.id);
  const courses = await listCourses(user.id);
  const best = await bestScores(user.id);

  const maxReviews = Math.max(1, ...stats.history.map((h) => h.count));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-plum-dark">Framsteg</h1>
      <p className="mt-1 text-sm text-grey">
        Det som mäts blir bättre – men titta på <em>retentionen</em>, inte på antalet lästa sidor.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon="🔥" label="Streak" value={`${stats.streak} dagar`} sub={`längsta ${stats.longestStreak}`} />
        <Metric icon="🃏" label="Kort i repetition" value={`${stats.totalCards}`} sub={`${stats.mature} mogna`} />
        <Metric
          icon="🎯"
          label="Retention 30 d"
          value={stats.retention30 === null ? "–" : `${Math.round(stats.retention30 * 100)}%`}
          sub={`${stats.reviewsToday} reps idag`}
        />
        <Metric icon="⭐" label="Poäng" value={`${stats.totalPoints}`} sub={`${stats.pointsToday} idag`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="dp-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-plum-dark">Repetitioner senaste 14 dagarna</h2>
            <span className="text-2xs text-grey">
              grönt = rätt (betyg ≥ 3)
            </span>
          </div>
          <div className="mt-4 flex h-32 items-end gap-1">
            {stats.history.map((h, i) => (
              <div key={i} className="group flex flex-1 flex-col items-center gap-1">
                <div className="relative flex w-full flex-col justify-end" style={{ height: "100%" }}>
                  <div
                    className="w-full rounded-t bg-[--grey-light]"
                    style={{ height: `${(h.count / maxReviews) * 100}%` }}
                    title={`${h.count} repetitioner`}
                  >
                    <div
                      className="w-full rounded-t bg-plum"
                      style={{ height: h.count ? `${(h.good / h.count) * 100}%` : 0 }}
                    />
                  </div>
                </div>
                <span className="text-[9px] text-grey">{h.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dp-card flex flex-col items-center justify-center p-5 text-center">
          <ProgressRing
            value={stats.accuracy === null ? 0 : stats.accuracy * 100}
            size={104}
            color="#4DB5BC"
            label={stats.accuracy === null ? "–" : `${Math.round(stats.accuracy * 100)}%`}
            sublabel="rätt på quiz"
          />
          <p className="mt-3 text-xs text-grey">
            {stats.chaptersStarted} kapitel påbörjade · {stats.chaptersCompleted} klara
          </p>
          <Link href="/repetition" className="dp-btn dp-btn-primary mt-3 w-full text-xs">
            🔁 Repetera nu
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="dp-card p-5">
          <h2 className="text-sm font-bold text-plum-dark">Kurs för kurs</h2>
          <div className="mt-3 space-y-2.5">
            {courses.map((c) => {
              const pct = c.chapters ? Math.round((c.completed / c.chapters) * 100) : 0;
              return (
                <div key={c.id} className="flex items-center gap-2.5">
                  <span className="w-5 text-center">{c.icon}</span>
                  <span className="w-10 flex-shrink-0 text-2xs font-bold text-grey">{c.code}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[--grey-light]">
                    <span className="block h-full rounded-full bg-plum" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-10 text-right text-2xs tabular-nums text-grey">
                    {c.completed}/{c.chapters}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dp-card p-5">
          <h2 className="text-sm font-bold text-plum-dark">Spel – dina bästa rundor</h2>
          {best.length === 0 ? (
            <p className="mt-2 text-xs text-grey">
              Du har inte spelat ännu.{" "}
              <Link href="/spel" className="font-semibold text-plum underline">
                Testa blixtquizet
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {best.map((b) => (
                <li key={b.game} className="flex items-center justify-between text-sm">
                  <span className="text-plum-dark">{GAME_LABELS[b.game] ?? b.game}</span>
                  <span className="text-xs text-grey">
                    bäst <strong className="text-plum-dark">{b.best}</strong> poäng · {b.plays} rundor
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/spel" className="dp-btn dp-btn-ghost mt-3 w-full text-xs">
            🎮 Till spelen
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="dp-card p-4">
      <p className="text-lg">{icon}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-plum-dark tabular-nums">{value}</p>
      <p className="text-2xs font-bold uppercase tracking-wider text-grey">{label}</p>
      <p className="mt-0.5 text-2xs text-grey">{sub}</p>
    </div>
  );
}
