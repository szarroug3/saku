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

import { useCallback, useMemo } from "react";

import {
  applyClaims,
  applyDropClaims,
  applySeen,
  applySession,
} from "@/lib/history-ops";
import {
  postClaim,
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
}

export function useHistoryWrites(): HistoryWrites {
  const { apply, refresh } = useHistory();

  // A write that the server refused never happened, so the optimistic apply
  // holding it has to be dropped. Asking for the history again is how: whatever
  // comes back is the truth, including the case where a DIFFERENT write of ours
  // succeeded in between.
  //
  // Only on an explicit `ok: false`. A thrown request (offline, aborted) is not
  // a refusal — postSession's outbox keeps those queued and retries them — and
  // refreshing on one would discard a change that is still going to land.
  const reconcile = useCallback(
    (write: Promise<ProgressResult>) => {
      void write.then(
        (result) => {
          if (!result.ok) void refresh();
        },
        () => {},
      );
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
        apply((h: HistoryFile) => applyClaims(h, facts, at));
        reconcile(postClaim(facts, true));
      },
      unclaim(facts) {
        apply((h: HistoryFile) => applyDropClaims(h, facts));
        reconcile(postClaim(facts, false));
      },
      markSeen(facts) {
        const at = now();
        apply((h: HistoryFile) => applySeen(h, facts, at));
        reconcile(postSeen(facts));
      },
      recordSession(record) {
        apply((h: HistoryFile) => applySession(h, record));
        reconcile(postSession(record));
      },
    };
  }, [apply, reconcile]);
}
