// ===========================================================================
// The two question types. This is what made grammar viable as a subject.
//
// PRODUCTION — "here's 食べる, give me the 〜てから form" -> 食べてから.
//   NAMING THE TARGET DESTROYS THE AMBIGUITY. This is the whole trick. The
//   hard problem in grammar is that a blank usually has several right answers;
//   a named target has exactly one, always, because the recipe IS a function.
//   No corpus needed, no distractors, no judgement.
//
// SELECTION — "which pattern goes in this blank?"
//   Needs the answer to be UNIQUELY determined, which is a much higher bar and
//   is where the whole subject nearly died. It is the valuable half and the
//   smaller one.
//
// ===========================================================================
// は/が CLOZE IS DEAD. IT IS NOT COMING BACK.
// ===========================================================================
// Verified across 660,343 particle slots: the corpus contains frames taking
// BOTH particles in otherwise identical sentences, which proves both are
// correct. 66% of は/が minimal pairs have LITERALLY IDENTICAL English
// translations — 彼[は/が]部屋に入ってきた is "He came into the room" either
// way — so showing the gloss does not rescue the item, and 66% is a lower
// bound, not an estimate.
//
// The failure mode is what makes this non-negotiable rather than a quality
// issue: the app would MARK CORRECT JAPANESE WRONG. For a user with no grammar
// footing, that is the worst failure available, because they have nothing to
// push back with. They would conclude they were wrong and learn the error.
//
// So particles ship on an ALLOWLIST (below), は/が never, and there is no
// recipe for は or が anywhere in the data for a generator to reach. は/が is
// taught as a cluster MAP with a link out — shown, never asked. See
// clusters.ts.
//
// ===========================================================================
// BUT: CHOOSABILITY IS A PROPERTY OF (pattern x sentence x distractors)
// ===========================================================================
// The "~46% of patterns are selectable" figure is a FLOOR, not a ceiling, and
// treating it as a pattern-level property is the mistake. You control the
// distractors. 66% of は/が pairs being identical means 34% are NOT.
//
// So this module filters ITEMS, not patterns: generate candidates, drop any
// whose competitor carries the same English gloss, ship the residue. A pattern
// that is hopeless in one frame may be perfectly determined in another.
//
// The gloss test is doing something subtle and worth naming. Recipes in the
// same cluster are glossed IDENTICALLY on purpose (all seven "must" patterns
// say "must do X"). So "reject any distractor with the same gloss" AUTOMATICALLY
// rejects every same-cluster distractor, without this file knowing what a
// cluster is. The obligation cluster can never produce a selection item
// against itself. That is the cluster design paying for itself in a module
// that has never heard of it.
// ===========================================================================

import { RECIPES, isProducible, recipe, type Recipe } from "../../data/grammar/recipes.ts";
import { examplesFor, type Example } from "../../data/grammar/corpus.ts";
import { apply } from "./apply.ts";
import { pickVehicle, type Rng } from "./vehicles.ts";
import type { WordClass } from "../conjugate/index.ts";

// ---------------------------------------------------------------------------
// PRODUCTION
// ---------------------------------------------------------------------------

export interface ProductionQuestion {
  readonly kind: "production";
  readonly recipeId: string;
  /** The prompt word, in its dictionary form. 食べる */
  readonly lemma: string;
  /** What the pattern is called, for the prompt. 〜てから */
  readonly pattern: string;
  /** The functional gloss, shown to disambiguate split recipes (て/から). */
  readonly gloss: string;
  /** The single correct answer. There is never more than one. */
  readonly answer: string;
}

/**
 * Build a production question, or refuse.
 *
 * Refuses when the recipe is VACUOUS — "give me the は form of 私" is not a
 * question, it is typing. Also refuses when the recipe simply doesn't apply to
 * the word, which is normal.
 *
 * AND REFUSES EVERY WRAP, on three separate grounds, because this signature has
 * ONE word and a wrap has two slots. That was a live wrong item rather than a
 * hypothetical: 〜たり〜たり is not vacuous — it conjugates 行く to 行った — so it
 * passed the only gate there was, and this function shipped "give me the
 * 〜たり〜たり form of 行く" expecting exactly 行ったり. A user who knew the
 * pattern and wrote 行ったり読んだりする was marked WRONG. That is the は/が
 * failure — correct Japanese marked wrong, at a user with nothing to push back
 * with — arriving through a door nobody was watching.
 *
 * The gates now: isProducible covers vacuity, order-freedom and the one
 * data-blocked row, and apply() itself refuses a wrap outright. Belt, braces,
 * and a third thing — a half-built pattern must not be able to reach a prompt
 * again, so more than one layer has to fail before it can.
 *
 * NOTE — the confound, stated once here rather than discovered later. A
 * production question tests the RECIPE and the word's CONJUGATION at the same
 * time. If the user answers 読みでから, did they fail てから, or fail the 音便
 * that gives 読んで? The item cannot tell you. Conjugation is its own subject
 * with its own facts, so the honest read of a grammar miss is "something in
 * this chain broke", and the scheduler should not conclude it was the pattern.
 */
