import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addPoints, ensureDeck, recordRecallAnswer, setChapterStatus } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    chapterId?: string;
    correct?: boolean;
    status?: "started" | "completed" | "mastered";
    addDeck?: boolean;
  };

  if (!body.chapterId) {
    return NextResponse.json({ error: "chapterId krävs." }, { status: 400 });
  }

  if (typeof body.correct === "boolean") {
    await recordRecallAnswer(user.id, body.chapterId, body.correct);
    if (body.correct) await addPoints(user.id, 2);
  }

  if (body.status) {
    await setChapterStatus(user.id, body.chapterId, body.status);
  }

  let added = 0;
  if (body.addDeck) {
    added = await ensureDeck(user.id, body.chapterId);
    if (added > 0) await addPoints(user.id, added);
  }

  return NextResponse.json({ ok: true, added });
}
