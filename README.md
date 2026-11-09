# DrPlugg 1.0 🩺

Svensk studieplattform för läkarprogrammet (Karolinska Institutet) – byggd av de två
tidigare sessionsprojekten **DrPlugg** (design, chatt, inlärnings-UX) och **Granada**
(sokratisk AI-coach, FSRS-5-repetition, källgrundning, aktiv återkallning).

Allt innehåll är på svenska och kursstrukturen följer läkarprogrammet vid Karolinska Institutet.

---

## Vad som finns

| Del | Vad det gör |
|---|---|
| **Kursplan** | 15 kurser · **74 kapitel** (ett per modul) · **1 065 lärandemål** · 259 återkallningsfrågor · 360 flashcards |
| **Modulerna är kompletta** | BV1–BV6 och MDBI bygger på kursernas *sammanställda lärandemål* (PDF) – varje modul är ett kapitel, med kursens riktiga lärandemål ordagrant, grupperade per sektion (t.ex. 1.1 Läkaryrket) |
| **Kapitel** | Flikar: Aktiv återkallning (MCQ + lucktext, alternativen slumpas) · Kort (vändbara) · Ninja Nerd (riktiga videor) · Översikt (modulens delar + lärandemål + högyield) |
| **Nya frågor automatiskt** | När en runda är klar skriver **Karolina** 3 nya frågor ur modulens lärandemål – och en separat examinator-runda **faktagranskar** dem innan de sparas (felaktiga frågor kastas). De hamnar i `recall_items` med `origin='ai'`, `fact_checked=true` och dyker upp i quiz och spel |
| **Chatt** | **Karolina** – sokratisk coach, tentagenerator, konceptgenomgång och kliniskt fall. Kapitelmedveten, källgrundad i uppladdat material. Claude-inspirerad chattvy (varm off-white, serif-rubriker, assistentsvar utan bubbla) med egen dark mode |
| **Examinator** | AI bedömer din förklaring på FSRS-skalan 1–4 och lägger bedömningen i repetitionen |
| **Repetition** | FSRS-5 (`ts-fsrs`) med målretention 0,9, 7-dagarsprognos och retention/streak-statistik |
| **Spel** | Blixtquiz (tid + streak-bonus), Termmatch (memory), Diagnosduellen (ledtrådar kostar poäng), Dagens utmaning + topplista – välj **kurs → modul/kapitel** eller spela blandat. **När en runda är klar skriver Karolina nya faktagranskade frågor för samma urval** (kapitel, hel kurs eller blandat) |
| **Källor** | Ladda upp PDF/TXT/MD → chunkas per rubrik och används som källutdrag i chatten |
| **Admin** | Endast `ADMIN_EMAIL`: användarlista, roller, innehållsstatistik |
| **Framsteg** | Retention 30 d, repetitionshistorik, kurs-för-kurs, poäng och streaks |

---

## Snabbstart

```bash
cd DrPlugg1.0
npm install                 # redan gjort om node_modules finns
cp .env.example .env.local  # fyll i DeepSeek-nyckel + Postgres + JWT_SECRET
npm run db:setup            # skapar schema + admin-konto + seed av kursplanen
npm run dev                 # http://localhost:3000
```

### Inloggning

- Admin: **`daahirmuse@gmail.com`** (från `ADMIN_EMAIL` i `.env.local`). Rollen sätts av
  `npm run db:migrate`. Om du inte minns lösenordet:

  ```bash
  ADMIN_PASSWORD='nytt-lösenord' npm run db:migrate
  ```

- Studenter registrerar sig själva på `/login` → _Skapa konto_.

### Databas

PostgreSQL 16 används. `scripts/migrate.mjs` skapar databasen om den saknas, kör
`db/schema.sql` (idempotent) och ser till att admin-kontot finns.

```bash
npm run db:migrate   # schema + admin
npm run db:seed      # kursplan från src/content/courses/*.json
npm run videos       # hämtar Ninja Nerd-videor till src/content/ninja-nerd.json
```

