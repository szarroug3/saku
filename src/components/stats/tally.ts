// Counting, which is the only thing this page is allowed to do.
//
// WHY THERE IS NO NEW VOCABULARY HERE
// ===================================
// Progress does not decide what a fact's condition is called. src/lib/library/
// standing.ts is "the ONE place the app turns its model into a word", and this
// module is a caller of it — it counts how many facts wear each word and stops.
//
// That matters more than it looks. The obvious way to build "solid / slipping /
// shaky" on a progress screen is a three-way ternary over scoring.status():
// quiet → solid, probe → slipping, teach → shaky. It reads fine and it is
// wrong, because standing.ts already spends `slipping` on `teach` — "you had it,
// it's gone" — and `shaky` on a probed fact you are often wrong about. The
// ternary would put the same two words on the opposite states, and the app would
// then have two dialects: 生's reading is `slipping` on the Library row and
// `shaky` in the Progress bar, at the same instant, from the same record.
// Nobody would ever see both at once, which is exactly why it would survive.
//
// SO THE CARD SHOWS FOUR WORDS, NOT THREE, AND THAT IS NOT A LIBERTY
// ==================================================================
// standing.ts produces `getting-there` as well, and it is a real population:
// the app isn't sure and you are mostly right. Dropping it would leave the three
// counts summing to less than the facts behind them, and the bar underneath —
// which is a whole — would be drawn from a part. The way to have three numbers
// is to make the model produce three words, in standing.ts, for every screen at
// once. It is not to average one away here.
//
// AN ENTRY IS NEVER COUNTED. Every population below is a population of FACTS.
// 生 has nine readings and nine conditions; asking which bucket 生 goes in has
// no answer, and inventing one is what got decks.weakestEntries() deleted. Where
// this page needs to say something about entries it counts a different thing —
// how many you have MET — which needs no standing at all. See by-subject.tsx.
//
// AND NOTHING HERE LOOKS FORWARD. Every count is as of `now`. The tempting
// addition is "12 will slip this week" — it is cheap to compute, since `recall`
// takes any instant, and it is the banned thing wearing a count's clothes: a
// PREDICTION that reads as a fact about your week. "stability 106d" was read as
// "I did it 106 days in a row"; "12 slipping this week" would be read the same
// way and be wrong the same way. The card already moves while you are away.
// That IS the forward-looking number, and it is honest because you only ever
// read it in the present tense.

import type { Claims } from "@/lib/claims";
import {
  STANDING_LABEL,
  STANDING_TONE,
  standingOf,
  type Standing,
} from "@/lib/library/standing";
import type { FactAggregate, FactId } from "@/types";

/**
 * The order the buckets are read in — best to worst, matching standing.ts's own
 * canonical order (`not seen / claimed / solid / getting there / shaky /
 * slipping`, this file's `not-seen` dropped as above). `claimed` leads: it is
 * an untested self-report, not a verdict earned by drilling, but Sam's read is
 * that a learner would rather see what they've told the app they already know
 * before the buckets the app itself measured.
 *
 * `not-seen` is absent on purpose: it is not a condition your memory is in, it
 * is material you have not met, so it has no slot among the COUNTS a card
 * prints ("83 solid", "35 claimed" — there is no "612 not seen" tile to match).
 * It still reaches the bar: both knowledge-base.tsx and by-subject.tsx draw it
 * as an untouched, track-toned segment via `barSegments` below, because there
 * the size of the untouched remainder is the whole point, not something the
 * bar hides.
 */
export const BUCKETS: readonly Standing[] = [
  "claimed",
  "solid",
  "getting-there",
  "shaky",
  "slipping",
];

/**
 * The word under a COUNT of facts, which is not always the word on one.
 *
 * Every standing is now a bare adjective (or past participle) and survives the
 * change of number unaltered — "83 solid", "188 shaky", "35 claimed" — so this
 * map no longer overrides any of them. It stays as its own export, not an alias
 * of STANDING_LABEL, because that is the seam the old "you know this" / "you
 * know these" split lived in: if a word ever again reads as a typo under a
 * count, the pluralisation goes HERE and the single-row word stays in
 * standing.ts, the one place the app turns the model into a word. Keeping the
 * seam open is cheaper than reopening it.
 *
 * SAK-78: capitalised, not lower-cased, because a count sits under a BUTTON now,
 * not a sentence — "Solid", not "solid". Only the first letter turns: the rest
 * of the label, including a second word, stays exactly as STANDING_LABEL wrote
 * it, which is by-subject.tsx's own convention for its row labels ("Verb
 * pairs", not "Verb Pairs") — one capitalisation rule for the page, not a
 * different one per widget.
 */
export const BUCKET_LABEL: Record<Standing, string> = Object.fromEntries(
  (Object.entries(STANDING_LABEL) as [Standing, string][]).map(([k, v]) => [
    k,
    v.charAt(0).toUpperCase() + v.slice(1),
  ]),
) as Record<Standing, string>;

