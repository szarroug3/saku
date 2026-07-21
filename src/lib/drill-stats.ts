// The drill's per-fact counter writes, as data. No React, no DOM.
//
// WHY ITS OWN FILE
// ================
// Same reason as src/lib/session-accuracy.ts, and the comment there is the long
// version: the bug this module exists to prevent is arithmetic, arithmetic
// buried in a .tsx cannot be tested (the runner has no JSX transform), and it
// was buried, and it was wrong.
//
// THE BUG THIS FIXES
// ==================
// `seen` was incremented in nextQuestion(), when a card was PUT ON SCREEN.
// `firstTryCount` and `correct` are incremented in submit(), when a showing
// RESOLVES. Two different moments, and therefore two different units in one
// ratio — the same class of bug task 03 fixed, one level down.
//
// src/lib/session-accuracy.ts guards against the on-screen card with
// `firstTryCorrect === null` ("still in flight"). That guard is per-FACT, but
// the thing in flight is a SHOWING. It therefore only ever protected a fact's
// FIRST showing. The moment a card came round a second time the fact already
// had a non-null `firstTryCorrect` from its earlier showing, so the whole fact
// — including the freshly-incremented `seen` for the card now sitting
// unanswered on screen — was pooled, against a numerator that could not yet
// include it.
//
// A learner answering five facts perfectly, then being shown a repeat as the
// sixth card, read 5/6 = 83% while looking at an unbroken streak of 5. The
// series continues 6/7 = 86%, 7/8 = 88% — which is exactly what the beginner
// audit recorded, badge for badge.
//
// The same off-by-one showing reached the round summary, where
// `total = Σ seen` counted the unanswered card and `needAnother = total -
// firstTry` therefore invented a miss that `missedInRound` — which reads
// `misses`, and so knew nothing about it — correctly reported as "Nothing
// missed". One phantom, two contradictory screens.
//
// THE RULE
// ========
// Every counter in SHOWINGS is advanced in exactly one place: here, at
// resolution. A card on screen has contributed nothing to any of them yet, so
// there is no in-flight showing for a guard to have to exclude.

import type { FactSessionDetail, SessionStats, FactId } from "@/types";
import { newFactStat } from "@/lib/engine";

/**
 * The stat a showing will write into, created on demand.
 *
 * Deliberately advances NO counter. A card being put on screen is not yet an
 * event any ratio may count — see the header. It exists only so the fact has a
 * key in `roundStats` from the moment it is asked, which is what lets the
 * round-complete picker offer a fact you were shown and walked away from.
 */
export function statForShowing(stats: SessionStats, f: FactId): FactSessionDetail {
  return stats[f] ?? (stats[f] = newFactStat());
}

/**
 * A showing has RESOLVED — landed, or run out of retries. Advances every
 * counter that is denominated in showings, together, so they cannot drift.
 *
 * `credit` is src/lib/engine's firstTryCredit(): right, cold, unhinted.
 * `ok` is whether this showing ended right at all (the forgiving numerator).
 *
 * `firstTryCorrect` — the FLAG, the verdict on the first showing — is set here
 * and not on the first wrong attempt, which is where it used to be set. A fact
 * you missed once and then abandoned mid-retry resolved nothing, so it keeps a
 * null flag and stays out of the pool, which is the honest reading. A fact you
 * missed and then landed on the retry still gets `false`, because `credit` is
 * false by then. No caller could tell the difference except the pool, and for
 * the pool this is the difference between right and wrong.
 *
 * `?? 0` on the two counts because a runtime resumed from a sessionStorage
 * snapshot written before those fields existed won't have them, and
 * `undefined + 1` is NaN — see src/lib/first-try.ts.
 */
export function resolveShowing(
  st: FactSessionDetail,
  credit: boolean,
  ok: boolean,
): void {
  st.seen++;
  if (st.firstTryCorrect === null) st.firstTryCorrect = credit;
  if (credit) st.firstTryCount = (st.firstTryCount ?? 0) + 1;
  if (ok) {
    st.everCorrect = true;
    st.correct = (st.correct ?? 0) + 1;
  }
}
