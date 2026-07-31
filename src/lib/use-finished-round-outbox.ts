"use client";

// The FINISHED-ROUND OUTBOX — one of the three persistence channels the quiz
// session runs, lifted out of quiz-session.tsx because it is the one that stands
// alone. Unlike the localStorage snapshot and the in-progress server sync, this
// channel never reads the live session state, never touches the state setters,
// and takes no part in the cross-tab write-storm guards: it operates entirely on
// the durable pending queue and the records handed to `commitRecord`. That
// independence is exactly why it extracts cleanly, and keeping it in its own file
// keeps the provider's tangled snapshot/sync machinery from sitting next to code
// that has nothing to do with it.
//
// A finished round is made durable HERE: written to the outbox first, then
// posted. Until the post lands (a 2xx, or a signed-out 401 that folds the round
// into this browser's local history), the record stays queued and is retried on
// mount and whenever the network comes back.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  acknowledgePending,
  enqueuePending,
  readPending,
} from "@/lib/pending-records";
import { postSession } from "@/lib/progress-fetch";
import type { QuizSessionRecord } from "@/types";

export interface FinishedRoundOutbox {
  /** Set when a finished round could not be saved yet — the banner's copy. Null
   * when the queue is clean. */
  saveError: string | null;
  /** The banner's button: run the same flush every automatic retry runs. */
  retrySave: () => void;
  /** Make a finished round durable — queue it, then try to send. */
  commitRecord: (record: QuizSessionRecord | null) => void;
}

export function useFinishedRoundOutbox(): FinishedRoundOutbox {
  /** Set when the outbox cannot drain and cleared when it does. It is a single
   * state, not one message per record, so a queue that fails and got published to
   * localStorage does not fan out into a new banner per stuck round. */
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Post everything in the outbox, oldest first, and stop at the first refusal.
   *
   * IN ORDER, AND STOPPING. The aggregate fold is order-dependent (see
   * aggregate.ts), so records must reach the server in the order they were
   * made. Skipping a stuck one to post a later one would land them out of
   * order; posting them in parallel would too.
   *
   * A record leaves the queue when it is durably saved SOMEWHERE — a 2xx (the
   * server has it) or a signed-out 401 that lands it in this browser's local
   * history (see postSession). It stays on everything else: a 503 (history.json
   * is unreadable) keeps it, a network failure keeps it, a closed tab keeps it.
   * That is the whole difference from the `.catch(() => {})` this replaced,
   * where every one of those threw the record away.
   *
   * `flushingRef` makes it single-flight: mount, "back online", and a freshly
   * committed round can all fire this within a tick of each other, and two
   * concurrent flushes would post the same record twice. That is survivable —
   * the server deduplicates on the record's id — but it is noise, and the
   * ordering guarantee above would be gone.
   */
  const flushingRef = useRef(false);
  const flushPending = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      let list = readPending(window.localStorage);
      while (list.length) {
        const record = list[0];
        // postSession folds in the signed-out case: a 401 means there is no
        // account to POST to, so the round is written to THIS browser's local
        // history and reported ok — which is correct, because it IS durably
        // saved now (in localStorage), and a record that will 401 forever must
        // not spin in the outbox. A 503 (unreadable file) or a network failure
        // still comes back not-ok and keeps the record queued, exactly as before.
        const { ok } = await postSession(record);
        if (!ok) {
          setSaveError(
            "Some of your finished rounds have not been saved yet. They are " +
              "kept on this device and will be retried.",
          );
          return;
        }
        const next = acknowledgePending(window.localStorage, record.id);
        // A record with no id cannot be acknowledged and would spin here
        // forever. Nothing this app writes lacks one (buildSessionRecord always
        // mints it), so this is a guard against a future writer, not a case.
        if (next.length >= list.length) return;
        list = next;
      }
      setSaveError(null);
    } finally {
      flushingRef.current = false;
    }
  }, []);

  /** The banner's button. The same path as every automatic retry — there is no
   * second, manual code path that could behave differently from the one the app
   * is already using on your behalf. */
  const retrySave = useCallback(() => void flushPending(), [flushPending]);

  /**
   * Make a piece of work durable: put it in the outbox FIRST, then try to send.
   *
   * The order is the point. Until this returns, the only copy of a finished
   * round is in React state, which a closed tab takes with it. Once the record
   * is in localStorage it survives a reload, a crash and a week offline, and
   * the POST becomes an optimisation rather than the mechanism.
   */
  const commitRecord = useCallback(
    (record: QuizSessionRecord | null) => {
      if (!record) return;
      if (enqueuePending(window.localStorage, record) === null) {
        // Storage refused it. This is the one failure with nowhere to fall back
        // to, so it is the one that has to be said loudest.
        setSaveError(
          "This device would not store your finished round, so it may be lost. " +
            "Free up browser storage and finish the session again.",
        );
        return;
      }
      void flushPending();
    },
    [flushPending],
  );

  // Retry on mount (a queue left by a previous visit) and whenever the browser
  // says the network is back. Neither writes provider state unless the outcome
  // changed, so neither can feed the save loop — see the storm note on saveNow.
  useEffect(() => {
    void flushPending();
    const onOnline = () => void flushPending();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushPending]);

  return { saveError, retrySave, commitRecord };
}
