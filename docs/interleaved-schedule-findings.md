# Findings: 75% of the curriculum's vocabulary was never scheduled — FIXED — plus two scheduling/data bugs found and fixed along the way

**Status: fully fixed and verified; `interleaved-schedule.test.ts` is fully green with no allowlist.** The multi-character coverage bug is fixed and verified. The word track was later widened to essentially all of `VOCAB` (~12,540 words, not just the ~7,537 CEJC/JLPT-gated subset — see `word-lesson.ts`), which subsumed the 29-word `FORCE_TAUGHT_KEBS` override entirely. A separate, since-corrected mistake in this investigation initially "fixed" 4 transitivity pairs (付ける→つける, 産む→生む, 掛かる→かかる, 掛ける→かける) believing they were spelling mismatches against `VOCAB`; that first attempt was wrong for a different reason than initially thought and was reverted, then re-examined against the raw JMdict source. Two of the four (付ける, 掛かる/掛ける) turned out to be the exact same words as their `VOCAB` kana spellings — JMdict just tags them "usually written using kana alone" — and are now spelled to match `VOCAB`. The remaining two (産む, 濡れる/濡らす) are genuine content gaps with no safe respelling — but a SEPARATE bug ("Round five" below) meant they were being scheduled anyway and relying on a permanent `blockedBy` gate to hide it; fixing that bug means the reachability test passes cleanly without needing to allowlist or tolerate anything. See "What's left" at the bottom for the two content gaps that remain, now correctly unscheduled rather than silently broken.

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

**Verified impact:** `interleaved-schedule.test.ts`'s reachability test reported `transitivity: 4/69 units never scheduled` right after the revert above — 濡れる/濡らす plus the 3 reverted pairs (付く/付ける, 生まれる/産む, 掛かる/掛ける). A follow-up pass (see "Round four" below) resolved 2 of those 3 by matching `VOCAB`'s real spelling instead of the pair's hand-authored kanji, leaving `transitivity: 2/69` — 濡れる/濡らす and 生まれる/産む. keigo is fully reachable (9/9). This test has NO allowlist for the remaining 2 — it is left failing on purpose until they are actually fixed, so the gap stays impossible to miss rather than quietly tolerated.

## Round four: matching VOCAB's real spelling instead of reverting to kanji

The revert above restored `transitivity.ts`'s hand-authored kanji spellings (付ける, 掛かる, 掛ける, 産む), on the reasoning that they were the linguistically correct choice and `VOCAB` simply lacked those headwords. Checking the raw JMdict source directly (cached at `scripts/ingest/raw/jmdict/JMdict_e.gz`) complicated that story:

- **付ける, 掛かる, 掛ける are JMdict-tagged `uk` ("usually written using kana alone")** on their first sense. `scripts/ingest/build.py`'s own kana-detection (`kana = (not kels) or (UK in misc0)`) deliberately drops every kanji spelling for a `uk`-tagged entry and keeps only the kana reading — the same rule that keeps これ/とても kana-only despite having kanji forms. So `VOCAB`'s つける/かかる/かける are not missing spellings of a different word — they ARE 付ける/掛かる/掛ける, just spelled the way `VOCAB`'s own ingest (correctly, per JMdict) represents them.
- **産む is a different case**: no `uk` tag, but the SAME JMdict entry lists 生む first among its kanji spellings, and `build.py`'s tie-break ("first `k_ele` carrying a CURATED tag wins") picks 生む over 産む even though both are tagged. `VOCAB` genuinely does not carry a 産む row — and the two ARE different senses (産む = bear a child, 生む = produce/give rise to), the distinction `transitivity-facts.test.ts` deliberately pins.
- **濡れる/濡らす are a third case, unrelated to spelling**: this app's own `kanji.json` has exactly 2,136 rows (the correct jōyō count) and 濡 is not one of them. `build.py` requires every kanji in a word to be jōyō, so 濡れる/濡らす are excluded outright, under any spelling.

**Fix:** `付ける→つける`, `掛かる→かかる`, `掛ける→かける` in `transitivity.ts` — same words, spelled to match what `VOCAB` (and the learner) actually sees. `産む` was deliberately left unchanged (kept the semantically precise word over VOCAB-matching convenience) and stays a documented gap alongside 濡れる/濡らす.

This also retired `audit-semantics.test.ts`'s "the two members share a kanji stem" heuristic: it assumed a correctly-paired verb always shares kanji with its partner, which a `uk`-tagged kana spelling can no longer guarantee. Replaced with a stronger, direct check — every pair member's word+reading must be an exact `VOCAB` entry, save the two documented exceptions (産む, 濡れる/濡らす) — plus `transitivity-pattern.test.ts`'s existing reading-based tail-shift classification, which was already spelling-agnostic and still independently catches a genuinely mispaired verb.

`verb-pair-unit.ts`'s item `glyph` also dropped its "shared kanji" override (it computed a value nothing actually rendered — the Library index and the live teach card both already used the happens-side word) in favor of just using that word directly, matching every other view of the item. The pair-relationship reminder shown on the Library page (`VerbPairEntryView`) still works the same way for kana-spelled pairs, since its own shared-leading-characters helper (now the one canonical `sharedStem` in `transitivity-facts.ts`) isn't kanji-restricted — it simply renders nothing when a pair shares no leading run, exactly as it already did for 生まれる/産む.

