"use client";

// THE WRITE SIDE OF "SEED EARLY, SYNC LATE".
//
// WHAT WAS WRONG
// ==============
// Every write on this app was shaped like this:
//
//     await postClaim(facts, true);   // round trip 1: tell the server
//     await refresh();                // round trip 2: ask for the whole history back
//
// and nothing on screen moved until both landed. "I already know these" took
// about two seconds to acknowledge a click. Starting a lesson flipped its button
// to Continue — that part is local state — and then sat there, because the
// navigation was behind the same two trips.
//
// Seeding the history server-side fixed the FIRST paint and only the first
// paint. Every interaction after it still paid full price, which is why the app
// felt like it loaded fast and then went slack.
//
// WHY WE ARE ALLOWED TO JUST DO IT LOCALLY
// ========================================
// Because we are not predicting the server's answer, we are running it. The
// functions that decide what a write does to a history are pure and live in
// history-ops.ts, and they already have two callers: the API route applies them
// on the server, and the signed-out path applies them in this browser. This is
// the third caller of the same functions, and it computes the same result.
//
// That is the whole argument, and it is why this is not the usual optimistic-UI
// bargain where the client guesses and sometimes guesses wrong. There is one
// implementation of "what does claiming these facts mean", and everybody runs
// it.
//
// WHAT STILL GOES TO THE SERVER
// =============================
// Everything. The post is unchanged and still the durable record; it is simply
// no longer on the path between the click and the screen. It still announces
// itself (progress-fetch's `announcing`), the provider still revalidates, and
// the server's answer still wins when it lands — so a write that was refused,
// or that raced another device, corrects itself the way it always did.
//
// The one thing we add is `reconcile`: if the post comes back NOT ok, the local
// apply was the only thing holding that change and it has to go. `refresh()`
// replaces the screen with the server's truth, which is the same recovery the
// app already performs, just triggered deliberately instead of incidentally.
//
// SAK-242: A THROWN POST IS NOT A REFUSAL, AND resolveProgressWrite NEVER THROWS
// ===============================================================================
// The paragraph above was written assuming a thrown request (offline, aborted)
// would reject the promise reconcile() is handed, and that the rejection
// handler below is what "neither refresh nor settle" for that case. It never
// ran: resolveProgressWrite (progress-write.ts) catches its own fetch and
// RESOLVES `{ ok: false, status: 0 }` — a deliberate, tested contract (see
// progress-write.test.ts), because the SAME function also has to decide what a
// real 401 means, and a caller that cannot tell "the request never reached the
// server" from "the server said no" cannot get that decision right either.
// reconcile()'s success handler ran instead, on every offline tap: `settle()`
// dropped the optimistic overlay and `refresh()` replaced the screen with the
// truth the server actually holds — the write it never received — which is the
// silent revert this fixes.
//
// The fix reads `status` rather than the settled/rejected shape of the
// promise: `status === 0` is resolveProgressWrite's own signal for "the
// request never completed" (a thrown fetch, or a thrown refresh-then-retry),
// and is the one case that must NOT be treated as a refusal. Instead of
// leaving the overlay to hope the write "lands" with nothing ever attempting
// that, this now retries the same write once the browser reports it is back
// online — repeating for as long as that keeps happening — and only settles
// (and, on a genuine refusal, refreshes) once the write actually resolves one
// way or the other. `notePendingHistoryWrite`/`clearPendingHistoryWrite`
// (pending-history-writes.ts) count the wait so the app's one save-status
// banner can say so instead of a learner watching nothing happen. The decision
// itself lives in history-write-reconcile.ts, pure and unit-tested the same
// way progress-write.ts's resolveProgressWrite is; this hook only supplies the
// real `window` wiring around it.

import { useCallback, useMemo } from "react";

import { runReconcile } from "@/lib/history-write-reconcile";
import {
  clearPendingHistoryWrite,
  notePendingHistoryWrite,
} from "@/lib/pending-history-writes";

