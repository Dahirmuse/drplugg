import { NextResponse } from "next/server";
import { getUserByEmail, setAuthCookie, signToken, verifyPassword } from "@/lib/auth";
import { execute } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {

  const rl = rateLimit(`login:${clientIp(req)}`, 12, 300000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "För många försök. Vänta en stund och försök igen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ error: "E-post och lösenord krävs." }, { status: 400 });
  }

  const existing = await getUserByEmail(email);
  if (!existing) {
    return NextResponse.json(
      { error: "Ingen användare med den e-postadressen. Skapa ett konto först." },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(password, existing.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Fel lösenord." }, { status: 401 });
  }

  // Konton som registrerats men inte verifierat e-posten måste verifiera först.
  if (!existing.verified) {
    return NextResponse.json(
      {
        error: "Kontot är inte verifierat. Ange koden du fick via e-post.",
        needsVerification: true,
        email: existing.email,
      },
      { status: 403 },
    );
  }

  const user = {
    id: existing.id,
    email: existing.email,
    role: existing.role,
    displayName: existing.display_name,
  };

  await execute("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);

  const token = await signToken(user);
  await setAuthCookie(token);

  return NextResponse.json({ user });
}
