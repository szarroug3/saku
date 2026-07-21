// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/drill-stats.test.ts
//
// WHAT THIS PINS
// ==============
// The beginner audit, findings 5 and 6, which are one bug:
//
//   "Five correct answers in a row, a visible unbroken streak of 5, and the
//    accuracy drops from 100% to 83%. It then climbs 86%, 88%."
//
//   "8 questions · 7 right first try · 1 needed another look" printed directly
//    above "Nothing missed."
//
// Both come from `seen` being incremented when a card is SHOWN while every
// numerator is incremented when a showing RESOLVES. See src/lib/drill-stats.ts
// for the full account. The tests below drive the drill loop the way a learner
// drives it — show a card, answer it, show the next — and assert the two things
// the learner actually looked at: the live pill, and whether the round summary
// agrees with itself.
//
// The scenario is deliberately the audit's: FIVE facts and more showings than
// facts, because the bug is invisible until a fact comes round a second time.
// A run that never repeats a fact cannot reproduce it, which is why the
// existing in-flight test in session-accuracy.test.ts ("the unanswered showing
// is not in the pool") passes on the broken code — it only ever shows a fact
// for the first time.

import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveShowing, statForShowing } from "@/lib/drill-stats";
import { poolSessionCounts, sessionAccuracy } from "@/lib/session-accuracy";
import { roundCompleteView, type StudySession } from "@/lib/session";
import type { FactId, SessionStats } from "@/types";

const f = (s: string): FactId => s as FactId;

/** The audit's group 1: あいうえお. */
const POOL = ["a", "i", "u", "e", "o"].map(f);

/** A session carrying `stats` as its round, enough for roundCompleteView. */
function sessionWith(stats: SessionStats): StudySession {
  return {
    facts: POOL,
    teach: [],
    what: "test",
    snapshot: {} as StudySession["snapshot"],
    startedAt: 0,
    round: 1,
    phase: "drilling",
    restUntil: null,
    roundStats: stats,
    recovered: [],
    rounds: [],
    totalStats: {},
    lastActiveAt: 0,
  };
}

/**
 * The drill loop, as the learner experiences it: card n is put on screen, and
 * only then is card n-1 already answered. `onScreen` is the state the audit
 * screenshotted — a card showing, unanswered, while the pill is read.
 */
function driveCorrectly(showings: number): SessionStats {
  const stats: SessionStats = {};
  for (let n = 0; n < showings; n++) {
    // The deck wraps at 5, so showing 6 is a REPEAT of `a` — the fact whose
    // firstTryCorrect is already non-null. That is the whole bug.
    const st = statForShowing(stats, POOL[n % POOL.length]);
    resolveShowing(st, true, true); // answered right, cold, no hint
  }
  return stats;
}

/**
 * The audit's actual vantage point: `answered` cards answered correctly, and
 * the NEXT card already on screen — because that is when a learner reads the
 * badge row. The bug is invisible without this: show-and-immediately-resolve
 * keeps `seen` and `firstTryCount` in step, so a driver that never leaves a
 * card up passes on the broken code.
 */
function driveThenShowNext(answered: number): SessionStats {
  const stats = driveCorrectly(answered);
  statForShowing(stats, POOL[answered % POOL.length]);
  return stats;
}

test("answering perfectly reads 100%, however many times the deck wraps", () => {
  // THE REGRESSION, and it reproduces the audit's series exactly. On the broken
  // code this read 100, 100, 100, 100, 83, 86, 88 — flat while the card on
  // screen was a fact never shown before (the in-flight guard held), then
  // falling from the fifth answer on, which is where the five-fact deck wraps
  // and the card on screen is a REPEAT the guard no longer covers.
  for (let answered = 1; answered <= 12; answered++) {
    assert.equal(
      sessionAccuracy(driveThenShowNext(answered), "firstTry"),
      100,
      `strict accuracy after ${answered} correct answer(s), next card on screen`,
    );
  }
});

test("a card on screen but not yet answered moves nothing, repeat or not", () => {
  // The pill is read WHILE a card sits unanswered. Showing 6 is a repeat of
  // `a`, so the fact is no longer "in flight" by firstTryCorrect's reckoning —
  // which is precisely why the guard in session-accuracy.ts did not save it.
  const stats = driveCorrectly(5);
  const before = sessionAccuracy(stats, "firstTry");
  statForShowing(stats, POOL[0]); // card 6 goes up: a repeat of `a`
  assert.equal(before, 100);
  assert.equal(
    sessionAccuracy(stats, "firstTry"),
    100,
    "showing a repeat must not drop the pill before it is answered",
  );
  assert.equal(poolSessionCounts(stats).seen, 5, "5 answers, 5 showings pooled");
});