## Round five: two lists of transitivity pairs, and the schedule was reading the wrong one

Even after round four, `interleaved-schedule.test.ts` still reported `transitivity: 2/69` — 生まれる/産む and 濡れる/濡らす permanently stuck. Per this session's own updated discipline (no allowlisting a known gap quiet — removed `KNOWN_OPEN_CONTENT_GAPS` entirely), the reachability test was left RED on those two rather than hidden. Digging into why they were ever scheduled at all surfaced a real, separate bug:

`src/data/transitivity.ts` curates 69 pairs, unconditionally. Two different downstream consumers read them:

- **`transitivity-lesson.ts`'s `CURRICULUM_PAIRS`** — explicitly filters to pairs whose BOTH verbs are actual curriculum words (`isCurriculumWord`), because (its own header) *"a pair's unit is two verbs the learner already met... so only pairs whose BOTH verbs are in the CEJC word curriculum can ever be reached."* This is what `shelves.tsx` already uses to build the Library's "Verb pairs" browse shelf — so the shelf has always correctly hidden 生まれる/産む and 濡れる/濡らす.
- **`verb-pair-unit.ts`'s `transitivityItems()`** (what `unit-tracks.ts` actually schedules for `/learn`) — was never wired to `CURRICULUM_PAIRS`. It built a `ContentItem` for all 69 pairs unconditionally (via the raw fact registry, `TRANSITIVITY_FACTS`) and relied ENTIRELY on the `blockedBy` gate to hold back the ones that aren't ready. That works fine for a pair that's merely rare and will eventually clear — it does not work for a pair whose verb can NEVER clear, which produces exactly the permanently-stuck ghost unit this test was failing on.

So the two "documented gaps" were never actually gaps in the curated DATA (`VERB_PAIRS` correctly has 69 well-formed pairs) — they were a scheduling bug: the `/learn` track and the Library shelf silently disagreed about which pairs "the app teaches", and the shelf had it right the whole time.

**Fix:** `transitivityItems()` now builds from `CURRICULUM_PAIRS` instead of the raw fact registry. A pair whose verb isn't reachable is excluded from the schedule entirely, the same way the Library shelf already excluded it — not built-and-blocked-forever. **Verified impact:** `interleaved-schedule.test.ts` now reports `transitivity: 0/67 units never scheduled` (69 curated → 67 schedulable) and passes clean, with no allowlist needed, because the two unreachable pairs are no longer part of the schedule to report on.

## Status of the two content gaps

生まれる/産む and 濡れる/濡らす remain genuinely absent from `VOCAB` under any spelling this table could use — that underlying data limitation is UNCHANGED by round five. What changed is how the app behaves about it: instead of scheduling a permanently-unmeetable unit and relying on a test allowlist to tolerate it, the pair is simply not part of the taught curriculum, consistent with every other of the ~1,100 transitivity-tagged verbs this table never curated a partner for (§ transitivity.ts's own "ABSENCE IS DATA" note). The curated data (`VERB_PAIRS`, still 69 rows) is untouched and still fully documents both pairs for reference — they simply aren't scheduled or shown on the Library shelf until `VOCAB`/`kanji.json` gain the words they need.

## What's left

Nothing at the scheduling layer — `interleaved-schedule.test.ts` is fully green with no allowlist. Two genuine content gaps remain UPSTREAM of scheduling, both requiring real dictionary/kanji-table content, not a code or config change:

- **生まれる/産む** — 生まれる is taught; 産む has no `VOCAB` entry (only 生む, a different word/sense that `transitivity-facts.test.ts` deliberately distinguishes from it). Renaming to 生む would technically clear the gate but trade away that precision.
- **濡れる/濡らす** ("get wet"/"wet something") — absent entirely; 濡 is not one of the 2,136 kanji this app treats as jōyō, so `build.py`'s ingest excludes any word containing it, under any spelling.

Neither is something to fabricate by hand, since `VOCAB` and `kanji.json` are generated data and hand-editing either would break the byte-correctness discipline the rest of this pipeline depends on. Options, for whoever picks this up:
1. For 産む: reconsider whether 生む is an acceptable substitute for the "she had a baby" sentence, or source a real 産む entry through whatever process would add a second kanji spelling to an existing JMdict-merged headword.
2. For 濡れる/濡らす: confirm whether 濡 should be treated as jōyō in this app's `kanji.json` (it may be a genuine omission from the 2,136 table, separate from the vocab question), or accept the gap.
3. Once either is fixed upstream (a real `VOCAB`/`kanji.json` entry, not a respelling), the pair automatically re-enters `CURRICULUM_PAIRS` and gets scheduled — no code change needed here. Do NOT "fix" either by picking whatever spelling happens to make `isCurriculumWord` return true without checking, first, whether that spelling is the SAME word (safe, as 付ける/掛かる/掛ける turned out to be) or a genuinely different sense (not safe, as 産む/生む is).
