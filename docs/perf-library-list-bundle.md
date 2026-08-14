# Perf: get the ~9.5MB curriculum dictionary off `/library`'s list/search page

**Status:** Phase 2a (list/search page) shipped and merged. Phase 2b (entry-detail pages, below) is in progress: 9 of 10 content kinds migrated to fetch-by-id, `character` (kanji/radical/word) and a final dispatcher pass still to go. Follow-on to `docs/perf-learn-bundle.md` (Phase 1, `/learn`).

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

**Grading-critical routes** (`/session`, `/practice`, `/results`, `/stats`, `/current`, `/sessions`, `/lists`) still carry the dictionary. `factInfo` is read synchronously mid-render for quiz grading (accepted answers, glyphs) — converting that to fetch-by-id means introducing loading states into the grading path itself, a real architecture change, not a mechanical extraction. Explicitly out of scope from the start.

**`/library/primitive/[glyph]`** hasn't been touched by Phase 2b — not evaluated yet, not ruled out. See "Follow-up recommendations" below.

**`/dev/views`** stays on the live content path on purpose — it builds a live `ContentItem` for every kind it demonstrates deliberately, as a from-scratch second construction that the shared `*-entry-view` components can render two different ways (fetched-by-id and live) without drifting. Its call sites were updated as each kind migrated (passing `item` instead of `entry`) but the page itself was never meant to go content-free.

**`/dev/scheduling`** — the claim in an earlier revision of this doc that it "stays on the live content path" is now WRONG and worth flagging as a lesson: it was corrected mid-session (the page's actual purpose is to show the real lesson order, not compare against live output) and now reads a dedicated precomputed twin, `scheduling-preview.json` (`scripts/build-scheduling-preview.mjs`, ignoring `blockedBy` to walk every track's full curriculum) — see commit `297ef0e`. Not part of Phase 2b's fetch-by-id work, but a reminder that a doc's stated rationale can go stale faster than the code it describes; verify against the running app rather than trusting this file at face value.

## Phase 2b: entry-detail pages, fetch-by-id (Supabase)

The piece the original plan called "Supabase, fetched by ID" and Phase 2a explicitly deferred. In progress, not finished.

### Infrastructure

