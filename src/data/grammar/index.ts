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
// The production aspect exists ONLY for non-vacuous recipes. 40 of the 96 have
// no production fact at all, because "give me the は form of 私" is typing, and
// a fact you cannot grade is worse than a fact you do not have — the same rule
// that keeps jukujikun out of the kanji reading facts (see src/data/vocab.ts).
// The 40 is 28 original + the 12 N3 recognition patterns, which attach to a
// clause rather than a vehicle and so are vacuous by construction.
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
import { apply } from "../../lib/grammar/apply.ts";
import { recipeAllows, vehiclesFor } from "../../lib/grammar/vehicles.ts";
import {
  ENDING_ANCHOR,
  ROW_SHIFT_CLASSES,
  TE_ENDINGS,
  type TeEnding,
  type VehicleBucket,
} from "../../lib/grammar/te-endings.ts";
import type { Form, WordClass } from "../../lib/conjugate/index.ts";
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

/** The bare て/で-form recipe. Its five per-ending facts replace the plain
 * `grammar:te-sequence/production` fact. Named here as the canonical te-form
 * pattern (its intro leads the track); the ENDING split it pioneered now applies
 * to EVERY te-form-based recipe — see `isTeFormRecipe`. */
export const TE_FORM_RECIPE_ID = "te-sequence";

/**
 * Is this recipe built on the て/で-form — i.e. does its VERB attachment hang off
 * the て-form?
 *
 * This is the axis the per-ending production split runs on, and it is READ FROM
 * THE DATA rather than hardcoded to a list of ids: 〜てから, 〜ている, 〜てしまう
 * and the rest of the 〜て family are all "build the て-form, then add a fixed
 * tail", so each drills the same five 音便 endings (って/いて/いで/んで/して) as
 * te-sequence itself. A new te-pattern gains the per-ending drill by declaring a
 * `form: "te"` verb attachment, with no edit here. る-verbs and the irregulars
 * stay off the board for all of them, because `endingBucketOf` keys on the class
 * (see te-endings.ts / vehicles.ts) — the filter is the same one te-sequence uses.
 *
 * Keyed on the VERB attachment specifically: 〜て on an adjective (寒くて) is a
 * different rule, and these patterns split their production into the verb endings
 * ONLY (productionHosts is [] for them, so no adjective production fact is minted).
 */
export function isTeFormRecipe(r: Recipe): boolean {
  return verbAttachForm(r) === "te";
}

/** The form this recipe's VERB attachment hangs off, or undefined for a recipe
 * with no verb host. Read once here so every gate below asks the same question. */
export function verbAttachForm(r: Recipe): Form | null | undefined {
  return r.attach.find((a) => a.host === "verb")?.form;
}

/**
 * The verb-conjugation FORMS taught as their own grammar lessons, each with a
 * Library page of its own: the て/で-form, ない-form, た-form and stem, plus the
 * standalone conjugations where the form IS the whole pattern (the passive,
 * potential, causative, causative-passive, 〜ば, 〜たら). Each is a recipe with
 * `add: ""` (see recipes.ts) whose production is "make the form".
 *
 * NAMED, NOT COMPUTED, because `add: ""` does NOT pick them out: te-cause and
 * te-mo add nothing either but are USES of the て-form, not forms of their own, so
 * they link to the て-form's page rather than being one. This is the ONE source of
 * truth both the Library shelf (which heads a form's section with its recipe) and
 * PatternTeach (which links a pattern to its form's page instead of reprinting the
 * conjugation) read from.
 */
export const FORM_RECIPE_IDS: readonly string[] = [
  "te-sequence",
  "nai-form",
  "ta-form",
  "stem-form",
  // Standalone conjugation forms — the form IS the whole pattern (no suffix), so
  // each is its own form page (a conjugation the learner builds), not a pattern
  // that says "put it in its X form" with nowhere to learn that form.
  "passive",
  "potential",
  "causative",
  "causative-passive",
  "ba",
  "tara",
];

const FORM_RECIPE_ID_SET: ReadonlySet<string> = new Set(FORM_RECIPE_IDS);

/** Is this recipe one of the four form recipes? A form recipe KEEPS its full
 * conjugation build table on its Library page; a PATTERN built on a form links to
 * that page instead (see PatternTeach). Takes a recipe or a bare id. */
