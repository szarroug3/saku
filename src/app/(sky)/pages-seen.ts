"use client";

// Which reference pages a lesson has already put in front of this learner
// (SAK-467).
//
// A lesson's References panel lists every page tonight's order rests on,
// whether or not it has been read (see walkFor in lesson.ts). What this
// answers is the other half: which of those pages the learner has never been
// shown, so a fresh lesson can open on the first of them instead of on step
// one. A page counts from the moment a lesson holding it opens, clicked or
// not, because the panel is beside the sky the whole time and a lesson that
// opened on it has done its part.
//
// WHERE IT IS KEPT. The settings blob, which is this browser's localStorage
// signed out and the account's `settings` column signed in -- the same store
// the old app's "intro already shown" mark used, for the same question. It is
// deliberately NOT history: history is what the learner LEARNED, it feeds the
// schedule and the standings, and a page read is neither answered nor claimed.
// The write goes local first and is pushed up behind it, exactly the way
// Practice saves a recipe (practice-client.tsx).
//
// READ ONCE PER PAGE LOAD, like the place the learner was left at
// (quiz-run-store.ts) and for the same reason: the lesson is the writer as
// well as the reader, and it marks its own pages seen the moment it opens. A
// live read would take the lesson's opening page out from under it.

import { useSyncExternalStore } from "react";

import { PAGES_SEEN_KEY } from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";

import { readStored, writeStored } from "./stored";

/** What this page load found when it first looked. */
let opened: ReadonlySet<string> | null = null;

function seenAtOpen(): ReadonlySet<string> {
  if (!opened) {
    const raw = readStored<unknown>(PAGES_SEEN_KEY, null);
    opened = new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : []);
  }
  return opened;
}

/** Whether there is a browser to ask yet: false through the server render and
 * the one that hydrates it, true from then on. The twin of the one in
 * quiz-run-store.ts, and it never changes back either. */
const noSubscription = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** The pages this browser had been shown when the page opened, or undefined
 * while there is no browser to ask: the server render and the one that
 * hydrates it. A lesson that opens on one of these waits for the answer
 * rather than opening on step one and jumping to a page a moment later. */
export function usePagesSeenAtOpen(): ReadonlySet<string> | undefined {
  const hydrated = useSyncExternalStore(noSubscription, onClient, onServer);
  return hydrated ? seenAtOpen() : undefined;
}

/** Mark reference pages shown. Idempotent: a page already in the list is not
 * written again, so a lesson reopened writes nothing at all. */
export function seePages(ids: readonly string[]): void {
  const held = seenAtOpen();
  const added = ids.filter((id) => !held.has(id));
  if (!added.length) return;
  const next = [...held, ...added];
  opened = new Set(next);
  writeStored(PAGES_SEEN_KEY, next);
  pushSettings({ pagesSeen: next });
}
