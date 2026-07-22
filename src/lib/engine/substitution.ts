// GUIDED SUBSTITUTION — "you know 食べてから, now say it about 行く".
//
// The second of the two sentence-production question types (task 11). It is the
// SAFE one: it invents no new grading and no new corpus. A substitution item is
// a grammar PRODUCTION question wearing a friendlier prompt —
//
//   demo    a pattern built on a verb the learner knows  (食べる → 食べてから)
//   target  the SAME pattern, a DIFFERENT known verb, to produce (行く → ?)
//
// and the answer (行ってから) is graded by the EXACT path a production card
// already uses: questionsFor(productionFact).check(..., { grammarVehicle }). So
// the forgiving romaji check fixed in task 02 grades it, unchanged, and
// grammar-vehicle-romaji.test.ts is not touched.
//
// WHY IT CANNOT MARK CORRECT JAPANESE WRONG
// =========================================
// The pattern plus the target verb fixes ONE form. 〜てから on 行く is 行ってから
// and nothing else; the recipe is a total function of (pattern, verb). There is
// no free choice for the learner to get right in an unforeseen way, which is the
// property that lets this exist beside the never-mark-wrong rule.
//
// THE KNOWN-WORDS GATE
// ====================
// Both verbs — the demo and the target — must be words the learner knows
// (vehicles.ts's `known` gate, `wordKnown` from history). A prompt built on a
// verb she has never met would measure vocabulary, not the pattern, which is the
// same class of bug the selection corpus's readability gate closes. With an
// empty history NOTHING qualifies and the caller shows no substitution card;
// that is the ordinary early answer, not an error.

import {
  DRILLABLE,
  isProducible,
  patternLabel,
  type Host,
  type Recipe,
} from "@/data/grammar/recipes";
import { patternProductionFactId, productionHosts } from "@/data/grammar";
import { apply } from "@/lib/grammar/apply";
import { wordKnown } from "@/lib/grammar/readable";
import {
  vehiclesFor,
  type Rng,
  type Vehicle,
} from "@/lib/grammar/vehicles";
import { questionsFor, type GrammarVehicle } from "./question";
import type { FactId, HistoryFile } from "@/types";

/** A verb the pattern is built on, plus the built form on it. */
export interface BuiltVehicle {
  readonly surface: string;
  readonly kana: string;
  readonly cls: Vehicle["cls"];
  /** The pattern on the surface word. 食べてから */
  readonly form: string;
  /** The pattern on the kana reading. たべてから */
  readonly kanaForm: string;
}

/** One guided-substitution showing, plain data so it can ride the screen's
 * serialized runtime. */
export interface SubstitutionItem {
  readonly recipeId: string;
  readonly host: Host;
  /** The production fact this item scores against — the same fact a production
   * drill would move. */
  readonly fact: FactId;
  /** 〜てから — the pattern label, shown as "using the same form as …". */
  readonly label: string;
  /** The verb the learner already knows the form on, and that form. */
  readonly demo: BuiltVehicle;
  /** The verb to produce the form on this time. */
  readonly target: BuiltVehicle;
}

/** Build the pattern on one word — surface and kana — or null if it will not
 * build (a wrap, a defective form). apply() is the one truth for the form; we
 * never hand-conjugate. */
function build(r: Recipe, v: Vehicle): BuiltVehicle | null {
  const surface = apply(r, v.surface, v.cls);
  if (!surface.ok || surface.value === v.surface) return null;
  const kana = apply(r, v.kana, v.cls);
  return {
    surface: v.surface,
    kana: v.kana,
    cls: v.cls,
    form: surface.value,
    kanaForm: kana.ok ? kana.value : surface.value,
  };
}

/**
 * Roll a guided-substitution item for a learner, or null when none qualifies.
 *
 * Walks the producible recipes, and for each host it has a production fact on,
 * asks the vehicle pool for the verbs the learner KNOWS. An item needs two
 * distinct known vehicles whose built forms differ — the demo and the target —
 * so the demo form is never itself the accepted answer (行ってから asked, not
 * shown). `rng` is injectable for tests.
 */
export function pickSubstitution(
  history: HistoryFile,
  rng: Rng = Math.random,
): SubstitutionItem | null {
  const known = (surface: string) => wordKnown(surface, history);
  // Gather every (recipe, host) with at least two known, distinct-form vehicles.
  const eligible: { r: Recipe; host: Host; pool: BuiltVehicle[] }[] = [];
  for (const r of DRILLABLE) {
    if (!isProducible(r)) continue;
    for (const host of productionHosts(r)) {
      const built: BuiltVehicle[] = [];
      const forms = new Set<string>();
      for (const v of vehiclesFor(r, host, known)) {
        const b = build(r, v);
        if (!b || forms.has(b.form)) continue;
        forms.add(b.form);
        built.push(b);
      }
      if (built.length >= 2) eligible.push({ r, host, pool: built });
    }
  }
  if (eligible.length === 0) return null;

  const choice = eligible[Math.floor(rng() * eligible.length)] ?? eligible[0];
  const pool = choice.pool.slice();
  const demo = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const target = pool[Math.floor(rng() * pool.length)] ?? pool[0];
  // Guaranteed distinct forms by construction (the Set above), so the demo form
  // can never be the target's accepted answer. Assert it cheaply anyway.
  if (!demo || !target || demo.form === target.form) return null;

  const fact = patternProductionFactId(choice.r.id, choice.host);
  return {
    recipeId: choice.r.id,
    host: choice.host,
    fact,
    label: patternLabel(choice.r),
    demo,
    target,
  };
}

/** The context the engine grades against — the target verb as a GrammarVehicle. */
function ctxOf(item: SubstitutionItem): { grammarVehicle: GrammarVehicle } {
  return {
    grammarVehicle: {
      surface: item.target.surface,
      kana: item.target.kana,
      cls: item.target.cls,
    },
  };
}

/**
 * Grade a typed answer for a substitution item.
 *
 * Delegates to the grammar production QuestionType's own `check`, with the
 * target verb in ctx — the identical path a production drill takes, so the
 * romaji forgiveness (行ってから exact, いってから via romaji) is reused verbatim
 * and nothing here can drift from grammar-vehicle-romaji.test.ts.
 */
export function gradeSubstitution(item: SubstitutionItem, given: string): boolean {
  return questionsFor(item.fact).check(item.fact, "en2jp", given, ctxOf(item));
}
