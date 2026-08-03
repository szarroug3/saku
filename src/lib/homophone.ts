// HOMOPHONES — when a word's reading is shared by another word the learner knows.
//
// WHY THIS EXISTS
// ===============
// A MEANING question that hides the written word is unanswerable when the reading
// is shared. Play はし and ask "what does it mean" and the honest answers are
// BOTH "chopsticks" (箸) and "bridge" (橋): the audio names a sound, and the sound
// belongs to two words. The learner is marked wrong for giving the other word's
// meaning, which is the one failure this app refuses — a correct answer graded
// wrong. The same hole opens for a kana-only meaning prompt: はし on its own is
// two words.
//
// The fix is not to loosen grading (each word keeps only its own glosses — see
// question.ts). It is to never ASK the ambiguous question: a colliding word's
// meaning must be asked from its written form (箸), where there is exactly one
// right answer. Its reading may still be asked from the glyph, unchanged: hearing
// はし and typing "hashi" is fine because 箸 and 橋 read the same, so the reading
// answer is right either way.
//
// WHY "A WORD THE LEARNER KNOWS", NOT "ANY WORD"
// ==============================================
// Pitch resolves only ~13% of homophones, so the mark is not a general
// disambiguator (see task 09). The collision that actually bites is between two
// words the learner has BOTH met: 箸's audio-meaning card is only ambiguous once
// 橋 is also known, because only then does はし mean two things she could answer.
// So "known" is the app's one notion of known — `wordKnown`, through
// `effectiveState` — the same predicate readable.ts and word-unlock.ts gate on,
// so a CLAIM makes a word a collider exactly as a lesson does. A homophone she has
// never met is not yet a source of confusion, and its card is left alone.
//
// READING EQUALITY, on the kana `reb`. 箸/橋/端 all read はし; 安い/易い both
// やすい. Two words collide when their readings are the same string. Pitch is not
// consulted here: 安い and 易い share reading AND pitch, and the meaning card must
// show the glyph for that pair too — the written form is the only thing that
// separates them at all.

import { VOCAB, VOCAB_SUBJECT, isWordReadingFact, vocabRow } from "@/data/vocab";
import { wordKnown } from "@/lib/grammar/readable";
import { factInfo } from "@/lib/facts";
import type { FactId, HistoryFile } from "@/types";

/** reb → the written forms (keb) that read that way. Built once; shipped data. A
 * reading with one word has a one-entry list, which is the common case. */
const BY_READING: ReadonlyMap<string, readonly string[]> = buildReadingIndex();

function buildReadingIndex(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const w of VOCAB) {
    const list = map.get(w.reb);
    if (list) list.push(w.keb);
    else map.set(w.reb, [w.keb]);
  }
  return map;
}

/**
 * The OTHER words that share this word's reading — its homophones. Empty for a
 * word with a reading all its own (the common case), or for a keb the vocabulary
 * does not have.
 */
export function homophonesOf(keb: string): readonly string[] {
  const row = vocabRow(keb);
  if (!row) return [];
  return (BY_READING.get(row.reb) ?? []).filter((other) => other !== keb);
}

/**
 * Is this word's reading shared by another word the learner KNOWS?
 *
 * True when any homophone of `keb` has its meaning learned (seen, claimed, or
 * tested — `wordKnown`). This is the condition under which a meaning question
 * about `keb` that hides the written form has more than one right answer.
 */
export function readingSharedByKnownWord(keb: string, history: HistoryFile): boolean {
  return homophonesOf(keb).some((other) => wordKnown(other, history));
}

/**
 * The collision detector, keyed on a FACT so card selection can ask it directly.
 *
 * True when `fact` belongs to a word whose reading collides with another word the
 * learner knows. Works off the fact's own word (its glyph), so it answers the
 * same for a word's reading fact and its meaning fact — the collision is a
 * property of the word, not of which question is being asked. False for any
 * non-word fact.
 */
export function collidesWithKnown(fact: FactId, history: HistoryFile): boolean {
  const info = factInfo(fact);
  if (!info || info.subject !== VOCAB_SUBJECT) return false;
  return readingSharedByKnownWord(info.glyph, history);
}

/**
 * The card-selection decision: must THIS card show the written word (the glyph)?
 *
 * True only for a word's MEANING fact whose word collides with a known homophone.
 * The drill reads this to force the glyph onto the card — which in practice means
 * refusing the audio (listening-meaning) showing, whose whole nature is to hide
 * the glyph and play the sound. The visual meaning card already shows the glyph
 * (箸 → ?), and the en2jp meaning card asks for the specific written word, so
 * both are unambiguous and unaffected; only the audio showing has to be blocked.
 *
 * A reading fact returns false: its answer is the reading, which every homophone
 * shares, so hiding the glyph and playing the word is a fair reading question.
 *
 * MEANING-vs-READING is decided by membership, not by `wordMeaningFactId(glyph)
 * === fact`. That equality only ever names the PRIMARY unit's unqualified id, so
 * a qualified meaning unit (`word:日/meaning@にち`) failed it and was wrongly
 * treated as not-a-meaning-card. A word fact is a reading OR a meaning, so "not a
 * reading fact" is exactly "is a meaning fact" — the same membership discriminator
 * `isWordReadingFact` was built to give (see its doc in data/vocab.ts).
 */
export function meaningMustShowGlyph(fact: FactId, history: HistoryFile): boolean {
  const info = factInfo(fact);
  if (!info || info.subject !== VOCAB_SUBJECT) return false;
  if (isWordReadingFact(fact)) return false;
  return readingSharedByKnownWord(info.glyph, history);
}
