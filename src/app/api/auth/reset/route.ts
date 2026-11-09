import { NextResponse } from "next/server";
import { getUserByEmail, hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { execute } from "@/lib/db";
import { checkVerification } from "@/lib/verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sätter nytt lösenord med hjälp av engångskoden från mejlet. */
export async function POST(req: Request) {
  const { email, code, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
    password?: string;
  };

  if (!email || !code || !password) {
    return NextResponse.json({ error: "E-post, kod och nytt lösenord krävs." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Lösenordet måste vara minst 6 tecken." }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Kontot finns inte." }, { status: 404 });
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

  const hash = await hashPassword(password);
  await execute(
    `UPDATE users SET password_hash = $1, verified = true, updated_at = now() WHERE id = $2`,
    [hash, user.id],
  );

  const authUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
  };
  const token = await signToken(authUser);
  await setAuthCookie(token);

  return NextResponse.json({ user: authUser, reset: true });
}
