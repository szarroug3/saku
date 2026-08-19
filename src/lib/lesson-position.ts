// Where a lesson card says you are: COUNT THE ITEMS, NEVER THE LESSONS.
//
// WHY THIS FILE EXISTS AT ALL
// ===========================
// Every lesson card wants a one-line "where am I" label, and every track got
// there independently and got it wrong in its own way. Kanji printed "lesson 1
// of 1068". Words printed "lesson 1" with no total. Grammar printed "lesson 1"
// and wrote a comment explaining why it declined to print a total. Three
// different answers to one question is the tell that the question had never
// been settled. It is settled here, once, and the three cards read off it.
//
// WHAT WAS WRONG WITH "LESSON 1 OF 1068"
// ======================================
// 1068 was not a bug and it was not half of 2,136. It is `packed.length` from
// kanji-lesson.ts — the real number of groups the packer cuts the 2,136 jōyō kanji
// into. Reproduced exactly: at the default range {min:6,max:12} over the
// everyday order it is 1068 lessons, and it is arithmetically honest. (The
// resemblance to 2136/2 is coincidence — the packer averages almost exactly
// two kanji per lesson at that range, and nothing makes it do so.)
//
// It is still a promise the app cannot keep, because the number is a function
// of a SETTINGS SLIDER. The same 2,136 jōyō kanji pack into:
//
//   max=6  -> 1793 lessons      max=12 -> 1068 lessons (the default)
//   max=8  -> 1512 lessons      max=16 ->  772 lessons
//   max=10 -> 1250 lessons      max=20 ->  597 lessons
//
// A learner who nudges "lesson length" one notch watches 1068 become 1250 and
// has learned nothing new — the denominator moved and the material did not.
// Change the teaching order instead and it drifts again (everyday 1068, grade
// 1063, newspaper 1066) for a curriculum containing exactly the same kanji.
// That is the "生: 61%" failure the codebase already names: a number that is
// true of nothing, because the thing it counts is an artifact of how the
// material was sliced rather than a property of the material.
//
// THE MATERIAL IS THE ONLY STABLE THING, SO COUNT THE MATERIAL
// ============================================================
// 2,136 kanji is a fact about Japanese. 6,213 curriculum words is a fact about
// the ingest. 53 drillable patterns is a fact about this app's own recipe
// table. None of the three moves when a slider moves, so all three can be
// promised. The position within them is likewise an item count — "you have met
// 4, here are your 5th through 8th" — which survives any repacking.
//
// AND A LESSON TEACHES SEVERAL AT ONCE, SO SHOW A RANGE
// ====================================================
// "Kanji 5 of 2,136" on a card holding four kanji is a fresh small lie of the
// same family. The card teaches 5, 6, 7 and 8, so it says so:
//
//   Kanji 5–8 of 2,136
//   Words 12 of 6,213        (one item -> no range, not "12–12")
//   Patterns 3–7 of 53
//
// A track with no derivable total prints the position alone ("Kanji 5–8")
// rather than reach for a number it would have to invent. `total` is optional
// here for exactly that case; today all three tracks can answer.
//
// THIS FILE ONLY FORMATS. SEE advancePosition() FOR THE ONE SAFE WAY TO COMPUTE
// =================================================================
// Everything above renders a `{from, to, total}` this file is handed — it computes
// nothing, so it cannot itself get "how far into the curriculum am I" wrong. The
// bug that this file's callers have to avoid lived entirely upstream, in whatever
// built that struct (SAK-13): "Kanji 1–639 of 2,136" printed from a history where
// only 5 kanji had actually been taught, because the Library's "I already know
// this" lets a learner claim an item OUT OF the normal lesson delivery order, and
// the code computing the span rebuilt it from whatever was left in a
// claim-filtered remainder — which is neither contiguous nor small once claims
// scatter through the middle of the curriculum.
//
// THE INVARIANT: a position is a property of the STATIC CURRICULUM ORDER, counted
// ONCE, up front, over every item/group in the whole track — never rebuilt at
// render time from whatever the current history has NOT yet claimed. Concretely:
//
//   SAFE   — pack (or otherwise fix) the whole track into its groups once,
//            independent of any one learner's history, and walk that fixed
//            packing front-to-back summing counts as you go (advancePosition,
//            below). A claim only ever crosses an item off inside whichever
//            frozen group it already belongs to; it can never move the group's
//            `from`/`to`/`total`, however out of order the claim was.
//   UNSAFE — filter the track down to "what's left" (or "what's left in this
//            group") and derive `from`/`to` from THAT filtered list's size or
//            position. An out-of-order claim changes what's left non-
//            contiguously, and a span built from it describes material that may
//            not even be on the card (see curriculum-lesson.ts's own comment on
//            nextCurriculumLesson, and the "half-claimed lesson" test in
//            curriculum-lesson.test.ts).
//
// curriculum-lesson.ts's `position()` is the reference implementation of the safe
// side: `curriculum(range)` packs and positions the ENTIRE track exactly once
// (memoized on the range, not on history), and nextCurriculumLesson always hands
// back that frozen `group.position`, never a span rebuilt from `cards` (the
// claim-filtered remainder actually on the card). Route any new "N of M" through
// the same shape: freeze positions over the static order first, look them up by
// group second. Do not invent a second way of answering "how far in am I" — see
// advancePosition() below, which is that file's own counting step, pulled out
// here so it has one home and one set of tests instead of being reinvented per
// track.
//
// A track whose own delivery order does NOT match the curriculum order it would
// be counted against (home-feed's vocab card, scheduled by spoken frequency) has
// no safe span to print at all, in-order claims or not — see vocabPositionLabel's
// comment in home-feed.tsx for why printing nothing beats printing a lie, and
// treat `CURRICULUM_GLYPHS` (learn-index-types.ts) as exactly this trap: it is a
// glyph's fixed RANK, not a lesson's honest SPAN, and taking the min/max rank of a
// frequency-ordered lesson's items reproduces this exact bug in a new location.

