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
import type { AccuracyMetric, FactAggregate, FactId } from "@/types";

/**
 * The order the buckets are read in — best to worst, then the one that is not
 * the app's opinion at all.
 *
 * `not-seen` is absent on purpose: it is not a condition your memory is in, it
 * is material you have not met. The knowledge-base card is about what you hold,
 * so it has no slot for it; By subject draws it as the empty part of a bar,
 * because there the size of the untouched remainder is the whole point.
 */
export const BUCKETS: readonly Standing[] = [
  "solid",
  "getting-there",
  "shaky",
  "slipping",
  "claimed",
];

/**
 * The word under a COUNT of facts, which is not always the word on one.
 *
 * STANDING_LABEL is written for a chip on a single row — "you know this", said
 * about そ. Under the number 35 it reads as a typo. Every other word in the set
 * is an adjective and survives the change of number unaltered ("83 solid", "188
 * shaky"); `claimed` is the only one that is a sentence about one thing, so it
 * is the only one here.
 *
 * This is deliberately a pluralisation and NOT a second opinion. If a word ever
 * needs to differ from STANDING_LABEL by more than its number, the fix is in
 * standing.ts — that file is the one place the app turns the model into a word,
 * and this map exists to leave it that way, not to fork it.
 */
export const BUCKET_LABEL: Record<Standing, string> = {
  ...STANDING_LABEL,
  claimed: "you know these",
};

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

export type Tally = Record<Standing, number>;

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
  metric: AccuracyMetric,
  now: number,
): Tally {
  const out = empty();
  for (const f of facts) {
    out[standingOf(aggregates[f], claims[f], metric, now).standing]++;
  }
  return out;
}

/** Everything the app has a record of: the buckets that are about you, summed.
 * `not-seen` is dropped rather than added — a page that opens with "21,086 not
 * seen" has stopped being about you and started being about the dictionary. */
export function held(t: Tally): number {
  return BUCKETS.reduce((n, b) => n + t[b], 0);
}
