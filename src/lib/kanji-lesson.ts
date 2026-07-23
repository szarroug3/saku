// Kanji's curriculum: where the lessons come from when the material has an
// order and no joints in it.
//
// THE PROBLEM THIS DOES NOT SHARE WITH KANA
// =========================================
// src/lib/lesson.ts had it easy and says so: kana arrives pre-cut. `SETS` has
// shipped Tofugu's sections since the port — Vowels あ, K か, S さ — so kana's
// curriculum is a re-publication of a boundary somebody already drew, and that
// file's whole point is that it invents nothing.
//
// Kanji has no such boundary to re-publish. `KANJI_ORDER` is 2,136 items in a
// line: everyday words first, never a kanji before its parts, stroke-count
// aware. It is a very good ORDER and it is not a set of lessons — it has no
// joints, so the moment kana finishes, the app has 2,136 kanji and no unit.
// A boundary has to be INVENTED here. This file is where.
//
// THE UNIT IS DRAW + ASSEMBLY DIFFICULTY, NOT READINGS
// ====================================================
// A count of kanji is the obvious size and it is wrong: 人 (2 strokes, no parts)
// and 鬱 (29 strokes) are not the same amount to learn in a sitting. But the
// cost is not the reading load either — a kanji's readings are learned later,
// in the words that prove them (the words track, a separate thing), not on the
// screen that first teaches the character. What you do on THIS screen is learn
// to draw and recognise a shape, so the cost is what that takes:
//
//   cost(kanji) = (# component radicals you already know)
//               + (strokes not covered by those radicals)
//
// A radical you already know is one thing to place — "remember where it goes" —
// so it costs 1, not its stroke count. Only strokes outside a known radical are
// drawn from scratch. A "known radical" is a component that is itself a jōyō
// kanji (it has its own card); bare strokes (｜ ノ 丶) are not radicals and count
// as drawn. This is why day one is gentle for the RIGHT reason: 人 大 日 一 are
// cheap because they are built from little, not because they carry few readings.
//
//   不 = 4   radical 一, plus ｜ノ丶 drawn        大 = 3   three strokes, no parts
//   乞 = 3   一乙人 all known, nothing left over   生 = 5   five strokes, no parts
//   中 = 2   radical 口, plus one stroke          鬱 = 21  29 strokes, indivisible
//
// WHAT THIS IS NOT, AND WHY NOT — DO NOT RE-DERIVE THESE
// =====================================================
// Not "new components introduced". 96.6% of kanji introduce ZERO, because the
// order's parts-first rule has already paid for every component by the time you
// reach the kanji that uses it — so that term is almost always zero and packs a
// 320-kanji lesson. Not reading load: readings are the words track's, and under
// meaning-only they collapse the size back to a plain count. Draw+assembly is
// the axis that actually varies per kanji AND is about this screen's work.
//
// RADICALS ARE WOVEN IN — ONE TRACK, NOT TWO
// ==========================================
// A kanji is built around a radical, and some radicals are ONLY ever building
// blocks: 气 (steam) is the shape 気 is written around but is not itself a kanji
// you would study on its own. The dedup (src/data/radicals.ts) already taught the
// 116 radicals that ARE their own kanji once, on the kanji card ("Also radical
// N"). What is left is the 98 radical-ONLY shapes, and they used to be a separate
// "Radicals" track that led and gated the kanji track. They are no longer a
// separate track: a radical-only component is pulled INTO THE SAME LESSON SET as
// the first kanji that uses it, taught just before that kanji, so the learner
// meets one track that mixes radicals and kanji rather than two that alternate.
//
// THE ORDERING INVARIANT, AND HOW THE PACKING KEEPS IT
// ====================================================
// A radical must never be taught after a kanji that uses it, and never wastefully
// early either. Both fall out of ONE construction: the atom the packer greedily
// fills a lesson with is not a bundle of kanji, it is a UNIT — a kanji bundle
// with each of its not-yet-taught radical-only components placed immediately
// before the kanji that first needs it (see `packUnits`). A unit is indivisible,
// exactly as a bundle was, so:
//
//   - the radical rides in the SAME set as its first-using kanji, because they
//     are the same unit and a unit is never split across a set boundary. If 気
//     does not fit in a candidate set, 气 does not go there either — the whole
//     unit moves to the set where 気 fits, so 气 is never stranded a set ahead of
//     the kanji that reveals it.
//   - the radical is ordered BEFORE that kanji within the set, because that is
//     where `packUnits` puts it — component-first, so a kanji is never broken
//     into a piece the learner has not seen.
//
// A radical is emitted ONCE, at its first consumer; later kanji filed under the
// same radical find it already met. Radicals no kanji uses (the orphans, and any
// left unconsumed by a non-default order) have no first consumer to ride in with,
// so they are appended after the last kanji, for completeness — see `packUnits`.
//
// WHAT THE COUNT COUNTS. The card's position counts KANJI ("kanji 5–8 of 2,136"):
// that number is a fact about Japanese and does not move. The woven radicals are
// support the learner meets alongside the kanji, labelled as radicals on their
// own tiles, not a second numbered progression — so there is no stale "of 98" and
// nothing is double-counted. The orphan tail, being kanji-less, counts itself as
// radicals with no invented total (see nextKanjiLesson).

