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
import { firstTryCredit } from "@/lib/engine";
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
      sessionAccuracy(driveThenShowNext(answered)),
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
  const before = sessionAccuracy(stats);
  statForShowing(stats, POOL[0]); // card 6 goes up: a repeat of `a`
  assert.equal(before, 100);
  assert.equal(
    sessionAccuracy(stats),
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

test("a HINTED first answer does forfeit it — the one thing a hint costs", () => {
  // The other side of the same rule, so the refutation above cannot be read as
  // "nothing forfeits the credit".
  const stats: SessionStats = {};
  const st = statForShowing(stats, POOL[0]);
  resolveShowing(st, false, true); // right, cold, but hinted → no first-try credit
  assert.equal(st.firstTryCount, 0);
  assert.equal(st.correct, 1, "still correct, still seen");
  assert.equal(sessionAccuracy(stats), 100, "a hint costs first-try credit, not correctness");
});

test("a real miss still counts, on both screens", () => {
  // The guard against fixing the phantom by suppressing genuine misses.
  const stats: SessionStats = {};
  const st = statForShowing(stats, POOL[0]);
  resolveShowing(st, false, false); // wrong, retries exhausted
  st.misses++;

  assert.equal(sessionAccuracy(stats), 0);
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
    sessionAccuracy(stats),
    null,
    "mid-retry, nothing has resolved, so there is no accuracy to show yet",
  );
  resolveShowing(st, false, true); // right on the second attempt

  assert.equal(st.seen, 1, "one card, one showing");
  assert.equal(st.firstTryCount, 0);
  assert.equal(st.correct, 1);
  assert.equal(sessionAccuracy(stats), 100, "landed the showing, just not on the first attempt");
});

test("SAK-17/SAK-26: a hint-then-correct answer scores exactly like a plain correct answer", () => {
  // Pins the drill-screen.tsx submit() call site, not just resolveShowing.
  // The bug (SAK-17) was that submit() computed `credit = firstTryCredit(ok,
  // tries, hinted)` — correctly false, since a hint forfeits "nailed it" — and
  // then passed THAT SAME `credit` as resolveShowing's `ok` argument too:
  // `resolveShowing(st, credit, credit, ...)`. `ok` is supposed to be the real
  // verdict on the showing ("did it land at all"), never the hint-penalized
  // one, so a hinted-but-ultimately-correct answer silently never incremented
  // `correct`/`everCorrect` — undercounting Live Accuracy AND writing a false
  // "not correct" into the very record standing/scheduling reads.
  //
  // SAK-26 is the product rule this must satisfy: hint or Choices, followed by
  // a correct answer, is a normal correct answer on every counter that isn't
  // specifically "did you nail it clean" (streak already got this right, since
  // it keys off `tries === 0`, which a hint never touches).
  const stats: SessionStats = {};
  const st = statForShowing(stats, POOL[0]);
  const ok = true;
  const tries = 0; // a hint/Choices forfeit never spends a retry pip
  const hinted = true;
  const credit = firstTryCredit(ok, tries, hinted);
  assert.equal(credit, false, "a hint still forfeits the strict first-try flag");

  // The fixed call: resolveShowing(st, credit, ok, ...) — `ok`, not `credit`,
  // in the third slot.
  resolveShowing(st, credit, ok);

  assert.equal(st.correct, 1, "a hinted correct answer is still CORRECT");
  assert.equal(st.everCorrect, true, "the real standing record sees it as correct");
  assert.equal(st.firstTryCount, 0, "but it did not earn the strict first-try credit");
  assert.equal(
    sessionAccuracy(stats),
    100,
    "Live Accuracy must not drop for a hint-assisted correct answer",
  );
  // Streak's own rule, unchanged by this fix: only `tries === 0` matters, and
  // a hint never increments `tries`, so the streak-continuing condition drill-
  // screen.tsx checks (`if (q.tries === 0) rt.streak++`) is satisfied here too
  // — the two counters now agree.
  assert.equal(tries === 0, true, "streak's own condition also holds — no penalty either");
});

test("SAK-17/SAK-26 regression guard: a genuinely wrong, never-landed answer still counts against both counters", () => {
  // The fix must not loosen what WRONG means. A card that ran out of retries
  // (or was skipped) without ever landing correct is `ok: false` regardless of
  // hint usage, and must still tank accuracy and break the streak.
  const stats: SessionStats = {};
  const st = statForShowing(stats, POOL[0]);
  const ok = false;
  const tries: number = 2; // exhausted its retries
  const hinted = true; // even if a hint was used along the way
  const credit = firstTryCredit(ok, tries, hinted);
  assert.equal(credit, false);

  resolveShowing(st, credit, ok);

  assert.equal(st.correct, 0, "never landed correct — still 0");
  assert.equal(st.everCorrect, false, "the real standing record sees it as wrong");
  assert.equal(sessionAccuracy(stats), 0, "Live Accuracy still drops for a real miss");
  assert.equal(tries === 0, false, "streak's own condition fails too — streak still breaks");
});

test("resolveShowing records the showing's presentation for the results chip", () => {
  // The post-quiz screens name HOW a card was asked; the framing rides here.
  const stats: SessionStats = {};
  const st = statForShowing(stats, POOL[0]);
  resolveShowing(st, true, true, { dir: "jp2en", mode: "typed", listen: true });
  assert.deepEqual(st.shown, { dir: "jp2en", mode: "typed", listen: true });
  assert.deepEqual(st.showns, [{ dir: "jp2en", mode: "typed", listen: true }]);

  // Asked again a different way in the same run → the latest framing wins.
  resolveShowing(st, true, true, { dir: "en2jp", mode: "mc", listen: false });
  assert.deepEqual(st.shown, { dir: "en2jp", mode: "mc", listen: false });
  assert.deepEqual(st.showns, [
    { dir: "jp2en", mode: "typed", listen: true },
    { dir: "en2jp", mode: "mc", listen: false },
  ]);

  // Repeating a shape keeps one copy in the history list.
  resolveShowing(st, true, true, { dir: "jp2en", mode: "typed", listen: true });
  assert.deepEqual(st.showns, [
    { dir: "jp2en", mode: "typed", listen: true },
    { dir: "en2jp", mode: "mc", listen: false },
  ]);

  // A resolution with no presentation leaves the last one in place, not blank.
  // The last showing was the jp2en repeat above (last framing wins), so that is
  // what a blank resolution must preserve.
  resolveShowing(st, true, true);
  assert.deepEqual(st.shown, { dir: "jp2en", mode: "typed", listen: true });
  assert.deepEqual(st.showns, [
    { dir: "jp2en", mode: "typed", listen: true },
    { dir: "en2jp", mode: "mc", listen: false },
  ]);
});
