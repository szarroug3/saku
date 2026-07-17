// Questions over the verb-pair table.
//
// SELECTION ONLY, AND THE REFUSAL IS THE POINT
// ============================================
// The obvious second question type -- "here is 開く, give me the partner" --
// is not built here and must not be. There is no rule that derives 開ける from
// 開く; the pairing is suppletive (see the header of src/data/transitivity.ts).
// So that question asks the user to recall a stored card, which is the one
// thing this app exists not to do. It would also be the only production
// question in the app whose answer cannot be derived from anything, which is a
// good sign it is the wrong question rather than a missing feature.
//
// Selection is different. The English cue determines exactly one answer -- "the
// door opened" is never "I opened the door" -- so the item is choosable from
// the prompt, and passing it requires knowing which verb the event calls for,
// not remembering a pair.
//
// TWO CHOICES, NOT FOUR
// =====================
// The distractor is the partner, and there is no third candidate: a verb from
// some other pair would turn a transitivity item into a vocabulary item, which
// the user could pass without knowing the thing being tested. Two choices means
// a coin-flip floor, which is real and is the scheduler's problem to price, not
// a reason to pad the item with distractors that measure something else.

import { VERB_PAIRS, type PairMember, type VerbPair } from "../data/transitivity.ts";

/**
 * What the learner is asked to decide. Rendered copy lives here so the terms
 * cannot drift back to "transitive"/"intransitive" in a component.
 */
export const PROMPT = "Which verb fits?";

export interface TransitivityQuestion {
  readonly kind: "transitivity";
  /** The cue, and the only context. "The door opened." */
  readonly en: string;
  /** Both members, in data order. The caller shuffles. */
  readonly choices: readonly { readonly word: string; readonly reading: string }[];
  /** The written form of the correct member. */
  readonly answer: string;
}

/** Which side of the pair the frame is asking for. */
export type Side = "happens" | "doIt";

/**
 * Build the item for one side of one pair, or refuse.
 *
 * Refuses when the DISTRACTOR is `ambi` -- genuinely tagged both ways on a
 * single sense. If 上げる can itself be intransitive, then offering it against
 * "The price went up." risks an item whose distractor is also correct, and
 * marking correct Japanese wrong is the failure this codebase kills question
 * types over (see the は/が note in lib/grammar/questions.ts). The answer side
 * being `ambi` is fine and is not checked: a verb that covers both roles still
 * covers the one being asked for.
 *
 * `split` is not a refusal. Its vi and vt tags sit on different senses, and the
 * cue names the sense.
 */
export function question(pair: VerbPair, side: Side): TransitivityQuestion | null {
  const answer: PairMember = pair[side];
  const distractor: PairMember = side === "happens" ? pair.doIt : pair.happens;

  if (distractor.jmdict === "ambi") return null;

  return {
    kind: "transitivity",
    en: answer.en,
    choices: [
      { word: pair.happens.word, reading: pair.happens.reading },
      { word: pair.doIt.word, reading: pair.doIt.reading },
    ],
    answer: answer.word,
  };
}

/** Every item the table can produce. Both sides of every pair that survives. */
export function allQuestions(): TransitivityQuestion[] {
  const out: TransitivityQuestion[] = [];
  for (const p of VERB_PAIRS) {
    for (const side of ["happens", "doIt"] as const) {
      const q = question(p, side);
      if (q) out.push(q);
    }
  }
  return out;
}
