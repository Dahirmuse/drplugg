/** Slumpar ordningen på svarsalternativ utan att tappa bort rätt svar. */

export function shuffleArray<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const LETTERS = "ABCDEFGH".split("");

/**
 * Blandar alternativen och returnerar dem med nya bokstäver.
 * `answer` jämförs som sträng, så den följer automatiskt med.
 */
export function shuffleOptions<T extends string>(
  options: T[],
  answer: T,
): { options: T[]; answer: T; letters: string[] } {
  const shuffled = shuffleArray(options);
  return { options: shuffled, answer, letters: LETTERS.slice(0, shuffled.length) };
}

/**
 * Blandar alternativ som har ett index som rätt svar (AI-genererade frågor)
 * och returnerar nya index för rätt svar.
 */
export function shuffleIndexed<T>(
  options: T[],
  answerIndex: number,
): { options: T[]; answerIndex: number } {
  const order = shuffleArray(options.map((_, i) => i));
  const shuffled = order.map((i) => options[i]);
  return { options: shuffled, answerIndex: order.indexOf(answerIndex) };
}
