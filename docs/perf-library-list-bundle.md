# Perf: get the ~9.5MB curriculum dictionary off `/library`'s list/search page

**Status:** Complete. Phase 2a moved list/search to a generated content-free index; Phase 2b migrated all 10 entry-detail kinds to fetch-by-id and moved the dispatcher, metadata layout, grammar presentation, and Library action gates off the live dictionary. Follow-on to `docs/perf-learn-bundle.md` (Phase 1, `/learn`).

---

## What this actually is, vs. the original plan

The original Phase 2 (in `perf-learn-bundle.md`) called for moving the content dictionary + Library meaning-search to **Supabase**, fetched by ID. Partway into scoping that, a cheaper alternative surfaced: `/library`'s list/search page doesn't need a database at all — it needs the same **precompute** pattern Phase 1 already proved for `/learn`. No infra, no schema, no seed script.

That pivot was approved and is what Phase 2a shipped. **Supabase was not touched by Phase 2a.** Phase 2b then used it for the separate entry-detail payload problem.

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

**History-dependent reading gates are precomputed structurally**: the index serializes each of 3,496 kanji-reading facts to the multi-part word-meaning facts that can prove it. `SliceBar` applies the live user's history to that small mapping, so claim/quiz eligibility remains byte-equivalent to `word-unlock.ts` without importing its dictionary-backed reading index. Equivalence tests compare both filters against the live implementation across every fact.

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

The piece the original plan called "Supabase, fetched by ID" and Phase 2a explicitly deferred. Complete.

### Infrastructure

- **`content_entries` table** (`supabase/schema.sql`): `entry_id text primary key, kind text, payload jsonb, content_version text, updated_at timestamptz`. RLS: public `select` only (`using (true)`) — no anon/authenticated write policy, only the service-role key (which bypasses RLS) can write. Created via `psql "$SUPABASE_DB_CONNECTION_STRING"`, not the Supabase REST API — PostgREST has no DDL endpoint regardless of key type (anon, service-role, or the newer "publishable" key), confirmed by inspecting the OpenAPI spec before falling back to a direct Postgres connection.
- **Direct client read, not an API route**: this content is the same for every visitor (no per-user data, no auth needed), so the browser queries Supabase directly with the anon key — one fewer hop than routing through the app's own API. Deliberately different from `progress` (per-user, RLS-gated by `auth.uid()`, routed through the app's server client).
- **`src/lib/library/content-entries.ts`**: `fetchContentEntry<T>(entryId)` (one-shot fetch) and `useContentEntry<T>(entryId: EntryId | null)` (the shared fetch-and-render hook: `undefined` while loading, `null` for "no such entry", the payload otherwise). Passing `null` skips the fetch entirely — needed because several views (see "dual-mode views" below) sometimes already have the content live and shouldn't round-trip for it.
- **`scripts/seed-content-entries.mjs`**: one script, run manually today (`node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/seed-content-entries.mjs`), that reads every migrated kind's real source data and `upsert`s it into `content_entries`. **Never hand-copied** — every payload is either the literal object the live component used to render (a `Term`, a `Mark`) or the exact output of the real derivation function (`itemHeadline`, `buildItem(...).glyph`), serialized once. This is the same byte-correctness discipline as every other precompute in this app (Phase 1's `learn-index.json`, Phase 2a's `library-index.json`).
- **CI automation** (commit `d0cbd0a`): a `reseed-content` job in `.github/workflows/ci.yml` runs the seed script automatically on every push to `main`. This closes a real gap: a source edit to, say, `data/terms.ts`, merged to `main`, passes `tsc`/tests/build and LOOKS shipped — but `content_entries` doesn't update itself, so the live page keeps serving the old row until someone remembers to reseed. Idempotent (`upsert`), cheap (a few hundred rows), so it runs unconditionally rather than trying to detect which files changed. **Needs two GitHub Actions repo secrets set by hand** (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, same values as `.env.local`) — not something an agent has permission to set. Until they're added the job fails harmlessly (doesn't block the build).

### The pattern, and when each half of it applies

Two genuinely different techniques share the "fetch by id" label here, and picking the right one per kind mattered more than following one recipe everywhere:

1. **Full-payload fetch** (term, mark, grammar-concept): the kind's own data file (`data/terms.ts`, `data/marks.ts`) is itself the heavy thing — or close enough — so the *entire* object the live component rendered is seeded and fetched whole. The live component's own rendering code is otherwise **unchanged**.
2. **Mostly headline-only fetch** (kana, sentence, verbpair, counter, generative-rule, keigo, grammar): each kind's small self-contained content stays live, while `itemHeadline`'s `{text, speak}` output is seeded. Grammar additionally seeds the exact authored/generated teaching pages and family-table build strings; the renderers for those values otherwise reached grammar lesson/fact and vehicle/vocabulary modules. This was found by tracing and measuring the production graph, not by assuming a source file was light.
   - `sentence-ordering` needed **no new seed data at all** — a sentence tier's library entry *is* its mark's own entry id, so it reuses the mark rows already seeded for kind 1.
   - `grammar` keeps recipe/cluster lookup live through content-free `recipeOf`/`recipesOf` twins, but fetches presentation output (`teachings`, `familyBuilds`) alongside its headline and glyph.
3. **`glyph` sometimes has to be seeded too.** The header needs a glyph, and the instinct was to read it off `library-index.ts`'s already-precomputed `libEntry(entry).glyph` (works for kana, counter, generative-rule — checked, not assumed). For **transitivity, keigo, and grammar**, that field is either empty or subtly different from what the live `ContentItem` carried (grammar: 2 of 103 patterns differ by a parenthetical Japanese disambiguator `library-index.ts`'s search-oriented glyph field drops) — caught by a direct comparison script before shipping each kind, and once for transitivity by an actual blank-page regression caught in browser verification. Where it differs, `glyph` rides alongside `text`/`speak` in the same seeded row instead.

