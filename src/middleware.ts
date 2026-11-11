import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { requestOrigin, withOrigin } from "@/lib/origin";
import { safeNextPath } from "@/lib/next-path";

function jwtKey(): Uint8Array {
  const raw = (process.env.JWT_SECRET || "").trim();
  const weak = raw.length < 32 || raw.toLowerCase().includes("byt-mig");
  if (weak && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET är för svag (minst 32 tecken).");
  }
  return new TextEncoder().encode(raw || "drplugg-dev-jwt-secret-change-in-production");
}
const COOKIE_NAME = "drplugg_token";

const PUBLIC = ["/login", "/api/auth/"];

/**
 * Omdirigering med PUBLIK adress i Location.
 *
 * `request.nextUrl` bygger på den interna adressen (localhost:3311) eftersom
 * appen bara lyssnar på 127.0.0.1 bakom nginx – den får därför aldrig användas
 * här. Originen hämtas från PUBLIC_URL → nginx-headrarna → Host-headern, och
 * som sista utväg requestens egen origin (direktanrop mot 127.0.0.1).
 *
 * Location MÅSTE vara absolut: Next:s middleware-adapter kör `new URL()` på
 * headern och svarar 500 på en relativ sökväg.
 */
function redirectTo(req: NextRequest, pathWithQuery: string, status = 307): NextResponse {
  const origin = requestOrigin(req.headers) ?? req.nextUrl.origin;
  return new NextResponse(null, {
    status,
    headers: {
      Location: withOrigin(pathWithQuery, origin),
      "Cache-Control": "no-store",
    },
  });
}

/** API-anrop ska få 401 JSON (inte en HTML-omdirigering till /login). */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Inte inloggad." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  const isApi = pathname.startsWith("/api/");

  const token = request.cookies.get(COOKIE_NAME)?.value;
  let authed = false;
  if (token) {
    try {
      await jwtVerify(token, jwtKey());
      authed = true;
    } catch {
      authed = false;
    }
  }

  if (!authed && !isPublic) {
    if (isApi) return unauthorized();
    // Spara var användaren ville (bara sökvägen – aldrig en extern adress).
    const target = pathname === "/" ? "" : `${pathname}${search}`;
    return redirectTo(
      request,
      target ? `/login?next=${encodeURIComponent(target)}` : "/login",
    );
  }

  // Giltig token men användaren finns inte längre (raderat konto): rensa cookien
  // i stället för att hamna i en oändlig omdirigering mellan /hem och /login.
  const expired = request.nextUrl.searchParams.get("expired") === "1";
  if (authed && pathname.startsWith("/login") && expired) {
    const res = NextResponse.next();
    res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
  }

  if (authed && pathname.startsWith("/login")) {
    return redirectTo(request, safeNextPath(request.nextUrl.searchParams.get("next")));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|vendor/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
