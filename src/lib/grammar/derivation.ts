// SAK-194: the grammar-production hint/reveal's TWO-STEP DERIVATION — showing
// the actual arithmetic ("たかい − い + くて → たかくて", then
// "たかくて + もいい → たかくてもいい") instead of naming the rule ("uses the
// て-form"). See src/lib/engine/hint.ts's grammarHint for the caller.
//
// REUSE, NOT REINVENT. Both halves of this already exist elsewhere:
//
//   - Step 1 (dictionary form -> intermediate form) is the same
//     shared-prefix diff formRuleTables() in src/data/grammar/form-intros.ts
//     runs to build the Library's standalone form pages: conjugate() the
//     word, diff it against the original on their common prefix, and what's
//     left over is the drop/add. This file reimplements that ONE diff (it is
//     four lines and formRuleTables() does not export it), not a different
//     algorithm.
//   - Step 2 (intermediate form -> finished pattern) is exactly the
//     `trim`/`add` a Formula already carries — recipeFormula() in
//     ./formula.ts, the same data IntroBuildFormula renders on a pattern's
//     Library page. This file does not recompute a suffix rule; it reads the
//     one formula.ts already worked out for this recipe and host.
//
// WHOLE-WORD VS DROP/ADD, STEP 1 ONLY. A regular word's step 1 is shown as a
// drop/add equation (たかい − い + くて → たかくて); an irregular word's is
// shown as a whole-word arrow (いい → よくて), because there is no shared
// rule to spell out. "Irregular" here means either of two things, confirmed
// against conjugate() for every category the vehicle pool can produce (いい,
// たかい, しずか, 行く, かく, たべる, する — see derivation.test.ts):
//
//   1. The conjugation class is one of the inherently irregular ones
//      (adj-ix, vs-i, vk, v5k-s, and v5u-s for the same reason, if it ever
//      enters the pool) — these do not follow their family's regular rule at
//      all (いい -> よくて, not いくて; する -> して, not すて).
//   2. The generic safety net: the base word and its conjugated form share
//      NO prefix. A drop/add equation with an empty stem ("∅ − い + い →
//      い"?) is not a sentence a learner can read, so anything that collapses
//      that far is shown whole instead, whichever class it happens to be.
//
// Step 2 never has a whole-word mode: it is always the recipe's own
// trim/add, read straight off the Formula. `except` overrides (one recipe,
// sou-appearance's さ-insertion) are not applied here, for the same reason
// formHintText already doesn't apply them — Formula itself is except-blind,
// and this file's whole job is to read Formula, not to re-derive around it.

import { conjugate, type WordClass } from "../conjugate/index.ts";
import type { Host, Recipe } from "../../data/grammar/recipes.ts";
import { FORM_LABEL, recipeFormula } from "./formula.ts";

/**
 * Conjugation classes that never follow their family's regular build rule —
 * the WHOLE-WORD half of the step-1 test. See the file header.
 */
const IRREGULAR_STEP1_CLASSES: ReadonlySet<WordClass> = new Set([
  "adj-ix",
  "vs-i",
  "vk",
  "v5k-s",
  "v5u-s",
]);

/** How far `a` and `b` agree from the start. The same diff formRuleTables()
 * runs in src/data/grammar/form-intros.ts — kept here as a tiny local copy
 * because that file does not export it, not as a second algorithm. */
