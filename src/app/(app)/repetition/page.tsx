import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getStats, listDueCards } from "@/lib/repo";
import { queryMany } from "@/lib/db";
import ReviewSession, { type DueCard } from "@/components/ReviewSession";

export const dynamic = "force-dynamic";

export default async function RepetitionPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const due = await listDueCards(user.id, 40);
  const stats = await getStats(user.id);

  const meta = await queryMany<{
    id: string;
    chapterTitle: string | null;
    courseTitle: string | null;
  }>(
    `SELECT f.id, ch.title AS "chapterTitle", c.title AS "courseTitle"
       FROM flashcards f
       LEFT JOIN chapters ch ON ch.id = f.chapter_id
       LEFT JOIN courses c ON c.id = ch.course_id
      WHERE f.user_id = $1`,
    [user.id],
  );

  const metaMap = new Map(meta.map((m) => [m.id, m]));

  const cards: DueCard[] = due.map((c) => ({
    id: c.id,
    front: c.front,
    back: c.back,
    chapterId: c.chapterId,
    chapterTitle: metaMap.get(c.id)?.chapterTitle ?? null,
    courseTitle: metaMap.get(c.id)?.courseTitle ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-plum-dark">Repetition</h1>
          <p className="mt-1 text-sm text-grey">
            FSRS-5 räknar ut när du är på väg att glömma – då dyker kortet upp här.
          </p>
        </div>
        <div className="flex gap-2 text-center">
          <Stat label="Förfaller" value={`${stats.dueNow}`} />
          <Stat label="Idag" value={`${stats.reviewsToday}`} />
          <Stat
            label="Retention"
            value={stats.retention30 === null ? "–" : `${Math.round(stats.retention30 * 100)}%`}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
        <div>
          <ReviewSession cards={cards} initialDue={stats.dueNow} />
        </div>

        <aside className="space-y-4">
          <div className="dp-card p-4">
            <p className="text-2xs font-bold uppercase tracking-wider text-grey">Kommande 7 dagar</p>
            <div className="mt-2 flex items-end gap-1.5">
              {stats.forecast.map((d, i) => {
                const max = Math.max(1, ...stats.forecast.map((x) => x.count));
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-plum-light"
                      style={{ height: `${Math.max(4, (d.count / max) * 60)}px` }}
                      title={`${d.count} kort`}
                    />
                    <span className="text-[9px] uppercase text-grey">{d.label.trim()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dp-card p-4">
            <p className="text-2xs font-bold uppercase tracking-wider text-grey">Översikt</p>
            <ul className="mt-2 space-y-1.5 text-xs text-plum-dark">
              <li className="flex justify-between">
                <span className="text-grey">Kort totalt</span>
                <span className="font-semibold">{stats.totalCards}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-grey">Nya</span>
                <span className="font-semibold">{stats.newCards}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-grey">Mogna (21+ d)</span>
                <span className="font-semibold">{stats.mature}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-grey">Repetitioner 7 d</span>
                <span className="font-semibold">{stats.reviews7d}</span>
              </li>
            </ul>
          </div>

          <div className="dp-card p-4">
            <p className="text-xs leading-relaxed text-grey">
              Inga kort än? Öppna ett kapitel → fliken <strong>Kort</strong> och lägg dem i
              repetitionen.
            </p>
            <Link href="/kurs" className="dp-btn dp-btn-ghost mt-2 w-full text-xs">
              📚 Till kursplanen
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[--grey-light] bg-white px-3 py-1.5">
      <p className="text-sm font-bold tabular-nums text-plum-dark">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-grey">{label}</p>
    </div>
  );
}
