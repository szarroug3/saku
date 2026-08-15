# Findings: 75% of the curriculum's vocabulary was never scheduled — FIXED — and four remaining transitivity content gaps

**Status: fully fixed except four genuine dictionary-data gaps.** The multi-character coverage bug is fixed and verified. The word track was later widened to essentially all of `VOCAB` (~12,540 words, not just the ~7,537 CEJC/JLPT-gated subset — see `word-lesson.ts`), which subsumed the 29-word `FORCE_TAUGHT_KEBS` override entirely. A separate, since-corrected mistake in this investigation initially "fixed" 4 transitivity pairs (付ける→つける, 産む→生む, 掛かる→かかる, 掛ける→かける) believing they were spelling mismatches against `VOCAB`; they were not — pre-existing audit tests (`transitivity-facts.test.ts`, `audit-semantics.test.ts`) deliberately pin the original kanji spellings, and the four kanji headwords genuinely have no `VOCAB` entry under those exact spellings. All 4 were reverted to their correct kanji spellings. Four pairs now remain stuck — 濡れる/濡らす, 付く/付ける, 生まれる/産む, 掛かる/掛ける, all genuinely absent from `VOCAB` under those exact headwords — see "What's left" at the bottom.

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

## The fix, round two: 34 missing words resolved, then round three: a wrong "spelling fix" reverted

Of the 31 verb-pair-side words and 3 keigo plain verbs (34 total, 35 counting one word appearing on both lists) absent from `CURRICULUM_SEQUENCE`:

- **29 needed to be added to the curriculum outright.** CEJC's classifier correctly filed them as `"grammar"` (dominant corpus role is auxiliary/aspectual — もらう/くれる as giving-receiving auxiliaries, 出す/始める/続ける as aspectual compound-verb suffixes, etc.) or `"unobserved"` (real, ordinary vocabulary CEJC's finite recording just never happened to capture — 閉める, 帰る, 見つける, etc.), but each is also a genuinely common standalone verb the curriculum needed to teach on its own. Originally added via a `FORCE_TAUGHT_KEBS` override list in `src/lib/word-lesson.ts`; that override was later subsumed entirely when the word track widened to essentially all of `VOCAB` (see below).
- **4 were mistakenly treated as spelling mismatches, then reverted.** An earlier pass in this investigation changed `transitivity.ts`'s hand-authored kanji spellings — 付ける→つける, 産む→生む, 掛かる→かかる, 掛ける→かける — believing they didn't match `VOCAB`'s canonical JMdict `keb` for the same word/sense. This was wrong: pre-existing audit tests (`transitivity-facts.test.ts`, `audit-semantics.test.ts`) deliberately pin the ORIGINAL kanji spellings on purpose (e.g. 産む is the standard verb for bearing a child, distinct from 生む "produce/give rise to"; 生まれる/産む is the one documented kanji-stem exception in `audit-semantics.test.ts`). `つける`/`かかる`/`かける`/`生む` are real, separate `VOCAB` entries — not typos of the kanji forms — but they are not the same word/sense the pair's hand-authored English sentence and audit tests intend. All 4 were reverted back to their correct kanji spellings, which restores the original, correct semantics but reopens the scheduling gap: none of 付ける, 産む, 掛かる, 掛ける exists in `VOCAB` under those exact kanji headwords.
- **1 pair was always a genuine, currently-unfixable content gap:** 濡れる ("get wet") / 濡らす ("wet something") are not spelling mismatches — confirmed absent from `VOCAB` entirely (zero hits for ぬれる/ぬらす/濡れる/濡らす in `src/data/generated/vocab.json`). Fixing this needs real dictionary content this repo's JMdict/CEJC ingestion never produced, not a code change.

### The word track was separately widened to essentially all of VOCAB

After the above, a user report surfaced a much larger, related issue: `VOCAB` (12,555 words) is JMdict's own curated "everyday" set, but the OLD `CURRICULUM_WORDS` only taught 7,537 of those — the ones CEJC's corpus happened to observe or a JLPT wordlist happened to gate. The other ~5,000 (図書館, 郵便局, 飛行機, 水曜日, 警官, …) are equally "everyday" by JMdict's own curation. **Decision: extend the curriculum to essentially all of VOCAB, ordered by `beginnerRank`.** `CURRICULUM_WORDS` now excludes only the counter track's own duplicates (see `word-lesson.ts`'s "WHERE THE CURRICULUM ENDS"), subsuming the 29-word `FORCE_TAUGHT_KEBS` override above entirely. New total: 12,540 words (was 7,537).

**Verified impact:** `interleaved-schedule.test.ts`'s reachability test now reports `transitivity: 4/69 units never scheduled` — 濡れる/濡らす plus the 3 reverted pairs (付く/付ける, 生まれる/産む, 掛かる/掛ける; 付く and 生まれる are themselves taught under those exact kanji spellings already — it's specifically 付ける, 産む, and 掛かる/掛ける that are missing). keigo remains fully reachable (9/9). All 4 lines are named explicitly in `KNOWN_OPEN_CONTENT_GAPS` in the test file so they don't block the suite while staying visible, and don't silently swallow any *other* future regression.

## What's left

Four transitivity pairs, all genuinely absent from `VOCAB` under the exact kanji headwords the pair's hand-authored English sentence and audit tests require:

- 濡れる/濡らす ("get wet"/"wet something") — absent entirely, no VOCAB entry under either spelling.
- 付く/付ける — 付く is taught; 付ける has no VOCAB entry under that kanji spelling (only つける, a different headword).
- 生まれる/産む — 生まれる is taught; 産む has no VOCAB entry under that kanji spelling (only 生む, a different word/sense).
- 掛かる/掛ける — neither kanji spelling has a VOCAB entry (only かかる/かける).

Each needs real dictionary content (readings, glosses, JMdict metadata) added to `VOCAB` under the exact kanji headword — not something to fabricate by hand, since `VOCAB` is generated data and hand-editing it would break the byte-correctness discipline the rest of this pipeline depends on. Options, for whoever picks this up:
1. Check whether JMdict's raw source has entries for these words that the ingest pipeline is dropping for some other reason (missing frequency data, POS filter, etc.) — if so, the real fix is in the ingest script.
2. If JMdict genuinely has no entry, source correct dictionary data for these words and add them through whatever process VOCAB's other entries went through, not as a one-off hand edit.
3. Until then, `KNOWN_OPEN_CONTENT_GAPS` in `interleaved-schedule.test.ts` keeps these named and visible rather than silently passing or permanently failing the suite. Do NOT "fix" the gate by renaming `transitivity.ts`'s kanji spellings to match whatever kana form VOCAB happens to have — that is exactly the mistake this document's earlier revision made and had to revert.
