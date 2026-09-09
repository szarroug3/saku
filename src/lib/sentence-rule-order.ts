// The one order the "Sentence rules" track is taught in: every particle and
// pattern placed right before the sentence type that needs it, then the
// sentence type itself, then the grammar no sentence type ever needs.
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
// One list. The adjective/noun form leads, as the track already has it, because
// the word classes it teaches come before everything. Then, for each sentence
// type in SENTENCE_ORDERING_TIERS order:
//
//   1. its `grammarPrereqs`, all of them, in teaching order, because the
//      learner has to be able to read the type's examples;
//   2. the patterns its own readable sentences actually use, most used first,
//      teaching order breaking a tie. A pattern listed on the tier that no
//      sentence of that tier uses is NOT placed here; it falls to the tail;
//   3. before any of those, the form it is built on, when the track teaches
//      that form as a lesson of its own: the て/で-form before 〜てから, the
//      ない-form before 〜ないでください. This is grammar-shelf.ts's rule, which
//      already relies on a form's own recipe being the first one taught on it;
//   4. then the sentence type.
//
// Then every recipe no type ever asked for, in the track's own order.
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

/** One place in the order: a grammar pattern to learn, or a sentence type. */
export type SentenceRuleStep =
  | { readonly kind: "pattern"; readonly id: string }
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

/** What a sentence type needs, in the order it wants them: its prereqs in
 * teaching order, then the patterns its own sentences use, most used first. */
function needsOf(tier: (typeof SENTENCE_ORDERING_TIERS)[number]): readonly string[] {
  const known = (id: string) => RECIPE_BY_ID.has(id);
  const prereqs = [...tier.grammarPrereqs].filter(known).sort((a, b) => grammarRank(a) - grammarRank(b));
  const uses = usesInTier(tier);
  const used = [...uses.keys()]
    .filter(known)
    .sort((a, b) => (uses.get(b) ?? 0) - (uses.get(a) ?? 0) || grammarRank(a) - grammarRank(b));
  return [...prereqs, ...used];
}

/** The whole track in one list: patterns interleaved with the sentence types
 * that need them, then the leftovers. Computed once. */
let order: readonly SentenceRuleStep[] | undefined;

export function sentenceRuleOrder(): readonly SentenceRuleStep[] {
  if (order) return order;
  const steps: SentenceRuleStep[] = [];
  const placed = new Set<string>();
  const place = (id: string) => {
    if (placed.has(id)) return;
    const recipe = RECIPE_BY_ID.get(id);
    if (!recipe) return;
    // the form it is built on comes first, when the track teaches one
    const shape = shapeOf(recipe);
    const foundation = shape ? FORM_LESSON.get(shape) : undefined;
    if (foundation && foundation !== id) place(foundation);
    placed.add(id);
    steps.push({ kind: "pattern", id });
  };

  // the adjective/noun form leads, as the track has it: the word classes it
  // teaches come before every pattern that conjugates one
  if (TRACK[0]) place(TRACK[0].id);
  for (const tier of SENTENCE_ORDERING_TIERS) {
    for (const id of needsOf(tier)) place(id);
    steps.push({ kind: "tier", id: tier.id });
  }
  // whatever no sentence type ever asked for, in the track's own order
  for (const r of TRACK) place(r.id);

  order = steps;
  return steps;
}
