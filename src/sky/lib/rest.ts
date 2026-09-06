// The rest between a lesson's rounds (SAK-343). A lesson's quiz runs a
// fixed number of rounds over the same cards with a rest between them;
// the rest is a timestamp written once when a round ends, so a reload or
// a closed tab loses nothing. The app's rule, copied: the first rest is
// one number of minutes, every rest after it another, both from Settings.

/** How many rounds a lesson's quiz runs. A quiz of what is due runs one. */
export const LESSON_ROUNDS = 3;

/** Minutes of rest before `nextRound`: the first rest, or every one after. */
export function restMinutes(nextRound: number, firstMinutes: number, laterMinutes: number): number {
  return nextRound <= 2 ? firstMinutes : laterMinutes;
}

/** Milliseconds of rest left, never below zero. */
export function restLeft(until: number, now: number): number {
  return Math.max(0, until - now);
}

/** "3:18": the one number the rest screen says. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "3:47 PM": when the rest ends, on the wall clock. */
export function formatReturnTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Where a lesson's quiz stands between rounds, kept in the browser. */
export interface RestState {
  /** The cards the rounds run over, as one key. */
  deck: string;
  /** The round that just ended. */
  round: number;
  /** When the rest ends. */
  until: number;
}
