/**
 * "Stale" for a run in progress — SAK-67.
 *
 * There is no existing staleness/abandonment concept for an in-progress run to
 * reuse (a grep across the session-related files turns up "stale" only in the
 * sync sense — a copy racing a newer write, e.g. history-sync.ts,
 * session-store.ts — never a run that has simply sat untouched for a while).
 * So this is a fresh, deliberately conservative judgment call:
 *
 *   THRESHOLD: 24 hours since the run was last touched (`lastActiveAt` — the
 *   last answer, or when it was parked). A day is long enough that "still
 *   mid-round" and "forgot this existed" stop being confusable — a genuine
 *   study break (lunch, a meeting, overnight) comfortably fits inside it,
 *   while a run that survives several of those without a single answer is a
 *   fair candidate to flag.
 *
 *   WHAT STALE MEANS HERE: a VISUAL HINT ONLY (see current-sessions.tsx's
 *   "Inactive" tag) plus the existing manual Discard action — never an
 *   automatic delete. Runs are the learner's only record of work in progress;
 *   silently dropping one on a timer would be a worse bug than the pile-up
 *   this ticket is about. Sam was unavailable to weigh in on the exact cutoff
 *   when this was written, so the choice favours surfacing the problem over
 *   acting on it — a human keeps the final say on every discard.
 */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Whether a run counts as stale as of `now` — `lastActiveAt` more than
 * STALE_AFTER_MS in the past. */
export function isStaleRun(lastActiveAt: number, now: number): boolean {
  return now - lastActiveAt > STALE_AFTER_MS;
}
