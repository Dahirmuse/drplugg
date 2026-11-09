import { NextResponse } from "next/server";
import { getUserByEmail, setAuthCookie, signToken } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { checkVerification } from "@/lib/verification";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {

  const rl = rateLimit(`verify:${clientIp(req)}`, 20, 600000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "För många försök. Vänta en stund och försök igen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const { email, code } = (await req.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
  };

  if (!email || !code) {
    return NextResponse.json({ error: "E-post och kod krävs." }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Kontot finns inte – registrera dig igen." }, { status: 404 });
  }

  const result = await checkVerification(user.id, code);

  if (!result.ok) {
    const messages: Record<string, string> = {
      none: "Ingen aktiv kod finns. Begär en ny kod.",
      locked: "För många försök. Begär en ny kod.",
      expired: "Koden har gått ut. Begär en ny kod.",
    };
    return NextResponse.json(
      {
        error:
          result.reason === "wrong"
            ? `Fel kod. ${result.attemptsLeft} försök kvar.`
            : messages[result.reason],
        reason: result.reason,
      },
      { status: 400 },
    );
  }

  await queryOne(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

  const authUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
  };
  const token = await signToken(authUser);
  await setAuthCookie(token);

  return NextResponse.json({ user: authUser, verified: true });
}
