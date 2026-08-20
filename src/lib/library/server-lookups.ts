"use server";

// SERVER-ONLY LOOKUPS FOR CLIENT COMPONENTS — SAK-104.
//
// The dictionary/index modules (data/vocab.ts, lib/vocab-ids.ts [see note],
// lib/library/library-index.ts, lib/library/href.ts, lib/content/learn-index.ts,
// lib/facts.ts) are multi-megabyte and now guarded with `import "server-only"`
// so they never land in a client JS bundle again (that was SAK-104's bug: they
// were getting bundled into most routes, not just /learn).
//
// Client components that need a SPECIFIC, bounded lookup (one entry by id, one
// word's gloss, one fact's display info) call the Server Actions below instead
// of importing the guarded modules directly. This is the same
// fetch-by-id-instead-of-import-the-dictionary pattern
// src/lib/library/content-entries.ts already established for detail-page
// content; these actions cover the smaller, structural (non-content) lookups
// the redesigned entry-detail views, stats and quiz screens still need.
//
// BATCH WHERE THE CALLER HAS A KNOWN SET UP FRONT (resolveEntries,
// resolveFactInfos) so a deck/list/breakdown resolves in ONE round trip built
// once, not one request per row.

import type { EntryId, FactId, FactInfo, HistoryFile } from "@/types";
import type { IndexLibEntry } from "@/lib/library/library-index-types";
import type { Recipe } from "@/data/grammar/recipes";
import type { StrokeFallback } from "@/lib/lesson-roles";
import type { VocabRow } from "@/data/vocab";

import {
  claimableFacts as claimableFactsOf,
  entryForGlyph as entryForGlyphOf,
  entryName as libEntryName,
  factEntryOf as factEntryOfIndex,
  kanaConfusables as kanaConfusablesOf,
  kanjiEntry as kanjiEntryFor,
  knownFactsOf as knownFactsOfIndex,
  knownWordsUsing as knownWordsUsingIndex,
  libEntry as libEntryOf,
  pitchReadingCompatible as pitchReadingCompatibleOf,
  precomputedStrokeFallback as precomputedStrokeFallbackOf,
  quizzableFacts as quizzableFactsOf,
  recipeOf as recipeOfIndex,
  recipesOf as recipesOfIndex,
  SENTENCE_RULE_KIND,
  usedAsPartIn as usedAsPartInIndex,
} from "@/lib/library/library-index";
import { entryHref } from "@/lib/library/href";
import { termHref } from "@/lib/library/term-href";
import { subLabel } from "@/lib/library/sub-label";
import { subjectLabel as subjectLabelOf } from "@/lib/library/entries";
import { speechForFact } from "@/lib/fact-speech";
import { ALL_FACTS, entryOf, factInfo, factsOf, glyphOf } from "@/lib/facts";
import {
  isWordReadingFact,
  vocabRow,
  legacyUnqualifiedReading,
  VOCAB_SUBJECT,
} from "@/data/vocab";
import { KANA_SUBJECT } from "@/data/characters";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { KANJI_SUBJECT } from "@/data/kanji";
import { factType } from "@/lib/practice-types";
import { counterForm, isBareNumber, COUNTER_ENTRIES } from "@/data/counters";
import { numberConstructionEntry } from "@/data/number-construction-id";
import { numberConstructionFor } from "@/data/number-construction";
import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import { itemHeadline } from "@/lib/content/headline";
import type { Headline } from "@/lib/content/headline";
import { buildGlyphItem, buildItem } from "@/lib/content/build-item";
import type { ContentItem } from "@/lib/content/item";
import { lessonSteps } from "@/lib/lesson-steps";
import type { LessonStep } from "@/lib/lesson-steps";
import type { LessonItem } from "@/lib/lesson-items";
import { weakestFacts as weakestFactsOf } from "@/lib/decks";
import { characterEntryPayload } from "@/lib/library/character-entry-content";
import type { CharacterEntryPayload } from "@/lib/library/character-entry-content";
import type { SavedList } from "@/types";
import { KINDS as ALL_KINDS_INDEX, LIB_ENTRIES } from "@/lib/library/library-index";
import type { Kind } from "@/lib/library/kinds";
import { shelfSections as shelfSectionsOf } from "@/lib/library/shelf-sections";
import type { ShelfSection } from "@/lib/library/shelf-view";
import { search, searchByType } from "@/lib/library/search";
import { activeWeaknessPairs } from "@/lib/confusions";
import { entryIsKnown, entryStanding, standingOf, type Standing } from "@/lib/library/standing";
import type { StatusFilter } from "@/lib/library/url-state";
import type { Claims } from "@/lib/claims";
import type { FactAggregate } from "@/types";
import { unstable_cache } from "next/cache";
import { CURRICULUM_VERSION, learnIndexSnapshot } from "@/lib/content/learn-index";
import type { LearnIndex } from "@/lib/content/learn-index-types";

