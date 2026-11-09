import fs from "node:fs";
import path from "node:path";
import { execute, queryMany, queryOne } from "./db";

/**
 * SMTP-konfiguration. Läses i den här ordningen:
 *   1. config/smtp.json  (samma struktur som i dokumentationen)
 *   2. miljövariabler    SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD,
 *                        SMTP_FROM_ADDRESS, SMTP_FROM_NAME
 *
 * Exempel på config/smtp.json:
 * {
 *   "SMTP": {
 *     "Host": "smtp-relay.example.com",
 *     "Port": 587,
 *     "EnableSSL": true,
 *     "UserName": "YOUR_SMTP_USERNAME",
 *     "Password": "YOUR_SMTP_PASSWORD",
 *     "FromAddress": "noreply@your-domain.example",
 *     "FromName": "DrPlugg"
 *   }
 * }
 */

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

const PLACEHOLDERS = [
  "your_smtp_username",
  "your_smtp_password",
  "smtp-relay.example.com",
  "noreply@your-domain.example",
];

function usable(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v.length > 0 && !PLACEHOLDERS.some((p) => v.includes(p));
}

function fromFile(): SmtpSettings | null {
  const file = path.join(process.cwd(), "config", "smtp.json");
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      SMTP?: Record<string, unknown>;
    };
    const s = raw.SMTP;
    if (!s) return null;
    const host = String(s.Host ?? "");
    const user = String(s.UserName ?? "");
    const password = String(s.Password ?? "");
    if (!usable(host) || !usable(user) || !usable(password)) return null;

    const port = Number(s.Port ?? 587);
    const enableSsl = s.EnableSSL === true || String(s.EnableSSL) === "true";

    return {
      host,
      port,
      // EnableSSL avser krypterad anslutning direkt (465). På 587 används STARTTLS.
      secure: enableSsl && port === 465,
      user,
      password,
      fromAddress: String(s.FromAddress ?? user),
      fromName: String(s.FromName ?? "DrPlugg"),
    };
  } catch {
    return null;
  }
}

function fromEnv(): SmtpSettings | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS;
  if (!usable(host) || !usable(user) || !usable(password)) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host: host as string,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    user: user as string,
    password: password as string,
    fromAddress: process.env.SMTP_FROM_ADDRESS ?? (user as string),
    fromName: process.env.SMTP_FROM_NAME ?? "DrPlugg",
  };
}

export function smtpSettings(): SmtpSettings | null {
  return fromFile() ?? fromEnv();
}

export function isMailConfigured(): boolean {
  return smtpSettings() !== null;
}

/**
 * Demoläge (koden visas i klienten) får bara användas lokalt, så att
 * vem som helst inte kan återställa konton när appen ligger publikt.
 * Sätt ALLOW_DEMO_MAIL=true om du medvetet vill tillåta det utifrån.
 */
