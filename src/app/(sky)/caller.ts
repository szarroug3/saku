// What the server is willing to believe about who is asking (SAK-445).
//
// A Sky page reads `?sample` off its own URL and a Sky action is handed a
// `Who` by the browser, so both of the app's doors into the pretend learner
// are opened by something the caller wrote. With the dev surfaces off, neither
// may open: a URL is a string anybody can type, and a server action's argument
// is a POST body anybody can forge, whatever the page it came from believed.
//
// So there are two checks and they are the same check. `devFlag` is the page's:
// a dev-only query key counts as present only when the switch is on. `trustedWho`
// is the action's: the caller's claim to be the pretend learner is dropped, and
// what is left is the real caller, their own browser copy or their own account.
//
// `TrustedWho` is what makes the second one hard to forget. The reads in
// actions.ts take that type and nothing else, and `trustedWho` is the only
// thing that mints it, so an action that skips the check does not compile. The
// mark is a type and never a value, so nothing crosses the wire and no caller
// can send one.

import { devSurfacesOn } from "@/lib/dev-surfaces";

import type { Who } from "./who";

declare const trustedMark: unique symbol;

/** A `Who` that has been through `trustedWho`. */
export type TrustedWho = Who & { readonly [trustedMark]: true };

/** The caller as the server will read them.
 *
 * With the dev surfaces on this is what arrived. With them off, `sample` goes:
 * the action serves whoever really called it, which is the browser's own copy
 * when one was sent and the signed-in account otherwise. Never an error and
 * never a redirect, because a forged flag should look exactly like no flag. */
export function trustedWho(who: Who): TrustedWho {
  const kept: Who = who.sample && !devSurfacesOn() ? { local: who.local } : who;
  return kept as TrustedWho;
}

/** A dev-only query key, present only when the dev surfaces are on. With them
 * off the page renders as if the key had never been typed. */
export function devFlag(params: Record<string, string | string[] | undefined>, key: string): boolean {
  return params[key] !== undefined && devSurfacesOn();
}
