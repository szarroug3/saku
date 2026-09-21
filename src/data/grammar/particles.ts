// THE PARTICLES, AS ONE LIST (SAK-466).
//
// WHAT THIS IS FOR
// ================
// The Library's Particle term (src/data/terms.ts, id "particle") was two
// sentences about what a particle is, next to a Grammar shelf that already
// teaches seventeen of them one page at a time. A learner who looked the word
// up got the definition and no way to see the set. This file is that set: the
// recipes that ARE a particle, in the order a learner meets them, each with the
// page it opens and the sentence that page shows. The Particle term's page is
// built from it (src/app/(sky)/teach.ts), so a particle added to the recipes is
// a row added to the page, and nothing on the page is retyped from anywhere.
//
// WHY A NAMED LIST AND NOT A SHAPE TEST
// =====================================
// "A recipe whose pattern is 〜 and one kana, attached to a noun unchanged"
// sounds like it would find the particles and does not: it also finds 〜だ and
// 〜です, which are the copula, and it misses 〜ね and 〜よ, which keep the だ in
// front of a noun (学生だね). There is no test of shape that separates a
// particle from a copula, because the difference is what the word IS, not how
// it attaches. So the membership is named here, once, and everything else is
// read off the recipe: what each does, the sentence it is shown in, and the
// page it opens.
//
// THE SELECTION GATE READS THE SAME LIST
// ======================================
// src/lib/grammar/questions.ts has to know which recipes are particles too, for
// the opposite reason: a particle CHOICE is the one question the app must never
// ask (see that file's header on は/が). It used to hold a second copy of these
// ids. It imports these now, so the page and the gate cannot disagree about
// what a particle is, and a new particle recipe has one place to be declared.

import { patternEntry } from "@/data/grammar";
import { sentenceExampleFor } from "@/data/grammar/auto-page";
import { primaryPatternRecipe, recipe, type Recipe } from "@/data/grammar/recipes";
import type { SentenceExample } from "@/data/phase-intros";
import type { EntryId } from "@/types/facts";

/**
 * Every recipe that teaches a particle, in the order the page lists them: the
 * words that say what a noun is doing first (は が を に で へ), then the ones that
 * bound or add to it (まで までに から と も だけ しか〜ない), then the ones that
 * close a whole sentence (か ね よ って).
 *
 * と and から each name a written pattern the recipes teach in two senses, and
 * the particle is the second of each: to-and is 〜と "and, together with" beside
 * the conditional 〜と, kara-source is 〜から "from" beside 〜から "because". Both
 * link to the one page that written pattern has (see `particleRows`).
 */
export const PARTICLE_RECIPE_IDS: readonly string[] = [
  "wa",
  "ga",
  "wo",
  "ni",
  "de",
  "e",
  "made",
  "made-ni",
  "kara-source",
  "to-and",
  "mo",
  "dake",
  "shika-nai",
  "ka",
  "ne",
  "yo",
  "tte",
];

/**
 * だ and です: the copula, not particles.
 *
 * They are here because the selection gate wants them treated exactly as the
 * particles are (both are grammatical, so a cloze between them is often
 * unanswerable, which is the は/が problem again), and because a reader of
 * either list should find the reason they are not on the Particle page written
 * down rather than inferred from their absence.
 */
export const COPULA_RECIPE_IDS: readonly string[] = ["da", "desu"];

/** One row of the Particle page. */
export interface ParticleRow {
  /** The recipe this row is read from. */
  readonly recipeId: string;
  /** The particle itself, without the 〜 the pattern is written with: は, だけ. */
  readonly particle: string;
  /** What it does, in the recipe's own words: "marks the topic". */
  readonly does: string;
  /** The entry its page is, for the row's link. */
  readonly entry: EntryId;
  /** The sentence the particle's own page shows, when it has one. */
  readonly example?: SentenceExample;
}

/** The particle as it is written, off the recipe's pattern: 〜は is は. */
const written = (r: Recipe): string => r.pattern.replace(/^〜/, "");

/**
 * The rows, built from the recipes.
 *
 * The link is the entry of the written pattern's PRIMARY recipe, which is the
 * one page that pattern has: 〜から is one page holding both "because" and
 * "from", so the から row opens it and the row's own line says which sense the
 * particle is. The sentence is the one the pattern's page shows, from the same
 * lookup that page makes, so the two can never differ.
 */
export const PARTICLE_ROWS: readonly ParticleRow[] = PARTICLE_RECIPE_IDS.flatMap((id) => {
  const r = recipe(id);
  const page = primaryPatternRecipe(id);
  if (!r || !page) return [];
  const example = sentenceExampleFor(r);
  return [{
    recipeId: id,
    particle: written(r),
    does: r.gloss,
    entry: patternEntry(page.id),
    ...(example ? { example } : {}),
  }];
});
