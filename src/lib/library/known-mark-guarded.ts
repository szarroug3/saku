// The front-to-back half of known-mark.ts's "known" chain — split out under
// SAK-226 so that file (library-page.tsx's production caller) never bundles
// the guarded dictionary. See known-mark.ts's own header for the full split
// rationale. This file exists for a caller starting from a bare LibEntry
// (SAK-63's grid mark, or any future one) rather than a pre-fetched
// `knownFacts` — today, that's only known-mark.test.ts's own parity check
// against `isKnownForDisplay`. Import this file only from a context that
// doesn't ship to the client (a test, a Server Component, a Server Action).

import { knownFactsOf } from "@/lib/library/library-index";
import type { LibEntry } from "@/lib/library/entries";
import { isKnownForDisplay } from "@/lib/library/known-mark";
import type { Claims } from "@/lib/claims";
import type { FactAggregate, FactId } from "@/types";

/** The full chain, for a caller starting from a bare LibEntry rather than a
 * pre-fetched `knownFacts`. */
export function isEntryKnownForDisplay(
  entry: LibEntry,
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
): boolean {
  return isKnownForDisplay(knownFactsOf(entry), facts, claims, now);
}
