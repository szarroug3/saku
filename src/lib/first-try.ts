// One rule, in a data-free module: how to READ a fact's first-try showings.
//
// WHY ITS OWN FILE
// ================
// Same reason as src/lib/fact-keys.ts, and the comment there is the long
// version: session.ts sits on the always-mounted QuizSessionProvider's import
// path, so anything it imports lands in the eager client bundle on every route.
// The natural home for this would be next to the pooling in
// src/lib/session-accuracy.ts — but that imports src/lib/accuracy.ts, which
// imports src/lib/facts.ts, which is the whole ~3.6 MB subject registry.
//
// So the rule lives here, spelled once, and both `mergeStats` (light) and
// `poolSessionCounts` (already registry-adjacent) read it from the same place.
// Duplicating a migration rule in two modules is how the two copies drift.

import type { FactSessionDetail } from "@/types";

/**
 * A fact's first-try-correct SHOWINGS this run — the strict numerator, in the
 * same unit as `seen`.
 *
 * MIGRATION. The whole quiz state is snapshotted to localStorage
 * (`kanaquiz-session`) and restored by a plain JSON.parse with no normalising
 * pass, so a run started before `firstTryCount` existed comes back without it.
 * `undefined + 1` is NaN, and a NaN here would spread through every subsequent
 * merge and poison the pill for the rest of the run.
 *
 * An absent count is DERIVED from the boolean rather than defaulted to 0. It is
 * a one-time estimate and it is the honest one: `firstTryCorrect === true`
 * contributed exactly 1 under the old code, so a session resumed across the
 * upgrade reads precisely what it read before the upgrade, and counts properly
 * from its next showing on. Defaulting to 0 would be equally safe but would
 * silently discard the run's work and show a resumed session at 0% — a worse
 * lie than the one being fixed, and one the user would see.
 *
 * The estimate cannot break `firstTryCount <= seen`: `firstTryCorrect` is only
 * non-null once a showing has resolved, so `seen >= 1` wherever this returns 1.
 */
export function firstTryShowings(st: FactSessionDetail): number {
  return st.firstTryCount ?? (st.firstTryCorrect === true ? 1 : 0);
}
