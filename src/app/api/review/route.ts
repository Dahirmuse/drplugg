import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addPoints, cardPreview, reviewCard } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    cardId?: string;
    rating?: number;
    elapsedMs?: number;
    note?: string;
    source?: string;
  };

  if (!body.cardId || !body.rating || ![1, 2, 3, 4].includes(body.rating)) {
    return NextResponse.json({ error: "cardId och rating (1–4) krävs." }, { status: 400 });
  }

  try {
    const result = await reviewCard(user.id, body.cardId, body.rating as 1 | 2 | 3 | 4, {
      source: body.source ?? "sjalv",
      elapsedMs: body.elapsedMs,
      note: body.note,
    });

    // Poäng: rätt-svar ger mer än "igen"
    const points = body.rating >= 3 ? 4 : 1;
    await addPoints(user.id, points);

    return NextResponse.json({
      ok: true,
      card: result.stored,
      preview: await cardPreview(body.cardId, user.id),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
