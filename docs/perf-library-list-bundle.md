# Perf: get the ~9.5MB curriculum dictionary off `/library`'s list/search page

**Status:** implemented, verified, ready to commit. Follow-on to `docs/perf-learn-bundle.md` (Phase 1, `/learn`). This is Phase 2a of that doc's plan — but the plan changed shape mid-implementation; see below.

---

## What this actually is, vs. the original plan

The original Phase 2 (in `perf-learn-bundle.md`) called for moving the content dictionary + Library meaning-search to **Supabase**, fetched by ID. Partway into scoping that, a cheaper alternative surfaced: `/library`'s list/search page doesn't need a database at all — it needs the same **precompute** pattern Phase 1 already proved for `/learn`. No infra, no schema, no seed script.

That pivot was approved and is what shipped. **Supabase was never touched.** It remains exactly Phase 2's plan for a *different, still-open* piece — see "What's still deferred" below.

## Root cause

`/library`'s list/search page pulled the full ~9.5MB dictionary (`word-definitions.json` 4.4MB + `cejc-reading-frequency.json` 3.1MB + `vocab.json` 2.9MB) not through one barrel but through **~15 separate files**, each exhibiting the same pattern: a small, pure, content-free function (an id builder, a subject-name constant, a rank number) declared in the *same file* as a heavy top-level import. Since ES modules are bundled as whole files, importing the pure function drags the heavy sibling in for free — tree-shaking can't drop a top-level `const X = heavyComputation()` that has observable side effects (Map/Set construction, etc.).

This is the same shape the codebase had already recognized once, in `facts.ts` → `fact-keys.ts`. It just recurred in `library/entries.ts`, `data/vocab.ts`, `data/kanji.ts`, `data/keigo.ts`, `data/grammar/index.ts`, `data/grammar-concepts.ts`, `lib/word-lesson.ts`, `lib/curriculum-order.ts`, `lib/word-unlock.ts`, and their consumers.

## What shipped

**New content-free modules** (no dictionary import, each with an equivalence test proving it matches its live twin):
- `src/lib/vocab-ids.ts` — `VOCAB_SUBJECT`, `wordEntry`, `wordMeaningFactId` (pure id builders)
- `src/lib/keigo-ids.ts` — `KEIGO_SUBJECT`
- `src/lib/word-rank.ts` + `scripts/build-word-rank.mjs` → `word-rank.json` — per-word `beginnerRank` and CEJC-curriculum membership (`isCurriculumWord`), used by `keigo.ts`'s set ordering and `transitivity-lesson.ts`'s pair gate
- `src/lib/library/library-index.ts` + `library-index-types.ts` + `scripts/build-library-index.mjs` → `library-index.json` (~4.3MB, mostly unavoidable — see below) — the big one:
  - `LIB_ENTRIES` / `LIB_ENTRIES_BY_KIND` / `libEntry(id)` — precomputed twin of `library/entries.ts`'s `LIB_ENTRIES` (search/list fields only: glyph, readings, meanings, sub, weight — **no etymology, no examples, no extended tables**)
  - `knownFactsOf(entry)`, `factsOf(entry)`, `factEntryOf(fact)` — precomputed twins of `knownFactsOf`/`factsOf`/`entryOf`
  - `entryForGlyph(kind, glyph)` — precomputed twin of `entries.ts`'s glyph resolver (kana/kanji/radical/primitive existence checks + vocab lookup via `LIB_ENTRIES`)
  - Small pure re-declarations: `KANJI_SUBJECT`, `COUNTER_KIND`, `NUMBER_CONSTRUCTION_KIND`, `SENTENCE_RULE_KIND`, `GRAMMAR_SUBJECT`, `GRAMMAR_CONCEPT_SUBJECT`, `patternEntry`, `grammarConceptEntry`, `verbAttachForm`, `entryName`
  - Serialized structural data: `kanjiGrade`, `kanjiTeachOrder` (3 fixed modes), `GRAMMAR_CONCEPT_IDS`, `FORM_LABEL` (hand-authored 21-entry map — serialized, never retyped), `grammarRank` (grammar teaching-order position)
  - `curriculumPosition` — reuses Phase 1's `CURRICULUM_GLYPHS` from `learn-index.json` rather than a third copy of the curriculum spine

