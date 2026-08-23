// NO `import "server-only"` YET (SAK-104): it hard-breaks `next build` while
// manage-lists.tsx (lists page) still imports href.ts, which imports this
// file, client-side. Re-add once that consumer is migrated to a Server
// Action too.

// LIBRARY INDEX LOADER — the content-free list/search path for /library.
//
// Reads the precomputed index (library-index.json) instead of importing
// library/entries.ts — that file's `LIB_ENTRIES = build()` is an eager top-level
// constant that touches every content module the moment anything is imported
// from the file. This loader carries none of that: it is a flat JSON read plus
// the same bucketing logic `LIB_ENTRIES_BY_KIND` already used.
//
// Entry detail dispatch and shared Library actions also read this module. Their
// display payloads still come from content_entries; the index supplies only
// routing, ids, search fields, and small structural/history gates.
//
// Equivalence with the live path is asserted by library-index.equiv.test.ts —
// that test, not this module, is the safety net.

import libraryIndexJson from "@/data/generated/library-index.json" with { type: "json" };
import type { LibraryIndex, IndexLibEntry } from "./library-index-types";
import type { Kind } from "@/lib/library/entries";
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
import { NUMBER_CONSTRUCTION_SUBJECT } from "@/data/number-construction-id";
import { entryId } from "@/lib/fact-id";
// CURRICULUM_GLYPHS (not curriculum-order.ts directly) — curriculum-order.ts
// imports data/vocab.ts (isSingleCharWordGlyph), which would pull the ~8.6MB
// dictionary onto /library. CURRICULUM_GLYPHS is the SAME spine, in the same
// order, precomputed by /learn's Phase-1 build (learn-index.json) — reused here
// rather than duplicated into a second generated file.
import { CURRICULUM_GLYPHS } from "@/lib/content/learn-index";

export { VOCAB_SUBJECT };

const INDEX = libraryIndexJson as unknown as LibraryIndex;

/** The kind list, exactly as library/entries.ts's `KINDS` — serialized from it,
 * not restated. */
export const KINDS: readonly Kind[] = INDEX.kinds as readonly Kind[];

/** Kind -> display label, exactly as library/entries.ts's `KIND_LABEL`. */
export const KIND_LABEL: Readonly<Record<Kind, string>> = INDEX.kindLabel as Readonly<
  Record<Kind, string>
>;

/** The content hash of the index. */
export const LIBRARY_INDEX_VERSION: string = INDEX.libraryIndexVersion;

/** Every entry in the app, in browse order — the precomputed twin of
 * `LIB_ENTRIES`. */
export const LIB_ENTRIES: readonly IndexLibEntry[] = INDEX.entries;

/** Entries bucketed once by kind, seeded with every kind (even empty), mirroring
 * `LIB_ENTRIES_BY_KIND`'s own construction exactly. */
export const LIB_ENTRIES_BY_KIND: ReadonlyMap<Kind, readonly IndexLibEntry[]> =
  (() => {
    const buckets = new Map<Kind, IndexLibEntry[]>();
    for (const k of KINDS) buckets.set(k, []);
    for (const e of LIB_ENTRIES) {
      const list = buckets.get(e.kind);
      if (list) list.push(e);
    }
    return buckets;
  })();

const BY_ID: ReadonlyMap<EntryId, IndexLibEntry> = new Map(
  LIB_ENTRIES.map((e) => [e.id, e]),
);

/** One entry by id, or undefined — the precomputed twin of `libEntry`. */
export function libEntry(id: EntryId): IndexLibEntry | undefined {
  return BY_ID.get(id);
}

/** An entry's known-for-claiming facts — the precomputed twin of
 * `knownFactsOf`. Empty (not undefined) for an entry the index carries no
 * known-fact record for. */
export function knownFactsOf(entry: IndexLibEntry | EntryId): readonly FactId[] {
  const id = typeof entry === "string" ? entry : entry.id;
  return INDEX.knownFacts[id as unknown as string] ?? [];
}

/** The entry a fact belongs to — the precomputed twin of `entryOf` (facts.ts).
 * Falls back to the raw id, matching `entryOf`'s own fallback for an id the data
 * no longer has. */
export function factEntryOf(fact: FactId): EntryId {
  return INDEX.factEntry[fact as unknown as string] ?? (fact as unknown as EntryId);
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

/** What to CALL an entry — byte-identical to library/entries.ts's `entryName`.
 * Pure (reads only the entry's own fields), so it is simply re-declared here
 * rather than pulled through entries.ts's heavy top-of-file imports. */
export function entryName(entry: IndexLibEntry): string {
  if (
    (entry.kind === "transitivity" || entry.kind === "keigo") &&
    entry.name
  ) {
    return entry.name;
  }
  return entry.glyph || entry.name || entry.id;
}

/** The shelf an entry kind browses under — byte-identical to the live
 * shelfKindOf. Number constructions are pages on the counters shelf; every
 * other kind browses under itself. */
export function shelfKindOf(kind: Kind): Kind {
  return kind === NUMBER_CONSTRUCTION_KIND ? COUNTER_KIND : kind;
}

/** The sentence-rule kind constant — byte-identical to library/entries.ts's
 * `SENTENCE_RULE_KIND`. A literal, re-declared for the same reason. */
export const SENTENCE_RULE_KIND = "sentence-rule";

/** The mark subject constant and its entry-id builder — byte-identical to
 * data/marks.ts's `MARK_SUBJECT` / `markEntry`. Re-declared content-free so a
 * caller that only needs a mark's entry id (SentenceEntryView, fetching the
 * mark behind a sentence-ordering tier) doesn't pull in marks.ts's own
 * dependencies (phase-intros.ts, sentence-ordering-guides.ts) for it. */
export const MARK_SUBJECT = "writing-rule";
export function markEntry(id: string): EntryId {
  return entryId(MARK_SUBJECT, id);
}

/** The counter kind constant — byte-identical to library/entries.ts's
 * `COUNTER_KIND`. A literal, re-declared for the same reason. */
export const COUNTER_KIND = "counting";

/** The number-construction kind constant — imported straight from its own
 * content-free source (data/number-construction-id.ts), which is what
 * library/entries.ts's `NUMBER_CONSTRUCTION_KIND` itself re-exports. */
export const NUMBER_CONSTRUCTION_KIND = NUMBER_CONSTRUCTION_SUBJECT;

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

/** The entry a glyph resolves to for its kind — the content-free twin of
 * library/entries.ts's `entryForGlyph`. Every case matches it exactly: KANA,
 * KANJI, RADICAL and PRIMITIVE resolve by an existence check + pure id build;
 * VOCAB resolves through the precomputed index (equivalent to
 * `vocabRow(glyph) ? wordEntry(glyph) : null`, since `build()` creates exactly
 * one LIB_ENTRIES row per VOCAB row); every other kind has no glyph resolution
 * and returns null, matching the live switch's remaining cases. */
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