/* -------------------------------------------------------------------------
 * /LEARN HOME FEED — SAK-115. home-feed.tsx (its per-track frontier) and
 * current-sessions.tsx (trackKeyForRun) both used to import learn-index.ts's
 * scheduling functions directly. Those functions run reactively against a
 * live, frequently-changing `history` (a session round, a claim) — a round
 * trip per call would be both slow and a poor fit for useServerLookup's
 * persistent no-invalidation cache (use-server-lookup.ts's own header), which
 * assumes a (fn, args) pair is fetched once and never varies. So instead of
 * wrapping the history-taking functions themselves, this ships the build-fixed
 * INDEX DATA those functions need — exactly like getLibraryShelves — ONCE,
 * cached forever, and the client runs the walk itself (learn-scheduler.ts,
 * which is plain, unguarded code parameterized over this snapshot instead of
 * closing over learn-index.ts's module-scope INDEX). */

/** The whole precomputed /learn index, fetched once and cached client-side
 * (EMPTY_ARGS, like getLibraryShelves) — see this section's header. */
export async function getLearnIndexData(): Promise<LearnIndex> {
  return learnIndexSnapshot();
}

/* -------------------------------------------------------------------------
 * LIBRARY BROWSE/SEARCH — SAK-104's hardest case. library-page.tsx (the full
 * ~15,639-entry search-as-you-type + browse-by-shelf reference page) used to
 * import the raw index directly; it still needs the same data, just fetched
 * through these actions instead of bundled. The Known/Not-known/standing
 * FILTER ("keep" in library-page.tsx) stays a CLIENT-SIDE predicate, exactly
 * as before — these actions attach each returned entry's `knownFacts` (the
 * one piece of guarded data `keep` needs) so the client can keep computing it
 * with zero extra round trips per keystroke. See known-mark.ts: knownFacts is
 * ONLY ever used for that filter, never painted per-tile, so this is the
 * whole of what a client caller needs alongside the display fields already on
 * IndexLibEntry. ------------------------------------------------------- */

export type BrowseEntry = IndexLibEntry & { readonly knownFacts: readonly FactId[] };

function withKnown(entry: IndexLibEntry): BrowseEntry {
  return { ...entry, knownFacts: knownFactsOfIndex(entry) };
}

/** A ShelfSection whose entries carry `knownFacts` — see BrowseEntry above. */
export interface BrowseShelfSection extends Omit<ShelfSection, "entries"> {
  readonly entries: readonly BrowseEntry[];
}

// Fast-path only: reused when the SAME warm serverless instance serves a
// second getLibraryShelves() call before unstable_cache's own read completes
// a round trip to Vercel's Data Cache. It is NOT the cross-invocation cache
// anymore — this app runs on Vercel's default Node serverless runtime
// (Hobby tier, no vercel.json, no Edge Functions), so cold starts and
// multi-instance scaling mean a module-scope Map is empty far more often
// than warm, and never shared across instances at all. unstable_cache below
// is what actually persists the computed shelves across invocations/cold
// starts; this Map just skips re-deriving them within one still-warm
// instance. Cheap to keep, safe to delete if it ever gets in the way.
const SHELF_CACHE = new Map<string, BrowseShelfSection[]>();
function shelfSectionsFor(k: Kind): BrowseShelfSection[] {
  let v = SHELF_CACHE.get(k);
  if (!v) {
    v = shelfSectionsOf(k, "everyday").map((s) => ({
      ...s,
      entries: s.entries.map((e) => withKnown(e as IndexLibEntry)),
    }));
    SHELF_CACHE.set(k, v);
  }
  return v;
}

function computeLibraryShelves(): Record<string, BrowseShelfSection[]> {
  const out: Record<string, BrowseShelfSection[]> = {};
  for (const k of ALL_KINDS_INDEX) out[k as unknown as string] = shelfSectionsFor(k as Kind);
  return out;
}

// Keyed by CURRICULUM_VERSION (a build-time content hash, learn-index.ts) so
// a new deploy with different content naturally gets a fresh Data Cache
// entry instead of serving a stale one forever — no revalidate/tag-based
// invalidation needed, the key itself changes when the content does.
const cachedLibraryShelves = unstable_cache(
  async () => computeLibraryShelves(),
  ["getLibraryShelves", CURRICULUM_VERSION],
  { tags: ["library-shelves"] },
);

/** Every kind's shelf sections, in one round trip — the browse view needs all
 * of them anyway (to decide, via allTabBrowseKinds, which subjects still have
 * something to show under the current filter), so one batched call replaces
 * what used to be a bundled import. The ~15,640-entry computation is cached
 * in Vercel's Data Cache via unstable_cache (SAK-110), keyed by
 * CURRICULUM_VERSION so it survives cold starts and is shared across
 * instances, not just memoized per warm process. */
export async function getLibraryShelves(): Promise<Record<string, BrowseShelfSection[]>> {
  return cachedLibraryShelves();
}

export interface BrowseHit {
  entry: BrowseEntry;
  why: string;
  score: number;
}
export interface BrowseSection {
  key: string;
  label: string;
  hits: BrowseHit[];
}

/** The single-kind search branch — richer sectioning by HOW you matched. No
 * `keep` passed in: the client applies its own status filter to the returned
 * hits afterward (see library-page.tsx), same result as filtering here since
 * `keep` is a pure per-entry skip with no other effect on search's own
 * ranking or section membership (search.ts's opts.keep is a plain `continue`
 * in the classify loop). */
