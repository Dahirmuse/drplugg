import { getCurrentUser } from "@/lib/auth";
import { queryMany } from "@/lib/db";
import ChatClient from "@/components/ChatClient";
import type { ChatMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ chapter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { chapter } = await searchParams;
  const chapters = await queryMany<{ id: string; title: string; course: string }>(
    `SELECT ch.id, ch.title, c.code AS course
       FROM chapters ch JOIN courses c ON c.id = ch.course_id
      WHERE ch.archived = false
      ORDER BY c.sort_order, ch.sort_order`,
  );

  return (
    <ChatClient
      initialSessionId={null}
      initialMessages={[]}
      initialMode={"sokratisk" as ChatMode}
      initialChapterId={chapter ?? null}
      initialGrade={null}
      chapters={chapters}
      apiKeyMissing={!process.env.DEEPSEEK_API_KEY}
    />
  );
}
