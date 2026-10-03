// Two words a learner would mix up are one item (SAK-493).
//
// The Planetarium's Words row opened on "yes, yes, no, no": はい and うん both
// gloss "yes", いいえ and いや both gloss "no", and the tiles show English
// alone, so nothing told the two "yes" tiles apart. Sam, 2026-10-02: teach
// each pair as one item, the way は and が are one (SAK-491, particle-groups.ts).
//
// The pairs are the hand-authored contrast pairs marked `together` in
// src/data/word-contrast-notes.ts, so a pair marked later is a group without a
// line changing here. A group is a third id over its two words: the words stay
// entries and quiz units, and the group is what is offered, picked, claimed,
// taught and drawn. It is named "はい vs うん", as a particle group is, and its
// meaning line is the one the pair writes for itself.
//
// Pure data over the shipped tables: the same for every learner.

import { WORD_CONTRAST_PAIRS } from "@/data/word-contrast-notes";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { entryForGlyph } from "@/lib/library/entries";

export interface WordGroup {
  /** The group's own id: "words:" and its two entry ids. */
  id: string;
  /** The two words as written, in the note's order. */
  words: readonly string[];
  /** Their entries: the group's parts. */
  parts: readonly string[];
  /** What it is called: "はい vs うん". */
  glyph: string;
  /** Its meaning line: "yes, polite and casual". */
  english: string;
  /** The note that tells the two apart. */
  note: string;
}

/** Every pair taught together whose two words are both in the library. */
export const WORD_GROUPS: readonly WordGroup[] = WORD_CONTRAST_PAIRS.flatMap((pair): WordGroup[] => {
  if (!pair.together) return [];
  const words = [pair.a, pair.b];
  const parts = words.map((w) => entryForGlyph(VOCAB_SUBJECT, w) as string | undefined);
  if (parts.some((p) => !p)) return [];
  return [{ id: `words:${parts.join("-")}`, words, parts: parts as string[], glyph: `${pair.a} vs ${pair.b}`, english: pair.together.english, note: pair.note }];
});

const BY_ID: ReadonlyMap<string, WordGroup> = new Map(WORD_GROUPS.map((g) => [g.id, g]));
const BY_PART: ReadonlyMap<string, WordGroup> = new Map(WORD_GROUPS.flatMap((g) => g.parts.map((p) => [p, g] as const)));

/** The group with this id, or nothing. */
export function wordGroup(id: string): WordGroup | undefined {
  return BY_ID.get(id);
}

/** The group a word's entry is a part of, or nothing. */
export function wordGroupOfPart(entryId: string): WordGroup | undefined {
  return BY_PART.get(entryId);
}
