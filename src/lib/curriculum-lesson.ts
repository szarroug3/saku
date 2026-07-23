// The lessons the app teaches: ONE track, cut from the one ordered spine.
//
// WHAT CHANGED, AND WHY IT HAD TO
// ===============================
// The app used to run two schedulers over the same climb. kanji-lesson.ts cut
// the 2,136 jōyō into cost-sized sets and wove each set's radical-only shapes
// in; word-lesson.ts walked beginnerRank and handed out whatever was teachable
// once the kanji track had paid for it. Two cards, two position counters, two
// answers to "what is next". The learner was doing one climb and reading two
// odometers, and the words card spent most of its life saying "you are 12 kanji
// away". That is a scheduler apologising for the other scheduler.
//
// curriculum-order.ts settled that: CURRICULUM_SEQUENCE is every radical, kanji
// and word in the single order a learner meets them, prerequisites first. This
// file is the only thing that has to happen next. Cut that line into lessons,
// and answer "what is the next unlearned one" from history.
//
// THE ATOM: A WELD RUN
// ====================
// The sequence carries one hard promise for the packer, and it is `tiedTo`: a
// radical-only shape pulled in as a component sits immediately before the kanji
// it is welded to, and the two may not be split across a lesson boundary. 气 is
// not a sitting a learner would sit through on its own; it is the piece 気 is
// written around and it means nothing until 気 arrives.
//
// So the atom is a WELD RUN: every consecutive tied item, plus the untied item
// that closes the run. Untied items with nothing tied to them are runs of one,
// which is most of the sequence. A kanji PREREQUISITE gets no weld. 人 is a
// lesson in its own right and 何 is happy to meet it a week earlier, so the
// packer is free to put a hundred items between them, which is exactly the
// freedom the sequence's `tiedTo: null` grants.
//
// Nothing here re-derives the weld or the order. The sequence says what must be
// true; this file only decides where the cuts fall.
//
// WHAT A WORD COSTS, AND WHY IT IS NOT A STROKE COUNT
// ===================================================
// The kanji cost model (kanjiCost / radicalCost in kanji-lesson.ts) measures
// DRAW AND ASSEMBLY: how many known pieces to place, plus how many strokes are
// left to draw from scratch. It is the right axis for a shape and it is the
// wrong axis for a word. 電車 is 21 strokes and not one of them is new work: 電
// and 車 are prerequisites, taught earlier in this same sequence, so by the time
// the word arrives there is nothing left to learn to draw. Costing a word by its
// strokes would price 電車 at four kanji and price あなた at nothing, and neither
// number is about the work the learner actually does, which is attaching a
// meaning and a reading to shapes they already have.
//
// So a word costs a FLAT amount, and the amount is not invented here. The app
// already shipped two budgets for one sitting, and they are the two halves of
// the answer:
//
//   the kanji track    a sitting is LESSON_RANGE_DEFAULT.max = 12 cost
//   the words track    a sitting is WORDS_PER_LESSON_DEFAULT = 6 words
//
// Both were set by the owner, describing the same length of sitting in two
// units, so the exchange rate between the units is already decided: 12 cost buys
// 6 words, and one word is 2. WORD_COST is that division, so it is not a third
// number to keep in step: a change to either default carries through, and the
// two budgets cannot quietly fall out of agreement.
//
// The two defaults, not the live config. This is a conversion between units, not
// a lesson length: a learner who drags the cost slider to 20 is asking for a
// longer sitting, not for a word to become worth more of one.
//
// A FOLDED ITEM PAYS FOR BOTH ROLES. 山 is a radical, a kanji and a word in one
// item (see curriculum-order.ts), and teaching it is genuinely the drawing work
// AND the word: three facts go into the drill. So an item's cost is its shape
// cost plus, when it carries the word role, WORD_COST. The shape cost follows
// what the kanji track already did: a both-role character is priced as its
// kanji (kanjiCost), never charged twice, and only a radical-only shape is
// priced as a radical.
//
// THE WORD GATE IS GONE, BECAUSE THE ORDER ATE IT
// ===============================================
// word-lesson.ts had to ask, of every word, whether every kanji in it was known
// yet, and step over the ones that were not. On the spine there is nothing to
// ask: a word's kanji are ordered before the word, so they are in this lesson
// ahead of it or in a lesson already taught. Teaching the sequence in order IS
// the gate, so `wordTeachable` is now an invariant the tests check. It is no
// longer a filter any scheduler runs.