### Kursplanen kommer från lärandemåls-PDF:erna

BV1–BV6 och MDBI är byggda direkt från kursernas *sammanställda lärandemål* (PDF), så att
**varje modul** i kursen finns med som eget kapitel:

```bash
pdftotext -layout bv1.pdf /tmp/bv1.txt                 # 1. text ur PDF:en
node scripts/parse-objectives.mjs /tmp/bv1.txt …       # 2. modul → sektion → lärandemål
node scripts/plan-modules.mjs                          # 3. kapitelplan (en modul = ett kapitel)
# 4. skriv innehåll i src/content/courses/<kurs>.json (quiz, kort, video-sökningar)
npm run db:seed                                        # 5. in i databasen
```

Mellanresultaten sparas i `src/content/_objectives/` och `src/content/_plans/`, så det går att
granska och köra om utan att tolka PDF:erna igen.

---

## Så lägger du till funktioner senare

Designen är avsiktligt **innehållsdriven och modulär**:

1. **Nytt kapitel** – lägg en post i `src/content/courses/<kurs>.json` (se `bv1.json` som
   mall) och kör `npm run db:seed`. Inget mer krävs: kapitlet får quiz, kort, videomatchning
   och spelfrågor automatiskt.
2. **Ny kurs** – ny fil i samma mapp med `id`, `code`, `title`, `sortOrder`.
3. **Nytt spel** – lägg en komponent i `src/components/games/` som hämtar frågor från
   `GET /api/games/questions` och postar poäng till `POST /api/games/score`. Registrera den i
   `GameHub`.
4. **Ny AI-funktion** (t.ex. ”generera kort från kapitel”) – bygg vidare på `src/lib/prompts.ts`
   + `src/lib/deepseek.ts` (`completeJson`) och lägg en route under `src/app/api/`.
5. **Ny vy** – en mapp under `src/app/(app)/` får automatiskt skalet (nav, streak, repetition).
6. **Feature flags** – tabellen `feature_flags` seedas i migreringen; använd den för att slå
   av/på funktioner per installation.
7. **Nya källor** – allt källmaterial går via `docs` + `doc_chunks`; byt ut `snippetsFor()` i
   `src/lib/retrieval.ts` mot embeddings när du vill – gränssnittet är oförändrat.

---

## Arkitektur

```
db/schema.sql              PostgreSQL-schema (idempotent)
scripts/migrate.mjs        skapar db, kör schema, admin-konto, feature flags
scripts/seed.mjs           läser src/content/courses/*.json → databasen
scripts/fetch-videos.mjs   söker YouTube, filtrerar kanalen "Ninja Nerd"
src/content/courses/*.json kursplan + kapitel + frågor + kort (innehållet)
src/content/ninja-nerd.json verifierade video-id per kapitel
src/lib/db.ts              pg-pool + query-helpers
src/lib/auth.ts            JWT (jose) + bcrypt + roller
src/lib/fsrs.ts            FSRS-5-schemaläggning, intervallprognos
src/lib/prompts.ts         sokratiska regler, examinator, kortgenerering
src/lib/retrieval.ts       chunkning + rankning av källutdrag
src/lib/repo.ts            databasfrågor (kursplan, kort, statistik, spel)
src/app/(app)/hem|kurs|kapitel|chatt|repetition|spel|framsteg|kallor|admin
src/app/api/*              auth, chat, grade, review, cards, progress, games, docs, admin
src/components/*           designsystem + chatt + spel (DrPlugg-paletten)
```

### Datamodell (urval)

`users` · `courses` · `chapters` · `objectives` · `recall_items` · `chapter_cards`
(content) → `flashcards` (per användare, FSRS-fält) · `review_logs` ·
`chapter_progress` · `game_attempts` · `daily_activity` · `docs` · `doc_chunks` ·
`chat_sessions` · `messages` · `feature_flags`

