# Particle teaching fixes — parallel work plan

Context: か/は/が/に/で/を/へ/まで/までに/だけ/しか〜ない were added as grammar-track
"recipes" (meaning-only facts, one example sentence each) in a prior session, and
we found four follow-on problems while reviewing that work:

1. They rank ~lesson 9-11 (or later, in an interleaved multi-track view) in the
   grammar track's teaching order — an accident of where they sit in
   `RECIPES`' source order, not a deliberate choice. They should lead, right
   after the foundational forms.
2. Ten of the eleven are missing the 〜 prefix every other bare-attachment
   pattern in the table carries (〜なら, 〜から, 〜ので all have it; は/が/に/で/を/
   へ/まで/までに/だけ/か don't). しか〜ない already has it.
3. 〜しか〜ない is misfiled: it's the only one of the eleven that's actually
   `isProducible` (a real conjugation drill, verb+ない after しか) — everything
   else is `isVacuous`/meaning-only. It doesn't need to move, but don't treat
   it like its siblings when reasoning about "the particles."
4. The sentence-ordering track's "simple" tier requires **zero** grammar
   prerequisites (`grammarPrereqs: []`) before a learner starts building
   sentences with は/が/を pieces — stale now that those particles are real
   grammar lessons, not just "structural, assumed known."

Separately, we want a new dev-only page that shows one example of every quiz
question type the app can generate, grouped by subject, so we can eyeball the
new particle-drill type alongside everything else.

## How to use this doc

Five packages below are scoped to **non-overlapping files** so they can run in
parallel, with two soft-dependencies noted explicitly. Each package lists:
what to do, exactly which files it owns, what NOT to touch, and how to verify
it's done. If you're an agent picking one of these up, read your package
section only — you don't need the others' detail, just the "shared contracts"
callouts.

Run `pnpm test` (unit) before finishing any package. Run the listed
`pnpm exec playwright test ...` subset too — full e2e is slow, don't run the
whole suite per package. Regenerate generated JSON with
`pnpm run prebuild` if you touch anything under `src/data/` or `src/lib/curriculum-order.ts`
/ `src/lib/word-lesson.ts` (nothing in this plan touches those, but recipe
count/order changes do feed `learn-index.json` etc. — check `git status` for
unexpected diffs under `src/data/generated/` and regenerate if needed).

---

## Package 1 — Reorder + reformat the particle recipes

**Owns:** `src/data/grammar/recipes.ts` only (plus whatever tests it breaks —
see below).

**Do:**
1. Move the particle block — `wa`, `ga`, `ni`, `de`, `wo`, `e`, `made`,
   `made-ni`, `dake`, `shika-nai`, `ka` (currently sitting right before the
   "N3 — PAST THE N4 WALL" section) — to immediately after the three
   foundation rows `prenominal-form`, `te-sequence`, `te-iru` (see
   `foundationRank()` in `src/lib/grammar-lesson.ts` — you're not touching
   that function, just moving data so its existing tie-break lands these
   particles first among N5 rows instead of last).
2. Add the 〜 prefix to the `pattern` field of: `wa` (は→〜は), `ga`, `ni`,
   `de`, `wo`, `e`, `made`, `made-ni`, `dake`, `ka`. Leave `shika-nai` alone
   (`〜しか〜ない` already has it). Only the `pattern` string changes — `id`
   stays the same, and don't touch `authored.ts`'s `hostSurface`/`hostDict`
   fields (those must keep matching the literal example-sentence substrings,
   which never had 〜 in them).
3. Update the comment above the particle block — it currently reads like
   these are a late addendum; rewrite it to explain they're foundational and
   lead the N5 tier for that reason.

**Don't touch:** `authored.ts`, `assembly.ts`, `questions.ts`, `grammar-shelf.ts`
(these already reference particles by `id`, not by position or by `pattern`
string, so reordering/reformatting recipes.ts shouldn't require touching
them — if you find a place that breaks because it does, fix that call site
minimally, not the whole file).

**Fix whatever tests break** (run `pnpm test`, expect some of these to need
updating — they pin recipe order/position and `pattern`-string equality):
- `src/lib/grammar-lesson.test.ts` — sitting/lesson grouping boundaries can
  shift because a sitting group is `<=3` patterns; moving particles earlier
  may change which patterns land in which sitting. Recompute expected numbers,
  don't just bump them blind — verify with a quick script like the one used
  earlier in this session (`CURRICULUM_PATTERNS.findIndex(...)`).
- `src/lib/library/grammar-shelf.test.ts` — has a "sections appear in teaching
  order" check; particles moving earlier changes where the Particles section
  ranks relative to form sections. Update the ordering assertion, not just
  the membership one.
- `src/data/grammar/authored.test.ts` — the "span ends in its tagged pattern"
  check strips 〜 before comparing (`recipe(pat)?.pattern.replace(/[〜]/g, "")`),
  so adding 〜 to the `pattern` field should be transparent here. Just confirm
  it's still green.
- Search for any other literal `"は"` / `"が"` / etc. pattern-string
  assertions with `grep -rn 'pattern.*"は"\|pattern.*"が"'` style searches
  across `src/` and `e2e/` before calling this done.

**Verify:**
```
pnpm test
pnpm exec playwright test e2e/grammar-quiz.spec.ts e2e/grammar-concept.spec.ts e2e/grammar-family-links.spec.ts e2e/library.spec.ts
```

**Status: done.** The particle block now sits right after `te-iru`, all ten
non-`shika-nai` `pattern` fields carry 〜, and the block comment explains they
lead the N5 tier. `authored.ts`/`assembly.ts`/`questions.ts`/`grammar-shelf.ts`
needed no source changes. Tests updated for the new order/count:
- `grammar-lesson.test.ts`: `GRAMMAR_SITTINGS_TOTAL` 47 → 46 (particles now
  bundle into runs of <=3 with neighboring N5 pattern lessons instead of
  opening sittings of their own).
- `grammar-shelf.test.ts`: the "Particles" section now leads at index 2,
  right after て/で-form, ahead of ない/た/stem.
- `formula.test.ts`: `shika-nai` now sorts before `node` in RECIPES order.
- `questions.test.ts`: swapped hardcoded `"は"`/`"が"`/`"に"`/`"で"` literals
  for `recipe(id)!.pattern` lookups, since those now carry 〜.
- `authored.test.ts`: unaffected, confirmed still green.

`pnpm test` (3147 tests) and the listed Playwright subset (39 tests) are green.

---

## Package 2 — Gate sentence tier "simple" on は/が

**Owns:** `src/data/assembly.ts` (the `SENTENCE_ORDERING_TIERS` "simple" entry
and the stale doc comment on `AssemblyTier.grammarPrereqs`), plus whatever
tests assert the old empty-prereqs behavior.

**Do:**
1. In `SENTENCE_ORDERING_TIERS`, change the `simple` tier's
   `grammarPrereqs: []` to `grammarPrereqs: ["wa", "ga"]` (ANY-of gate per the
   existing `sentenceTierUnlocked()` semantics in
   `src/lib/sentence-ordering-plan.ts` — one of the two being tested is
   enough to unlock).
2. Fix the comment on `AssemblyTier.grammarPrereqs` ("Empty for the simple
   tier — its patterns are structural particles that the grammar track never
   teaches as lessons") and the inline comment on the `simple` entry itself
   ("Particles are structural markers, never taught as grammar lessons.") —
   both are false now.
3. Find and update tests asserting the old behavior — search
   `grammarPrereqs` and `"simple"` together in `*.test.ts` files near
   `src/lib/sentence-ordering-plan.ts`, `src/data/assembly.test.ts`.

**Don't touch:** `recipes.ts`, `authored.ts`, `questions.ts`.

**Soft dependency on Package 1:** this only makes sense once は/が are taught
early (Package 1). It's fine to develop in parallel — the code change here
doesn't reference recipe file order — but don't merge Package 2 alone into a
build where は/が still sit at lesson ~9-17; merge them together or Package 1
first.

**Verify:**
```
pnpm test
pnpm exec playwright test e2e/sentence-gates.spec.ts e2e/lessons-grammar-bundle.spec.ts e2e/results-grammar-progress.spec.ts
```

**Status: done.**
- `simple` tier's `grammarPrereqs` is now `["wa", "ga"]`; both stale comments
  (on `AssemblyTier.grammarPrereqs` and the `simple` entry) fixed, plus a
  matching stale comment in `sentenceTierUnlocked()`
  (`src/lib/sentence-ordering-plan.ts`).
- Updated tests: `src/lib/sentence-ordering-plan.test.ts` (the "opens Simple"
  case now seeds `wa`; added a case proving vocabulary alone no longer
  unlocks it) and `e2e/sentence-gates.spec.ts` (same, plus a new "waits for
  wa/ga even with enough vocabulary" case).
- Regenerated `src/data/generated/*.json` via `pnpm run prebuild` (the tier's
  `grammarPrereqFacts` feed `learn-index.json`).
- `pnpm test`: 3147/3147 pass (re-verified after Packages 1/3/4/5 landed in
  the same tree, which cleared the 2 Package-1 test failures noted earlier).
- The three listed Playwright specs: 5/5 pass.
- **Merge note (resolved):** Package 1 (は/が taught early) is present in
  this tree and its own tests are green, so this package's soft dependency
  is satisfied — safe to merge together.

---

## Package 3 — Real example-sentence data for particle drills

**Owns:** a **new** file `src/data/grammar/particle-drill-examples.ts` (data
only, hand-reviewed) and, if you write one, a one-off script under `scripts/`
to help mine candidates (not wired into `prebuild` — this is a manual-review
process, not a repeatable build step).

**Do NOT edit** `src/data/grammar/authored.ts` — that file's existing 11
particle rows stay as the small "reference example on the Library page" set
they were built for. This package is building the **larger, separately-owned
dataset** the new drill quiz (Package 4) needs, in its own file, specifically
so the two packages never touch the same file.

**Shared data contract** (Package 4 needs this shape; don't change it without
flagging in this doc — if you do need to change it, both packages need to
agree):
```typescript
export interface ParticleDrillExample {
  /** Negative, like authored.ts's convention — never a Tatoeba permalink. */
  readonly id: number;
  readonly recipe: string; // "wa" | "ga" | "wo" | "ni" | "de" | ...
  readonly jp: string;
  readonly en: string;
  /** The particle's own span — [start, end) into `jp`. */
  readonly particleSpan: readonly [number, number];
  /** The word/phrase span the particle marks — [start, end) into `jp`. This
   * is the thing the drill asks the learner to tap. */
  readonly markedWordSpan: readonly [number, number];
  /** Other tappable chunks in the sentence, for multiple-choice distractors —
   * e.g. the predicate, or another particle-marked phrase. At least one. */
  readonly distractorSpans: readonly (readonly [number, number])[];
}
```

**Sourcing, in order of preference:**
1. **Mine `src/data/generated/assembly-corpus.json`.** It's already tokenized
   into pieces (`{t: text, h: dictionary-form}`) for the drag-to-build screen.
   For a noun-hosted particle (は/が/に/で/を), a piece whose text ends in the
   particle and starts with its own `h` (i.e. `piece.t.startsWith(piece.h)`)
   safely isolates "content word + particle" without guessing at word
   boundaries in raw text. A scan like this found real counts in this corpus
   already: は 68, が 94, を 60, で 30, に ~99 (but see the false-positive
   warning below — that に count is inflated).
2. **Verify every mined hit by hand before shipping it.** The mining
   technique above already produced one confirmed false positive in testing:
   "日本へ行けたらいいのに" matched に (head "いい", remainder "のに") when the
   real grammar there is the unrelated 〜のに contrastive pattern, not location
   に. Reject anything where the extracted remainder is itself a string that
   collides with a DIFFERENT recipe's pattern (cross-check against
   `RECIPES.map(r => r.pattern.replace(/[〜]/g, ""))` — if the remainder
   matches or is a suffix of another pattern, throw it out or inspect closely).
   Also reject any sentence where the target particle appears more than once
   (ambiguous which occurrence is "the" answer — this feature doesn't support
   multiple correct spans yet).
3. **Hand-author the rest.** へ and まで only had 3 candidates each in the
   corpus; だけ and しか had zero. Write ~10 short, simple sentences for each
   of へ/まで/だけ/しか by hand, same discipline as the existing `authored.ts`
   rows (one particle occurrence per sentence, verified by a human).
4. Target ~10-15 verified rows for は/が/を/に/で (from mining), ~10 each for
   へ/まで/だけ/しか (hand-authored). か doesn't need this treatment yet — it's
   scoped out of the first drill pass (see Package 4).

**Verify:** write a small test (`particle-drill-examples.test.ts`) mirroring
`authored.test.ts`'s checks: every span is in-bounds, `markedWordSpan` and
`particleSpan` don't overlap, `particleSpan`'s slice equals the recipe's bare
pattern text, every row's `recipe` id exists in `RECIPES`, no two rows share
an `id`, ids are negative.

**No dependency on Packages 1, 2, 4, or 5** — this is pure data work against
existing generated JSON and can start immediately.

**Status: done.** `src/data/grammar/particle-drill-examples.ts` exports the
`ParticleDrillExample` interface exactly as specified above and
`PARTICLE_DRILL_EXAMPLES` (98 rows); `authored.ts` was not touched. Spans are
resolved from plain-text anchors at module load (same pattern `authored.ts`
uses with `indexOf`), so a typo throws immediately instead of shipping a bad
span.
- **Mined** (`scripts/mine-particle-drill-examples.ts`, not wired into
  `prebuild`): 12 rows each for は/が/を/に, 10 for で. The mining rule
  requires the piece's remainder to equal the target particle EXACTLY
  (`piece.t.slice(piece.h.length) === particle`), not just end with it — this
  is what keeps out the いいのに false positive from the sourcing notes above:
  there the remainder is "のに" (two chars), never equal to "に" (one char),
  so it's excluded before any cross-pattern check is even needed. Every
  mined row was also hand-read for sense before inclusion.
- **Hand-authored:** 10 rows each for へ/まで/だけ/しか (corpus had ~3
  candidates for へ/まで and 0 for だけ/しか). `しか` rows span only the
  opening `しか`, matching `authored.ts`'s existing convention for
  `shika-nai`.
- `particle-drill-examples.test.ts` passes 5 checks (ids negative/unique,
  recipe ids valid, particle/marked spans in-bounds and non-overlapping,
  distractor spans in-bounds and non-overlapping, particleSpan slice matches
  the recipe's bare pattern — tolerant of Package 1's added 〜 prefix since
  both sides strip it before comparing).

`pnpm test` is green (3163 tests, full suite, after Packages 1/2/4/5's
changes landed alongside this one).

---

## Package 4 — "Tap the marked word" quiz question type

**Owns:** new files only — propose something like
`src/lib/engine/particle-drill.ts` (question logic: build a question from a
`ParticleDrillExample`, grade a tap, produce distractor spans) and a new quiz
UI piece under `src/components/quiz/` (rendering a sentence as separated,
tappable, initially-neutral chunks — reveal correct/wrong per-chunk after the
tap, the same "reveal after, not before" discipline the matching-pairs screen
already uses for its cards). Wire the new type into whatever dispatch
`questionsFor()` / `drill-screen.tsx` uses to pick a question shape per fact,
scoped ONLY to は/が/を's own particle facts (use the existing
`PARTICLE_IDS`/`PARTICLE_ALLOWLIST` pattern in `src/lib/grammar/questions.ts`
as your model for how to keep this scoped and safe — you may need to add a
new small set there, e.g. which particle ids get the tap-drill vs. the plain
meaning MC, but don't change the existing allowlist's meaning).

**Depends on Package 3's data shape** (`ParticleDrillExample`, above) but
**does not need to wait for Package 3's data to be filled in** — build and
test against a small hand-written stub (2-3 examples, e.g. reuse the shape
with 猫が好きです / 私は学生です inline) so this package is fully unblocked, then
swap the import to the real `particle-drill-examples.ts` file once Package 3
lands. If you need the shared shape to change, say so in this doc rather than
just changing it — Package 3 is reading the same interface.

**Scope to は/が/を only** for this first pass (cleanest subject/topic/object
cases per prior discussion) — leave に/で/へ/まで/だけ/しか for a follow-up once
this shape is proven out.

**Key design constraints** (from prior discussion, don't relitigate these):
- The learner sees the COMPLETE, correct sentence — never a blank to fill.
  This is what makes it safe where は/が cloze wasn't: you're asking "which
  word does this already-written sentence mark," a fact, not "which particle
  goes here," a judgment call that's often genuinely ambiguous.
- No pre-coloring of the answer. Chunks render neutrally; correctness is
  revealed only after the learner taps one.
- One question per sentence occurrence — if `ParticleDrillExample` mining
  ever grows to support sentences with two occurrences of the same particle,
  that's future work, not this pass.

**Verify:** unit tests for the grading/distractor logic (pure functions,
easy to test without any UI). For UI/e2e, add a new spec modeled on
`e2e/grammar-quiz.spec.ts`'s existing "a reference pattern is drilled by
meaning, not production" test — seed a single は or が fact, start the quiz,
assert the new card type renders with tappable chunks and grades a tap
correctly.

**Status: done**, against the hand-written stub (Package 3 landed afterward —
see the follow-up below).

- New files only, as scoped: `src/lib/engine/particle-drill.ts` (build a
  question from a `ParticleDrillExample`, grade a tap, cap distractors at 3),
  `src/lib/engine/particle-drill-example-stubs.ts` (3 rows — 猫が好きです /
  私は学生です / パンを食べます — TEMPORARY, see follow-up), its test
  (`particle-drill.test.ts`), and `src/components/quiz/particle-tap-card.tsx`
  (the tappable-sentence UI: neutral chunks, no pre-coloring, the particle
  itself set apart visually but never tappable, reveal-after-tap per chunk).
- `PARTICLE_TAP_DRILL_IDS` (new, separate from `PARTICLE_ALLOWLIST`) added to
  `lib/grammar/questions.ts`, scoped to `["wa", "ga", "wo"]`. Does not change
  what `PARTICLE_ALLOWLIST`/`PARTICLE_IDS` mean — those still govern SELECTION
  only, where は/が stay banned.
- Wired into `drill-screen.tsx`: a new `DrillQuestion.particleDrill` field,
  rolled in `presentCard()` right beside `grammarSelection` (the two never
  collide — `grammarSelectionFor` is always empty for は/が/を, since its own
  distractor pool is gated by the SAME `PARTICLE_ALLOWLIST`/`PARTICLE_IDS`
  check). Graded through a new 4th `submit()` argument, `particleDrillPick`,
  parallel to the existing `recognitionPick`.
- New e2e spec `e2e/grammar-particle-tap-drill.spec.ts`, modeled on the
  referenced test. **Required a one-line fix to
  `e2e/grammar-quiz.spec.ts`**: its `REFERENCE` pick (`RECIPES.find(r =>
  !isProducible(r))`) was silently resolving to `wa`, which now draws the
  dedicated tap-drill card instead of the generic fixed-meaning MC fallback
  that test is pinning — `REFERENCE` now also excludes
  `PARTICLE_TAP_DRILL_IDS`.
- Verified: `pnpm test` (3163 tests, green), the new spec plus
  `grammar-quiz.spec.ts`/`grammar-concept.spec.ts`/`grammar-family-links.spec.ts`/
  `library.spec.ts`/`ask-forms-settings.spec.ts`/other adjective-form specs
  (all green), `pnpm run type-check` clean, `eslint` clean on every new/edited
  file (one `react-hooks/set-state-in-effect` fix along the way — the tapped
  state resets during render on a new `question` reference, not in a
  `useEffect`).

**Follow-up, now that Package 3 has landed: done.** `particle-drill.ts` now
imports `ParticleDrillExample`/`PARTICLE_DRILL_EXAMPLES` from
`@/data/grammar/particle-drill-examples` (re-exporting the type for its own
consumers) instead of the local copy; `particle-drill-example-stubs.ts` is
deleted. No extra filtering by `PARTICLE_TAP_DRILL_IDS` was needed —
`examplesForRecipe` already filters by exact recipe id, and `particleDrillFor`
only ever calls it for a fact already gated through `PARTICLE_TAP_DRILL_IDS`,
so the real dataset's に/で/へ/まで/だけ/しか rows are never reached by this
drill. **Required a test fix**: `e2e/grammar-particle-tap-drill.spec.ts`
hardcoded the stub's literal sentence text ("猫"/"好き") — with 12 real が
candidates to roll from, that assertion is now content-independent (asserts
the drill's SHAPE: ≥2 tappable chunks scoped to `p[lang="ja"] button`, no
pre-coloring, tapping in order until exactly one reveals success), verified
stable across `--repeat-each=5`.

---

## Package 5 — `/dev/quiz-gallery`: one example of every quiz type

**Status: done**, after two rounds of review following the initial ship.

**Round 1 (user review of content/structure):** the first pass read as an
"explain the quiz" debug sheet rather than the quiz itself, split grammar
across four sections instead of one, and had three real data bugs: en2jp MC
boards fell back to English option labels (a direction-blind fallback tried
`answers[0]` — jp2en's shape — before `glyph`, corrupting every subject
without its own `optionLabel` override), the grammar-production sample
resolved to nothing (recipes split production facts PER CONJUGATION CLASS,
not one id per recipe), and Numbers used a vocab-meaning fact instead of a
real `isConstructionFact` id, so all three directions rendered identically.
Rewritten to fix all three and to render every card through the SAME
components the real drill uses — `DrillHalo` for the glyph/sentence stage,
copied MC-grid/typed-input markup from `drill-screen.tsx`, and (once Package 4
had landed) the real `ParticleTapCard` in place of the placeholder. Grammar's
four showings are now one `Section` with `Sub`-headings.

**Round 2 (user-reported console error):** "Encountered a script tag while
rendering React component" on `src/app/layout.tsx`'s `<script
dangerouslySetInnerHTML>` (the no-flash theme script), reproducible via
client-side navigation into the gallery. Root cause: the page had been marked
`"use client"` wholesale (needed only because `ParticleTapCard.onTap` is a
function prop, which a Server Component can't pass to a Client Component
inline) — a client-boundary page apparently changes how the root layout's
head script is reconciled during a soft navigation, vs. a Server Component
page. Fixed by isolating JUST that one piece into a new tiny Client Component,
`src/app/dev/quiz-gallery/particle-tap-preview.tsx`, and reverting the page
itself to a Server Component. `DrillHalo` (also a Client Component, used
throughout every other card) never needed this treatment because this page
never passes it a function prop.

Verified, both rounds: `pnpm run type-check`, `pnpm exec eslint`, `pnpm test`
(3163 tests), and a live render/interaction check in the browser — real
Japanese options on every en2jp board, three distinct correct answers across
the Numbers directions, and a working tappable sentence for the particle
drill, with the page back to a plain Server Component.

**Owns:** `src/app/dev/quiz-gallery/page.tsx` and
`src/app/dev/quiz-gallery/particle-tap-preview.tsx`. No changes to any
existing `/dev/*` route or to `drill-screen.tsx`.

**Do:** follow the existing `/dev/views` convention exactly — a plain,
server-rendered, read-only gallery page (see `src/app/dev/views/page.tsx` for
the pattern: build one representative real item per type using existing
content-builder functions, no interactivity required, gated non-production
automatically by the existing `src/app/dev/layout.tsx`). For each entry
below, build/seed the minimal fact needed (reuse the same builder functions
`/dev/views` already uses — `buildGlyphItem`, `buildItem`, `kanaItems()`,
`grammarItems()`, etc.), call `questionsFor(fact)` from
`src/lib/engine/question.ts`, call `.prompt(direction, cfg)` with the
relevant config, and render the prompt/context/hint plus either the option
list (MC) or a "types an answer" indicator (typed) plus the answer reveal.
Group cards by subject with a heading per group, in this order:

- **Kana**: jp2en typed (kana→romaji), jp2en typed audio (hear→type), en2jp
  MC (romaji→pick kana), en2jp MC audio (hear→pick kana)
- **Kanji meaning**: jp2en typed, en2jp typed, en2jp MC, the "variant"
  component-recognition MC (亻→pick 人)
- **Kanji reading**: jp2en typed (in-word context, dimmed non-target kanji),
  jp2en typed audio
- **Word meaning**: jp2en typed, jp2en MC
- **Word reading**: jp2en typed, jp2en typed audio, jp2en MC audio
  (listening, options show written forms)
- **Grammar production**: jp2en typed, jp2en MC
- **Grammar meaning — selection** (corpus sentence, fill-the-blank-style
  prompt but MC on pattern): jp2en MC, en2jp MC
- **Grammar meaning — fixed** (non-selectable pattern, plain gloss): jp2en
  MC, en2jp MC
- **Grammar meaning — particle tap-drill** (Package 4's new type): include
  this group even if Package 4 hasn't landed yet — render a labeled
  placeholder card ("particle tap-drill — pending Package 4") so the gallery
  layout is ready, then swap in the real render once it exists.
- **Transitivity**: jp2en MC, en2jp typed, en2jp MC
- **Keigo**: jp2en MC, en2jp typed, en2jp MC
- **Radicals**: jp2en typed, en2jp typed, en2jp MC
- **Numbers/counters**: read typed, write typed, hear typed
- **Sentence recognition**: audio MC (hear sentence → pick English meaning)

**Verify:** page renders at `/dev/quiz-gallery` with no runtime errors, one
card minimum per bullet above, `pnpm run type-check` and `pnpm run lint`
clean on the new files.

**Soft dependency on Package 4** for one group only — everything else is
fully buildable today against existing question types.

---

## Summary of file ownership (no two packages touch the same file)

| Package | Files created/edited |
|---|---|
| 1 ✅ | `src/data/grammar/recipes.ts` + tests it broke |
| 2 ✅ | `src/data/assembly.ts` + its tests |
| 3 ✅ | `src/data/grammar/particle-drill-examples.ts` (+ test, + `scripts/mine-particle-drill-examples.ts`) |
| 4 ✅ | `src/lib/engine/particle-drill.ts` (+ test), `src/components/quiz/particle-tap-card.tsx`, additions to `src/lib/grammar/questions.ts` and `drill-screen.tsx`, new e2e spec |
| 5 ✅ | `src/app/dev/quiz-gallery/page.tsx`, `src/app/dev/quiz-gallery/particle-tap-preview.tsx` |

All five done. Packages 3 and 4 shared a **data contract**, not a file; no
merge conflicts occurred across any of the five. One cross-package follow-up
(swapping Package 4's temporary stub for Package 3's real dataset, flagged
when Package 4 shipped first) was completed during final review — see
Package 4's status note above.
