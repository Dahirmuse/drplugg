import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCourse, listChapters } from "@/lib/repo";
import ProgressRing from "@/components/ui/ProgressRing";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { ring: string; fill: string; text: string; label: string }> = {
  locked: { ring: "#F1F1F1", fill: "none", text: "🔒", label: "Låst" },
  available: { ring: "#870052", fill: "none", text: "", label: "Tillgänglig" },
  started: { ring: "#870052", fill: "#870052", text: "", label: "Pågår" },
  completed: { ring: "#54B986", fill: "#C7ECDC", text: "✓", label: "Klar" },
  mastered: { ring: "#4F0433", fill: "#4F0433", text: "★", label: "Bemästrad" },
};

function Ring({ status }: { status: string }) {
  const c = STATUS[status] ?? STATUS.available;
  return (
    <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center" title={c.label}>
      <svg width="32" height="32" viewBox="0 0 32 32" className="absolute inset-0">
        <circle cx="16" cy="16" r="13" fill={c.fill} stroke={c.ring} strokeWidth="2.5" />
      </svg>
      <span className={`relative z-10 text-xs font-bold ${status === "mastered" ? "text-white" : "text-[--green-dark]"}`}>
        {c.text}
      </span>
    </span>
  );
}

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const course = await getCourse(courseId);
  if (!course) notFound();

  const chapters = await listChapters(courseId, user.id);
  const completed = chapters.filter((c) => c.status === "completed" || c.status === "mastered").length;
  const pct = chapters.length ? (completed / chapters.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/kurs" className="text-2xs font-bold uppercase tracking-wider text-grey hover:text-plum">
        ← Kursplanen
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-2xs font-bold uppercase tracking-wider text-plum">{course.code}</p>
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-plum-dark">
            {course.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-grey">{course.description}</p>
        </div>
        <ProgressRing value={pct} size={84} label={`${completed}/${chapters.length}`} sublabel="kapitel" />
      </div>

      <div className="relative mt-8 pl-1">
        <div className="absolute bottom-6 left-[19px] top-6 w-0.5 rounded bg-[--grey-light]" />

        <div className="space-y-2">
          {chapters.map((ch, i) => {
            const status = ch.status ?? "available";
            const isNext = status === "available" && i === chapters.findIndex((c) => !c.status);
            return (
              <Link
                key={ch.id}
                href={`/kapitel/${ch.id}`}
                className={`group relative flex items-center gap-4 rounded-2xl border px-3 py-3 transition-all ${
                  isNext
                    ? "border-plum bg-[--orange-light]"
                    : "border-transparent hover:border-[--grey-light] hover:bg-[--grey-light]"
                }`}
              >
                <span className="relative z-10 bg-white">
                  <Ring status={status} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-grey">
                      {ch.code}
                    </span>
                    {isNext && (
                      <span className="rounded-full bg-plum px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        nästa
                      </span>
                    )}
                  </span>
                  <span className="block text-sm font-semibold leading-snug text-plum-dark">
                    {ch.title}
                  </span>
                  <span className="mt-0.5 block text-2xs text-grey">
                    ~{ch.estMinutes} min · {ch.recallCount} frågor · {ch.cardCount} kort ·{" "}
                    {ch.objectiveCount} lärandemål
                    {ch.recallTotal > 0 && ` · ${Math.round((ch.recallRight / ch.recallTotal) * 100)}% rätt`}
                  </span>
                </span>
                <span className="flex-shrink-0 text-grey transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
