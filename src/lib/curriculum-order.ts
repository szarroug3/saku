// ONE SPINE: every radical, kanji and word the curriculum teaches, in the single
// order a learner meets them.
//
// WHAT THIS IS FOR
// ================
// The app ships three tracks that each own a slice of the same material. The
// radical track hands a shape to the kanji track, the kanji track hands a
// character to the words track, and the learner sees three progress numbers for
// what is really one climb. This module answers the question none of the three
// can answer alone: what is the NEXT thing, out of everything, and what did it
// take to get here?
//
// It is pure data in, data out. It reads the shipped tables and nothing else:
// no history, no config, no clock, no user. The sequence is a property of the
// curriculum data, so it is computed once at module load and shared.
//
// THE SHAPE OF THE SEQUENCE
// =========================
// Words lead, because a word is the only item here a learner has a reason to
// want. CURRICULUM_WORDS is already the teaching order (beginnerRank, the
// JLPT-joined core), and each word is preceded by exactly what it owes: the
// kanji it is written with, and, ahead of each of those, the radical-only shape
// the kanji is built around. Nothing arrives early and nothing arrives for its
// own sake. 電車 pulls 電 and 車 with it, and 雨 rides in ahead of 電 because 電 is
// filed under it.
//
// Then the tail, which is completeness and not curriculum:
//
//   1. The 388 jōyō kanji that appear in NO curriculum word. They owe nothing to
//      any word, so they follow all of them, in the everyday teaching order
//      (kanjiTeachOrder) so the tail is a ramp and not an accident of the table.
//   2. The radical-only shapes no taught kanji ever pulled in. Those index no
//      jōyō kanji at all, so there is no first consumer to ride in with.
//
// ONE ITEM PER GLYPH, AND ROLES INSTEAD OF KINDS
// ==============================================
// 山 is a Kangxi radical, a jōyō kanji, and a curriculum word. In three separate
// tracks it is three cards. Here it is ONE item that carries all three roles,
// because the learner meets the character once and everything else is a label on
// that one meeting. So an item is a glyph plus the SET of roles it plays, and
// the roles are pure membership, the same lookup `characterRole` does: is there
// a radical row, is there a kanji row, is it a curriculum word.
//
// Two consequences the rest of this file exists to honour:
//
//   - A both-role character is taught AS ITS KANJI, never as a separate radical
//     item. `isRadicalTaughtAsKanji` already merges the 116 that are their own
//     first consumer; the 8 that are not (八 小 己 火 玉 示 肉 阜) keep an early
//     radical card in the kanji track, and here they instead have their KANJI
//     pulled forward to the point of first need. Same early arrival, one item,
//     and the item honestly says radical AND kanji. Each of the 8 is filed under
//     itself, so the pull-forward has nothing to recurse into.
//   - A word whose written form is exactly one kanji is FOLDED into that kanji's
//     item. Teaching 山 at the moment 火山 first needs it delivers the word 山 as
//     well, so 山 is not emitted a second time when its own beginnerRank comes
//     round. 595 of the 6,213 words arrive this way, most of them early, which is
//     the point: the run-up to a compound is paying for words too.
//
// Nothing is emitted twice. Every one of the 2,136 kanji, every radical-only
// shape, and every curriculum word appears exactly once in CURRICULUM_SEQUENCE.

import { kanjiRow, kanjiTeachOrder } from "@/data/kanji";
import {
  isRadicalTaughtAsKanji,
  radicalByGlyph,
  radicalOfKanji,
  type RadicalRow,
} from "@/data/radicals";
import { RADICAL_TEACHING_ORDER } from "@/lib/radical-order";
import { CURRICULUM_WORDS, wordKanji } from "@/lib/word-lesson";

/**
 * What an item IS. A set, not a choice: 山 plays all three, 何 is a kanji and a
 * word, 气 is only ever a building block, あなた is only ever a word.
 */
export type CurriculumRole = "radical" | "kanji" | "word";

/** One item of the spine: a character or a written form, and every role it
 * plays. The roles are what a screen labels it with; this module deliberately
 * stops short of the label itself. */
export interface CurriculumItem {
  /** The glyph to teach: 气, 山, 電車, あなた. */
  readonly glyph: string;
  /** Every role this glyph plays, always in the order radical, kanji, word, so
   * two items with the same roles compare equal element by element. Never
   * empty. */
  readonly roles: readonly CurriculumRole[];
}

/** The curriculum words by written form, for the two membership questions this
 * module asks 6,213 times each: is this glyph a word, and which row is it. Keys
 * are unique across CURRICULUM_WORDS. */
const WORD_KEBS: ReadonlySet<string> = new Set(CURRICULUM_WORDS.map((w) => w.keb));

/**
 * The roles a glyph plays, by membership alone.
 *
 * The same pure question `characterRole` asks, with the third table joined in:
 * a radical row makes it a radical, a kanji row makes it a kanji, a curriculum
 * word entry makes it a word. Nothing here knows or cares WHERE the glyph is
 * taught, which is the ordering problem below and a different question.
 */
