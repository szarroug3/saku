// Which lesson a track's CARD shows while one of its sessions is still open.
//
// THE PROBLEM, STATED ONCE
// ========================
// A lesson card is a view of history: "the next thing you have not met". A
// session started from that card immediately stops agreeing with it, because
// starting is itself a write. The curriculum card marks its lesson SEEN before
// the teach walk (startCurriculumLesson in home-feed.tsx), and every track
// commits its facts to history as each round closes. Either write takes the
// lesson's facts out of `freshFacts`, so the live next-lesson query moves on to
// the FOLLOWING set — while the session sits, unfinished, resting in the set
// it opened on.
//
// That leaves the card lying in one of two ways, and the app has now seen both:
//
//   THE CARD VANISHES. A track whose next lesson is momentarily unavailable —
//   kana at its last group, a track that has run out — has no frontier at all
//   once the open session's facts are committed. The card disappears and the
//   resting session is reachable only from /current. (The original bug.)
//
//   THE CARD SHOWS THE WRONG SET. On the unified curriculum spine the frontier
//   is never empty: there is always a next lesson. So the card stays, offers
//   "Continue session" (which correctly resumes the open run), and prints the
//   NEXT set's characters above it. The button and the body disagree, and the
//   body is the one that is wrong. (The regression this file exists to end.)
//
// Both are the same fault — the card reads the frontier, and the frontier has
// moved past the run — so both get the same answer:
//
//   WHILE A RUN IS OPEN FOR A TRACK, THE CARD SHOWS THE LESSON THAT RUN IS
//   RESTING IN, NOT THE FRONTIER'S NEXT ONE.
//
// The resting lesson is rebuilt, not remembered: recompute the track's next
// lesson against a history with the run's OWN facts masked back out
// (`withoutFacts`), which is the frontier exactly as it stood when the session
// began. No cursor is written anywhere, so this stays what every lesson query in
// the app is — a pure function of history — and the card cannot drift out of
// step with the Continue button beside it, because the run's facts are what both
// are computed from.
//
// The rebuild is preferred over the frontier rather than being a fallback for a
// null one, which is precisely the fix: the fallback-only form could never fire
// on a spine that always has a next lesson. It still falls back to the frontier
// when the rebuild yields nothing, so a run whose facts no longer name any
// lesson (a stale run, a track whose material was re-cut under it) can never
// blank a card that would otherwise have rendered.

import type { FactId, HistoryFile } from "@/types";

/**
 * History with a set of facts masked back out: every trace the frontier reads to
 * call a fact "met" (its aggregate, a claim, a "quiz me"), gone.
 *
 * A shallow rebuild of the three fact-keyed maps, not a deep clone: the values
 * are left alone, only the keys in `drop` are omitted, and `sessions` is passed
 * through untouched (freshFacts reads the derived `facts`/`claims`/`seen`, never
 * the raw session list). Returns the SAME object when there is nothing to mask,
 * so the common no-open-session render allocates nothing.
 */
export function withoutFacts(history: HistoryFile, facts: readonly FactId[]): HistoryFile {
  if (!facts.length) return history;
  const drop = new Set(facts);
  const strip = <V,>(rec: Record<FactId, V> | undefined): Record<FactId, V> | undefined => {
    if (!rec) return rec;
    const out: Record<FactId, V> = {};
    for (const key in rec) {
      if (!drop.has(key as FactId)) out[key as FactId] = rec[key as FactId];
    }
    return out;
  };
  return {
    ...history,
    facts: strip(history.facts) ?? {},
    claims: strip(history.claims),
    seen: strip(history.seen),
  };
}

/** All a run has to be for this: the facts it drills. Kept structural so the
 * pure lesson layer never has to know about RunInfo or the session runtime. */
export interface ResumableRun {
  facts: readonly FactId[];
}

/**
 * Has the learner CLAIMED every fact this run is resting on?
 *
 * The one signal that RELEASES the pin. Starting a session marks its facts
 * `seen` (and a completed round folds them into the aggregate), and masking
 * those back out is the whole job above — it is how the card keeps showing the
 * set the run rests in while the frontier moves past it. A `claim` is the one
 * write that must NOT be masked: "I already know these" on the Learn card is a
 * deliberate, out-of-session statement that the resting material is done, and
 * the card has to advance to prove the click landed. Masking it (the bug this
 * closes) recomputed the resting lesson as still-fresh, so the frontier snapped
 * back and the card looked dead.
 *
 * So a claim SUPERSEDES the pin: when every fact the run holds is claimed, the
 * pin releases and the live frontier — which the same claim has already advanced
 * — is what the card shows. Read against the CURRENT (unmasked) history on
 * purpose: this asks what the learner has since claimed, not what the masked
 * rebuild would see. Merely-`seen` never releases (that is the session's own
 * start-write, the thing the mask exists to undo), and neither does a fact the
 * run drilled to `met` — that is the session footprint the mid-drill resume
 * depends on. Only an explicit claim does.
 */
function restingFactsClaimed(history: HistoryFile, run: ResumableRun): boolean {
  if (!run.facts.length) return false;
  return run.facts.every((f) => history.claims?.[f] != null);
}

/**
 * The lesson a track's card should SHOW.
 *
 * No open run for the track: the live frontier, unchanged — the ordinary case,
 * and the one every card was written for.
 *
 * An open run: the lesson that run is resting inside, rebuilt from a history
 * with the run's own facts masked out. That is the set whose characters belong
 * on a card whose button says Continue. When the rebuild names nothing, the
 * frontier stands in, so this can only ever change WHICH lesson a card shows —
 * never whether there is one.
 *
 * An open run whose resting facts the learner has since CLAIMED: the pin
 * releases and the live frontier shows through, so "I already know these"
 * advances the card instead of looking dead (see restingFactsClaimed). The
 * claim has already moved the frontier; this stops the mask from moving it back.
 */
export function resumeLesson<T>(
  history: HistoryFile,
  frontier: T | null,
  run: ResumableRun | undefined,
  rebuild: (history: HistoryFile) => T | null,
): T | null {
  if (!run) return frontier;
  // A claim on the resting material supersedes the pin: release to the live
  // frontier so the card advances instead of masking the claim back out. See
  // restingFactsClaimed — this is #07's "looks dead" fix.
  if (restingFactsClaimed(history, run)) return frontier;
  return rebuild(withoutFacts(history, run.facts)) ?? frontier;
}
