import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listCourses } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function KursPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const courses = await listCourses(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-plum-dark">
          Kursplanen
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-grey">
          Hela läkarprogrammet vid Karolinska Institutet – från Basvetenskap 1 till Klinisk
          medicin 7. Välj ett kapitel, återkalla aktivt och låt repetitionen sköta resten.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => {
          const pct = c.chapters ? Math.round((c.completed / c.chapters) * 100) : 0;
          return (
            <Link key={c.id} href={`/kurs/${c.id}`} className="dp-card dp-card-hover group p-5">
              <div className="flex items-start justify-between">
                <span className="text-2xl">{c.icon}</span>
                <span className="rounded-full bg-[--grey-light] px-2 py-0.5 text-2xs font-bold text-grey">
                  {c.term ?? ""}
                </span>
              </div>
              <p className="mt-3 text-2xs font-bold uppercase tracking-wider text-plum">{c.code}</p>
              <h2 className="mt-0.5 text-sm font-bold leading-snug text-plum-dark">
                {c.title.split(":").slice(1).join(":").trim() || c.title}
              </h2>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-grey">{c.description}</p>

              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[--grey-light]">
                  <div className="h-full rounded-full bg-plum transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-2xs text-grey">
                  {c.completed}/{c.chapters} kapitel klara
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-[--grey-light] bg-[--orange-light] p-4 text-xs leading-relaxed text-plum-dark">
        <strong>Eget material?</strong> Ladda upp dina sammanfattningar under{" "}
        <Link href="/kallor" className="font-semibold text-plum underline">
          Källor
        </Link>{" "}
        så grundar Karolina svaren i det du själv läser.
      </div>
    </div>
  );
}