/**
 * A lesson's place in its curriculum, in ITEMS.
 *
 * `from`/`to` are 1-based and inclusive, and `from === to` is the ordinary
 * single-item lesson rather than a degenerate range.
 */
export interface LessonPosition {
  /** 1-based position of the first item this lesson covers. */
  from: number;
  /** 1-based position of the last, inclusive. Equal to `from` for one item. */
  to: number;
  /** How many items the track teaches in total, or null when the track cannot
   * derive one. Null prints the position with no denominator — see the header:
   * a missing number beats an invented one. */
  total: number | null;
}

/**
 * Render a position as the card's label: "kanji 5–8 of 2,136".
 *
 * `noun` is passed in rather than derived because the tracks disagree about
 * what an item IS, and that disagreement is the point: grammar's items are
 * PATTERNS, not lessons and not sentences, so its card must say "patterns".
 *
 * En dash, not hyphen: this is a numeric range, and 5-8 reads as arithmetic at
 * a glance. Thousands separators via toLocaleString for the same reason
 * by-subject.tsx uses them — "of 2136" is a token, "of 2,136" is a quantity.
 */
export function positionLabel(noun: string, pos: LessonPosition): string {
  const span =
    pos.from === pos.to
      ? pos.from.toLocaleString()
      : `${pos.from.toLocaleString()}–${pos.to.toLocaleString()}`;
  const of = pos.total === null ? "" : ` of ${pos.total.toLocaleString()}`;
  return `${noun} ${span}${of}`;
}