export function isFormRecipe(r: Recipe | string): boolean {
  return FORM_RECIPE_ID_SET.has(typeof r === "string" ? r : r.id);
}

/** The verb form a form recipe BUILDS → the recipe's id, for the forms that have
 * a page (て/で, ない, た, stem). Keyed on the verb attach form so callers can turn
 * "this pattern is built on the て-form" into "link to te-sequence" without a
 * second hand-kept table. Forms with no page (the plain form, the potential, 〜ば,
 * …) are simply absent. */
export const FORM_RECIPE_BY_FORM: ReadonlyMap<Form, string> = new Map(
  FORM_RECIPE_IDS.map((id) => [verbAttachForm(recipe(id)!) as Form, id]),
);

/**
 * The form recipe a PATTERN should link to instead of reprinting the form's build
 * table — the page for its verb attach form — or undefined.
 *
 * Undefined in the two cases a link would be wrong: the recipe IS a form recipe
 * (it owns the build table, it does not link to itself), or its verb form has no
 * page (the plain/dictionary form, the potential, 〜ば, …), or it has no verb host
 * at all (a noun pattern). See PatternTeach for the one caller.
 */
export function formEntryFor(r: Recipe): string | undefined {
  if (isFormRecipe(r)) return undefined;
  const f = verbAttachForm(r);
  return f ? FORM_RECIPE_BY_FORM.get(f) : undefined;
}

/**
 * Does this recipe CONJUGATE a verb — i.e. hang off a verb form that is not the
 * bare dictionary form?
 *
 * The axis the "verb classes" concept runs on. The moment a pattern asks for the
 * て-form, the ない-form, the stem, and so on, WHICH of the two groups the verb is
 * in (う-verb / る-verb) is what decides the shape — so every such pattern is a
 * place a learner would want the class idea explained. Read from the data, not a
 * hardcoded list: `null` (no verb host) and `"dictionary"` (attach to the plain
 * form, no class needed) are both excluded, everything else is in. */
export function conjugatesVerb(r: Recipe): boolean {
  const f = verbAttachForm(r);
  return f != null && f !== "dictionary";
}

/**
 * Does this recipe attach to an ADJECTIVE — an い-adjective or a な-adjective?
 *
 * The axis the "adjective types" concept runs on. Any pattern that hosts an
 * adjective (〜すぎる, 〜ので, 〜そう, and the rest) is a place the い-vs-な split
 * matters, because the two kinds attach differently. Read straight off the
 * attachments' hosts, so a new adjective-hosting pattern earns the link with no
 * edit here. */
export function hostsAdjective(r: Recipe): boolean {
  return r.attach.some((a) => a.host === "adj-i" || a.host === "adj-na");
}

/**
 * Does this recipe's verb attachment carry a 音便 SOUND CHANGE — i.e. is it built
 * on the て-form, the た-form, or たら?
 *
 * The generalization of `isTeFormRecipe`. The た-form's 音便 is byte-for-byte the
 * て-form's (った/んだ/いた/いだ/した for って/んで/いて/いで/して), and たら is た + ら,
 * so 〜たことがある, 〜たら and the rest split into the SAME five ending buckets as
 * the 〜て family — one skill (the 音便) regardless of the suffix. This is the axis
 * the per-ending production split runs on, and it is READ FROM THE DATA (the verb
 * attachment's `form`) rather than a hardcoded id list: a pattern gains the drill
 * by declaring `form: "te" | "ta" | "tara"`, with no edit here. る-verbs and the
 * irregulars stay off the board for all of them (endingBucketOf keys on the class).
 */
export function usesSoundChange(r: Recipe): boolean {
  const f = verbAttachForm(r);
  return f === "te" || f === "ta" || f === "tara";
}

/**
 * The row-shift forms — the ones with NO 音便, where every ending is its own
 * skill and the full-coverage round drills one verb per ending on a SINGLE
 * mastery fact (see `productionCoverageBuckets`). ば is here: its coverage is the
 * ten classes, and it is the one row-shift form on which する/来る are NOT
 * irregular (すれば/くれば coincide with the ichidan-る rule), so it carries no
 * special-verb facts. dictionary is deliberately absent — it is trivial (retype
 * the word), so no row-shift production fact is minted for it.
 */
