"use client";

// The Library's read of the fact aggregate, LIVE — committed history.facts with
// the in-progress run folded on top, so a miss shows the moment its card
// resolves rather than on End session.
//
// The whole of the compute is pure and elsewhere (src/lib/library/
// live-standing.ts foldLiveStats); this hook only wires the two live sources to
// it — the committed aggregate the caller already holds, and the in-progress
// run's uncommitted stats from the session provider — and memoises the result so
// the standing surfaces do not re-fold on every render.
//
// WHY A HOOK AND NOT A CHANGE TO useHistory. `history.facts` is read by
// eighteen screens, most of which (stats, the results boards, the sessions
// list) must show COMMITTED history and nothing else — a stats page that moved
// the instant you answered a card would be lying about what is on disk. So the
// live view is opt-in, taken by exactly the Library standing surfaces that want
// it, and the durable copy stays the durable copy everywhere else.

import { useMemo } from "react";

import { foldLiveStats } from "@/lib/library/live-standing";
import { useQuizSession } from "@/lib/quiz-session";
import type { FactAggregate, FactId } from "@/types";

/**
 * `base` (committed history.facts) with the current run's outcomes folded in,
 * as of `now`. Returns `base` unchanged when no run is in progress, so a caller
 * with nothing live pays only a memo comparison.
 */
export function useLiveFacts(
  base: Readonly<Record<FactId, FactAggregate>>,
  now: number,
): Record<FactId, FactAggregate> {
  const { liveStats } = useQuizSession();
  return useMemo(
    () => foldLiveStats(base, liveStats, now),
    [base, liveStats, now],
  );
}
