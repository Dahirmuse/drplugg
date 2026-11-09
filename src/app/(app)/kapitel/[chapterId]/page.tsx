import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getChapterDetail } from "@/lib/repo";
import { getNinjaVideos } from "@/lib/content";
import ChapterStudy from "@/components/ChapterStudy";

export const dynamic = "force-dynamic";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const detail = await getChapterDetail(chapterId, user.id);
  if (!detail) notFound();

  const videos = getNinjaVideos(chapterId);
  const topics = detail.chapter.ninjaTopics ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ChapterStudy
        chapterId={detail.chapter.id}
        chapterTitle={detail.chapter.title}
        chapterCode={detail.chapter.code}
        courseTitle={detail.course.title}
        courseId={detail.course.id}
        summary={detail.chapter.summary}
        objectives={detail.objectives}
        sections={detail.chapter.sections ?? []}
        facts={detail.chapter.facts ?? []}
        recall={detail.recall.map((r) => ({
          id: r.id,
          kind: r.kind,
          prompt: r.prompt,
          options: r.options,
          answer: r.answer,
          explanation: r.explanation,
        }))}
        cards={detail.cards}
        videos={videos}
        topics={topics}
        status={detail.status}
      />
    </div>
  );
}
