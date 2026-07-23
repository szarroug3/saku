"use client";

// "The history just changed" — announced by the writes, heard by the one place
// that holds it.
//
// WHY IT IS NEEDED NOW
// ====================
// While every screen fetched its own history, a stale copy fixed itself by
// accident: mounting a screen fetched again, so walking from a finished round to
// the stats page picked up that round on the way. With one shared copy that
// accident is gone — a client navigation does not remount the provider — so
// freshness has to be deliberate. It is cheaper this way as well: the refetch
// happens when something actually changed rather than on every screen that
// happens to open.
//
// The writes already funnel through progress-fetch.ts, so this is a
// notification, not a data channel: no payload, nothing to merge, nothing to
// trust. It says only "ask the server again", and the answer that comes back is
// the server's, exactly as any other revalidation.

/** A listener, told WHEN the write landed. The timestamp is the point: a
 * revalidation that was already issued after that moment has the change in it
 * (see coveredByRefresh), which is what keeps a screen's own refresh() from
 * being doubled by this. */
type Listener = (at: number) => void;

const listeners = new Set<Listener>();

/** Announce a completed history write. Called from progress-fetch after the
 * server (or, signed out, this browser's store) has accepted one. */
export function notifyHistoryWrite(at: number = Date.now()): void {
  for (const fn of [...listeners]) fn(at);
}

/** Subscribe; the returned function unsubscribes. */
export function onHistoryWrite(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Is a write at `writeAt` already accounted for by a revalidation issued at
 * `refreshIssuedAt`?
 *
 * A request that left AFTER the write completed cannot miss it, so the answer is
 * a comparison and not a guess. This is what lets the screens that already call
 * refresh() after their own write keep doing so without paying for a second
 * request.
 */
export function coveredByRefresh(refreshIssuedAt: number, writeAt: number): boolean {
  return refreshIssuedAt >= writeAt;
}

/** How long to wait before acting on a write, in ms. Long enough for a screen's
 * own refresh() to be issued and make this one unnecessary, short enough that a
 * screen nobody refreshed catches up before anyone has walked to it. */
export const WRITE_SETTLE_MS = 150;
