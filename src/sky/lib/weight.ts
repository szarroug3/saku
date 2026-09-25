// How much one new thing adds to a lesson. Tracked as SAK-477.
//
// The cart used to count pieces, every one worth 1, so a sentence type and
// the meaning of a word filled the lesson the same amount. Sam, 2026-09-24:
// "learning simple sentences is not the simple. same with wa and ga. they're
// counted as 1 bc technically it's 1 item but its difficulty is not worth
// the same as learning the definition of a word." So each kind has a weight,
// and the cart adds up the weights of the distinct new pieces instead of
// counting them (src/sky/lib/cart.ts).
//
// By kind alone: a particle is a grammar pattern and weighs what any pattern
// does (Sam, the same day).
//
// The table is Sam's proposal and hers to change. The pages (a term, a
// writing rule, a grammar concept) are never picked and never a piece of
// anything, so they are never charged; they are 1 only so every kind has a
// weight.
//
// Pure: no app imports.

import type { SkyKind } from "./types";

const WEIGHT: Record<SkyKind, number> = {
  kana: 1,
  radical: 1,
  word: 1,
  kanji: 2,
  verbPair: 2,
  keigo: 2,
  counter: 2,
  grammar: 3,
  sentence: 4,
  term: 1,
  mark: 1,
  concept: 1,
};

/** What one new piece of this kind adds to a lesson. */
export function weightOf(kind: SkyKind): number {
  return WEIGHT[kind];
}

/** Where a lesson is, in one word: the aside on the Observatory's "This
 * lesson" panel and the meter's name. Under a third of the cap is Light,
 * under two thirds Medium, up to and including the cap Full, and past it
 * Too much. */
type LessonSize = "Nothing yet" | "Light" | "Medium" | "Full" | "Too much";

export function lessonSize(weight: number, cap: number): LessonSize {
  if (weight <= 0) return "Nothing yet";
  if (weight > cap) return "Too much";
  if (weight < cap / 3) return "Light";
  if (weight < (cap * 2) / 3) return "Medium";
  return "Full";
}
