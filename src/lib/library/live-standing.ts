// history.facts + the run you are STILL DOING, folded at READ time.
//
// THE BUG THIS CLOSES
// ===================
// Standing (src/lib/library/standing.ts) reads `history.facts` — the folded
// aggregate of sessions COMMITTED to history. A miss made mid-drill lives only
// in the drill runtime and the in-progress session state until the round banks;
// until then the Library kept saying "not seen" / "solid" about a fact you had
// just fumbled, and only caught up on "End session". The owner's line: it should
// update the moment you make the mistake.
//
// WHY FOLD AT READ TIME AND NOT COMMIT EACH CARD
// ==============================================
// The alternative was to commit a fact to history the instant its card resolved
// (a partial commit). That was rejected: it would move WHEN history is durably
// written — the SRS model's one fold per session (aggregate.ts) turns into one
// fold per card, the order-dependent stability replay gets a new order to worry
// about, and a discarded session would have to UN-write facts it had already
// durably folded. This module keeps history exactly as durable as it was and
// composes a VIEW on top: committed aggregate + the live run's projected counts,
// folded through the very same aggregate.foldSession the commit will use. When
// the round finally banks, the number does not move, because it was computed
// from the same counts and the same fold all along (see the tests).
//
// PURE, AND IT REUSES THE ONE FOLD. No React, no window — the projection is
// session-record.projectSessionFacts (shared with the durable writer) and the
// SRS math is aggregate.foldSession (shared with history.saveSession). Nothing
// here reimplements either; it only decides to run them over the live run too.

import { emptyAggregate, foldSession } from "@/lib/aggregate";
import { projectSessionFacts } from "@/lib/session-record";
import type { FactAggregate, FactId, SessionStats } from "@/types";

/**
 * The aggregate map the Library should read: `base` (committed history.facts)
 * with the in-progress run's outcomes folded on top, at `now`.
 *
 * DISJOINT BY CONSTRUCTION, so nothing is counted twice. `base` already holds
 * every round the session COMMITTED (rounds bank as they close — see
 * quiz-session.closeRound). `live` is what has NOT banked yet: the current
 * leg's runtime stats and the current round's `roundStats`, which the provider
 * merges before handing them here. A leg's stats move out of the runtime and
 * into roundStats the instant it finishes, and a round's roundStats move into
 * history and reset the instant it commits — so at any moment the live stats and
 * the committed aggregate describe different showings, and folding one onto the
 * other adds each showing exactly once.
 *
 * A fact still in flight (a card on screen, unanswered) projects to `seen === 0`
 * and foldSession moves nothing for it — standing changes when a card RESOLVES,
 * not when it is dealt.
 *
 * When the run has resolved nothing, returns `base` unchanged (same reference),
 * which is also the whole defence for a DISCARDED session: discard clears the
 * live session state, so the provider hands `{}` here, so this returns the
 * committed aggregate untouched. A rolled-back run's stats cannot be resurrected
 * because there is nothing left to read them from — see #26 for the seen/facts
 * rollback this pairs with.
 */
export function foldLiveStats(
  base: Readonly<Record<FactId, FactAggregate>>,
  live: SessionStats,
  now: number,
): Record<FactId, FactAggregate> {
  const facts = projectSessionFacts(live);
  const keys = Object.keys(facts) as FactId[];
  // Nothing answered → the committed aggregate IS the answer. Same reference so
  // memoised callers see no change and standing surfaces do not re-render.
  if (keys.length === 0) return base as Record<FactId, FactAggregate>;

  const merged: Record<FactId, FactAggregate> = { ...base };
  for (const f of keys) {
    // Clone before folding: foldSession mutates in place, and `base` is the
    // shared committed aggregate the rest of the app is reading. A FactAggregate
    // is flat (counts + scoring state, all numbers), so a shallow copy is a full
    // copy — no nested object survives to be aliased back into history.
    const agg: FactAggregate = { ...(base[f] ?? emptyAggregate()) };
    foldSession(agg, facts[f], now);
    merged[f] = agg;
  }
  return merged;
}
