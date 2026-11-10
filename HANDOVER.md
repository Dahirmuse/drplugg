# DrPlugg 1.0 — överlämning till ny session

> Skriven av Dahir vid sessionens slut. **Läs det här först** — filen innehåller allt som behövs för att
> ta över arbetet utan att läsa om historiken.
> Inga hemligheter står i den här filen (de ligger i `.env.local`, som är git-ignorerad).

---

## 1. Uppdraget (nuvarande läge)

Vi bygger **DrPlugg 1.0** — en svensk studieplattform för läkarprogrammet — och **driftsätter den på en
annan dator** (en väns hem­server). Arbetet sker i två ändar:

| Roll | Vem | Vad den gör |
|---|---|---|
| **Ägare** | Dahir (`daahirmuse@gmail.com`, GitHub `Dahirmuse`) | Bestämmer, äger kontona, kör kommandon på servern |
| **Serveragenten** | en annan AI-agent på server-datorn | Granskar varje release **rad för rad** innan den körs, installerar, rapporterar smoke-test. **De flesta promptarna i den här sessionen kom därifrån** |
| **Den här sessionen (du)** | utvecklar-agent på Dahirs dator | Bygger appen, paketerar releaser, publicerar taggar, felsöker |

**Arbetsprotokoll (viktigt):**
1. Serveragenten **granskar och godkänner** en tagg → först då installeras den.
2. **En publicerad tagg flyttas aldrig.** Behövs en fix → **ny tagg** (`v1.0.5`, …).
3. Vid varje ny release: skicka **tagg + fullt commit-hash** + vad som ändrats.
4. Serveragenten rapporterar alltid resultatet av smoke-testet tillbaka.
5. Ändringar som rör säkerhet/drift ska vara små och granskningsbara (diff mot föregående tagg).

---

## 2. Var allt finns

| Vad | Sökväg / adress |
|---|---|
| Projektet | `/home/dahir-muse/Desktop/DrPlugg1.0` |
| GitHub (publikt) | `https://github.com/Dahirmuse/drplugg` |
| Branch `main` | källkoden (1 commit, force-pushas vid varje release) |
| Branch `prod` | det **färdigbyggda** paketet — det som servern klonar |
| Taggar | `v1.0.0` … `v1.0.4` (se §4) |
| De två originalsessionerna | `~/medical-study-app` (DrPlugg: design, chatt, UX) och `~/Desktop/Granada` (sokratisk AI, FSRS-5, källgrundning) |

---

## 3. Vad appen är (funktioner)

* **Kursplan från hus75:s lärandemåls-PDF:er**: 15 kurser (BV1–BV6, MDBI, KM1–KM7, MVTM), **74 moduler**
  som kapitel, **1 065 lärandemål** (ordagrant ur PDF:erna).
* **Karolina** — AI-coachen (DeepSeek). Fyra lägen: sokratisk, tentagenerator, konceptgenomgång,
  kliniskt fall. AI-**examinator** betygsätter förklaringar 1–4 och lägger dem i repetitionen.
* **Aktiv återkallning**: quiz med blandade svarsalternativ, lucktexter, ”generera fler frågor/kort”
  (DeepSeek + faktagranskning).
* **FSRS-5-repetition** (`ts-fsrs`), prognos, retention, streaks, poäng.
* **Spel**: Blixtquiz, **Termmatch (begrepp → definition, AI-genererade par)**, Diagnosduellen,
  Dagens utmaning, topplista.
* **Innehåll**: 309 quizfrågor, 1 985 flashcards, 131 begreppspar. Anki-import från hus75 (32 393 kort
  extraherade, ~1 000+ importerade och omformulerade).
* **Ninja Nerd-videor** per kapitel (verifierade kanalträffar, 67/74 kapitel).
* **Adminpanel**: roller, skapa konto, återställ lösenord (engångslösen, endast hash lagras), **ta bort
  användare**, innehållsstatistik, SMTP-status. Åtgärder loggas i `admin_audit` (aldrig lösenord) och är
  rate-limitade.
* **Auth**: JWT (`jose`) i httpOnly-cookie `drplugg_token`, bcrypt, roller. `ALLOW_REGISTRATION=false`
  som default (admin skapar konton). E-postverifiering finns men kräver SMTP; demoläge för koden fungerar
  **bara från localhost**.
