// Teaching-order RANGED GROUPS — the one cut every shelf that has no cut of its
// own now takes, and the shape of #27.
//
// WHAT THIS IS FOR
// ================
// A shelf is a Kind cut where the cut MEANS something to the reader (see
// components/library/shelves.tsx). Kana comes in gojūon rows, grammar in JLPT
// levels, counters in counter families — real cuts the data carries, and each
// gets clickable group headers for free. Two subjects had no such cut:
//
//   - WORDS had a single "Everyday words" card capped at the first 120, with no
//     select-all header at all. You could see 120 of 12,553 and had to search
//     for the rest, and you could not toggle a group of words into a drill the
//     way a hiragana row toggles.
//   - RADICALS was cut by stroke count, which is how a chart is PRINTED but not
//     the order a learner MEETS them.
//
// The fix is one idea applied to both: order the subject in the sequence it is
// TAUGHT, then break that sequence into consecutive ranges ("1–50", "51–100")
// — exactly the way the kanji shelf already cuts its 2,136 by hundreds. Every
// range is a plain ShelfSection, so it flows through the same generic render as
// every other shelf and inherits the tri-state, select-all header the words card
// never had. That header, for every category, is what #21 asked for.
//
// FULL LIST, NO CAP. The words shelf renders EVERY range — all 12,553 words —
// on purpose: the owner wants to SEE the cost of the naive render before we
// decide whether it needs paying down. `rangedGroups` chunks the whole ordered
// list and hides nothing; the shelf paints all of it. The kanji shelf keeps its
// own three-section search cap (its cut is a setting and 2,136 is its own story);
// this module is not that shelf.
//
// WHERE THE ORDER COMES FROM
// ==========================
// Both browsable subjects now read in the curriculum CLIMB — the order the Learn
// feed actually reaches them — so the shelves agree with the Learn card, where
// 人 is radical 1's kanji 1 and word 1:
//
//   - `curriculumRank` — a glyph's position in CURRICULUM_SEQUENCE, the single
//     spine every radical, kanji and word is woven into (see
//     lib/curriculum-order.ts). Used straight for RADICALS: 214 shapes, each
//     taught at the moment the first character needs it, which is the order this
//     ranks them in.
//   - `wordClimbRank` — the words' climb: `curriculumRank` first, so the ~6,200
//     spine words come in the exact sequence the Learn feed teaches (人 opens the
//     shelf), and `wordRank` as the SECONDARY key for the several thousand words
//     the spine never weaves in (VOCAB is ~12,553, the spine teaches ~6,213).
//     Those tail words share no spine position, so ranked on the spine alone they
//     would all tie at the very end in raw data order (あべこべ, あやふや …);
//     banding them strictly after the spine and then ordering by beginnerRank
//     keeps the ramp `wordRank` always gave them.
//   - `wordRank` — `beginnerRank`, the words' own complete 1..12,553 teaching
//     order. No longer the words shelf's primary order, but still its tie-break
//     tail, and still the key `search`, `usedAsPartIn` and WordsWith sort by, so
//     the Library tells one story about which word comes first.
//
// UNRANKED SORTS LAST, never first. Every rank falls back to +Infinity for a
// glyph the order does not place, so an unranked item lands past every ranked one
// instead of at rank 0 — which is precisely how あべこべ once opened the words
// shelf. Ties (and the all-unranked case) fall back to input order, so the cut is
// stable.
//
// It lives in a .ts, apart from the JSX, so the test runner (Node's type
// stripper, no JSX) can hold the properties that matter: the groups tile the
// whole ordered list with no gap, no overlap and no duplicate, and the order is
// the teaching order it claims to be.

import { CURRICULUM_GLYPHS, curriculumPosition } from "@/lib/library/library-index";
import { wordBeginnerRank } from "@/lib/word-rank";
import type { LibEntry } from "@/lib/library/entries";
import type { ShelfSection } from "@/lib/library/shelf-view";

/**
 * How many entries a range holds.
 *
 * 50 is a round number you can count in your head, and it makes the labels
 * ("1–50", "51–100") readable without a legend — the same argument the kanji
 * shelf makes for its hundreds, one notch smaller because a word tile carries
 * more than a kanji glyph and a shorter range reads less like a wall.
 */
export const GROUP_SIZE = 50;

/** An item the order does not place sorts LAST, not first — see the header. */
const UNRANKED = Number.POSITIVE_INFINITY;

/**
 * How long the spine is, so a non-spine word can be banded strictly after every
 * spine word (see `wordClimbRank`) without a magic number: a spine position is
 * always < SPINE_SIZE, so SPINE_SIZE + anything can never slip in front of one.
 */
const SPINE_SIZE = CURRICULUM_GLYPHS.length;

/**
 * Where a radical or kanji sits in the curriculum spine — its
 * `curriculumPosition`, with anything the spine does not teach pushed past the
 * end. One item per glyph in the spine, so the rank is unambiguous.
 */
export function curriculumRank(entry: LibEntry): number {
  const p = curriculumPosition(entry.glyph);
  return p === -1 ? UNRANKED : p;
}

/**
 * A word's place in the beginner's teaching order — its `beginnerRank`, the
 * complete 1..12,553 ranking (see the header for why it, and not the spine, is
 * the words' order). Unranked words sort last.
 */
export function wordRank(entry: LibEntry): number {
  return wordBeginnerRank(entry.glyph) ?? UNRANKED;
}

/**
 * A word's place in the curriculum CLIMB — the words shelf's order, so it reads
 * in the sequence the Learn feed teaches instead of by frequency. A composite
 * rank (not a comparator) so it flows through the same `rangedGroups(entries,
 * rank)` the radicals shelf takes:
 *
 *   - A word the spine weaves in ranks at its spine position (`curriculumRank`).
 *     人 is spine item 0, so it opens the shelf, matching the Learn card's
 *     "word 1" — where before frequency buried it.
 *   - A word the spine never teaches has no spine position, so it is banded
 *     strictly after every spine word (SPINE_SIZE + …) and ordered within that
 *     tail by `wordRank` (beginnerRank), the sensible ramp it always had, rather
 *     than tying at the end in raw data order.
 */
export function wordClimbRank(entry: LibEntry): number {
  const spine = curriculumRank(entry);
  if (spine !== UNRANKED) return spine;
  return SPINE_SIZE + wordRank(entry);
}

/**
 * `entries` ordered by `rank` (ascending, ties broken by input order so the cut
 * is stable), then chunked into consecutive ranges of `size`, each labelled by
 * the 1-based span it covers ("1–50", "51–100", and a short tail).
 *
 * Every entry lands in exactly one range and no range is empty, so the groups
 * tile the whole ordered list — the property the tests hold. The EN DASH matches
 * the app's counters ("kanji 1–4 of 2,136"), which count items in a range.
 */
export function rangedGroups(
  entries: readonly LibEntry[],
  rank: (entry: LibEntry) => number,
  size: number = GROUP_SIZE,
): ShelfSection[] {
  // A decorate–sort–undecorate, so the tie-break is the ORIGINAL index and not
  // whatever order a comparator returning 0 happens to leave behind.
  const ordered = entries
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => rank(a.entry) - rank(b.entry) || a.i - b.i)
    .map((x) => x.entry);

  const groups: ShelfSection[] = [];
  for (let start = 0; start < ordered.length; start += size) {
    const slice = ordered.slice(start, start + size);
    groups.push({
      id: `range-${start + 1}`,
      label: `${start + 1}–${start + slice.length}`,
      entries: slice,
    });
  }
  return groups;
}
