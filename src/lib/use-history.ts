"use client";

// Read access to the learner's history, for any screen that shows something
// derived from it (picker accuracy, sessions, stats, the feed).
//
// The state itself lives in HistoryProvider, mounted once in the root layout —
// see src/lib/history-provider.tsx for why, and for how the first paint gets its
// data without a client fetch. The shape here is unchanged from when this hook
// owned the state, so the eighteen screens that call it did not have to change:
// `{ history, loaded, refresh }`, with `refresh()` still forcing a real
// revalidation against the server.

import { useContext } from "react";

import { HistoryContext, type HistoryContextValue } from "@/lib/history-provider";

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  // Loud, because the quiet alternative is worse: falling back to a private
  // fetch here would give that screen its own copy of the history, drifting from
  // everyone else's after the next write, and it would do it invisibly.
  if (!ctx) {
    throw new Error("useHistory must be used inside <HistoryProvider> (see the root layout)");
  }
  return ctx;
}

/** Accuracy % over a group of FACTS under `metric`, or null if unseen.
 *
 * Re-exported, not reimplemented: src/lib/accuracy.ts is the one definition of
 * what these numbers mean, and the old local copy here mixed the two
 * denominators. Screens already holding a history can keep the single import. */
export { accuracyFor } from "@/lib/accuracy";
