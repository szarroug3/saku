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
// IT DOES SPLIT ON THE HOST, THOUGH — see `productionHosts` below. "The same
// skill each time" is true across every VERB and false across the host boundary:
// 〜すぎる is [V-stem]+すぎる on 行く and "chop the い" on 高い, two rules with two
// answers. That is a split by TRANSFORMATION, which is the axis this file has
// always used, and not by word, which is the axis that killed kanji:生/reading.
//
// The honest caveat, stated where it will be found: a production item tests the
// recipe AND the word's conjugation at once. 読みでから fails at the 音便, not
// at てから. The item cannot tell you which, and the scheduler must not assume.
// See the note on `production` in src/lib/grammar/questions.ts.

import { entryId, factId, productionAspect } from "../../lib/fact-id.ts";
import { HOST_ORDER, buildExample, primaryHost } from "../../lib/grammar/example.ts";
import type { EntryId, FactId, FactInfo } from "../../types/index.ts";
import {
  RECIPES,
  isProducible,
  isTrivialAttachment,
  patternLabel,
  recipe,
  type Host,
  type Recipe,
} from "./recipes.ts";

export const GRAMMAR_SUBJECT = "grammar";

export function patternEntry(recipeId: string): EntryId {
  return entryId(GRAMMAR_SUBJECT, recipeId);
}

export function patternMeaningFactId(recipeId: string): FactId {
  return factId(patternEntry(recipeId), "meaning");
}

/**
 * A pattern's production fact for one host.
 *
 * `host` omitted means the pattern's PRIMARY host, which keeps the unqualified
 * `production` aspect — the id every existing history record already uses. See
 * `productionAspect` in lib/fact-id.ts for why that matters and
 * `productionHosts` below for which hosts exist.
 */
export function patternProductionFactId(recipeId: string, host?: Host): FactId {
  const r = recipe(recipeId);
  const primary = r ? primaryHost(r) : null;
  return factId(
    patternEntry(recipeId),
    productionAspect(host === undefined || host === primary ? null : host),
  );
}

/**
 * The hosts a pattern carries a SEPARATE production fact for.
 *
 * WHY PRODUCTION SPLITS BY HOST AND NOT BY PATTERN
 * ================================================
 * 8 of the 53 drillable recipes accept an adjective as well as a verb, and for
 * most of them those are two different moves. 〜すぎる is [V-stem] + すぎる on
 * 行く (行きすぎる) and "chop the い" on 高い (高すぎる); a learner solid on one
 * can be helpless at the other. While the fact was keyed on the recipe alone,
 * the verb shape satisfied it and the adjective shape WAS NEVER ASKED — not
 * here, not by the cluster page (which printed attach[0]), not by the lesson
 * card (which has no example). The rule existed in the table and nowhere the
 * user could meet it.
 *
 * WHY NOT ALL TWELVE
 * ==================
 * A naive (pattern × host) split mints 12 new facts over ~6 distinct rules.
 * 〜ても and 〜てもいい on an い-adjective are te-cause's い → くて plus a fixed
 * string, and te-cause already scores that. Scoring one rule three times is the
 * same error as scoring two rules once — a number true of nothing. Those two
 * rows say so themselves via `sharedProductionWith`, where the reason can be
 * read next to the data instead of inferred from a count.
 *
 * The primary host leads, and it is the one keeping the unqualified fact id.
 */
export function productionHosts(r: Recipe): Host[] {
  const primary = primaryHost(r);
  if (!primary) return [];
  const rest = HOST_ORDER.filter(
    (h) =>
      h !== primary &&
      // Trivial hosts are excluded on the same ground the whole production
      // aspect is: 高い + ので is the word retyped. 〜ので's adj-i row is real
      // Japanese and the cluster page prints it — it is just not a question.
      r.attach.some((a) => a.host === h && !isTrivialAttachment(a)),
  );
  return r.sharedProductionWith ? [primary] : [primary, ...rest];
}