export function production(
  recipeId: string,
  lemma: string,
  cls: WordClass,
): ProductionQuestion | null {
  const r = recipe(recipeId);
  if (!r) return null;
  // The askability gate. This is the one caller that must respect it.
  if (!isProducible(r)) return null;
  const built = apply(r, lemma, cls);
  if (!built.ok) return null;
  // A recipe that leaves the word untouched isn't a question either, whatever
  // isProducible thinks — belt and braces, since isProducible reasons about
  // the TABLE and this reasons about the actual output.
  if (built.value === lemma) return null;
  return {
    kind: "production",
    recipeId: r.id,
    lemma,
    pattern: r.pattern,
    gloss: r.gloss,
    answer: built.value,
  };
}

/**
 * A production question on a VARIED vehicle, so a run does not drill every
 * pattern on 行く.
 *
 * Picks a legal vehicle from the pool (see vehicles.ts — legality is decided by
 * actually building the recipe, so nothing illegal is ever offered) and hands
 * it to `production`, which is already vehicle-agnostic. Returns null exactly
 * when `production` would: a non-producible recipe, or one no pooled word can
 * host (a wrap). A null here is the caller's cue to fall back to the fixed
 * vehicle baked in the fact.
 *
 * `rng` is injectable so a test can pin the choice; it defaults to Math.random.
 */
export function variedProduction(
  recipeId: string,
  rng: Rng = Math.random,
): ProductionQuestion | null {
  const r = recipe(recipeId);
  if (!r || !isProducible(r)) return null;
  const v = pickVehicle(r, rng);
  if (!v) return null;
  return production(r.id, v.surface, v.cls as WordClass);
}

// ---------------------------------------------------------------------------
// SELECTION
// ---------------------------------------------------------------------------

/**
 * Particles that may EVER be a selection answer.
 *
 * An allowlist, not a blocklist, because the failure is silent and the default
 * must be "no". Excluded, and why:
 *
 *   は / が   Dead. See the header. 66% identical glosses, both correct.
 *   に / へ   Near-freely interchangeable for direction (学校に/へ行く).
 *   ね / よ   Sentence-final feel, not grammar. No fact of the matter.
 *
 * Anything not a particle isn't governed by this list — a pattern like てから
 * is selectable on the gloss test alone.
 */
const PARTICLE_ALLOWLIST: ReadonlySet<string> = new Set(["wo", "e", "made", "made-ni", "dake"]);

/** Recipe ids that are particles at all (allowed or not). */
const PARTICLE_IDS: ReadonlySet<string> = new Set([
  "wo",
  "e",
  "made",
  "made-ni",
  "dake",
  "kara-source",
  "shika-nai",
]);

/** What a blank looks like. One place, so the renderer and tests agree. */
export const BLANK = "＿＿＿";

export interface SelectionQuestion {
  readonly kind: "selection";
  /** The sentence with the pattern (and its host verb) replaced by BLANK. */
  readonly frame: string;
  /**
   * The host verb's DICTIONARY form — the prompt. 亡くなる.
   *
   * Shown beside the frame, because the blank swallowed the conjugated verb.
   * Without it the item is unanswerable rather than hard.
   */
  readonly host: string | null;
  /** The human English translation. Always shown — it is the only context. */
  readonly en: string;
  readonly answerId: string;
  /** Choices, answer included, in data order. The caller shuffles. */
  readonly choices: readonly { readonly id: string; readonly pattern: string; readonly gloss: string }[];
  /** Tatoeba sentence id, for attribution and for reporting a bad item. */
  readonly sourceId: number;
}

/**
 * Could `d` be a distractor against `answer`?
 *
 * The whole safety argument lives in this function, so it is deliberately
 * conservative: every test must pass, and a "maybe" is a no.
 */
