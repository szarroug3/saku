// Where entry and fact ids are MINTED. The only file that knows an id has any
// structure at all.
//
// Everything else — history, accuracy, confusions, decks, every screen —
// treats both as opaque strings and resolves them by lookup through
// src/lib/facts.ts. There is deliberately no `parse` here: `entryOf(fact)` is
// an index lookup, not a string split, so no consumer can ever grow a
// dependency on the grammar. The strings are human-readable purely so that
// history.json and a debugger stay legible.
//
// The grammar itself is an implementation detail and may change:
//
//   entry  <subject>:<key>              kana:し · kanji:生 · word:先生
//   fact   <entry>/<aspect>             kana:し/reading · kanji:生/meaning
//
// A kanji READING is keyed on (kanji, word) and never on the kanji alone —
// `kanji:生/reading@学生`, not `kanji:生/reading` — because "what is the
// reading of 生" has eleven answers and cannot be graded. That is the rule the
// whole entry/fact split exists to enforce; `readingAspect` below is how you
// spell it.

import type { EntryId, FactId } from "@/types";

/** Mint an entry id. `subject` names the kind ("kana", "kanji", "word", …);
 * `key` identifies it within that subject. */
export function entryId(subject: string, key: string): EntryId {
  return `${subject}:${key}` as EntryId;
}

/** Mint a fact id: one askable thing about `entry`. `aspect` says WHICH thing
 * — "reading", "meaning", or a reading in context via `readingAspect`. */
export function factId(entry: EntryId, aspect: string): FactId {
  return `${entry}/${aspect}` as FactId;
}

/** The aspect for a reading, always qualified by the word it is read in.
 * There is no bare "reading" aspect for anything with more than one, and
 * spelling it this way is what stops one from being invented. */
export function readingAspect(inWord: string): string {
  return `reading@${inWord}`;
}
