"use client";

// Where the learner's place is kept (SAK-404, SAK-444): the quiz left part
// way through, and the lesson left part way through, as one document.
//
// TWO COPIES, ONE OF THEM ALWAYS THE FAST ONE. The browser's copy is written
// every time, signed in or out, and it is the one a resume reads: it is
// there before this function returns, so the page never waits on a round
// trip to find out whether there is anything to come back to. For an account
// the same document also goes up to the `session` column, which is what
// survives a cleared browser or a second machine.
//
// A visitor has only the browser's copy, and that is the whole of the store
// for them, exactly as their history is (see progress-fetch.ts).
//
// ONE DOCUMENT, TWO SLOTS, AND EVERY WRITE CARRIES BOTH. The quiz writes its
// slot after every answer and the lesson writes its own after every step, so
// each write starts from the document this page load is holding and changes
// one slot of it. A write that only sent its own slot would clear the other
// one, which is exactly the bug the card was raised for, one level down.
//
// NOTHING TO MERGE ON SIGN-IN. The key is the same one both ways, so a
// visitor who signs in halfway through a run still has that run in this
// browser, resumes from it, and carries it up with their next answer. It
// deliberately does not ride `migrateLocalProgress`: that would mean picking
// a winner when the account has a place of its own, which is the between-two-
// devices question SAK-404 put out of scope.

import { useMemo, useSyncExternalStore } from "react";

import { placeDoc, readPlace, type SavedLesson, type SavedPlace } from "@/sky/lib/place";
import type { SavedRun } from "@/sky/lib/quiz-run";

import { savePlace } from "./actions";
import { readStored, useStored, writeStored } from "./stored";

/** The browser's copy. A live key: it is in the note at the top of
 * storage-sweep.ts, not in its list of dead ones. The name is SAK-404's,
 * kept because the document under it migrates itself (`readPlace`) and
 * renaming the key would throw away every run left open on the day this
 * shipped. */
const QUIZ_RUN_KEY = "sky:quiz:run";

/**
 * What this page load found when it first looked, kept here rather than read
 * again.
 *
 * The quiz page is the writer as well as the reader, and the deck it deals is
 * worked out from what it found. A live value would change after every
 * answer: the deck would be re-dealt under whoever is answering it, and the
 * screen would drop back to "Reading your sky…" the moment the first answer
 * landed. So the answer to "what was left here" is settled once, and the
 * writers below move it on when they write -- which is what a later screen in
 * the same page load would find anyway.
 */
let opened: { place: SavedPlace } | null = null;

function placeAtOpen(): SavedPlace {
  if (!opened) opened = { place: readPlace(readStored<unknown>(QUIZ_RUN_KEY, null)) };
  return opened.place;
}

/** Whether there is a browser to ask yet: false through the server render and
 * the one that hydrates it, true from then on. No subscription, because this
 * never changes back. */
const noSubscription = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * The place this browser was holding when the page opened, or `undefined`
 * until the browser has been asked, which is the server render and the one
 * that hydrates it: a page that deals a deck off this waits for the answer
 * rather than dealing one and swapping it.
 *
 * The pages that only OFFER a place and never write one -- the Planetarium,
 * the Observatory, Sessions -- want the live value instead, and
 * `useSavedPlace` below is theirs.
 */
export function usePlaceAtOpen(): SavedPlace | undefined {
  const hydrated = useSyncExternalStore(noSubscription, onClient, onServer);
  return hydrated ? placeAtOpen() : undefined;
}

/** The place this browser is holding, kept up to date. For a page that offers
 * it and never writes it. Empty on the server, and on the render that
 * hydrates it, the way every stored value is here. */
export function useSavedPlace(): SavedPlace {
  const raw = useStored<unknown>(QUIZ_RUN_KEY, null);
  return useMemo(() => readPlace(raw), [raw]);
}

/**
 * The column's writes, one at a time and in the order they were made.
 *
 * The write is fired and not waited for, so answering a card never waits on
 * the network; but the column keeps the LAST document written, and two
 * overlapping server actions can land either way round. A chain is enough:
 * each write waits on the one before it, so answer four's run can never be
 * overwritten by answer three's. A failure is dropped rather than retried --
 * the browser's copy is the one a resume reads, and the next answer writes
 * the column again a second later.
 */
let queue: Promise<unknown> = Promise.resolve();

/** What this page load has already written, so it does not write it twice,
 * and null while it has written nothing at all. */
let last: string | null = null;

/** Write the place, browser first and the account behind it. */
function keep(place: SavedPlace, signedIn: boolean): void {
  const doc = placeDoc(place);
  const next = doc ? JSON.stringify(doc) : "";
  if (next === last) return;
  last = next;
  opened = { place };
  writeStored(QUIZ_RUN_KEY, doc);
  if (!signedIn) return;
  queue = queue.then(() => savePlace(place)).catch(() => undefined);
}

/** Keep the quiz, or clear it with null. The lesson slot is left as it is.
 * For the two moments that MEAN it: a run finished, and a run forgotten from
 * Sessions. What a quiz screen says about itself as it goes is `reportRun`. */
export function keepRun(run: SavedRun | null, signedIn: boolean): void {
  keep({ ...placeAtOpen(), quiz: run }, signedIn);
}

/**
 * Where a quiz screen stands, said after every answer.
 *
 * AND A WRITE THAT WOULD SAY THE SAME THING TWICE IS NOT MADE. `SkyQuiz`
 * reports where it stands the moment it mounts, and on a deck nobody has
 * answered yet that is nothing to keep. Without the guard, opening the quiz
 * would clear the column on every visit, and, worse, would throw away the
 * quiz the learner had not yet decided to replace, in the window between
 * arriving on a different deck and answering its first card. Starting a
 * different run replaces the old one when its first answer lands, which is
 * the moment there is something to replace it with.
 */
export function reportRun(run: SavedRun | null, signedIn: boolean): void {
  if (!run && last === null) return;
  keepRun(run, signedIn);
}

/** Keep the lesson, or clear it with null. The quiz slot is left as it is.
 *
 * No guard of its own, and it needs none: the lesson reports itself only
 * when the learner steps, never on the way in, so it has nothing to say
 * about a lesson nobody has walked. Clearing it means the drill was opened,
 * and that has to land even when this page load has written nothing yet
 * (a lesson resumed on its last step, drilled without a step). */
export function keepLesson(lesson: SavedLesson | null, signedIn: boolean): void {
  keep({ ...placeAtOpen(), lesson }, signedIn);
}