import { freshFacts, nextGroup } from "@/lib/budget";
import {
  PREREQUISITE_ONLY,
  kanjiRow,
  meaningFactId,
  orderRow,
} from "@/data/kanji";
import { radicalByGlyph, radicalMeaningFactId } from "@/data/radicals";
import {
  isKanaWord,
  vocabRow,
  wordMeaningFactId,
  wordReadingFactId,
} from "@/data/vocab";
import { kanjiCost, radicalCost } from "@/lib/kanji-lesson";
import {
  CURRICULUM_SEQUENCE,
  type CurriculumItem,
  type CurriculumRole,
} from "@/lib/curriculum-order";
import {
  LESSON_RANGE_DEFAULT,
  WORDS_PER_LESSON_DEFAULT,
  type LessonRange,
} from "@/lib/lesson-sizing";
import type { CompositePosition, LessonPosition } from "@/lib/lesson-position";
import type { FactId, HistoryFile } from "@/types";

/**
 * What one word costs a lesson, in the kanji track's cost units.
 *
 * The app's two sitting-length budgets, divided into each other: 12 cost per
 * sitting over 6 words per sitting is 2. See the header for why it is a division
 * and not a declared number. Floored at 1 so a hand-edited default can never
 * price a word at nothing and let one lesson swallow the whole vocabulary.
 */
export const WORD_COST = Math.max(
  1,
  Math.round(LESSON_RANGE_DEFAULT.max / WORDS_PER_LESSON_DEFAULT),
);

/** One item on a lesson card: a glyph, every role it plays, and what learning it
 * teaches. The spine's item, with the display and drill data joined on. */
export interface CurriculumLessonItem {
  /** The glyph to show: 气, 気, 電車, あなた. */
  glyph: string;
  /** Every role it plays, in the sequence's fixed radical/kanji/word order. The
   * card reads this to choose the tile and the link; the per-tile role LINE is
   * read off the glyph by character-role.ts, as it always was. */
  roles: readonly CurriculumRole[];
  /** The primary meaning, ready to print. */
  meaning: string;
  /**
   * The reading to print, for an item taught as a word that is written with
   * kanji; null otherwise.
   *
   * A kanji tile still prints no reading, for the reason the kanji card has
   * always given: the reading is the answer a later word will ask for, and a card
   * that shows the answer has spent the question. A WORD's reading is different.
   * It is this lesson's own material, drilled the moment the lesson ends, so it
   * is shown, exactly as the words card showed it. A kana word is its own
   * reading, so it has none to print.
   */
  reading: string | null;
  /** What this item adds to the lesson's budget. See WORD_COST. */
  cost: number;
  /** The facts learning it teaches, in teach order: the shape's meaning first,
   * then the word's meaning and reading. */
  facts: FactId[];
  /**
   * The kanji this one is here FOR, when it is here for nothing else: 取, for
   * 又. Null for everything that is its own reason. This is a reason it is on the
   * card, and not a role.
   */
  neededFor: string | null;
}

/** One lesson: the material, what it costs, and where it sits. */
export interface CurriculumLessonGroup {
  /** Every item taught, in the sequence's order, so a welded radical is always
   * ahead of the kanji it belongs to and a word is always behind its kanji. */
  items: CurriculumLessonItem[];
  /** Every fact the lesson teaches, in teach order. */
  facts: FactId[];
  /** The lesson's budget, summed over its items. */
  cost: number;
  /** A single weld run that costs more than `max`, so it could not be made
   * smaller. The card says so, and does not pretend the number is in range. */
  over: boolean;
  /** 1-based ordinal of the lesson in the packing. Bookkeeping, never for
   * display beside a denominator. See lesson-position.ts for why a lesson count
   * is a promise the app cannot keep. */
  index: number;
  /** Where the lesson sits, one span per role it teaches. See position(). */
  position: CompositePosition;
}

