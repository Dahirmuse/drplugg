import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __drpluggPool: Pool | undefined;
}

/**
 * Lösenordet får aldrig ha ett hårdkodat standardvärde – det skulle hamna i
 * produktionsbygget. Saknas det avbryts anslutningen med ett tydligt fel.
 */
function requirePassword(): string {
  const value = (process.env.PGPASSWORD || "").trim();
  const isProduction = process.env.NODE_ENV === "production";
  // Svaga värden: för kort, platshållare, eller identiskt med rollnamnet.
  // (Inga gamla lösenord skrivs in här – de skulle fastna i bygget och larma scannrar.)
  const weak =
    value.length < 12 ||
    value.toLowerCase().includes("byt-mig") ||
    value.toLowerCase() === (process.env.PGUSER || "drplugg").toLowerCase();
  if (isProduction && weak) {
    throw new Error(
      "PGPASSWORD är för svag eller en platshållare – sätt ett unikt lösenord i .env.local.",
    );
  }
  if (value) return value;
  return "drplugg";
}

/**
 * Poolen skapas först vid första frågan (lat), så att `next build` kan
 * importera rutterna utan databasuppgifter.
 */
function createPool(): Pool {
  return new Pool({
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5432", 10),
    database: process.env.PGDATABASE || "drplugg",
    user: process.env.PGUSER || "drplugg",
    password: requirePassword(),
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export function getPool(): Pool {
  if (!global.__drpluggPool) global.__drpluggPool = createPool();
  return global.__drpluggPool;
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const { rows } = await getPool().query(text, params);
  return (rows[0] as T) ?? null;
}

export async function queryMany<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await getPool().query(text, params);
  return rows as T[];
}

export async function execute(text: string, params?: unknown[]): Promise<number> {
  const result = await getPool().query(text, params);
  return result.rowCount ?? 0;
}
