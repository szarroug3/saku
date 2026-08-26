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
 */
export interface Derivation {
  /** The word the card asks about, as shown. */
  readonly word: string;
  /** The finished built answer — `word` run through every step. */
  readonly answer: string;
  readonly step1?: DerivationEquation;
  readonly step2?: DerivationEquation;
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
      step1 = whole
        ? { from: word, to: conjugated.value, whole: true }
        : {
            from: word,
            to: conjugated.value,
            trim: word.slice(p) || undefined,
            add: conjugated.value.slice(p) || undefined,
          };
      base = conjugated.value;
    }
  }

  // STEP 2 — skipped when the recipe adds nothing and trims nothing: the
  // built FORM already IS the pattern (te-sequence, nai-form, ba, tara, …).
  let step2: DerivationEquation | undefined;
  const trim = formula.trim ?? undefined;
  const add = formula.add ?? undefined;
  if (trim || add) {
    if (trim && !base.endsWith(trim)) return null;
    const to = (trim ? base.slice(0, base.length - trim.length) : base) + (add ?? "");
    step2 = { from: base, trim, add, to };
  }

  const answer = step2?.to ?? step1?.to;
  if (!answer || answer === word) return null;

  return { word, answer, step1, step2 };
}
