// The recipe/host GROUPING the scheduler needs — SAK-192.
//
// THE GAP THIS CLOSES
// ====================
// 10 producible recipes attach to more than one host (te-permission is verb +
// adj-i; te-sequence, sugiru, sou-appearance, tara and node are verb + adj-i +
// adj-na) and each host mints its OWN, separately-scheduled production FactId
// (see productionHosts() / buildGrammarFacts() in data/grammar/index.ts). Two
// facts that both teach "how 〜てもいい attaches" — one on a verb, one on an
// い-adjective — are unrelated as far as src/lib/budget.ts and
// src/lib/selection.ts are concerned: nothing there knows they share a recipe,
// so a length-capped session or a shuffle can hand you the verb form five
// sessions running and never once show you the adjective form, even when both
// are independently due.
//
// WHY THIS LOOKUP LIVES HERE AND NOT IN budget.ts
// ================================================
// budget.ts is a deliberate leaf (see its own header: "no React, no clock, no
// storage") that does not import the fact registry or any one subject's data,
// on purpose — the same reason it hand-rolls `shuffle` instead of importing
// engine/index's. Recovering "which recipe, which host" from an opaque FactId
// is a LOOKUP, never a parse (see facts.ts's header on exactly this point),
// and the one lookup that already exists is `grammarProduction`
// (data/grammar/index.ts) — the same one engine/question.ts's
// `grammarVehicleFor` already calls. Duplicating its logic (or, worse, poking
// at a FactId's string shape) would be inventing a second, driftable copy of
// something src/lib/grammar/* already gets right.
//
// So the grouping lives at THIS layer instead — src/lib/grammar/, which
// already sits between the pure scheduler and the grammar data (vehicles.ts
// does the same thing, importing recipes.ts and vocab.ts directly). budget.ts
// and selection.ts take a plain, subject-agnostic
// `(fact) => { recipeId, host } | null` function — see PlanQuery.hostGroupOf
// in budget.ts — and have no idea it is grammar underneath. Nothing new is
// pulled into their bundle: selection.ts already imports `@/lib/facts`, which
// already imports `@/data/grammar` to build GRAMMAR_FACTS, so this file adds
// no additional weight there. Callers that only need budget.ts (which has
// never imported the fact registry) opt in by passing this function
// themselves, exactly the way a caller already supplies `groups` for the
// curriculum.

import { grammarProduction } from "@/data/grammar";
import type { FactId } from "@/types";

/** One fact's (recipe, host) slot, or null when the fact is not a grammar
 * PRODUCTION fact at all (a meaning fact, or a fact from another subject
 * entirely — both answer null here, same as `grammarProduction` itself). */
export interface HostGroup {
  readonly recipeId: string;
  readonly host: string;
}

/**
 * The pairing key `planSession`/`dueFacts` need: which recipe a production
 * fact belongs to, and which host it drills. Two facts with the same
 * `recipeId` and a DIFFERENT `host` are siblings of the same multi-host
 * recipe — the pairing this ticket is about. Two facts with the same
 * `recipeId` and the SAME `host` (the many verb-CLASS facts te-sequence
 * mints, one per conjugation class) are not a pairing target for each other;
 * see budget.ts's `withPairsKept`, which only ever needs ONE representative
 * per host, not all of them.
 */
export function grammarHostGroupOf(fact: FactId): HostGroup | null {
  const prod = grammarProduction(fact);
  return prod ? { recipeId: prod.recipe.id, host: prod.host } : null;
}

// ---------- SAK-203: vehicle coverage ----------
//
// THE GAP grammarHostGroupOf DOES NOT CLOSE
// ==========================================
// SAK-192's `host` is one of four values (verb / adj-i / adj-na / noun), which
// was the whole axis that existed when it shipped: every verb-hosting recipe
// had exactly ONE production fact. That stopped being true the day production
// split per conjugation class (`classProductionFactId`, data/grammar/index.ts)
// and per irregular word (`specialVerbProductionFactId`) — a single verb host
// can now carry TEN OR MORE separate facts for one recipe (nine godan endings
// plus ichidan, plus up to four irregulars: 行く/する/来る/ある). Grouping those
// by `grammarHostGroupOf` alone says "these are all the verb host" and nothing
// finer, so `pairsKept` (budget.ts) — fed that grouping — is satisfied the
// instant ONE class fact survives a length cut and has no reason to protect
// any of the other nine. That is SAK-203's reported bug in miniature: "how do
// you say after X" showing the same word over and over is a length cut that
// kept one class/irregular and quietly dropped the rest, not a shuffle problem.
//
// THE FIX IS NARROWER THAN IT SOUNDS
// ===================================
// `pairsKept`'s algorithm never assumed `host` meant literally "verb" or
// "adj-i" — it only ever used it as an opaque map key naming a SLOT that
// deserves one surviving representative. So nothing in budget.ts needs to
// change: threading a slot key that also carries the CLASS or the IRREGULAR
// WORD, instead of just the host, makes `pairsKept` protect "one fact per
// ENDING" for free, the same way it already protects "one fact per HOST".
// `grammarVehicleSlotOf` below is that finer key; `grammarVehicleBucketOf` is
// its recipe-agnostic half, used the other place SAK-203 needs (see
// vehicle-spread.ts): spacing cards that share a vehicle WORD apart even
// across DIFFERENT recipes, which `grammarHostGroupOf` (keyed per recipe) has
// no way to see at all.