---

## Miljövariabler

```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=drplugg
PGUSER=drplugg
PGPASSWORD=…
JWT_SECRET=…                 # slumpa: openssl rand -hex 32
ADMIN_EMAIL=daahirmuse@gmail.com
DEEPSEEK_API_KEY=…           # chatten + examinatorn
DEEPSEEK_MODEL=deepseek-chat
FSRS_RETENTION=0.9           # valfri (0.85–0.95)
COOKIE_SECURE=false          # true bakom HTTPS
```

> ChatGPT/DeepSeek-nyckeln läses **endast server-side** och skickas aldrig till klienten.

---

## Kredit

- Designsystem, chatt-UX och pedagogiska lägen: **DrPlugg**
- Sokratisk coach, FSRS-5, källgrundning: **Granada**
- Kursstruktur: läkarprogrammet vid Karolinska Institutet
- Videor: [Ninja Nerd](https://www.youtube.com/@NinjaNerdMedicine) (länkas/embeddas, inte kopierade)

---

## Publicera på internet

### Snabbt (tillfällig adress, ingen domän)

```bash
npm run build
npm start -- -p 3300                      # produktionsserver
cloudflared tunnel --url http://localhost:3300
```

Cloudflare skriver ut en adress som `https://<namn>.trycloudflare.com`. Den fungerar så länge
datorn och `cloudflared`-processen kör. Sätt `COOKIE_SECURE=true` (krävs över HTTPS).

### Permanent

Skapa en *named tunnel* i Cloudflare (egen domän) eller deploya till t.ex. Vercel/Render med en
hanterad PostgreSQL – appen läser all konfiguration från miljövariablerna i `.env.local`.

### Säkerhet när appen ligger publikt

- **Rate limit** på `/api/auth/*` (inloggning 12/5 min, registrering 6/10 min, återställning 5/10 min per IP).
- **Demoläge för verifieringskoder är avstängt utifrån**: koden visas bara för anrop från
  localhost (eller om `ALLOW_DEMO_MAIL=true`). Publik registrering kräver därför riktig SMTP –
  fyll i `config/smtp.json`. Glömt lösenord kan alltid köras lokalt på datorn.
- Byt adminlösenord: `ADMIN_PASSWORD='…' npm run db:migrate` (eller "Glömt lösenord" på localhost).
- Använd en egen `JWT_SECRET` och ett starkt `PGPASSWORD` i `.env.local`.

---

## Anki-material → egna flashcards

Hela kedjan ligger i `scripts/`:

```bash
# 1. Ladda ner valfria .apkg-deck (ca 360 MB för 17 deck)
# 2. Extrahera korten till JSONL
python3 scripts/anki-extract.py /tmp/apkg/*.apkg > /tmp/anki-raw.jsonl

# 3. Låt DeepSeek omformulera + sortera in korten i rätt modul
npm run anki:import -- --file /tmp/anki-raw.jsonl --max 1500 --per-chapter 160
```

`anki-extract.py` läser både gamla (`collection.anki2`), zstd-komprimerade (`collection.anki21`)
och nya (`collection.anki21b`) Anki-filer. `anki-import.mjs` skickar 10 kort i taget till
DeepSeek som (a) skriver om dem till rena svenska flashcards, (b) delar upp kort med flera
fakta, (c) rättar/städar bort fel och (d) väljer modul (`chapterId`). Importen är avbrottsbar –
den sparar läget i `/tmp/anki-import-state.json` och hoppar över redan importerade kort.
Korten hamnar i `chapter_cards` med `origin='anki-ai'` och dyker upp i kapitlets **Kort**-flik
och i repetitionen.

**Termmatch** använder numera begreppspar (term → definition) i tabellen `match_pairs`.
Saknas par för en modul genererar DeepSeek dem automatiskt vid första spelet (`/api/games/match`)
och de cachas – så spelet visar ord, inte frågor.
