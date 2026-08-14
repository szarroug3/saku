// resolveItem — the corpus lookup the scheduler reaches an item through.
//
// The NextLesson contract takes a `resolve(entry)` so it can follow a
// prerequisite edge to the item it points at, in ANY track. That map is built by
// iterating a corpus whose kind is known at construction — a LOOKUP, never a
// parse of the id grammar (fact-id.ts forbids parsing, and it couldn't work
// anyway: kanji:三 and word:三 share the glyph, so an entry alone can't say its
// kind).
//
// Every prereq edge `directPrereqs` (build-item.ts) emits is a KANJI, so a
// kanji-corpus resolver is the whole resolve the number/counter pilot needs. As
// word/kana tracks migrate they extend this same map with their own kinds.

import { KANJI } from "@/data/kanji";
import { RADICALS } from "@/data/radicals";
import { buildGlyphItem } from "./build-item";
import type { ContentItem } from "./item";
import type { EntryId } from "@/types";

let corpusIndex: Map<EntryId, ContentItem> | null = null;

/** Every jōyō kanji AND every radical as a cohesive `character` ContentItem,
 * indexed by canonical entry. A teaching prerequisite points at a component —
 * kanji (何 ← 人, 可) OR radical (私 ← 禾, 厶) — so both must resolve or a radical
 * component is silently dropped from the chain. Built once, lazily (the same
 * build-once-index library/entries.ts uses), deferred so a route that never
 * schedules doesn't pay for it. Kanji win a glyph that is both (precedence in
 * canonicalEntry), so the radical pass never overwrites a kanji entry. */
function corpus(): Map<EntryId, ContentItem> {
  if (corpusIndex) return corpusIndex;
  const m = new Map<EntryId, ContentItem>();
  for (const row of KANJI) {
    const item = buildGlyphItem(row.c);
    if (item) m.set(item.entry, item);
  }
  for (const row of RADICALS) {
    const item = buildGlyphItem(row.glyph);
    if (item && !m.has(item.entry)) m.set(item.entry, item);
  }
  corpusIndex = m;
  return m;
}

/** Resolve an entry the scheduler may need to reach — a kanji or radical
 * component a teaching prerequisite points at. Undefined for anything not in the
 * corpus (a blocking prerequisite on a word is checked by its facts, not here). */
export function resolveItem(entry: EntryId): ContentItem | undefined {
  return corpus().get(entry);
}

/** Every entry `resolveItem` can resolve — the corpus keys. The /learn index
 * build serializes a resolve node for each so the precomputed frontier can pull a
 * prereq's primary unit without the dictionary. A superset of the entries any
 * `item.prereqs` names, which is what matters: nothing a chain can reach is left
 * unresolvable. */
export function resolvableEntries(): EntryId[] {
  return [...corpus().keys()];
}
