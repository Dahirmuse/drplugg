import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";

/**
 * FSRS-5 (Granada-arvet). Målretention 0,9 som standard.
 * Allt är parametriserat så att vi senare kan lägga in optimerade vikter
 * via FSRS_W utan att röra resten av koden.
 */

export const RETENTION = Number(process.env.FSRS_RETENTION || 0.9);

export function weights(): number[] | undefined {
  const raw = process.env.FSRS_W;
  if (!raw) return undefined;
  const parsed = raw.split(",").map((n) => Number(n.trim()));
  return parsed.every((n) => Number.isFinite(n)) && parsed.length === 19 ? parsed : undefined;
}

const scheduler = fsrs(
  generatorParameters({
    request_retention: RETENTION,
    maximum_interval: 365 * 3,
    enable_fuzz: true,
    w: weights(),
  }),
);

export type StoredCard = {
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: string | null;
};

export type CardRow = {
  id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

export function rowToCard(row: CardRow): FsrsCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: (row.state as State) ?? State.New,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export function newCard(): FsrsCard {
  return createEmptyCard(new Date());
}

export function schedule(card: FsrsCard, rating: Grade) {
  const now = new Date();
  const result = scheduler.repeat(card, now);
  const next = result[rating].card;
  return {
    card: next,
    log: result[rating].log,
    due: next.due.toISOString(),
    stability: next.stability,
    difficulty: next.difficulty,
    elapsedDays: next.elapsed_days,
    scheduledDays: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    lastReview: (next.last_review ?? now).toISOString(),
  };
}

/** Intervall (dagar) för varje betyg 1–4 – används i UI:t innan man svarar. */
export function previewIntervals(card: FsrsCard): Record<1 | 2 | 3 | 4, number> {
  const now = new Date();
  const rec = scheduler.repeat(card, now);
  return {
    1: Math.max(0, Math.round(daysBetween(now, rec[Rating.Again].card.due))),
    2: Math.max(0, Math.round(daysBetween(now, rec[Rating.Hard].card.due))),
    3: Math.max(0, Math.round(daysBetween(now, rec[Rating.Good].card.due))),
    4: Math.max(0, Math.round(daysBetween(now, rec[Rating.Easy].card.due))),
  };
}

export function retrievability(card: FsrsCard): number | null {
  if (!card.last_review || card.stability <= 0) return null;
  const elapsed = daysBetween(card.last_review, new Date());
  return Math.exp((Math.log(0.9) * elapsed) / card.stability);
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

export const RATING_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Igen",
  2: "Svårt",
  3: "Bra",
  4: "Lätt",
};

export const RATING_FROM_SCORE: Record<1 | 2 | 3 | 4, Grade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};
