# Perf: get the ~8.6 MB curriculum dictionary off the `/learn` bundle

**Status:** Phase 1 complete. `/learn` schedules from the generated content-free index; Phase 2 is documented in `perf-library-list-bundle.md`.

**Problem:** `/learn` takes a while to load in prod. Its client bundle contains an ~8.6 MB chunk of static curriculum content that the page never renders, plus it recomputes the whole scheduler on every load.

---

## Diagnosis (verified)

`/learn` renders `src/components/home/home-feed.tsx` (`"use client"`). All ~8.6 MB enters through **one module, `src/data/vocab.ts`**, which statically imports:

| JSON | Size | Import site |
|---|---|---|
| `word-definitions.json` | 4.4 MB | `src/data/vocab.ts:46` |
| `cejc-reading-frequency.json` | 3.1 MB | `src/data/vocab.ts:44` |
| `vocab.json` | 2.9 MB | `src/data/vocab.ts:42` |

These three are the ONLY non-test importers of those files. `/learn` reaches `vocab.ts` through **five independent static edges — all must be cut:**

1. `home-feed.tsx:34` → `unit-tracks.ts:20` `import { VOCAB_FACTS } from "@/data/vocab"`
2. `home-feed.tsx:42` direct `import { VOCAB_SUBJECT } from "@/data/vocab"`
3. `home-feed.tsx:39` → `curriculum-order.ts:156` `import { isSingleCharWordGlyph } from "@/data/vocab"`
4. `home-feed.tsx:50` → `lib/facts.ts:28` `import { VOCAB_FACTS } from "@/data/vocab"` (the widest leak — a barrel)
5. `unit-tracks.ts:22` → `teach-unit.ts:15` (`wordReadingUnit, readingFrequency`) + `build-item.ts:23` (`wordEntry, wordUnitFacts`)

**Why the small scheduling data drags the big content:** the fact set is *derived at runtime from the content* — `VOCAB_FACTS → buildVocabFacts → wordUnitFacts → readingUnits → teachingSenses → readingDefinitions → word-definitions.json` (`vocab.ts:466`) + `cejc` (`:502`). The *output* (fact-id strings, glyphs, ranks) is tiny and stable; it's just computed live from the dictionary.

**What `/learn` actually needs:** the next-lesson preview (`item-preview.tsx`) renders only `item.glyph` + `item.typeLabel`. The scheduler (`unit-scheduler.ts`) reads only, per unit: `kind`, `scheduling`, `reading?`, `cost` (`unitCost`), `facts` (fact-id strings), and `item.{entry, glyph, typeLabel, kind, roles, prereqs, blockedBy}`. **No glosses, no readings prose.**

**Two validated facts that make a precompute safe:**
- **Units are history-independent.** Every `UNIT_TRACKS[i].units(h)` ignores `h` for its unit *set*/order (even numbers: `numbers-track.ts:105` `order: () => items`). History only drives `nextTrackLesson`'s *filtering* (learned/blocked) and the transitivity `seed`. So `track.units(emptyHistory)` == the units for any history.
- **IDs are position-independent.** `entryId(subject,key)`/`factId(entry,aspect)` are string-keyed (`word:先生/meaning@…`); ordering lives in separate structures (`beginnerRank`, `CURRICULUM_SEQUENCE`, `order.json`). So add/remove/reorder never renumbers a learner's known-set. `LEGACY_UNQUALIFIED_READING` (`vocab.ts:588`) exists to freeze reading identity.

---

## Architecture decisions (agreed with owner)

