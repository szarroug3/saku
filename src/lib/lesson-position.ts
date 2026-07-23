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
