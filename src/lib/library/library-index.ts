// LIBRARY INDEX LOADER — the smaller tables of the generated index, and the
// content-light lookups built on them.
//
// The entries themselves, their buckets by kind, `libEntry` and `knownFactsOf`
// live in entries.ts, which reads the same generated file (SAK-400); they are
// re-exported here so the shelf, search and lookup modules that always read
// them from this loader keep doing so. What this file adds is the rest of the
// index — every entry's facts, the reading proofs, the kanji orders, the
// component uses — and the handful of id builders re-declared content-free
// for the modules that only need a string.
//
// Equivalence with the build that wrote the file is asserted by
// library-index.equiv.test.ts — that test, not this module, is the safety net.

import {
  LIBRARY_INDEX,
  LIB_ENTRIES,
  LIB_ENTRIES_BY_KIND,
  libEntry,
  knownFactsOf,
  KINDS,
  KIND_LABEL,
  entryName,
  shelfKindOf,
  SENTENCE_RULE_KIND,
  COUNTER_KIND,
  NUMBER_CONSTRUCTION_KIND,
  type Kind,
} from "./entries";
import type { StrokeFallback } from "@/lib/lesson-roles";
import type { EntryId, FactId } from "@/types";
import type { HistoryFile } from "@/types";
import { effectiveState } from "@/lib/claims";
import { wordMeaningFactId } from "@/lib/vocab-ids";
import { wordBeginnerRank } from "@/lib/word-rank";
import { RECIPES, isPrimaryPatternRecipe, patternGroup, type Recipe } from "@/data/grammar/recipes";
import type { Form } from "@/lib/conjugate";

// The four small, genuinely content-LIGHT subjects entryForGlyph resolves
// directly — none of these files import data/vocab.ts, so reading them here
// carries none of the ~8.6MB dictionary. Only KANJI_SUBJECT is different: its
// own data/kanji.ts module has a top-level import of vocab.ts (for its separate
// reading-attestation logic), so its existence check is precomputed instead
// (INDEX.kanjiGlyphs) and its id builder reproduced as the pure one-liner it is.
import { CHAR_INDEX, KANA_SUBJECT, kanaEntry, LOOK_GROUP } from "@/data/characters";
import { RADICAL_SUBJECT, radicalByGlyph, radicalEntry } from "@/data/radicals";
import { PRIMITIVE_SUBJECT, PRIMITIVE_STROKES, primitiveEntry } from "@/data/components";
import { VOCAB_SUBJECT, wordEntry } from "@/lib/vocab-ids";
import { entryId } from "@/lib/fact-id";
// SAK-271: both maps are pure data (a Map literal keyed by keb string,
// numberConstructionEntry/counterEntry id builders) — see counters.ts's own
// imports, which pull in nothing heavier than fact-id.ts. Safe to read here
// without reintroducing the dictionary this loader exists to avoid; see
// canonicalMixupEntry's doc comment below for why they're needed at all.
import { COUNTER_TAIL_FORM_ALIASES, COUNTER_VOCAB_DUPLICATE_KEBS } from "@/data/counters";
// CURRICULUM_GLYPHS (not curriculum-order.ts directly) — curriculum-order.ts
// imports data/vocab.ts (isSingleCharWordGlyph), which would pull the ~8.6MB
// dictionary onto /library. CURRICULUM_GLYPHS is the SAME spine, in the same
// order, precomputed by /learn's Phase-1 build (learn-index.json) — reused here
// rather than duplicated into a second generated file.
import { CURRICULUM_GLYPHS } from "@/lib/content/curriculum-meta";

export { VOCAB_SUBJECT };

/** The entry model, owned by entries.ts and read from the same file (SAK-400). */
export { LIB_ENTRIES, LIB_ENTRIES_BY_KIND, libEntry, knownFactsOf, KINDS, KIND_LABEL, entryName, shelfKindOf, SENTENCE_RULE_KIND, COUNTER_KIND, NUMBER_CONSTRUCTION_KIND };

const INDEX = LIBRARY_INDEX;


