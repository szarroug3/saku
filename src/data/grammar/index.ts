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
import { HOST_ORDER, buildExample, openExample, primaryHost } from "../../lib/grammar/example.ts";
import { apply, applyWrap } from "../../lib/grammar/apply.ts";
import { recipeAllows } from "../../lib/grammar/vehicles.ts";
import {
  CLASS_ANCHOR,
  type VehicleBucket,
} from "../../lib/grammar/te-endings.ts";
import type { Form, WordClass } from "../../lib/conjugate/index.ts";
import type { EntryId, FactId, FactInfo } from "../../types/index.ts";
import {
  RECIPES,
  isProducible,
  primaryPatternRecipe,
  isTrivialAttachment,
  patternLabel,
  recipe,
  type Host,
  type Recipe,
} from "./recipes.ts";

export const GRAMMAR_SUBJECT = "grammar";

/** The bare て/で-form recipe, whose intro leads the grammar track. */
export const TE_FORM_RECIPE_ID = "te-sequence";

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
 * NAMED, NOT COMPUTED, because `add: ""` does NOT pick them out: te-mo adds
 * nothing too but is a USE of the て-form, not a form of its own, so
 * they link to the て-form's page rather than being one. This is the ONE source of
 * truth both the Library shelf (which heads a form's section with its recipe) and
 * PatternTeach (which links a pattern to its form's page instead of reprinting the
 * conjugation) read from.
 */
export const FORM_RECIPE_IDS: readonly string[] = [
  "prenominal-form",
  "te-sequence",
  "nai-form",
  "ta-form",
  "stem-form",
  // Standalone conjugation forms — the form IS the whole pattern (no suffix), so
  // each is its own form page (a conjugation the learner builds), not a pattern
  // that says "put it in its X form" with nowhere to learn that form.
  "masu-form",
  "volitional-form",
  "passive",
  "potential",
  "causative",
  "causative-passive",
  "ba",
  "tara",
];

const FORM_RECIPE_ID_SET: ReadonlySet<string> = new Set(FORM_RECIPE_IDS);

/** Is this recipe one of the standalone form recipes? A form recipe KEEPS its full
 * conjugation build table on its Library page; a PATTERN built on a form links to
 * that page instead (see PatternTeach). Takes a recipe or a bare id. */
export function isFormRecipe(r: Recipe | string): boolean {
  return FORM_RECIPE_ID_SET.has(typeof r === "string" ? r : r.id);
}

/** A form a form recipe BUILDS → the recipe's id. Most are verb forms; the
 * adjective-only prenominal form maps here too so patterns such as 〜ので can
 * point back to the lesson that introduced な. */
export const FORM_RECIPE_BY_FORM: ReadonlyMap<Form, string> = new Map(
  FORM_RECIPE_IDS.flatMap((id) => {
    const r = recipe(id)!;
    const form = verbAttachForm(r) ?? r.attach.find((a) => a.form != null)?.form;
    return form ? [[form, id] as const] : [];
  }),
);

/**
 * The form recipe a PATTERN should link to instead of reprinting the form's build
 * table, or undefined.
 *
 * Undefined when the recipe owns the form page itself or none of its transformed
 * attachment forms has a page. See PatternTeach for the one caller.
 */
export function formEntryFor(r: Recipe): string | undefined {
  if (isFormRecipe(r)) return undefined;
  const f = verbAttachForm(r);
  if (f) {
    const verbForm = FORM_RECIPE_BY_FORM.get(f);
    if (verbForm) return verbForm;
  }
  for (const attachment of r.attach) {
    if (!attachment.form || isTrivialAttachment(attachment)) continue;
    const formRecipe = FORM_RECIPE_BY_FORM.get(attachment.form);
    if (formRecipe) return formRecipe;
  }
  return undefined;
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
 * The exceptional verbs, each its own memorized production skill.
 *
 * `regular` is the class whose rule a learner would WRONGLY apply — the baseline
 * `specialVerbIrregular` compares against. For 行く that is the plain godan-く
 * (v5k): 行く is regular everywhere EXCEPT its 音便 (行って not 行いて), so measured
 * against v5k it comes out irregular on exactly て/た/たら and nowhere else. For
 * する/来る it is the ichidan-る rule (v1) a learner reaches for because they end
 * in る: measured against it they are irregular on every producible form except
 * ば, where すれば/くれば happen to coincide with drop-る + れば.
 */
interface SpecialWord {
  readonly surface: string;
  readonly kana: string;
  readonly cls: WordClass;
  /** The fact-id qualifier: grammar:<recipe>/production@iku|suru|kuru|ii. */
  readonly qualifier: string;
  /** The regular rule this word is measured against — see the doc above. */
  readonly regular: WordClass;
  /** The attachment host this word satisfies — verb for 行く/する/来る, adj-i for いい. */
  readonly host: Host;
}

const SPECIAL_VERBS: readonly SpecialWord[] = [
  { surface: "行く", kana: "いく", cls: "v5k-s", qualifier: "iku", regular: "v5k", host: "verb" },
  { surface: "する", kana: "する", cls: "vs-i", qualifier: "suru", regular: "v1", host: "verb" },
  { surface: "来る", kana: "くる", cls: "vk", qualifier: "kuru", regular: "v1", host: "verb" },
  { surface: "ある", kana: "ある", cls: "v5r-i", qualifier: "aru", regular: "v5r", host: "verb" },
];

/**
 * The irregular ADJECTIVE, いい — its own memorized skill, exactly like the three
 * irregular verbs. Measured against the plain い-adjective rule (adj-i): いい comes
 * out irregular wherever it conjugates, because its stem is よ, not い (よくて not
 * いくて, よければ not いければ). Minted only where the recipe scores an い-adjective
 * (productionHosts includes adj-i), so a verb-only form never carries it.
 */
const SPECIAL_ADJS: readonly SpecialWord[] = [
  { surface: "いい", kana: "いい", cls: "adj-ix", qualifier: "ii", regular: "adj-i", host: "adj-i" },
];

/** The irregular-verb production qualifiers and the label the Library prints for
 * each "Build it" row — the display half of SPECIAL_VERBS, exported so the entry
 * page can enumerate an @iku/@suru/@kuru row without knowing how they are minted.
 * A row is shown only where the fact exists (factInfo), so this list is a menu,
 * not a promise. */
export const SPECIAL_VERB_ROWS: readonly { qualifier: string; label: string }[] =
  SPECIAL_VERBS.map((sv) => ({ qualifier: sv.qualifier, label: sv.surface }));

/** The exceptional adjective rows the Library enumerates beside regular
 * adjective production. Kept separate from SPECIAL_VERB_ROWS so each visible
 * section can name the kind of rule it lists. */
export const SPECIAL_ADJ_ROWS: readonly { qualifier: string; label: string }[] =
  SPECIAL_ADJS.map((sw) => ({ qualifier: sw.qualifier, label: sw.surface }));

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
function specialVerbIrregular(r: Recipe, sv: SpecialWord): boolean {
  // On the KANA reading, never the kanji surface. 来る's irregularity is in the
  // sound (きて, not the naive くて), and the kanji 来 masks it: 来て is the surface
  // string whether the reading is きて or a regular くて, so a surface comparison
  // finds 来る regular everywhere and never mints @kuru. The kana form exposes the
  // real difference, such as きて vs くて.
  const real = apply(r, sv.kana, sv.cls);
  if (!real.ok || real.value === sv.kana) return false;
  const regular = apply(r, sv.kana, sv.regular);
  return !regular.ok || regular.value !== real.value;
}

/** A recipe's exceptional-word production fact, such as production@iku or @ii. */
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
 * A pattern's production fact for ONE conjugation CLASS — e.g.
 * `grammar:te-kara/production@v5u`, `grammar:masu-form/production@v1`.
 *
 * The class is the axis every verb-hosting pattern now splits on: building the
 * form of a う-verb and of a く-verb are two separate scored skills, so each class
 * is its own gradeable fact (baked on that class's CLASS_ANCHOR verb). This is the
 * ONE verb-production scheme for both 音便 and row-shift forms — it replaces the
 * five collapsed 音便 endings AND the single row-shift mastery fact. 行く/する/来る
 * are NOT classes here; where a form conjugates them irregularly they get their own
 * `@iku/@suru/@kuru` verb fact (see `specialVerbProductionFactId`).
 */
export function classProductionFactId(recipeId: string, cls: WordClass): FactId {
  return factId(patternEntry(recipeId), productionAspect(cls));
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
 * Verb production is omitted here because it is minted per class. Every
 * supported adjective class keeps its own fact, even when its shape stays
 * unchanged before a suffix; other non-verb hosts are scored only when their
 * form transforms.
 */
export function productionHosts(r: Recipe): Host[] {
  // VERB IS NO LONGER A HOST FACT — it splits per conjugation class in
  // buildGrammarFacts (9 godan + ichidan + irregulars). So this returns only the
  // NON-verb hosts: every adjective type a pattern supports, or a transformed
  // noun host. 〜すぎる on 高い is 高すぎる, a rule apart from its verb one, so it
  // is its own scored fact. 高いので keeps 高い unchanged but still gets the
  // adj-i fact because the quiz must cover every supported adjective type.
  //
  // Trivial noun hosts remain excluded. Adjective hosts are deliberately kept:
  // class coverage, including "do not change this type", is the lesson.
  return HOST_ORDER.filter(
    (h) =>
      h !== "verb" &&
      r.attach.some(
        (a) =>
          a.host === h &&
          (h === "adj-i" || h === "adj-na" || !isTrivialAttachment(a)),
      ),
  );
}

/**
 * Every grammar fact: one MEANING per pattern, plus PRODUCTIONS for the ones you
 * can be asked to build. The production side splits three ways, because "build
 * this pattern" is not one skill:
 *
 *   CLASS    every regular verb class is one fact, including classes that share
 *            the same surface ending in one form.
 *   HOST     adjective and noun transformations are separate from verb rules.
 *   WORD     行く / する / 来る / ある / いい each get a fact exactly where their
 *            result differs from the corresponding regular rule.
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
/** A production fact's recipe, host, and class or exceptional-word vehicle filter. */
const PRODUCTION_OF = new Map<
  FactId,
  { recipeId: string; host: Host; bucket?: VehicleBucket }
>();

export const GRAMMAR_FACTS: FactInfo[] = buildGrammarFacts();

function buildGrammarFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const r of RECIPES) {
    const mId = patternMeaningFactId(r.id);
    const libraryEntry = patternEntry(primaryPatternRecipe(r.id)?.id ?? r.id);
    MEANING_OF.set(mId, r.id);
    facts.push({
      id: mId,
      entry: libraryEntry,
      glyph: patternLabel(r),
      answers: [r.gloss],
      subject: GRAMMAR_SUBJECT,
      meaning: r.gloss,
    });
    // isProducible, not isVacuous: a fact the generator will always refuse is
    // a fact the scheduler would schedule forever and never be able to ask.
    if (!isProducible(r)) continue;
    // VERB PRODUCTION SPLITS BY CLASS — the one scheme for every form. Building
    // the form of a う-verb, a く-verb, an ichidan verb … are separate scored
    // skills ("just because you remember む transforms one way does not mean you
    // remember ぬ"), so each conjugation class the recipe legally transforms is its
    // own gradeable fact, baked on that class's CLASS_ANCHOR verb (書いてから for
    // te-kara's v5k, 食べます for masu-form's v1). This REPLACES both the collapsed
    // 音便 endings (う・つ・る were one fact) and the row-shift mastery-fact-plus-
    // coverage: 音便 and row-shift forms are now drilled identically, one fact per
    // class. The recipe's own verb restriction still holds — 〜てある wants a verb
    // done to something, so its 泳ぐ class is skipped rather than baked into
    // 泳いである — via recipeAllows, the same guard the vehicle pool applies.
    //
    // A WRAP conjugates on its CLOSING half, not `r.attach` — 〜しか〜ない's verb
    // is `r.wrap.close`, so `conjugatesVerb(r)` (which only looks at `r.attach`)
    // is false for it and this is a second, parallel condition, not a rewrite of
    // the first. The two never both fire: no recipe conjugates a verb on both
    // ends today, and isOrderFree would refuse asking one that did.
    const closeVerbForm = r.wrap?.close.find((a) => a.host === "verb")?.form;
    if (conjugatesVerb(r)) {
      for (const a of CLASS_ANCHOR) {
        if (!recipeAllows(r, a.surface)) continue;
        const surface = apply(r, a.surface, a.cls);
        if (!surface.ok || surface.value === a.surface) continue;
        const kana = apply(r, a.kana, a.cls);
        const form = surface.value;
        const kanaForm = kana.ok ? kana.value : form;
        const pId = classProductionFactId(r.id, a.cls);
        PRODUCTION_OF.set(pId, {
          recipeId: r.id,
          host: "verb",
          bucket: { kind: "class", cls: a.cls },
        });
        facts.push({
          id: pId,
          entry: libraryEntry,
          glyph: form,
          answers: form === kanaForm ? [form] : [form, kanaForm],
          subject: GRAMMAR_SUBJECT,
          meaning: r.gloss,
        });
      }
      // The irregular verbs (行く/する/来る), minted only where THIS form conjugates
      // them irregularly — 行って for the て-form, but nothing for 〜ます (行きます is
      // regular). Their classes (v5k-s/vs-i/vk) are absent from CLASS_ANCHOR on
      // purpose, so they never double the regular class facts above.
      mintSpecialWordFacts(r, facts, SPECIAL_VERBS);
    } else if (closeVerbForm && closeVerbForm !== "dictionary") {
      // A WRAP whose CLOSING half conjugates a verb — today only shika-nai. Same
      // per-class scheme as the ordinary verb loop above, run through applyWrap
      // instead of apply: the OPENING slot is a fixed word (openExample — 本 for
      // shika-nai, never varying, exactly as HOST_EXAMPLE never varies for a
      // single-host noun fact) and the CLOSING slot is the varying class anchor.
      // The baked answer is therefore the WHOLE two-slot string (本しか読まない),
      // never one half of it — applyWrap concatenates both by construction, which
      // is precisely the guarantee 〜たり〜たり's removed attempt did not have
      // (see the header comment above `buildGrammarFacts`).
      const open = openExample(r);
      for (const a of CLASS_ANCHOR) {
        if (!recipeAllows(r, a.surface)) continue;
        const surface = applyWrap(r, open.surface, open.cls, a.surface, a.cls);
        if (!surface.ok || surface.value === open.surface + a.surface) continue;
        const kana = applyWrap(r, open.kana, open.cls, a.kana, a.cls);
        const form = surface.value;
        const kanaForm = kana.ok ? kana.value : form;
        const pId = classProductionFactId(r.id, a.cls);
        PRODUCTION_OF.set(pId, {
          recipeId: r.id,
          host: "verb",
          bucket: { kind: "class", cls: a.cls },
        });
        facts.push({
          id: pId,
          entry: libraryEntry,
          glyph: form,
          answers: form === kanaForm ? [form] : [form, kanaForm],
          subject: GRAMMAR_SUBJECT,
          meaning: r.gloss,
        });
      }
    }
    // NON-VERB hosts keep their own host fact. 〜すぎる on 高い is 高すぎる, a rule
    // apart from the verb one, so its own scored fact; the verb host is handled
    // per-class above and skipped here. buildExample bakes the fixed representative
    // (see lib/grammar/example.ts) so the fact grades through the ordinary
    // `accepts` path — glyph is the form, answers are its kanji and kana.
    const hosts = productionHosts(r);
    for (const host of hosts) {
      if (host === "verb") continue;
      const ex = buildExample(r, host);
      if (!ex) continue;
      const pId = patternProductionFactId(r.id, host);
      PRODUCTION_OF.set(pId, {
        recipeId: r.id,
        host,
        // Keep the regular い-adjective fact from rolling the separately scored
        // いい exception. な-adjectives are pinned for the same explicitness.
        bucket:
          host === "adj-i"
            ? { kind: "class", cls: "adj-i" }
            : host === "adj-na"
              ? { kind: "class", cls: "adj-na" }
              : undefined,
      });
      facts.push({
        id: pId,
        entry: libraryEntry,
        glyph: ex.form,
        answers: ex.form === ex.kanaForm ? [ex.form] : [ex.form, ex.kanaForm],
        subject: GRAMMAR_SUBJECT,
        meaning: r.gloss,
      });
    }
    // The irregular adjective いい (よくて / よければ), where this form scores an
    // い-adjective at all — the same "separate memorized skill" the verb irregulars
    // get. Gated on adj-i being a scored host, so a verb-only or deferring form
    // never carries it.
    if (hosts.includes("adj-i")) mintSpecialWordFacts(r, facts, SPECIAL_ADJS);
  }
  return facts;
}

/**
 * Mint the special-WORD production facts a recipe carries — @iku/@suru/@kuru for
 * the irregular verbs, @ii for the irregular adjective いい — one per word that is
 * IRREGULAR on this recipe's form (specialWordIrregular) AND that the recipe
 * accepts (recipeAllows). 行く lands only on 音便 patterns; する/来る on every
 * producible form except ば; いい wherever the form scores an い-adjective. Each is
 * baked on its own word and pinned to a `verb` (single-word) bucket so its
 * showings roll exactly that word — a separate memorized skill, never mixed into
 * the class coverage.
 */
function mintSpecialWordFacts(
  r: Recipe,
  facts: FactInfo[],
  words: readonly SpecialWord[],
): void {
  for (const sw of words) {
    if (!recipeAllows(r, sw.surface)) continue;
    if (!specialVerbIrregular(r, sw)) continue;
    const surface = apply(r, sw.surface, sw.cls);
    if (!surface.ok || surface.value === sw.surface) continue;
    const kana = apply(r, sw.kana, sw.cls);
    const form = surface.value;
    const kanaForm = kana.ok ? kana.value : form;
    const pId = specialVerbProductionFactId(r.id, sw.qualifier);
    PRODUCTION_OF.set(pId, {
      recipeId: r.id,
      host: sw.host,
      bucket: { kind: "verb", surface: sw.surface },
    });
    facts.push({
      id: pId,
      entry: patternEntry(primaryPatternRecipe(r.id)?.id ?? r.id),
      glyph: form,
      answers: form === kanaForm ? [form] : [form, kanaForm],
      subject: GRAMMAR_SUBJECT,
      meaning: r.gloss,
    });
  }
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
  // A BUCKETED fact (a conjugation class or an irregular verb) is baked on its
  // bucket's own verb, not the fixed 行く buildExample would hand back — 行く is the
  // いく EXCEPTION and the wrong (and wrong-class) fallback for, say, the す fact. So
  // the lemma comes from the bucket: a class bucket's CLASS_ANCHOR verb, a verb
  // bucket's own surface. grammarVehicleFor then uses the bucket to pick the verb.
  if (hit.bucket && (hit.host === "verb" || hit.bucket.kind === "verb")) {
    const b = hit.bucket;
    const lemma =
      b.kind === "class"
        ? (CLASS_ANCHOR.find((a) => a.cls === b.cls)?.surface ?? "")
        : b.kind === "verb"
          ? b.surface
          : "";
    return { recipe: r, lemma, host: hit.host, bucket: hit.bucket };
  }
  const ex = buildExample(r, hit.host);
  return ex ? { recipe: r, lemma: ex.lemma, host: hit.host } : null;
}