function prefixLen(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * One equation in a derivation: a starting word/form and what it becomes.
 *
 * `whole` marks the WHOLE-WORD irregular rendering (いい → よくて) — `trim`
 * and `add` are absent then, because there is no rule to spell out, only a
 * word to memorise. Otherwise `trim`/`add` carry the drop/add pieces (either
 * or both may be absent — a pure add has no trim, and vice versa), always
 * alongside `to`, the equation's actual result.
 *
 * The renderer accents `to` — the RESULT — never `add`. That was a confirmed
 * design decision (see SAK-194's mockup history): the thing a learner should
 * notice is what the word BECAME, not which letters were bolted on.
 */
export interface DerivationEquation {
  /** The word or form this equation starts from. */
  readonly from: string;
  /** Text dropped off the end of `from` before adding, if any. Absent for a
   * whole-word equation and for an add-only step (nothing is removed). */
  readonly trim?: string;
  /** Text added, if any. Absent for a whole-word equation and for a
   * drop-only step (a form trimmed down to nothing added on top). */
  readonly add?: string;
  /** True for an irregular whole-word build with no rule to spell out. */
  readonly whole?: boolean;
  /** The equation's result. */
  readonly to: string;
  /** What this equation DOES, in words — "Dictionary form → て-form",
   * "て-form → Pattern". A static caption above the equation, not a dynamic
   * sentence: it names the two ends of the step rather than instructing
   * ("put X into Y"), the same register the Library's own build-table
   * headers ("Ending", "Change") already use. */
  readonly label: string;
}

/**
 * A production card's derivation, ready to render: the base word, the final
 * built answer, and the one or two equations that get from one to the other.
 *
 * `step1` (dictionary form -> intermediate form) is ABSENT for a recipe with
 * nothing to conjugate there — a noun attachment, a dictionary-form
 * attachment, or a word whose named form happens to equal itself (いい stays
 * いい before a noun). `step2` (intermediate form -> finished pattern) is
 * ABSENT for a recipe that adds nothing and trims nothing — the standalone
 * form recipes (te-sequence, ba, tara, …), where the built FORM is the whole
 * answer. Both are never absent together: see `deriveProduction`.
 *
 * `title` is the category/class heading the mockup prints above the "becomes"
 * line — "Irregular い-adjective", "い-adjective", "な-adjective", "Irregular
 * う-verb / godan", "う-verb / godan", "る-verb / ichidan", "Irregular verb".
 * Absent for a noun host (nothing to head — there is no step1 there either)
 * and for any class the label table below does not name. See
 * `derivationTitle`.
 *
 * `pattern` is the recipe's own display name (`recipe.pattern`, e.g.
 * "〜てもいい"), added for SAK-198. It already rides inside `step2.label` as
 * the RIGHT side of a string like "て-form → 〜てもいい", but that label is a
 * caption built for display, not a value to recover: string-parsing it back
 * apart to pull the pattern out would be reading display text to recover a
 * structural fact, the exact mistake formula.ts's own header records having
 * made and undone. `pattern` gives the un-revealed hint nudge (see
 * hint-content.tsx's derivationNudge) the pattern name directly, and it
 * survives even when `step2` itself is absent (a FORM recipe, where the
 * built form IS the whole answer and there is no step2 label to have parsed
 * anyway).
 */
export interface Derivation {
  /** The word the card asks about, as shown. */
  readonly word: string;
  /** The finished built answer — `word` run through every step. */
  readonly answer: string;
  readonly step1?: DerivationEquation;
  readonly step2?: DerivationEquation;
  readonly title?: string;
  readonly pattern: string;
}

/**
 * The category/class heading shown above a derivation's equations —
 * "Irregular い-adjective", "う-verb / godan", and so on (see `Derivation`).
 *
 * `host` and `cls` determine every case on their own EXCEPT v5r-i (ある):
 * its te-form (the form most recipes actually build) is a perfectly regular
 * godan conjugation, and only its negative is the suppletive irregular
 * (ない, not あらない) — so unlike every other class here, whether ある's
 * label reads "Irregular" depends on whether THIS instance actually hit that
 * irregular, whole-word form. That is exactly what step1's own `whole` flag
 * already answers (see IRREGULAR_STEP1_CLASSES above), which is why `whole`
 * is threaded in here rather than re-deriving irregularity a second way.
 *
 * Deliberately NOT built on `ruVerbKindOf`/`adjectiveKindOf`
 * (src/lib/word-forms.ts): those two exist to label an AMBIGUOUS surface
 * spelling (a る-ending verb could be v1 or v5r) and so only speak up when
 * the surface ends in る — every other godan ending (書く, 話す, …) is
 * "written on its face" and gets no label from them at all, by design. This
 * function already has the resolved, unambiguous `cls` in hand (no spelling
 * to disambiguate), so it needs a label for every class the table below
 * names, not just the る-ending ones — hence its own direct `cls` mapping
 * rather than reusing those two.
 *
 * Null for host "noun" (no step1 there either, so nothing to head) and for
 * any class the vehicle pool does not currently produce for that host.
 */
function derivationTitle(host: Host, cls: WordClass | null, whole: boolean): string | null {
  if (host === "noun" || cls === null) return null;
  if (host === "adj-i") {
    if (cls === "adj-ix") return "Irregular い-adjective";
    return cls === "adj-i" ? "い-adjective" : null;
  }
  if (host === "adj-na") return cls === "adj-na" ? "な-adjective" : null;
  // host === "verb"
  if (cls === "v1" || cls === "v1-s") return "る-verb / ichidan";
  if (cls === "vs-i" || cls === "vk") return "Irregular verb";
  if (cls === "v5k-s" || cls === "v5u-s") return "Irregular う-verb / godan";
  if (cls === "v5r-i") return whole ? "Irregular う-verb / godan" : "う-verb / godan";
  if (cls.startsWith("v5") && !cls.includes("-")) return "う-verb / godan";
  return null;
}

/**
 * The structured derivation for one (recipe, host, word) production card, or
 * null when there is nothing honest to derive — a host this recipe doesn't
 * open on (the wrap case: しか〜ない's verb host lives on `recipe.wrap.close`,
 * not `recipe.attach`, so it is invisible here exactly as it already is to
 * formHintText), a refused conjugation, or a recipe that changes nothing at
 * all (vacuous — not something production ever asks about, but guarded
 * anyway rather than trusted).
 *
 * `cls` is the engine's WordClass, null for a noun (no class to conjugate) —
 * the same convention `apply()` uses.
 */
export function deriveProduction(
  recipe: Recipe,
  host: Host,
  word: string,
  cls: WordClass | null,
): Derivation | null {
  const at = recipe.attach.find((a) => a.host === host);
  const formula = recipeFormula(recipe).opening.find((o) => o.host === host);
  if (!at || !formula) return null;

  // STEP 1 — skipped for a bare-word attachment (form: null, the noun case)
  // and for the dictionary form (form named, but conjugate() is the
  // identity), the same test formHintText already uses to decide whether
  // there is a form worth naming at all.
  let base = word;
  let step1: DerivationEquation | undefined;
  if (at.form !== null && formula.formLabel !== FORM_LABEL.dictionary) {
    if (cls === null) return null; // a form was named; a noun has none to build.
    const conjugated = conjugate(word, cls, at.form);
    if (!conjugated.ok) return null;
    // Some words conjugate to THEMSELVES for this exact form (いい stays いい
    // before a noun) — nothing changed, so there is nothing to show, exactly
    // as formRuleTables() skips the row rather than printing a non-change.
    if (conjugated.value !== word) {
      const p = prefixLen(word, conjugated.value);
      const whole = IRREGULAR_STEP1_CLASSES.has(cls) || p === 0;
      const label = `Dictionary form → ${formula.formLabel}`;
      step1 = whole
        ? { from: word, to: conjugated.value, whole: true, label }
        : {
            from: word,
            to: conjugated.value,
            trim: word.slice(p) || undefined,
            add: conjugated.value.slice(p) || undefined,
            label,
          };
      base = conjugated.value;
    }
  }

  // STEP 2 — skipped when the recipe adds nothing and trims nothing: the
  // built FORM already IS the pattern (te-sequence, nai-form, ba, tara, …).
  //
  // Its label's LEFT side is step1's target form when there was a step1
  // ("て-form → 〜てもいい"), or "Dictionary form" when there wasn't — a noun
  // attachment or a dictionary-form attachment both leave `base` as the bare
  // word, so this is the step that turns IT into the pattern. The RIGHT side
  // is the recipe's own pattern name (`recipe.pattern`, e.g. "〜てもいい"),
  // not the generic word "pattern" — the point of the label is to say WHICH
  // pattern, not just that one exists.
  let step2: DerivationEquation | undefined;
  const trim = formula.trim ?? undefined;
  const add = formula.add ?? undefined;
  if (trim || add) {
    if (trim && !base.endsWith(trim)) return null;
    const to = (trim ? base.slice(0, base.length - trim.length) : base) + (add ?? "");
    const from = step1 ? formula.formLabel : "Dictionary form";
    step2 = { from: base, trim, add, to, label: `${from} → ${recipe.pattern}` };
  }

  const answer = step2?.to ?? step1?.to;
  if (!answer || answer === word) return null;

  const title = derivationTitle(host, cls, step1?.whole ?? false) ?? undefined;

  return { word, answer, step1, step2, title, pattern: recipe.pattern };
}

// ---------- SAK-198: the SAFE, un-revealed nudge ----------

/**
 * How a `derivationTitle()` category reads INLINE, mid-sentence: "an
 * irregular う-verb", not the heading's own "Irregular う-verb / godan".
 * `article` and `phrase` are kept SEPARATE, not pre-joined, because only
 * `phrase` renders accented (`text-accent`) — "a"/"an" is connective tissue,
 * not a fact worth highlighting, and joining them here would force the
 * renderer to either accent the article too or split the string back apart
 * to avoid it, the exact display-text-parsing mistake this file's other
 * doc comments already refuse to make.
 *
 * HARDCODED, like HOST_ARTICLE in ./formula.ts, and for the same reason that
 * table gives for itself: the labels start with kana and mix in slashes, so
 * an a/an-by-first-LETTER rule would get every one of these wrong (they all
 * start with kana or "Irregular"), and a by-SOUND rule still has to know that
 * う and い read as vowels in English (an う-verb, an い-adjective) while る
 * and な read as consonants (a る-verb, a な-adjective) — which is just this
 * table by another name. Keyed off the exact category strings
 * `derivationTitle` above already produces; add a row here whenever that
 * function's own table grows.
 */
const DERIVATION_CLASS_PHRASE: Readonly<Record<string, { article: string; phrase: string }>> = {
  "Irregular い-adjective": { article: "an", phrase: "irregular い-adjective" },
  "い-adjective": { article: "an", phrase: "い-adjective" },
  "な-adjective": { article: "a", phrase: "な-adjective" },
  "Irregular う-verb / godan": { article: "an", phrase: "irregular う-verb" },
  "う-verb / godan": { article: "an", phrase: "う-verb" },
  "る-verb / ichidan": { article: "a", phrase: "る-verb" },
  "Irregular verb": { article: "an", phrase: "irregular verb" },
};

/**
 * The SAFE one-line nudge for a derivation hint BEFORE the card resolves
 * (SAK-198): the Hint button's own drawer, as opposed to the reveal panel,
 * where the full step-by-step equations (rendered straight from `Derivation`
 * by hint-content.tsx) are safe only because the answer is already out.
 * Names the word's CLASS and the PATTERN, the same two facts the
 * pre-SAK-194 flat hint used to name as two lines, now fused into one
 * sentence, and never the built `answer`.
 *
 * Returns STRUCTURE, not a finished string, for the same reason
 * `recipeFormula` in ./formula.ts returns structure rather than a pre-joined
 * one: the class phrase and the pattern both need to render accented
 * (`text-accent`) while the rest of the sentence stays muted, and splitting a
 * finished string back apart to find which words to accent would be reading
 * display text to recover a structural fact, the mistake this codebase
 * keeps a name for and refuses to make twice.
 *
 * `title` absent (a noun or dictionary-form attachment, nothing to name a
 * class for) falls back to naming the pattern alone, the same unconditional
 * fallback the pre-SAK-194 flat hint's own `patternText` used for its
 * no-class case.
 */
export type DerivationNudge =
  | {
      readonly kind: "class";
      /** "a" / "an" — plain text, never accented; see DERIVATION_CLASS_PHRASE. */
      readonly article: string;
      readonly classPhrase: string;
      readonly pattern: string;
    }
  | { readonly kind: "pattern-only"; readonly pattern: string };

export function derivationNudge(derivation: Derivation): DerivationNudge {
  const entry = derivation.title ? DERIVATION_CLASS_PHRASE[derivation.title] : undefined;
  return entry
    ? { kind: "class", article: entry.article, classPhrase: entry.phrase, pattern: derivation.pattern }
    : { kind: "pattern-only", pattern: derivation.pattern };
}
