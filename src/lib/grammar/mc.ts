// The MULTIPLE-CHOICE seam for grammar: one shape for both selectable things.
//
// WHAT THIS IS FOR
// ================
// Two generators already build choosable items and both were, until now, only
// reached by their own tests:
//
//   selection()      (lib/grammar/questions.ts) — "which PATTERN goes in this
//                    blank?", with distractors proven wrong for the frame.
//   question()       (lib/transitivity.ts)      — "which VERB fits this cue?",
//                    the transitive/intransitive pair chosen by the English.
//
// They return different objects, because they ask different questions. But a
// multiple-choice CARD is the same object every time — a prompt, a list of
// choices, and exactly one of them correct — and the drill's MC control already
// renders precisely that (a row of option buttons, graded by WHICH one). So
// rather than teach the drill two new question types, this module NORMALISES
// both into one `GrammarMc`: the shape the existing MC path consumes. Reuse,
// not a fork.
//
// GRADED BY INDEX, WHICH IS WHY THE CHOICES CARRY NO IDENTITY
// ==========================================================
// The drill grades a fact-MC by WHICH fact was picked, because two options can
// carry the same text. Here the safety argument is upstream — selection() drops
// any distractor that could be a second right answer, and transitivity refuses
// an ambitransitive distractor — so a `GrammarMc` is guaranteed to have exactly
// one correct choice, and grading is "did you pick `correctIndex`". The shuffle
// is done HERE, once, so the correct index is fixed for the showing and a
// remount cannot move the answer under the user (the same discipline the drill
// uses for fonts and vehicles).

import { selection, type SelectionQuestion } from "./questions.ts";
import { examplesFor, type Example } from "../../data/grammar/corpus.ts";
import { RECIPES, patternLabel, recipe } from "../../data/grammar/recipes.ts";
import { question as transitivityQ, PROMPT as TRANSITIVITY_PROMPT } from "../transitivity.ts";
import { VERB_PAIRS, type VerbPair } from "../../data/transitivity.ts";
import type { Rng } from "./vehicles.ts";

/** The instruction shown for a selection item. Kept beside transitivity's so
 * the two rendered prompts are authored in one place. */
export const SELECTION_PROMPT = "Which pattern fits?";

/** One choice on the board. `sub` is a second line — the gloss under a pattern —
 * shown for selection, absent for transitivity (a verb needs no gloss under the
 * English cue). */
export interface GrammarChoice {
  readonly label: string;
  /** True when `label` is Japanese and wants the quiz's JP font. */
  readonly jp: boolean;
  readonly sub?: string;
  /**
   * WHICH PATTERN this choice is — the recipe id, for selection; null for
   * transitivity, whose choices are verbs and have no recipe.
   *
   * The card grades by index (see the header), so nothing in THIS module needs
   * it. A scheduler does: the drill scores an answer against a FACT, and a
   * pattern's fact is derived from its recipe id (patternMeaningFactId). Without
   * an id here a caller can render the board and cannot tell the scheduler what
   * was just answered — which is why the seam sat unused. Recipe ids, not fact
   * ids, so this module stays clear of the facts layer; the caller maps.
   */
  readonly id: string | null;
}

/**
 * A ready-to-render multiple-choice card. The union tag says which generator
 * built it; everything the renderer needs is flattened onto the object, so the
 * MC control does not branch on `kind`.
 */
export interface GrammarMc {
  readonly kind: "selection" | "transitivity";
  /**
   * WHICH PATTERN is being asked — the answer's recipe id, for selection; null
   * for transitivity, which has no recipe (and, deliberately, no fact — see
   * data/transitivity.ts).
   *
   * The companion to GrammarChoice.id, and for the same reason: a selection item
   * asks "do you know what this pattern MEANS and where it goes", which is the
   * fact patternMeaningFactId(recipeId) already scores. Selection must never
   * touch the PRODUCTION fact — that is the other question ("build the form").
   */
  readonly recipeId: string | null;
  /** The big line: a sentence FRAME with a blank (selection), or the English
   * cue (transitivity). */
  readonly prompt: string;
  /** True when `prompt` is Japanese. */
  readonly promptJp: boolean;
  /** The instruction under the prompt — "Which pattern fits?" / "Which verb fits?" */
  readonly instruction: string;
  /**
   * The dictionary-form host the blank swallowed, shown so the item is
   * answerable (selection only; null otherwise). See SelectionQuestion.host.
   */
  readonly host: string | null;
  /** The human English translation (selection's only context); null for
   * transitivity, whose prompt already IS the English. */
  readonly en: string | null;
  /** The choices, already shuffled. Exactly one is correct. */
  readonly choices: readonly GrammarChoice[];
  /** The index of the correct choice in `choices`. Grading is `pick === this`. */
  readonly correctIndex: number;
  /** The correct choice's label, for the reveal. */
  readonly answer: string;
  /** Tatoeba id (selection) for attribution / bad-item reporting; null otherwise. */
  readonly sourceId: number | null;
}

/** Fisher–Yates over a COPY, driven by an injectable rng so a test can pin the
 * order. Returns the shuffled copy; the input is untouched. */
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffle choices while remembering which one was correct, so `correctIndex`
 * survives the shuffle. The single chokepoint both builders funnel through. */
function place(
  choices: readonly GrammarChoice[],
  correct: number,
  rng: Rng,
): { choices: GrammarChoice[]; correctIndex: number } {
  const tagged = choices.map((c, i) => ({ c, correct: i === correct }));
  const shuffled = shuffle(tagged, rng);
  return {
    choices: shuffled.map((t) => t.c),
    correctIndex: shuffled.findIndex((t) => t.correct),
  };
}

