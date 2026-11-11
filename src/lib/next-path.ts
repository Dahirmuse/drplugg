/**
 * Validering av `?next=`-mål (skydd mot öppen omdirigering).
 *
 * Används både i middleware och i inloggningsformuläret, och importeras därför
 * från en egen modul utan miljöberoenden (den hamnar även i klientbundlen).
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/hem"): string {
  const value = (raw ?? "").trim();
  if (!value) return fallback;
  // Endast interna sökvägar: avvisar "//evil.example" och "https://evil.example".
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\r\n\t]/.test(value)) return fallback;
  return value;
}
