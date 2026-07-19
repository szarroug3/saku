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
//
// A grammar PRODUCTION is the same rule met again: "build the 〜そう form" has
// one answer per HOST (行きそう on a verb, 高そう on an い-adjective), and they
// are different skills, so a pattern with more than one keys on both —
// `grammar:sou-appearance/production@adj-i`. `productionAspect` spells that one,
// and its doc says why the primary host keeps the bare aspect.

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

/**
 * The aspect for PRODUCING a form, qualified by the host it is produced on.
 *
 * Same shape as `readingAspect` and for the same reason. "Build the 〜そう form"
 * has two answers — 行きそう on a verb, 高そう on an い-adjective — and they are
 * two different moves: attach to the ますstem, versus chop the い. One fact
 * covering both is graded by whichever the example happened to bake, and the
 * other rule is then never asked at all. That is `kanji:生/reading` again,
 * arriving through the grammar door, and it is spelled away the same way.
 *
 * `onHost === null` is the PRIMARY host and keeps the unqualified aspect. That
 * is not cosmetic: `grammar:sou-appearance/production` is a key already sitting
 * in a real history file with real answers behind it, and the primary host is
 * the one those answers were given on. Qualifying every host would orphan the
 * lot and reset the owner's record. So the split is ADDITIVE — the old key
 * keeps its meaning, the new ones start unseen — and reversible by deleting the
 * extra facts.
 *
 * Callers pass the host, never build the string: which hosts get their own fact
 * is decided in data/grammar/index.ts, and this file only spells the result.
 */
export function productionAspect(onHost: string | null): string {
  return onHost === null ? "production" : `production@${onHost}`;
}