export async function searchLibraryOneKind(
  q: string,
  kind: Kind,
  pinned: readonly string[],
): Promise<BrowseSection[]> {
  return search(q, {
    kind,
    pinned: new Set(pinned),
    perSection: Number.MAX_SAFE_INTEGER,
  }).map((s) => ({
    key: s.why as string,
    label: s.label,
    hits: s.hits.map((h) => ({
      entry: withKnown(h.entry as unknown as IndexLibEntry),
      why: h.why as string,
      score: h.score,
    })),
  }));
}

/** The multi/every-kind search branch — All-tab style, bucketed by subject.
 * Returns every kind's section (the client filters down to checked kinds
 * afterward, same as the old `.filter((s) => kinds.has(s.kind))`). */
export async function searchLibraryByType(
  q: string,
  pinned: readonly string[],
): Promise<(BrowseSection & { kind: Kind })[]> {
  return searchByType(q, {
    pinned: new Set(pinned),
    perSection: Number.MAX_SAFE_INTEGER,
  }).map((s) => ({
    key: s.kind as unknown as string,
    kind: s.kind as unknown as Kind,
    label: s.label,
    hits: s.hits.map((h) => ({
      entry: withKnown(h.entry as unknown as IndexLibEntry),
      why: h.why as string,
      score: h.score,
    })),
  }));
}

/** The active weakness-pair entries (the Status dropdown's "Mix-ups" option) —
 * factEntryOf reads the server-only fact registry, so this fold moved here.
 * Depends only on `history`/`graduateRuns`, not per-keystroke state, so
 * library-page.tsx calls it once per history/config change, not per render. */
export async function getActiveMixupEntries(
  history: HistoryFile,
  graduateRuns: number,
): Promise<string[]> {
  const entries = new Set<string>();
  for (const pair of activeWeaknessPairs(history, graduateRuns, factEntryOfIndex)) {
    entries.add(pair.a);
    entries.add(pair.b);
  }
  return [...entries];
}

function statusPredicateServer(
  value: StatusFilter,
  liveFacts: Record<string, FactAggregate>,
  claims: Claims,
  now: number,
  activeMixupEntries: ReadonlySet<string>,
): (entry: IndexLibEntry) => boolean {
  if (value === "known" || value === "unknown") {
    const wantKnown = value === "known";
    return (entry) =>
      entryIsKnown(
        entryStanding(knownFactsOfIndex(entry), liveFacts as Record<FactId, FactAggregate>, claims, now),
      ) === wantKnown;
  }
  if (value === "mixup") {
    return (entry) => activeMixupEntries.has(entry.id as unknown as string);
  }
  const wanted: Standing = value;
  return (entry) =>
    knownFactsOfIndex(entry).some(
      (fact) =>
        standingOf(liveFacts[fact as unknown as string], claims[fact], now).standing === wanted,
    );
}

/** The default "Everything" slice — every entry in the library, or (a status
 * filter checked) every entry matching one, with no kind restriction and no
 * selection. The one place this page still needs the FULL entry list rather
 * than whichever kinds are on screen, so it gets its own action instead of
 * unioning the (lazily fetched, not-necessarily-complete) shelf data. */
export async function getEverythingSlice(
  states: readonly StatusFilter[],
  everyStateChecked: boolean,
  liveFacts: Record<string, FactAggregate>,
  claims: Claims,
  now: number,
  activeMixupEntryIds: readonly string[],
): Promise<EntryId[]> {
  if (everyStateChecked) return LIB_ENTRIES.map((e) => e.id);
  const activeSet = new Set(activeMixupEntryIds);
  const predicates = states.map((v) =>
    statusPredicateServer(v, liveFacts, claims, now, activeSet),
  );
  return LIB_ENTRIES.filter((e) => predicates.some((p) => p(e))).map((e) => e.id);
}

export async function getLibEntry(id: EntryId): Promise<IndexLibEntry | null> {
  return libEntryOf(id) ?? null;
}

/** href + glyph for a single entry id — GlyphLink's whole data need. */
export async function getGlyphLink(
  id: EntryId,
): Promise<{ href: string; glyph: string } | null> {
  const e = libEntryOf(id);
  return e ? { href: entryHref(id), glyph: e.glyph } : null;
}

export async function resolveEntries(
  ids: readonly EntryId[],
): Promise<Record<string, IndexLibEntry>> {
  const out: Record<string, IndexLibEntry> = {};
  for (const id of ids) {
    const e = libEntryOf(id);
    if (e) out[id as unknown as string] = e;
  }
  return out;
}

export async function getEntryHref(id: EntryId): Promise<string> {
  return entryHref(id);
}

export async function getTermHref(id: string): Promise<string> {
  return termHref(id);
}

export async function getEntryName(id: EntryId): Promise<string | null> {
  const e = libEntryOf(id);
  return e ? libEntryName(e) : null;
}

/** id -> {href, name}, batched — the shape most link rows need together. */
export async function resolveEntryLinks(
  ids: readonly EntryId[],
): Promise<Record<string, { href: string; name: string }>> {
  const out: Record<string, { href: string; name: string }> = {};
  for (const id of ids) {
    const e = libEntryOf(id);
    if (!e) continue;
    out[id as unknown as string] = { href: entryHref(id), name: libEntryName(e) };
  }
  return out;
}