import { freshFacts, nextGroup } from "@/lib/budget";
import type { LessonPosition } from "@/lib/lesson-position";
import {
  KANJI_SUBJECT,
  PREREQUISITE_ONLY,
  kanjiRow,
  meaningFactId,
  orderRow,
} from "@/data/kanji";
import {
  isRadicalTaughtAsKanji,
  radicalByGlyph,
  radicalMeaningFactId,
  radicalOfKanji,
  radicalRow,
  type RadicalRow,
} from "@/data/radicals";
import {
  RADICAL_TEACHING_ORDER,
  radicalConsumerCount,
} from "@/lib/radical-order";
import type { FactId, HistoryFile } from "@/types";

/**
 * How long a lesson should be, in draw+assembly cost — the two numbers the
 * owner sets.
 *
 * Same species as `restFirstMin`/`restThenMin` in QuizConfig and the invented
 * constants in src/lib/scoring.ts: taste, not fact, so they live in the config
 * where they can be argued with rather than buried here. This is only the
 * DEFAULT and the shape; the live values ride on QuizConfig.
 */
// LessonRange, its default, and the clamp live in the DATA-FREE
// src/lib/lesson-sizing.ts so the always-mounted QuizConfigProvider can seed a
// config without importing this module's KANJI_ORDER curriculum. Imported for
// this module's own internal use and re-exported so its consumers are unchanged.
import {
  type LessonRange,
  LESSON_RANGE_DEFAULT,
  clampLessonRange,
} from "@/lib/lesson-sizing";

export { type LessonRange, LESSON_RANGE_DEFAULT, clampLessonRange };

/**
 * The draw+assembly cost of one kanji. See the header for the shape and the
 * worked examples; this is that arithmetic and nothing else.
 *
 * `max(0, …)` is not a nicety: KRADFILE decompositions can over-cover (a
 * radical whose stroke count exceeds what it visibly contributes), and a
 * negative "extra" would make a kanji cheaper than its own parts. 0 for a
 * stranger, which packs as nothing.
 */
export function kanjiCost(c: string): number {
  const k = kanjiRow(c);
  if (!k) return 0;
  // A known radical = a component that is itself a jōyō kanji, so it has a card
  // the learner has (or will have) met. Exclude the kanji itself, which some
  // decompositions list among their own parts.
  //
  // COST USES `costParts` (KRADFILE), NOT `comps` (KanjiVG). This is a stroke-
  // level draw-and-assembly estimate the owner calibrated by hand against
  // KRADFILE's decomposition — 不 = radical 一 plus ｜ノ丶 drawn from scratch. The
  // learner-facing `comps` stops at meaningful components and would change every
  // one of those numbers; see KanjiRow.costParts.
  const radicals = k.costParts.filter((x) => x !== c && kanjiRow(x) !== undefined);
  const covered = radicals.reduce((n, r) => n + (kanjiRow(r)?.strokes ?? 0), 0);
  const extra = Math.max(0, k.strokes - covered);
  return radicals.length + extra;
}

