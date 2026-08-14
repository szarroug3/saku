// The transitivity track's curriculum: the pairs the app teaches, in teaching
// order.
//
// WHAT COUNTS, AND WHAT ONLY RIDES ALONG AS A DISTRACTOR
// =====================================================
// A pair's unit is two verbs the learner already met and one distinction between
// them, and a pair needs BOTH of its verbs to be learned vocabulary before that
// distinction is a question the learner can even parse. So only pairs whose BOTH
// verbs are in the CEJC word curriculum can ever be reached, and those are the
// track (CURRICULUM_PAIRS); pairs with an excluded, grammar-like, or unobserved
// verb are excluded, the same way grammar excludes the non-drillable recipes it
// will never quiz.

import { isCurriculumWord, wordBeginnerRank } from "@/lib/word-rank";
import { VERB_PAIRS, type VerbPair } from "@/data/transitivity";

/** Whether both of a pair's verbs are words the app actually teaches. A pair
 * with a verb outside the curriculum can never unlock, so it is not part of the
 * track — the transitivity analogue of grammar's DRILLABLE filter. */
function pairInCurriculum(p: VerbPair): boolean {
  return isCurriculumWord(p.happens.word) && isCurriculumWord(p.doIt.word);
}

/**
 * The pairs the track teaches, in teaching order: every pair whose both verbs
 * are in the words curriculum, sorted by the minimum beginnerRank of the two
 * verbs so the order automatically tracks the word curriculum.
 */
export const CURRICULUM_PAIRS: readonly VerbPair[] = VERB_PAIRS.filter(
  pairInCurriculum,
).sort((a, b) => {
  const rank = (p: VerbPair) =>
    Math.min(
      wordBeginnerRank(p.happens.word) ?? Infinity,
      wordBeginnerRank(p.doIt.word) ?? Infinity,
    );
  return rank(a) - rank(b);
});
