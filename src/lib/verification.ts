import bcrypt from "bcryptjs";
import { execute, queryOne } from "./db";

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 6;

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Skapar en ny engångskod och ogiltigförklarar tidigare oanvända koder. */
export async function createVerification(userId: string, email: string): Promise<string> {
  const code = generateCode();
  const hash = await bcrypt.hash(code, 10);

  await execute(
    `UPDATE email_verifications SET consumed_at = now()
      WHERE user_id = $1 AND consumed_at IS NULL`,
    [userId],
  );

  await execute(
    `INSERT INTO email_verifications (user_id, email, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [userId, email, hash, String(CODE_TTL_MINUTES)],
  );

  return code;
}

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "none" | "locked" | "expired" | "wrong"; attemptsLeft?: number };

export async function checkVerification(userId: string, code: string): Promise<VerifyResult> {
  const row = await queryOne<{
    id: string;
    code_hash: string;
    attempts: number;
    expired: boolean;
  }>(
    `SELECT id::text AS id, code_hash, attempts,
            (expires_at < now()) AS expired
       FROM email_verifications
      WHERE user_id = $1 AND consumed_at IS NULL
      ORDER BY id DESC
      LIMIT 1`,
    [userId],
  );

  if (!row) return { ok: false, reason: "none" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  if (row.expired) return { ok: false, reason: "expired" };

  const match = await bcrypt.compare(code.trim(), row.code_hash);

  if (!match) {
    await execute(`UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    return { ok: false, reason: "wrong", attemptsLeft: MAX_ATTEMPTS - row.attempts - 1 };
  }

  await execute(`UPDATE email_verifications SET consumed_at = now() WHERE id = $1`, [row.id]);
  await execute(`UPDATE users SET verified = true, updated_at = now() WHERE id = $1`, [userId]);

  return { ok: true, userId };
}

export async function isVerified(userId: string): Promise<boolean> {
  const row = await queryOne<{ verified: boolean }>(
    `SELECT verified FROM users WHERE id = $1`,
    [userId],
  );
  return row?.verified ?? false;
}

export const VERIFICATION_TTL_MINUTES = CODE_TTL_MINUTES;
export const VERIFICATION_MAX_ATTEMPTS = MAX_ATTEMPTS;
