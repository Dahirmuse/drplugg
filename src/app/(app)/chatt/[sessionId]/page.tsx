import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queryMany, queryOne } from "@/lib/db";
import ChatClient from "@/components/ChatClient";
import type { ChatMode, GradeResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const session = await queryOne<{ id: string; mode: string; chapter_id: string | null }>(
    `SELECT id, mode, chapter_id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, user.id],
  );
  if (!session) notFound();

  const messages = await queryMany<{
    id: string;
    role: "user" | "assistant";
    content: string;
    grade: GradeResult | null;
  }>(
    `SELECT id::text AS id, role, content, grade FROM messages
      WHERE session_id = $1 ORDER BY id ASC`,
    [sessionId],
  );

  const chapters = await queryMany<{ id: string; title: string; course: string }>(
    `SELECT ch.id, ch.title, c.code AS course
       FROM chapters ch JOIN courses c ON c.id = ch.course_id
      WHERE ch.archived = false
      ORDER BY c.sort_order, ch.sort_order`,
  );

  const lastGrade =
    [...messages].reverse().find((m) => m.grade)?.grade ?? null;

  return (
    <ChatClient
      initialSessionId={session.id}
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
      initialMode={(session.mode as ChatMode) ?? "sokratisk"}
      initialChapterId={session.chapter_id}
      initialGrade={lastGrade}
      chapters={chapters}
      apiKeyMissing={!process.env.DEEPSEEK_API_KEY}
    />
  );
}
