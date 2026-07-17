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
import { buildExample } from "../../lib/grammar/example.ts";
import type { EntryId, FactId, FactInfo } from "../../types/index.ts";
import { RECIPES, isProducible, recipe, type Recipe } from "./recipes.ts";

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
 * Every grammar fact: 81 meanings + 53 productions.
 *
 * The asymmetry is the model working, not an inconsistency — exactly as a word
 * having one reading fact while a kanji never does. Every pattern means
 * something; only 53 of them are something you can be asked to BUILD.
 *
 * It was 54 until 〜たり〜たり lost its production fact. That fact was reachable:
 * the scheduler could serve it, and the generator answered it with 行ったり —
 * half the pattern, graded as the whole of it. A pattern that WRAPS a slot has
 * no production fact, because there is no one string that answers it.
 */
/** Which recipe a grammar fact belongs to, and which aspect it asks. Built
 * alongside GRAMMAR_FACTS so the question layer (engine/question.ts) can recover
 * the recipe WITHOUT parsing the opaque id — the same lookup-not-parse rule the
 * kanji subject follows with READING_INDEX. Declared BEFORE GRAMMAR_FACTS, whose
 * builder populates them, or the build reaches them in their dead zone. */
const MEANING_OF = new Map<FactId, string>();
const PRODUCTION_OF = new Map<FactId, string>();

export const GRAMMAR_FACTS: FactInfo[] = buildGrammarFacts();

function buildGrammarFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const r of RECIPES) {
    const mId = patternMeaningFactId(r.id);
    MEANING_OF.set(mId, r.id);
    facts.push({
      id: mId,
      entry: patternEntry(r.id),
      glyph: r.pattern,
      answers: [r.gloss],
      subject: GRAMMAR_SUBJECT,
      meaning: r.gloss,
    });
    // isProducible, not isVacuous: a fact the generator will always refuse is
    // a fact the scheduler would schedule forever and never be able to ask.
    if (!isProducible(r)) continue;
    // The built form on a FIXED representative verb — see lib/grammar/example.ts
    // for why the word is fixed. Baking it here (rather than leaving a pattern
    // placeholder for a per-prompt generator) is what makes the production fact
    // gradeable through the ordinary `accepts` path: the glyph is the form, the
    // answers are the form in kanji and in kana, and a generic screen reveals
    // the real answer instead of a placeholder. The confound still stands — a
    // production item tests the recipe AND the word's conjugation at once; see
    // the note on `production` in src/lib/grammar/questions.ts.
    const ex = buildExample(r);
    if (!ex) continue;
    const pId = patternProductionFactId(r.id);
    PRODUCTION_OF.set(pId, r.id);
    facts.push({
      id: pId,
      entry: patternEntry(r.id),
      glyph: ex.form,
      answers: ex.form === ex.kanaForm ? [ex.form] : [ex.form, ex.kanaForm],
      subject: GRAMMAR_SUBJECT,
      meaning: r.gloss,
    });
  }
  return facts;
}

/** The recipe a MEANING fact asks about, or null. A lookup, never a parse. */
export function grammarMeaning(fact: FactId): { recipe: Recipe } | null {
  const id = MEANING_OF.get(fact);
  const r = id ? recipe(id) : undefined;
  return r ? { recipe: r } : null;
}

/**
 * A PRODUCTION fact resolved to its recipe and the word it drills on, or null.
 *
 * `lemma` is the fixed representative verb the fact's answer was built on, so a
 * prompt can show "行く · 〜てから form" while the fact's own answers hold the
 * built string. Null for a fact that is not a production fact, or a recipe whose
 * example no longer builds (a re-cut of the conjugation data).
 */
export function grammarProduction(
  fact: FactId,
): { recipe: Recipe; lemma: string } | null {
  const id = PRODUCTION_OF.get(fact);
  const r = id ? recipe(id) : undefined;
  if (!r) return null;
  const ex = buildExample(r);
  return ex ? { recipe: r, lemma: ex.lemma } : null;
}