/** The kanji pulled into the order only to build a later kanji, with no everyday
 * word of their own. The reason a tile can say "you need this for 取". */
const WORDLESS: ReadonlySet<string> = new Set(PREREQUISITE_ONLY);

/**
 * How many items the curriculum teaches in each role: the denominators on the
 * card.
 *
 * COUNTED off the sequence, never typed in. They are properties of the shipped
 * tables (90 radical-only shapes, 2,136 jōyō kanji, 6,213 curriculum words) and
 * the whole point of counting an item, and never a lesson, is that the number
 * does not move when a setting does. It SHOULD move when the data moves, which
 * is exactly what a hard-coded 2,136 would hide.
 *
 * A radical counts toward `radical` only when the character is not also a kanji.
 * 山 is a Kangxi radical and a jōyō kanji and a word, and it is taught once, as a
 * character: counting it among the radicals as well would inflate a denominator
 * with a shape that is already in the kanji one. So `radical` is the radical-ONLY
 * shapes, which is the set the spine ever teaches as a radical of its own.
 */
export const CURRICULUM_TOTALS: Readonly<Record<CurriculumRole, number>> =
  countRoles(CURRICULUM_SEQUENCE);

function countRoles(
  items: readonly { roles: readonly CurriculumRole[] }[],
): Record<CurriculumRole, number> {
  const totals: Record<CurriculumRole, number> = { radical: 0, kanji: 0, word: 0 };
  for (const it of items) {
    if (countsAsRadical(it.roles)) totals.radical++;
    if (it.roles.includes("kanji")) totals.kanji++;
    if (it.roles.includes("word")) totals.word++;
  }
  return totals;
}

/** Taught as a radical in its own right, meaning a radical-only shape. A
 * character that is also a kanji is taught as its kanji, wearing the radical
 * label. */
function countsAsRadical(roles: readonly CurriculumRole[]): boolean {
  return roles.includes("radical") && !roles.includes("kanji");
}

/**
 * The facts one item teaches, in the order the walk should meet them.
 *
 * The shape's meaning comes first when there is one, because that is what the
 * character IS; the word's meaning and reading follow. A both-role character
 * mints the KANJI meaning fact and not the radical one, which is what the kanji
 * track already did: 山 has a kanji card that says "also radical 46", and a
 * second radical:山 card would be the same shape taught twice. A kana word has
 * no reading fact, because it is its own reading (see buildVocabFacts).
 */
function factsOf(item: CurriculumItem): FactId[] {
  const facts: FactId[] = [];
  if (item.roles.includes("kanji")) facts.push(meaningFactId(item.glyph));
  else if (item.roles.includes("radical")) facts.push(radicalMeaningFactId(item.glyph));
  if (item.roles.includes("word")) {
    facts.push(wordMeaningFactId(item.glyph));
    const row = vocabRow(item.glyph);
    if (row && !isKanaWord(row)) facts.push(wordReadingFactId(item.glyph));
  }
  return facts;
}

/** What the item costs. The shape priced by the kanji track's own model, plus a
 * flat WORD_COST when the item is also a word. See the header. */
function costOf(item: CurriculumItem): number {
  let cost = 0;
  if (item.roles.includes("kanji")) cost += kanjiCost(item.glyph);
  else if (item.roles.includes("radical")) {
    cost += radicalCost(radicalByGlyph(item.glyph)?.num ?? 0);
  }
  if (item.roles.includes("word")) cost += WORD_COST;
  return cost;
}

/** What to print under the glyph. The kanji's meaning when there is one, because
 * the tile is a character first; the word's first gloss when there is not. */
function meaningOf(item: CurriculumItem): string {
  if (item.roles.includes("kanji")) return kanjiRow(item.glyph)?.meanings[0] ?? "";
  if (item.roles.includes("radical")) return radicalByGlyph(item.glyph)?.meaning ?? "";
  return vocabRow(item.glyph)?.glosses[0] ?? "";
}

/** The reading to print: a word's, and only when the word is not itself kana and
 * not a single character being taught as its kanji. See `reading`. */