const ROW_SHIFT_FORMS: ReadonlySet<Form> = new Set<Form>([
  "masu",
  "nai",
  "stem",
  "volitional",
  "potential",
  "passive",
  "causative",
  "causativePassive",
  "ba",
]);

/**
 * The three irregular verbs, each its own memorized production skill.
 *
 * `regular` is the class whose rule a learner would WRONGLY apply — the baseline
 * `specialVerbIrregular` compares against. For 行く that is the plain godan-く
 * (v5k): 行く is regular everywhere EXCEPT its 音便 (行って not 行いて), so measured
 * against v5k it comes out irregular on exactly て/た/たら and nowhere else. For
 * する/来る it is the ichidan-る rule (v1) a learner reaches for because they end
 * in る: measured against it they are irregular on every producible form except
 * ば, where すれば/くれば happen to coincide with drop-る + れば.
 */
interface SpecialVerb {
  readonly surface: string;
  readonly kana: string;
  readonly cls: WordClass;
  /** The fact-id qualifier: grammar:<recipe>/production@iku|suru|kuru. */
  readonly qualifier: string;
  /** The regular rule this verb is measured against — see the doc above. */
  readonly regular: WordClass;
}

const SPECIAL_VERBS: readonly SpecialVerb[] = [
  { surface: "行く", kana: "いく", cls: "v5k-s", qualifier: "iku", regular: "v5k" },
  { surface: "する", kana: "する", cls: "vs-i", qualifier: "suru", regular: "v1" },
  { surface: "来る", kana: "くる", cls: "vk", qualifier: "kuru", regular: "v1" },
];

/** The irregular-verb production qualifiers and the label the Library prints for
 * each "Build it" row — the display half of SPECIAL_VERBS, exported so the entry
 * page can enumerate an @iku/@suru/@kuru row without knowing how they are minted.
 * A row is shown only where the fact exists (factInfo), so this list is a menu,
 * not a promise. */
export const SPECIAL_VERB_ROWS: readonly { qualifier: string; label: string }[] =
  SPECIAL_VERBS.map((sv) => ({ qualifier: sv.qualifier, label: sv.surface }));

/**
 * Is this irregular verb IRREGULAR for this recipe's form — i.e. does its real
 * conjugation differ from what the regular rule (`sv.regular`) predicts?
 *
 * Computed, not hand-listed, so "which forms are irregular" cannot drift from the
 * conjugation engine. Building the recipe on the verb's TRUE class and on the
 * regular baseline and comparing yields, for 行く, exactly {て, た, たら} and, for
 * する/来る, every producible form except ば — the principled version of "add the
 * special verbs where they are actually special". False when the verb does not
 * build here at all (a noun-only recipe, a form that leaves it untouched), which
 * is also correctly "no fact".
 */
function specialVerbIrregular(r: Recipe, sv: SpecialVerb): boolean {
  // On the KANA reading, never the kanji surface. 来る's irregularity is in the
  // sound (きて, not the naive くて), and the kanji 来 masks it: 来て is the surface
  // string whether the reading is きて or a regular くて, so a surface comparison
  // finds 来る regular everywhere and never mints @kuru. The kana form exposes the
  // real difference — きて vs くて — for all three verbs.
  const real = apply(r, sv.kana, sv.cls);
  if (!real.ok || real.value === sv.kana) return false;
  const regular = apply(r, sv.kana, sv.regular);
  return !regular.ok || regular.value !== real.value;
}

/** A recipe's per-irregular-verb production fact — grammar:<recipe>/production@iku
 * (etc). The qualifier plays the role the 音便 ending plays in
 * `teEndingProductionFactId`, spelled through the same `productionAspect`. */
