// The grammar subject's entry into the fact registry.
//
// src/lib/facts.ts states the contract: "Publish a `FactInfo[]` from the
// subject's own module and add it to SUBJECTS below. That is the whole
// contract." This file is grammar taking it at its word — one export, one line
// in facts.ts, and nothing downstream can tell grammar from kana.
//
// WHAT IS A GRAMMAR FACT?
// ======================
// One askable thing about one pattern. Two aspects:
//
//   meaning      "what does 〜てから mean?"  -> "after doing X"
//   production   "build the 〜てから form"    -> only where that is a question
//
// The production aspect exists ONLY for non-vacuous recipes. 27 of the 81 have
// no production fact at all, because "give me the は form of 私" is typing, and
// a fact you cannot grade is worse than a fact you do not have — the same rule
// that keeps jukujikun out of the kanji reading facts (see src/data/vocab.ts).
//
// WHY PRODUCTION IS KEYED ON THE PATTERN AND NOT ON (PATTERN, WORD)
// ================================================================
// This is the one place the grammar subject looks like it is breaking the rule
// that killed `kanji:生/reading`, so it is worth being explicit that it isn't.
//
// A kanji reading is keyed on (kanji, word) because "what is 生 read as" has
// eleven answers and NO RULE picks between them — the knowledge is the pairing
// itself, and each pairing is separate knowledge. 〜てから is the opposite: it
// is ONE rule that applies uniformly to every verb, and the engine computes it.
// "Build the てから form" has one answer per prompt word, and the skill being
// tested is the same skill each time. So the pattern is the fact, and the verb
// is the vehicle.
//
// The honest caveat, stated where it will be found: a production item tests the
// recipe AND the word's conjugation at once. 読みでから fails at the 音便, not
// at てから. The item cannot tell you which, and the scheduler must not assume.
// See the note on `production` in src/lib/grammar/questions.ts.

import { entryId, factId } from "../../lib/fact-id.ts";
import type { EntryId, FactId, FactInfo } from "../../types/index.ts";
import { RECIPES, isVacuous } from "./recipes.ts";

export const GRAMMAR_SUBJECT = "grammar";

export function patternEntry(recipeId: string): EntryId {
  return entryId(GRAMMAR_SUBJECT, recipeId);
}

export function patternMeaningFactId(recipeId: string): FactId {
  return factId(patternEntry(recipeId), "meaning");
}

export function patternProductionFactId(recipeId: string): FactId {
  return factId(patternEntry(recipeId), "production");
}

/**
 * Every grammar fact: 81 meanings + 54 productions.
 *
 * The asymmetry is the model working, not an inconsistency — exactly as a word
 * having one reading fact while a kanji never does. Every pattern means
 * something; only 54 of them are something you can be asked to BUILD.
 */
export const GRAMMAR_FACTS: FactInfo[] = buildGrammarFacts();

function buildGrammarFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const r of RECIPES) {
    facts.push({
      id: patternMeaningFactId(r.id),
      entry: patternEntry(r.id),
      glyph: r.pattern,
      answers: [r.gloss],
      subject: GRAMMAR_SUBJECT,
      meaning: r.gloss,
    });
    if (isVacuous(r)) continue;
    facts.push({
      id: patternProductionFactId(r.id),
      entry: patternEntry(r.id),
      glyph: r.pattern,
      // The answers for a production fact are per-PROMPT, not per-fact — the
      // question generator computes them from the engine. `answers` carries
      // the pattern itself so a generic screen has something to render, and
      // the grader must use questions.ts rather than this list.
      answers: [r.pattern],
      subject: GRAMMAR_SUBJECT,
      meaning: r.gloss,
    });
  }
  return facts;
}
