import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryMany, queryOne } from "@/lib/db";
import { hasApiKey, streamCompletion, type ApiMessage } from "@/lib/deepseek";
import { buildSystemPrompt, withModePrefix, type ChatMode } from "@/lib/prompts";
import { snippetsFor } from "@/lib/retrieval";
import { getChapterDetail } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_MODES: ChatMode[] = ["sokratisk", "tentagen", "koncept", "kliniskt"];

type Body = {
  sessionId?: string | null;
  message?: string;
  mode?: ChatMode;
  chapterId?: string | null;
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  if (!hasApiKey()) {
    return NextResponse.json(
      { error: "Serverns DeepSeek-nyckel saknas i .env.local – chatten är avstängd." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Tomt meddelande." }, { status: 400 });

  const mode: ChatMode = VALID_MODES.includes(body.mode as ChatMode)
    ? (body.mode as ChatMode)
    : "sokratisk";

  // ── Session ────────────────────────────────────────────────
  let sessionId = body.sessionId ?? null;
  let chapterId = body.chapterId ?? null;

  if (sessionId) {
    const existing = await queryOne<{ id: string; chapter_id: string | null }>(
      `SELECT id, chapter_id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, user.id],
    );
    if (!existing) return NextResponse.json({ error: "Sessionen finns inte." }, { status: 404 });
    chapterId = chapterId ?? existing.chapter_id;
    await queryOne(
      `UPDATE chat_sessions SET mode = $1, chapter_id = COALESCE($2, chapter_id), updated_at = now()
        WHERE id = $3`,
      [mode, chapterId, sessionId],
    );
  } else {
    const title = message.length > 60 ? `${message.slice(0, 57)}…` : message;
    const created = await queryOne<{ id: string }>(
      `INSERT INTO chat_sessions (user_id, title, mode, chapter_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [user.id, title, mode, chapterId],
    );
    sessionId = created?.id ?? null;
    if (!sessionId) return NextResponse.json({ error: "Kunde inte skapa sessionen." }, { status: 500 });
  }

  await queryOne(
    `INSERT INTO messages (session_id, role, content) VALUES ($1, 'user', $2)`,
    [sessionId, message],
  );

  // ── Kontext ────────────────────────────────────────────────
  let chapterCtx = null;
  if (chapterId) {
    const detail = await getChapterDetail(chapterId, user.id);
    if (detail) {
      chapterCtx = {
        chapterTitle: detail.chapter.title,
        courseTitle: detail.course.title,
        summary: detail.chapter.summary,
        objectives: detail.objectives.map((o) => `${o.code ?? ""} ${o.title}`.trim()),
      };
    }
  }

  const snippets = await snippetsFor(user.id, chapterId, message, 4);

  const history = await queryMany<{ role: "user" | "assistant"; content: string }>(
    `SELECT role, content FROM messages WHERE session_id = $1 ORDER BY id ASC`,
    [sessionId],
  );

  const messages: ApiMessage[] = [
    { role: "system", content: buildSystemPrompt({ mode, chapter: chapterCtx, snippets }) },
    ...history.slice(0, -1).slice(-20).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: withModePrefix(mode, message) },
  ];

  let upstream: Response;
  try {
    upstream = await streamCompletion(messages, { temperature: 0.6, maxTokens: 1200 });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 502 });
  }

  const finalSessionId: string = sessionId;
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let assistantText = "";
  let buffer = "";
  let lineBuffer = "";

  const consumeLine = (line: string) => {
    if (!line.startsWith("data: ")) return;
    const raw = line.slice(6).trim();
    if (raw === "[DONE]") return;
    try {
      const json = JSON.parse(raw);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) assistantText += delta;
    } catch {
      /* delvis rad */
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        if (lineBuffer) consumeLine(lineBuffer.trim());
        if (assistantText.trim()) {
          await queryOne(
            `INSERT INTO messages (session_id, role, content) VALUES ($1, 'assistant', $2)`,
            [finalSessionId, assistantText.trim()],
          );
          await queryOne(`UPDATE chat_sessions SET updated_at = now() WHERE id = $1`, [
            finalSessionId,
          ]);
        }
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) consumeLine(line);
      controller.enqueue(value);
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Session-Id": finalSessionId,
    },
  });
}