export function isValidDistractor(answer: Recipe, d: Recipe): boolean {
  if (d.id === answer.id) return false;

  // THE GLOSS TEST. If the competitor means the same thing in English, the
  // item has two right answers and we cannot grade it. This is what kills the
  // obligation cluster's 7 members against each other — for free, without this
  // function knowing clusters exist.
  if (d.gloss === answer.gloss) return false;

  // Same-cluster is belt and braces: a cluster is BY DEFINITION a set of
  // patterns meaning the same thing, so if two members ever diverge in gloss
  // the gloss test would let them through. The cluster is the author's
  // intent; trust it over the string.
  if (answer.cluster && d.cluster === answer.cluster) return false;

  // A distractor must be able to attach where the answer attaches, or it is
  // not a plausible choice — it's a giveaway.
  const hosts = new Set(answer.attach.map((a) => a.host));
  if (!d.attach.some((a) => hosts.has(a.host))) return false;

  // THE PREFIX TEST, and the reason the gloss test alone is not enough.
  //
  // Found by printing an item instead of trusting the count. For the frame
  // 馬が[___]鞍が淋しい (亡くなる), the answer てから was offered against the
  // distractor bare-て — different glosses, so the gloss test passed. But
  // 馬が亡くなって鞍が淋しい is PERFECTLY GRAMMATICAL. The item had two right
  // answers and would have marked a correct answer wrong, which is precisely
  // the failure は/が cloze was killed for.
  //
  // The structure behind it: bare て attaches to the same form as てから and
  // its suffix ("") is a PREFIX of てから's ("から"). Whenever that holds, the
  // shorter pattern is a well-formed truncation of the longer one and the
  // frame accepts both. This also correctly kills ても vs てもいい, and
  // ても vs てもらう.
  //
  // Grammaticality is not computable here in general. This test is not a
  // proof of choosability — it removes one whole CLASS of false competitors,
  // and it is the class that co-occurs with everything.
  for (const da of d.attach) {
    for (const aa of answer.attach) {
      if (da.form !== aa.form) continue;
      if (da.add.startsWith(aa.add) || aa.add.startsWith(da.add)) return false;
    }
  }

  // Particles: allowlist only, in either role. A を item may not have a に
  // distractor, and no item may ever have a は one — there is no は recipe, but
  // this does not depend on that staying true.
  if (PARTICLE_IDS.has(d.id) && !PARTICLE_ALLOWLIST.has(d.id)) return false;
  if (PARTICLE_IDS.has(answer.id) && !PARTICLE_ALLOWLIST.has(answer.id)) return false;

  return true;
}

/**
 * Build a selection item from a corpus sentence, or refuse.
 *
 * Refuses far more often than it succeeds, and that is the design working. An
 * item is only shipped when the answer is uniquely determined; everything
 * uncertain is dropped rather than shown with a caveat.
 */
export function selection(
  ex: Example,
  answerId: string,
  wanted = 4,
): SelectionQuestion | null {
  const answer = recipe(answerId);
  if (!answer) return null;
  if (!ex.p.includes(answerId)) return null;

  // A sentence matching several patterns cannot be blanked for one of them
  // without risking the blank covering another. Drop it — cheaper than being
  // clever, and there are 8,689 sentences.
  if (ex.p.length > 1) return null;

  // EVERY recipe is a candidate distractor, said plainly. This used to read
  // DRILLABLE.concat(the vacuous ones), which was a long way of writing RECIPES
  // and only worked while "drillable" and "vacuous" were exact complements.
  // They aren't any more — a wrap can be non-vacuous and still unaskable — so
  // that phrasing would now silently drop 〜たり〜たり and 〜しか〜ない from the
  // pool. Being unaskable AS AN ANSWER says nothing about being offerable as a
  // CHOICE: a distractor is a pattern name and a gloss, and it is never built.
  const distractors = RECIPES.filter((d) => isValidDistractor(answer, d))
    // A distractor whose own text is already in the sentence gives the game
    // away, or makes two answers true.
    .filter((d) => !ex.p.includes(d.id));

  if (distractors.length < wanted - 1) return null;

  const choices = [answer, ...distractors.slice(0, wanted - 1)].map((r) => ({
    id: r.id,
    pattern: r.pattern,
    gloss: r.gloss,
  }));

  const span = ex.sp[answerId];
  if (!span) return null;
  const [start, end, host] = span;

  return {
    kind: "selection",
    frame: ex.jp.slice(0, start) + BLANK + ex.jp.slice(end),
    host,
    en: ex.en,
    answerId: answer.id,
    choices,
    sourceId: ex.id,
  };
}

/**
 * How many recipes can produce at least one real selection item?
 *
 * This is the number the brief put at ~46% AS A PATTERN PROPERTY, and the
 * point of computing it here rather than quoting it is that it is not a
 * pattern property at all — it is a property of (pattern x sentence x
 * distractors), and two of those three are ours. Compute it; never print the
 * quoted figure as fact.
 */
export function selectableRecipes(): string[] {
  const out: string[] = [];
  for (const r of RECIPES) {
    const examples = examplesFor(r.id);
    if (examples.some((ex) => selection(ex, r.id) !== null)) out.push(r.id);
  }
  return out;
}