/** Normalise a built SelectionQuestion into a GrammarMc (choices shuffled). */
function fromSelection(q: SelectionQuestion, rng: Rng): GrammarMc {
  // The board offers PATTERNS, and a pattern's sense rides in its label so a
  // sense-bearing member (〜られる 可能) never reads as its bare-form sibling.
  const label = (id: string, fallback: string): string => {
    const r = recipe(id);
    return r ? patternLabel(r) : fallback;
  };
  const raw: GrammarChoice[] = q.choices.map((c) => ({
    label: label(c.id, c.pattern),
    jp: true,
    sub: c.gloss,
    id: c.id,
  }));
  const correct = q.choices.findIndex((c) => c.id === q.answerId);
  const { choices, correctIndex } = place(raw, correct, rng);
  return {
    kind: "selection",
    recipeId: q.answerId,
    prompt: q.frame,
    promptJp: true,
    instruction: SELECTION_PROMPT,
    host: q.host,
    en: q.en,
    choices,
    correctIndex,
    answer: label(q.choices[correct].id, q.choices[correct].pattern),
    sourceId: q.sourceId,
  };
}

/**
 * A selection MC for one corpus example, or null when the frame yields no
 * choosable item (selection() refused it). `rng` shuffles the board.
 */
export function selectionMc(
  ex: Example,
  answerId: string,
  rng: Rng = Math.random,
  wanted = 4,
): GrammarMc | null {
  const q = selection(ex, answerId, wanted);
  return q ? fromSelection(q, rng) : null;
}

/**
 * A transitivity MC for one side of one pair, or null when the pair's frame is
 * unsafe (an ambitransitive distractor — see transitivity.question). `rng`
 * shuffles the two verbs so the answer is not always first.
 */
export function transitivityMc(
  pair: VerbPair,
  side: "happens" | "doIt",
  rng: Rng = Math.random,
): GrammarMc | null {
  const q = transitivityQ(pair, side);
  if (!q) return null;
  const raw: GrammarChoice[] = q.choices.map((c) => ({
    label: c.word,
    jp: true,
    id: null,
  }));
  const correct = q.choices.findIndex((c) => c.word === q.answer);
  const { choices, correctIndex } = place(raw, correct, rng);
  return {
    kind: "transitivity",
    recipeId: null,
    prompt: q.en,
    promptJp: false,
    instruction: TRANSITIVITY_PROMPT,
    host: null,
    en: null,
    choices,
    correctIndex,
    answer: q.answer,
    sourceId: null,
  };
}

/**
 * Every selection MC the corpus can produce for `recipeId`, shuffled. Empty
 * when the pattern is not selectable in any of its sentences — a real answer,
 * not a bug (see selectableRecipes in questions.ts).
 *
 * `admits` screens the SENTENCE before an item is built from it. The drill
 * passes a readability gate (lib/grammar/readable.ts): a cloze in a sentence
 * whose words the learner does not know is not a grammar question. It takes an
 * Example rather than a GrammarMc because knownness is a property of the source
 * sentence's content lemmas, which the normalised card no longer carries — and
 * because screening first means the refused sentences are never built.
 * Omitted → every selectable sentence, which is what the corpus tools and the
 * item-safety tests want.
 */
export function selectionMcsFor(
  recipeId: string,
  rng: Rng = Math.random,
  wanted = 4,
  admits?: (ex: Example) => boolean,
): GrammarMc[] {
  const out: GrammarMc[] = [];
  for (const ex of examplesFor(recipeId)) {
    if (admits && !admits(ex)) continue;
    const mc = selectionMc(ex, recipeId, rng, wanted);
    if (mc) out.push(mc);
  }
  return out;
}

/** Every transitivity MC the pair table can produce — both sides of every pair
 * whose frame is safe. */
export function transitivityMcs(rng: Rng = Math.random): GrammarMc[] {
  const out: GrammarMc[] = [];
  for (const p of VERB_PAIRS) {
    for (const side of ["happens", "doIt"] as const) {
      const mc = transitivityMc(p, side, rng);
      if (mc) out.push(mc);
    }
  }
  return out;
}

/**
 * Pick one grammar MC at random across BOTH sources, or null if (impossibly)
 * neither has one. This is the whole seam a caller needs: "give me a grammar
 * multiple-choice question", answered from the selectable patterns and the
 * transitivity pairs together, with no knowledge of either generator.
 *
 * `rng` drives every choice — which source, which item, and the board order —
 * so a test pins the entire card with one seed.
 */
export function nextGrammarMc(rng: Rng = Math.random): GrammarMc | null {
  // Which selectable patterns exist is a property of the data, computed cheaply
  // here rather than quoted; a pattern with no corpus support contributes none.
  const selectable = RECIPES.map((r) => r.id).filter(
    (id) => examplesFor(id).length > 0,
  );
  const useTransitivity = selectable.length === 0 || rng() < 0.5;
  if (useTransitivity) {
    const all = transitivityMcs(rng);
    if (all.length > 0) return all[Math.floor(rng() * all.length)] ?? all[0];
  }
  // Walk selectable patterns in a random order until one yields an item; a
  // pattern can be "selectable somewhere" yet refuse a given rng's first pick.
  for (const id of shuffle(selectable, rng)) {
    const items = selectionMcsFor(id, rng);
    if (items.length > 0) return items[Math.floor(rng() * items.length)] ?? items[0];
  }
  // Selection came up empty (or was skipped): fall back to transitivity.
  const all = transitivityMcs(rng);
  return all.length > 0 ? (all[Math.floor(rng() * all.length)] ?? all[0]) : null;
}
