import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getStats, listCourses } from "@/lib/repo";
import { queryOne } from "@/lib/db";
import ProgressRing from "@/components/ui/ProgressRing";

export const dynamic = "force-dynamic";

export default async function HemPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const stats = await getStats(user.id);
  const courses = await listCourses(user.id);

  const resume = await queryOne<{
    chapterId: string;
    title: string;
    courseId: string;
    courseCode: string;
    status: string;
  }>(
    `SELECT cp.chapter_id AS "chapterId", ch.title, ch.course_id AS "courseId",
            c.code AS "courseCode", cp.status
       FROM chapter_progress cp
       JOIN chapters ch ON ch.id = cp.chapter_id
       JOIN courses c ON c.id = ch.course_id
      WHERE cp.user_id = $1 AND cp.status <> 'mastered'
      ORDER BY cp.updated_at DESC
      LIMIT 1`,
    [user.id],
  );

  const totalChapters = courses.reduce((sum, c) => sum + c.chapters, 0);
  const completedChapters = courses.reduce((sum, c) => sum + c.completed, 0);
  const name = user.displayName?.split(" ")[0] || user.email.split("@")[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-plum-dark p-6 text-white sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(circle at 15% 20%, #FF876F 0%, transparent 45%), radial-gradient(circle at 85% 90%, #4DB5BC 0%, transparent 45%)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.15em] text-white/60">
              {new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
              Hej {name} 👋
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">
              {stats.dueNow > 0
                ? `Du har ${stats.dueNow} kort som vill bli repeterade – det tar ungefär ${Math.max(2, Math.round(stats.dueNow * 0.25))} minuter.`
                : "Inget som förfaller just nu. Läs ett nytt kapitel eller spela dagens utmaning."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={stats.dueNow > 0 ? "/repetition" : "/kurs"}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-plum-dark transition-transform hover:-translate-y-0.5"
              >
                {stats.dueNow > 0 ? `🔁 Repetera ${stats.dueNow} kort` : "📚 Välj ett kapitel"}
              </Link>
              <Link
                href="/spel"
                className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/20"
              >
                🎮 Dagens utmaning
              </Link>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center">
              <p className="text-2xl font-bold tabular-nums">🔥 {stats.streak}</p>
              <p className="text-2xs text-white/60">dagar i rad</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{stats.pointsToday}</p>
              <p className="text-2xs text-white/60">poäng idag</p>
            </div>
          </div>
        </div>
      </div>

      {/* Snabbkort */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InkCard
          href={resume ? `/kapitel/${resume.chapterId}` : "/kurs"}
          icon="▶️"
          title={resume ? "Fortsätt där du slutade" : "Börja plugga"}
          text={resume ? `${resume.courseCode} · ${resume.title}` : "Välj ett kapitel i kursplanen"}
        />
        <InkCard
          href="/repetition"
          icon="🔁"
          title="Dagens repetition"
          text={
            stats.dueNow > 0
              ? `${stats.dueNow} kort väntar · ${stats.totalCards} totalt i repetitionen`
              : "Inget förfaller – du är ikapp"
          }
        />
        <InkCard
          href="/framsteg"
          icon="📈"
          title="Din retention"
          text={
            stats.retention30 === null
              ? "Ingen data ännu – börja repetera"
              : `${Math.round(stats.retention30 * 100)}% rätt senaste 30 dagarna`
          }
        />
      </div>

      {/* Framsteg */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="dp-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-plum-dark">Dina kurser</h2>
            <Link href="/kurs" className="text-2xs font-semibold text-plum hover:underline">
              Hela kursplanen →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {courses.slice(0, 6).map((c) => {
              const pct = c.chapters ? Math.round((c.completed / c.chapters) * 100) : 0;
              return (
                <Link
                  key={c.id}
                  href={`/kurs/${c.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-[--grey-light]"
                >
                  <span className="text-lg">{c.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-plum-dark">
                      {c.code} · {c.title.split(":")[0]}
                    </span>
                    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[--grey-light]">
                      <span
                        className="block h-full rounded-full bg-plum transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </span>
                  <span className="text-2xs font-bold tabular-nums text-grey">
                    {c.completed}/{c.chapters}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="dp-card flex flex-col items-center justify-center p-5 text-center">
          <ProgressRing
            value={totalChapters ? (completedChapters / totalChapters) * 100 : 0}
            size={104}
            label={`${completedChapters}/${totalChapters}`}
            sublabel="kapitel klara"
          />
          <p className="mt-3 text-xs text-grey">
            {stats.chaptersStarted} kapitel påbörjade · {stats.reviewsToday} repetitioner idag
          </p>
          <Link href="/spel" className="dp-btn dp-btn-ghost mt-3 w-full text-xs">
            🎮 Spela en runda
          </Link>
        </div>
      </div>
    </div>
  );
}

function InkCard({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} className="dp-card dp-card-hover block p-4">
      <span className="text-xl">{icon}</span>
      <p className="mt-2 text-sm font-bold text-plum-dark">{title}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-grey">{text}</p>
    </Link>
  );
}
