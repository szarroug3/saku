"use client";

import { useSyncExternalStore } from "react";

// A count of claim/seen/mixup writes currently stuck offline, so the app's one
// save-status banner (src/components/save-status.tsx) can say so.
//
// THE GAP THIS FILLS
// ==================
// Finished quiz rounds have a durable outbox (pending-records.ts) that survives
// a reload and a closed tab, and its saveError/retrySave drive that banner
// already. Claim / unclaim / markSeen / clearMixup (history-writes.ts) have no
// such thing — SAK-242 is that a network failure on one of those used to
// silently revert the optimistic change with nothing shown, because reconcile()
// mistook resolveProgressWrite's `{ ok: false, status: 0 }` (a RESOLVED value)
// for "the server refused", instead of the rejection reconcile() assumed.
//
// This module is not a full second outbox — history-writes.ts's own retry (an
// `online` listener that re-fires the same post) already gets the write to
// land once connectivity returns, in the same tab, reusing the closures
// `apply()` already set up. What was still missing was any visible sign that a
// write was waiting, so a learner who stays on the page has something better
// than silence to look at while it retries. This is that signal: a plain
// counter, incremented while a write is waiting on `online` and decremented
// the moment it resolves (landed, or genuinely refused).
//
// A plain module-level counter, not React state, because reconcile() runs
// inside event-driven callbacks with no component of its own to hold state in
// — the callers of `useHistoryWrites()` come and go as the learner navigates,
// and a write outliving the screen that started it must not lose its counter
// with it. `useSyncExternalStore` (see the hook below) is what lets a
// component subscribe to a value that lives outside React.

type Listener = () => void;

let count = 0;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** A claim/seen/mixup write just started waiting for connectivity. */
export function notePendingHistoryWrite(): void {
  count += 1;
  emit();
}

/** The write this counted for has resolved — landed, or been genuinely
 * refused. Safe to call even if nothing was counted (e.g. a defensive
 * catch-all path that never got as far as counting). */
export function clearPendingHistoryWrite(): void {
  if (count === 0) return;
  count -= 1;
  emit();
}

export function pendingHistoryWriteCount(): number {
  return count;
}

export function subscribePendingHistoryWrites(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only: put the counter back to zero between tests. Never called from
 * app code — the count is meant to persist across the writes it is tracking. */
export function resetPendingHistoryWritesForTest(): void {
  count = 0;
  listeners.clear();
}

/** How many claim/seen/mixup writes are currently waiting on connectivity, kept
 * live for whatever renders the save-status banner. Server snapshot is 0: the
 * server has no writes in flight, and a mismatch here just means the banner is
 * briefly absent until hydration reads the real (client-only) count — the safe
 * direction, since the count only ever grows from user interaction after
 * mount. */
export function usePendingHistoryWriteCount(): number {
  return useSyncExternalStore(
    subscribePendingHistoryWrites,
    pendingHistoryWriteCount,
    () => 0,
  );
}