function rolesOf(glyph: string): CurriculumRole[] {
  const roles: CurriculumRole[] = [];
  // Asked of every glyph, with no "single character" shortcut in front of it.
  // 𠮟 is one kanji and two JS units, so a `length === 1` guard would silently
  // strip the kanji role off it; the tables are keyed by the whole glyph and a
  // written form like 電車 is simply not in them.
  if (radicalByGlyph(glyph) !== undefined) roles.push("radical");
  if (kanjiRow(glyph) !== undefined) roles.push("kanji");
  if (WORD_KEBS.has(glyph)) roles.push("word");
  return roles;
}

/**
 * The radical-only shape a kanji must meet first, or null when there is nothing
 * separate to teach.
 *
 * This is `radicalPrereqOf` from kanji-lesson.ts with the both-role case moved
 * one step further along the same argument. That function drops the 116 merged
 * radicals, which ARE their own kanji and are taught there; this one also drops
 * the 8 unmerged both-role characters, for the reason the header gives: they are
 * kanji too, so they are taught as kanji here and pulled forward to the point of
 * first need instead of arriving as a second, thinner card. What is left is
 * exactly the radical-only shapes, the 90 that are no kanji at all.
 */
function radicalOnlyPrereq(c: string): RadicalRow | null {
  const rad = radicalOfKanji(c);
  if (!rad || isRadicalTaughtAsKanji(rad.num)) return null;
  if (kanjiRow(rad.glyph) !== undefined) return null;
  return rad;
}

/** The whole spine, built once. */
function buildSequence(): CurriculumItem[] {
  const items: CurriculumItem[] = [];
  const taughtKanji = new Set<string>();
  const taughtRadicals = new Set<number>();
  const deliveredWords = new Set<string>();

  const push = (glyph: string) => {
    items.push({ glyph, roles: rolesOf(glyph) });
  };

  const teachRadical = (rad: RadicalRow) => {
    if (taughtRadicals.has(rad.num)) return;
    taughtRadicals.add(rad.num);
    push(rad.glyph);
  };

  const teachKanji = (c: string) => {
    if (taughtKanji.has(c)) return;
    // Marked taught BEFORE the prerequisite walk, so a character filed under its
    // own radical (all 8 of the pulled-forward both-role ones are) cannot ask
    // for itself and spin. It is still emitted after its prerequisite, because
    // the push below is what puts it in the sequence.
    taughtKanji.add(c);
    const rad = radicalOnlyPrereq(c);
    if (rad) teachRadical(rad);
    else {
      // No radical-only shape to teach, but the character may still be filed
      // under an unmerged both-role radical (点 under 火). That one is a kanji,
      // so it comes forward as a kanji item, carrying its own roles.
      const both = radicalOfKanji(c);
      if (both && !isRadicalTaughtAsKanji(both.num) && both.glyph !== c) {
        teachKanji(both.glyph);
      }
    }
    // THE FOLD. If the character is itself a curriculum word, this item delivers
    // the word as well, and the word's own turn later will find it already paid.
    if (WORD_KEBS.has(c)) deliveredWords.add(c);
    push(c);
  };

  for (const w of CURRICULUM_WORDS) {
    // What the word owes, from the words track's own gate (`wordKanji` drops the
    // iteration mark 々, which is a writing rule and not a kanji to teach), so
    // the spine and the gate cannot disagree about a word's prerequisites.
    for (const c of wordKanji(w.keb)) teachKanji(c);
    // Folded already: a single-kanji word was delivered by its kanji item, at
    // the point some earlier word first needed the character (or, for a word
    // reached before anything else needs it, one line above).
    if (deliveredWords.has(w.keb)) continue;
    deliveredWords.add(w.keb);
    push(w.keb);
  }

  // THE ORPHAN KANJI. 388 jōyō kanji appear in no curriculum word, so no word
  // pulled them in. They follow every word, in the everyday order, which is the
  // ramp the kanji track already teaches by.
  for (const c of kanjiTeachOrder("everyday")) teachKanji(c);

  // THE ORPHAN RADICALS. Every kanji is taught by now, so any radical-only shape
  // still missing indexes no jōyō kanji at all (爿 瓜 韭 …) and has no first
  // consumer to ride in with. RADICAL_TEACHING_ORDER already sorts those last
  // among themselves, in Kangxi number order.
  for (const r of RADICAL_TEACHING_ORDER) {
    if (kanjiRow(r.glyph) !== undefined) continue;
    teachRadical(r);
  }

  return items;
}

/**
 * Every item the curriculum teaches, in order. Words in beginnerRank order with
 * their prerequisites woven in ahead of them, then the orphan kanji, then the
 * orphan radicals.
 *
 * Computed once at module load, like KANJI_ORDER and RADICAL_TEACHING_ORDER: it
 * is a property of the shipped data, no user input reaches it, and building it
 * is one walk of 6,213 words and 2,136 kanji against hash sets.
 */
export const CURRICULUM_SEQUENCE: readonly CurriculumItem[] = buildSequence();

/** Where a glyph sits in the spine, or -1 for anything the curriculum does not
 * teach. One item per glyph, so the position is unambiguous. */
const POSITION: ReadonlyMap<string, number> = new Map(
  CURRICULUM_SEQUENCE.map((it, i) => [it.glyph, i]),
);

export function curriculumPosition(glyph: string): number {
  return POSITION.get(glyph) ?? -1;
}
