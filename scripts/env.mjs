/**
 * Läser .env.local utan extra beroende och gör variablerna tillgängliga
 * för skripten (migrate/seed/videos).
 */
import fs from "node:fs";
import path from "node:path";

export function loadEnv(file = ".env.local") {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export const pgConfig = () => {
  const password = process.env.PGPASSWORD;
  if (!password) {
    throw new Error("PGPASSWORD saknas – lägg den i .env.local (inga standardvärden i koden).");
  }
  return {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "drplugg",
    user: process.env.PGUSER || "drplugg",
    password,
  };
};
