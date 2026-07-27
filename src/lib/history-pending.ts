"use client";

// THE OVERLAY OF UN-ACKNOWLEDGED WRITES.
//
// WHAT THIS GUARDS
// ================
// history-sync.ts's stamp closes one race between an optimistic write and a
// revalidation: a read that LEFT BEFORE the write cannot land over it, because
// the write advanced the stamp past the read's ticket. That is the read that is
// stale RELATIVE TO OUR OWN WRITE.
//
// This module closes the OTHER one, which the stamp deliberately cannot:
//
//   Clicking "I already know these" on a curriculum lesson fires TWO posts at
//   once — POST /api/claim AND POST /api/seen (see home-feed.tsx's
//   claimCurriculumLesson). Each announces itself when it lands (progress-fetch's
//   `announcing` → notifyHistoryWrite), and the provider revalidates on hearing
//   one. So the SEEN can land first, trigger a revalidation, and that read is
//   issued AFTER the optimistic apply — it carries a CURRENT ticket and PASSES
//   the stamp guard. If that read reaches the server in the window before the
//   CLAIM post has committed, it reads a state that has the seen but NOT the
//   claim, and lands it: the card flickers back to the pre-claim lesson for a
//   frame, until a later revalidation (after the claim commits) restores it.
//
//   The stamp cannot catch this read, because the read is genuinely NEWER than
//   the apply. The problem is not ordering on our side — it is that the server
//   has not yet caught up to our own un-acknowledged write.
//
// THE RULE
// ========
// Keep every un-acknowledged optimistic write layered on top of any incoming
// server snapshot until its post resolves. Each `apply` enqueues its pure op
// here (the same history-ops closure it applied to the screen); when that
// write's post resolves, the op is dequeued. Whenever a revalidation is about to
// REPLACE the copy on screen, the still-pending ops are FOLDED over the fetched
// snapshot first — so a read that predates our own un-acked write can never
// erase it. The screen therefore never shows a state that lacks a change the
// user has made but the server has not yet confirmed.
//
// The ops are the SAME pure closures the screen applied (applyClaims / applySeen
// / …), so folding is not a guess about what the write means — it is the
// identical computation, re-run over the newer base. They are idempotent in the
// way that matters: applyClaims re-run over a snapshot that already carries the
// claim just re-sets the same timestamp, so a fold that overlaps the server's
// own catch-up is harmless.

import type { HistoryFile } from "@/types";

/** One un-acknowledged optimistic write: a stable id (so the write that made it
 * can remove exactly itself when its post resolves) and the pure op it applied. */
export interface PendingWrite {
  id: number;
  op: (hist: HistoryFile) => HistoryFile;
}

/** Add a write to the queue, preserving order — a new array, so a ref holding
 * the queue swaps atomically rather than mutating a list a fold might be reading. */
export function enqueuePending(
  queue: readonly PendingWrite[],
  id: number,
  op: (hist: HistoryFile) => HistoryFile,
): PendingWrite[] {
  return [...queue, { id, op }];
}

/** Remove the write with `id` — called when its post resolves, ok or not. A
 * refused write is dropped here too, so its op stops being folded and the
 * refresh that reverts it sees the plain server truth. */
export function dequeuePending(
  queue: readonly PendingWrite[],
  id: number,
): PendingWrite[] {
  return queue.filter((w) => w.id !== id);
}

/**
 * Apply every still-pending op to `base`, in the order they were made.
 *
 * `base` is a freshly fetched server (or local) snapshot; the result is that
 * snapshot with our un-acked writes layered back on. Order matters — the ops are
 * replayed exactly as the user made them — and an empty queue returns `base`
 * untouched, which is the steady state once every write has been acknowledged.
 */
export function foldPending(
  base: HistoryFile,
  queue: readonly PendingWrite[],
): HistoryFile {
  return queue.reduce((hist, { op }) => op(hist), base);
}
