import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth";
import { demoCodeAllowed, isMailConfigured, sendPasswordResetEmail } from "@/lib/mail";
import { createVerification } from "@/lib/verification";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Skickar en engångskod för lösenordsåterställning. */
export async function POST(req: Request) {

  const rl = rateLimit(`forgot:${clientIp(req)}`, 5, 600000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "För många försök. Vänta en stund och försök igen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email) return NextResponse.json({ error: "E-post krävs." }, { status: 400 });

  const user = await getUserByEmail(email);
  const demoMode = !isMailConfigured() && demoCodeAllowed(req);

  // Svara neutralt om kontot inte finns (undviker att avslöja vilka adresser som är registrerade).
  if (!user) {
    return NextResponse.json({
      ok: true,
      message: "Om adressen finns hos oss har vi skickat en kod.",
      demoCode: null,
    });
  }

  const code = await createVerification(user.id, user.email);
  const result = await sendPasswordResetEmail({ userId: user.id, to: user.email, code });

  return NextResponse.json({
    ok: true,
    delivered: result.delivered,
    transport: result.transport,
    demoCode: demoMode ? code : null,
    smtpConfigured: !demoMode,
    message: demoMode
      ? "SMTP är inte konfigurerat – koden visas här i demoläget."
      : result.delivered
        ? "Om adressen finns hos oss har vi skickat en kod."
        : "Mejlet kunde inte skickas. Kontrollera SMTP-inställningarna.",
    error: result.delivered || demoMode ? undefined : result.error,
  });
}
