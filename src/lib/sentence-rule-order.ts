// The one order the "Sentence rules" track is taught in: a sentence type right
// after the patterns it requires, then the patterns its own example sentences
// use, then the grammar no sentence type ever needs.
//
// WHY THIS EXISTS
// ===============
// The Observatory used to offer the grammar track in CURRICULUM_PATTERNS order
// and nothing else. That order puts the nine case particles (は, が, に, で, を,
// へ, まで, だけ, か) in one run right behind the て patterns, so a learner who
// had met the て-form was shown all nine at once, with nothing to say which of
// them they were about to need. The ten sentence TYPES, which are the thing the
// particles are for, were offered nowhere at all (Sam, 2026-09-08).
//
// So the track is rebuilt around the sentence types. A type declares what it
// needs, and its curated sentences say which of those it really uses, so the
// answer to "does Simple need all nine particles" is data rather than opinion:
// it needs the ones its own example sentences turn on and no others.
//
// THE RULE
// ========
// One list. For each sentence type in SENTENCE_ORDERING_TIERS order:
//
//   1. its `grammarPrereqs`, all of them, in teaching order, because those are
//      what the type IS: a Simple sentence is a topic or a subject, what the
//      action is done to, and a predicate, so は, が and を have to come first;
//   2. before any of those, the form it is built on, when the track teaches
//      that form as a lesson of its own: the て/で-form before 〜てから, the
//      ない-form before 〜ないでください. This is grammar-shelf.ts's rule, which
//      already relies on a form's own recipe being the first one taught on it;
//   3. then the sentence type itself;
//   4. then the patterns its own readable sentences use that are not placed
//      yet, most used first, teaching order breaking a tie. A pattern listed
//      on the tier that no sentence of that tier uses is NOT placed here; it
//      falls to the tail.
//
// Then every recipe no type ever asked for, in the track's own order.
//
// WHY THE TYPE COMES BEFORE THE PARTICLES ITS EXAMPLES USE
// ========================================================
// It used to come after them, so Simple read 〜な, は, が, を, に, で, だけ,
// Simple: seven lessons before the one they are for. Sam, 2026-09-17: "why
// isn't simple sentences not after topic/subject? why does it come after all
// these other particles". A type needs は and が to exist at all; を and に and
// で and だけ are only what its curated examples happen to turn on, and a page
// can hold those examples back until the learner can read them (SAK-468 part
// two). So Simple now reads は, が, Simple, を, に, で, だけ.
//
// を MOVED IN FRONT OF SIMPLE
// ===========================
// Sam, 2026-09-26, on the Simple intro's line "Markers such as は and を help
// you tell who or what the sentence is about": を was not required before
// Simple, and every one of Simple's curated examples turns on it. Her call:
// "let's make wo required instead." So を is one of Simple's `grammarPrereqs`
// with は and が, and Simple reads は, が, を, Simple, に, で, だけ (SAK-487).
// For a learner who has met none of the three, the Observatory's Simple tile
// stays hidden until all three are learned or picked: the same SAK-464 rule
// (`waitingOn` in observatory.ts) with one more pattern in it. A learner who
// has already met one of them waits on nothing, as before, because the app's
// own unlock rule (`sentenceTierBlock`) still wants any one.
//
// The adjective and noun form (〜な) no longer leads the list either. It is
// grammar, not a sentence rule, and it is already the first thing the grammar
// track teaches (CURRICULUM_PATTERNS starts with `prenominal-form`), so it
// falls to the tail here and the Sentences row waits on it instead: Sam, on
// the same day, "if that's grammar but is required, it's the first thing
// taught in grammar iirc. you can lock the sentence track behind learning it
// in the grammar track." That gate is in observatory.ts, where the section's
// other `needs` are.
//
// Nothing is placed twice: every recipe appears exactly once and every tier
// appears exactly once, which is what sentence-rule-order.test.ts holds.
//
// PURE, AND COMPUTED ONCE. It reads the shipped tables and nothing about a
// learner, so it is the same list on every request. What a learner has met, and
// what they cannot start yet, is applied on top of it by the caller.

