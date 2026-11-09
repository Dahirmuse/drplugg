/**
 * Migrering: skapar databasen om den saknas, kör db/schema.sql och ser till
 * att admin-kontot (ADMIN_EMAIL) finns med rollen "admin".
 *
 *   npm run db:migrate
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { loadEnv, pgConfig } from "./env.mjs";

loadEnv();

const config = pgConfig();

async function ensureDatabase() {
  const admin = new Client({ ...config, database: "postgres" });
  try {
    await admin.connect();
  } catch (err) {
    console.error(
      `\n✗ Kunde inte ansluta till PostgreSQL som "${config.user}" på ${config.host}:${config.port}.\n  ${err.message}\n`,
    );
    console.error(
      "  Skapa rollen/databasen först, t.ex.:\n" +
        `    sudo -u postgres psql -c "CREATE ROLE ${config.user} LOGIN PASSWORD '${config.password}';"\n` +
        `    sudo -u postgres psql -c "CREATE DATABASE ${config.database} OWNER ${config.user};"\n`,
    );
    process.exit(1);
  }

  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    config.database,
  ]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${config.database}"`);
    console.log(`+ skapade databasen ${config.database}`);
  }
  await admin.end();
}

async function main() {
  await ensureDatabase();

  const client = new Client(config);
  await client.connect();

  const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  await client.query(schema);
  console.log("✓ schema applicerat (db/schema.sql)");

  const adminEmail = (process.env.ADMIN_EMAIL || "daahirmuse@gmail.com").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "DrPlugg2026!";

  const existing = await client.query("SELECT id, role FROM users WHERE email = $1", [adminEmail]);

  if (existing.rowCount === 0) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await client.query(
      `INSERT INTO users (email, password_hash, role, display_name, verified)
       VALUES ($1, $2, 'admin', 'Dahir (admin)', true)`,
      [adminEmail, hash],
    );
    console.log(`+ admin-konto skapat: ${adminEmail}`);
    console.log(`  lösenord: ${adminPassword}  (byt i /admin efter inloggning)`);
  } else {
    await client.query(
      "UPDATE users SET role = 'admin', verified = true WHERE email = $1",
      [adminEmail],
    );
    if (process.env.ADMIN_PASSWORD) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await client.query("UPDATE users SET password_hash = $2 WHERE email = $1", [
        adminEmail,
        hash,
      ]);
      console.log(`✓ admin-lösenord uppdaterat för ${adminEmail}`);
    } else {
      console.log(`✓ ${adminEmail} har rollen admin och är verifierad (befintligt lösenord behålls)`);
    }
  }

  // Slumpa JWT-hemlighet om den fortfarande är dev-defaulten
  if (!process.env.JWT_SECRET) {
    console.log(
      `\n! JWT_SECRET saknas i .env.local – lägg till t.ex.:\n  JWT_SECRET=${crypto.randomBytes(32).toString("hex")}`,
    );
  }

  // Feature-flaggor som standard
  await client.query(
    `INSERT INTO feature_flags (key, enabled, description) VALUES
       ('chatt', true, 'Sokratisk AI-chatt'),
       ('repetition', true, 'FSRS-5 spaced repetition'),
       ('spel', true, 'Spel och dagens utmaning'),
       ('kallor', true, 'Uppladdning av eget källmaterial'),
       ('admin', true, 'Adminpanel')
     ON CONFLICT (key) DO NOTHING`,
  );

  await client.end();
  console.log("✓ migrering klar");
}

main().catch((err) => {
  console.error("✗ migrering misslyckades:", err.message);
  process.exit(1);
});