* **Källor**: uppladdning av PDF/TXT/MD → chunkas → AI:n citerar materialet.
* **Dark mode**, allt på svenska.

### Teknik
Next.js **15.5.29** (App Router), React **19.3.1**, Tailwind 3, PostgreSQL, `pg`, `jose`, `bcryptjs`,
`ts-fsrs`, `nodemailer` (SMTP), `unpdf` (PDF). `next.config.ts` har `output: "standalone"` **endast**
när `BUILD_STANDALONE=1` (produktionsbygget), samt **`outputFileTracingRoot` pinnad** (se §8).

### Viktiga kommandon (utveckling)
```bash
npm run dev                 # lokal utveckling
npm run db:migrate          # schema (idempotent, bara tillägg)
npm run db:seed             # läser src/content/courses/*.json → DB
npm run content:export      # DB → db/content.sql (enbart upserts)
npm run prod:build          # export + next build (standalone) + vendorering + isolationsprov + hemlighetsscan
npm run prod:build -- --assemble-only   # hoppar över export+bygge, sätter ihop dist/ igen
npm run typecheck
```

---

## 4. Release-historik (viktigast)

| Tagg | Full commit | Innehåll/kända brister |
|---|---|---|
| `v1.0.0` | `6137093136b10b8a754d7e645c95ad2150dbe7e7` | Första paketet. **Saknade `DEPLOY.md`** och nginx-mallen hade `$connection_upgrade` utan `map` → gick inte att installera. |
| `v1.0.1` | `6c6c755dc14d5d7e2b4a9085b4f29848cf48fabf` | Fixade nginx (Connection "upgrade"), HTTP-only block i install + certbot `certonly --webroot`, obligatorisk tagg i update.sh, JWT/DB-validering, `.env.example`. **Installerad på servern — fungerar.** |
| `v1.0.2` | `29a56f25fcd2dd18da9e6b68599673f5c1196419` | Döda hjälpfunktioner i install.sh, `ADMIN_PASSWORD`-rad, `cd` i DEPLOY.md. |
| `v1.0.3` | `d1b055bbe60e9a5b5c47c14aa6732cbeec5f9b5c` | **Installerad och godkänd**: vendorade `bcryptjs`/`nodemailer`/`unpdf` (saknades i standalone), tog bort `BEGIN/COMMIT` ur `content.sql`, isolationsprov i bygget. |
| **`v1.0.4`** | **`c48245b920e2f7b053fd01dd77c997fd0883256e`** | **Dagens release — väntar på installation.** Next 15.5.29 + React 19.3.1 + postcss-override 8.5.32 (`npm audit --omit=dev` = **0**), nginx strippar `x-middleware-subrequest`, auth bevisat server-side utan middleware (3 listrutter skärpta till 401), `outputFileTracingRoot` pinnad + layoutkontroll i bygget. |

`main` just nu: `072a16ad86df432789059d07ffb181e0b9225c72`.

### Så görs en ny release (exakt så här)
```bash
cd /home/dahir-muse/Desktop/DrPlugg1.0
# 1) ändra kod/innehåll; kör ev. db:migrate / db:seed
# 2) versionsbump i package.json + DEPLOY.md
npm run prod:build                      # måste sluta med "✓ dist/ klar … inga hemligheter hittade"
rm -rf /tmp/prodNEXT && mkdir /tmp/prodNEXT && cp -a dist/. /tmp/prodNEXT/
cd /tmp/prodNEXT && git init -q -b prod && git config user.email daahirmuse@gmail.com \
  && git config user.name dahirmuse && git add -A \
  && git commit -q -m "DrPlugg 1.0.X – produktionspaket (färdigbyggt)"
cd /home/dahir-muse/Desktop/DrPlugg1.0 \
  && git remote remove prodNEXT 2>/dev/null; git remote add prodNEXT /tmp/prodNEXT \
  && git fetch -q --no-tags prodNEXT +prod:prod && git tag -f v1.0.X prod
git push --force origin prod && git push origin v1.0.X
git add -A && git commit -q --amend -m "DrPlugg 1.0.X – källkod" && git push --force origin main
```
**Verifiera alltid den publicerade taggen** (klona utanför projektet, annars kan föräldra-`node_modules` dölja fel):
```bash
rm -rf /tmp/vX && git clone --branch v1.0.X --depth 1 https://github.com/Dahirmuse/drplugg.git /tmp/vX
cd /tmp/vX && [ -f server.js ] && node deploy/create-admin.mjs --check
cp /home/dahir-muse/Desktop/DrPlugg1.0/.env.local .env.local
PORT=3901 node server.js     # → curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3901/login  → 200
```

