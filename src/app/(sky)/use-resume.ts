"use client";

// What was left part way through, as a page reads it, and the one Continue
// button's offer with the forget behind its X (SAK-404, SAK-444, SAK-492).
//
// Three pages read the place the same way: this browser's copy, kept live,
// with the account's standing in when the browser holds none (a learner who
// left off on another machine), and nothing at all for the pretend learner,
// who keeps nothing. Two of them (the Planetarium and the Observatory) then
// offer the newest thing kept, beside their heading, on the same button with
// the same X. Each used to do this for itself, and only one of them had got
// as far as the X (Sam, 2026-09-27: "all continue lesson buttons should use
// the same component so they look the same. Right now, only one of them
// shows the x button"). So the reading and the offer are here, once.

import { useState } from "react";

import type { Resume } from "@/sky/components/quiz-resume";
import { newestPlace, NO_PLACE, placeToUse, type PlaceEntry, type SavedPlace } from "@/sky/lib/place";

import { placeHref } from "./hrefs";
import { forgetPlace, useSavedPlace } from "./quiz-run-store";
import { useRefreshed } from "./use-refresh";

/** The place this page reads, kept live. For a page that offers it and never
 * writes one; a page that writes its own reads it once instead
 * (`usePlaceAtOpen`). */
export function usePlace(sample: boolean, accountPlace: SavedPlace = NO_PLACE): SavedPlace {
  const local = useSavedPlace();
  return sample ? NO_PLACE : placeToUse(local, accountPlace);
}

/** One thing, by when it was left: what tells a forgotten offer from the next
 * one kept in its place. */
const keyOf = (entry: PlaceEntry) => `${entry.kind}:${entry.kind === "quiz" ? entry.run.leftAt : entry.lesson.leftAt}`;

/**
 * The newest thing left part way through, offered back, or nothing.
 *
 * The forget clears the place and takes back what a lesson marked
 * (`forgetPlace`), then reads the route again so a signed-in page gets the
 * account's copy without it. The offer goes the moment the forget is
 * confirmed rather than coming back for the length of that round trip, since
 * a signed-in learner's offer can be the account's copy, and that copy is the
 * route's until the refresh brings the new one. Only THAT offer is held back:
 * a lesson started afterwards is offered as soon as it is kept.
 */
export function useResume(sample: boolean, signedIn: boolean, accountPlace?: SavedPlace): Resume | undefined {
  const forget = useRefreshed(forgetPlace);
  const place = usePlace(sample, accountPlace);
  const [forgotten, setForgotten] = useState<string | null>(null);
  const entry = newestPlace(place);
  if (!entry || keyOf(entry) === forgotten) return undefined;
  const onForget = async () => {
    setForgotten(keyOf(entry));
    await forget(entry, signedIn);
  };
  return { entry, href: placeHref(entry, sample), onForget };
}
