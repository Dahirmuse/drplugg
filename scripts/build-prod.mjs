/**
 * Bygger produktionspaketet som publiceras till branch `prod`.
 *
 *   npm run prod:build
 *
 * 1. exporterar allt innehåll till db/content.sql (upserts, inga användardata)
 * 2. bygger Next i standalone-läge
 * 3. sätter ihop dist/ = standalone + static + public + db/ + deploy/
 * 4. hemlighetsscan – avbryter om något känsligt hamnat i paketet
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { loadEnv } from "./env.mjs";

loadEnv();

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const NEXT = path.join(ROOT, ".next");

function run(cmd, env = {}) {
  console.log(`▸ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
}

function copy(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true, dereference: true });
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

/** Skannar paketet efter verkliga hemligheter och personuppgifter. */
function scanSecrets(dir) {
  const secrets = [
    ["JWT_SECRET", process.env.JWT_SECRET],
    ["PGPASSWORD", process.env.PGPASSWORD],
    ["DEEPSEEK_API_KEY", process.env.DEEPSEEK_API_KEY],
    ["ADMIN_PASSWORD", process.env.ADMIN_PASSWORD],
  ].filter(([, v]) => typeof v === "string" && v.length >= 8);

  const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const allowedEmails = [/daahirmuse@gmail\.com/i, /example\.com/i, /drplugg\.local/i, /stud\.ki\.se/i];

  const findings = [];
  let scanned = 0;

  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
        continue;
      }
      const size = fs.statSync(p).size;
      if (size > 4 * 1024 * 1024) continue; // hoppa stora filer/binärer
      if (/\.map$/i.test(p)) continue; // sourcemaps innehåller tredjepartskod
      const rel = path.relative(dir, p);
      const inNodeModules = rel.startsWith("node_modules/");
      const isText = /\.(js|mjs|cjs|json|html|css|txt|md|sql|example)$/i.test(p) || entry.name.startsWith(".");
      if (!isText) continue;
      if (scanned++ % 2000 === 0) console.log(`  … ${scanned} filer skannade`);

      const content = fs.readFileSync(p, "utf8");
      for (const [name, value] of secrets) {
        if (content.includes(value)) findings.push(`${name} hittad i ${rel}`);
      }
      // E-postkontroll bara på vårt eget material – tredjepartspaket har egna adresser.
      if (!inNodeModules && !rel.startsWith(".next/")) {
        const emails = content.match(new RegExp(emailRe, "g")) || [];
        for (const e of emails) {
          if (!allowedEmails.some((re) => re.test(e))) findings.push(`e-post (${e}) i ${rel}`);
        }
      }
    }
  };

  walk(dir);
  return findings;
}


/**
 * Next:s standalone-trace tar inte med paket som webpack buntar (bcryptjs) eller
 * som importeras dynamiskt (nodemailer, unpdf). create-admin.mjs körs dessutom
 * helt utanför bundlen. Därför kopierar vi in dem – med sina beroenden – så att
 * node_modules i paketet är självförsörjande i en ren klon.
 */
const REQUIRED_PACKAGES = ["pg", "bcryptjs", "nodemailer", "unpdf"];

function vendorPackages() {
  const copied = new Set();

  const copyOne = (name) => {
    if (copied.has(name)) return;
    copied.add(name);

    const src = path.join(ROOT, "node_modules", name);
    const dest = path.join(DIST, "node_modules", name);
    if (!fs.existsSync(src)) {
      console.warn(`  ! ${name} saknas i projektets node_modules – hoppar över`);
      return;
    }
    if (!fs.existsSync(dest)) {
      fs.cpSync(src, dest, { recursive: true, dereference: true });
      console.log(`  + node_modules/${name}`);
    }

    const pkgFile = path.join(src, "package.json");
    if (fs.existsSync(pkgFile)) {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
      for (const dep of Object.keys(pkg.dependencies || {})) copyOne(dep);
    }
  };

  for (const name of REQUIRED_PACKAGES) copyOne(name);
}

