// Decides whether an assembly-mode LEG should draw its cards from a sentence-
// ordering tier's live-generated lesson examples (TIER_EXAMPLES, in
// assembly-screen.tsx) or the small hand-curated practice corpus
// (CURATED_ASSEMBLY, in @/data/assembly).
//
// SAK-75: this used to read `active.what` — the LEG's own name — checking it
// for the "Sentence ordering · tier " prefix. That broke on retry: retryLeg
// (quiz-session.tsx) legitimately rebuilds the leg with a new `what` (it used
// to hardcode "The misses"), because a leg's `what` is bookkeeping for that
// one leg, not the lesson's identity. The SESSION's `what`, by contrast, is
// frozen at Start and carried unchanged through every round and every retry
// (see StudySession.what / ActiveQuiz.what's own doc comment) — it is the
// stable "what lesson is this" signal, so this reads THAT instead of the leg's.
//
// A one-off quiz (redrill/rerun from /results, or any assembly quiz started
// outside the session loop) has no session at all, so this correctly resolves
// to null for those and they fall through to the practice-corpus branch, same
// as before this fix.

import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import type { SentenceOrderingTierId } from "@/data/sentence-ordering-guides";

const SESSION_WHAT_PREFIX = "Sentence ordering · tier ";

/**
 * The tier a sentence-ordering lesson SESSION names itself after, or null when
 * `sessionWhat` isn't one (no session, a non-sentence session, or an unknown
 * tier id — defensive against a future tier rename leaving a stale string in
 * a restored snapshot).
 */
export function sentenceOrderingLessonTier(
  sessionWhat: string | undefined,
): SentenceOrderingTierId | null {
  if (!sessionWhat || !sessionWhat.startsWith(SESSION_WHAT_PREFIX)) return null;
  const id = sessionWhat.slice(SESSION_WHAT_PREFIX.length).trim();
  return SENTENCE_ORDERING_TIERS.some((tier) => tier.id === id)
    ? (id as SentenceOrderingTierId)
    : null;
}