/**
 * The draw+assembly cost of one radical-only shape.
 *
 * Same axis as `kanjiCost`, one rung down: a radical-only shape (气, 宀, ノ) is a
 * shape to learn to draw and recognise, and it has no sub-component that is
 * itself a taught kanji or radical to discount — so every stroke is drawn from
 * scratch and the cost IS the stroke count. Small by nature (the 98 average ~4
 * strokes), so weaving one into a lesson nudges the budget rather than blowing
 * it. 0 for a number that names no radical, which packs as nothing.
 */
export function radicalCost(num: number): number {
  return radicalRow(num)?.strokes ?? 0;
}

/**
 * The radical-only component a kanji must meet before it — or null when there is
 * none to teach separately.
 *
 * A kanji is filed under exactly one classical radical (radicalOfKanji). That
 * radical is a separate prerequisite ONLY when it is a radical-only shape: a
 * MERGED radical (一, 人, 水 …) IS its own kanji, taught in the order at the point
 * it is first needed, so it never rides in as a component — it is already a
 * kanji on some card. So this returns the filed-under radical exactly for the 98
 * non-merged shapes (气 for 気, and the 8 both-role early ones like 火 for 点),
 * and null otherwise. See isRadicalTaughtAsKanji in src/data/radicals.ts.
 */
function radicalPrereqOf(c: string): RadicalRow | null {
  const rad = radicalOfKanji(c);
  if (!rad || isRadicalTaughtAsKanji(rad.num)) return null;
  return rad;
}

/**
 * One item on a combined lesson card: a radical-only shape woven in, or a kanji.
 *
 * A single shape carries both roles' fields (the union is small and the card
 * switches on `kind`), rather than two item types the card would branch on
 * everywhere. `fact` is the one meaning fact learning it teaches — a radical's
 * meaning, a kanji's meaning — and the order of items in a group is the order
 * they are taught, each radical before the kanji that first needs it.
 */
export interface LessonItem {
  /** "radical" for a radical-only shape pulled in as a component; "kanji" for a
   * kanji from the order (which may ITSELF be a radical — see `alsoRadical`). */
  kind: "radical" | "kanji";
  /** The glyph to show — 气, 気. Radical:气 and kanji:気 are different entries. */
  glyph: string;
  /** The primary meaning, ready to print. */
  meaning: string;
  /** Draw+assembly cost of this one item — kanjiCost or radicalCost. */
  cost: number;
  /** The meaning fact this item teaches and is drilled on. */
  fact: FactId;
  /**
   * The kanji this one is here FOR, when it is here for nothing else — 取, for
   * 又. Null for a radical and for the ~2,130 kanji that are their own reason.
   * See the KanjiCard note this replaces.
   */
  neededFor: string | null;
  /**
   * The Kangxi number when this KANJI is also a radical (乙 is 5, 水 is 85), so
   * the card can label it "both". Null for a radical-only item (it already reads
   * as a radical) and for the ~2,012 kanji that are not radicals.
   */
  alsoRadical: number | null;
  /**
   * How many jōyō kanji file under this RADICAL — the "why learn it" number a
   * radical tile shows. Null for a kanji item (which is counted, not counted-in).
   */
  appearsIn: number | null;
}