/** Bar fill per tone. The Library's chip paints the same tones as a border and a
 * text colour; a segment is a fill, so the class differs and the TONE does not —
 * STANDING_TONE stays the only thing deciding which colour a word gets.
 *
 * Which means `slipping` is amber and `shaky` is red, and a bar therefore shows
 * its worst population in its middle colour. That looks like a bug and is not
 * one: standing.ts settles it — "slipping is not a failure, it is time passing,
 * and it is the one thing on the page that is nobody's fault." A red segment for
 * the fortnight you spent not opening the app would be the app blaming you for
 * the calendar. */
export const TONE_FILL: Record<"good" | "warn" | "bad" | "mute", string> = {
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-danger",
  mute: "bg-text-muted",
};

export function fillFor(standing: Standing): string {
  return TONE_FILL[STANDING_TONE[standing]];
}

/** The untouched remainder's fill — transparent, so the track's own colour
 * shows through it. Deliberately NOT one of TONE_FILL's colours, `not-seen`
 * included: STANDING_TONE spends "mute" on `not-seen` for the chip/label case,
 * where something has to be drawn, but a bar segment can just not be there.
 * Painting it grey would make "haven't met it" read as a fifth condition of
 * memory, which is exactly the thing the rest of this bar is careful not to
 * claim. */
export const UNTOUCHED_FILL = "bg-transparent";

export type Tally = Record<Standing, number>;

/** One filled span of a coverage bar, left to right. */
export interface BarSegment {
  bucket: Standing;
  /** Raw count, handed straight to `flex` — no percentage computed anywhere,
   * same rule as every number this module produces. */
  flex: number;
  fill: string;
}

/**
 * The bar's segments: one per status bucket that has anything in it, in
 * BUCKETS order, followed by a trailing `not-seen` segment sized to whatever
 * of `total` the tally doesn't account for.
 *
 * Takes `total` rather than reading `tally["not-seen"]` directly because the
 * two callers hand it different populations: by-subject.tsx already tallies
 * every fact in the subject, so its `total` and `held(tally) +
 * tally["not-seen"]` agree by construction; knowledge-base.tsx tallies only
 * facts you have a record of, so `tally["not-seen"]` there is always 0 and the
 * untouched amount can only come from a total supplied from outside. Deriving
 * it from `total - held(tally)` in both cases means one code path instead of
 * two, and a caller that passes a smaller total than it holds (a bug) shows no
 * segment rather than a negative-width one.
 */
export function barSegments(tally: Tally, total: number): BarSegment[] {
  const segments: BarSegment[] = BUCKETS.filter((b) => tally[b] > 0).map(
    (b) => ({ bucket: b, flex: tally[b], fill: fillFor(b) }),
  );
  const untouched = total - held(tally);
  if (untouched > 0) {
    segments.push({ bucket: "not-seen", flex: untouched, fill: UNTOUCHED_FILL });
  }
  return segments;
}

function empty(): Tally {
  return {
    "not-seen": 0,
    claimed: 0,
    solid: 0,
    "getting-there": 0,
    shaky: 0,
    slipping: 0,
  };
}

/**
 * How many of `facts` wear each word, as of `now`.
 *
 * Takes the fact list rather than reading history's keys, so the CALLER decides
 * the population — "every fact I have a record of" and "every kanji fact in the
 * app" are different questions and this answers whichever it is handed. Facts
 * with neither an aggregate nor a claim land in `not-seen` at one map lookup
 * each, which is what lets By subject count all 5,314 kanji facts in one walk
 * instead of counting the practised ones and subtracting.
 */
export function tallyFacts(
  facts: readonly FactId[],
  aggregates: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
): Tally {
  const out = empty();
  for (const f of facts) {
    out[standingOf(aggregates[f], claims[f], now).standing]++;
  }
  return out;
}

/** Everything the app has a record of: the buckets that are about you, summed.
 * `not-seen` is dropped rather than added — a page that opens with "21,086 not
 * seen" has stopped being about you and started being about the dictionary. */
export function held(t: Tally): number {
  return BUCKETS.reduce((n, b) => n + t[b], 0);
}

/**
 * `tallyFacts`'s own walk, kept instead of counted — the FACTS behind each
 * bucket, not just how many. SAK-78: a clickable "83 solid" opens a panel
 * listing exactly this, so the count on screen and the list behind it can
 * never disagree — there is no second query that could drift from the first.
 *
 * Same signature and same per-fact rule as `tallyFacts` on purpose: this is
 * that function's own accumulator with `push` instead of `++`, not a
 * reimplementation that could answer a different question by accident.
 */
export function factsByStanding(
  facts: readonly FactId[],
  aggregates: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
): Record<Standing, FactId[]> {
  const out: Record<Standing, FactId[]> = {
    "not-seen": [],
    claimed: [],
    solid: [],
    "getting-there": [],
    shaky: [],
    slipping: [],
  };
  for (const f of facts) {
    out[standingOf(aggregates[f], claims[f], now).standing].push(f);
  }
  return out;
}