/**
 * The vehicle bucket a production fact draws from — which conjugation CLASS,
 * or which exceptional WORD — independent of which recipe is asking.
 *
 * Two facts from the SAME recipe that share this key are the coverage slots
 * `pairsKept` should treat as separate (te-kara's v5k fact and its v5m fact
 * must both be able to survive a length cut — see `grammarVehicleSlotOf`,
 * which adds the recipe back in for that purpose).
 *
 * Two facts from DIFFERENT recipes that share this key resolve to the SAME
 * vehicle word almost every showing, because `pickVehicle` (vehicles.ts)
 * decides purely from (bucket, known-word history) — which recipe is asking
 * never enters into it. te-kara's @iku fact and te-request's @iku fact both
 * key to `"verb:行く"` here, and that pairing is exactly SAK-203's example 1:
 * "how do you say after 行く" next to "how do you say please 行く". See
 * `vehicle-spread.ts`'s `spreadGrammarVehicles`, the caller that uses this
 * cross-recipe reading.
 *
 * NOT A GUARANTEE OF THE EXACT WORD, AND THAT IS FINE. A regular class with
 * more than one legal member (v5u, v5m, v1 in vehicles.ts's VERB_VEHICLES)
 * could in principle land on a different member for two recipes if one of
 * them excludes a word the other doesn't (`recipeAllows`'s transitivity/notOn
 * carve-outs) — this key does not model that distinction, on purpose. It
 * exists to SPACE cards apart, not to grade them, and treating "same bucket"
 * as "probably the same word" is exactly the level of caution a spacing rule
 * needs: the cost of a false positive is one avoidable swap, and the cost of
 * a false negative is the bug this file exists to fix.
 *
 * Null for anything that is not a grammar production fact at all (a meaning
 * fact, or a fact from another subject) — same contract as `grammarHostGroupOf`.
 */
export function grammarVehicleBucketOf(fact: FactId): string | null {
  const prod = grammarProduction(fact);
  if (!prod) return null;
  if (!prod.bucket) {
    // An un-bucketed non-verb host fact (patternProductionFactId, e.g. a noun
    // host) is baked on ONE fixed example word per recipe (buildExample) —
    // no class, no irregular, just the host itself. Any two such facts,
    // across any two recipes, draw the identical fixed lemma, so the host
    // alone is already the right-sized key for them.
    return prod.host;
  }
  return prod.bucket.kind === "class"
    ? `${prod.host}:${prod.bucket.cls}`
    : `${prod.host}:${prod.bucket.surface}`;
}

/**
 * The pairing key `pairsKept` needs to protect vehicle COVERAGE rather than
 * just host coverage — `grammarVehicleBucketOf` (see its doc comment for the
 * full "why") with the recipe folded back in, so two facts of the SAME recipe
 * that draw from DIFFERENT buckets (te-kara's v5k fact and its v5m fact) are
 * two slots worth keeping, while two facts of the SAME recipe that would draw
 * from the SAME bucket collapse to one slot exactly as `grammarHostGroupOf`
 * already collapsed same-host facts.
 *
 * Fed to `pairsKept` (budget.ts, unchanged) wherever a length cut must not be
 * allowed to quietly keep one class/irregular and drop the rest — see
 * `buildDeck` (engine/index.ts), the one live call site.
 */
export function grammarVehicleSlotOf(fact: FactId): HostGroup | null {
  const bucket = grammarVehicleBucketOf(fact);
  if (bucket === null) return null;
  const prod = grammarProduction(fact)!; // bucket non-null implies prod non-null
  return { recipeId: prod.recipe.id, host: bucket };
}
