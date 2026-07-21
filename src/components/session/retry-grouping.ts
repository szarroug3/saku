// The retry picker's shape, as data — pure so the ordering rule and the
// misses-are-pre-selected rule can be tested without mounting the screen.
//
// The picker on round-complete groups the round's facts by STANDING (the same
// adjective the Progress and Library screens wear — see standing.ts) and shows
// them worst-first, with the facts you MISSED already ticked. Both of those are
// small rules with an easy way to get them subtly wrong (an order that drifts
// from the labels, a pre-selection that includes an unanswered fact), so they
// live here as functions rather than inline in the component's JSX.

import type { Standing } from "@/lib/library/standing";
import type { FactId } from "@/types";

/** Worst-first, and it is the SAME order the rest of the app ranks these in:
 * the two the model is unsure of and getting wrong (`shaky`) or losing
 * (`slipping`) come before the ones it is unsure of but you are mostly right on
 * (`getting-there`), then the settled ones (`solid`), then the two that carry
 * no test behind them — what you asserted (`claimed`) and what you have never
 * been asked (`not-seen`, shown as "not seen"). A fact you want to retry is
 * almost always near the top, so the top is where the list starts. */
export const RETRY_STANDING_ORDER: readonly Standing[] = [
  "shaky",
  "slipping",
  "getting-there",
  "solid",
  "claimed",
  "not-seen",
];

export interface StandingGroup {
  readonly standing: Standing;
  readonly facts: readonly FactId[];
}

/**
 * Group `facts` under their standing, in RETRY_STANDING_ORDER, dropping empty
 * bands. Within a band the caller's order is kept — `facts` arrives already
 * ordered (the full drill, most-missed-first for the misses), and this must not
 * reshuffle it, only bucket it.
 *
 * `standingOf` is passed in rather than computed here so the module stays pure
 * (no history, no clock): the component builds it from `standingFor` + the
 * live history, and the test hands over a plain lookup.
 */
export function groupByStanding(
  facts: readonly FactId[],
  standingOf: (fact: FactId) => Standing,
): StandingGroup[] {
  const buckets = new Map<Standing, FactId[]>();
  for (const f of facts) {
    const s = standingOf(f);
    const b = buckets.get(s);
    if (b) b.push(f);
    else buckets.set(s, [f]);
  }
  const out: StandingGroup[] = [];
  for (const standing of RETRY_STANDING_ORDER) {
    const bucket = buckets.get(standing);
    if (bucket && bucket.length) out.push({ standing, facts: bucket });
  }
  return out;
}

/**
 * The picker opens with your OUTSTANDING misses already ticked. This turns
 * that list into the `picked` record the toggles read — nothing more is
 * checked, so opening the picker and pressing "Retry N" re-asks exactly what
 * is still open, and every other fact is one tap away.
 *
 * It used to be handed the round's whole miss list, recovered ones included,
 * which is why a clean retry came back offering the same retry.
 */
export function initialPicked(
  outstanding: readonly FactId[],
): Record<string, boolean> {
  const picked: Record<string, boolean> = {};
  for (const f of outstanding) picked[f] = true;
  return picked;
}

/**
 * The line above the picker, in the four states the round can be in.
 *
 * A function, and here rather than in the JSX, because it is the only place
 * the screen ACKNOWLEDGES a retry — the sentence a tester went looking for and
 * did not find. Pure and in a `.ts`, so all four states are pinned by test
 * rather than by reading the component.
 *
 * The two counts are misses, split by whether they are still true: `back` were
 * missed this round and landed clean on a later leg, `open` were not. The
 * round's history is not edited by either (see roundCompleteView) — this line
 * only ever describes what is left to do, and says what the retry earned.
 */
export function retryHint(open: number, back: number): string {
  const them = back === 1 ? "it" : "all " + back;
  if (open && back) {
    return `You got ${them} back. The other ${open} ${
      open === 1 ? "is" : "are"
    } picked.`;
  }
  if (back) {
    return `You got ${them} back. Nothing left over, but pick anything you want another look at.`;
  }
  if (open) {
    return `Your ${open} miss${open === 1 ? "" : "es"} ${
      open === 1 ? "is" : "are"
    } picked. Add or drop anything.`;
  }
  return "Nothing missed. Pick anything you want another look at.";
}
