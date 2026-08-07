// The generative counter CATEGORIES — the drillable side of number construction.
//
// WHAT THIS IS
// ============
// src/data/number-construction.ts owns the "how it is built" REFERENCE pages (one
// per number range and per counter, read-only bar a "Quiz me" button). This file
// mints the matching DRILLABLE facts: one real FactInfo per category, so that a
// generated count interleaves into the ordinary fact-based Drill the way a word
// or a kanji does — a Counters practice that mixes ひとつ, 先生-style words AND a
// freshly rolled 三本 さんぼん.
//
// A category fact is a `word` fact (COUNTERS_SUBJECT) whose entry is in
// COUNTER_ENTRIES, so factType() files it under Counters and nothing downstream
// needs to know it is special — EXCEPT the drill, which rolls a NumberQuizItem
// for it per showing (see src/lib/engine/question.ts, constructionQuestions, and
// drill-screen.tsx). The fact carries no baked count: its `answers` is a display
// fallback only, and grading, prompt and reveal all run off the rolled item.
//
// SINGLE SOURCE OF TRUTH
// ======================
// The glyph, name, quiz config and rule-card copy are all read from the matching
// NumberConstruction (by shared id), so a category and its page cannot drift. The
// tens/big categories reuse the lesson's own NUMBERS_COMPOSE / NUMBERS_BIG rule
// cards (the number units already teach with them); each counter category derives
// its rule card from the construction page's body and worked table.

import {
  CONSTRUCTION_CATEGORY_IDS,
  constructionCategoryEntry,
  constructionMarker,
  COUNTERS_SUBJECT,
  type ConstructionCategoryId,
} from "@/data/counters";
import {
  numberConstructionRow,
  type NumberConstruction,
} from "@/data/number-construction";
import { NUMBERS_BIG, NUMBERS_COMPOSE, type PhaseIntro } from "@/data/phase-intros";
import type { NumberQuizConfig } from "@/lib/engine/number-quiz";
import { factId } from "@/lib/fact-id";
import type { EntryId, FactId, FactInfo, HistoryFile } from "@/types";

/** The aspect a category fact hangs off. Its OWN aspect — not "reading" or
 * "meaning" — so it can never be mistaken for a word's reading/meaning fact by a
 * subject that keys on those (a category has neither a fixed reading nor a fixed
 * meaning; it has a rolled count). */
const CATEGORY_ASPECT = "count";

/** One generative category, resolved once from its construction page. */
export interface ConstructionCategory {
  readonly id: ConstructionCategoryId;
  /** The drillable fact id — a `word` fact filed under Counters. */
  readonly fact: FactId;
  readonly entry: EntryId;
  /** The MARKER claimed when this category's rule lesson begins; the gate the
   * scheduler reads and the trigger that makes `fact` known (see selection.ts). */
  readonly marker: FactId;
  /** On screen — 〜本, 十〜. */
  readonly glyph: string;
  /** The category's name — "Long things (〜本)", "Numbers 11–99". */
  readonly name: string;
  /** The generative round config: this category's counts / range / directions. */
  readonly config: NumberQuizConfig;
  /** The rule card the teach walk shows before the generated round. */
  readonly intro: PhaseIntro;
}

/** The rule card a counter category teaches with — its construction page's body
 * and worked example table, shown as a formless one-card teach walk (parallel to
 * the number units' NUMBERS_COMPOSE / NUMBERS_BIG). Script-neutral (setId ""). */
function counterIntro(c: NumberConstruction): PhaseIntro {
  return {
    id: `intro-counter-${c.id}`,
    setId: "",
    title: c.name,
    body: [...c.body],
    examples: [...c.examples],
    examplesPlacement: "below",
  };
}

/** The rule card for a category id — the number ranges reuse the lesson's own
 * cards; a counter derives one from its page. */
function introFor(c: NumberConstruction): PhaseIntro {
  if (c.id === "tens") return NUMBERS_COMPOSE;
  if (c.id === "big") return NUMBERS_BIG;
  return counterIntro(c);
}

