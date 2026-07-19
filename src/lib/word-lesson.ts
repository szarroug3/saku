// The words track: the third curriculum, and the first one whose boundary
// MOVES WITH THE USER.
//
// WHY THIS IS NOT kanji-lesson.ts WITH A DIFFERENT COST
// ====================================================
// Kanji's lessons are a pure function of (order, range): `packLessons` cuts the
// 2,136 into groups once and history only decides WHERE in that fixed cut you
// are. A word cannot be cut that way, because a word has a PREREQUISITE that is
// itself learned material:
//
//   電車 is only teachable once you know 電 AND 車. Knowing the parts is not
//   knowing the compound — the word must still be taught — but it cannot be
//   taught until its kanji are known.
//
// So the words curriculum is not a static packing. The set of TEACHABLE words
// grows as the kanji track advances, and the next word lesson is a function of
// (beginnerRank order, which kanji you know, which words you've met) — three
// reads of history, not one. There is still no cursor: the same history names
// the same next lesson, exactly as kana and kanji manage it.
//
// THE ORDER, AND WHAT "KANA-ONLY FIRST" ACTUALLY MEANS
// ====================================================
// The teaching order is `beginnerRank` (see VocabRow) — 1 is the first word a
// beginner meets, and it already front-loads the common words. We walk it in
// that order and hand out the next few TEACHABLE, not-yet-met words.
//
// "Kana-only words come first" is a property of the GATE, not a re-sort. A word
// written with no kanji (これ, もう, とても) has no kanji prerequisite, so it is
// teachable the moment the words track opens — right after kana. A kanji word
// of a LOWER rank (何 is rank 1) waits until its kanji are known. So on day one
// of the track the teachable frontier is all kana-only words plus the handful of
// kanji words whose kanji you already learned; the kanji words fill in behind
// them as the kanji track pays for them. beginnerRank order is preserved; the
// gate is what makes kana-only lead.
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

import { effectiveState } from "@/lib/claims";
import type { LessonPosition } from "@/lib/lesson-position";
import { kanjiTeachOrder } from "@/data/kanji";
import { kanjiKnown } from "@/lib/kanji-known";
import {
  VOCAB,
  VOCAB_SUBJECT,
  wordMeaningFactId,
  wordReadingFactId,
  type VocabRow,
} from "@/data/vocab";
import type { FactId, HistoryFile } from "@/types";

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

/**
 * The kanji in a word's written form — every Han character, in order, deduped.
 *
 * Used for the gate: a word is teachable once EVERY kanji here is known. All
 * curriculum words are all-jōyō (see vocab.ts), so each has a card; a Han
 * character with no card simply never reads as "known" and keeps the word
 * locked, which is the truthful answer for material outside the kanji track.
 */
