"use client";

// Where a quiz run left part way through is kept (SAK-404).
//
// TWO COPIES, ONE OF THEM ALWAYS THE FAST ONE. The browser's copy is written
// every time, signed in or out, and it is the one a resume reads: it is
// there before this function returns, so the page never waits on a round
// trip to find out whether there is a run. For an account the same run also
// goes up to the `session` column, which is what survives a cleared browser
// or a second machine.
//
// A visitor has only the browser's copy, and that is the whole of the store
// for them, exactly as their history is (see progress-fetch.ts).
//
// NOTHING TO MERGE ON SIGN-IN. The key is the same one both ways, so a
// visitor who signs in halfway through a run still has that run in this
// browser, resumes from it, and carries it up with their next answer. It
// deliberately does not ride `migrateLocalProgress`: that would mean picking
// a winner when the account has a run of its own, which is the between-two-
// devices question SAK-404 puts out of scope.

import { useMemo, useSyncExternalStore } from "react";

import { readRun, type SavedRun } from "@/sky/lib/quiz-run";

import { saveQuizRun } from "./actions";
import { readStored, useStored, writeStored } from "./stored";

/** The browser's copy. A live key: it is in the note at the top of
 * storage-sweep.ts, not in its list of dead ones. */
export const QUIZ_RUN_KEY = "sky:quiz:run";

/**
 * What this page load found when it first looked, kept here rather than read
 * again.
 *
 * The quiz page is the writer as well as the reader, and the deck it deals is
 * worked out from what it found. A live value would change after every
 * answer: the deck would be re-dealt under whoever is answering it, and the
 * screen would drop back to "Reading your sky…" the moment the first answer
 * landed. So the answer to "was there a run" is settled once, and `keepRun`
 * below moves it on when it writes -- which is what a later screen in the
 * same page load would find anyway.
 */
let opened: { run: SavedRun | null } | null = null;

function runAtOpen(): SavedRun | null {
  if (!opened) opened = { run: readRun(readStored<unknown>(QUIZ_RUN_KEY, null)) };
  return opened.run;
}

/** Whether there is a browser to ask yet: false through the server render and
 * the one that hydrates it, true from then on. No subscription, because this
 * never changes back. */
const noSubscription = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * The run this browser was holding when the page opened, or null when there
 * was none. `undefined` until the browser has been asked, which is the server
 * render and the one that hydrates it: a page that deals a deck off this waits
 * for the answer rather than dealing one and swapping it.
 *
 * The pages that only OFFER a run and never write one -- the Planetarium, the
 * Observatory -- want the live value instead, and `useSavedRun` below is
 * theirs.
 */
export function useRunAtOpen(): SavedRun | null | undefined {
  const hydrated = useSyncExternalStore(noSubscription, onClient, onServer);
  return hydrated ? runAtOpen() : undefined;
}

/** The run this browser is holding, kept up to date. For a page that offers
 * it and never writes it. Null on the server, and on the render that
 * hydrates it, the way every stored value is here. */
export function useSavedRun(): SavedRun | null {
  const raw = useStored<unknown>(QUIZ_RUN_KEY, null);
  return useMemo(() => readRun(raw), [raw]);
}

/**
 * The column's writes, one at a time and in the order they were made.
 *
 * The write is fired and not waited for, so answering a card never waits on
 * the network; but the column keeps the LAST run written, and two overlapping
 * server actions can land either way round. A chain is enough: each write
 * waits on the one before it, so answer four's run can never be overwritten
 * by answer three's. A failure is dropped rather than retried -- the browser's
 * copy is the one a resume reads, and the next answer writes the column again
 * a second later.
 */
let queue: Promise<unknown> = Promise.resolve();

/**
 * What this page load has already written, so it does not write it twice.
 *
 * It starts as "no run", which is the useful part: a quiz screen reports
 * where it stands the moment it mounts, and on a deck nobody has answered yet
 * that is nothing to keep. Without this, opening the quiz would clear the
 * column -- a round trip on every visit -- and would throw away a run the
 * learner has not yet decided to replace. Starting a different run replaces
 * the old one when its first answer lands, which is the moment there is
 * something to replace it WITH.
 */
let last = "";

/** Keep the run, or clear it with null. */
export function keepRun(run: SavedRun | null, signedIn: boolean): void {
  const next = run ? JSON.stringify(run) : "";
  if (next === last) return;
  last = next;
  opened = { run };
  writeStored(QUIZ_RUN_KEY, run);
  if (!signedIn) return;
  queue = queue.then(() => saveQuizRun(run)).catch(() => undefined);
}
