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
import { kanjiRow, meaningFactId as kanjiMeaningFactId } from "@/data/kanji";
import {
  VOCAB,
  VOCAB_SUBJECT,
  wordMeaningFactId,
  wordReadingFactId,
  type VocabRow,
} from "@/data/vocab";
import type { FactId, HistoryFile } from "@/types";

/**
 * How many NEW words a lesson teaches. The words analogue of the kanji lesson's
 * cost range — but a COUNT, not a cost, because a word adds no new kanji and the
 * draw+assembly work that sizes a kanji lesson does not apply. Each word is one
 * word to learn (a meaning, sometimes a reading), so the honest unit is how many
 * of them you meet in a sitting.
 *
 * A single number, not a min/max: a word is indivisible and uniform, so there is
 * no "bundle bigger than the ceiling" case the kanji range exists to handle. The
 * lesson is simply the next N teachable words.
 */
export const WORDS_PER_LESSON_DEFAULT = 6;

/** Clamp a stored/edited count to a sane lesson size — whole, at least 1. Same
 * instinct as `clampLessonRange`: a corrupt value should degrade to a small
 * lesson, not a blank screen. Capped so a hand-edit can't ask for a 500-word
 * teach screen. */
export function clampWordsPerLesson(n: number): number {
  const v = Math.round(Number.isFinite(n) ? n : WORDS_PER_LESSON_DEFAULT);
  return Math.min(20, Math.max(1, v));
}

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

/** A kanji is KNOWN once its meaning has been learned — seen, claimed, or
 * tested. The same "not fresh" signal that advances the kanji curriculum, read
 * for the gate. Knowing a kanji's meaning is exactly the prerequisite a word's
 * kanji must satisfy before the word can be taught. */
function kanjiKnown(c: string, history: HistoryFile): boolean {
  if (!kanjiRow(c)) return false;
  return !isFresh(kanjiMeaningFactId(c), history);
}

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
  /** How many words you have already met — so the card can count "lesson N"
   * without a stored cursor. There is no honest TOTAL: the teachable set grows
   * as the kanji track advances, so a "lesson N of M" would promise an M that
   * moves. */
  index: number;
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
  const size = clampWordsPerLesson(perLesson);
  const cards: WordCard[] = [];
  const facts: FactId[] = [];
  let met = 0;

  for (const w of CURRICULUM_WORDS) {
    // Met already? Skip and count. "Met" is the meaning fact being non-fresh —
    // the word has been introduced, so it is no longer new material even if its
    // reading is still shaky (that is the drill's job, not the lesson's).
    if (!isFresh(wordMeaningFactId(w.keb), history)) {
      met++;
      continue;
    }
    if (!wordTeachable(w, history)) continue;

    cards.push(toCard(w));
    facts.push(...wordFacts(w));
    if (cards.length >= size) break;
  }

  if (!cards.length) return null;
  return { cards, facts, index: Math.floor(met / size) + 1 };
}

/** One kanji a word still needs — the glyph and its first meaning, everything
 * the words card wants to name and link the missing prerequisite without
 * reaching back into the kanji data itself. */
export interface MissingKanji {
  c: string;
  /** The kanji's first meaning — "what", "say" — so the gate can read as a
   * sentence and not just a bare glyph. */
  meaning: string;
}

/**
 * The GATE the words card leads with: the top-ranked word not yet learned, and
 * whichever of its kanji the user still doesn't know.
 *
 * WHY THIS IS SEPARATE FROM nextWordLesson
 * ========================================
 * nextWordLesson answers "what CAN I teach now" — it steps over gated words to
 * hand out the best AVAILABLE one. This answers the different question the owner
 * wants led with: "what word does the curriculum most want to teach next, and
 * what's stopping it?" That top word is almost always kanji-gated early on (何 is
 * rank 1 and needs 何), so the card can name the word and point at the exact
 * kanji that unlocks it — turning a silent skip into a concrete "go learn this".
 *
 * `missing` is empty when the top word is teachable right now (kana-only, or all
 * its kanji already known). In that case there is no gate to show and the normal
 * lesson — whose head IS this same word — leads instead. Null only when the
 * whole curriculum is finished, the same finished state nextWordLesson returns
 * null for.
 */
export interface WordGate {
  /** The top-ranked unlearned word — the one the track most wants to teach. */
  word: WordCard;
  /** Its rank in the teaching order, so the card can say "your next word". */
  rank: number;
  /** The kanji this word needs that the user hasn't learned yet, in written
   * order. Empty when the word is teachable now. */
  missing: MissingKanji[];
}

export function topWordGate(history: HistoryFile): WordGate | null {
  for (const w of CURRICULUM_WORDS) {
    // Learned already? It is not the NEXT word — keep walking. Same "met"
    // signal nextWordLesson counts with: the meaning fact being non-fresh.
    if (!isFresh(wordMeaningFactId(w.keb), history)) continue;

    const missing: MissingKanji[] = wordKanji(w.keb)
      .filter((c) => !kanjiKnown(c, history))
      .map((c) => ({ c, meaning: kanjiRow(c)?.meanings[0] ?? "" }));

    return { word: toCard(w), rank: w.beginnerRank, missing };
  }
  return null;
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { VOCAB_SUBJECT };