function buildCategory(id: ConstructionCategoryId): ConstructionCategory {
  // Every category id is a real construction id by construction (they are minted
  // from the same list), so this never misses; the non-null is the shared-id
  // contract, checked in counter-categories.test.ts.
  const c = numberConstructionRow(id)!;
  const entry = constructionCategoryEntry(id);
  return {
    id,
    fact: factId(entry, CATEGORY_ASPECT),
    entry,
    marker: constructionMarker(id),
    glyph: c.glyph,
    name: c.name,
    config: c.quizConfig,
    intro: introFor(c),
  };
}

/** Every category, in teaching order (the two number ranges, then the counters). */
export const CONSTRUCTION_CATEGORIES: readonly ConstructionCategory[] =
  CONSTRUCTION_CATEGORY_IDS.map(buildCategory);

/**
 * The drillable category facts. A `word` fact with a display-only answer: the
 * real question is the count the drill rolls, so `answers` is the category name
 * (what a bare reveal would otherwise print — never actually shown, because
 * constructionQuestions overrides the reveal). meaning carries the name too, so
 * an MC label / Library row reads sensibly.
 */
export const CONSTRUCTION_CATEGORY_FACTS: FactInfo[] = CONSTRUCTION_CATEGORIES.map(
  (cat) => ({
    id: cat.fact,
    entry: cat.entry,
    glyph: cat.glyph,
    answers: [cat.name],
    subject: COUNTERS_SUBJECT,
    meaning: cat.name,
  }),
);

const BY_FACT: ReadonlyMap<FactId, ConstructionCategory> = new Map(
  CONSTRUCTION_CATEGORIES.map((c) => [c.fact, c]),
);

const BY_MARKER: ReadonlyMap<FactId, ConstructionCategory> = new Map(
  CONSTRUCTION_CATEGORIES.map((c) => [c.marker, c]),
);

/** Is this fact a generative construction-category fact? The predicate the drill
 * and the question engine guard on before rolling an item — a lookup, never a
 * parse of the id. */
export function isConstructionFact(fact: FactId): boolean {
  return BY_FACT.has(fact);
}

/** The category a fact names, or undefined for a non-category fact. */
export function constructionCategory(fact: FactId): ConstructionCategory | undefined {
  return BY_FACT.get(fact);
}

/** The generative round config for a category fact, or null. What the drill rolls
 * a per-showing item from (see rollConstructionItem). */
export function constructionConfigForFact(fact: FactId): NumberQuizConfig | null {
  return BY_FACT.get(fact)?.config ?? null;
}

/** The category fact a marker gates, or undefined. The join the known tracker
 * uses: a claimed counter:gen:hon marker makes the 〜本 category fact drillable. */
export function constructionFactForMarker(marker: FactId): FactId | undefined {
  return BY_MARKER.get(marker)?.fact;
}

/** The rule card a category marker teaches, or null. The teach walk renders this
 * as the whole (formless) lesson for a generative unit — see lesson-steps.ts. */
export function constructionIntroForMarker(marker: FactId): PhaseIntro | null {
  return BY_MARKER.get(marker)?.intro ?? null;
}

/** Is this fact any generative-category marker (a bare-number range OR a
 * counter)? Broader than isNumberUnitMarker (tens/big only). */
export function isConstructionMarker(fact: FactId): boolean {
  return BY_MARKER.has(fact);
}

/**
 * The category facts whose construction has been TAUGHT in this history — every
 * category whose marker is claimed or marked seen (the same two records a lesson
 * writes: a claim on Start, a seen on "Quiz me"). This is what makes a category
 * drill-eligible without seeding the fact itself; see selection.knownFacts.
 */
export function knownConstructionFacts(history: HistoryFile): FactId[] {
  const claims = history.claims ?? {};
  const seen = history.seen ?? {};
  const out: FactId[] = [];
  for (const cat of CONSTRUCTION_CATEGORIES) {
    if (cat.marker in claims || cat.marker in seen) out.push(cat.fact);
  }
  return out;
}
