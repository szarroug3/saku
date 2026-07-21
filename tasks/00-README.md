# Tasks

Work queue from the independent audit round of 2026-07-20, against main at
`7d55504`. Findings and reproductions live in `../TEST-FINDINGS.md`.

**Untracked on purpose**, same as `STATUS.md` and `TEST-FINDINGS.md`. Do not
commit this folder.

## Order — highest impact per unit of effort, first

**Status**

| value | meaning |
|---|---|
| `unreviewed` | you have not seen this file yet |
| `needs review` | I need an answer from you before, or while, building it |
| `not started` | reviewed and settled, waiting its turn |
| `in progress` | an agent is on it now |
| `done` | merged |

**Open questions live in the task files**, under an `## Open questions` heading
near the top, so a file is self-contained. **9 tasks have one.** They are marked
with a **?** below. Nothing in this queue is blocked on me.

Effort is a rough size, not an estimate. Where two tasks share a root cause they
are marked, because doing one without the other leaves the behaviour incoherent.
### Blockers — do these first regardless of ratio

| # | Status | Task | Impact | Effort | Why here |
|---|---|---|---|---|---|
| 14 | **done** | Session bricks | total | medium | Merged `abc454c`. Cross-tab loop, not a component loop. |
| 15 | not started | Nothing saved until a session completes **?** | total | medium | What made 14 catastrophic instead of annoying. Next up. |

### Best ratio — high impact, small change

| # | Status | Task | Impact | Effort | Note |
|---|---|---|---|---|---|
| 07 | **needs review** | Copy changes **?** | high | **trivial** | Rewrites written and mostly approved. Approve-and-apply. |
| 02 | **done** | Romaji graded wrong | high | **trivial** | Merged `9467e10`. Romaji graded; conversion keyed on answer language. |
| 19 | **done** | en2jp kana answers itself | high | **trivial** | Merged `379e519`. Now a six-option board. **Same root as 01.** |
| 17 | **done** | Shipped-data problems | medium-high | **trivial** | Merged `ffbc40d`. 0 dashes; vulgar words now outside the first 120. |
| 13 | **done** | Remove the `draft` flag **?** | low | **trivial** | Merged `db993e0`. 31 entries, not 33. |
| 06 | **in progress** | Conjugation policy too narrow | medium | small | Scoped to ある/できる; いる excluded (10 false positives). |
| 01 | not started | Reveal shows the prompt back | **highest** | small | Every wrong answer, 4 of 5 subjects. **Do with 19.** |
| 03 | **done** | Accuracy pill mixes units | high | small | Merged `0d8c36b`. Aggregate split dispatched separately. |
| 04 | **needs review** | Corpus tagger **?** | high | small | Filter the data first; the check is already written. |
| 16 | unreviewed | Quiz tells you nothing | high | small | Three small additions. Day-one impact. |

### Worth doing, more work or less reach

| # | Status | Task | Impact | Effort | Note |
|---|---|---|---|---|---|
| 21 | unreviewed | Jargon never explained **?** | medium-high | small | Plus an intro card per track. |
| 09 | **needs review** | Particle reading rule **?** | medium-high | small | Draft copy written. 私は is day one. |
| 18 | unreviewed | Retry leaves no trace **?** | medium | small | Units settled by 03 (showings). Retry-set question still open. |
| 20 | unreviewed | Data quality **?** | medium | medium | Several sub-items, some need a sweep first. |
| 05 | not started | 〜てある any verb | medium | medium-large | Needs transitivity on the vehicle model. |
| 08 | not started | Test-suite gaps | high (durable) | large | Its first two items **are** tasks 01 and 02. |

### Decisions and big builds — not queue work

| # | Status | Task | Impact | Effort | Note |
|---|---|---|---|---|---|
| 22 | **needs review** | The four skills **?** | **strategic** | free to decide | Deciding costs nothing; acting is the largest thing here. |
| 10 | **needs review** | Counters and numbers **?** | medium-high | large | New content plus a placement decision. |
| 11 | **needs review** | Sentence-level production **?** | high | large | **Plan only. Do not build from the file.** |
| 12 | **needs review** | Grammar coverage, keigo **?** | high | large | Authoring recipes, not importing. |

### If you only do six

14 (done), 15, then 07, 02, 19 + 01 together, and 03. That clears every blocker,
both "marks you wrong when you're right" bugs, and the number that made the tester
stop trusting the app.

## Coverage

Every finding in `../TEST-FINDINGS.md` now maps to a task. Cross-checked heading by
heading. The only things deliberately without one are the mnemonic-content items
below.

## Not in here

**Mnemonic content.** ま, と, サ, を, ア, め and the katakana gaps are Sam's
in-progress authoring, to be reviewed as a set when finished. を's wrong
pronunciation is recorded in `TEST-FINDINGS.md` and deliberately left out of the
queue.

**Note on を:** Sam asked whether "the o in woah" works. It does not — the app
already warns against exactly that glide on お's own card ("Short and pure, no
oh-w glide"), and を is pronounced identically to お. Bolding only the o would
still teach the wrong vowel.

## Done

- **`feat/e2e-tests` MERGED** into main at `d972902`. 57 tests, verified green
  before merging. Run with `npx playwright test`. Three are `test.fail()`: they
  assert task 01 and will flip to failures when it is fixed.
- **`lists.json` untracked and gitignored** (`bd80912`). The local copy still
  holds the "test" list; delete it from the UI if you want it gone.
