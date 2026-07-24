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
// kana, a radical, a grammar pattern — has one askable aspect per glyph,
// so its noun alone is unambiguous and the suffix would be noise. The noun comes
// from `nounFor`, the same word the drill instruction uses ("radical" for a
// radical, the word the curriculum teaches it by), so the two never drift.

import { VOCAB_SUBJECT, wordReadingFactId } from "@/data/vocab";
import { KANJI_SUBJECT } from "@/data/kanji";
import { factInfo } from "@/lib/facts";
import { nounFor } from "@/lib/quiz-instruction";
import { isReadingFact } from "@/lib/word-unlock";
import type { FactId } from "@/types";

/**
 * Which of a two-aspect subject's facts this is — "meaning" or "reading" — or
 * null when the subject asks one thing per glyph (a kana, a radical, a grammar
 * pattern) and the aspect would be noise.
 *
 * Decided by lookup, not by parsing the id: `isReadingFact` owns the kanji
 * reading facts, and a word's reading fact is the one `wordReadingFactId` mints.
 * Anything else on a subject that HAS two aspects (kanji, word) is its meaning.
 */
export function aspectOf(fact: FactId): "meaning" | "reading" | null {
  const info = factInfo(fact);
  if (!info) return null;
  // A word-anchored kanji reading (kanji:生/reading@学生).
  if (isReadingFact(fact)) return "reading";
  if (info.subject === VOCAB_SUBJECT) {
    return wordReadingFactId(info.glyph) === fact ? "reading" : "meaning";
  }
  // A kanji's remaining (non-reading) fact is its meaning.
  if (info.subject === KANJI_SUBJECT) return "meaning";
  // One aspect per glyph — the noun alone already tells them apart.
  return null;
}

/**
 * A short type badge for a fact — "kanji · meaning", "kanji · reading", "word ·
 * meaning", or just the plain noun ("kana", "radical") where the subject has only
 * one aspect. Distinguishes the same glyph asked as different facts.
 */
export function factTypeLabel(fact: FactId): string {
  const info = factInfo(fact);
  if (!info) return String(fact);
  const noun = nounFor(fact);
  const aspect = aspectOf(fact);
  return aspect ? `${noun} · ${aspect}` : noun;
}
