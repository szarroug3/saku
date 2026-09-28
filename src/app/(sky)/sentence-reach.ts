// Which of a sentence type's sentences a learner can be asked to build
// tonight, and which first (Sam, 2026-09-28).
//
// The ordering card used to deal any sentence of the type. Sam's first
// Simple drill after learning は vs が and を dealt "サクは店に行った。", which
// turns on に and on the た-form, neither of which she had met: "this sentence
// uses ta which I haven't learned yet. If possible, can we limit the sentences
// to words that use particles I learned in the lesson or already know if
// there are none that were in the lesson?"
//
// So a sentence is WITHIN REACH when every pattern it is tagged with is one
// the learner knows, and every word in it stands in the form the learner
// would know it by, unless one of those patterns is what changes the form
// (行きたい is the stem plus 〜たい; a learner who knows 〜たい can read it). A
// pattern is known when the learner has met it (answered, claimed or opened
// in a lesson) or when it is one of tonight's picks: the lesson just taught
// it, and this quiz is that lesson's.
//
// And what the lesson taught comes FIRST: the sentences that turn on one of
// tonight's patterns, then the rest within reach. Only a type with nothing
// within reach at all falls back to any of its sentences, so a drill is never
// empty.
//
// Pure over the tables and a history; the deal's randomness is handed in.

import { readableAssemblyForTier, SENTENCE_ORDERING_TIERS, type AssemblyItem } from "@/data/assembly";
import { FORM_RECIPE_IDS, patternEntry, patternMeaningFactId, verbAttachForm } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";
import { isFactMet } from "@/lib/history-ops";
import type { Rng } from "@/lib/grammar/vehicles";
import type { HistoryFile } from "@/types/store";

import { particleGroup } from "./particle-groups";

/** A recipe by the id its library entry is picked as. */
const RECIPE_OF_ENTRY: ReadonlyMap<string, string> = new Map(RECIPES.map((r) => [patternEntry(r.id) as string, r.id]));

/** The patterns a pick teaches: a pattern its own, a particle group its
 * two; anything else (a word, a sentence type) none. */
export function recipesOfPick(id: string): readonly string[] {
  const own = RECIPE_OF_ENTRY.get(id);
  if (own) return [own];
  return particleGroup(id)?.recipes ?? [];
}

/** Every pattern the learner knows: met in their history, or picked tonight. */
export function knownRecipes(history: HistoryFile, picks: readonly string[] = []): Set<string> {
  const known = new Set(picks.flatMap(recipesOfPick));
  for (const r of RECIPES) if (isFactMet(history, patternMeaningFactId(r.id))) known.add(r.id);
  return known;
}

/** Whether a pattern changes the shape of the word it is put on: a form
 * taught as a lesson of its own, or a pattern that attaches to a verb in
 * some form other than the dictionary one. */
function changesForm(recipeId: string): boolean {
  if (FORM_RECIPE_IDS.includes(recipeId)) return true;
  const recipe = RECIPES.find((r) => r.id === recipeId);
  const form = recipe && verbAttachForm(recipe);
  return !!form && form !== "dictionary";
}

/** The end-of-sentence marks a piece can carry, which are not the word. */
export const SENTENCE_END = /[。？！?!.]+$/;

/** The form a changed word is in, by its ending, as the recipe that teaches
 * that form: 行った is the た-form, 読んで the て-form, 行きたい is 〜たい.
 * Nothing for an ending this cannot name (a bare stem, 始め). The corpus tags
 * a sentence with the patterns it turns on and not with the forms its words
 * are in, so the form has to be read off the word. */
const FORM_ENDINGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/たい$/, "tai"],
  [/(た|だ)$/, "ta-form"],
  [/(て|で)$/, "te-sequence"],
  [/ない$/, "nai-form"],
  [/ま(す|した|せん|しょう)$/, "masu-form"],
];
function formOf(word: string): string | undefined {
  return FORM_ENDINGS.find(([ending]) => ending.test(word))?.[1];
}

/** Whether a piece shows its head word as the learner would know it: 飲む。
 * does, 赤いボールで does, 行った。 (head 行く) does not unless the た-form is
 * known, or one of the sentence's own patterns is what changed the word.
 * A piece with no head word (サクは, ましょう。) has nothing to hide. */
function inKnownForm(piece: AssemblyItem["pieces"][number], item: AssemblyItem, known: ReadonlySet<string>): boolean {
  if (piece.h === null) return true;
  const word = piece.t.replace(SENTENCE_END, "");
  if (word.includes(piece.h)) return true;
  const form = formOf(word);
  return (!!form && known.has(form)) || item.p.some(changesForm);
}

/** Whether the learner can be asked to build this sentence: every pattern
 * it turns on is known, and every word stands in a form they know. */
export function withinReach(item: AssemblyItem, known: ReadonlySet<string>): boolean {
  return item.p.every((p) => known.has(p)) && item.pieces.every((piece) => inKnownForm(piece, item, known));
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** How many sentences a type is drilled on in one quiz (Sam, 2026-09-28:
 * "Let's make it 5 per sentence rule"). */
export const SENTENCES_PER_RULE = 5;

/** One of a type's sentences by its id, for a card dealt again by name (a
 * resumed deck, a rerun), whatever is within reach tonight. */
export function sentenceOf(tierId: string, history: HistoryFile, id: number): AssemblyItem | undefined {
  const tier = SENTENCE_ORDERING_TIERS.find((t) => t.id === tierId);
  return tier && readableAssemblyForTier(tier, history).find((it) => it.id === id);
}

/**
 * The sentences a quiz builds for one sentence type, in the order they are
 * dealt: up to `n`, the ones that turn on tonight's patterns first, then the
 * rest within reach; any of the type's only when nothing is within reach.
 */
export function sentencesToBuild(tierId: string, history: HistoryFile, picks: readonly string[] = [], n = SENTENCES_PER_RULE, rng: Rng = Math.random): AssemblyItem[] {
  const tier = SENTENCE_ORDERING_TIERS.find((t) => t.id === tierId);
  if (!tier) return [];
  const pool = readableAssemblyForTier(tier, history);
  const known = knownRecipes(history, picks);
  const tonight = new Set(picks.flatMap(recipesOfPick));
  const reach = pool.filter((it) => withinReach(it, known));
  const taught = reach.filter((it) => it.p.some((p) => tonight.has(p)));
  const rest = reach.filter((it) => !taught.includes(it));
  const dealt = [...shuffled(taught, rng), ...shuffled(rest, rng)];
  return (dealt.length ? dealt : shuffled(pool, rng)).slice(0, n);
}
