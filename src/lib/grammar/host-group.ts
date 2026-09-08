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
