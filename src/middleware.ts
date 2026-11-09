import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));

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
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
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
    const url = request.nextUrl.clone();
    url.pathname = "/hem";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|vendor/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
