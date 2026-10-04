// What a word means, cut short enough to print under it (SAK-506). The
// sentence quiz gives the meanings of the pieces of a sentence this way, and the grammar
// page's words line under its sentence does too, so the two say a word's
// meaning the same way.

import { VOCAB_SUBJECT } from "@/data/vocab";
import { entryForGlyph, libEntry, type LibEntry } from "@/lib/library/entries";

/** The vocabulary's entry for a word as written, or nothing when the
 * vocabulary does not have it. */
export function vocabEntryOf(word: string | null): LibEntry | undefined {
  const id = word ? entryForGlyph(VOCAB_SUBJECT, word) : undefined;
  return id ? libEntry(id) : undefined;
}

/** A dictionary sense without its asides, up to its first semicolon: "water",
 * not "water (esp. cool or cold)". Nothing when that leaves nothing. */
export function shortMeaning(meaning: string | undefined): string | undefined {
  return meaning?.replace(/\s*\([^)]*\)/g, "").split(";")[0].trim() || undefined;
}
