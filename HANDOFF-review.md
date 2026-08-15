# Handoff: vocab curriculum expansion + a spelling regression to fix

Working directly on `main` in `saku` (no worktree, no PR — this user pushes
herself, never push for her). Nothing in this round is committed yet.

## What just happened (context)

A user report: after marking everything reachable as known, `/learn` said
"curriculum complete" but Library's "Not known" filter still showed hundreds
of ordinary words (置く, 警官, 水曜日, 一人, くださる, 彼ら, …).

Root cause, found and confirmed with data: `VOCAB` (12,555 words) is already
JMdict's own curated "everyday" set (`ichi1`/`spec1`/`spec2` tags — see
`src/data/vocab.ts`'s header comment). The OLD `CURRICULUM_WORDS` only taught
7,537 of those — the ones CEJC's conversation-recording corpus happened to
observe, or that a JLPT wordlist happened to gate. The other ~5,000
(図書館, 郵便局, 飛行機, 動物園, 誕生日, 水曜日, 警官, 自転車, …) are equally
"everyday" by JMdict's own curation; CEJC's specific recordings just never
said them out loud. This is the *same* root cause as an earlier fix this
session (a 29-word `FORCE_TAUGHT_KEBS` patch), just far larger in scope.

**User's explicit decision, asked and confirmed via AskUserQuestion:** extend
the curriculum to cover essentially all of VOCAB (not just the 7,537-word
CEJC/JLPT-gated subset), ordered by `beginnerRank` (a pre-existing TOTAL
ordering over all 12,555 words — CEJC order first, JLPT/OpenSubtitles-blended
fallback after — its own doc comment literally calls the fallback "that
unscheduled Library tail," i.e. this was anticipated).

## What's DONE (uncommitted, verified with `tsc --noEmit` — clean)

1. **`src/lib/word-lesson.ts`** — `CURRICULUM_WORDS` now filters VOCAB down to
   just the counter-track's own duplicates (`COUNTER_TRACK_KEBS` /
   `COUNTER_KANJI_GLYPHS` — words the counters track teaches under its own
   spoken-form entry, e.g. ひとつ vs the noun 一つ) and sorts by
   `beginnerRank`. Removed the now-redundant `FORCE_TAUGHT_KEBS` override (its
   29 words are subsumed) and the now-meaningless `WORDS_CURRICULUM_MAX`
   export (nothing else used it). New total: **12,540 words** (was 7,537).
   Doc comments at the top of the file rewritten to explain the new scope —
   read them, they're the full rationale.

2. **`src/lib/word-lesson.test.ts`** — rewrote the test that pinned the old
   7,537 scope to assert the new ~12,540 scope instead. Passing.