/** One kanji lesson: the material, the cost, and the flag. */
export interface KanjiLessonGroup {
  /** The KANJI taught, in order — the spine the position counts. Radicals woven
   * in are support and are not in here; see `items` for the full teach sequence. */
  chars: string[];
  /**
   * Every item taught, radicals and kanji interleaved in teach order: each
   * radical-only component immediately before the first kanji that uses it. This
   * is what the card renders and what the teach walk steps.
   */
  items: LessonItem[];
  /** Meaning facts — what each item is DRILLABLE on the day it is taught, in
   * teach order (a radical's meaning before the kanji that needs it). A kanji's
   * readings are learned later, in the words that prove them, so they are not in
   * the lesson and do not size it. */
  facts: FactId[];
  /** Draw+assembly cost, summed over the lesson's items (radicals AND kanji). */
  cost: number;
  /**
   * The lesson is a single indivisible bundle that costs more than `max`. It is
   * over the limit and cannot be made smaller — the card says so plainly rather
   * than pretending the number is within range.
   */
  over: boolean;
  /**
   * 1-based ordinal of this lesson in the packing. Internal bookkeeping — how
   * far along the packer is — and NOT for display beside a denominator. There
   * used to be a `total` next to it and the card printed "lesson 1 of 1068";
   * see src/lib/lesson-position.ts for why that number, though correctly
   * computed, was a promise the app could not keep. It has no companion now.
   */
  index: number;
  /**
   * Where this lesson sits in the ORDER, in kanji: 1-based, inclusive, so a
   * four-kanji first lesson is `from: 1, to: 4`. This is what the card shows.
   *
   * Well-defined only because a lesson is a contiguous run of the order —
   * bundles never reorder and the packer only ever cuts between them, which
   * kanji-lesson.test.ts asserts directly rather than leaving to trust. If that
   * ever stopped holding, a span would start describing kanji the lesson does
   * not contain, and the test is what would catch it.
   *
   * Spans the whole GROUP, not the remaining `cards` after a partial claim. A
   * claim removes kanji from the middle of a run, which would make the span
   * describe material that isn't on the card; the group's span is the stable
   * answer to "where in the 2,136 am I", and the card prints the kanji anyway.
   *
   * For a KANJI-less orphan-tail group (radicals no kanji uses, taught after the
   * whole order for completeness), `from`/`to` count that group among the tail's
   * radicals instead — see `spine`.
   */
  from: number;
  to: number;
  /**
   * What `from`/`to` count. "kanji" for every ordinary group (radicals woven in
   * are not counted; the kanji are the numbered spine, "of 2,136"). "radical" for
   * the orphan tail, which has no kanji to count and so counts its own radicals
   * with no invented total. The card reads this to choose the header noun and
   * whether to print a denominator.
   */
  spine: "kanji" | "radical";
}

/**
 * THE PIECE A LESSON IS BUILT FROM: a kanji, and everything dragged in to serve
 * it.
 *
 * `order.json` sequences kanji one at a time, and a packer that walks it one at
 * a time can cut between a kanji and the part that only exists to build it. 又
 * is in the order only because 取 needs it; land the two in different lessons
 * and someone spends a sitting on a shape with no word and nothing to spend it
 * on. src/data/kanji.ts has argued this in its own comment for as long as it has
 * existed — "presenting a part as a lesson is a small lie the user will notice".
 *
 * So the atom is not the kanji, it is the BUNDLE: follow `pulledFor` to its root
 * (a `merit` kanji, one that earned its place on its own everyday-word utility)
 * and group by that root. Take all of it or don't start it.
 *
 * WHY THIS AND NOT A RULE ABOUT PARTS. The obvious version is a special case —
 * "never separate a PREREQUISITE_ONLY kanji from its `pulledFor`" — and it
 * works. It is also a second rule to keep in step with a set that MOVES: it is
 * derived (`enteredVia` + `everydayWords`), and the vocab ingest already took it
 * from 9 to 6. Bundling makes the wordless case fall out for free — a part is in
 * its consumer's bundle BY CONSTRUCTION — so there is nothing to keep in step.
 *
 * IT NEVER REORDERS, and that is checked rather than hoped: every bundle is a
 * contiguous run of the order, so grouping by root only ever brackets
 * neighbours. If that stopped being true this would be reordering the
 * curriculum, which is the one thing it may not do — hence the test.
 */
function bundles(order: readonly string[]): string[][] {
  const at = new Map(order.map((c, i) => [c, i]));
  const byRoot = new Map<string, string[]>();

  for (const c of order) {
    const root = rootOf(c, at);
    const group = byRoot.get(root);
    if (group) group.push(c);
    else byRoot.set(root, [c]);
  }

  return [...byRoot.values()].sort((a, b) => at.get(a[0])! - at.get(b[0])!);
}