/** Kör create-admin.mjs och en importkontroll i en katalog UTANFÖR projektet. */
function verifyIsolatedImports() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "drplugg-importcheck-"));
  try {
    fs.cpSync(DIST, tmp, { recursive: true, dereference: true });

    const checkFile = path.join(tmp, "import-check.mjs");
    fs.writeFileSync(
      checkFile,
      `for (const p of ${JSON.stringify(REQUIRED_PACKAGES)}) { await import(p); }
` +
        `console.log("✓ alla runtime-paket kan importeras från paketet självt");
`,
    );

    execSync(`"${process.execPath}" import-check.mjs`, { cwd: tmp, stdio: "inherit" });
    execSync(`"${process.execPath}" deploy/create-admin.mjs --check`, {
      cwd: tmp,
      stdio: "inherit",
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  if (process.argv.includes("--scan-only")) {
    if (!fs.existsSync(DIST)) {
      console.error("✗ dist/ finns inte – kör prod:build först.");
      process.exit(1);
    }
    console.log("Skannar dist/ efter hemligheter…");
    const findings = scanSecrets(DIST);
    if (findings.length > 0) {
      console.error("✗ Paketet innehåller känsliga uppgifter:");
      for (const f of [...new Set(findings)].slice(0, 20)) console.error("  -", f);
      process.exit(1);
    }
    console.log("✓ inga hemligheter hittade.");
    return;
  }

  const assembleOnly = process.argv.includes("--assemble-only");

  if (!assembleOnly) {
    console.log("1/4 Exporterar innehåll…");
    run("node scripts/export-content.mjs");

    console.log("2/4 Bygger Next (standalone)…");
    fs.rmSync(NEXT, { recursive: true, force: true });
  // Bygg med ren miljö: inga .env-filer ska kunna bakas in.
    run("npx next build", {
      BUILD_STANDALONE: "1",
      NODE_ENV: "production",
      DEEPSEEK_API_KEY: "",
      JWT_SECRET: "",
      PGPASSWORD: "",
      ADMIN_PASSWORD: "",
    });
  } else {
    console.log("1-2/4 Hoppar över export och bygge (--assemble-only)");
  }

  console.log("3/4 Sätter ihop dist/…");
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const standalone = path.join(NEXT, "standalone");
  if (!fs.existsSync(standalone)) {
    console.error("✗ .next/standalone saknas – byggdes det med BUILD_STANDALONE=1?");
    process.exit(1);
  }
  copy(standalone, DIST);

  copy(path.join(NEXT, "static"), path.join(DIST, ".next", "static"));
  copy(path.join(ROOT, "public"), path.join(DIST, "public"));
  copy(path.join(ROOT, "db"), path.join(DIST, "db"));
  copy(path.join(ROOT, "deploy"), path.join(DIST, "deploy"));
  fs.copyFileSync(path.join(ROOT, ".env.example"), path.join(DIST, ".env.example"));
  fs.copyFileSync(path.join(ROOT, "DEPLOY.md"), path.join(DIST, "DEPLOY.md"));

  // Skyddsnät: paketet MÅSTE se ut som systemd/ngnix förväntar sig.
  if (!fs.existsSync(path.join(DIST, "server.js"))) {
    console.error("✗ dist/server.js saknas – Next lade standalone-output i en underkatalog.");
    console.error("  Kontrollera outputFileTracingRoot i next.config.ts.");
    process.exit(1);
  }
  for (const entry of ["db", "deploy", "public", ".env.example", "DEPLOY.md"]) {
    if (!fs.existsSync(path.join(DIST, entry))) {
      console.error(`✗ dist/${entry} saknas efter hopsättningen.`);
      process.exit(1);
    }
  }

  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  let commit = "";
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
  } catch {
    commit = "nogit";
  }
  vendorPackages();

  fs.writeFileSync(
    path.join(DIST, "VERSION"),
    `${version}\nbuilt ${new Date().toISOString()}\ncommit ${commit}\n`,
  );

  console.log("4/5 Kontrollerar att paketet är självförsörjande…");
  verifyIsolatedImports();

  console.log("5/5 Skannar paketet efter hemligheter…");
  const findings = scanSecrets(DIST);
  if (findings.length > 0) {
    console.error("✗ Paketet innehåller känsliga uppgifter – publicerar INTE:");
    for (const f of [...new Set(findings)].slice(0, 20)) console.error("  -", f);
    process.exit(1);
  }

  const mb = (dirSize(DIST) / 1024 / 1024).toFixed(1);
  console.log(`✓ dist/ klar (${mb} MB) – inga hemligheter hittade.`);
}

main().catch((err) => {
  console.error("✗ prod:build misslyckades:", err.message);
  process.exit(1);
});