/**
 * The pattern that scores THIS row's rule, when the row is unscored because
 * another pattern owns the rule rather than because nothing happens to the word.
 *
 * WHY A ROW-LEVEL FUNCTION AND NOT A FLAG ON THE RECIPE
 * ====================================================
 * `sharedProductionWith` is a fact about the RECIPE and the answer needed is per
 * ROW. 〜ても defers, but only its adj-i row is unscored — its verb row is 行く →
 * 行って, which is the て-form's 音便 and carries its own fact. A component that
 * read the recipe flag alone would print "same rule as 〜て" beside a chip.
 * `productionHosts` already knows which hosts kept a fact, so the join happens
 * here, once, against the same list the chip is drawn from.
 *
 * The two empties this distinguishes are the reason it exists. 〜ので's verb row
 * (行く + ので) transforms nothing, so there is no rule to be scored ANYWHERE and
 * the answer is undefined — that cell stays blank, and its own formula already
 * says why by reading "just as it is". 〜ても's adj-i row IS 高い → 高くて, a real
 * transformation, and it was blank for a reason no reader could see.
 *
 * Returns the RECIPE, not a string, so the caller renders that recipe's own
 * `pattern` and links to its own entry. A caller handed "〜て" as text would be
 * holding a copy that can drift from the recipe it names.
 */
export function sharedRuleOwner(r: Recipe, host: Host): Recipe | undefined {
  if (!r.sharedProductionWith) return undefined;
  // Nothing on the card is scored, so there is no score column and no cell to
  // put this in. No recipe is in this state today; the guard is here so that a
  // recipe becoming vacuous cannot turn the column back on by the back door.
  if (!isProducible(r)) return undefined;
  // Scored right here — this row gets the chip, not the note.
  if (productionHosts(r).includes(host)) return undefined;
  // A lookup, so a recipe deferring to an id that no longer exists answers
  // undefined and the cell falls back to blank rather than linking to a 404.
  return recipe(r.sharedProductionWith);
}

/**
 * Every grammar fact: 81 meanings + 62 productions.
 *
 * The asymmetry is the model working, not an inconsistency — exactly as a word
 * having one reading fact while a kanji never does. Every pattern means
 * something; only 53 of them are something you can be asked to BUILD, and 5 of
 * those 53 are more than one thing to build — see `productionHosts`. 53 patterns
 * carry 62 production facts, and the 9 extra are adjective rules that were in
 * the table all along with nowhere to be asked.
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
/** A production fact's recipe AND the host it produces on — the host is half
 * the fact now that a pattern can carry one per host, and the drill needs it to
 * pick a vehicle of the right kind. */
const PRODUCTION_OF = new Map<FactId, { recipeId: string; host: Host }>();

export const GRAMMAR_FACTS: FactInfo[] = buildGrammarFacts();

function buildGrammarFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const r of RECIPES) {
    const mId = patternMeaningFactId(r.id);
    MEANING_OF.set(mId, r.id);
    facts.push({
      id: mId,
      entry: patternEntry(r.id),
      glyph: patternLabel(r),
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
    //
    // ONE PER HOST. 〜すぎる on a verb and 〜すぎる on an い-adjective are two
    // rules and two answers (行きすぎる, 高すぎる), so they are two facts — see
    // productionHosts for which patterns split and which decline to.
    for (const host of productionHosts(r)) {
      const ex = buildExample(r, host);
      if (!ex) continue;
      const pId = patternProductionFactId(r.id, host);
      PRODUCTION_OF.set(pId, { recipeId: r.id, host });
      facts.push({
        id: pId,
        entry: patternEntry(r.id),
        glyph: ex.form,
        answers: ex.form === ex.kanaForm ? [ex.form] : [ex.form, ex.kanaForm],
        subject: GRAMMAR_SUBJECT,
        meaning: r.gloss,
      });
    }
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
 * `lemma` is the fixed representative word the fact's answer was built on, so a
 * prompt can show "行く · 〜てから form" while the fact's own answers hold the
 * built string. Null for a fact that is not a production fact, or a recipe whose
 * example no longer builds (a re-cut of the conjugation data).
 *
 * `host` rides along because it is part of what the fact ASKS: the adj-i fact
 * for 〜そう is about 高そう, and a showing of it that rolled 行く would be a
 * different question keeping the wrong score. Every caller that picks a vehicle
 * has to pass it through.
 */
export function grammarProduction(
  fact: FactId,
): { recipe: Recipe; lemma: string; host: Host } | null {
  const hit = PRODUCTION_OF.get(fact);
  const r = hit ? recipe(hit.recipeId) : undefined;
  if (!r || !hit) return null;
  const ex = buildExample(r, hit.host);
  return ex ? { recipe: r, lemma: ex.lemma, host: hit.host } : null;
}
