"use client";

// THE ORDERING RULE FOR THE ONE SHARED HISTORY.
//
// WHAT THIS GUARDS
// ================
// The provider (history-provider.tsx) holds a single copy of the learner's
// history and keeps it fresh two ways at once, and the two can race:
//
//   - OPTIMISTIC WRITES apply a pure op to the copy on screen the instant a
//     click happens (see history-writes.ts / the provider's `apply`). The card
//     is a pure function of that copy, so the screen advances on the same frame.
//   - REVALIDATIONS re-read the whole history from the server (a write announced
//     itself, a screen asked, the account changed) and REPLACE the copy with the
//     answer (see applyRevalidation in history-cache.ts).
//
// THE BUG THIS CLOSES
// ===================
// A revalidation is asynchronous: it captures the server's state when its fetch
// LEAVES, and lands whenever the response returns. So a read that was ALREADY IN
// FLIGHT when the user clicks "I already know these" carries the PRE-claim state,
// and when it lands after the optimistic apply it overwrites the claim — the
// card advances and then snaps back. Intermittent, because it only happens when a
// read happened to be in flight across the click.
//
// A newest-answer-wins counter between two revalidations was not enough: the
// optimistic write did not participate in it, so an in-flight read that predated
// the write still counted as current and won.
//
// THE RULE
// ========
// One monotonic stamp, advanced by BOTH a local write AND the issuing of a
// revalidation. A revalidation captures the stamp when it leaves and may only
// replace the copy on screen if the stamp has NOT advanced since — i.e. no newer
// read was issued AND no local write happened in the meantime. A read that
// predates our own optimistic write therefore loses, because that write advanced
// the stamp past the read's ticket. This is general: it covers claim, markSeen,
// session and every other write, since all of them go through the same `apply`.
//
// WHAT IT DELIBERATELY DOES NOT PREVENT
// =====================================
// A revalidation issued AFTER a write still wins. That is how the legitimate
// corrections survive:
//   - a REFUSED write (postClaim → ok:false) triggers refresh(), issued after the
//     apply, so its answer lands and reverts the change that never took;
//   - a genuinely NEWER server state (another device wrote) is picked up by the
//     next read issued after our write, and wins because its ticket is current.
// Only reads that are stale RELATIVE TO OUR OWN WRITE are dropped.

import { applyRevalidation, type HistoryState, type RevalidationOutcome } from "@/lib/history-cache";

/** The starting value of the stamp. Any non-negative integer works; zero keeps
 * the first issued read's ticket at one, distinct from this. */
export const INITIAL_GENERATION = 0;

/** Advance the stamp. Called at the start of every revalidation (so a newer read
 * supersedes an older) and on every local optimistic write (so an in-flight read
 * that predates the write can no longer win). Monotonic by construction. */
export function advanceGeneration(generation: number): number {
  return generation + 1;
}

/**
 * May a revalidation issued at `issuedGeneration` replace what is on screen,
 * given the stamp now reads `currentGeneration`?
 *
 * Only when nothing has advanced the stamp since the read left: no newer read,
 * and — the point of this whole module — no local write. Equality is the whole
 * test, because the stamp only ever moves forward.
 */
export function revalidationWins(issuedGeneration: number, currentGeneration: number): boolean {
  return issuedGeneration === currentGeneration;
}

/**
 * Settle a revalidation against the copy on screen.
 *
 * The provider's single call site for landing a read: it folds the staleness
 * guard and the replacement together so the guard cannot be forgotten at one
 * call site and honoured at another. A stale read (one a local write or a newer
 * read has overtaken) returns `prev` untouched; a current one hands off to
 * applyRevalidation, which is the sole authority on server-vs-local-vs-nothing.
 */
export function settleRevalidation(
  prev: HistoryState,
  issuedGeneration: number,
  currentGeneration: number,
  outcome: RevalidationOutcome,
): HistoryState {
  if (!revalidationWins(issuedGeneration, currentGeneration)) return prev;
  return applyRevalidation(prev, outcome);
}
