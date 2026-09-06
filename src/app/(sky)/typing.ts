// What the answer box holds as it is typed.
//
// A card whose answer is Japanese turns romaji into kana as you go, so the
// learner answers in the script they have been reading all lesson and the
// reveal shows what they actually typed (SAK-386, Sam: nothing but kana
// should ever ask for romaji). Live mode leaves an unfinished run in latin,
// so "katt" reads かっt rather than guessing; the conversion is idempotent
// on kana, so re-running it on the box's own value only touches that tail,
// and someone typing kana directly with an IME is left alone.
//
// The Sky never sees romaji: the card says whether its box types kana (see
// `answerInKana`), the route hands this in, the same way it hands in the
// grader.

import { toKana } from "@/lib/romaji";

export function typeKana(value: string, katakana: boolean): string {
  return toKana(value, { live: true, katakana });
}
