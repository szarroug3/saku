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

import { freshFacts, nextGroup } from "@/lib/budget";
import type { LessonPosition } from "@/lib/lesson-position";
import { kanjiRadicalKnown } from "@/lib/radical-known";
import {
  KANJI_SUBJECT,
  PREREQUISITE_ONLY,
  kanjiRow,
  meaningFactId,
  orderRow,
} from "@/data/kanji";
import { radicalByGlyph } from "@/data/radicals";
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

/** One kanji lesson: the material, the cost, and the flag. */
export interface KanjiLessonGroup {
  chars: string[];
  /** Meaning facts — what a kanji is DRILLABLE on the day it is taught. Its
   * readings are learned later, in the words that prove them, so they are not
   * in the lesson and do not size it. */
  facts: FactId[];
  /** Draw+assembly cost, summed over the lesson's kanji. */
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
   */
  from: number;
  to: number;
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

/**
 * Cut an order into lessons: greedy, fill toward `max`, never reorder.
 *
 * The whole algorithm is one line of policy: add each bundle unless it would
 * push the current lesson over `max`, in which case close the lesson and start
 * the next one with it. That single rule already delivers the `min` guarantee —
 * a lesson only ends below `min` when the next bundle will not fit or the
 * material has run out, which are exactly the two exceptions the range promises.
 * So `min` is honoured by construction and needs no code of its own; it is the
 * floor the user is told about, and `clampLessonRange` is what keeps it coherent
 * with `max`.
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
  const packed: Array<{ chars: string[]; cost: number }> = [];
  let chars: string[] = [];
  let cost = 0;

  for (const bundle of bundles(order)) {
    const bundleCost = bundle.reduce((n, c) => n + kanjiCost(c), 0);
    // `chars.length &&` is what makes a bundle indivisible: the first bundle of
    // a lesson is always taken, whatever it costs, so one that is bigger than
    // `max` on its own becomes its own over-limit lesson rather than being
    // skipped forever. That is the ONLY way `max` is ever exceeded.
    if (chars.length && cost + bundleCost > max) {
      packed.push({ chars, cost });
      chars = [];
      cost = 0;
    }
    chars = chars.concat(bundle);
    cost += bundleCost;
  }
  if (chars.length) packed.push({ chars, cost });

  // The span is a running sum rather than a lookup of each lesson's first kanji
  // in `order`: the packer consumes the order front to back and every lesson is
  // a contiguous run of it, so "how many kanji came before this lesson" IS the
  // 0-based position of its first kanji. Counting is the cheaper statement of
  // the same fact, and it cannot disagree with the packing it was counted from.
  let seen = 0;
  return packed.map((p, i) => {
    const from = seen + 1;
    seen += p.chars.length;
    return {
      chars: p.chars,
      facts: p.chars.map(meaningFactId),
      cost: p.cost,
      // Over only ever means "one bundle, too big to split". A multi-bundle
      // lesson can't exceed `max`, because the bundle that would have taken it
      // over was pushed to the next lesson instead.
      over: p.cost > max,
      index: i + 1,
      from,
      to: seen,
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

/** One kanji, ready to render. */
export interface KanjiCard {
  c: string;
  /** The primary meaning. The kanji's own row, not a restatement of it. */
  meaning: string;
  /** Draw+assembly cost of this one kanji. */
  cost: number;
  /**
   * The kanji this one is here FOR, when it is here for nothing else — 取, for
   * 又. Null for nearly all of them, which are their own reason.
   *
   * A screen may say so and should: this kanji appears in no word the app ships,
   * so presenting it as a lesson like any other is a small lie. Because bundling
   * keeps the two together, the kanji named here is always ON THE SAME CARD — so
   * the copy can point at it rather than promise a payoff in some later sitting.
   */
  neededFor: string | null;
  /**
   * The Kangxi number when this kanji is ALSO a radical — 乙 is radical 5, 水 is
   * 85 — so the card can say the character plays both roles. Null for the ~2,012
   * kanji that are not radicals.
   *
   * This is the visible half of the dedup: a both-roles character used to get a
   * radical card AND a kanji card, and now the 116 whose kanji is their radical's
   * first consumer are taught once, here, with this line standing in for the
   * radical card they no longer need (see isRadicalTaughtAsKanji). The 8 that
   * still keep an early radical card also carry the number — it is simply true
   * that they are radicals, and the line reads the same either way.
   */
  alsoRadical: number | null;
}

/** The next kanji lesson, narrowed to what you have not seen. */
export interface KanjiLesson {
  group: KanjiLessonGroup;
  /**
   * Where you are, in KANJI — "5–8 of 2,136". See lesson-position.ts for why
   * the card counts kanji and not lessons.
   *
   * DOES THE 2,136 INCLUDE RADICALS TAUGHT ALONG THE WAY? Yes, and there is
   * nothing extra to add, because this track has no radical pre-cards. A
   * "radical" appears in exactly two places and neither mints a lesson item:
   *
   *   - `kanjiCost` treats a component that is itself a jōyō kanji as costing 1
   *     instead of its strokes. That component is a kanji with its own card,
   *     already in the 2,136, and the order teaches it before the kanji that
   *     leans on it. It is a cost term, not a card.
   *   - `PREREQUISITE_ONLY` — 6 kanji pulled forward only because a later kanji
   *     needs them (又, for 取). Still jōyō, still in the 2,136, and bundling
   *     keeps them on their consumer's card rather than giving them one.
   *
   * Bare strokes (｜ ノ 丶) are not kanji, have no KANJIDIC2 entry and are never
   * taught or drilled; they are drawn, and `kanjiCost` counts them as strokes.
   * So the order's length is the whole of what the track ever teaches, and a
   * separate radical count would have nothing to count.
   */
  position: LessonPosition;
  /** The group's kanji, minus any already seen or claimed — so a half-claimed
   * lesson yields its remaining half rather than being re-taught whole. */
  cards: KanjiCard[];
  facts: FactId[];
  /** Draw+assembly cost, summed over `cards` (the remaining kanji), not the
   * whole group. */
  cost: number;
  /** The group is a single indivisible bundle bigger than the user's max. */
  over: boolean;
}

/**
 * The next kanji lesson, or null when the curriculum is done.
 *
 * A function of history and the two curriculum settings — no cursor, here or on
 * disk, exactly as src/lib/lesson.ts does it for kana. `order` and `range` are
 * config, not state: the same history and the same settings always name the
 * same lesson, so the card and any session that starts it cannot disagree.
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

  // THE RADICAL GATE. A kanji is not taught until the radical it is filed under
  // is known, exactly as a word is not taught until its kanji are (word-lesson.ts
  // returns null the same way). If any kanji in the next group is still waiting on
  // its radical, the kanji track shows nothing new: the radical track leads,
  // teaches those radicals (radical-lesson.ts dueRadicals reads this same group),
  // and the group unlocks on the next pass. Order is preserved because the gate
  // blocks the FIRST fresh group rather than skipping to a later teachable one.
  if (group.chars.some((c) => !kanjiRadicalKnown(c, history))) return null;

  const left = new Set(facts);
  const cards = group.chars.filter((c) => left.has(meaningFactId(c))).map(toCard);

  return {
    group,
    // The denominator is READ OFF the order rather than written down as 2,136,
    // so an order that ever ships a subset (or a 2,137th jōyō revision) counts
    // itself instead of contradicting a constant.
    position: { from: group.from, to: group.to, total: order.length },
    cards,
    facts,
    cost: cards.reduce((n, card) => n + card.cost, 0),
    over: group.over,
  };
}

const WORDLESS: ReadonlySet<string> = new Set(PREREQUISITE_ONLY);

function toCard(c: string): KanjiCard {
  return {
    c,
    meaning: kanjiRow(c)?.meanings[0] ?? "",
    cost: kanjiCost(c),
    neededFor: WORDLESS.has(c) ? (orderRow(c)?.pulledFor ?? null) : null,
    alsoRadical: radicalByGlyph(c)?.num ?? null,
  };
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { KANJI_SUBJECT };