// ONE LESSON, SEVERAL KINDS OF THING, SO SEVERAL SEGMENTS
// =======================================================
// The curriculum is one spine now (src/lib/curriculum-order.ts), and a single
// lesson can teach a radical-only shape, the kanji it is welded to, and a word
// written with kanji already learned. "Kanji 5 of 2,136" over a card holding all
// three is the small lie this file was written to stop: it names one of the
// numbers and silently drops the other two, so the learner counts three tiles
// against a span of one.
//
// So the label carries ONE SEGMENT PER KIND THE LESSON ACTUALLY TEACHES:
//
//   Radical 3–4 of 90 · Kanji 5–8 of 2,136 · Word 12 of 6,213
//
// Every segment is the same item count against the same immovable denominator
// positionLabel already prints, so nothing about the rule above changes. Only
// the kinds present appear: a words-only lesson reads "Word 12 of 6,213" and
// says nothing about kanji it is not teaching, which is the same instinct as
// declining to print a total the track cannot derive.
//
// The order is fixed at radical, kanji, word: it is the order the material
// arrives in inside the lesson (a component before what it builds, a kanji
// before the word written with it), so the label reads the way the card does.

/**
 * Where a mixed lesson sits: a span per role, or null for a role it does not
 * teach. Never all three null, because a lesson always teaches something.
 */
export interface CompositePosition {
  radical: LessonPosition | null;
  kanji: LessonPosition | null;
  word: LessonPosition | null;
}

/** The nouns, singular and capitalised: a segment names a KIND of item, and the
 * count beside it says how many. "Kanji 5–8" reads the same for one or four. */
const COMPOSITE_NOUNS: readonly (readonly [keyof CompositePosition, string])[] = [
  ["radical", "Radical"],
  ["kanji", "Kanji"],
  ["word", "Word"],
];

/**
 * Render a mixed lesson's position: "Radical 3–4 of 90 · Kanji 5–8 of 2,136".
 *
 * Each present segment goes through `positionLabel`, so a single item is one
 * number and a several-item span uses the en dash, exactly as every other card
 * has printed them. The separator is the middot the app already uses to join
 * peers on one line (the role label "Radical · Kanji", the Library breadcrumb).
 */
export function compositePositionLabel(pos: CompositePosition): string {
  return COMPOSITE_NOUNS.filter(([role]) => pos[role] !== null)
    .map(([role, noun]) => positionLabel(noun, pos[role]!))
    .join(" · ");
}

// THE ONE SAFE WAY TO COMPUTE A POSITION (see the file header, "SEE
// advancePosition() FOR THE ONE SAFE WAY TO COMPUTE"). Pulled out of
// curriculum-lesson.ts's `position()` so the counting step has a single home,
// its own tests, and one obvious place for SAK-29 (or anyone adding a new
// track's "N of M") to reuse rather than re-derive.

/**
 * Advance a running position cursor by one group's count of a single kind of
 * item, in the curriculum's own fixed order — the entire arithmetic a safe "N
 * of M" needs, and the only place it should live.
 *
 * SAFE USE: call this once per group, in the STATIC curriculum order, threading
 * `seenSoFar` from one call to the next, over the WHOLE track computed once and
 * memoized independent of history (see curriculum-lesson.ts's `curriculum()`).
 * The result never depends on which items a learner has claimed, out of order or
 * not — that is the entire point, and why this function does not take a history
 * or a claims set as a parameter at all. There is nothing here for an
 * out-of-order claim TO corrupt.
 *
 * UNSAFE USE this function will not stop you from making: calling it over a
 * history-filtered subset (e.g. "the items not yet claimed") instead of the
 * whole static group. That reintroduces SAK-13 with new code — see the file
 * header's SAFE/UNSAFE table.
 *
 * `count` is the group's size for this kind (0 when the group teaches none of
 * it, e.g. a words-only lesson has `count === 0` for `radical`) — that group
 * contributes no segment, and null is returned rather than a degenerate
 * `{from, to: from - 1, ...}`. `total` is the kind's fixed curriculum-wide
 * denominator (COUNTED off the shipped data, never typed in — see
 * CURRICULUM_TOTALS in curriculum-lesson.ts), or null when the track can derive
 * no total at all (see positionLabel's own null-total case).
 */
export function advancePosition(
  seenSoFar: number,
  count: number,
  total: number | null,
): { position: LessonPosition | null; seenSoFar: number } {
  if (count <= 0) return { position: null, seenSoFar };
  const from = seenSoFar + 1;
  const to = seenSoFar + count;
  return { position: { from, to, total }, seenSoFar: to };
}
