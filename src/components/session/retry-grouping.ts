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
 * The picker opens with your misses already ticked. This turns the round's
 * miss list into the `picked` record the toggles read — nothing more is
 * checked, so opening the picker and pressing "Retry N" re-asks exactly the
 * misses, and every other fact is one tap away.
 */
export function initialPicked(misses: readonly FactId[]): Record<string, boolean> {
  const picked: Record<string, boolean> = {};
  for (const f of misses) picked[f] = true;
  return picked;
}