/**
 * SAK-271: some VOCAB rows (１万/１０万/１００万/１００億, 一つ…九つ, 一人/二人,
 * 二十歳, …) are pure duplicates of a counter/number-construction entry that
 * already teaches the same word under a different id — see
 * COUNTER_VOCAB_DUPLICATE_KEBS's own doc comment in data/counters.ts.
 * library/entries.ts drops these kebs from the browsable Library list and
 * aliases them for search instead of minting a second, redundant entry —
 * but `factEntryOf` above still (correctly) names the RAW word entry a fact
 * belongs to: entryOf's job is to say what a fact IS, not to know about this
 * display-only dedup. That raw id then matches no entry in `LIB_ENTRIES`, so a
 * mix-up recorded against one of these facts resolves to an id no real
 * Library entry carries and can never surface on the Mix-ups filter, since
 * that filter can only ever match a real, on-screen entry's id.
 *
 * Built off the SAME two source maps entries.ts's own
 * COUNTER_KANJI_DUPLICATE_SEARCH reads (COUNTER_VOCAB_DUPLICATE_KEBS /
 * COUNTER_TAIL_FORM_ALIASES) — the forward direction of that same lookup, so
 * this file and counters.ts/entries.ts cannot disagree about which word
 * aliases which entry. Both source maps are lightweight (no dictionary
 * import), so reading them here does not reintroduce the ~8.6MB dictionary
 * this content-free loader exists to avoid.
 */
const DUPLICATE_ENTRY_TARGET: ReadonlyMap<EntryId, EntryId> = new Map(
  [...COUNTER_VOCAB_DUPLICATE_KEBS, ...COUNTER_TAIL_FORM_ALIASES].map(
    ([keb, target]) => [wordEntry(keb), target],
  ),
);

/**
 * `id`, redirected to the real Library entry it is a pure duplicate of (see
 * `DUPLICATE_ENTRY_TARGET` above), or `id` unchanged when it names no known
 * duplicate. For callers that need "the entry a mix-up should be credited to
 * on screen" rather than "what a fact literally is" — currently only
 * `getActiveMixupEntries` (server-lookups.ts), the Library's Mix-ups filter.
 */
export function canonicalMixupEntry(id: EntryId): EntryId {
  return DUPLICATE_ENTRY_TARGET.get(id) ?? id;
}

/** Every fact of an entry, unfiltered — the precomputed twin of `factsOf`
 * (facts.ts). Empty for an unknown entry, matching `factsOf`'s own fallback. */
export function factsOf(entry: EntryId): FactId[] {
  return [...(INDEX.entryFacts[entry as unknown as string] ?? [])];
}

/** True for the canonical word-anchored kanji reading facts — re-exported from
 * reading-proof-facts.ts, which now owns this and the two functions below (see
 * that file's header: SAK-104 split it out to its own small generated JSON so
 * slice-bar.tsx doesn't need the whole guarded index for it). */
export { isReadingFact, claimableFacts, quizzableFacts } from "@/lib/library/reading-proof-facts";

/** A sentence-ordering tier's id/label — enough to LIST a shelf row. The full
 * tier (patterns, gates) is content; fetch it via a dynamic
 * `import("@/data/assembly")` at the point a learner actually acts on one. */
export const SENTENCE_TIERS: readonly { id: string; label: string }[] =
  INDEX.sentenceTiers;

/** The mark subject constant and its entry-id builder — byte-identical to
 * data/marks.ts's `MARK_SUBJECT` / `markEntry`. Re-declared content-free so a
 * caller that only needs a mark's entry id (SentenceEntryView, fetching the
 * mark behind a sentence-ordering tier) doesn't pull in marks.ts's own
 * dependencies (phase-intros.ts, sentence-ordering-guides.ts) for it. */
export const MARK_SUBJECT = "writing-rule";
export function markEntry(id: string): EntryId {
  return entryId(MARK_SUBJECT, id);
}

/** The grammar subject constant — byte-identical to data/grammar/index.ts's
 * `GRAMMAR_SUBJECT`. A literal, re-declared: that module's `vehicles.ts`
 * dependency needs vocab.ts for pattern-vs-word validation, unrelated to this
 * one string. */
export const GRAMMAR_SUBJECT = "grammar";

/** A grammar pattern's entry id — byte-identical to data/grammar/index.ts's
 * `patternEntry` (`entryId(GRAMMAR_SUBJECT, recipeId)`), a pure one-liner
 * reproduced content-free. */
export function patternEntry(recipeId: string): EntryId {
  return entryId(GRAMMAR_SUBJECT, recipeId);
}

/** A recipe's verb-attach form — byte-identical to data/grammar/index.ts's
 * `verbAttachForm` (`r.attach.find(a => a.host === "verb")?.form`), a pure
 * one-liner over the recipe's own field, reproduced content-free. */
export function verbAttachForm(r: Recipe) {
  return r.attach.find((a) => a.host === "verb")?.form;
}

/** Form -> display label — the precomputed twin of lib/grammar/formula.ts's
 * hand-authored `FORM_LABEL` (serialized, not retyped — 21 entries is real
 * content worth protecting from a transcription drift). */
export const FORM_LABEL: Readonly<Record<Form, string>> = INDEX.formLabel as Readonly<
  Record<Form, string>
>;

