/**
 * Appens PUBLIKA adress.
 *
 * Appen lyssnar bara på 127.0.0.1 bakom nginx. Absoluta URL:er (omdirigeringar,
 * metadata, länkar) får därför ALDRIG byggas av request-URL:en – den ger den
 * interna adressen (`http://localhost:3311`) och skickar besökaren till en död
 * adress som inte finns utanför servern.
 *
 * Ordningen (`requestOrigin`):
 *   1. `PUBLIC_URL` (sätts av install.sh/enable-tls.sh) – t.ex. https://drplugg.se
 *   2. `TRUST_PROXY=true` + nginx:s `X-Forwarded-Proto` / `X-Forwarded-Host`.
 *      nginx skriver ÖVER båda headrarna, så klienten kan inte styra dem.
 *   3. `Host`-headern (den adress klienten faktiskt anropade, t.ex. via nginx)
 *   4. sist: requestens egen origin – bara vid direktanrop mot 127.0.0.1
 *
 * Middleware MÅSTE få en absolut adress: Next:s middleware-adapter kör
 * `new URL(Location)` på svaret och kraschar (500) på en relativ sökväg.
 * Serverkomponenternas `redirect()` skickar däremot alltid relativa sökvägar,
 * vilket är korrekt bakom vilken proxy som helst.
 */

/** Adresser som bara finns inne på servern – aldrig ett giltigt publikt svar. */
function isInternalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h === "::") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  return false;
}

/**
 * Validerar att värdet är en riktig http(s)-origin och returnerar den utan
 * avslutande snedstreck. `allowInternal` tillåts bara för Host-headern, där den
 * interna adressen är den adress klienten faktiskt använde.
 */
function normaliseOrigin(raw: string | null | undefined, allowInternal = false): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!allowInternal && isInternalHost(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Publik origin från miljön (`PUBLIC_URL`), eller null om den inte är satt/giltig. */
export function publicOrigin(): string | null {
  return normaliseOrigin(process.env.PUBLIC_URL);
}

export function trustProxy(): boolean {
  return process.env.TRUST_PROXY === "true";
}

/** Härleder origin ur nginx-headrarna – endast när vi litar på proxyn. */
export function forwardedOrigin(headers: Headers): string | null {
  if (!trustProxy()) return null;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (proto !== "https" && proto !== "http") return null;
  if (!host) return null;
  return normaliseOrigin(`${proto}://${host}`);
}

/** Origin ur klientens `Host`-header (den adress som faktiskt anropades). */
export function hostHeaderOrigin(headers: Headers): string | null {
  const host = headers.get("host")?.split(",")[0]?.trim();
  if (!host) return null;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const scheme = proto === "https" ? "https" : "http";
  return normaliseOrigin(`${scheme}://${host}`, true);
}

/** Origin att bygga absoluta URL:er med. */
export function requestOrigin(headers: Headers): string | null {
  return publicOrigin() ?? forwardedOrigin(headers) ?? hostHeaderOrigin(headers);
}

/** Gör om en app-relativ sökväg (`/login?next=%2Fhem`) till en absolut URL. */
export function withOrigin(pathWithQuery: string, origin: string): string {
  return `${origin}${pathWithQuery}`;
}