export function demoCodeAllowed(req: Request): boolean {
  if (process.env.ALLOW_DEMO_MAIL === "true") return true;
  const header =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    req.headers.get("x-real-ip") ??
    "";
  const ip = header.trim();
  return ip === "" || ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

export type SendResult = {
  delivered: boolean;
  transport: "smtp" | "demo";
  error?: string;
};

async function deliver(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<SendResult> {
  const settings = smtpSettings();
  if (!settings) {
    return { delivered: false, transport: "demo", error: "SMTP är inte konfigurerat" };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: settings.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    await transport.sendMail({
      from: `"${settings.fromName}" <${settings.fromAddress}>`,
      to,
      subject,
      text,
      html,
    });
    return { delivered: true, transport: "smtp" };
  } catch (err) {
    return { delivered: false, transport: "smtp", error: (err as Error).message };
  }
}

/** Loggar alla utskick i databasen (även demomeddelanden). */
async function logMail(input: {
  userId?: string | null;
  to: string;
  subject: string;
  body: string;
  result: SendResult;
  code?: string | null;
}): Promise<void> {
  await execute(
    `INSERT INTO mail_outbox (user_id, to_email, subject, body, delivered, transport, error, code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      input.userId ?? null,
      input.to,
      input.subject,
      input.body,
      input.result.delivered,
      input.result.transport,
      input.result.error ?? null,
      input.code ?? null,
    ],
  );
}

export async function sendVerificationEmail(input: {
  userId: string;
  to: string;
  code: string;
}): Promise<SendResult> {
  const subject = "DrPlugg – verifiera din e-post";
  const text = [
    "Hej!",
    "",
    `Din verifieringskod är: ${input.code}`,
    "",
    "Koden gäller i 15 minuter. Om du inte skapade kontot kan du ignorera det här mejlet.",
    "",
    "DrPlugg – aktiv inlärning för läkarprogrammet",
  ].join("\n");

  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;color:#4F0433;max-width:520px">
      <h2 style="margin:0 0 8px">Verifiera din e-post</h2>
      <p style="color:#666;margin:0 0 16px">Din kod för DrPlugg:</p>
      <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 18px;color:#870052">${input.code}</p>
      <p style="color:#666;font-size:13px;margin:0">Koden gäller i 15 minuter. Om du inte skapade kontot kan du ignorera det här mejlet.</p>
      <p style="color:#999;font-size:12px;margin-top:24px">DrPlugg – aktiv inlärning för läkarprogrammet</p>
    </div>`;

  const result = await deliver(input.to, subject, text, html);

  // Koden sparas bara i outboxen i demoläget (så att den kan visas i appen).
  await logMail({
    userId: input.userId,
    to: input.to,
    subject,
    body: result.delivered ? text : `${text}\n\n[demoläge – mejlet skickades inte]`,
    result,
    code: result.delivered ? null : input.code,
  });

  return result;
}

export async function latestOutbox(limit = 5) {
  return queryMany<{
    id: string;
    to: string;
    subject: string;
    body: string;
    delivered: boolean;
    code: string | null;
    createdAt: string;
  }>(
    `SELECT id::text AS id, to_email AS "to", subject, body, delivered, code,
            created_at AS "createdAt"
       FROM mail_outbox ORDER BY id DESC LIMIT $1`,
    [limit],
  );
}

export async function mailStatus() {
  const settings = smtpSettings();
  const last = await queryOne<{ created_at: string; delivered: boolean }>(
    `SELECT created_at, delivered FROM mail_outbox ORDER BY id DESC LIMIT 1`,
  );
  return {
    configured: settings !== null,
    host: settings ? `${settings.host}:${settings.port}` : null,
    from: settings ? `${settings.fromName} <${settings.fromAddress}>` : null,
    lastMailAt: last?.created_at ?? null,
  };
}
export async function sendPasswordResetEmail(input: {
  userId: string;
  to: string;
  code: string;
}): Promise<SendResult> {
  const subject = "DrPlugg – återställ ditt lösenord";
  const text = [
    "Hej!",
    "",
    `Din kod för att återställa lösenordet är: ${input.code}`,
    "",
    "Koden gäller i 15 minuter. Om det inte var du kan du ignorera det här mejlet – lösenordet ändras inte förrän koden används.",
    "",
    "DrPlugg – aktiv inlärning för läkarprogrammet",
  ].join("\n");

  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;color:#4F0433;max-width:520px">
      <h2 style="margin:0 0 8px">Återställ lösenordet</h2>
      <p style="color:#666;margin:0 0 16px">Ange den här koden i DrPlugg:</p>
      <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 18px;color:#870052">${input.code}</p>
      <p style="color:#666;font-size:13px;margin:0">Koden gäller i 15 minuter. Om det inte var du kan du ignorera mejlet.</p>
      <p style="color:#999;font-size:12px;margin-top:24px">DrPlugg – aktiv inlärning för läkarprogrammet</p>
    </div>`;

  const result = await deliver(input.to, subject, text, html);

  await logMail({
    userId: input.userId,
    to: input.to,
    subject,
    body: result.delivered ? text : `${text}\n\n[demoläge – mejlet skickades inte]`,
    result,
    code: result.delivered ? null : input.code,
  });

  return result;
}
