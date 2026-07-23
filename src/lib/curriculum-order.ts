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
// JLPT-joined core), and each word is preceded by everything it owes: the kanji
// it is written with, and ahead of each of those, recursively, everything THOSE
// are built from. 電車 pulls 電 and 車; 電 pulls 雨 and 田, and 雨 pulls what 雨 is
// built from, all the way down to shapes that are nothing but strokes.
//
// Then the tail, which is completeness and not curriculum:
//
//   1. The jōyō kanji that appear in NO curriculum word and that nothing pulled
//      in as a component. They owe nothing to any word, so they follow all of
//      them, in the everyday teaching order (kanjiTeachOrder) so the tail is a
//      ramp and not an accident of the table.
//   2. The radical-only shapes no taught kanji ever pulled in. Those index no
//      jōyō kanji at all, so there is no first consumer to ride in with.
//
// THE PREREQUISITE RULE: ORDER EVERYTHING, TIE ONLY RADICALS
// ==========================================================
// The owner's rule, and it is two rules wearing one sentence:
//
//   "any requirements for the kanji should be taught before the kanji. if the
//    prerequisite is a kanji, it doesn't need to be in the same lesson as the
//    kanji. if the prerequisite is a radical, they should be in the same lesson."
//
// So ORDER applies to every component, and the TIE applies only to radicals:
//
//   - ORDER. A kanji is never taught before something it is built from, whether
//     that something is a radical-only shape or a jōyō kanji in its own right.
//     This is recursive: 何 owes 人, and whatever 人 owes comes before 人. That
//     is what makes 人 item 1 and 何 item 2, where an earlier cut of this module
//     opened on 何 with 人 nowhere in sight.
//   - TIE. A radical-only shape is not a lesson a learner would sit through on
//     its own: it is the piece the very next character is made of, and it means
//     nothing until that character shows up. So it is WELDED to the kanji that
//     first needs it, immediately before it, and phase 3's packer must not split
//     the pair across a lesson boundary. That is the same weld `packUnits`
//     already builds in kanji-lesson.ts, carried here as data.
//     A kanji prerequisite gets no weld. 人 is a whole lesson by itself, and 何
//     is happy to meet it a week earlier, so the packer is free to put the two
//     wherever the cost fits.
//
// The weld is `tiedTo` on the item, and the packing itself is NOT done here. This
// module says what must be true; the packer decides where the cuts fall.
//
// WHAT COUNTS AS A COMPONENT
// ==========================
// `costParts` (KRADFILE, via KanjiRow) plus the character's filed-under radical
// (`radicalOfKanji`), and each component classified by what it IS:
//
//   - a jōyō kanji (kanjiRow) is a KANJI prerequisite: ordered before, resolved
//     recursively, not tied.
//   - a Kangxi radical that is no kanji (气, 宀) is a RADICAL prerequisite:
//     ordered immediately before, and tied.
//   - anything else (｜ ノ 丶 and the other bare strokes) is NOT a prerequisite.
//     There is no card for a stroke and nothing to know about one; it is simply
//     drawn when the character is drawn.
//
// `costParts` and not `comps` because it is the decomposition that goes all the
// way down: `comps` stops at the meaningful depth-1 parts a learner is SHOWN
// ("made of"), which is the right answer for a card and the wrong one for a debt
// (it would let a character in owing a shape nobody had met). kanjiCost already
// reads costParts for exactly this reason. It over-decomposes and it is wrong
// about 亻/化, which costs a little accuracy in what gets pulled forward and
// never costs correctness: everything it names is genuinely in the glyph.
//
// CYCLES. Joining a drawing decomposition to a filing table can close a loop:
// 王 is filed under 玉 while 玉 is drawn as 王 plus a dot, and over the whole
// 2,136 that is the only one. It is resolved where it is made, in `componentsOf`
// (the drawing wins), so the walk itself sees a DAG. The walk still marks a
// character taught before walking its components, as a backstop that turns any
// future loop into an arbitrary break instead of a stack overflow, and as the
// guard for self-reference (a radical filed under itself: 八 小 己 火 玉 示 肉 阜).
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
//   - A both-role character (人, 大, 乙, 火) is taught AS ITS KANJI, never as a
//     separate radical item. It is a kanji, so it is a kanji prerequisite, and
//     its item honestly says radical AND kanji.
//   - A word whose written form is exactly one kanji is FOLDED into that kanji's
//     item. Teaching 山 at the moment 火山 first needs it delivers the word 山 as
//     well, so 山 is not emitted a second time when its own beginnerRank comes
//     round. 595 of the 6,213 words arrive this way, most of them early, which is
//     the point: the run-up to a compound is paying for words too.
//
// Nothing is emitted twice. Every one of the 2,136 kanji, every radical-only
// shape, and every curriculum word appears exactly once in CURRICULUM_SEQUENCE.

import { kanjiRow, kanjiTeachOrder } from "@/data/kanji";
import { radicalByGlyph, radicalOfKanji, type RadicalRow } from "@/data/radicals";
import { RADICAL_TEACHING_ORDER } from "@/lib/radical-order";
import { CURRICULUM_WORDS, wordKanji } from "@/lib/word-lesson";

/**
 * What an item IS. A set, not a choice: 山 plays all three, 何 is a kanji and a
 * word, 气 is only ever a building block, あなた is only ever a word.
 */
export type CurriculumRole = "radical" | "kanji" | "word";

/** One item of the spine: a character or a written form, every role it plays,
 * and the weld, if any, to the item after it. */