export function specialVerbProductionFactId(
  recipeId: string,
  qualifier: string,
): FactId {
  return factId(patternEntry(recipeId), productionAspect(qualifier));
}

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
 * A te-form pattern's production fact for ONE ending — e.g.
 * `grammar:te-kara/production@te-utsu`, `grammar:te-sequence/production@te-ku`.
 *
 * The ending plays the role the HOST plays in `patternProductionFactId`: it is
 * the axis the fact is qualified on, spelled through the same `productionAspect`
 * so the id shape is identical (`production@<qualifier>`). EVERY te-form-based
 * pattern splits this way (see `isTeFormRecipe`) — its five endings REPLACE the
 * plain `grammar:<recipe>/production` fact rather than sitting beside it, so there
 * is no unqualified production fact for a te-pattern to collide with. See
 * te-endings.ts for why the split is by ending (each 音便 is a separate skill) and
 * why る is not one of them.
 */
export function teEndingProductionFactId(
  recipeId: string,
  ending: TeEnding,
): FactId {
  return factId(patternEntry(recipeId), productionAspect(ending));
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
  // A 音便 pattern (て/た/たら) does not split by host — it splits by ENDING (see
  // teEndingProductionFactId), and only on the VERB. Its production facts are
  // minted separately in buildGrammarFacts, so it carries NO host-keyed production
  // fact and every host-based consumer (the Library build panel, guided
  // substitution, the distractor loop) correctly sees zero here rather than a
  // plain fact that no longer exists. This is why 〜て/〜ても/〜てもいい no longer
  // carry an adjective production fact: the whole 〜て family is verb-ending drills.
  // The row-shift forms are NOT here: they keep their single host-keyed mastery
  // fact and instead expand it per-ending in coverage (productionCoverageBuckets).
  if (usesSoundChange(r)) {
    // The verb side splits by ENDING, so it carries no verb host fact. The 〜て
    // family stops there: its adjective (高くて) is not separately scored, the
    // whole family being verb-ending drills. But た/たら's adjective conditional
    // (高かったら, 静かだったら) is its own formation, not a 音便, so those hosts
    // keep their production fact alongside the verb's ending split.
    if (isTeFormRecipe(r)) return [];
    return HOST_ORDER.filter(
      (h) => h !== "verb" && r.attach.some((a) => a.host === h && !isTrivialAttachment(a)),
    );
  }
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
 * Every grammar fact: one MEANING per pattern, plus PRODUCTIONS for the ones you
 * can be asked to build. The production side splits three ways, because "build
 * this pattern" is not one skill:
 *
 *   HOST     〜すぎる on a verb vs an い-adjective are two rules (行きすぎる, 高すぎ
 *            る), so two facts — see `productionHosts`.
 *   ENDING   a 音便 pattern (て/た/たら) is five separate sound-change skills, so
 *            up to five per-ending facts (五 for 〜てから, 四 for 〜てある, which
 *            refuses its intransitive-anchor ending) and NO host-keyed one — see
 *            `teEndingProductionFactId` / `usesSoundChange`.
 *   VERB     行く / する / 来る are irregular where the rule does not predict them,
 *            each a memorized skill of its own, so a pattern carries an @iku /
 *            @suru / @kuru fact wherever they are special — see
 *            `specialVerbProductionFactId` / `mintSpecialVerbFacts`.
 *
 * The ROW-SHIFT forms (ます, ない, stem, 〜ば, …) are the deliberate NON-split: their
 * every-ending coverage rides on the CARD, not the fact, so 〜ます keeps ONE mastery
 * fact and the full-coverage round still asks かきます / かいます / たべます in one pass
 * — see `productionCoverageBuckets`. So a 音便 pattern is 5 endings + @iku + @suru +
 * @kuru (8 for 〜てから), a ます pattern is 1 regular fact + @suru + @kuru, and a ば
 * pattern is 1 regular fact alone (する/来る coincide with the ichidan rule there).
 *
 * A pattern that WRAPS a slot (〜たり〜たり) has no production fact at all, because
 * there is no one string that answers it — the generator once served 行ったり,
 * half the pattern graded as the whole of it, and that fact was removed.
 */
/** Which recipe a grammar fact belongs to, and which aspect it asks. Built
 * alongside GRAMMAR_FACTS so the question layer (engine/question.ts) can recover
 * the recipe WITHOUT parsing the opaque id — the same lookup-not-parse rule the
 * kanji subject follows with READING_INDEX. Declared BEFORE GRAMMAR_FACTS, whose
 * builder populates them, or the build reaches them in their dead zone. */
const MEANING_OF = new Map<FactId, string>();
/** A production fact's recipe, the host it produces on, and its BUCKET — the
 * vehicle filter it is pinned to. The host is half the fact now that a pattern
 * can carry one per host; the bucket is the other axis, a 音便 ending (te/ta/たら)
 * or an irregular verb (@iku/@suru/@kuru). Absent for a plain host fact, whose
 * showings roll freely (a row-shift fact's per-ending coverage rides on the CARD,
 * not the fact — see productionCoverageBuckets). */
const PRODUCTION_OF = new Map<
  FactId,
  { recipeId: string; host: Host; bucket?: VehicleBucket }
>();
/** A ROW-SHIFT production fact -> the class buckets its full-coverage round
 * expands it into, one per drillable ending (see productionCoverageBuckets). A
 * SINGLE mastery fact, drilled once per ending, not fragmented into per-ending
 * facts. Empty/absent for every fact that is a single card (音便 endings and the
 * irregular verbs are already one-bucket facts; adjective/noun facts roll one). */
const COVERAGE_OF = new Map<FactId, VehicleBucket[]>();

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
    // A 音便 pattern (て/た/たら) splits its production into one fact PER ENDING
    // (see te-endings.ts): building the て/た-form of a く verb and of a す verb are
    // two separate 音便 skills, so each ending is its own gradeable fact, baked on a
    // representative verb of that ending and carrying the FULL pattern (書いてから
    // for te-kara, 書いたことがある for ta-koto-ga-aru). This REPLACES the plain
    // grammar:<recipe>/production fact — productionHosts returns [] for every 音便
    // pattern, so the host loop below emits nothing for them. It applies to the
    // whole 〜て family AND the た/たら patterns, not just te-sequence.
    if (usesSoundChange(r)) {
      for (const ending of TE_ENDINGS) {
        const anchor = ENDING_ANCHOR[ending];
        // The recipe's own verb restriction still holds: 〜てある wants a verb
        // somebody does to something, so its intransitive-anchor ending (泳ぐ) is
        // skipped rather than baked into 泳いである — the same never-mark-correct-
        // Japanese-wrong guard the vehicle pool applies. Absent a restriction
        // (every other 音便 pattern) this is a no-op and all five endings mint.
        if (!recipeAllows(r, anchor.surface)) continue;
        const surface = apply(r, anchor.surface, anchor.cls);
        if (!surface.ok || surface.value === anchor.surface) continue;
        const kana = apply(r, anchor.kana, anchor.cls);
        const form = surface.value;
        const kanaForm = kana.ok ? kana.value : form;
        const pId = teEndingProductionFactId(r.id, ending);
        PRODUCTION_OF.set(pId, {
          recipeId: r.id,
          host: "verb",
          bucket: { kind: "ending", ending },
        });
        facts.push({
          id: pId,
          entry: patternEntry(r.id),
          glyph: form,
          answers: form === kanaForm ? [form] : [form, kanaForm],
          subject: GRAMMAR_SUBJECT,
          meaning: r.gloss,
        });
      }
      // Fall through to the host loop: for た/たら it mints the adjective
      // conditional facts (productionHosts returns those non-verb hosts); for the
      // 〜て family productionHosts is [], so the loop emits nothing and only the
      // ending facts stand. The special verbs are minted once, below.
    }
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
      // A ROW-SHIFT verb fact is ONE mastery fact, but its full-coverage round
      // drills every ending — one verb per godan ending plus the v5r and v1
      // classes. That coverage is recorded here (the buckets the recipe can
      // legally host) and expanded per CARD by the coverage layer, so 'solid' on
      // 〜ます stays a single fact while the quiz still asks かきます, かいます, たべ
      // ます … in one round. Only the verb host, and only the row-shift forms.
      if (host === "verb" && ROW_SHIFT_FORMS.has(verbAttachForm(r) as Form)) {
        const buckets = rowShiftCoverage(r);
        if (buckets.length) COVERAGE_OF.set(pId, buckets);
      }
    }
    mintSpecialVerbFacts(r, facts);
  }
  return facts;
}

