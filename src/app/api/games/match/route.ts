import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { matchPairsForScope } from "@/lib/matchPairs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Begreppspar till Termmatch (term → definition).
 * Fyller på med AI-genererade par om modulen inte har tillräckligt många.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });

  const url = new URL(req.url);
  const chapterId = url.searchParams.get("chapterId");
  const courseId = url.searchParams.get("courseId");
  const limit = Number(url.searchParams.get("limit") || 6);

  try {
    const pairs = await matchPairsForScope({ userId: user.id, chapterId, courseId, limit });
    if (pairs.length === 0) {
      return NextResponse.json(
        { pairs: [], error: "Inga begrepp hittades för det urvalet." },
        { status: 200 },
      );
    }
    return NextResponse.json({ pairs });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Kunde inte hämta begrepp." },
      { status: 502 },
    );
  }
}