---

## 5. Servern (vännen/Mustafa — där sajten ska köra)

**Hårdvara:** Lenovo, i5-7400 (4 kärnor), 16 GB RAM, `/` 233 GB, `/media/storage` 1,8 TB.
**OS:** Ubuntu 26.04.1. **Publik IP: `188.151.198.154`** (A-record apex + www ska peka dit; router
forwardar redan 80/443).
**Domän:** `drplugg.se` hos Loopia (pekar just nu på en parkeringssida — **A-recorderna ändras av dem**).

**Befintlig miljö (rör ej!):** nginx 1.28.3 med **fem andra sajter** (codechemist.se, noustopia.com,
omniunus.com, push.noustopia.com, mustafamuqtar.se), certbot 4.0 (nginx-plugin, certbot.timer),
PostgreSQL **16 native på 5432**, Docker, Node **22.22.3 men installerad via nvm i hemkatalog** (därför
måste `--node-bin` pekas ut; `/usr/bin/node` finns inte).
**Upptagna portar:** 80, 443, 1433, 2586, 4000, 5009, 5013, 5432, 5555, 7001, 7777, 9000 → DrPlugg kör
på **127.0.0.1:3311**.

**Driftmodell (deras standard):** kod i `/var/www/publish/drplugg`, systemanvändare `drplugg`, systemd
`drplugg.service` (EnvironmentFile = `.env.local`), nginx-serverblock, certbot, backuper i
`/var/backups/drplugg`, `.last-deploy` med installerad tagg.

### Status på servern
* **v1.0.3 är installerad och fungerar**: tjänst igång, admin skapad, nginx HTTP OK, registrering svarar 403.
* **TLS är pausad** pga Next-sårbarheterna → därför v1.0.4.
* **v1.0.4 är ännu inte installerad.**

### Nästa steg på servern (kommandon de ska köra)
```bash
cd /var/www/publish/drplugg
sudo ./deploy/update.sh v1.0.4 --expect-commit c48245b920e2f7b053fd01dd77c997fd0883256e
# när DNS pekar rätt:
sudo ./deploy/enable-tls.sh --domain drplugg.se --expect-ip 188.151.198.154
```
`update.sh` tar backup **först**, skriver ut tagg + commit och kräver `yes`, applicerar schema+content,
startar om, rökprovar. `enable-tls.sh` kräver `--expect-ip`, kör `certbot certonly --webroot`, lägger
443-blocket och återställer HTTP-blocket om `nginx -t` fallerar.

### Första installation (om den någonsin görs om)
```bash
sudo git clone --branch v1.0.4 --depth 1 https://github.com/Dahirmuse/drplugg.git /var/www/publish/drplugg
cd /var/www/publish/drplugg
sudo cp .env.example .env.local    # fyll i ADMIN_EMAIL, ADMIN_PASSWORD, DEEPSEEK_API_KEY
sudo ./deploy/install.sh --node-bin /usr/local/bin/node --domain drplugg.se --port 3311
```
`install.sh` är **säker att köra om** (idempotent): roll finns → `PGPASSWORD` behålls, DB finns → hoppas
över, `JWT_SECRET` (≥32 tecken) behålls, schema/content är upserts, `.next/cache`-symlinken återanvänds.

---

## 6. Hemligheter & konton (var de finns — aldrig i git)

| Vad | Var |
|---|---|
| `PGPASSWORD`, `JWT_SECRET`, `DEEPSEEK_API_KEY`, `ADMIN_EMAIL` | `/home/dahir-muse/Desktop/DrPlugg1.0/.env.local` (git-ignorerad, 600) |
| Admin på dev | `daahirmuse@gmail.com` |
| Testkonto | `test@drplugg.se` / `Test1234!` (student) |
| Serverns `.env.local` | `/var/www/publish/drplugg/.env.local` (ägare `drplugg`, 600) — de fyller i **egen** DeepSeek-nyckel och sitt adminlösen |