- **`content_entries` table** (`supabase/schema.sql`): `entry_id text primary key, kind text, payload jsonb, content_version text, updated_at timestamptz`. RLS: public `select` only (`using (true)`) — no anon/authenticated write policy, only the service-role key (which bypasses RLS) can write. Created via `psql "$SUPABASE_DB_CONNECTION_STRING"`, not the Supabase REST API — PostgREST has no DDL endpoint regardless of key type (anon, service-role, or the newer "publishable" key), confirmed by inspecting the OpenAPI spec before falling back to a direct Postgres connection.
- **Direct client read, not an API route**: this content is the same for every visitor (no per-user data, no auth needed), so the browser queries Supabase directly with the anon key — one fewer hop than routing through the app's own API. Deliberately different from `progress` (per-user, RLS-gated by `auth.uid()`, routed through the app's server client).
- **`src/lib/library/content-entries.ts`**: `fetchContentEntry<T>(entryId)` (one-shot fetch) and `useContentEntry<T>(entryId: EntryId | null)` (the shared fetch-and-render hook: `undefined` while loading, `null` for "no such entry", the payload otherwise). Passing `null` skips the fetch entirely — needed because several views (see "dual-mode views" below) sometimes already have the content live and shouldn't round-trip for it.
- **`scripts/seed-content-entries.mjs`**: one script, run manually today (`node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/seed-content-entries.mjs`), that reads every migrated kind's real source data and `upsert`s it into `content_entries`. **Never hand-copied** — every payload is either the literal object the live component used to render (a `Term`, a `Mark`) or the exact output of the real derivation function (`itemHeadline`, `buildItem(...).glyph`), serialized once. This is the same byte-correctness discipline as every other precompute in this app (Phase 1's `learn-index.json`, Phase 2a's `library-index.json`).
- **CI automation** (commit `d0cbd0a`): a `reseed-content` job in `.github/workflows/ci.yml` runs the seed script automatically on every push to `main`. This closes a real gap: a source edit to, say, `data/terms.ts`, merged to `main`, passes `tsc`/tests/build and LOOKS shipped — but `content_entries` doesn't update itself, so the live page keeps serving the old row until someone remembers to reseed. Idempotent (`upsert`), cheap (a few hundred rows), so it runs unconditionally rather than trying to detect which files changed. **Needs two GitHub Actions repo secrets set by hand** (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, same values as `.env.local`) — not something an agent has permission to set. Until they're added the job fails harmlessly (doesn't block the build).

### The pattern, and when each half of it applies

Two genuinely different techniques share the "fetch by id" label here, and picking the right one per kind mattered more than following one recipe everywhere:

1. **Full-payload fetch** (term, mark, grammar-concept): the kind's own data file (`data/terms.ts`, `data/marks.ts`) is itself the heavy thing — or close enough — so the *entire* object the live component rendered is seeded and fetched whole. The live component's own rendering code is otherwise **unchanged**.
2. **Headline-only fetch** (kana, sentence, verbpair, counter, generative-rule, keigo, grammar): the kind's actual content data (`data/keigo.ts`, `data/transitivity.ts`, `data/counters.ts`, `data/grammar/recipes.ts`, `data/grammar/clusters.ts`) turned out to be small and self-contained — no dictionary dependency — so it was **left as a live import**, verified file-by-file rather than assumed. The *only* thing seeded is `itemHeadline`'s `{text, speak}` output (a genuinely heavy derivation: `teachUnitsOf` → `factInfo`/`kanjiRow`/`keigoSetForEntry`/`grammarUnitsOf`, all reaching into the big dictionary), because that's the one piece every kind's shared `ContentEntryHeader` needs and the one piece that can't be made content-free without precomputing it.
   - `sentence-ordering` needed **no new seed data at all** — a sentence tier's library entry *is* its mark's own entry id, so it reuses the mark rows already seeded for kind 1.
   - `grammar` needed **no fetch for its actual pattern data either** — `recipeOf`/`recipesOf` were reproduced content-free in `library-index.ts` (byte-identical to `library/entries.ts`'s versions, same `RECIPES` walk) once it became clear the entanglement was entirely in reading the lookup *through* `entries.ts`'s heavy import chain, not in the recipe/cluster data itself. Only the headline is fetched.
3. **`glyph` sometimes has to be seeded too.** The header needs a glyph, and the instinct was to read it off `library-index.ts`'s already-precomputed `libEntry(entry).glyph` (works for kana, counter, generative-rule — checked, not assumed). For **transitivity, keigo, and grammar**, that field is either empty or subtly different from what the live `ContentItem` carried (grammar: 2 of 103 patterns differ by a parenthetical Japanese disambiguator `library-index.ts`'s search-oriented glyph field drops) — caught by a direct comparison script before shipping each kind, and once for transitivity by an actual blank-page regression caught in browser verification. Where it differs, `glyph` rides alongside `text`/`speak` in the same seeded row instead.

### Dual-mode views

Several migrated kinds are ALSO rendered by the active teach walk (`TeachItemView`) and `/dev/views`, both of which already build a full live `ContentItem` for every kind they show (they need the real dictionary loaded regardless, for reasons unrelated to this migration). Round-tripping to Supabase there would be pure waste — worse, a network stall mid-lesson. So `KanaEntryView`, `VerbPairEntryView`, `CounterEntryView`, `KeigoEntryView`, and `GrammarEntryView` each accept **both** an `entry: EntryId` prop (fetches) and an `item: ContentItem` prop (reads the live item directly, `itemHeadline` computed inline, no fetch) — the Library route passes `entry`, the teach walk and `/dev/views` keep passing `item`, unchanged.

### Kinds migrated, in order (simplest → hardest, as planned)

| # | Kind | Commit | Data stays live? | Seeded |
|---|------|--------|-------------------|--------|
| 1 | `term` | `13ea7f5` | no — full payload seeded | name/summary/body/cards/cardMark/relatedLinks |
| 2 | `mark` | `cd54496` | no — full `Mark` object seeded | the whole object |
| 2 | `grammar-concept` | `cd54496` | no — full payload seeded | name/summary/body/cards |
| 3 | `kana` | `8ed235b` | yes (mnemonic, context, confusables, stroke fallback all content-free/precomputed) | `itemHeadline` only |
| 4 | `sentence-ordering` | `8a821a0` | yes (reuses mark's own seeded row) | nothing new |
| 5 | `transitivity` (verb pairs) | `57d921b` | yes (`data/transitivity.ts`, ~27KB, self-contained) | `itemHeadline` + `glyph` |
| 6 | `counter` / `generative-rule` | `bf9ab3d` | yes (`data/counters.ts`, `data/number-construction.ts`) | `itemHeadline` only |
| 7 | `keigo` | `a902ffa` | yes (`data/keigo.ts`) | `itemHeadline` + `glyph` |
| 8 | `grammar` | `cd333dc` | yes (`recipeOf`/`recipesOf` reproduced content-free in `library-index.ts`) | `itemHeadline` + `glyph` |

Each commit's message has the specific verification for that kind (equivalence tests, an ad hoc byte-comparison script run against the live Supabase data and then discarded, `tsc`, the full unit suite, and a browser spot-check) — not repeated here.

### What's left in Phase 2b

**`character`** (kanji/radical/word combined) — deliberately last, and meaningfully bigger than everything above:
- Not a single-entry lookup like every other kind — `buildGlyphItem(glyph)` aggregates a glyph's facts across *every role it plays* (`characterRoles`: radical, kanji, word), so 人 is one item carrying its radical meaning, its kanji meaning, AND its word readings at once. The fetch-by-id shape needs to carry that same aggregation, not just one row per role.
- `CharacterEntryView` (`src/components/library/character-entry-view.tsx`) renders substantially more than a headline: etymology prose, variant forms, on'yomi/kun'yomi tables with example words, the "Built from" parts breakdown, a "Used as a part in" grid, and (for a word) an in-context example sentence — i.e. it needs something closer to the term/mark **full-payload** pattern than the headline-only one, but assembled from several source files (`data/kanji.ts`, `data/radicals.ts`, `data/vocab.ts`, `data/kanji-etymology.ts`, `data/variant-forms.ts`, `lib/character-role.ts`, `lib/kanji-parts.ts`) rather than one.
- Also used by `TeachItemView` (radical/kanji/word cases) and `/dev/views` — will need the same dual-mode (`entry` / `item`) treatment as the other kinds.

**The dispatcher itself** (`src/app/library/[...entry]/page.tsx`) — a "dedicated final pass," explicitly deferred since it was first flagged (commit `cd54496`'s message), not started:
- Still imports `libEntry`, `entryName`, `KIND_LABEL`, `shelfKindOf` from the LIVE `@/lib/library/entries` (not `library-index.ts`), so the page loads the whole dictionary regardless of which kind is being viewed — every kind migrated so far only stopped that kind's own *view* from needing it, not the surrounding page.
- `EntryBody` checks live registries (`grammarConceptFor(entry.id)`, `termFor(entry.id)`, `markFor(entry.id)`) BEFORE its `entry.kind` switch, by design — a mark's `LibEntry.kind` is conditionally `MARK_SUBJECT` or `SENTENCE_RULE_KIND` depending on `mark.shelf === "sentence"` (`library/entries.ts:563`), so `entry.kind` alone doesn't route correctly for marks without also knowing this. Fixing this content-free needs either precomputing that routing decision into `library-index.json` directly, or confirming `LIB_ENTRIES`' own `kind` field already reflects it (it's built from the same live logic, so it likely does — needs checking, not assuming) and dropping the registry checks in favor of a plain `switch (entry.kind)`.
- `markFor(entry.id)` is also called at the `EntryView` level (not just `EntryBody`) for `sentenceClaimFacts` — the sentence-tier "claim assembly facts on Drill" wiring. That's a second, independent reason the dispatcher can't drop its live `markFor` import until it's addressed too.

## Follow-up recommendations

1. **Finish `character`**, following the same rigor as the 9 kinds above (equivalence tests for any new content-free helper, an ad hoc byte-comparison script before shipping, browser spot-check on all three roles — radical-only, kanji-only, and a folded multi-role glyph like 人).
2. **The dispatcher final pass**, once `character` ships — see "What's left" above for the two specific things blocking it (registry-based routing, `markFor` for claim wiring). Do this as its own change, not folded into `character`, since it touches every kind's routing at once and deserves its own verification pass.
3. **Get the two GitHub Actions secrets set** (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) so the `reseed-content` CI job actually runs instead of failing on every push — currently blocking automatic reseeding.
4. **Re-run the bundle sweep** (the same "every route, dictionary-signature chunk" check Phase 2a did — see the Verification section above) once `character` and the dispatcher pass are both done, to actually quantify Phase 2b's MB win. Nothing in this phase has been measured yet the way Phase 2a's 9.5MB → 7.94MB was; the current commits are verified for *correctness* (byte-identical content, all tests green) but not for the size delta they're presumably delivering.
5. **Evaluate `/library/primitive/[glyph]`** — not touched by Phase 2b at all, not clear yet whether it needs the same treatment or is already light. Worth a quick check before considering Phase 2b "done."
6. **Consider whether `library-index.json`'s `glyph` field should just be complete for every kind**, removing the need to special-case `transitivity`/`keigo`/`grammar` with a seeded `glyph` alongside the headline. Not urgent — the current per-kind verification catches the mismatch reliably — but it's asymmetry worth resolving once all kinds are migrated and the shape of the remaining work is fully known.