function readingOf(item: CurriculumItem): string | null {
  if (!item.roles.includes("word")) return null;
  if (item.roles.includes("kanji")) return null;
  const row = vocabRow(item.glyph);
  if (!row || isKanaWord(row)) return null;
  return row.reb;
}

function lessonItem(item: CurriculumItem): CurriculumLessonItem {
  return {
    glyph: item.glyph,
    roles: item.roles,
    meaning: meaningOf(item),
    reading: readingOf(item),
    cost: costOf(item),
    facts: factsOf(item),
    neededFor: WORDLESS.has(item.glyph) ? (orderRow(item.glyph)?.pulledFor ?? null) : null,
  };
}

/**
 * The indivisible atom: a run of welded items and the item that closes it.
 *
 * Exported so the packing tests can assert the weld against these directly,
 * with no need to recover them from a packed lesson.
 */
export interface CurriculumUnit {
  items: CurriculumLessonItem[];
  cost: number;
}

/**
 * Cut the sequence into weld runs.
 *
 * A tied item is held back; the next untied item closes the run and the whole
 * run is emitted together. That is the entire enforcement of the hard invariant,
 * and it needs no lookup: the sequence already guarantees a tied item sits
 * immediately before the kanji it is welded to, so the untied item that closes a
 * run IS that kanji. A trailing tie with nothing to close it (which the sequence
 * never produces) still lands in a unit of its own, and is never dropped.
 */
export function packUnits(
  sequence: readonly CurriculumItem[] = CURRICULUM_SEQUENCE,
): CurriculumUnit[] {
  const units: CurriculumUnit[] = [];
  let pending: CurriculumLessonItem[] = [];

  const close = (items: CurriculumLessonItem[]) => {
    units.push({ items, cost: items.reduce((n, it) => n + it.cost, 0) });
  };

  for (const item of sequence) {
    const built = lessonItem(item);
    if (item.tiedTo !== null) {
      pending.push(built);
      continue;
    }
    close([...pending, built]);
    pending = [];
  }
  if (pending.length) close(pending);
  return units;
}

/**
 * Pack the sequence into lessons: greedy, fill toward `max`, never reorder,
 * never split a unit.
 *
 * The same one line of policy the kanji packer ran on, over the wider atom: add
 * each unit unless it would push the lesson over `max`, in which case close the
 * lesson and open the next one with it. `min` is honoured by construction, so it
 * needs no code of its own: a lesson ends below it only when the next unit will
 * not fit or the material has run out, which are the two exceptions the range
 * promises.
 *
 * Greedy and not optimal, deliberately. The order is load-bearing (a component
 * before what it builds, a kanji before the word written with it), and a packing
 * clever enough to beat greedy would have to move an item past its own
 * prerequisite to do it.
 */
export function packLessons(
  range: LessonRange,
  sequence: readonly CurriculumItem[] = CURRICULUM_SEQUENCE,
): CurriculumLessonGroup[] {
  const { max } = range;
  const packed: Array<{ items: CurriculumLessonItem[]; cost: number }> = [];
  let items: CurriculumLessonItem[] = [];
  let cost = 0;

  for (const unit of packUnits(sequence)) {
    // `items.length &&` is what makes a unit indivisible: the first unit of a
    // lesson is always taken, whatever it costs, so one bigger than `max` on its
    // own becomes its own over-limit lesson, and is never skipped forever.
    // That is the only way `max` is ever exceeded.
    if (items.length && cost + unit.cost > max) {
      packed.push({ items, cost });
      items = [];
      cost = 0;
    }
    items = items.concat(unit.items);
    cost += unit.cost;
  }
  if (items.length) packed.push({ items, cost });

  // The spans are running sums and not lookups: the packer consumes the
  // sequence front to back and every lesson is a contiguous run of it, so "how
  // many kanji came before this lesson" IS the count so far.
  const seen: Record<CurriculumRole, number> = { radical: 0, kanji: 0, word: 0 };
  return packed.map((p, i) => ({
    items: p.items,
    facts: p.items.flatMap((it) => it.facts),
    cost: p.cost,
    // Over only ever means "one unit, too big to split". A multi-unit lesson
    // cannot exceed `max`, because the unit that would have taken it over was
    // pushed into the next lesson instead.
    over: p.cost > max,
    index: i + 1,
    position: position(p.items, seen),
  }));
}