### Dual-mode views

Several migrated kinds are ALSO rendered by the active teach walk (`TeachItemView`) and `/dev/views`, both of which already build a full live `ContentItem`. Round-tripping there would add a network stall for no benefit. Base renderers therefore accept fetched `entry` mode or pre-resolved live props; `live-item-entry-views.tsx` and `live-character-entry-view.tsx` are the live-only adapters that compute `itemHeadline`, grammar teaching/family output, or the full character payload synchronously. This split is load-bearing: importing the live derivation into a dual-mode base component made Turbopack ship it to the Library route even when that branch was not used.

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
| 8 | `grammar` | `cd333dc` + final pass | yes (`recipeOf`/`recipesOf` reproduced content-free in `library-index.ts`) | `itemHeadline` + `glyph` + teaching pages + family builds |
| 9 | `character` (`radical` / `kanji` / `word`) | `97fcf8e` | no — full display payload assembled at seed/live-adapter time | item, headline, roles, variants, parts, etymology, readings, senses/examples, used-in list, stroke fallback |

Each commit's message has the specific verification for that kind (equivalence tests, an ad hoc byte-comparison script run against the live Supabase data and then discarded, `tsc`, the full unit suite, and a browser spot-check) — not repeated here.

### Final dispatcher pass

- Both `page.tsx` and its metadata `layout.tsx` resolve entries through `library-index.ts`; the dispatcher is a plain switch over the precomputed kind. A dedicated equivalence test proves every mark preserves the live sentence-rule vs writing-rule decision.
- The old sentence `claimFacts` derivation was dead wiring: `SliceBar`'s `entry` variant returns before any claim UI and exposes only the optional quiz. It was removed rather than replacing one unused live registry lookup with another.
- `ContentEntryHeader` and `HowItsWritten` now require resolved headline/fallback props, preventing shared renderers from silently restoring the live dictionary edge.
- The production import trace also found two non-dispatcher leaks: grammar teaching/family renderers and keigo's grammar-concept link. Their display outputs/lookups now come from fetched payloads or the content-free index, while live lesson/dev adapters retain synchronous source derivation.

### Final verification and measured result

- Character glyph comparison: all 14,905 character entries matched the precomputed Library glyph; Supabase deep-equality verification matched all 14,905 seeded payloads to fresh live derivations.
- Final seed: 15,364 rows total (214 radical, 2,136 kanji, 12,555 word plus the other migrated kinds).
- Grammar's expanded payload matched fresh live JSON for all 103 rows after reseeding.
- Dispatcher/index equivalence: 30/30, including kind routing and live-vs-precomputed claim/quiz gates.
- `tsc --noEmit` clean; `npm test`: 3,117/3,117; production `next build` clean. ESLint is clean across every changed source file (the repository-wide command still scans generated `.next-prod` output and reports its existing generated-code failures).
- Production browser: all 13 dispatch shapes rendered (kana, radical, kanji, word, counter, number construction, grammar, grammar concept, transitivity, keigo, sentence rule, writing rule, term); grammar's quiz pre-start action also opened correctly.
- Production network for `/library/grammar/prenominal-form`: **20.63 MB before the dispatcher cleanup → 9.46 MB initial JavaScript**, with the 8.64 MB `beginnerRank` dictionary-signature chunk absent. The generated index is the largest remaining route chunk (6.17 MB) because meaning search and fact mappings are intentionally client-side.
- Comprehensive client-manifest sweep: `/library`, `/library/[...entry]`, and `/learn` reference no dictionary-signature chunk. The expected grading/content-heavy routes still do; `/library/primitive/[glyph]` remains the one Library follow-up below.

## Follow-up recommendations

1. **Get the two GitHub Actions secrets set** (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) so the `reseed-content` CI job can run after pushes to `main`.
2. **Evaluate `/library/primitive/[glyph]`** — the comprehensive sweep confirms it still references dictionary-signature chunks; it was explicitly outside Phase 2b.
3. **Consider whether `library-index.json`'s `glyph` field should be complete for every kind**, removing the seeded `glyph` asymmetry for transitivity/keigo/grammar.