export async function getRecipeOf(id: EntryId): Promise<Recipe | null> {
  return recipeOfIndex(id);
}

export async function getRecipesOf(id: EntryId): Promise<readonly Recipe[]> {
  return recipesOfIndex(id);
}

export async function getKanaConfusables(glyph: string): Promise<EntryId[]> {
  return kanaConfusablesOf(glyph);
}

export async function getStrokeFallback(
  glyph: string,
): Promise<{ normal: StrokeFallback; reference: StrokeFallback } | null> {
  return precomputedStrokeFallbackOf(glyph) ?? null;
}

export async function getUsedAsPartIn(component: string): Promise<readonly string[]> {
  return usedAsPartInIndex(component);
}

export async function getKnownWordsUsing(
  component: string,
  history: HistoryFile,
): Promise<readonly string[]> {
  return knownWordsUsingIndex(component, history);
}

export async function getKnownFactsOf(id: EntryId): Promise<readonly FactId[]> {
  return knownFactsOfIndex(id);
}

export async function getFactEntryOf(fact: FactId): Promise<EntryId> {
  return factEntryOfIndex(fact);
}

export async function getEntryForGlyph(
  kind: string,
  glyph: string,
): Promise<EntryId | null> {
  // Kind is narrowed by the guarded function itself; this action's callers all
  // pass a `Kind` value already validated by the shared `Kind` type upstream.
  return entryForGlyphOf(kind as Parameters<typeof entryForGlyphOf>[0], glyph);
}

export async function getClaimableFacts(
  facts: readonly FactId[],
): Promise<FactId[]> {
  return claimableFactsOf(facts);
}

export async function getQuizzableFacts(
  facts: readonly FactId[],
  history: HistoryFile,
): Promise<FactId[]> {
  return quizzableFactsOf(facts, history);
}

export async function getVocabRow(keb: string): Promise<VocabRow | null> {
  return vocabRow(keb) ?? null;
}

export async function getLegacyUnqualifiedReading(
  glyph: string,
): Promise<string | null> {
  return legacyUnqualifiedReading(glyph);
}

export async function getFactInfo(id: FactId): Promise<FactInfo | null> {
  return factInfo(id) ?? null;
}

export async function getEntryOfFact(id: FactId): Promise<EntryId> {
  return entryOf(id);
}

export async function getFactsOf(entry: EntryId): Promise<FactId[]> {
  return factsOf(entry);
}

export async function getGlyphOfEntry(entry: EntryId): Promise<string> {
  return glyphOf(entry);
}

/** An in-progress run as a FIXED list of its material — the entryOf fold moved
 * here (SAK-104) since it needs the server-only fact registry. Null if empty. */
export async function fixedRunList(
  runId: string,
  name: string,
  facts: readonly FactId[],
): Promise<SavedList | null> {
  const entries = [...new Set(facts.map((f) => entryOf(f)))];
  if (!entries.length) return null;
  return {
    kind: "fixed",
    id: `run-${runId}`,
    name,
    created: Date.now(),
    entries,
    origin: "manual",
  };
}

/** KanaEntryView's whole auxiliary data need, batched: the shape-lookalike ids
 * for this glyph, the stroke fallback, and {label, href, glyph} for whatever
 * candidate related-entry ids the caller already worked out (row/yoonRow's
 * base, mark, term — all pure id builders, computed client-side). */
export async function getKanaAux(
  glyph: string,
  relatedIds: readonly EntryId[],
): Promise<{
  kanaConfusableIds: EntryId[];
  strokeFallback: { normal: StrokeFallback; reference: StrokeFallback } | null;
  related: Record<string, { label: string; href: string; glyph: string }>;
}> {
  const kanaConfusableIds = [...kanaConfusablesOf(glyph)];
  const strokeFallback = precomputedStrokeFallbackOf(glyph) ?? null;
  const related: Record<string, { label: string; href: string; glyph: string }> = {};
  for (const id of relatedIds) {
    const e = libEntryOf(id);
    if (e) related[id as unknown as string] = { label: libEntryName(e), href: entryHref(id), glyph: e.glyph };
  }
  return { kanaConfusableIds, strokeFallback, related };
}

/** Batched display info for a set of facts — one round trip per deck/breakdown
 * instead of one per fact. */
export async function resolveFactInfos(
  ids: readonly FactId[],
): Promise<Record<string, FactInfo>> {
  const out: Record<string, FactInfo> = {};
  for (const id of ids) {
    const info = factInfo(id);
    if (info) out[id as unknown as string] = info;
  }
  return out;
}

/** The primitive/component-uses panel's whole data need in one round trip:
 * which kanji use this component, their hrefs, and which of the reader's known
 * words use it. */
export async function getComponentUses(
  component: string,
  history: HistoryFile,
): Promise<{ kanji: string[]; hrefs: Record<string, string>; known: readonly string[] }> {
  const kanji = usedAsPartInIndex(component);
  const hrefs: Record<string, string> = {};
  for (const c of kanji) hrefs[c] = entryHref(kanjiEntryFor(c));
  const known = knownWordsUsingIndex(component, history);
  return { kanji: [...kanji], hrefs, known };
}

