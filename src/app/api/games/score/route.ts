import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { bestScores, leaderboard, recordGame } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const game = new URL(req.url).searchParams.get("game") || "blixtquiz";
  return NextResponse.json({
    best: await bestScores(user.id),
    leaderboard: await leaderboard(game),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    game?: string;
    chapterId?: string | null;
    score?: number;
    maxScore?: number;
    durationMs?: number;
    detail?: unknown;
  };

  if (!body.game || typeof body.score !== "number") {
    return NextResponse.json({ error: "game och score krävs." }, { status: 400 });
  }

  await recordGame(user.id, {
    game: body.game,
    chapterId: body.chapterId ?? null,
    score: Math.max(0, Math.round(body.score)),
    maxScore: Math.max(0, Math.round(body.maxScore ?? 0)),
    durationMs: body.durationMs,
    detail: body.detail,
  });

  return NextResponse.json({
    ok: true,
    best: await bestScores(user.id),
    leaderboard: await leaderboard(body.game),
  });
}
