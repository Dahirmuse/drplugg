/**
 * Skapar/uppdaterar admin-kontot från .env.local.
 * Körs av install.sh – skriver ALDRIG ut lösenordet.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import bcrypt from "bcryptjs";

// --check: verifiera bara att alla importer löses (används av build-prod i isolerad katalog)
const CHECK_ONLY = process.argv.includes("--check");

function loadEnv(file) {
  const text = fs.readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const APP_DIR = path.dirname(new URL(import.meta.url).pathname);
const ENV_FILE = path.resolve(APP_DIR, "..", ".env.local");

if (CHECK_ONLY) {
  console.log("✓ create-admin.mjs: alla importer (pg, bcryptjs) löses");
  process.exit(0);
}

loadEnv(ENV_FILE);

const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || "";

if (!email || !email.includes("@")) {
  console.error("✗ ADMIN_EMAIL saknas eller är ogiltig i .env.local");
  process.exit(1);
}

const client = new Client({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "drplugg",
  user: process.env.PGUSER || "drplugg",
  password: process.env.PGPASSWORD,
});

await client.connect();

const existing = await client.query("SELECT id FROM users WHERE email = $1", [email]);

if (existing.rowCount > 0) {
  await client.query("UPDATE users SET role = 'admin', verified = true WHERE email = $1", [email]);
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await client.query("UPDATE users SET password_hash = $1 WHERE email = $2", [hash, email]);
    console.log(`✓ admin uppdaterad: ${email} (nytt lösenord satt från .env.local)`);
  } else {
    console.log(`✓ ${email} har rollen admin (befintligt lösenord behålls)`);
  }
} else {
  if (!password) {
    console.error("✗ ADMIN_PASSWORD saknas i .env.local – kan inte skapa admin-kontot");
    await client.end();
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await client.query(
    `INSERT INTO users (email, password_hash, role, verified) VALUES ($1, $2, 'admin', true)`,
    [email, hash],
  );
  console.log(`✓ admin-konto skapat: ${email}`);
}

await client.end();