/** library-page.tsx's "a selection was built" slice bar branch —
 * selection.ts's own `selectionSlice`, just handed the real LIB_ENTRIES here
 * instead of the page's own bundled copy, so the returned id order is still
 * canonical library order (not Set-insertion order) exactly as before. */
export async function getSelectionSlice(
  ids: readonly EntryId[],
): Promise<{ label: string; entries: EntryId[] }> {
  const set = new Set(ids);
  const entries = LIB_ENTRIES.filter((e) => set.has(e.id)).map((e) => e.id);
  return { label: `${entries.length} selected`, entries };
}

/* -------------------------------------------------------------------------
 * STATS PAGE (Progress's "By subject") — SAK-104. by-subject.tsx's module
 * scope used to walk ALL_FACTS via factInfo/entryOf (facts.ts, guarded) to
 * build one Subject per scheduled subject, split Words into
 * words/numbers/counters (factType, counterForm/isBareNumber — data/
 * counters.ts, itself guarded via facts.ts) and Kana into hiragana/katakana,
 * then grouped the result into the page's Vocabulary/Counting/Kana rows. None
 * of that depends on the reader's own history — it's the identical static
 * walk for every visitor — so it moves here as one action, computed once and
 * cached for the server process's lifetime (same pattern as SHELF_CACHE
 * above). The client keeps only what DOES depend on the reader: met counts,
 * standing, and the row labels (SUBJECT_LABEL, a plain string table with no
 * guarded dependency of its own — see by-subject.tsx). ------------------- */

export interface StatsSubject {
  readonly id: string;
  readonly facts: readonly FactId[];
  readonly entries: readonly EntryId[];
  /** entry -> its facts, within this subject's own population only — built
   * once per Subject (top-level or a split-off child, Hiragana/Numbers/…)
   * rather than read from one shared registry keyed by top-level subject id.
   * A plain object (not a Map) so it survives the Server Action boundary the
   * same way every other batched action here returns its rows. */
  readonly entryFacts: Readonly<Record<string, readonly FactId[]>>;
}

export type StatsRow =
  | { kind: "subject"; subject: StatsSubject }
  | { kind: "group"; label: string; children: StatsSubject[] };

export interface StatsData {
  rows: StatsRow[];
  /** SENTENCE_ORDERING_TIERS.length — the one other piece of the page's
   * module-scope data that reached a guarded module (data/assembly.ts, via
   * its own factInfo import), needed only as a count. */
  sentenceTierCount: number;
}

function buildStatsSubject(id: string, facts: FactId[]): StatsSubject {
  const entryFacts: Record<string, FactId[]> = {};
  const entries: EntryId[] = [];
  for (const f of facts) {
    const e = entryOf(f) as unknown as string;
    const list = entryFacts[e];
    if (list) list.push(f);
    else {
      entryFacts[e] = [f];
      entries.push(e as unknown as EntryId);
    }
  }
  return { id, facts, entries, entryFacts };
}

/** The two bare-number generative categories ("Numbers 1-99", "Numbers
 * 100-9999") — the only construction categories with no counter attached.
 * Every other category is a real counter. See by-subject.tsx's original
 * comment (git history) for the full reasoning; unchanged by this move. */
const NUMBER_CATEGORY_ENTRIES: ReadonlySet<EntryId> = new Set([
  numberConstructionEntry("tens"),
  numberConstructionEntry("big"),
]);

function isCountingNumberEntry(entry: EntryId): boolean {
  if (NUMBER_CATEGORY_ENTRIES.has(entry)) return true;
  const form = counterForm(entry);
  return form !== undefined && isBareNumber(form);
}

// Not exported: this is a "use server" file, and Next only allows async
// function exports from one (a plain const export would break the build).
// by-subject.tsx's SUBJECT_LABEL duplicates these same 4 literal ids.
const COUNTING_NUMBERS_ID = "counting-numbers";
const COUNTING_COUNTERS_ID = "counting-counters";
const KANA_HIRAGANA_ID = "kana-hiragana";
const KANA_KATAKANA_ID = "kana-katakana";

function splitWordSubject(
  subject: StatsSubject,
): { words: StatsSubject; numbers: StatsSubject; counters: StatsSubject } {
  const wordFacts: FactId[] = [];
  const numberFacts: FactId[] = [];
  const counterFacts: FactId[] = [];
  for (const f of subject.facts) {
    if (factType(f) !== "counter") {
      wordFacts.push(f);
      continue;
    }
    (isCountingNumberEntry(entryOf(f)) ? numberFacts : counterFacts).push(f);
  }
  return {
    words: buildStatsSubject(subject.id, wordFacts),
    numbers: buildStatsSubject(COUNTING_NUMBERS_ID, numberFacts),
    counters: buildStatsSubject(COUNTING_COUNTERS_ID, counterFacts),
  };
}

function splitKanaSubject(
  subject: StatsSubject,
): { hiragana: StatsSubject; katakana: StatsSubject } {
  const hiraganaFacts = subject.facts.filter((f) => factType(f) === "hiragana");
  const katakanaFacts = subject.facts.filter((f) => factType(f) === "katakana");
  return {
    hiragana: buildStatsSubject(KANA_HIRAGANA_ID, hiraganaFacts),
    katakana: buildStatsSubject(KANA_KATAKANA_ID, katakanaFacts),
  };
}

