// The words the curriculum teaches: WHICH words, in WHAT order, and what each
// one owes.
//
// WHAT THIS FILE STOPPED BEING
// ============================
// It used to be a scheduler as well. It walked beginnerRank, asked of every word
// whether all its kanji were known yet, stepped over the ones that were not, and
// handed the next few teachable ones to a card of its own, with a lock card for
// the very common case where the best word to teach was behind kanji the learner
// did not have. That was a second scheduler running beside kanji's over the same
// climb, and the lock was it apologising for the other one.
//
// curriculum-order.ts folded both into ONE order: a word is placed after every
// kanji it is written with, so "is this teachable yet" is answered by the
// sequence rather than asked of history. curriculum-lesson.ts cuts that sequence
// into lessons and is the only scheduler now. What is left here is the source of
// truth that order is built from: the word list, its cut, and the prerequisite
// rule.
//
// THE ORDER
// =========
// `beginnerRank` is a single TOTAL ordering over every word in VOCAB (see its
// doc comment in vocab.ts): CEJC lexical frequency for the words CEJC's
// conversation corpus actually observed, falling back to a JLPT/OpenSubtitles
// blend for everything else. The curriculum sorts by it directly — there is no
// second cut here.
//
// Kana-only words still lead, and for the same reason they always did: a word
// written with no kanji (これ, もう, とても) owes nothing, so it arrives with no
// run-up, while a kanji word of a LOWER rank (何 is rank 1) arrives behind its
// kanji. beginnerRank order is preserved; what a word owes is what spaces them
// out.
//
// WHERE THE CURRICULUM ENDS
// =========================
// At (almost) every dictionary row. VOCAB is already JMdict's own curated
// "everyday" set (ichi1/spec1/spec2 — see vocab.ts), so a word CEJC's specific
// recordings never happened to use, or that JLPT's lists never gated, is not
// evidence it is rare: 図書館, 郵便局, 飛行機 are exactly this shape, ordinary
// nouns a conversation corpus rarely has occasion to say. The only VOCAB
// entries excluded are the ones the COUNTERS track already teaches under its
// own spoken-form entry (COUNTER_TRACK_KEBS/COUNTER_KANJI_GLYPHS, below) —
// everything else is taught, CEJC/JLPT order first, frequency-tail order
// after. Grammar's own facts (conjugation, particles, patterns) still belong
// to its prerequisite-driven track, not here — but a grammar-role WORD (e.g.
// くださる, だけ) is still a word with a plain meaning worth teaching, so it is
// no longer excluded on category alone.
//
// This was a considered decision, not a default: an earlier version of this
// file stopped at CEJC/JLPT coverage (~7,537 words) and treated the remaining
// ~5,000 as Library-only reference material. Verified before widening: those
// 5,000 are not junk that slipped past a filter — VOCAB's own curation already
// screened for everyday commonness, so JLPT-gate/CEJC-observation status marks
// *how a word's teaching order was computed*, not *whether it is worth
// teaching*. See docs/interleaved-schedule-findings.md.

import { kanjiKnown } from "@/lib/kanji-known";
import { VOCAB, VOCAB_SUBJECT, type VocabRow } from "@/data/vocab";
import { COUNTER_CURRICULUM } from "@/data/counters";
import type { HistoryFile } from "@/types";

// The words-per-lesson default and clamp live in the DATA-FREE
// src/lib/lesson-sizing.ts so the always-mounted QuizConfigProvider can seed a
// config without importing this module's VOCAB curriculum. Imported for this
// module's own internal use and re-exported so its consumers are unchanged.
import { WORDS_PER_LESSON_DEFAULT, clampWordsPerLesson } from "@/lib/lesson-sizing";

export { WORDS_PER_LESSON_DEFAULT, clampWordsPerLesson };

const HAN = /\p{Script=Han}/u;

/** The iteration mark 々 (U+3005). Unicode files it under Han script, so the
 * HAN test matches it, but it is NOT a kanji: it is a writing rule that repeats
 * the character before it (時々 is 時 written twice), and it is taught exactly
 * like okurigana — a lesson card fired ahead of the first word that uses it, in
 * the teach walk (see ITERATION_MARK in src/lib/lesson-steps.ts), not a shape in
 * the kanji track. lesson-steps.ts already excludes it from its own KANJI test
 * for this reason; this is the same call, one file over.
 *
 * Left in the prerequisite list it becomes a debt nothing can pay: there is no
 * kanji lesson for 々, so `kanjiKnown("々")` is always false, and every 々 word
 * (時々, 様々, 少々, …) would owe a shape the curriculum never teaches. Excluded
 * here so a 々 word owes the kanji it repeats, which is already in the list, and
 * learns the mark itself inline when it is taught. */
