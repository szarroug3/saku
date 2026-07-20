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
 * Build the item for one side of one pair.
 *
 * We always ask both sides of every curated pair. The pair table itself carries
 * the intended role split in plain-language cues ("it happened" vs "someone did
 * it"), and those cues are what the learner is answering from. Dictionary-level
 * ambitransitive tags are retained as metadata on the source rows but do not
 * suppress questions.
 */
export function question(pair: VerbPair, side: Side): TransitivityQuestion | null {
  const answer: PairMember = pair[side];

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