/**
 * The kanji a bundle is named for: follow `pulledFor` until something earned its
 * own place.
 *
 * `seen` is not defensive programming, it is the honest answer to a cycle: if
 * the ingest ever emits one, stopping is right and hanging is not. Anything not
 * in THIS order roots at itself — `pulledFor` is a property of how the everyday
 * order was built, and `packLessons` takes any order, so under grade or
 * newspaper order a consumer may simply not be present. Rooting at itself packs
 * it as an ordinary kanji, the truthful answer rather than a reach into a
 * sequence this order isn't.
 */
function rootOf(c: string, at: ReadonlyMap<string, number>): string {
  const seen = new Set<string>();
  let cur = c;
  while (!seen.has(cur)) {
    seen.add(cur);
    const next = orderRow(cur)?.pulledFor;
    if (!next || !at.has(next)) return cur;
    cur = next;
  }
  return cur;
}

const WORDLESS: ReadonlySet<string> = new Set(PREREQUISITE_ONLY);

/** One kanji as a lesson item. */
function kanjiItem(c: string): LessonItem {
  return {
    kind: "kanji",
    glyph: c,
    meaning: kanjiRow(c)?.meanings[0] ?? "",
    cost: kanjiCost(c),
    fact: meaningFactId(c),
    neededFor: WORDLESS.has(c) ? (orderRow(c)?.pulledFor ?? null) : null,
    alsoRadical: radicalByGlyph(c)?.num ?? null,
    appearsIn: null,
  };
}

/** One radical-only shape as a lesson item — a component woven in before the
 * kanji that needs it. */
function radicalItem(r: RadicalRow): LessonItem {
  return {
    kind: "radical",
    glyph: r.glyph,
    meaning: r.meaning,
    cost: radicalCost(r.num),
    fact: radicalMeaningFactId(r.glyph),
    neededFor: null,
    alsoRadical: null,
    appearsIn: radicalConsumerCount(r.num),
  };
}

/**
 * The indivisible ATOM the packer fills a lesson with: a kanji bundle, with each
 * of its not-yet-taught radical-only components placed immediately before the
 * kanji that first needs it. This is the whole of how the ordering invariant is
 * kept — see the file header.
 *
 * A radical is emitted ONCE, at its first consumer (tracked in `emitted` across
 * the whole walk), so a later kanji filed under the same radical finds it already
 * met and adds nothing. Because the component sits in the SAME unit as its
 * first-using kanji, and a unit is never split by `packLessons`, the two always
 * share a set and the component is never a set early — if the kanji does not fit
 * a set, its component does not go there either.
 *
 * ORPHANS LAST. A radical no kanji in `order` consumes (the 16 orphans, plus any
 * a non-default order leaves unconsumed) has no first-using kanji to ride in
 * with. Those are appended after the last kanji, one per unit, in teaching order,
 * so the shelf can still be completed and nothing is taught before its user.
 *
 * Exported for the packing tests, which assert the invariant against these atoms
 * directly rather than trying to recover them from a packed lesson.
 */
export interface CurriculumUnit {
  items: LessonItem[];
  cost: number;
}

export function packUnits(order: readonly string[]): CurriculumUnit[] {
  const units: CurriculumUnit[] = [];
  // Radical numbers already placed — a radical rides in with its FIRST consumer
  // and never again.
  const emitted = new Set<number>();

  for (const bundle of bundles(order)) {
    const items: LessonItem[] = [];
    for (const c of bundle) {
      const rad = radicalPrereqOf(c);
      if (rad && !emitted.has(rad.num)) {
        emitted.add(rad.num);
        items.push(radicalItem(rad));
      }
      items.push(kanjiItem(c));
    }
    units.push({ items, cost: items.reduce((n, it) => n + it.cost, 0) });
  }

  // THE ORPHAN TAIL — and only when the order is complete enough to have earned
  // it. A TRUE orphan is a radical no jōyō kanji uses at all (radicalConsumerCount
  // 0): the 16 shapes like 爿 瓜 韭 that index nothing. Those have no first-using
  // kanji to ride in with, so they are taught after the whole order, for
  // completeness, in teaching order (RADICAL_TEACHING_ORDER already puts them last
  // in Kangxi number order).
  //
  // A radical that DOES have a jōyō consumer but whose consumer is absent from
  // THIS order (a subset — or a one-kanji test pack) is NOT an orphan: nothing in
  // this order uses it, so teaching it here would be teaching a component before
  // any kanji that needs it, the very thing the weave avoids. So the tail is
  // appended only once every consumed radical has been emitted — i.e. the order
  // is the full jōyō, not a subset that happens to be missing most kanji. On a
  // subset order the tail is simply empty, and the pack is just its kanji plus
  // their woven components.
  const allConsumedEmitted = RADICAL_TEACHING_ORDER.every(
    (r) => radicalConsumerCount(r.num) === 0 || emitted.has(r.num),
  );
  if (allConsumedEmitted) {
    for (const r of RADICAL_TEACHING_ORDER) {
      if (radicalConsumerCount(r.num) !== 0 || emitted.has(r.num)) continue;
      const it = radicalItem(r);
      units.push({ items: [it], cost: it.cost });
    }
  }

  return units;
}