export interface CurriculumItem {
  /** The glyph to teach: 气, 山, 電車, あなた. */
  readonly glyph: string;
  /** Every role this glyph plays, always in the order radical, kanji, word, so
   * two items with the same roles compare equal element by element. Never
   * empty. */
  readonly roles: readonly CurriculumRole[];
  /**
   * The kanji this item is WELDED to, for a radical-only shape pulled in as a
   * component; null for everything else.
   *
   * A promise to the packer, in two parts: the tied item sits in the same lesson
   * as that kanji, and it sits immediately before it. A kanji needing two
   * radical-only shapes yields two tied items in a row, then the kanji, and the
   * whole run travels together.
   *
   * Only a radical is ever tied. A kanji prerequisite is ordered earlier and
   * nothing more, so it carries null and the packer may put a hundred items
   * between it and the character that wanted it.
   */
  readonly tiedTo: string | null;
}

/** The curriculum words by written form, for the membership question this module
 * asks of every item. Keys are unique across CURRICULUM_WORDS. */
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

/** What one kanji owes, split by how the debt is paid. See the header: kanji
 * parts are ordered before and resolved recursively, radical parts are ordered
 * immediately before and welded, bare strokes are owed nothing. */
interface Components {
  readonly kanji: readonly string[];
  readonly radicals: readonly RadicalRow[];
}

/**
 * The components of one kanji, classified and deduped, in a stable order.
 *
 * Two sources, and the second is not redundant. `costParts` is KRADFILE's
 * decomposition, which is what the glyph is drawn from; `radicalOfKanji` is the
 * one classical radical the character is FILED under, which the decomposition
 * does not always name (and which is the debt the radical track has always
 * collected). 何 is filed under 人 and that is why 人 comes first, whatever
 * KRADFILE calls the left-hand stroke.
 *
 * Computed once per kanji and cached: the walk asks for the same character's
 * components every time another one is built from it.
 */
const COMPONENTS = new Map<string, Components>();

function componentsOf(c: string): Components {
  const cached = COMPONENTS.get(c);
  if (cached) return cached;

  const kanji: string[] = [];
  const radicals: RadicalRow[] = [];
  const seenKanji = new Set<string>();
  const seenRadicals = new Set<number>();

  const classify = (part: string) => {
    // A character is not its own prerequisite, and some decompositions list it
    // among its own parts.
    if (part === c) return;
    if (kanjiRow(part) !== undefined) {
      if (seenKanji.has(part)) return;
      seenKanji.add(part);
      kanji.push(part);
      return;
    }
    const rad = radicalByGlyph(part);
    if (!rad) return; // A bare stroke: drawn, never taught.
    if (seenRadicals.has(rad.num)) return;
    seenRadicals.add(rad.num);
    radicals.push(rad);
  };

  for (const part of kanjiRow(c)?.costParts ?? []) classify(part);
  const filed = radicalOfKanji(c);
  // THE ONE PLACE THE TWO SOURCES CONTRADICT EACH OTHER: 王 is FILED under 玉,
  // and 玉 is DRAWN as 王 plus a dot, so each is the other's prerequisite and
  // whichever is reached first would teach the other one late. The drawing wins:
  // 玉 visibly contains 王, and filing is a catalogue fact about where the
  // character sits in the Kangxi table. So the filed-under edge is dropped when
  // the radical is itself built from this character. src/data/radicals.ts has
  // the same pair on file as the reason 玉 cannot merge into one kanji lesson.
  if (filed && !kanjiRow(filed.glyph)?.costParts.includes(c)) {
    classify(filed.glyph);
  }

  const out: Components = { kanji, radicals };
  COMPONENTS.set(c, out);
  return out;
}

/** The whole spine, built once. */
function buildSequence(): CurriculumItem[] {
  const items: CurriculumItem[] = [];
  const taughtKanji = new Set<string>();
  const taughtRadicals = new Set<number>();
  const deliveredWords = new Set<string>();

  const push = (glyph: string, tiedTo: string | null) => {
    items.push({ glyph, roles: rolesOf(glyph), tiedTo });
  };

  const teachKanji = (c: string) => {
    if (taughtKanji.has(c)) return;
    // Marked taught BEFORE the component walk, so a decomposition that loops
    // back on itself resolves instead of recursing forever. See CYCLES in the
    // header. It is still emitted after its components, because the push below
    // is what puts it in the sequence.
    taughtKanji.add(c);
    const parts = componentsOf(c);
    // Kanji first, radicals second, so the welded radicals end up in the run
    // immediately before this character with nothing between.
    for (const k of parts.kanji) teachKanji(k);
    for (const rad of parts.radicals) {
      if (taughtRadicals.has(rad.num)) continue;
      taughtRadicals.add(rad.num);
      push(rad.glyph, c);
    }
    // THE FOLD. If the character is itself a curriculum word, this item delivers
    // the word as well, and the word's own turn later will find it already paid.
    if (WORD_KEBS.has(c)) deliveredWords.add(c);
    push(c, null);
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
    push(w.keb, null);
  }

  // THE ORPHAN KANJI. The jōyō kanji no curriculum word is written with and no
  // taught character is built from. They follow every word, in the everyday
  // order, which is the ramp the kanji track already teaches by.
  for (const c of kanjiTeachOrder("everyday")) teachKanji(c);

  // THE ORPHAN RADICALS. Every kanji is taught by now, so any radical-only shape
  // still missing is in nothing at all (爿 瓜 韭 …) and has no first consumer to
  // ride in with. Untied, for the same reason: there is no kanji to weld it to.
  // RADICAL_TEACHING_ORDER already sorts those last among themselves, in Kangxi
  // number order.
  for (const r of RADICAL_TEACHING_ORDER) {
    if (kanjiRow(r.glyph) !== undefined) continue;
    if (taughtRadicals.has(r.num)) continue;
    taughtRadicals.add(r.num);
    push(r.glyph, null);
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
