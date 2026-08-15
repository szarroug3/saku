# Findings: 75% of the curriculum's vocabulary was never scheduled — FIXED — and a smaller remaining keigo/transitivity gap

**Status: the big one (multi-character coverage) is fixed and verified.** The narrower remaining gap (keigo 3/9, transitivity 20/69 — words genuinely absent from `CURRICULUM_SEQUENCE`) is still open; see "What's left" at the bottom.

## The big one: multi-character words never became teaching units — FIXED

Discovered from a real user report ("I marked literally everything as known, /learn says 'curriculum complete,' but the Library's 'Not known' filter still shows a pile of ordinary words like はい/うん/食べる/わかる"). Both halves of that report are individually correct — that's what made it confusing: the scheduler has genuinely run out of things to offer, and the Library is genuinely correct that those words aren't known, because **they were never offered to teach in the first place.**

Root cause: `orderedUnits` (`src/lib/content/teach-unit.ts`), what the vocab track's `vocabUnits()` builds its whole schedulable order from, turns each `CURRICULUM_SEQUENCE` glyph into a unit via `buildGlyphItem`. `buildGlyphItem` is explicitly single-Han-character only — `characterRoles`'s own comment states "kana and multi-character forms are excluded by the predicate" (`isSingleCharWordGlyph`). So for any multi-character glyph, `buildGlyphItem` returns `undefined`, and `orderedUnits` silently drops it — no unit, no error, no gap in the array to notice.

Measured directly: of 9,140 `CURRICULUM_SEQUENCE` glyphs, **2,234 are single-character and 6,906 are multi-character. Of those, 2,226 single-character glyphs produce a unit (8 single-character glyphs are also uncovered, a separate small gap) and every one of the 6,906 multi-character glyphs produces zero.** The vocab track has only ever been able to teach 24% of what `CURRICULUM_SEQUENCE` claims to declare.

