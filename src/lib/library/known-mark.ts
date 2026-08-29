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
// call the guarded `knownFactsOf` itself. `isKnownForDisplay` (here) is the
// back half of the chain (`entryStanding` → `entryIsKnown`) for exactly that
// caller. The front-to-back version that calls the guarded `knownFactsOf`
// itself — for a caller starting from a bare LibEntry instead of a
// pre-fetched `knownFacts` — lives in known-mark-guarded.ts instead of here:
// SAK-226 found that keeping both in one file meant importing EITHER one
// pulled in library-index.ts's ~9.5MB dictionary, since a module's static
// imports are bundled whether or not the importing code path actually calls
// the function that needs them. library-page.tsx (this file's one production
// caller) only ever needs the resolved-input half below.

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