const ITERATION_MARK = "々";

/**
 * The kanji in a word's written form — every Han character, in order, deduped,
 * excluding the iteration mark (see ITERATION_MARK).
 *
 * Used for the gate: a word is teachable once EVERY kanji here is known. All
 * curriculum words are all-jōyō (see vocab.ts), so each has a card; a Han
 * character with no card simply never reads as "known" and keeps the word
 * locked, which is the truthful answer for material outside the kanji track.
 */
export function wordKanji(keb: string): string[] {
  const out: string[] = [];
  for (const c of keb) {
    if (c === ITERATION_MARK) continue;
    if (HAN.test(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

/** A word written with no kanji at all — これ, もう, とても. It has no kanji
 * prerequisite, so it is teachable the moment the track opens. */
export function isKanaOnlyWord(w: VocabRow): boolean {
  return !HAN.test(w.keb);
}

/**
 * The words the track teaches, in CEJC teaching order. Computed once — it is a
 * property of source data plus the approved cadence, not of the user.
 *
 * Excludes vocab entries that are owned by the counters track so learners don't
 * see the same concept in two places: number kanji (一–万), native 〜つ counting
 * words (一つ–九つ), people-counting forms (一人, 二人), and any kanji counter
 * form in COUNTER_CURRICULUM.
 */

// Kanji counter forms derive from COUNTER_CURRICULUM; kana-only forms (ひとつ,
// いち …) are omitted here to avoid matching unrelated kana words (に, さん …).
const COUNTER_KANJI_GLYPHS: ReadonlySet<string> = new Set(
  COUNTER_CURRICULUM.filter((f) => f.glyph !== f.reading).map((f) => f.glyph),
);

// Counting words that are already covered by the counters track, so the words
// track does not teach them a second time.
//
// The Sino numbers 一…十 are NOT here: the counters track no longer ships a spoken
// number form (いち/に … were duplicates), so their reading and meaning are taught
// by their WORD role here — 二 = に = two, 四 = し = four. 百/千/万 stay excluded:
// the counters track's `big` unit still teaches those as base words with their own
// rule card, so a words-track copy would duplicate them.
const COUNTER_TRACK_KEBS: ReadonlySet<string> = new Set([
  // Big base words — counters track's `big` unit teaches these with their rule.
  "百", "千", "万",
  // Native 〜つ counting words (counters track: ひとつ〜ここのつ)
  "一つ", "二つ", "三つ", "四つ", "五つ", "六つ", "七つ", "八つ", "九つ",
  // Irregular people-counting forms (counters track: ひとり, ふたり)
  "一人", "二人",
]);

export const CURRICULUM_WORDS: readonly VocabRow[] = [...VOCAB]
  .filter((w) => !COUNTER_TRACK_KEBS.has(w.keb) && !COUNTER_KANJI_GLYPHS.has(w.keb))
  .sort((a, b) => a.beginnerRank - b.beginnerRank);

/**
 * How many words the track teaches — the denominator on the lesson card.
 *
 * COUNTED, not copied from the last teaching rank: counter-track forms are
 * deliberately removed after the CEJC sequence is built, so the two numbers
 * make different claims.
 */
export const WORDS_CURRICULUM_TOTAL = CURRICULUM_WORDS.length;

/**
 * Is this word teachable right now? Kana-only words always are; a kanji word is
 * teachable only once EVERY one of its kanji is known. 電車 is not teachable
 * until both 電 and 車 are learned, because presenting a compound built from
 * parts you don't have is teaching a shape with nothing under it.
 *
 * NO LONGER A FILTER, AND THAT IS THE POINT. The words scheduler used to call
 * this on every candidate and step over the ones that failed. The spine places a
 * word after every kanji it is written with, so teaching the sequence in order
 * satisfies this by construction. It survives as the STATEMENT of the rule, and
 * curriculum-lesson.test.ts holds the packing to it: walk the lessons in order,
 * and every word is teachable by the time it arrives. A rule the scheduler no
 * longer has to enforce is exactly the rule worth checking.
 *
 * "Known" is `kanjiKnown`: seen, claimed, or tested, read through the one
 * definition in src/lib/kanji-known.ts. A second copy here would drift, and a
 * second copy always forgets `claims`.
 */
export function wordTeachable(w: VocabRow, history: HistoryFile): boolean {
  if (isKanaOnlyWord(w)) return true;
  return wordKanji(w.keb).every((c) => kanjiKnown(c, history));
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { VOCAB_SUBJECT };