**Gjort:** DB-lösenordet **roterat** (gamla `drplugg123` avvisas), `JWT_SECRET` roterat, och
`main`/`prod` omskrivna till **en commit var** så att gamla hemligheter inte finns i historiken
(verifierat: 0 träffar i alla commits på den publika klonen). Den gamla appen
(`~/medical-study-app/.env.local`) fick samma nya DB-lösenord så att den fortsätter fungera.

**Aldrig i git:** `.env*` (utom `.env.example`), `config/smtp.json`, `data/anki/`, `node_modules`, `.next`.

---

## 7. Databasen

Tabeller: `users`, `courses`, `chapters`, `objectives`, `recall_items`, `chapter_cards`, `flashcards`
(FSRS-fält), `review_logs`, `chapter_progress`, `game_attempts`, `daily_activity`, `match_pairs`,
`docs`, `doc_chunks`, `chat_sessions`, `messages`, `admin_audit`, `mail_outbox`, `email_verifications`,
`feature_flags`.

Regler som gäller:
* Schema är **additivt** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) — en äldre release
  fungerar mot ett nyare schema.
* Innehåll som tas bort **arkiveras** (`courses.archived` / `chapters.archived`), raderas aldrig —
  annars kan `chapter_progress` kaskadraderas.
* `db/content.sql` innehåller **ingen egen `BEGIN/COMMIT`** (transaktionen kommer från
  `psql --single-transaction`), bara upserts, inga användardata. Bygget har hårda grindar för detta.

---

## 8. Fällor vi redan trampat i (läs innan du ändrar något)

1. **`next build` medan `next dev` kör** förstör `.next` → CSS/JS 404, sidan blir rå HTML. Stoppa dev,
   `rm -rf .next`, starta om.
2. **Standalone tracing-root**: om det finns en lockfil i en föräldrakatalog gissar Next fel rot och
   lägger `server.js` i `Desktop/DrPlugg1.0/`. `next.config.ts` pinnar nu
   `outputFileTracingRoot`, och `build-prod` **vägrar** bygga utan `server.js` i `dist/`-roten.
3. **Paket som webpack buntar eller importeras dynamiskt saknas i standalone** (`bcryptjs`,
   `nodemailer`, `unpdf`). `build-prod` vendorar dem + kör **isolationsprov i en temp-katalog utanför
   projektet** — annars ”fungerar” testet bara för att förälderns `node_modules` finns.
4. **Testa alltid med en ren klon utanför projektet** (`/tmp/...`), aldrig inifrån projektmappen.
5. **Den här datorns IPv6 fungerar inte** → använd `curl -4` när du testar publika adresser
   (trycloudflare-adresser får AAAA-poster och ger annars `000`).
6. **Cloudflare quick tunnels är tillfälliga** (ny adress varje start). Produktionssajten ska köras på
   servern, inte här.
7. **`sudo -u postgres` fungerar inte i den här sandlådan** — använd `su - postgres -c "psql …"`.
   `install.sh` har `sudo` med `su` som reserv.
8. **`main` har en enda commit och force-pushas** — det är avsiktligt (hemligheter skrubbade).

---

## 9. Öppna punkter / nästa steg

1. **Serveragenten installerar v1.0.4** och rapporterar smoke-test.
2. **TLS**: A-record för `drplugg.se` + `www` → `188.151.198.154`, sedan `enable-tls.sh --expect-ip`.
3. **SMTP-beslut**: e-postverifiering kräver SMTP (`config/smtp.json` eller `SMTP_*`). Utan SMTP är
   registreringen stängd och admin skapar konton — det är dagens läge.
4. **Ev. v1.0.5** om granskningen hittar något (ny tagg, flytta aldrig v1.0.4).
5. Idéer som diskuterats men inte byggts: fast domän/CI, fler Anki-deck importerade (BV3–BV6, KM1–KM7
   ligger nedladdade i `/tmp/apkg` men är inte importerade), leech-detektion i repetitionen,
   belastningsprognos.

---

## 10. Snabbfakta för smoke-test

```bash
# på servern
systemctl status drplugg --no-pager | head -5
journalctl -u drplugg -n 30 --no-pager
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3311/login      # 200
curl -sI https://drplugg.se/login | head -1                                # HTTP/2 200 (efter TLS)
# förväntat i appen: inloggning som admin → /hem visar "Hej …", /admin listar användare,
#                    registrering (utifrån) svarar 403 "Registrering är stängd…"
```
