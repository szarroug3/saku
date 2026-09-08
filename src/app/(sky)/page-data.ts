// Who a Sky page is for, and what it can render before the browser answers
// (SAK-368). Eight route files worked this out for themselves, in the same
// four lines, and a ninth page would have been a ninth copy.
//
// The rule the four lines encode: `?sample` is the pretend learner and reads
// nothing of anyone's, so it never asks who is signed in; a signed-in learner
// is read here, on the server, and the page arrives with its data; a
// signed-out visitor's history is in their browser, which the server cannot
// see, so the page arrives with nothing and the client loads it (see
// local.tsx).

import { currentUserId } from "@/lib/auth";

import type { Who } from "./who";

/** A route's query, as Next hands it over. */
type SkyParams = Record<string, string | string[] | undefined>;

/** Whose history this page reads.
 *
 * `pretend` is for a page showing a made-up learner that is not the sample:
 * the lesson's `?showcase`, one of everything on an empty history. Like the
 * sample it asks nobody's account, and like a signed-in page it has its data
 * already, so it says signed in and the client never loads anything. */
export async function whoFor(params: SkyParams, pretend = false): Promise<{ sample: boolean; signedIn: boolean; who: Who | null }> {
  const sample = params.sample !== undefined;
  const userId = sample || pretend ? null : await currentUserId();
  return { sample, signedIn: pretend || userId !== null, who: sample ? { sample: true } : userId ? {} : null };
}

/** The data the route renders with, or null when the browser holds it. */
export async function initialFor<T>(who: Who | null, load: (who: Who) => Promise<T>): Promise<T | null> {
  return who ? await load(who) : null;
}
