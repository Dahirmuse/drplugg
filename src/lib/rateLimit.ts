/**
 * Klient-IP för rate limiting.
 *
 * Bakom vår egen nginx (appen lyssnar bara på 127.0.0.1) sätter nginx
 * `X-Real-IP` till den riktiga klientadressen och skriver ÖVER eventuella
 * headers som klienten själv skickat. Därför litas headern bara på när
 * TRUST_PROXY=true är satt i miljön (görs i systemd-uniten).
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const TRUST_PROXY = process.env.TRUST_PROXY === "true";

export function clientIp(req: Request): string {
  const headers = req.headers;

  if (TRUST_PROXY) {
    const real = headers.get("x-real-ip")?.trim();
    if (real) return real;
  }

  return (
    headers.get("cf-connecting-ip")?.split(",")[0]?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "local"
  );
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0, remaining: limit - 1 };
  }

  bucket.count++;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
      remaining: 0,
    };
  }
  return { ok: true, retryAfterSec: 0, remaining: limit - bucket.count };
}

/** Städa bort gamla buckets då och då så minnet inte växer. */
export function sweepRateLimit(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