test("the round summary agrees with itself while a card is on screen", () => {
  // The audit's round 2, verbatim: seven answered, an eighth on screen. The
  // broken code printed "8 questions · 7 right first try · 1 needed another
  // look" over "Nothing missed."
  const stats = driveCorrectly(7);
  statForShowing(stats, POOL[2]); // the eighth card, unanswered
  const view = roundCompleteView(sessionWith(stats));

  assert.equal(view.total, 7, "only answered showings are questions");
  assert.equal(view.firstTry, 7, "every one of them was landed cold");
  assert.equal(view.needAnother, 0, "nothing needed another look");
  // The contradiction itself: these two are computed from different sources
  // (a subtraction vs `misses`), so pinning them together is the point.
  assert.deepEqual(view.missed, [], "and nothing was missed");
  assert.equal(
    view.needAnother === 0,
    view.missed.length === 0,
    '"needed another look" and "nothing missed" must never disagree',
  );
});

test("a SLOW but correct first answer earns full first-try credit", () => {
  // REFUTATION, kept as a test because it was a live hypothesis: a second
  // auditor read `10 answered · 91% first try · 🔥 10` and inferred that a
  // slow-but-right answer was being deducted from the "% first try" pill,
  // which would have meant the label and the measurement disagreed and that
  // someone had to choose what "first try" means.
  //
  // They do not disagree. firstTryCredit(ok, tries, hinted) has three terms and
  // slowness is not one of them; `st.slow` is a separate counter that no
  // numerator reads. A slow answer is a first-try answer, here and in the pill.
  //
  // The 91% was this file's bug: 10 resolved showings over a denominator of 11,
  // the eleventh being the card on screen. 10/11 = 90.9%. The HUD's "10
  // answered" (rt.resolved) and the summary's "11 questions" (Σ seen) are the
  // same off-by-one seen from two sides.
  const stats: SessionStats = {};
  const st = statForShowing(stats, POOL[0]);
  resolveShowing(st, true, true); // right, cold, unhinted — but took a while
  st.slow++;

  assert.equal(st.firstTryCount, 1, "slow does not forfeit the credit");
  assert.equal(sessionAccuracy(stats, "firstTry"), 100);

  // And the shape the auditor actually saw: ten clean answers, one of them
  // slow, must read 100% and not 91%.
  const run = driveCorrectly(10);
  run[POOL[0]].slow++;
  assert.equal(sessionAccuracy(run, "firstTry"), 100, "streak of 10 reads 100%");
});

test("a HINTED first answer does forfeit it — the one thing a hint costs", () => {
  // The other side of the same rule, so the refutation above cannot be read as
  // "nothing forfeits the credit".
  const stats: SessionStats = {};
  const st = statForShowing(stats, POOL[0]);
  resolveShowing(st, false, true); // right, cold, but hinted → no credit
  assert.equal(st.firstTryCount, 0);
  assert.equal(st.correct, 1, "still correct, still seen");
  assert.equal(sessionAccuracy(stats, "attempt"), 100);
});

test("a real miss still counts, on both screens", () => {
  // The guard against fixing the phantom by suppressing genuine misses.
  const stats: SessionStats = {};
  const st = statForShowing(stats, POOL[0]);
  resolveShowing(st, false, false); // wrong, retries exhausted
  st.misses++;

  assert.equal(sessionAccuracy(stats, "firstTry"), 0);
  const view = roundCompleteView(sessionWith(stats));
  assert.equal(view.total, 1);
  assert.equal(view.firstTry, 0);
  assert.equal(view.needAnother, 1);
  assert.deepEqual(view.missed, [POOL[0]]);
});

test("landing it on the retry is one showing, not first try", () => {
  // A miss then a recovery inside the same showing: `seen` must tick ONCE.
  const stats: SessionStats = {};
  const st = statForShowing(stats, POOL[0]);
  st.misses++; // wrong attempt, retries left — resolves nothing
  assert.equal(
    sessionAccuracy(stats, "firstTry"),
    null,
    "mid-retry, nothing has resolved, so there is no accuracy to show yet",
  );
  resolveShowing(st, false, true); // right on the second attempt

  assert.equal(st.seen, 1, "one card, one showing");
  assert.equal(st.firstTryCount, 0);
  assert.equal(st.correct, 1);
  assert.equal(sessionAccuracy(stats, "firstTry"), 0);
  assert.equal(sessionAccuracy(stats, "attempt"), 100);
});