3. **`src/components/home/home-feed.tsx`** — unrelated, already-done, already
   verified UI change from earlier this session: removed position/range
   labels ("VOCAB 135–8,910 OF 9,140") from ALL `/learn` track cards per
   explicit user instruction ("remove the range/count from all of the
   tracks... either show it on all or nowhere"). Not part of what's broken
   below; leave as-is.

4. Regenerated `word-rank.json`, `library-index.json`, `learn-index.json`,
   `scheduling-preview.json` to match the new `CURRICULUM_WORDS`. Regenerate
   command for each is at the top of `scripts/build-*.mjs`; run via:
   ```
   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-word-rank.mjs
   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-library-index.mjs
   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-learn-index.mjs
   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-scheduling-preview.mjs
   ```
   **You will need to rerun the last two of these again** after the revert in
   the next section, since they read from `src/data/transitivity.ts`.

5. **`src/lib/content/interleaved-schedule.test.ts`** — added a
   `KNOWN_OPEN_CONTENT_GAPS` allowlist (currently just one entry:
   `"transitivity: 1/69 units never scheduled"`) for the 濡れる/濡らす pair,
   which is genuinely absent from VOCAB (verified: zero hits for
   ぬれる/ぬらす/濡れる/濡らす in `src/data/generated/vocab.json`). **This will
   need at least one more entry added** — see next section.

6. **`docs/interleaved-schedule-findings.md`** — updated to narrate the fix
   through step 4 above. **Needs another update pass** once the revert below
   lands (see "What's left to do", item 3).

## THE BUG YOU NEED TO FIX FIRST: a wrong "spelling fix" from earlier this session

Earlier in this session (before the curriculum-expansion work above), I
"fixed" 4 words in `src/data/transitivity.ts`, believing they were spelling
mismatches against VOCAB:

```
付ける → つける   (doIt side of the 付く/… pair)
産む   → 生む     (doIt side of the 生まれる/… "childbirth" pair)
掛かる → かかる   (happens side of a pair)
掛ける → かける   (doIt side of the same pair)
```

**This was wrong.** Running the full test suite after the curriculum
expansion surfaced pre-existing, deliberate audit tests that pin the ORIGINAL
kanji spellings on purpose:

- `src/data/transitivity-facts.test.ts:113` — `"childbirth is 産む — the
  standard spelling — not 生む"` — explicit comment: "生む is 'produce/give
  rise to' (an idea, a profit); 産む is the standard verb for bearing a
  child... The intransitive stays 生まれる."
- `src/data/audit-semantics.test.ts:139` — `"the two members share a kanji
  stem, save the one documented exception"` — a general invariant ("nearly
  every curated pair is one stem with two tails... any OTHER stem-less row is
  a sign two unrelated verbs got paired") with 生まれる/産む as the ONE named,
  intentional exception. My "fix" changing 産む→生む silently satisfied a
  DIFFERENT and wrong reading of this rule; changing 付ける→つける and
  掛かる/掛ける→かかる/かける broke it outright (both sides of those pairs lost
  their shared kanji stem entirely).
- `src/data/audit-semantics.test.ts` `TRANSITIVITY_SAMPLE` (~line 177) also
  pins `["生まれる","うまれる"] / ["産む","うむ"]` verbatim.

I confirmed with `node --import ./src/lib/conjugate/test-hooks.mjs` +
`VOCAB.filter(w => w.keb === "...")` that **VOCAB genuinely has no entry**
for 付ける, 掛かる, 掛ける, or 産む under those exact kanji spellings — only
付く, つける, かかる, かける, 生む exist. So my original diagnosis ("these are
just alternate spellings of words already taught") was half right and half
wrong: つける/かかる/かける/生む ARE real, separate VOCAB entries (not typos),
but they are NOT the same word/sense the transitivity pair's hand-authored
English sentence and audit tests intend. The kanji forms are the
linguistically correct, deliberately-authored choice, and VOCAB (JMdict's
curated common-word list) simply doesn't carry those specific kanji
headwords as their own entries — a genuine content gap, not a spelling bug.

### The fix

1. **Revert all 4 words in `src/data/transitivity.ts` back to their original
   kanji spellings**: つける→付ける, 生む→産む, かかる→掛かる, かける→掛ける.
   (Leave 片付ける/片付く alone — different word, was never touched.)
2. Re-run the full suite; `audit-semantics.test.ts` and
   `transitivity-facts.test.ts` should go back to green.
3. This reopens the scheduling gap those 4 words were meant to close (their
   `blockedBy` gate can never clear — `word:付ける` etc. don't exist in
   `CURRICULUM_WORDS`/VOCAB). Re-run
   `node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/interleaved-schedule.test.ts`
   to see the new `transitivity: N/69` count, and add each newly-surfaced
   "never scheduled" line to `KNOWN_OPEN_CONTENT_GAPS` in
   `interleaved-schedule.test.ts`, alongside the existing 濡れる/濡らす entry —
   same pattern, same reasoning (genuine VOCAB content gap, not a code bug).
   Update the doc comment above that `Set` to name all of them.
4. Rerun `build-scheduling-preview.mjs` and `build-learn-index.mjs` (these
   read `transitivity.ts`; the other two generated JSONs don't).
5. Update `docs/interleaved-schedule-findings.md`'s "What's left" section to
   list all the now-open gaps (濡れる/濡らす plus these 4/2 words — note
   付く/掛かる ARE taught under those exact kanji already; it's specifically
   付ける, 掛ける, 産む that are missing) instead of claiming they were fixed.

## What's left to do after that

Full `npm test` (background it — the suite got slower after the curriculum
roughly doubled; use `run_in_background: true` and wait for the
notification, don't poll) was run ONCE after the curriculum-expansion change
and before the transitivity.ts revert. It reported **15 failing tests**,
`3123/3138` passing. Some are the transitivity-spelling regression above
(will likely clear on revert); the rest are almost certainly **stale
hardcoded counts/snapshots** in tests that assumed the old 7,537-word
curriculum boundary — this is the same class of fix as the `7508→7537`
one-liner earlier in this session (`word-lesson.test.ts:141`), just spread
across more files now that the curriculum roughly doubled in size. Full list
from that run (re-run after the revert — some may already be fixed, some
may show different numbers):

```
✖ transitivity direction is consistent with the JMdict tags
✖ transitivity direction sample: happens is vi-side, doIt is vt-side
✖ CEJC owns word-track priority
✖ authored glosses teach the standard word and sense (task-20 item 7)
✖ transitivityItems — a pair is BLOCKED BY its two member verbs, not taught with kanji
✖ verbPairUnitsOf — 生まれる/産む shares no kanji, so base is empty
✖ the totals are counted off the data, never typed in
✖ the single-kanji fold
✖ the tail
✖ wordClimbRank is the words' curriculum climb
✖ pairPattern over the curriculum
✖ the two members share a kanji stem, save the one documented exception
✖ 生まれる (it happens) / 産む (someone does it)
✖ CEJC POS keeps grammar and fillers out of the word track
✖ childbirth is 産む — the standard spelling — not 生む
```

Plus, from an earlier check specifically (may or may not be in the list
above depending on suite ordering/timeout):
- `src/lib/curriculum-order.test.ts` — a hardcoded `14172` needs to become
  whatever `CURRICULUM_SEQUENCE.length` actually is post-revert (was 14,094
  right after the curriculum expansion, pre-revert; will change slightly
  once the 4 transitivity words are reverted, though revert doesn't touch
  VOCAB/CURRICULUM_WORDS itself so it may not move at all — check by running
  the test and reading its own "actual" value out of the assertion failure).
- `src/lib/library/ranged-groups.test.ts` — `"a word the spine never teaches
  trails every spine word, in beginnerRank order"` failed with `12349 !== -1`.
  **This one needs actual thought, not just a number swap**: it's testing
  what happens to a word the curriculum's spine never reaches, and now that
  curriculum covers ~99% of VOCAB, that test's premise (there's a comfortably
  large excluded tail to pick a sample word from) may no longer hold the way
  it used to. Read the test, understand what it's actually checking, and
  either pick a still-valid excluded word (a counter-owned duplicate, e.g.
  一人 or 一つ) or rewrite the assertion to match the new near-total scope.

**Method for each failure**: read the test, understand WHAT invariant it's
protecting (don't just make the assertion match reality blindly — some of
these might be catching a real problem, not just be stale). For pure
snapshot/count staleness (the vast majority, given the curriculum's size
roughly doubled), update the hardcoded number to the actual computed value
and add/keep a one-line comment on why it moved. This user has been explicit
all session: verify with code/data before changing an assertion, and
prefer explaining *why* a number changed over silently updating it.

## Final steps once everything is green

1. Full `npm test` clean (background it, wait for notification).
2. Commit. This user's own words on process: never push, never worktree for
   this kind of direct-on-main work, commit locally only. Match the style of
   the two prior commits this session (`bcffa2a`, `6f8aae4`): explain root
   cause, what changed, verification numbers, in the commit body.
3. Do NOT `git push` — this user pushes herself.

## Files touched this round (uncommitted)

```
 M docs/interleaved-schedule-findings.md
 M src/components/home/home-feed.tsx        (unrelated, already-verified, leave as-is)
 M src/data/generated/learn-index.json
 M src/data/generated/library-index.json
 M src/data/generated/scheduling-preview.json
 M src/data/generated/word-rank.json
 M src/data/transitivity.ts                  ← REVERT 4 WORDS, SEE ABOVE
 M src/lib/content/interleaved-schedule.test.ts
 M src/lib/word-lesson.test.ts
 M src/lib/word-lesson.ts
```
