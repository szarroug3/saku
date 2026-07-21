// Pooling one RUN's per-fact stats into an accuracy — the arithmetic behind
// the drill HUD's live pill.
//
// It lives here, and not inline in drill-screen.tsx, for one reason: the bug it
// exists to prevent is arithmetic, and arithmetic buried in a .tsx cannot be
// tested (the runner has no JSX transform). It was buried, and it was wrong:
//
//     agg.seen     += st.seen;                             // per SHOWING
//     agg.firstTry += st.firstTryCorrect === true ? 1 : 0;  // per FACT
//
// Two units in one ratio. `seen` counts how many times a fact was put on
// screen; `firstTryCorrect` is one boolean for the whole run, so it could
// contribute at most 1 however often the fact came round again. A learner who
// answered perfectly every single time read 100%, then 50%, then 33%, then 25%
// as one fact repeated — the number fell fastest for the behaviour the app most
// wants. Endless mode repeats by design, so this was not an edge case.
//
// The fix is that the numerator is a COUNT: `firstTryCount`, incremented once
// per showing that earned the credit. Both sides now count showings, which is
// exactly what src/lib/accuracy.ts says accuracy is.

import { accuracyOf, EMPTY_COUNTS } from "@/lib/accuracy";
import { factKeys } from "@/lib/fact-keys";
import { firstTryShowings } from "@/lib/first-try";
import type { AccuracyMetric, FactCounts, SessionStats } from "@/types";

/**
 * Pool one run's stats into counts, on exactly the terms src/lib/accuracy.ts
 * defines — every field a count of SHOWINGS (except `missed`, which counts
 * attempts and is never a denominator).
 *
 * Facts still in flight are left out: a card on screen that has not been
 * answered yet would otherwise drag the number down before it was attempted.
 * "In flight" is `firstTryCorrect === null`, which is the one field that is
 * written the instant a showing resolves and never before.
 *
 * THAT GUARD IS NO LONGER LOAD-BEARING FOR THE DRILL, and this note is here so
 * nobody restores the hole by trusting it. It is per-FACT, but the thing in
 * flight is a SHOWING, so it only ever covered a fact's FIRST showing — the
 * moment a card came round again the fact had a non-null flag and its
 * on-screen, unanswered showing was pooled anyway. A learner reading an
 * unbroken streak of 5 saw 83%.
 *
 * The fix was not to strengthen the guard but to remove what it was guarding
 * against: src/lib/drill-stats.ts now advances `seen` at RESOLUTION, so a card
 * on screen has contributed to no counter and there is nothing to exclude. The
 * guard stays because the grid and pairs screens still write `seen` at deal
 * time (each fact exactly once there, so it is sound for them), and because a
 * fact whose first showing was abandoned mid-retry legitimately has 0 for
 * everything and should stay out.
 */
export function poolSessionCounts(stats: SessionStats): FactCounts {
  const agg = { ...EMPTY_COUNTS };
  for (const f of factKeys(stats)) {
    const st = stats[f];
    if (st.firstTryCorrect === null) continue; // still in flight
    agg.seen += st.seen;
    agg.missed += st.misses;
    agg.firstTry += firstTryShowings(st);
    agg.correct += st.correct ?? 0;
  }
  return agg;
}

/**
 * Live accuracy for one run: strict = first-try showings / showings,
 * forgiving = correct showings / showings. Null when nothing has resolved yet.
 */
export function sessionAccuracy(
  stats: SessionStats,
  metric: AccuracyMetric,
): number | null {
  return accuracyOf(poolSessionCounts(stats), metric);
}
