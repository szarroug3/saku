// Small structural word facts — content-free. Reads the precomputed
// word-rank.json instead of touching data/vocab.ts / lib/word-lesson.ts, both of
// which pull the ~8.6MB dictionary in for a single number or membership check.

import wordFactsJson from "@/data/generated/word-rank.json" with { type: "json" };

interface WordFacts {
  readonly rank: Readonly<Record<string, number>>;
  readonly curriculumKebs: readonly string[];
}

const FACTS = wordFactsJson as unknown as WordFacts;
const CURRICULUM_KEBS: ReadonlySet<string> = new Set(FACTS.curriculumKebs);

/** A word's beginnerRank, or undefined for a written form the dictionary
 * doesn't have — matches `vocabRow(keb)?.beginnerRank`'s optionality. */
export function wordBeginnerRank(keb: string): number | undefined {
  return FACTS.rank[keb];
}

/** Whether a written form is in the CEJC words-track curriculum — the
 * content-free twin of testing membership in `word-lesson.ts`'s
 * `CURRICULUM_WORDS`. */
export function isCurriculumWord(keb: string): boolean {
  return CURRICULUM_KEBS.has(keb);
}

/** Every curriculum word's written form, in the curriculum's own (beginnerRank)
 * order — the content-free twin of `CURRICULUM_WORDS.map(w => w.keb)`. */
export const CURRICULUM_KEBS_ORDERED: readonly string[] = FACTS.curriculumKebs;