const VOCABULARY_CHILD_IDS: readonly string[] = [RADICAL_SUBJECT, KANJI_SUBJECT, VOCAB_SUBJECT];

let STATS_DATA_CACHE: StatsData | null = null;

/** Every row Progress's "By subject" table renders, in display order — see
 * this section's header for why this can be computed once and cached rather
 * than per-request. */
export async function getStatsRows(): Promise<StatsData> {
  if (STATS_DATA_CACHE) return STATS_DATA_CACHE;

  const byId = new Map<string, FactId[]>();
  const order: string[] = [];
  for (const f of ALL_FACTS) {
    const id = factInfo(f)?.subject;
    if (!id) continue;
    let list = byId.get(id);
    if (!list) {
      list = [];
      byId.set(id, list);
      order.push(id);
    }
    list.push(f);
  }
  const subjects = order.map((id) => buildStatsSubject(id, byId.get(id)!));

  const rows: StatsRow[] = [];
  let vocabularyChildren: StatsSubject[] | null = null;
  for (const s of subjects) {
    if (s.id === KANA_SUBJECT) {
      const { hiragana, katakana } = splitKanaSubject(s);
      rows.push({ kind: "group", label: "Kana", children: [hiragana, katakana] });
      continue;
    }
    if (s.id === VOCAB_SUBJECT) {
      const { words, numbers, counters } = splitWordSubject(s);
      if (!vocabularyChildren) {
        vocabularyChildren = [];
        rows.push({ kind: "group", label: "Vocabulary", children: vocabularyChildren });
      }
      vocabularyChildren.push(words);
      rows.push({ kind: "group", label: "Counting", children: [numbers, counters] });
      continue;
    }
    if (VOCABULARY_CHILD_IDS.includes(s.id)) {
      if (!vocabularyChildren) {
        vocabularyChildren = [];
        rows.push({ kind: "group", label: "Vocabulary", children: vocabularyChildren });
      }
      vocabularyChildren.push(s);
      continue;
    }
    rows.push({ kind: "subject", subject: s });
  }

  STATS_DATA_CACHE = { rows, sentenceTierCount: SENTENCE_ORDERING_TIERS.length };
  return STATS_DATA_CACHE;
}

/* -------------------------------------------------------------------------
 * STATS SIDE PANELS — entry-breakdown.tsx and bucket-breakdown.tsx render a
 * list of entries/facts a by-subject.tsx click already resolved; each row
 * still needs a guarded lookup (name/detail/href for an entry, glyph/meaning/
 * href for a fact), batched into one round trip per panel open rather than
 * one request per row. ------------------------------------------------- */

export interface EntryBreakdownRow {
  name: string;
  detail: string | null;
  href: string;
}

/** entry-breakdown.tsx's whole per-row data need, batched. Mirrors that
 * file's own `displayName`/`entryDetail` exactly (see its header for why
 * sentence-rule marks read `sub` instead of `subLabel`). */
export async function getEntryBreakdownRows(
  ids: readonly EntryId[],
): Promise<Record<string, EntryBreakdownRow>> {
  const out: Record<string, EntryBreakdownRow> = {};
  for (const id of ids) {
    const entry = libEntryOf(id);
    let name: string;
    let detail: string | null;
    if (entry) {
      name = libEntryName(entry);
      if (entry.kind === SENTENCE_RULE_KIND) {
        detail = entry.sub || null;
      } else {
        const label = subLabel(entry);
        detail = label === "—" ? null : label;
      }
    } else {
      name = glyphOf(id);
      const firstFact = factsOf(id)[0];
      detail = firstFact ? (factInfo(firstFact)?.meaning ?? null) : null;
    }
    out[id as unknown as string] = { name, detail, href: entryHref(id) };
  }
  return out;
}

export interface BucketBreakdownRow {
  glyph: string;
  meaning: string | null;
  href: string;
}

/** bucket-breakdown.tsx's whole per-row data need, batched. A fact id history
 * kept but the data no longer has is simply absent from the result — the
 * caller renders the bare id, the same courtesy factInfo's own callers already
 * extend it. */
export async function getBucketBreakdownRows(
  facts: readonly FactId[],
): Promise<Record<string, BucketBreakdownRow>> {
  const out: Record<string, BucketBreakdownRow> = {};
  for (const id of facts) {
    const info = factInfo(id);
    if (!info) continue;
    out[id as unknown as string] = {
      glyph: info.glyph,
      meaning: info.meaning,
      href: entryHref(info.entry),
    };
  }
  return out;
}

/* -------------------------------------------------------------------------
 * LIVE QUIZ/SESSION CLUSTER — SAK-104. drill-screen.tsx and its siblings hold
 * the CURRENT LEG's fact set (active.facts, frozen at Start — see
 * quiz-session.tsx) client-side for the run's lifetime, so the batched actions
 * below are fetched ONCE per leg (or once per new question, for the MC-option
 * facts a subject's distractor pool draws from outside that frozen set) into a
 * local map the hot per-question render path then reads synchronously — never
 * a server round trip while a question is on screen. See drill-screen.tsx's
 * own header for why this cluster keeps its zero-latency contract. ------- */