import {
  applyClearMixup,
  applyClaims,
  applyDropClaims,
  applySeen,
  applySession,
} from "@/lib/history-ops";
import {
  postClaim,
  postClearMixup,
  postSeen,
  postSession,
  type ProgressResult,
} from "@/lib/progress-fetch";
import { useHistory } from "@/lib/use-history";
import type { FactId, HistoryFile, QuizSessionRecord } from "@/types";

/**
 * The writes a screen can perform, each one applied to the copy on screen
 * immediately and posted in the background.
 *
 * Every method returns void, and that is deliberate rather than lazy. A screen
 * that can `await` one of these will eventually be written to await it, and the
 * await is the bug this module exists to delete. The promise is not something a
 * caller should be able to get hold of.
 */
export interface HistoryWrites {
  /** "I already know these." */
  claim(facts: FactId[]): void;
  /** "Actually, I don't." */
  unclaim(facts: FactId[]): void;
  /** "Quiz me on these" — the seen record every track writes before a drill. */
  markSeen(facts: FactId[]): void;
  /** A finished round. */
  recordSession(record: QuizSessionRecord): void;
  /** Retire an open confusion after a clean quiz. */
  clearMixup(key: string): void;
}

export function useHistoryWrites(): HistoryWrites {
  const { apply, refresh } = useHistory();

  // A write that the server refused never happened, so the optimistic apply
  // holding it has to be dropped. Asking for the history again is how: whatever
  // comes back is the truth, including the case where a DIFFERENT write of ours
  // succeeded in between.
  //
  // `settle` (from apply) takes this write out of the pending overlay. It runs
  // once the write actually resolves one way or the other:
  //   - ok      → the server holds the write now, so later reads carry it and
  //               the overlay is no longer needed to protect it;
  //   - refused → drop it from the overlay FIRST, then refresh(): the refresh
  //               reads the plain server truth (without the refused op folded
  //               back on) and reverts the change.
  // `status === 0` is neither: it is resolveProgressWrite's signal that the
  // request never completed (offline, a thrown mid-refresh retry — see the
  // SAK-242 note above), not that the server refused it. Refreshing on one of
  // those would discard a change that has every chance of still landing, so
  // this branch does the thing the original comment here described but the
  // code never actually did: it leaves the overlay alone and tries again once
  // the browser says the network is back, for as long as that keeps
  // happening. `send` must build a fresh request each call — the same
  // contract WriteDeps.send documents in progress-write.ts — which is why this
  // takes a thunk rather than an already-started promise.
  const reconcile = useCallback(
    (send: () => Promise<ProgressResult>, settle: () => void) => {
      void runReconcile({
        send,
        settle,
        refresh: () => void refresh(),
        waitForOnline: () =>
          new Promise<void>((resolve) => {
            window.addEventListener("online", () => resolve(), {
              once: true,
            });
          }),
        onWaiting: notePendingHistoryWrite,
        onSettled: clearPendingHistoryWrite,
      });
    },
    [refresh],
  );

  return useMemo<HistoryWrites>(() => {
    // One timestamp per write, taken here and handed to BOTH the local apply and
    // the post. Calling Date.now() twice would let the copy on screen and the
    // copy on the server disagree about when you said it, and the revalidation
    // would then "correct" the screen to a different number for no reason.
    const now = () => Date.now();
    return {
      claim(facts) {
        const at = now();
        const settle = apply((h: HistoryFile) => applyClaims(h, facts, at));
        reconcile(() => postClaim(facts, true), settle);
      },
      unclaim(facts) {
        const settle = apply((h: HistoryFile) => applyDropClaims(h, facts));
        reconcile(() => postClaim(facts, false), settle);
      },
      markSeen(facts) {
        const at = now();
        const settle = apply((h: HistoryFile) => applySeen(h, facts, at));
        reconcile(() => postSeen(facts), settle);
      },
      recordSession(record) {
        const settle = apply((h: HistoryFile) => applySession(h, record));
        reconcile(() => postSession(record), settle);
      },
      clearMixup(key) {
        const at = now();
        const settle = apply((h: HistoryFile) => applyClearMixup(h, key, at));
        reconcile(() => postClearMixup(key, at), settle);
      },
    };
  }, [apply, reconcile]);
}
