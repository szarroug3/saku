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
// The teaching order is `beginnerRank` (see VocabRow). Rank 1 is the first word
// a beginner meets, and the ranking already front-loads the common words. The
// spine walks it in that order, weaving each word's prerequisites in ahead of it.
//
// Kana-only words still lead, and for the same reason they always did: a word
// written with no kanji (これ, もう, とても) owes nothing, so it arrives with no
// run-up, while a kanji word of a LOWER rank (何 is rank 1) arrives behind its
// kanji. beginnerRank order is preserved; what a word owes is what spaces them
// out.
//
// WHERE THE CURRICULUM ENDS
// =========================
// Not at 12,553. The owner: "common words the user would see every day only…
// they can learn the rest when they encounter them in real life." The cut is the
// JLPT-joined core — the ~6,213 words that appear on at least one of the two
// JLPT consensus lists beginnerRank is built from. Those occupy ranks
// 1..WORDS_CURRICULUM_MAX; the ~50% tail (rank > that) is the advanced/rare half
// beginnerRank sorts last on purpose, and the track does not push it. See
// scripts/ingest/beginnerrank.py — the boundary is its `gated_max_rank`, and
// `--check` reprints it if the ingest is ever re-cut.

import { kanjiKnown } from "@/lib/kanji-known";
import { VOCAB, VOCAB_SUBJECT, type VocabRow } from "@/data/vocab";
import type { HistoryFile } from "@/types";

// The words-per-lesson default and clamp live in the DATA-FREE
// src/lib/lesson-sizing.ts so the always-mounted QuizConfigProvider can seed a
// config without importing this module's VOCAB curriculum. Imported for this
// module's own internal use and re-exported so its consumers are unchanged.
import { WORDS_PER_LESSON_DEFAULT, clampWordsPerLesson } from "@/lib/lesson-sizing";

export { WORDS_PER_LESSON_DEFAULT, clampWordsPerLesson };

/**
 * The last beginnerRank the curriculum teaches: the JLPT-joined core.
 *
 * This is `gated_max_rank` from scripts/ingest/beginnerrank.py — the count of
 * words that join at least one of the two JLPT consensus lists. Ranks
 * 1..WORDS_CURRICULUM_MAX are that core; everything above is the advanced tail
 * beginnerRank deliberately sorts after the whole beginner curriculum. It is a
 * constant rather than a per-row flag because VocabRow carries no JLPT field —
 * re-derive with `python3 scripts/ingest/beginnerrank.py --check` if the ingest
 * is ever re-cut.
 */
export const WORDS_CURRICULUM_MAX = 6213;

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
 * The words the track teaches, in teaching order: the JLPT core, by
 * beginnerRank. Computed once — it is a property of the data, not of the user.
 */
export const CURRICULUM_WORDS: readonly VocabRow[] = [...VOCAB]
  .filter((w) => w.beginnerRank <= WORDS_CURRICULUM_MAX)
  .sort((a, b) => a.beginnerRank - b.beginnerRank);

/**
 * How many words the track teaches — the denominator on the lesson card.
 *
 * COUNTED, not set to WORDS_CURRICULUM_MAX. The two are equal today (6,213,
 * because beginnerRank is dense over 1..12,553 with no gaps or ties) and they
 * are different claims: MAX is the last RANK taught, this is how many ROWS are
 * at or below it. If a re-cut ingest ever leaves a hole in the ranking, the
 * rank would over-promise by exactly the size of the hole and the count would
 * still be right. Cheap to count once at module load; there is no reason to
 * assume the density instead.
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