/**
 * The class buckets a row-shift recipe's coverage round expands its ONE mastery
 * fact into — the ROW_SHIFT_CLASSES the recipe can legally build on, in ending
 * order. Computed off the vehicle pool (not assumed to be all ten) so a recipe
 * that restricts its verbs — 〜られる passive wants a transitive one — covers only
 * the endings it can actually host, exactly as the deal would.
 */
function rowShiftCoverage(r: Recipe): VehicleBucket[] {
  const classes = new Set(vehiclesFor(r, "verb").map((v) => v.cls));
  return ROW_SHIFT_CLASSES.filter((c) => classes.has(c)).map((cls) => ({
    kind: "class",
    cls,
  }));
}

/**
 * Mint the @iku / @suru / @kuru production facts a recipe carries — one per
 * irregular verb that is IRREGULAR on this recipe's form (specialVerbIrregular)
 * AND that the recipe accepts (recipeAllows). 行く lands only on 音便 patterns;
 * する/来る on every producible form except ば. Each is baked on its own verb and
 * pinned to a `verb` bucket so its showings roll exactly that verb — a separate
 * memorized skill, never mixed into the ending or class coverage.
 */
function mintSpecialVerbFacts(r: Recipe, facts: FactInfo[]): void {
  for (const sv of SPECIAL_VERBS) {
    if (!recipeAllows(r, sv.surface)) continue;
    if (!specialVerbIrregular(r, sv)) continue;
    const surface = apply(r, sv.surface, sv.cls);
    if (!surface.ok || surface.value === sv.surface) continue;
    const kana = apply(r, sv.kana, sv.cls);
    const form = surface.value;
    const kanaForm = kana.ok ? kana.value : form;
    const pId = specialVerbProductionFactId(r.id, sv.qualifier);
    PRODUCTION_OF.set(pId, {
      recipeId: r.id,
      host: "verb",
      bucket: { kind: "verb", surface: sv.surface },
    });
    facts.push({
      id: pId,
      entry: patternEntry(r.id),
      glyph: form,
      answers: form === kanaForm ? [form] : [form, kanaForm],
      subject: GRAMMAR_SUBJECT,
      meaning: r.gloss,
    });
  }
}

