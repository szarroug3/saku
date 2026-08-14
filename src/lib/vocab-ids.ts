// Pure vocab ENTRY/FACT id builders — string construction only, no dictionary
// lookup. Split out of data/vocab.ts because that module's top-level `VOCAB`
// array (and the JSON it's built from) gets pulled into any bundle that imports
// ANYTHING from the file, even a caller that only wants to build an id. This is
// the same barrel-avoidance split as fact-counts.ts/entry-summary.ts.

import { entryId, factId } from "@/lib/fact-id";
import type { EntryId, FactId } from "@/types";

export const VOCAB_SUBJECT = "word";

export function wordEntry(keb: string): EntryId {
  return entryId(VOCAB_SUBJECT, keb);
}

export function wordMeaningFactId(keb: string): FactId {
  return factId(wordEntry(keb), "meaning");
}