/**
 * Where a lesson sits, one span per role it actually teaches.
 *
 * Advances `seen` as a side effect, which is why it is called once per lesson in
 * packing order and nowhere else. A role the lesson does not teach gets null and
 * prints no segment at all, so a words-only lesson reads "Word 12 of 6,213" and
 * says nothing about kanji it is not teaching.
 */
function position(
  items: readonly CurriculumLessonItem[],
  seen: Record<CurriculumRole, number>,
): CompositePosition {
  const counts = countRoles(items);
  const span = (role: CurriculumRole): LessonPosition | null => {
    if (counts[role] === 0) return null;
    const from = seen[role] + 1;
    seen[role] += counts[role];
    return { from, to: seen[role], total: CURRICULUM_TOTALS[role] };
  };
  return { radical: span("radical"), kanji: span("kanji"), word: span("word") };
}

/**
 * The whole curriculum at one lesson length.
 *
 * Memoised on the range, because the packing is a pure function of the shipped
 * sequence and that one setting, and the home feed asks for it on every render.
 * One entry is enough in practice, since a range changes only when the user
 * drags a slider, so this is a cache of one and not a growing map.
 */
let cached: { range: LessonRange; groups: CurriculumLessonGroup[] } | null = null;

export function curriculum(range: LessonRange): CurriculumLessonGroup[] {
  if (cached && cached.range.min === range.min && cached.range.max === range.max) {
    return cached.groups;
  }
  const groups = packLessons(range);
  cached = { range, groups };
  return groups;
}

/** The next lesson, narrowed to what you have not met. */
export interface CurriculumLesson {
  group: CurriculumLessonGroup;
  /** Where you are, one segment per role on the card. */
  position: CompositePosition;
  /** The group's items, minus any already met or claimed, so a half-claimed
   * lesson yields its remaining half and is not taught whole again. */
  cards: CurriculumLessonItem[];
  facts: FactId[];
  /** Cost of `cards`, the remaining items, not of the whole group. */
  cost: number;
  /** The group is a single unit bigger than the user's max. */
  over: boolean;
}

/**
 * The next lesson, or null when the curriculum is done.
 *
 * A function of history and the one curriculum setting, with no cursor here or
 * on disk, exactly as lesson.ts does it for kana. The same history and the same
 * range always name the same lesson, so the card and any session started from it
 * cannot disagree.
 *
 * The frontier logic is `freshFacts` and `nextGroup` from budget.ts, unchanged
 * and not re-implemented: the first group with anything left in it is the next
 * lesson, and an item the learner already claimed drops off the card while its
 * neighbours stay.
 *
 * The POSITION is the whole group's, not the remaining cards'. A claim removes
 * items from the middle of a run, and a span rebuilt from what is left would
 * describe material that is not on the card. "Where in the climb am I" is a
 * question about the lesson, and the card prints the items anyway.
 */
export function nextCurriculumLesson(
  history: HistoryFile,
  range: LessonRange,
): CurriculumLesson | null {
  const groups = curriculum(range);
  const fresh = freshFacts(groups.flatMap((g) => g.facts), history);
  const facts = nextGroup(
    groups.map((g) => g.facts),
    fresh,
  );
  if (!facts.length) return null;

  const group = groups.find((g) => g.facts.includes(facts[0]));
  if (!group) return null;

  const left = new Set(facts);
  const cards = group.items.filter((it) => it.facts.some((f) => left.has(f)));

  return {
    group,
    position: group.position,
    cards,
    facts,
    cost: cards.reduce((n, card) => n + card.cost, 0),
    over: group.over,
  };
}

/** The written forms this lesson teaches as WORDS: what the reading unlock is
 * owed when the lesson is started or claimed (see word-unlock.ts). Learning a
 * word is what makes its kanji's readings fair game, and that follows from
 * meeting the word, never from which button was pressed. */
export function lessonWords(cards: readonly CurriculumLessonItem[]): string[] {
  return cards.filter((c) => c.roles.includes("word")).map((c) => c.glyph);
}
