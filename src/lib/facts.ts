// The fact registry — every askable thing in the app, from every subject, and
// the lookups that resolve an opaque id back to something you can render.
//
// ADDING A SUBJECT
// ================
// Publish a `FactInfo[]` from the subject's own module and add it to SUBJECTS
// below. That is the whole contract. Kanji, vocabulary, grammar patterns,
// conjugation, counters and whatever comes after are all one line here plus
// their own data file; none of them is a special case anywhere downstream,
// because nothing downstream can tell them apart.
//
// WHY LOOKUP AND NOT PARSING
// ==========================
// `entryOf` is an index read, not a string split. That is the difference
// between an id that is opaque by convention and one that is opaque by
// construction: there is no exported way to learn what a fact IS from its id,
// so no call site can quietly start depending on the grammar and pin it in
// place. src/lib/fact-id.ts mints them; nothing reads them.

import { KANA_FACTS } from "@/data/characters";
import { KANJI_FACTS } from "@/data/kanji";
import { VOCAB_FACTS } from "@/data/vocab";
import type { EntryId, FactId, FactInfo } from "@/types";

/** Every subject's facts, in the order they should appear. */
const SUBJECTS: FactInfo[][] = [KANA_FACTS, KANJI_FACTS, VOCAB_FACTS];

/** Every fact in the app, in data order. */
export const ALL_FACTS: FactId[] = SUBJECTS.flat().map((f) => f.id);

const BY_FACT: Map<FactId, FactInfo> = new Map(
  SUBJECTS.flat().map((f) => [f.id, f]),
);

const BY_ENTRY: Map<EntryId, FactInfo[]> = groupByEntry();

function groupByEntry(): Map<EntryId, FactInfo[]> {
  const map = new Map<EntryId, FactInfo[]>();
  for (const f of SUBJECTS.flat()) {
    const list = map.get(f.entry);
    if (list) list.push(f);
    else map.set(f.entry, [f]);
  }
  return map;
}

/** What a fact is, or undefined when history holds an id the data no longer
 * has. Callers guard — deleting a character must not throw. */
export function factInfo(id: FactId): FactInfo | undefined {
  return BY_FACT.get(id);
}

/** The entry a fact belongs to. The one bridge between the two key spaces. */
export function entryOf(id: FactId): EntryId {
  const info = BY_FACT.get(id);
  // An id from history whose data is gone still has to answer, or every walk
  // over history needs a guard. It maps to an entry nothing else will match,
  // which is the truthful answer: this belongs to no entry we know.
  return info ? info.entry : (id as string as EntryId);
}

/** Every fact of an entry — 1 for a kana, ~11 for a kanji. Empty when unknown. */
export function factsOf(entry: EntryId): FactId[] {
  return (BY_ENTRY.get(entry) ?? []).map((f) => f.id);
}

/** Every entry in the app, in data order. */
export const ALL_ENTRIES: EntryId[] = [...BY_ENTRY.keys()];

/**
 * What an entry looks like — 「し」, 「生」. DISPLAY ONLY.
 *
 * Falls back to the raw id rather than throwing: history outlives the data it
 * was recorded against, and a stats row is better rendered ugly than not at
 * all. Reads the glyph off any one of the entry's facts — they all share it,
 * because the glyph is a property of the entry.
 */
export function glyphOf(entry: EntryId): string {
  return BY_ENTRY.get(entry)?.[0]?.glyph ?? entry;
}

/** An entry's canonical answer, for "you answered "shi"". Uses the entry's
 * FIRST fact, which is only unambiguous while an entry has one — a kanji will
 * need the caller to name WHICH reading it means. */
export function readingOfEntry(entry: EntryId): string {
  return BY_ENTRY.get(entry)?.[0]?.answers[0] ?? glyphOf(entry);
}

/**
 * A SessionStats / history.facts key list, with the brand restored.
 *
 * `Object.keys` on a `Record<FactId, …>` returns `string[]` — a mapped type
 * over a non-literal string widens to a plain string index signature and the
 * brand is erased. This is the one sanctioned place to put it back, so that
 * the cast is spelled once here instead of scattered across every walk.
 */
export function factKeys(record: object): FactId[] {
  return Object.keys(record) as FactId[];
}

/** As `factKeys`, for a `Record<EntryId, …>` — `confused`, in practice. */
export function entryKeys(record: object): EntryId[] {
  return Object.keys(record) as EntryId[];
}