**Rewired consumers** (swapped a live-content import for the content-free twin, function-for-function, zero behavior change): `library/search.ts`, `library/all-tab.ts`, `library/url-state.ts`, `library/href.ts`, `library/counter-shelf.ts`, `library/sub-label.ts`, `library/grammar-shelf.ts`, `library/kanji-shelf.ts`, `library/ranged-groups.ts`, `library/slice.ts`, `components/library/shelves.tsx`, `components/library/entry-tile.tsx`, `components/library/library-page.tsx`, `app/dev/library/page.tsx`.

**One genuine lazy-load** (not precomputable — needs live history at call time): `components/library/slice-bar.tsx` dynamically imports `lib/word-unlock.ts` (reading-anchor index, built from the full word list) only once the bar actually has a selection to act on — mirrors the `sentenceAssembly` lazy-load pattern from Phase 1's `home-feed.tsx`.

**One deliberate revert**: `data/grammar/lessons.ts`'s `factsOf`/`patternEntry` imports were briefly swapped to the content-free versions, then reverted. `lessons.ts` sits in the *build script's own* dependency chain (`grammar-order.ts` → `lessons.ts`, needed to precompute `grammarTeachingOrderIds`), so having it depend on the generated JSON it helps produce is a real bootstrap cycle, not just a style nit. It doesn't matter for `/library`'s bundle — nothing on that page's path reaches `lessons.ts` anymore (the one thing that did, `grammar-shelf.ts`'s `grammarRank`, now reads the precomputed order instead).

## Verification

- 33 new equivalence tests across `library-index.equiv.test.ts`, `ranged-groups.equiv.test.ts`, `word-rank.equiv.test.ts` — every precomputed value asserted equal to its live derivation, same discipline as Phase 1's `learn-index.equiv.test.ts`.
- `tsc --noEmit` clean.
- `npm test`: 3099/3099.
- Bundle: comprehensive sweep of **every route** confirms `/library` and `/learn` no longer reference any dictionary-signature chunk (>1MB, contains `beginnerRank`). `/library`'s footprint: ~9.5MB → 7.94MB across 15 chunks.

## Why the MB delta is more modest than `/learn`'s

`/learn` dropped ~9MB → 1.86MB (dictionary gone entirely) because scheduling only needs fact-ids, never glosses. `/library`'s list/search page is different: **search-by-meaning genuinely needs every word's short English gloss client-side** (there's no server round-trip per keystroke), so the precomputed `LIB_ENTRIES` twin still carries ~15,640 entries' `meanings` fields. The `entryFacts`/`factEntry`/`knownFacts` identity maps (spanning ~30,000 facts) add real bulk too. The win here is **architectural** — the *full* dictionary (long-form definitions, frequency tables, kanji reading-attestation logic) is gone, and future growth in entry-detail-only content can no longer leak onto the list page by accident.

## What's still deferred (not eliminated — genuinely separate work)

**Entry detail pages** (`/library/[...entry]`, `/library/primitive/[glyph]`) still carry the full dictionary, unchanged. This is **not** solved by more precomputing — a detail page needs the *entire* payload for **one specific entry** (etymology, examples, full reading tables, confusables, component graph), which is exactly the shape of workload where shipping everything to every visitor doesn't scale. Precompute works when the same small summary serves everyone; fetch-by-id is the right tool when each visit needs a large amount of *different* data. **Supabase (or an equivalent fetch-on-demand mechanism) is still the answer for this piece** — nothing in this session changed that. It was scoped, then explicitly deferred, not ruled out.

**Grading-critical routes** (`/session`, `/practice`, `/results`, `/stats`, `/current`, `/sessions`, `/lists`) still carry the dictionary. `factInfo` is read synchronously mid-render for quiz grading (accepted answers, glyphs) — converting that to fetch-by-id means introducing loading states into the grading path itself, a real architecture change, not a mechanical extraction. Explicitly out of scope from the start ("Phase 2b").

**Left alone on purpose**, not a gap: `/dev/scheduling` and `/dev/views` stay on the live content path — their documented purpose is to show the scheduler's/content's actual live output as an independent ground-truth check; precomputing them would either be redundant (equivalence already guaranteed) or actively mask a future drift bug.
