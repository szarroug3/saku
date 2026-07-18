// `emptySelection` — the empty query, split out of src/lib/selection.ts.
//
// It is a pure object literal with no data dependency, but selection.ts
// top-level imports the fact registry (ALL_FACTS, entryOf, factInfo, factsOf)
// and kanji data to turn a query INTO facts. The always-mounted
// QuizConfigProvider only needs this empty-query seed, so importing it from
// selection.ts dragged the whole ~3.6 MB registry into the eager client bundle.
// selection.ts re-exports this so its own consumers are unchanged.

import type { Selection } from "@/types";

/** Everything. Every field empty means "not narrowed", so this is the query
 * that names the whole app — which is also the day-one default. */
export function emptySelection(): Selection {
  return {
    subjects: [],
    list: null,
    states: [],
    text: "",
    session: null,
  };
}