/**
 * The BUCKETS a production fact's full-coverage round expands it into, or empty.
 *
 * Non-empty only for a ROW-SHIFT verb mastery fact: the coverage layer (ask-forms)
 * multiplies that ONE fact's card forms across these buckets so the round asks a
 * verb of every ending while the fact stays single. Empty for everything else —
 * a 音便 ending fact and an @iku/@suru/@kuru fact are already one-bucket facts
 * pinned by the fact itself, and an adjective/noun fact rolls one vehicle — so the
 * coverage layer leaves them as a single card. See engine/question.grammarVehicleFor,
 * which reads the CARD's bucket for these and the FACT's bucket otherwise.
 */
export function productionCoverageBuckets(fact: FactId): readonly VehicleBucket[] {
  return COVERAGE_OF.get(fact) ?? [];
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
): { recipe: Recipe; lemma: string; host: Host; bucket?: VehicleBucket } | null {
  const hit = PRODUCTION_OF.get(fact);
  const r = hit ? recipe(hit.recipeId) : undefined;
  if (!r || !hit) return null;
  // A BUCKETED fact (a 音便 ending or an irregular verb) is baked on its bucket's
  // own verb, not the fixed 行く buildExample would hand back — 行く is the いく
  // EXCEPTION and would be the wrong (and wrong-ending) fallback for, say, the す
  // fact. So the lemma and the bucket both come from the bucket, and the showing's
  // vehicle filter (grammarVehicleFor) uses the bucket to pick the right verb.
  // A class bucket never reaches a FACT (row-shift coverage lives on the card), so
  // only ending / verb buckets are seen here.
  if (hit.bucket) {
    const lemma =
      hit.bucket.kind === "ending"
        ? ENDING_ANCHOR[hit.bucket.ending].surface
        : hit.bucket.kind === "verb"
          ? hit.bucket.surface
          : ""; // class buckets are card-level, never stored on a fact
    return { recipe: r, lemma, host: hit.host, bucket: hit.bucket };
  }
  const ex = buildExample(r, hit.host);
  return ex ? { recipe: r, lemma: ex.lemma, host: hit.host } : null;
}
