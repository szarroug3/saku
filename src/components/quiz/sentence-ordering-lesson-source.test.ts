// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/components/quiz/sentence-ordering-lesson-source.test.ts
//
// SAK-75: a sentence-ordering retry showed the assembly screen's "nothing
// learned yet" empty state instead of re-asking the missed item. Root cause:
// assembly-screen.tsx decided whether to source cards from a tier's live
// lesson examples by checking the LEG's `what` for a "Sentence ordering ·
// tier " prefix — but retryLeg (quiz-session.tsx) rebuilds the leg with its
// own `what` on every retry. This module is the fixed decision: it reads the
// SESSION's `what`, which retryLeg preserves (it no longer overwrites it —
// see quiz-session.tsx), so a retry resolves the same tier the round it just
// finished did.
//
// These tests model the two ends of retryLeg's fix directly: given what
// retryLeg now passes as a leg's `what` (session.what, unchanged across every
// round and retry), the lesson-examples path is reached for every tier — and
// given what it used to pass (a leg-local label like "The misses"), it is
// not, reproducing the original bug as a regression guard.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SENTENCE_ORDERING_TIERS } from "../../data/assembly.ts";
import { sentenceOrderingLessonTier } from "./sentence-ordering-lesson-source.ts";

describe("sentenceOrderingLessonTier", () => {
  test("resolves every sentence-ordering tier from the session's frozen `what`", () => {
    for (const tier of SENTENCE_ORDERING_TIERS) {
      assert.equal(
        sentenceOrderingLessonTier(`Sentence ordering · tier ${tier.id}`),
        tier.id,
        `tier ${tier.id} should resolve — this is the "conditional" tiers-beyond-simple case SAK-75 flagged as worth checking`,
      );
    }
  });

  test("a retry leg carrying the SESSION's what (the fix) reaches the lesson-examples path", () => {
    // What retryLeg now does: beginLeg(facts, session.what, session.snapshot, true, boxes).
    const sessionWhat = "Sentence ordering · tier simple";
    const retryLegWhat = sessionWhat; // preserved, not overwritten
    assert.equal(sentenceOrderingLessonTier(retryLegWhat), "simple");
  });

  test("regression guard: the OLD hardcoded retry leg name does not resolve a tier", () => {
    // What retryLeg used to do before the fix: beginLeg(facts, "The misses", ...).
    // If this ever starts resolving a tier again, SAK-75's empty-state bug is
    // back — the whole point of reading session.what instead is that a leg's
    // own display label must never gate this decision.
    assert.equal(sentenceOrderingLessonTier("The misses"), null);
  });

  test("no session (a one-off quiz — redrill/rerun from /results) never uses lesson examples", () => {
    assert.equal(sentenceOrderingLessonTier(undefined), null);
    assert.equal(sentenceOrderingLessonTier("That session"), null);
  });

  test("an unknown tier id in a stale prefix does not resolve (defensive, e.g. a renamed tier)", () => {
    assert.equal(
      sentenceOrderingLessonTier("Sentence ordering · tier nonexistent"),
      null,
    );
  });
});