/** Batched vocabRow lookups by keb (word spelling) — the word-pitch/reading
 * display path (promptPitch/revealPitch in drill-screen.tsx, the
 * substitution screen's hint gloss) all key off a fact's OWN glyph, so this is
 * fetched for a small, already-known set of kebs, never an open-ended one. */
export async function resolveVocabRows(
  kebs: readonly string[],
): Promise<Record<string, VocabRow>> {
  const out: Record<string, VocabRow> = {};
  for (const keb of [...new Set(kebs)]) {
    const row = vocabRow(keb);
    if (row) out[keb] = row;
  }
  return out;
}

/** Batched legacyUnqualifiedReading lookups by keb — paired with
 * resolveVocabRows for the same pitch-display call sites. */
export async function resolveLegacyUnqualifiedReadings(
  kebs: readonly string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const keb of [...new Set(kebs)]) out[keb] = legacyUnqualifiedReading(keb);
  return out;
}

/** Which of `facts` are word READING facts (vs meaning, vs a non-word fact) —
 * WORD_READING_FACTS is a module-scope Set inside the guarded vocab.ts, so
 * membership is resolved here once per leg for the leg's whole fact pool,
 * rather than importing the set directly. */
export async function getWordReadingFactSet(
  facts: readonly FactId[],
): Promise<FactId[]> {
  return facts.filter((f) => isWordReadingFact(f));
}

/** WordsWith's whole per-word data need, batched by GLYPH (the word's own
 * spelling, not an id it doesn't have yet) — the entry id (if the vocabulary
 * teaches this spelling as a word), its href, its primary reading (pitch-
 * annotatable only when pitchReadingCompatible), and up to two glosses. */
export interface WordLinkRow {
  readonly id: EntryId;
  readonly href: string;
  readonly reading: string | null;
  readonly pitchCompatible: boolean;
  readonly meanings: readonly string[];
}

export async function resolveWordLinksByGlyph(
  glyphs: readonly string[],
): Promise<Record<string, WordLinkRow>> {
  const out: Record<string, WordLinkRow> = {};
  for (const g of [...new Set(glyphs)]) {
    const id = entryForGlyphOf(VOCAB_SUBJECT as Parameters<typeof entryForGlyphOf>[0], g);
    if (!id) continue;
    const entry = libEntryOf(id);
    if (!entry) continue;
    out[g] = {
      id,
      href: entryHref(id),
      reading: entry.readings[0] ?? null,
      pitchCompatible: pitchReadingCompatibleOf(g),
      meanings: entry.meanings,
    };
  }
  return out;
}

/** how-its-written.tsx's whole-shape parts fallback — each part is a single
 * kanji glyph; this resolves the small (2-4 element) breakdown to its href in
 * one round trip. */
export async function resolveKanjiPartLinks(
  chars: readonly string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const c of [...new Set(chars)]) out[c] = entryHref(kanjiEntryFor(c));
  return out;
}

/** app/session/page.tsx's teach-set header label — "Word", "Kanji", "Keigo
 * set", … for the first fact of a teach set. subjectLabel (library/entries.ts)
 * reads the guarded FactInfo shape, so this is the one round trip the session
 * header needs. */
export async function getTeachSubjectLabel(
  fact: FactId,
): Promise<string | undefined> {
  return subjectLabelOf(factInfo(fact));
}

/** Batched TTS text (`speechForFact`) for a set of facts — the drill screen's
 * listening-card autoplay and its "hear it again" speaker both want it for
 * the CURRENT showing's fact, always a member of the leg's own pool
 * (active.facts, frozen at Start), so it is fetched alongside factInfo for
 * that same bounded set. speechForFact itself reads several guarded subject
 * modules (keigoWordInfo, wordReadingUnit, …), not just factInfo's own shape,
 * which is why it needs its own round trip rather than being derived
 * client-side from resolveFactInfos's result. */
export async function resolveSpeechForFacts(
  facts: readonly FactId[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of facts) {
    const info = factInfo(id);
    if (!info) continue;
    const text = speechForFact(info);
    if (text) out[id as unknown as string] = text;
  }
  return out;
}

// RESULTS SCREEN — SAK-104 (Chain B, results-view.tsx/results/page.tsx).
//
// results-view.tsx used to import `entryOf`/`factsOf` from lib/facts.ts
// directly and pass `entryOf` on as a synchronous callback into
// confusions.ts's already-DI-friendly `analyzeRun`/`pairRecentRuns` (see
// lib/confusions.ts's own `EntryOf` type). The set of facts either function
// could ever ask about is bounded — every fact key across this run's own
// stats plus every past session's recorded detail, all already sitting in
// `history` client-side — so it batches exactly like drill-screen.tsx's
// pool: one round trip for the whole known set, then a synchronous local
// wrapper (`id => map[id] ?? id`, the same "unknown id answers itself"
// fallback lib/facts.ts's own entryOf documents) stands in for the import.
// factsOf(entry) is looked up the same batched way for the small, always-
// on-screen set of confusion-pair entries.
export async function resolveFactsOfEntries(
  entries: readonly EntryId[],
): Promise<Record<string, FactId[]>> {
  const out: Record<string, FactId[]> = {};
  for (const e of [...new Set(entries)]) out[e as unknown as string] = [...factsOf(e)];
  return out;
}

