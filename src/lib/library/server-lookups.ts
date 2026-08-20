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
  precomputedStrokeFallback as precomputedStrokeFallbackOf,
  quizzableFacts as quizzableFactsOf,
  recipeOf as recipeOfIndex,
  recipesOf as recipesOfIndex,
  usedAsPartIn as usedAsPartInIndex,
} from "@/lib/library/library-index";
import { entryHref } from "@/lib/library/href";
import { termHref } from "@/lib/library/term-href";
import { entryOf, factInfo, factsOf, glyphOf } from "@/lib/facts";
import { vocabRow, legacyUnqualifiedReading } from "@/data/vocab";
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

/** Every kind's shelf sections, in one round trip — the browse view needs all
 * of them anyway (to decide, via allTabBrowseKinds, which subjects still have
 * something to show under the current filter), so one batched call replaces
 * what used to be a bundled import. Cached at module scope for the server
 * process's lifetime, same memoization the old client-side SHELF_CACHE gave,
 * just reached over a Server Action now. */
export async function getLibraryShelves(): Promise<Record<string, BrowseShelfSection[]>> {
  const out: Record<string, BrowseShelfSection[]> = {};
  for (const k of ALL_KINDS_INDEX) out[k as unknown as string] = shelfSectionsFor(k as Kind);
  return out;
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
