import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isMailConfigured } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Publik konfiguration som inloggningssidan behöver (inga hemligheter). */
export async function GET() {
  const openByEnv = process.env.ALLOW_REGISTRATION === "true";
  const user = await getCurrentUser();

  return NextResponse.json({
    registrationOpen: openByEnv || user?.role === "admin",
    smtpConfigured: isMailConfigured(),
    adminLoginHint: (process.env.ADMIN_EMAIL || "").toLowerCase() || null,
  });
}