This is entirely pre-existing — `teach-unit.ts`, `curriculum-order.ts`, `build-item.ts`, and `character-role.ts` were untouched by every commit in this session (mine and the other agent's). It predates Phase 2b, predates the character migration, predates this conversation. It was invisible until a user tried to reach 100% completion and cross-checked against the Library's independently-built "known" listing, which has no such gap (it lists every `LibEntry` regardless of whether the scheduler can ever reach it).

**The fix, shipped:** `orderedUnits` (`src/lib/content/teach-unit.ts`) now falls back to `buildItem(wordEntry(glyph), "word")` — the same word-builder already used correctly elsewhere in the app (e.g. the Library's word entry-detail page) — whenever `buildGlyphItem` answers undefined:

```ts
const item = buildGlyphItem(glyph) ?? buildItem(wordEntry(glyph), "word");
```

This was a smaller, safer change than it first looked, for two reasons verified before shipping:
- `pronunciationUnitsOf` (what turns a built item into teaching units) is already kind-agnostic — `teachUnitsOf`'s own switch already routes `"character"`, `"word"`, and `"counter"` kinds through it identically. No changes needed there.
- The scheduler's own prerequisite resolution (`primaryUnit` in `unit-scheduler.ts`) legitimately keeps using `buildGlyphItem` only — a word's prereqs are its constituent single-character kanji (`directPrereqs` in `build-item.ts`), so that call site's single-character assumption is correct as-is and was left untouched.

**Verified impact** (`docs/generated/*.json` regenerated, full suite green except the one documented remaining gap below):
- The new coverage test (`interleaved-schedule.test.ts`) passes: 0 uncovered glyphs, was 6,906 multi-character + 8 single-character.
- keigo's reachability went from 8/9 stuck to 3/9 stuck — exactly the 3 sets whose plain verb is genuinely absent from `CURRICULUM_SEQUENCE` (give-me/receive/see), confirming the other 5 were the same bug surfacing differently, not a separate cause.
- transitivity went from 69/69 stuck to 20/69 stuck.
- `learn-index.json`: vocab units 2,740 → 9,678. `scheduling-preview.json`: vocab lessons 477 → 1,814.
- The interleaved walk itself roughly quadrupled in length (~470 → ~1,806 rounds) since the vocab track now legitimately has ~4x more to teach — the test's gap threshold was changed from a fixed constant to a fraction of the measured walk length so it doesn't need re-tuning again as the curriculum grows.

## keigo and transitivity are largely unreachable under the real scheduler

**Source:** `src/lib/content/interleaved-schedule.test.ts` — a round-robin simulation across every `UNIT_TRACK` at once, using the real production scheduler (`nextTrackLesson`, `unit-scheduler.ts`) with real cross-track `blockedBy` gates honored. Run it directly for the full breakdown:

```
node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/interleaved-schedule.test.ts
```

## What's confirmed

Under a maximally fair interleaving (every track gets a turn every round — the best case any real usage pattern could do at least as well as), walking until nothing is schedulable anywhere:

| Track | Units taught | Total units | Reachable? |
|---|---|---|---|
| kana | 43/43 lessons | 214 units | yes, no gaps |
| vocab | 472/472 lessons | 2,295 units | yes, no gaps |
| numbers | 12/12 lessons | 40 units | yes, no gaps |
| grammar | 21/21 lessons | 103 units | yes, no gaps |
| sentence | 10/10 lessons | 10 units | yes, no gaps |
| **keigo** | **1 unit taught** | **9 units** | **8 permanently stuck** |
| **transitivity** | **0 units taught** | **69 units** | **all 69 permanently stuck** |

Five of seven tracks are completely healthy — fully reachable, and every lesson unlocks either immediately or within one round of the previous lesson in its own track. `keigo` and `transitivity` are not.

## A confirmed partial cause

Both `keigo` and `transitivity` gate their content behind `blockedBy: [wordEntry(theirPlainVerb)]` — a set/pair doesn't unlock until its underlying plain verb is fully learned. "Learned" only ever happens through the `vocab` track, which teaches words in `CURRICULUM_SEQUENCE` order (`src/lib/curriculum-order.ts`).

Checked directly: **31 of 138 verb-pair sides** (out of 69 pairs) are simply absent from `CURRICULUM_SEQUENCE` — 始める, 終える, 出す, 付く/付ける, 続く/続ける, 切る, 治す, 建てる, 帰す, 掛ける, and 20 others. `transitivity`'s `blockedBy` is an ALL-of gate on both verbs, so any pair touching even one of those 31 words can never unlock, by construction — there is no curriculum path that ever claims that word's facts.

For keigo, checking which of the 9 sets' primary plain verbs are covered by `CURRICULUM_SEQUENCE`:

| Set | Plain verb(s) | In `CURRICULUM_SEQUENCE`? |
|---|---|---|
| welcome | *(none — formulaic, no gate)* | n/a |
| say | 言う | yes |
| eat | 食べる / 飲む | yes |
| know | 知る | yes |
| go-come-be | 行く / 来る / いる | yes |
| do | する | yes |
| give-me | くれる | **no** |
| receive | もらう | **no** |
| see | 見る | **no** |

Only 3 of 9 sets have a plain verb missing from the curriculum outright — yet 8 of 9 stayed unreached in the simulation, not 3. **Root-caused**: every one of the other 5 sets' plain verbs (言う, 食べる/飲む, 知る, 行く/来る/いる, する) is a multi-character glyph, and every multi-character glyph hits the exact same bug documented above — `orderedUnits` never builds it a unit, so the vocab track never schedules or claims its facts, so `isLearned` (which requires every one of the word's facts claimed) never clears, so the `blockedBy` gate never lifts. This isn't a second, separate keigo-specific bug — it's the same multi-character gap surfacing again through a different symptom (a blocked set instead of a silently-unteachable word).

## Known, partially-intentional design wrinkle

`src/lib/content/keigo-unit.ts`'s own comment states plainly: *"a set the curriculum never teaches the verb for never surfaces."* This means the *mechanism* (permanent silence when uncovered) is deliberate — what's not clearly deliberate is the *scale* (8 of 9 sets, 69 of 69 pairs), which reads more like an oversight in curriculum coverage than an intended outcome.

`src/lib/content/verb-pair-unit.ts`'s scheduler-preview seeding (`vocabLearned()`, used only by the isolated `/dev/scheduling` preview) works around the exact same gap by pretending all vocabulary is already known — which is why this was invisible in that dev view and only surfaced once a real cross-track, no-shortcuts simulation was run.

## What's left

The multi-character coverage gap (the root cause behind most of this doc) is fixed and verified. What remains is narrower and purely a content gap, not an architecture problem:

- **31 of 138 verb-pair sides** (out of 69 pairs) — 始める, 終える, 出す, 付く/付ける, 続く/続ける, 切る, 治す, 建てる, 帰す, 掛ける, and 20 others — are simply absent from `CURRICULUM_SEQUENCE` outright. `transitivity`'s `blockedBy` is an ALL-of gate on both verbs, so any pair touching even one of these can never unlock.
- **3 of 9 keigo sets** (give-me, receive, see — くれる/もらう/見る) have the same problem: their plain verb isn't in `CURRICULUM_SEQUENCE` at all.

## Recommendation

1. **Decide, per remaining gap, whether it's a content bug or an accepted design tradeoff.** `src/lib/content/keigo-unit.ts`'s own comment states the *mechanism* (permanent silence when a verb is uncovered) is deliberate — what's not clearly deliberate is which specific 34 words ended up excluded. If they should be teachable: add the missing words to `CURRICULUM_SEQUENCE` (or otherwise ensure their facts get taught). If some are intentionally excluded (e.g. a genuinely obscure verb pair not worth teaching): keep the test honest about that decision — either exclude those specific entries with a documented reason, or switch `interleaved-schedule.test.ts`'s reachability assertion to the "snapshot/regression guard" variant instead of the current strict one, so future drift is still caught without demanding 100% coverage of content that was never meant to ship.
2. Until (1) is decided, `interleaved-schedule.test.ts`'s reachability assertion (only that one, now) is EXPECTED TO FAIL — that is the point, not a bug in the test. The coverage test, the safety-cap test, and both timing tests are green.
3. `src/lib/content/verb-pair-unit.ts`'s scheduler-preview seeding (`vocabLearned()`, used only by the isolated `/dev/scheduling` preview) still works around this exact remaining gap by pretending all vocabulary is already known — worth knowing if that dev view ever looks inconsistent with the real app for these specific 34 words.