import { readableAssemblyForTier, SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import { verbAttachForm } from "@/data/grammar";
import { RECIPES, type Recipe } from "@/data/grammar/recipes";
import { emptyHistory } from "@/lib/history-ops";
import { grammarRank } from "@/lib/library/grammar-order";

/** One place in the order: a grammar pattern to learn, or a sentence type.
 *
 * A pattern says which sentence type it was placed for, since the type no
 * longer stands at the end of its own run: は comes before Simple and に after
 * it, and both are Simple's. A pattern no type asked for says nothing, which
 * is what makes it one of the leftovers. Everything that reads the order by
 * type (the Observatory's row, the Atlas's Sentences shelf) reads this rather
 * than guessing from the position. */
export type SentenceRuleStep =
  | { readonly kind: "pattern"; readonly id: string; readonly tier?: string }
  | { readonly kind: "tier"; readonly id: string };

/** Every recipe in the track's own teaching order, the same sort the grammar
 * shelf takes. */
const TRACK: readonly Recipe[] = [...RECIPES].sort((a, b) => grammarRank(a.id) - grammarRank(b.id));
const RECIPE_BY_ID: ReadonlyMap<string, Recipe> = new Map(TRACK.map((r) => [r.id, r]));

/** The verb form a pattern is built on, when that form is a shape of its own.
 * The plain (dictionary) form is not one: attaching to the bare word builds
 * nothing, which is why the track teaches no lesson for it. */
function shapeOf(r: Recipe): string | undefined {
  const f = verbAttachForm(r);
  return f && f !== "dictionary" ? f : undefined;
}

/** The lesson that teaches each form: the first pattern in the track built on
 * it, which IS the form's own recipe (the て/で-form leads the て family, the
 * ない-form the ない family). grammar-shelf.ts heads its sections on the same
 * fact. */
const FORM_LESSON: ReadonlyMap<string, string> = (() => {
  const found = new Map<string, string>();
  for (const r of TRACK) {
    const shape = shapeOf(r);
    if (shape && !found.has(shape)) found.set(shape, r.id);
  }
  return found;
})();

/** How often each pattern is used across one tier's readable sentences. The
 * pool is a pure function of the corpus (`readableAssembly` takes a history
 * for call-site compatibility and reads nothing off it), so an empty history
 * gives the whole pool. */
function usesInTier(tier: (typeof SENTENCE_ORDERING_TIERS)[number]): ReadonlyMap<string, number> {
  const uses = new Map<string, number>();
  for (const item of readableAssemblyForTier(tier, emptyHistory())) {
    for (const pattern of item.p) uses.set(pattern, (uses.get(pattern) ?? 0) + 1);
  }
  return uses;
}

/** What a sentence type requires: its prereqs, in teaching order. These are
 * the patterns the type is made of, so they come before it. */
function requiredBy(tier: (typeof SENTENCE_ORDERING_TIERS)[number]): readonly string[] {
  return [...tier.grammarPrereqs].filter((id) => RECIPE_BY_ID.has(id)).sort((a, b) => grammarRank(a) - grammarRank(b));
}

/** What a sentence type's own readable sentences use, most used first. These
 * come after it: they are what its examples turn on, not what it is. */
function usedBy(tier: (typeof SENTENCE_ORDERING_TIERS)[number]): readonly string[] {
  const uses = usesInTier(tier);
  return [...uses.keys()]
    .filter((id) => RECIPE_BY_ID.has(id))
    .sort((a, b) => (uses.get(b) ?? 0) - (uses.get(a) ?? 0) || grammarRank(a) - grammarRank(b));
}

/** The whole track in one list: patterns interleaved with the sentence types
 * that need them, then the leftovers. Computed once. */
let order: readonly SentenceRuleStep[] | undefined;

export function sentenceRuleOrder(): readonly SentenceRuleStep[] {
  if (order) return order;
  const steps: SentenceRuleStep[] = [];
  const placed = new Set<string>();
  /** Place a pattern, for the sentence type that asked for it. The form it is
   * built on is placed first, for the same type. */
  const place = (id: string, tier?: string) => {
    if (placed.has(id)) return;
    const recipe = RECIPE_BY_ID.get(id);
    if (!recipe) return;
    // the form it is built on comes first, when the track teaches one
    const shape = shapeOf(recipe);
    const foundation = shape ? FORM_LESSON.get(shape) : undefined;
    if (foundation && foundation !== id) place(foundation, tier);
    placed.add(id);
    steps.push({ kind: "pattern", id, ...(tier ? { tier } : {}) });
  };

  for (const tier of SENTENCE_ORDERING_TIERS) {
    for (const id of requiredBy(tier)) place(id, tier.id);
    steps.push({ kind: "tier", id: tier.id });
    for (const id of usedBy(tier)) place(id, tier.id);
  }
  // whatever no sentence type ever asked for, in the track's own order
  for (const r of TRACK) place(r.id);

  order = steps;
  return steps;
}
