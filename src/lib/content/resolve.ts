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
import { buildGlyphItem } from "./build-item";
import type { ContentItem } from "./item";
import type { EntryId } from "@/types";

let kanjiIndex: Map<EntryId, ContentItem> | null = null;

/** Every jōyō kanji as a cohesive `character` ContentItem, indexed by canonical
 * entry. Built once, lazily — the same build-once-index shape library/entries.ts
 * uses, but deferred so a route that never schedules a lesson doesn't pay for it. */
function kanjiCorpus(): Map<EntryId, ContentItem> {
  if (kanjiIndex) return kanjiIndex;
  const m = new Map<EntryId, ContentItem>();
  for (const row of KANJI) {
    const item = buildGlyphItem(row.c);
    if (item) m.set(item.entry, item);
  }
  kanjiIndex = m;
  return m;
}

/** Resolve an entry the scheduler may need to reach — today, any kanji (every
 * prerequisite is one). Undefined for anything not yet in the corpus. */
export function resolveItem(entry: EntryId): ContentItem | undefined {
  return kanjiCorpus().get(entry);
}