- **No offline requirement** — it's a website, network is fine; no account needed but network is fine. So compute can move server-side later.
- **DB: Supabase** (extend the existing one — already holds auth + `progress`). Free-tier pausing after ~7 days idle is acceptable (owner uses it daily; revisit a keep-alive cron later). If sporadic use ever makes the pause hurt, Turso (libSQL, FTS5, no pause) is the swap for the content store.
- **A build script is fine** — the generated JSON becomes the script's *seed/precompute source*, not a client bundle.
- **Progress stays a set of stable fact IDs; the lesson is always DERIVED** as "lowest-order not-known unit with prereqs met." This is why add/remove/reorder self-heals and catches users up: new content isn't in anyone's known-set → it becomes their next frontier; removed content just leaves the index; reorder only changes `order`. **The migration must preserve this exact semantics.**
- **New requirement — a `curriculumVersion` stamp** (a hash the build script emits over the index). It goes in the frontier **cache key** (alongside the known-set hash) so a content deploy invalidates cached frontiers and the catch-up surfaces immediately.

---

## Phased plan

- **Phase 1 (this doc's focus, NO infra):** precompute a small per-track scheduling index; make `/learn` compute the frontier over it instead of building units live from the content pipeline. Strips ~8.6 MB off `/learn`. Verifiable by bundle size + full suite. Client still computes the frontier (fine); no DB yet.
- **Phase 2:** move the content dictionary + Library meaning-search to Supabase, fetched by ID on demand. Removes `vocab.ts` from `/library`, quiz, session, and everything importing the `lib/facts` barrel (the wide leak). Break `lib/facts.ts` as a barrel.
- **Phase 3:** move the frontier compute server-side (route handler over the index + known-set) and cache client-side by `hash(known-set) + curriculumVersion`.

Each phase leaves the app fully working, tsc-clean, unit + Playwright green.

---

## Phase 1 — concrete change list

### 1. Build script → `src/data/generated/learn-index.json` (+ types)
- New `scripts/build-learn-index.mjs` (run with `uv`? no — it's JS/Node; add an npm script `build:learn-index`). It imports `UNIT_TRACKS` (uses content, at BUILD time only) and, for each track, calls `track.units(EMPTY_HISTORY)` and serializes each unit's minimal fields:
  ```
  { kind, scheduling, reading?, cost, facts: FactId[],
    item: { entry, glyph, typeLabel, kind, roles, prereqs: EntryId[], blockedBy: EntryId[] } }
  ```
  Emit per-track arrays + a `curriculumVersion` (hash of the serialized index).
- Also emit a **resolve map** `entry → unitIndex` per track: `prereqChain` (`unit-scheduler.ts:86-101`) resolves a prereq entry to its unit to pull it into the lesson. The loader must reconstruct the same `resolve`.
- **Do NOT emit glosses/`meaning`/`answers`** — those are content (Phase 2). The scheduler and preview never read them.
- Wire it into the build (a `prebuild` step or committed generated file, like the other `src/data/generated/*`). Regenerating on content change is what bumps `curriculumVersion`.
- Sentence tiers also serialize the existing planner's history-dependent gate:
  candidate sentences as keb/reb meaning-fact OR-sets, `minReadable`, grammar
  prerequisite facts, and completion facts. This preserves the pre-model rule
  (readable vocabulary + grammar, linear tiers) without returning the dictionary
  to `/learn`.

### 2. Runtime loader → `src/lib/content/learn-index.ts`
- Reads `learn-index.json` and reconstructs `readonly TeachingUnit[]` per track (typed to the existing `TeachingUnit` base contract) + the resolve map. Imports **no content module**. Exports `LEARN_TRACKS: { id, title, units: readonly TeachingUnit[] }[]` and `CURRICULUM_VERSION`.
- Note track titles/ids live in `UNIT_TRACKS` — duplicate the small `{id,title}` list here (constants, no content) or emit them into the index.

### 3. Rewire `home-feed.tsx` (`/learn`) to the loader — cut all five edges
- Replace `UNIT_TRACKS` usage (`:264-289`) with `LEARN_TRACKS`; `track.units(history)` → the precomputed `track.units`. `nextTrackLesson(order, history, range)` runs unchanged over the precomputed order.
- Edge 2: `VOCAB_SUBJECT` — inline the constant `"word"` (or import from a content-free module).
- Edge 3: `curriculum-order.ts` → `isSingleCharWordGlyph`. Check what `home-feed` uses `curriculum-order` for; if only for typeLabel/position that's now in the index, drop the import. If `isSingleCharWordGlyph` is still needed, move it to a content-free util (it's a pure glyph check — verify it doesn't read `VOCAB`).
- Edge 4: `lib/facts.ts` → `factInfo`, `entryOf`. Audit exactly what `home-feed` reads from `factInfo`/`entryOf` (`:50`). If it's typeLabel/glyph/meaning-for-preview, the index already carries glyph+typeLabel — drop the calls. If a residual need remains (e.g. a gloss in a card), that's a small on-demand fetch, not the registry. **Goal: `home-feed` imports nothing that transitively imports `vocab.ts`/`kanji.ts`.**
- Edge 5: `teach-unit`/`build-item` are only reached via `unit-tracks`; once `/learn` uses `LEARN_TRACKS`, that edge is gone.
- Also cut the sentence-track imports if they pull content: `SENTENCE_ORDERING_TIERS`, `sentenceLessonFacts`, `sentenceTierMarkerFact` are used by `startSentence`/`startTrack`. Launching a lesson only needs fact-ids (which go to `/session`, where content loads). Verify these sentence helpers don't import the dictionary; if they do, the launch can pass the precomputed facts instead.

### 4. Stop `pronunciationUnitsOf` materializing glosses
- `teach-unit.ts:128-177` fills each unit's `meanings` from `factInfo(f.id)?.meaning` purely to schedule. Not needed for the frontier or preview. Ensure the precompute/loader path doesn't require it (the index carries fact-ids, not meanings).

### 5. Verification gates (all must pass before merge)
- **Equivalence test** (the safety net): a `node --test` test asserting that, for a spread of histories (empty, partial per track, out-of-order Library claims, past-the-frontier), `nextTrackLesson(LEARN_TRACKS[t].units, h, range)` returns the SAME lesson (same unit entries + facts, same order) as `nextTrackLesson(UNIT_TRACKS[t].units(h), h, range)`. If this drifts, the precompute is wrong — do not merge.
- **Bundle delta:** `NEXT_DIST_DIR=.next-prod npx next build`; confirm `/learn`'s chunk group no longer references the 8.6 MB chunk (check `.next-prod/server/app/learn/page_client-reference-manifest.js` and chunk sizes). Record before/after.
- `./node_modules/.bin/tsc --noEmit` clean (ignore `.next*`).
- `npm test` green (3062+; the fact/scheduler audits enforce byte-correctness — a mismatch fails here).
- Full Playwright green (esp. `/learn`, `lesson*`, `library`).

### Gotchas
- **Byte-correctness of fact-ids is non-negotiable** — the precompute must be the *same derivation's output*, so build the index by calling the existing functions, never by re-deriving with new logic.
- The `lib/facts` registry (`factInfo`, `entryOf`) is the widest leak and is used app-wide; Phase 1 only needs `/learn` off it, but note that `facts.ts` barrels `vocab.ts` + `kanji.ts` + `grammar` + `keigo` — Phase 2 breaks that barrel so `/library`/quiz/session drop the dictionary too.
- Kanji/radical secondary weight also on `/learn` via `kanji.ts` (`kanji.json` 280KB, `readings.json` 532KB, `order.json` 196KB) through `facts.ts`/`curriculum-order`. Fold into the same index precompute (the units already carry the kanji/radical entries + prereqs).
- `grammar-corpus.json` (1.9 MB) and `kanji-etymology.json` (948 KB) do NOT reach `/learn` (server API / entry views only) — Phase 2 concern.

---

## Owner context
- Force-deleting `refactor/meaning-model` (221 ahead / 130 behind, superseded dev branch) is pending owner OK.
- Progress lives in Supabase `progress.history` (signed-in) / localStorage (signed-out); see `supabase/schema.sql`.
