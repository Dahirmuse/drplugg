-- ══════════════════════════════════════════════════════════════
-- DrPlugg 1.0 — PostgreSQL-schema
-- Körs av `npm run db:migrate`. Allt är idempotent (IF NOT EXISTS),
-- så det går att köra om utan att data försvinner.
-- ══════════════════════════════════════════════════════════════

-- ── Användare & roller ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'student',
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student';
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ── Kursplan ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id          text PRIMARY KEY,
  code        text NOT NULL,
  title       text NOT NULL,
  term        text,
  description text,
  icon        text DEFAULT '📘',
  color       text DEFAULT 'plum',
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chapters (
  id          text PRIMARY KEY,
  course_id   text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code        text,
  title       text NOT NULL,
  summary     text,
  est_minutes int NOT NULL DEFAULT 25,
  sort_order  int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chapters_course ON chapters(course_id, sort_order);

CREATE TABLE IF NOT EXISTS objectives (
  id         text PRIMARY KEY,
  chapter_id text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  code       text,
  title      text NOT NULL,
  level      text NOT NULL DEFAULT 'kunna',
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_objectives_chapter ON objectives(chapter_id, sort_order);

-- ── Aktiv återkallning (quizfrågor per kapitel) ─────────────
CREATE TABLE IF NOT EXISTS recall_items (
  id          text PRIMARY KEY,
  chapter_id  text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  objective_id text REFERENCES objectives(id) ON DELETE SET NULL,
  kind        text NOT NULL DEFAULT 'mcq',   -- mcq | cloze | truefalse
  prompt      text NOT NULL,
  options     jsonb,
  answer      text NOT NULL,
  explanation text,
  difficulty  int NOT NULL DEFAULT 1,
  sort_order  int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recall_chapter ON recall_items(chapter_id, sort_order);

-- ── Flashcards + FSRS-5 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id     text,
  objective_id   text,
  front          text NOT NULL,
  back           text NOT NULL,
  origin         text NOT NULL DEFAULT 'kapitel', -- kapitel | ai | egen
  status         text NOT NULL DEFAULT 'active',
  due            timestamptz NOT NULL DEFAULT now(),
  stability      double precision NOT NULL DEFAULT 0,
  difficulty     double precision NOT NULL DEFAULT 0,
  elapsed_days   int NOT NULL DEFAULT 0,
  scheduled_days int NOT NULL DEFAULT 0,
  reps           int NOT NULL DEFAULT 0,
  lapses         int NOT NULL DEFAULT 0,
  state          int NOT NULL DEFAULT 0,          -- 0 ny, 1 lär sig, 2 repetition, 3 omlärning
  last_review    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id, front)
);

CREATE INDEX IF NOT EXISTS idx_cards_due ON flashcards(user_id, status, due);

CREATE TABLE IF NOT EXISTS review_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id     uuid REFERENCES flashcards(id) ON DELETE CASCADE,
  chapter_id  text,
  rating      int NOT NULL,
  source      text NOT NULL DEFAULT 'sjalv',   -- sjalv | ai | quiz
  elapsed_ms  int,
  note        text,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_user_time ON review_logs(user_id, reviewed_at DESC);

-- ── Kapitelframsteg ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapter_progress (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id   text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'started', -- started | completed | mastered
  recall_right int NOT NULL DEFAULT 0,
  recall_total int NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chapter_id)
);

-- ── Spel & poäng ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game        text NOT NULL,        -- blixtquiz | termmatch | diagnosduellen | dagsutmaning
  chapter_id  text,
  score       int NOT NULL,
  max_score   int NOT NULL DEFAULT 0,
  duration_ms int,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_user ON game_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_best ON game_attempts(game, score DESC);

CREATE TABLE IF NOT EXISTS daily_activity (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      date NOT NULL,
  points   int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- ── Eget källmaterial (källgrundad AI) ──────────────────────
CREATE TABLE IF NOT EXISTS docs (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name     text NOT NULL,
  kind     text,
  chars    int NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doc_chunks (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doc_id     bigint NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  chapter_id text,
  heading    text,
  ord        int NOT NULL DEFAULT 0,
  text       text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc ON doc_chunks(doc_id, ord);

-- ── Chatt (DrPlugg-arvet, utökat med kapitel + betyg) ───────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  mode       text NOT NULL DEFAULT 'sokratisk',
  chapter_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS chapter_id text;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  grade      jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS grade jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);

-- ── Feature-flaggor (för att kunna lägga till funktioner senare) ──
CREATE TABLE IF NOT EXISTS feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT true,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Kapitelkort (innehåll, kopieras till användarens repetition) ──
CREATE TABLE IF NOT EXISTS chapter_cards (
  id         text PRIMARY KEY,
  chapter_id text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  front      text NOT NULL,
  back       text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chapter_cards ON chapter_cards(chapter_id, sort_order);

-- ── Kapitelmeta från innehållsfilerna ──────────────────────
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS facts jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS ninja_topics jsonb;

-- ── E-postverifiering (registrering) ───────────────────────
-- Befintliga konton räknas som verifierade; nya registreringar sätts till false.
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS email_verifications (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  code_hash   text NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verifications_user ON email_verifications(user_id, created_at DESC);

-- Alla utgående mejl loggas (både riktiga och demo) så att admin kan granska.
CREATE TABLE IF NOT EXISTS mail_outbox (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  to_email   text NOT NULL,
  subject    text NOT NULL,
  body       text NOT NULL,
  delivered  boolean NOT NULL DEFAULT false,
  transport  text NOT NULL DEFAULT 'demo',
  error      text,
  code       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_created ON mail_outbox(created_at DESC);

-- ── Sektioner inom ett kapitel (t.ex. "1.1 Läkaryrket") ─────
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS sections jsonb;

-- ── AI-genererade frågor (skapas löpande när man gjort klart en modul) ──
ALTER TABLE recall_items ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'kapitel';
ALTER TABLE recall_items ADD COLUMN IF NOT EXISTS fact_checked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_recall_origin ON recall_items(chapter_id, origin);

-- ── Importerade Anki-kort (omformulerade med AI) ───────────
ALTER TABLE chapter_cards ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'kapitel';

-- ── Begreppspar till Termmatch (term → definition) ─────────
CREATE TABLE IF NOT EXISTS match_pairs (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chapter_id text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  term       text NOT NULL,
  definition text NOT NULL,
  origin     text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, term)
);

CREATE INDEX IF NOT EXISTS idx_match_chapter ON match_pairs(chapter_id);

-- ── Arkivering av innehåll (används i stället för DELETE) ───
ALTER TABLE courses ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chapters_archived ON chapters(course_id, archived);

-- ── Spårbarhet för adminåtgärder (aldrig lösenord) ──────────
CREATE TABLE IF NOT EXISTS admin_audit (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_email text NOT NULL,
  action      text NOT NULL,
  target_email text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(created_at DESC);
