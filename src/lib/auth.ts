import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { queryOne } from "./db";

function jwtKey(): Uint8Array {
  const raw = (process.env.JWT_SECRET || "").trim();
  const isProduction = process.env.NODE_ENV === "production";
  const weak = raw.length < 32 || raw.toLowerCase().includes("byt-mig");
  if (isProduction && weak) {
    throw new Error(
      "JWT_SECRET är för svag (minst 32 tecken, inte platshållaren 'byt-mig'). Generera med: openssl rand -hex 32",
    );
  }
  return new TextEncoder().encode(raw || "drplugg-dev-jwt-secret-change-in-production");
}

const COOKIE_NAME = "drplugg_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dagar

export type Role = "student" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  displayName: string | null;
}

export function adminEmail(): string {
  return (process.env.ADMIN_EMAIL || "daahirmuse@gmail.com").toLowerCase().trim();
}

// ── Token ───────────────────────────────────────────────────
export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(jwtKey());
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, jwtKey());
    return {
      id: payload.sub as string,
      email: payload.email as string,
      role: (payload.role as Role) ?? "student",
      displayName: null,
    };
  } catch {
    return null;
  }
}

// ── Cookies ────────────────────────────────────────────────
// Secure-cookies fungerar inte över plain http (t.ex. LAN-IP). COOKIE_SECURE=false
// gör att du kan logga in lokalt; sätts till true automatiskt i produktion bakom HTTPS.
const COOKIE_SECURE =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production" && process.env.ALLOW_HTTP !== "true";

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function removeAuthCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

// ── Användare ──────────────────────────────────────────────
const USER_COLUMNS = "id, email, role, display_name";

export async function getUserByEmail(email: string) {
  return queryOne<{
    id: string;
    email: string;
    password_hash: string;
    role: Role;
    display_name: string | null;
    verified: boolean;
  }>(
    `SELECT id, email, password_hash, role, display_name, verified FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
}

export async function createUser(email: string, passwordHash: string): Promise<AuthUser> {
  const normalized = email.toLowerCase().trim();
  const role: Role = normalized === adminEmail() ? "admin" : "student";
  const row = await queryOne<{
    id: string;
    email: string;
    role: Role;
    display_name: string | null;
  }>(
    `INSERT INTO users (email, password_hash, role, verified) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING ${USER_COLUMNS}`,
    [normalized, passwordHash, role, role === "admin"],
  );
  if (!row) throw new Error("Kunde inte skapa användare");
  return { id: row.id, email: row.email, role: row.role, displayName: row.display_name };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Hämtar inloggad användare (cachad per request). */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const claims = await verifyToken(token);
  if (!claims) return null;

  // Rollen läses alltid från databasen så att admin-ändringar slår igenom direkt.
  const row = await queryOne<{
    id: string;
    email: string;
    role: Role;
    display_name: string | null;
  }>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [claims.id]);

  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
  };
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("INTE_INLOGGAD");
  return user;
}