/** weakestFacts (lib/decks.ts) is a pure function of a whole HistoryFile plus
 * a timestamp/count — it filters `history.facts` through the same
 * dictionary-existence check (`factsOf(entryOf(f)).length`) resolveFactsOf-
 * Entries's siblings use, then ranks. Nothing about it is per-item or
 * unbounded, so it moves whole rather than being decomposed into a batched
 * client-side loop. */
export async function resolveWeakestFacts(
  history: HistoryFile,
  now: number,
  n: number,
): Promise<FactId[]> {
  return weakestFactsOf(history, now, n);
}

/** characterEntryPayload (lib/library/character-entry-content.ts) derives a
 * single Han glyph's whole display payload from a plain, already-built
 * ContentItem — the same "item carries no dictionary dependency, one
 * function reading it does" shape as resolveItemHeadline above. The teach
 * walk's live adapter (live-character-entry-view.tsx) is this function's
 * only caller left importing it directly; the Library route already reaches
 * the same payload by id through useContentEntry/content-entries.ts. */
export async function resolveCharacterEntryPayload(
  item: ContentItem,
): Promise<CharacterEntryPayload> {
  return characterEntryPayload(item);
}

/** One row of ConfusionSection's "commonly mixed up with" / "you've mixed up
 * with" tiles (confusion-section.tsx) — glyph, one gloss, and the link, batch-
 * resolved for the whole (always small — shape lookalikes) confusables/
 * confused set in one call instead of one libEntry/entryHref pair per tile. */
export interface ConfusableRowData {
  readonly glyph: string;
  readonly gloss: string;
  readonly href: string;
}

/** Just the URL for a batch of entries — for callers (like PatternFamily)
 * that already mint the EntryId themselves off a pure, unguarded id-builder
 * (patternEntry is `entryId(GRAMMAR_SUBJECT, recipeId)`, no dictionary read)
 * and only need entryHref's own SOURCE-DATA-backed slug lookup. */
export async function resolveHrefs(
  ids: readonly EntryId[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of [...new Set(ids)]) out[id as unknown as string] = entryHref(id);
  return out;
}

export async function resolveConfusableRows(
  ids: readonly EntryId[],
): Promise<Record<string, ConfusableRowData>> {
  const out: Record<string, ConfusableRowData> = {};
  for (const id of [...new Set(ids)]) {
    const e = libEntryOf(id);
    if (!e) continue;
    out[id as unknown as string] = {
      glyph: e.glyph,
      gloss: e.meanings[0] ?? e.readings[0] ?? "",
      href: entryHref(id),
    };
  }
  return out;
}

// TEACH WALK / LIVE-ITEM ENTRY VIEWS — SAK-104 (Chain A).
//
// itemHeadline (lib/content/headline.ts) reads factInfo/kanjiRow off a plain,
// already-built ContentItem — the item itself carries no dictionary
// dependency (see lib/content/item.ts), only this ONE function does — so the
// live adapters (live-item-entry-views.tsx) fetch the headline for an item
// they already hold instead of importing the guarded module.
export async function resolveItemHeadline(item: ContentItem): Promise<Headline> {
  return itemHeadline(item);
}

/** buildGlyphItem/buildItem (lib/content/build-item.ts) assemble a
 * ContentItem for one teach-walk step. The teach walk (teach-item-view.tsx)
 * used to call them directly, synchronously, branching on the step's
 * LessonKind the same way this function does — that branch (which builder,
 * which ContentKind) moves here verbatim so the client keeps only the
 * RENDERER choice, not the dictionary read. dev/views/page.tsx, the only
 * other caller, is a Server Component and keeps calling the builders
 * directly — no client-bundle concern there. */
export async function resolveTeachItem(item: LessonItem): Promise<ContentItem | null> {
  switch (item.kind) {
    case "kana":
      return buildItem(item.entry, "kana") ?? null;
    case "radical":
    case "kanji":
      return buildGlyphItem(item.glyph) ?? null;
    case "word":
      if (numberConstructionFor(item.entry)) {
        return buildItem(item.entry, "generative-rule") ?? null;
      }
      if (COUNTER_ENTRIES.has(item.entry)) return buildItem(item.entry, "counter") ?? null;
      return buildItem(item.entry, "word") ?? null;
    case "grammar":
      return buildItem(item.entry, "grammar") ?? null;
    case "transitivity":
      return buildItem(item.entry, "transitivity") ?? null;
    case "keigo":
      return buildItem(item.entry, "keigo") ?? null;
  }
}

/** lessonSteps (lib/lesson-steps.ts) reads factInfo/vocabRow/etc transitively
 * (itemsFromFacts → lib/facts.ts, and its own kanji/vocab imports). Both
 * callers (teach-walk.tsx, app/session/page.tsx) already compute the whole
 * teach set's steps once per lesson via useMemo — this is that same "compute
 * once per lesson" call, just an async round trip instead of a sync
 * function. `shownIntros` crosses the Server Action boundary as a plain
 * array (a Set does not survive JSON serialization) and is rebuilt here. */
export async function resolveLessonSteps(
  facts: readonly FactId[],
  history: HistoryFile | undefined,
  shownIntros: readonly string[],
): Promise<LessonStep[]> {
  return lessonSteps(facts, history, new Set(shownIntros));
}