export function wordKanji(keb: string): string[] {
  const out: string[] = [];
  for (const c of keb) {
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

/** The facts a word teaches: its meaning always, its reading unless it is kana
 * (a kana word IS its own reading, so there is no reading fact — see
 * buildVocabFacts). */
function wordFacts(w: VocabRow): FactId[] {
  const facts: FactId[] = [wordMeaningFactId(w.keb)];
  if (!isKanaOnlyWord(w)) facts.push(wordReadingFactId(w.keb));
  return facts;
}

/** A fact the app has no record of — never answered, never claimed, never
 * "quiz me"'d. The one definition of "new", the same `lastTested === 0` rule
 * budget.freshFacts uses, read here per fact. */
function isFresh(fact: FactId, history: HistoryFile): boolean {
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested === 0;
}

// A kanji is KNOWN once its meaning has been learned — seen, claimed, or
// tested. The same "not fresh" signal that advances the kanji curriculum, read
// for the gate. Knowing a kanji's meaning is exactly the prerequisite a word's
// kanji must satisfy before the word can be taught.
//
// LIFTED OUT, because the lesson's "Look out for" row asks the identical
// question of a lookalike kanji and two copies would be two chances to disagree
// about what "known" means (and the second copy is always the one that forgets
// `claims`). See src/lib/kanji-known.ts.

/**
 * Is this word teachable right now? Kana-only words always are; a kanji word is
 * teachable only once EVERY one of its kanji is known. This is the gate the
 * whole track turns on — 電車 is not teachable until both 電 and 車 are learned,
 * because presenting a compound built from parts you don't have is teaching a
 * shape with nothing under it.
 */
export function wordTeachable(w: VocabRow, history: HistoryFile): boolean {
  if (isKanaOnlyWord(w)) return true;
  return wordKanji(w.keb).every((c) => kanjiKnown(c, history));
}

/** One word, ready to render on a lesson card. */
export interface WordCard {
  keb: string;
  /** The reading, or null for a kana word (whose reading is the word itself). */
  reb: string | null;
  /** The first gloss — "teacher". */
  meaning: string;
  /** Written with no kanji: taught for its meaning alone, no reading to drill. */
  kana: boolean;
}

/** The next word lesson: the words to teach, their facts, and where you are. */
export interface WordLesson {
  cards: WordCard[];
  facts: FactId[];
  /**
   * Where you are, in WORDS — "12–17 of 6,213".
   *
   * This card used to show "lesson N" with no total, and the comment that stood
   * here defended the omission: the teachable set grows as the kanji track
   * advances, so a "lesson N of M" promises an M that moves. That was right
   * about lessons and wrong about the conclusion. The number of LESSONS is
   * unknowable — the gate decides how many teachable words a sitting can find —
   * but the number of WORDS is not. CURRICULUM_WORDS is a fixed 6,213, decided
   * by the ingest and by WORDS_CURRICULUM_MAX, and no amount of studying moves
   * it. Counting items instead of lessons is what makes the total sayable.
   *
   * `from` is "words met + 1", so it is a count of what you have learned rather
   * than a position in the order. That matters here and nowhere else: the gate
   * steps OVER kanji-locked words, so the lesson's words are not a contiguous
   * run of beginnerRank the way a kanji lesson is a run of its order. "These
   * are your 12th through 17th words" stays true under the skipping; "you are
   * at rank 12 of 6,213" would not be.
   */
  position: LessonPosition;
}

function toCard(w: VocabRow): WordCard {
  const kana = isKanaOnlyWord(w);
  return {
    keb: w.keb,
    reb: kana ? null : w.reb,
    meaning: w.glosses[0] ?? "",
    kana,
  };
}

/**
 * The next word lesson, or null when nothing is teachable yet.
 *
 * Walk the curriculum in beginnerRank order and take the next `perLesson` words
 * that are (a) new — meaning not yet met — and (b) teachable now (kana-only, or
 * every kanji known). A word already met is skipped and counted; a kanji word
 * whose kanji you don't have is stepped over silently and picked up later, when
 * the kanji track has paid for it.
 *
 * Null is a real state, not an error, and it means two different things the card
 * needn't tell apart: the curriculum is finished, or the next words are all
 * still gated behind kanji you have not learned. Either way there is nothing to
 * teach here right now, so nothing is shown — the same rule the kana and kanji
 * cards follow.
 */
export function nextWordLesson(
  history: HistoryFile,
  perLesson: number,
): WordLesson | null {
  const rows = nextWordSet(history, perLesson);
  if (!rows.length) return null;
  if (rows.some((w) => !wordTeachable(w, history))) return null;

  const cards: WordCard[] = rows.map(toCard);
  const facts: FactId[] = rows.flatMap(wordFacts);
  let met = 0;

  for (const w of CURRICULUM_WORDS) {
    // Met already? Skip and count. "Met" is the meaning fact being non-fresh —
    // the word has been introduced, so it is no longer new material even if its
    // reading is still shaky (that is the drill's job, not the lesson's).
    if (!isFresh(wordMeaningFactId(w.keb), history)) {
      met++;
      continue;
    }
    break;
  }

  return {
    cards,
    facts,
    position: { from: met + 1, to: met + cards.length, total: WORDS_CURRICULUM_TOTAL },
  };
}

/** One kanji a word still needs — the glyph and its first meaning, everything
 * the words card wants to name and link the missing prerequisite without
 * reaching back into the kanji data itself. */
export interface WordLock {
  /** How many kanji remain before the furthest kanji needed by the next lesson
   * set is reached in the current kanji teaching order. */
  away: number;
}

function kanjiAway(
  history: HistoryFile,
  missing: readonly string[],
  order: readonly string[],
): number {
  if (!missing.length) return 0;
  const index = new Map(order.map((c, i) => [c, i]));
  let furthest = -1;
  for (const c of missing) {
    furthest = Math.max(furthest, index.get(c) ?? -1);
  }
  if (furthest < 0) return missing.length;
  let away = 0;
  for (let i = 0; i <= furthest; i++) {
    if (!kanjiKnown(order[i], history)) away++;
  }
  return away;
}

function nextWordSet(history: HistoryFile, perLesson: number): VocabRow[] {
  const size = clampWordsPerLesson(perLesson);
  const rows: VocabRow[] = [];
  for (const w of CURRICULUM_WORDS) {
    if (!isFresh(wordMeaningFactId(w.keb), history)) continue;
    rows.push(w);
    if (rows.length >= size) break;
  }
  return rows;
}

export function nextWordLock(
  history: HistoryFile,
  perLesson: number,
  kanjiOrder: readonly string[] = kanjiTeachOrder("everyday"),
): WordLock | null {
  const rows = nextWordSet(history, perLesson);
  if (!rows.length) return null;
  let away = 0;
  let locked = false;
  for (const w of rows) {
    const missing = wordKanji(w.keb).filter((c) => !kanjiKnown(c, history));
    if (!missing.length) continue;
    locked = true;
    away = Math.max(away, kanjiAway(history, missing, kanjiOrder));
  }
  return locked ? { away } : null;
}

export function hasStartedWordTrack(history: HistoryFile): boolean {
  for (const w of CURRICULUM_WORDS) {
    if (!isFresh(wordMeaningFactId(w.keb), history)) return true;
  }
  return false;
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { VOCAB_SUBJECT };
