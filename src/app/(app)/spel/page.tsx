import { getCurrentUser } from "@/lib/auth";
import { bestScores } from "@/lib/repo";
import { queryMany } from "@/lib/db";
import GameHub from "@/components/games/GameHub";

export const dynamic = "force-dynamic";

export default async function SpelPage({
  searchParams,
}: {
  searchParams: Promise<{ chapter?: string; course?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { chapter, course } = await searchParams;

  const courses = await queryMany<{ id: string; code: string; title: string; icon: string }>(
    `SELECT id, code, title, icon FROM courses ORDER BY sort_order, code`,
  );

  const chapters = await queryMany<{ id: string; title: string; courseId: string }>(
    `SELECT ch.id, ch.title, ch.course_id AS "courseId"
       FROM chapters ch JOIN courses c ON c.id = ch.course_id
      WHERE ch.archived = false
      ORDER BY c.sort_order, ch.sort_order`,
  );

  const best = await bestScores(user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <GameHub
        courses={courses}
        chapters={chapters}
        initialBest={best}
        initialChapterId={chapter ?? ""}
        initialCourseId={course ?? ""}
      />
    </div>
  );
}