/**
 * Cut an order into lessons: greedy, fill toward `max`, never reorder, never
 * split a unit.
 *
 * The whole algorithm is one line of policy: add each UNIT unless it would push
 * the current lesson over `max`, in which case close the lesson and start the
 * next one with it. That single rule already delivers the `min` guarantee — a
 * lesson only ends below `min` when the next unit will not fit or the material
 * has run out, which are exactly the two exceptions the range promises. So `min`
 * is honoured by construction and needs no code of its own; it is the floor the
 * user is told about, and `clampLessonRange` is what keeps it coherent with
 * `max`.
 *
 * A unit is a kanji bundle plus its woven radicals (see `packUnits`), and it is
 * the atom for the same reason the bundle was: splitting it would either separate
 * a wordless part from its consumer or strand a radical a set ahead of the kanji
 * that reveals it. So the "indivisible thing bigger than max becomes its own
 * over-limit lesson" rule now protects the radical-plus-kanji unit, not just the
 * bundle.
 *
 * Greedy and not optimal, on purpose. The order is load-bearing — parts before
 * wholes, everyday words first — and any packing clever enough to beat greedy
 * would have to move a kanji past its own parts to do it.
 *
 * Parametrised on `order` because the order is a SETTING: src/data/kanji.ts
 * publishes `kanjiTeachOrder` for everyday / grade / newspaper, and each is a
 * different curriculum wanting the same cut. Lessons are a function of (order,
 * range), computed, so there is nothing to regenerate when either changes.
 */
export function packLessons(
  order: readonly string[],
  range: LessonRange,
): KanjiLessonGroup[] {
  const { max } = range;
  const packed: Array<{ items: LessonItem[]; cost: number }> = [];
  let items: LessonItem[] = [];
  let cost = 0;

  for (const unit of packUnits(order)) {
    // `items.length &&` is what makes a unit indivisible: the first unit of a
    // lesson is always taken, whatever it costs, so one bigger than `max` on its
    // own becomes its own over-limit lesson rather than being skipped forever.
    // That is the ONLY way `max` is ever exceeded.
    if (items.length && cost + unit.cost > max) {
      packed.push({ items, cost });
      items = [];
      cost = 0;
    }
    items = items.concat(unit.items);
    cost += unit.cost;
  }
  if (items.length) packed.push({ items, cost });

  // The span is a running sum rather than a lookup: the packer consumes the order
  // front to back and every lesson's kanji are a contiguous run of it, so "how
  // many kanji came before this lesson" IS the 0-based position of its first
  // kanji. The orphan tail has no kanji, so it counts its own radicals instead
  // (spine "radical"), with no total to promise.
  let seenKanji = 0;
  let seenTailRadical = 0;
  return packed.map((p, i) => {
    const chars = p.items.filter((it) => it.kind === "kanji").map((it) => it.glyph);
    let from: number;
    let to: number;
    let spine: "kanji" | "radical";
    if (chars.length) {
      from = seenKanji + 1;
      seenKanji += chars.length;
      to = seenKanji;
      spine = "kanji";
    } else {
      // Orphan-tail lesson: all radicals, counted among the tail.
      from = seenTailRadical + 1;
      seenTailRadical += p.items.length;
      to = seenTailRadical;
      spine = "radical";
    }
    return {
      chars,
      items: p.items,
      facts: p.items.map((it) => it.fact),
      cost: p.cost,
      // Over only ever means "one unit, too big to split". A multi-unit lesson
      // can't exceed `max`, because the unit that would have taken it over was
      // pushed to the next lesson instead.
      over: p.cost > max,
      index: i + 1,
      from,
      to,
      spine,
    };
  });
}