const GRAMMAR_RANK_BY_ID: ReadonlyMap<string, number> = new Map(
  INDEX.grammarTeachingOrderIds.map((id, i) => [id, i]),
);

/** Where a grammar pattern falls in the teaching order — the content-free twin
 * of grammar-order.ts's `grammarRank`. */
export function grammarRank(recipeId: string): number {
  return GRAMMAR_RANK_BY_ID.get(recipeId) ?? Number.MAX_SAFE_INTEGER;
}

/** entry id → its recipe — the content-free twin of library/entries.ts's
 * `RECIPE_OF_ENTRY` map, built the identical way (same RECIPES walk, same
 * isPrimaryPatternRecipe filter, same patternEntry). data/grammar/recipes.ts
 * is itself content-light (only conjugate.ts's Form/WordClass types), so this
 * carries none of entries.ts's dictionary entanglement. */
const RECIPE_OF_ENTRY: ReadonlyMap<EntryId, Recipe> = new Map(
  RECIPES.filter(isPrimaryPatternRecipe).map((r) => [patternEntry(r.id), r]),
);

/** The recipe behind a grammar entry, or null — byte-identical to
 * library/entries.ts's `recipeOf`, taking the entry id directly rather than a
 * LibEntry (the only field that function read off it). */
export function recipeOf(entry: EntryId): Recipe | null {
  return RECIPE_OF_ENTRY.get(entry) ?? null;
}

/** Every independently meaningful recipe on this pattern's reference page —
 * byte-identical to library/entries.ts's `recipesOf`. */
export function recipesOf(entry: EntryId): readonly Recipe[] {
  const primary = RECIPE_OF_ENTRY.get(entry);
  return primary ? patternGroup(primary.id) : [];
}

/** The grammar-concept kind constant — byte-identical to data/grammar-concepts.
 * ts's `GRAMMAR_CONCEPT_SUBJECT`. A literal, re-declared: that module pulls
 * grammar/lessons.ts (auto-generated teach pages, needing vocab.ts) for
 * something unrelated to this one string. */
export const GRAMMAR_CONCEPT_SUBJECT = "grammar-concept";

/** A grammar concept's entry id — byte-identical to data/grammar-concepts.ts's
 * `grammarConceptEntry` (`entryId(GRAMMAR_CONCEPT_SUBJECT, id)`), a pure
 * one-liner reproduced content-free. */
export function grammarConceptEntry(id: string): EntryId {
  return entryId(GRAMMAR_CONCEPT_SUBJECT, id);
}

/** Every grammar-concept slug, in order — the precomputed twin of
 * `GRAMMAR_CONCEPTS.map(c => c.id)`. */
export const GRAMMAR_CONCEPT_IDS: readonly string[] = INDEX.grammarConceptIds;

// FIRST occurrence wins (SAK-162): CURRICULUM_GLYPHS is CURRICULUM_SEQUENCE's
// glyphs in spine order, and a word taught with more than one reading (七) now
// repeats its glyph there, once per reading — see curriculum-order.ts's header.
// The first occurrence is always that word's PRIMARY reading, which is the
// right answer for "where does this glyph FIRST become taught" (the only
// question curriculumRank/climbRank ever ask); a naive `new Map(pairs)` would
// instead keep the LAST occurrence, silently reporting a rare second reading's
// position as if it were the glyph's own.
const CURRICULUM_POSITION: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (let i = 0; i < CURRICULUM_GLYPHS.length; i++) {
    const glyph = CURRICULUM_GLYPHS[i];
    if (!map.has(glyph)) map.set(glyph, i);
  }
  return map;
})();

/** Where a glyph sits in the curriculum spine, or -1 for anything the
 * curriculum does not teach — the content-free twin of curriculum-order.ts's
 * `curriculumPosition`. Shared by ranged-groups.ts and kanji-shelf.ts so the
 * CURRICULUM_GLYPHS map is built once. */
export function curriculumPosition(glyph: string): number {
  return CURRICULUM_POSITION.get(glyph) ?? -1;
}

/** Every curriculum glyph, in spine order — re-exported so a consumer that only
 * needs the count (e.g. a spine-size constant) doesn't need its own import of
 * @/lib/content/learn-index. */
export { CURRICULUM_GLYPHS };

/** The kanji subject constant — byte-identical to data/kanji.ts's
 * `KANJI_SUBJECT`. A literal, re-declared so nothing here imports kanji.ts. */
export const KANJI_SUBJECT = "kanji";

const KANJI_GLYPHS: ReadonlySet<string> = new Set(INDEX.kanjiGlyphs);

/** A kanji's entry id — byte-identical to data/kanji.ts's `kanjiEntry`
 * (`entryId(KANJI_SUBJECT, c)`), a pure one-liner reproduced content-free. */
