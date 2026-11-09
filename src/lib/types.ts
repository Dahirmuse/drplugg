// ── Domäntyper för DrPlugg 1.0 ──────────────────────────────

export type Role = "student" | "admin";

export interface User {
  id: string;
  email: string;
  role: Role;
  displayName: string | null;
}

// ── Kursplan ────────────────────────────────────────────────
export interface Course {
  id: string;
  code: string;
  title: string;
  term: string | null;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface Chapter {
  id: string;
  courseId: string;
  code: string | null;
  title: string;
  summary: string | null;
  estMinutes: number;
  sortOrder: number;
  facts?: string[] | null;
  ninjaTopics?: { label: string; query: string }[] | null;
  sections?: { code: string; title: string }[] | null;
}

export interface Objective {
  id: string;
  chapterId: string;
  code: string | null;
  title: string;
  level: string;
  sortOrder: number;
}

export type RecallKind = "mcq" | "cloze" | "truefalse";

export interface RecallItem {
  id: string;
  chapterId: string;
  kind: RecallKind;
  prompt: string;
  options: string[] | null;
  answer: string;
  explanation: string | null;
  difficulty: number;
  sortOrder: number;
}

export interface Flashcard {
  id: string;
  chapterId: string | null;
  front: string;
  back: string;
  origin: string;
  due: string;
  state: number;
  reps: number;
  lapses: number;
  scheduledDays: number;
  stability: number;
  difficulty: number;
  lastReview: string | null;
}

// ── Chatt ───────────────────────────────────────────────────
export type ChatMode = "sokratisk" | "tentagen" | "koncept" | "kliniskt";

export interface ChatSessionRow {
  id: string;
  title: string;
  mode: ChatMode;
  chapterId: string | null;
  updatedAt: string;
}

export interface ChatMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  grade: GradeResult | null;
}

// ── AI-betyg (Granada-arvet) ────────────────────────────────
export interface GradeResult {
  rating: 1 | 2 | 3 | 4;
  confidence: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  misconception: string;
  reference_answer: string;
  next_question: string;
}

// ── Spel ────────────────────────────────────────────────────
export type GameKey = "blixtquiz" | "termmatch" | "diagnosduellen" | "dagsutmaning";

export interface GameAttempt {
  game: GameKey;
  score: number;
  maxScore: number;
  durationMs?: number;
  chapterId?: string | null;
}

export interface LeaderboardRow {
  email: string;
  displayName: string | null;
  best: number;
  plays: number;
}

// ── Statistik ───────────────────────────────────────────────
export interface DashboardStats {
  dueNow: number;
  totalCards: number;
  reviewsToday: number;
  streak: number;
  chaptersStarted: number;
  chaptersCompleted: number;
  recallAccuracy: number | null;
  pointsToday: number;
}