/** The whole curriculum for one order and range. Not a stored const — it
 * depends on two settings now — so callers memoise it on those. */
export function kanjiCurriculum(
  order: readonly string[],
  range: LessonRange,
): KanjiLessonGroup[] {
  return packLessons(order, range);
}

/** The next lesson, narrowed to what you have not seen — a mix of radicals and
 * kanji, one combined track. */
export interface KanjiLesson {
  group: KanjiLessonGroup;
  /**
   * Where you are — "kanji 5–8 of 2,136". The card counts KANJI and not lessons
   * (see lesson-position.ts) and not the radicals woven in: those are building
   * blocks the learner meets alongside the kanji, labelled as radicals on their
   * own tiles, not a second numbered progression. That keeps the number a fact
   * about Japanese (the 2,136 does not move and is not padded to 2,234), avoids a
   * stale "of 98", and double-counts nothing.
   *
   * DOES THE 2,136 SWALLOW THE RADICALS? It doesn't count them, and it doesn't
   * need to. A radical woven in is its own tile with its own "radical" label; the
   * position speaks for the kanji spine, and `spine` says so. The orphan tail
   * (radicals no kanji uses) has no kanji to count, so there `spine` is "radical"
   * and `total` is null — a position with no invented denominator.
   */
  position: LessonPosition;
  /** What the position counts, so the card can pick the header noun ("kanji" vs
   * "radicals") and whether to print a total. Mirrors `group.spine`. */
  spine: "kanji" | "radical";
  /** The group's items, minus any already seen or claimed — so a half-claimed
   * lesson yields its remaining half rather than being re-taught whole. Radicals
   * and kanji, in teach order (each radical before the kanji that needs it). */
  cards: LessonItem[];
  facts: FactId[];
  /** Draw+assembly cost, summed over `cards` (the remaining items), not the
   * whole group. */
  cost: number;
  /** The group is a single indivisible unit bigger than the user's max. */
  over: boolean;
}

/**
 * The next lesson, or null when the curriculum is done.
 *
 * A function of history and the two curriculum settings — no cursor, here or on
 * disk, exactly as src/lib/lesson.ts does it for kana. `order` and `range` are
 * config, not state: the same history and the same settings always name the
 * same lesson, so the card and any session that starts it cannot disagree.
 *
 * NO RADICAL GATE ANYMORE. A radical is woven into the group before the kanji it
 * serves (see packUnits), so there is nothing to wait on: the group's facts carry
 * the radical's meaning ahead of the kanji's, and freshFacts/nextGroup select the
 * first group with anything left exactly as they do for a pure-kanji group. A
 * radical the learner already knows is simply not fresh, so it drops off the card
 * while its kanji stay — the same half-claimed behaviour a kanji gets.
 */
export function nextKanjiLesson(
  history: HistoryFile,
  order: readonly string[],
  range: LessonRange,
): KanjiLesson | null {
  const groups = kanjiCurriculum(order, range);
  const fresh = freshFacts(groups.flatMap((g) => g.facts), history);
  const facts = nextGroup(
    groups.map((g) => g.facts),
    fresh,
  );
  if (!facts.length) return null;

  const group = groups.find((g) => g.facts.includes(facts[0]));
  if (!group) return null;

  const left = new Set(facts);
  const cards = group.items.filter((it) => left.has(it.fact));

  return {
    group,
    // The kanji spine reads its denominator off the order (so a subset order, or
    // a 2,137th jōyō revision, counts itself); the orphan tail has no honest
    // total to give and prints none.
    position: {
      from: group.from,
      to: group.to,
      total: group.spine === "kanji" ? order.length : null,
    },
    spine: group.spine,
    cards,
    facts,
    cost: cards.reduce((n, card) => n + card.cost, 0),
    over: group.over,
  };
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { KANJI_SUBJECT };
