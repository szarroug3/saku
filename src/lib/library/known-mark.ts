// Whether the Library should mark an entry as already known — for the
// Known/Not-known FILTER (library-page.tsx's `keep`) and now for the tile/row
// MARK painted directly in the grid (SAK-63). One function, two callers, so
// they can never quietly disagree about what "known" means.
//
// NOT A NEW DEFINITION OF "KNOWN". This is exactly the chain the filter has
// always run — `knownFactsOf` (library-index.ts, which facts a kind's
// standing pools) into `entryStanding` into `entryIsKnown` (standing.ts, the
// one bar: "every fact solid or claimed, over a real population") — pulled
// into its own function so a second call site (the grid mark) reuses it
// instead of re-deriving it.
//
// TWO ENTRY POINTS, ONE CHAIN. SAK-104 moved `knownFactsOf` (and the
// ~9.5MB dictionary it reads) server-only — library-page.tsx now receives an
// entry's `knownFacts` already resolved, from a Server Action, and must never
// call the guarded `knownFactsOf` itself. `isKnownForDisplay` is the back half
// of the chain (`entryStanding` → `entryIsKnown`) for exactly that caller;
// `isEntryKnownForDisplay` stays the front-to-back version, for any caller
// that only has the LibEntry itself and needs `knownFactsOf` run for it. Both
// share the one back half, so a filter reading pre-fetched facts and a caller
// starting from a bare entry can never quietly disagree about what "known"
// means.

import { knownFactsOf } from "@/lib/library/library-index";
import type { LibEntry } from "@/lib/library/entries";
import { entryIsKnown, entryStanding } from "@/lib/library/standing";
import type { Claims } from "@/lib/claims";
import type { FactAggregate, FactId } from "@/types";

/** The back half of the chain, for a caller that already has the entry's
 * known facts resolved (library-page.tsx's `keep`, reading a Server Action's
 * `entry.knownFacts` — see this file's header). */
export function isKnownForDisplay(
  knownFacts: readonly FactId[],
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
): boolean {
  return entryIsKnown(entryStanding(knownFacts, facts, claims, now));
}

/** The full chain, for a caller starting from a bare LibEntry (SAK-63's grid
 * mark, or any future one) rather than a pre-fetched `knownFacts`. */
export function isEntryKnownForDisplay(
  entry: LibEntry,
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
): boolean {
  return isKnownForDisplay(knownFactsOf(entry), facts, claims, now);
}
