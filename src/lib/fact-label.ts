// What KIND of fact a glyph names — the type badge the retry picker prints
// under each chip.
//
// THE BUG
// =======
// On "Pick what to retry" every fact rendered as its glyph and nothing else, so
// 何 could appear three times — kanji · meaning, kanji · reading, word · meaning
// — as three identical chips a learner could not tell apart. The chip needs a
// second line that says which of them it is.
//
// The label is subject + aspect, but only where the aspect disambiguates: a
// kanji entry has a meaning and word-anchored readings, and a word has a meaning
// and a reading, so those two get "· meaning" / "· reading". Everything else —
// kana, a radical shape, a grammar pattern — has one askable aspect per glyph,
// so its noun alone is unambiguous and the suffix would be noise. The noun comes
// from `nounFor`, the same word the drill instruction uses ("shape" for a
// radical, not "radical"), so the two never drift.

import { VOCAB_SUBJECT, wordReadingFactId } from "@/data/vocab";
import { KANJI_SUBJECT } from "@/data/kanji";
import { factInfo } from "@/lib/facts";
import { nounFor } from "@/lib/quiz-instruction";
import { isReadingFact } from "@/lib/word-unlock";
import type { FactId } from "@/types";

/**
 * A short type badge for a fact — "kanji · meaning", "kanji · reading", "word ·
 * meaning", or just the plain noun ("kana", "shape") where the subject has only
 * one aspect. Distinguishes the same glyph asked as different facts.
 *
 * The reading-vs-meaning split is decided by lookup, not by parsing the id:
 * `isReadingFact` owns the kanji reading facts, and a word's reading fact is the
 * one `wordReadingFactId` mints. Anything else on a two-aspect subject is its
 * meaning.
 */
export function factTypeLabel(fact: FactId): string {
  const info = factInfo(fact);
  if (!info) return String(fact);
  const noun = nounFor(fact);

  // A word-anchored kanji reading (kanji:生/reading@学生).
  if (isReadingFact(fact)) return `${noun} · reading`;

  if (info.subject === VOCAB_SUBJECT) {
    // A word has both; the reading fact is the one keyed on its reading.
    return wordReadingFactId(info.glyph) === fact
      ? `${noun} · reading`
      : `${noun} · meaning`;
  }

  // A kanji's remaining (non-reading) fact is its meaning.
  if (info.subject === KANJI_SUBJECT) return `${noun} · meaning`;

  // One aspect per glyph — the noun alone already tells them apart.
  return noun;
}