export function kanjiEntry(c: string): EntryId {
  return entryId(KANJI_SUBJECT, c);
}

/** Glyph -> jōyō school grade — the content-free twin of reading `k.grade` off
 * data/kanji.ts's `KANJI`. */
export function kanjiGrade(glyph: string): number | undefined {
  return INDEX.kanjiGrade[glyph];
}

/** A NewKanjiOrder's fixed teach sequence — the content-free twin of
 * data/kanji.ts's `kanjiTeachOrder`. */
export function kanjiTeachOrder(mode: "everyday" | "grade" | "newspaper"): readonly string[] {
  return INDEX.kanjiTeachOrders[mode];
}

/** Kanji written with this direct component, in teaching order — the
 * content-free twin of library/components.ts's `usedAsPartIn`. */
export function usedAsPartIn(component: string): readonly string[] {
  return INDEX.componentUses[component] ?? [];
}

/** Known vocabulary written with a kanji containing this component. Mirrors
 * library/components.ts's two joins and wordKnown gate using index entries. */
export function knownWordsUsing(
  component: string,
  history: HistoryFile,
): readonly string[] {
  const kanji = new Set(usedAsPartIn(component));
  if (kanji.size === 0) return [];

  const out: string[] = [];
  for (const word of LIB_ENTRIES_BY_KIND.get(VOCAB_SUBJECT) ?? []) {
    if (![...word.glyph].some((glyph) => kanji.has(glyph))) continue;
    const fact = wordMeaningFactId(word.glyph);
    const state = effectiveState(
      history.facts[fact],
      history.claims?.[fact],
      history.seen?.[fact],
    );
    if (state.lastTested > 0) out.push(word.glyph);
  }
  out.sort(
    (a, b) =>
      (wordBeginnerRank(a) ?? Infinity) -
      (wordBeginnerRank(b) ?? Infinity),
  );
  return out;
}

const PITCH_INCOMPATIBLE_WORDS: ReadonlySet<string> = new Set(
  INDEX.pitchIncompatibleWords,
);

/** Whether WordsWith may paint the stored pitch against this word's preferred
 * reading — the content-free twin of comparing it to legacyUnqualifiedReading. */
export function pitchReadingCompatible(word: string): boolean {
  return !PITCH_INCOMPATIBLE_WORDS.has(word);
}

/** The entry a glyph resolves to for its kind — the index's twin of
 * entries.ts's `entryForGlyph`. KANA, KANJI, RADICAL and PRIMITIVE resolve by
 * an existence check + pure id build, as there; every other kind has no glyph
 * resolution and returns null, as there. VOCAB is the one place the two
 * differ, on purpose for now (SAK-400): this answers null for a keb the build
 * skips (the 98 grammar and counter duplicates, だけ, 一つ, 一人…), because no
 * entry carries that id, while entries.ts's answers `wordEntry(keb)` for any
 * VOCAB row. Which is right is a question for the caller that meets one. */
export function entryForGlyph(kind: Kind, glyph: string): EntryId | null {
  switch (kind) {
    case KANA_SUBJECT:
      return CHAR_INDEX[glyph] ? kanaEntry(glyph) : null;
    case KANJI_SUBJECT:
      return KANJI_GLYPHS.has(glyph) ? kanjiEntry(glyph) : null;
    case RADICAL_SUBJECT:
      return radicalByGlyph(glyph) ? radicalEntry(glyph) : null;
    case PRIMITIVE_SUBJECT:
      return PRIMITIVE_STROKES.has(glyph) ? primitiveEntry(glyph) : null;
    case VOCAB_SUBJECT: {
      const id = wordEntry(glyph);
      return libEntry(id) ? id : null;
    }
    default:
      return null;
  }
}

/** Both of strokeFallbackOf's answers for a glyph, precomputed — content-free
 * twin of lib/lesson-roles.ts's `strokeFallbackOf`, scoped to kana glyphs so
 * far. Undefined for a glyph the index doesn't carry (any non-kana glyph
 * today); the caller (how-its-written.tsx) falls back to the live function. */
/** A kana's shape lookalikes — the content-free twin of library/entries.ts's
 * `confusableWith` KANA branch (`LOOK_GROUP`/`CHAR_INDEX`/`kanaEntry`, all
 * already content-free at the source — no precompute needed). */
export function kanaConfusables(glyph: string): EntryId[] {
  return (LOOK_GROUP[glyph] ?? []).filter((c) => CHAR_INDEX[c]).map((c) => kanaEntry(c));
}

export function precomputedStrokeFallback(
  glyph: string,
): { normal: StrokeFallback; reference: StrokeFallback } | undefined {
  return INDEX.strokeFallback[glyph];
}
