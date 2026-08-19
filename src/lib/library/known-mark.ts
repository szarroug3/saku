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

import { knownFactsOf } from "@/lib/library/library-index";
import type { LibEntry } from "@/lib/library/entries";
import { entryIsKnown, entryStanding } from "@/lib/library/standing";
import type { Claims } from "@/lib/claims";
import type { FactAggregate, FactId } from "@/types";

export function isEntryKnownForDisplay(
  entry: LibEntry,
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
): boolean {
  return entryIsKnown(entryStanding(knownFactsOf(entry), facts, claims, now));
}
