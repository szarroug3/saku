// What a card accepts, as data, and the matcher that reads it.
//
// The engine grades a typed answer by asking the fact: `checkTyped` looks the
// fact up in the tables and runs its subject's own rule. That is fine on the
// server and ruinous in a browser, because reaching the tables means shipping
// them: the Quiz, Practice and Settings each carried 15 MB of JavaScript for
// want of one function (SAK-380).
//
// An answer key is the same decision, precomputed. The server already builds
// every card, so it works out there what strings that card accepts and under
// which rule, and the browser only has to compare. Four rules, because the
// engine has four and no more:
//
//   strict   raw equality after a trim. A kana card asked en2jp wants the
//            GLYPH and nothing else: the romaji is the prompt, so forgiving
//            it would grade the prompt as the answer.
//   produce  the Japanese a card asks you to write: exact, plus a romaji
//            spelling when the target is all kana, since あ can be typed "a"
//            with no IME and 生 has no romaji at all.
//   loose    English, compared after normalising case and spacing. Carries
//            the glosses, the curated synonyms and the gloss's own comma and
//            parenthetical slices, all expanded on the server.
//   typo     the English candidates again, this time allowed a length-scaled
//            edit distance. Kept apart from `loose` because a synonym must
//            never be fuzzed: one loose pool entry would compound.
//   digits   a count written as a number, full-width digits folded. Only a
//            counting card asked the other way round ("how many?") uses it.
//
// The key only ever says what the engine would have said. `answerKeyFor` in
// the engine builds it next to each subject's `check`, and a test grades every
// fact in the curriculum both ways and asserts they agree.

import { isKanaOnly, romajiMatches } from "@/lib/romaji";
import { norm, withinTypo } from "@/lib/en-text";

export interface AnswerKey {
  /** Accepted by raw equality after a trim, nothing forgiven. */
  strict?: readonly string[];
  /** Japanese to produce: exact, or a romaji spelling when it is all kana. */
  produce?: readonly string[];
  /** Accepted once case and spacing are normalised. Stored normalised. */
  loose?: readonly string[];
  /** As `loose`, and additionally within a typo or two. Stored normalised. */
  typo?: readonly string[];
  /** A count as digits, with full-width digits folded before comparing. */
  digits?: string;
}

/** Whether the key accepts what was typed. */
export function matchesKey(key: AnswerKey | undefined, given: string): boolean {
  if (!key) return false;
  const g = given.trim();
  if (key.strict?.includes(g)) return true;
  if (key.produce?.some((t) => g === t || (isKanaOnly(t) && romajiMatches(given, t)))) return true;
  const n = norm(given);
  // An empty answer is never right, and `withinTypo` would happily spend its
  // budget getting from "" to a short gloss.
  if (!n) return false;
  if (key.loose?.includes(n)) return true;
  if (key.typo?.some((c) => withinTypo(n, c))) return true;
  return key.digits !== undefined && normalizeDigits(given) === key.digits;
}

/** A typed count, with full-width digits folded to ASCII: ３ is 3. */
export function normalizeDigits(given: string): string {
  return given
    .trim()
    .replace(/[０-９]/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30),
    );
}

/** Whether a key would accept anything at all. A card built without one grades
 * nothing, so the adapter can tell the difference between "no key" and "a key
 * that happens to be empty". */
export function keyIsEmpty(key: AnswerKey): boolean {
  return (
    !key.strict?.length && !key.produce?.length && !key.loose?.length &&
    !key.typo?.length && key.digits === undefined
  );
}
