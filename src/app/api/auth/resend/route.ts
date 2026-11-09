import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth";
import { demoCodeAllowed, isMailConfigured, sendVerificationEmail } from "@/lib/mail";
import { createVerification, VERIFICATION_TTL_MINUTES } from "@/lib/verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Skickar en ny verifieringskod (t.ex. om den gamla gått ut). */
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "E-post krävs." }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Kontot finns inte." }, { status: 404 });
  }
  if (user.verified) {
    return NextResponse.json({ error: "Kontot är redan verifierat – logga in." }, { status: 400 });
  }

  const code = await createVerification(user.id, user.email);
  const result = await sendVerificationEmail({ userId: user.id, to: user.email, code });
  const demoMode = !isMailConfigured() && demoCodeAllowed(req);

  return NextResponse.json({
    delivered: result.delivered,
    transport: result.transport,
    demoCode: demoMode ? code : null,
    smtpConfigured: !demoMode,
    ttlMinutes: VERIFICATION_TTL_MINUTES,
    message: result.delivered
      ? "En ny kod har skickats till din e-post."
      : demoMode
        ? "SMTP är inte konfigurerat – den nya koden visas här i demoläget."
        : "Mejlet kunde inte skickas. Kontrollera SMTP-inställningarna.",
    error: result.delivered || demoMode ? undefined : result.error,
  });
}
