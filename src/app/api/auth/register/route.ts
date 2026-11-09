import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { adminEmail, createUser, getUserByEmail, hashPassword } from "@/lib/auth";
import { demoCodeAllowed, isMailConfigured, sendVerificationEmail } from "@/lib/mail";
import { createVerification } from "@/lib/verification";
import { queryOne } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {

  // Registrering kan stängas helt (vanligt på publika servrar). Då kan bara
  // en inloggad admin skapa konton – via adminpanelen.
  if (process.env.ALLOW_REGISTRATION !== "true") {
    const actor = await getCurrentUser();
    if (actor?.role !== "admin") {
      return NextResponse.json(
        { error: "Registrering är stängd. Kontakta administratören för att få ett konto." },
        { status: 403 },
      );
    }
  }

  const rl = rateLimit(`register:${clientIp(req)}`, 6, 600000);
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
  if (password.length < 6) {
    return NextResponse.json({ error: "Lösenordet måste vara minst 6 tecken." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Ogiltig e-postadress." }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();
  const existing = await getUserByEmail(normalized);

  if (existing?.verified) {
    return NextResponse.json(
      { error: "Den e-postadressen är redan registrerad. Logga in i stället." },
      { status: 409 },
    );
  }

  // Admin-kontot verifieras automatiskt och får sin roll direkt.
  const isAdminEmail = normalized === adminEmail();

  const hash = await hashPassword(password);
  const user = await createUser(normalized, hash);

  // Admin behöver aldrig verifiera sig.
  if (isAdminEmail) {
    await queryOne(`UPDATE users SET verified = true, role = 'admin' WHERE id = $1`, [user.id]);
    return NextResponse.json({
      user,
      verificationRequired: false,
      message: "Admin-kontot är aktiverat – logga in.",
    });
  }

  const code = await createVerification(user.id, normalized);
  const result = await sendVerificationEmail({ userId: user.id, to: normalized, code });

  const mailConfigured = isMailConfigured();
  const demoMode = !mailConfigured && demoCodeAllowed(req);

  return NextResponse.json({
    verificationRequired: true,
    email: normalized,
    delivered: result.delivered,
    transport: result.transport,
    // Endast i demoläge (ingen SMTP alls) visas koden, så att flödet går att testa.
    demoCode: demoMode ? code : null,
    smtpConfigured: !demoMode,
    error: result.delivered || demoMode ? undefined : `Kunde inte skicka mejlet: ${result.error}`,
    message: result.delivered
      ? "Vi har skickat en verifieringskod till din e-post."
      : demoMode
        ? "SMTP är inte konfigurerat – koden visas här i demoläget."
        : "E-postutskick är inte konfigurerat på servern, så kontot kan inte verifieras just nu. Kontakta administratören.",
  });
}
