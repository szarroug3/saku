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
| 15 | **done** | Nothing saved until session completes **?** | total | medium | Merged `4fb35f9`. Per round. Fork hole left, needs a ruling. |

### Best ratio — high impact, small change

| # | Status | Task | Impact | Effort | Note |
|---|---|---|---|---|---|
| 07 | **mostly done** | Copy changes | high | **trivial** | 22 of 24 merged `e784135`. 2 stopped: they need Sam's wording. |
| 02 | **done** | Romaji graded wrong | high | **trivial** | Merged `9467e10`. Romaji graded; conversion keyed on answer language. |
| 19 | **done** | en2jp kana answers itself | high | **trivial** | Merged `379e519`. Now a six-option board. **Same root as 01.** |
| 17 | **done** | Shipped-data problems | medium-high | **trivial** | Merged `ffbc40d`. 0 dashes; vulgar words now outside the first 120. |
| 13 | **done** | Remove the `draft` flag **?** | low | **trivial** | Merged `db993e0`. 31 entries, not 33. |
| 06 | **done** | Conjugation policy too narrow | medium | small | Merged `f84952a`. いる excluded (13 false positives, not 10). |
| 23 | **needs review** | Kanji "Made of" is wrong **?** | **highest** | large | Fix recommended: regenerate comps from IDS, depth 1. Fixes both defects. |
| 01 | **done** | Reveal shows the prompt back | **highest** | small | Merged `22c2aa5`. Structural fix; new subjects correct for free. |
| 03 | **done** | Accuracy pill mixes units | high | small | Merged `0d8c36b`. Aggregate split dispatched separately. |
| 04 | **done** | Corpus tagger | high | small | Merged `a729b5f`. Filtered; all survivors clear the floor. |
| 16 | **done** | Quiz tells you nothing | high | small | Merged `36e421f`. Per-kind instructions, mix-up note, prominent x/y pill. |

### Worth doing, more work or less reach

| # | Status | Task | Impact | Effort | Note |
|---|---|---|---|---|---|
| 21 | **done** | Jargon never explained **?** | medium-high | small | Merged `348b671`. Track-open intro card, reused phase-intros. Copy is DRAFT. |
| 09 | **answered, ready to build** | Particle reading rule **?** | medium-high | small | Answered: は/へ teach the rule; を's card is just WRONG and needs changing. |
| 18 | **done** | Retry leaves no trace | medium | small | Merged `a53a94e`. Summary sums correctly; retry visible. |
| 20 | unreviewed | Data quality **?** | medium | medium | Several sub-items, some need a sweep first. |
| 05 | **done** | 〜てある any verb | medium | medium-large | Merged `ea522c8`. A test had been asserting the bug. |
| 08 | not started | Test-suite gaps | high (durable) | large | Its first two items **are** tasks 01 and 02. |

### Decisions and big builds — not queue work

| # | Status | Task | Impact | Effort | Note |
|---|---|---|---|---|---|
| 22 | **ruled** | The four skills | **strategic** | free to decide | Speaking/writing OUT. Listening IN, words only, opt-in. Fix the voice first. |
| 10 | **needs review** | Numbers and counters **?** | medium-high | large | Proposal written. 〜つ and 〜人 already in data; 〜本 needs authoring. |
| 11 | **needs review** | Sentence-level production **?** | high | large | **Plan only. Do not build from the file.** |
| 12 | **needs review** | Grammar coverage, keigo **?** | high | large | Authoring recipes, not importing. |

### If you only do six

**All six are done.** 14, 15, 07, 02, 19 + 01 together, and 03 all merged between
19 and 21 July. That cleared every blocker, both "marks you wrong when you're
right" bugs, and the number that made the tester stop trusting the app.

**The next six**, in the same spirit: **23** (kanji components are wrong — the
biggest correctness problem left), **16** (the quiz still tells you nothing on a
miss), **the `Eddy` voice fix** (a prerequisite for 22's listening work, and cheap),
**21** (jargon used before it is taught), **20** (data quality), **10** (numbers
and counters, once the gating is approved).

## Coverage

Every finding in `../TEST-FINDINGS.md` maps to a task. The second audit round
(21 July) produced four more reports, and their findings are folded in too:

- `../AUDIT-2-beginner.md` — zero-knowledge learner, browser only
- `../AUDIT-2-regression.md` — verified 10 of 11 fixes in the browser
- `../AUDIT-2-japanese.md` — expert correctness review, 8 things taught wrong
- `../AUDIT-2-voice.md` — 17 copy findings after the 24-item pass

`../OVERNIGHT.md` is the narrative of the 20–21 July run, including the decisions
made on Sam's behalf and the things I got wrong.

## Not in here

**Mnemonic content.** ま, と, サ, を, ア, め and the katakana gaps are Sam's
in-progress authoring, to be reviewed as a set when finished.

**Note on を:** Sam asked whether "the o in woah" works. It does not — the app
already warns against exactly that glide on お's own card ("Short and pure, no
oh-w glide"), and を is pronounced identically to お. Bolding only the o would
still teach the wrong vowel. **The second audit found the app still teaches を as
"wo" on `/library/hiragana/wo`, on the same page that says it sounds exactly like
お.** Still deliberately out of the queue as mnemonic content, but it is now a
self-contradiction on one page rather than just a wrong hint.

**Speaking and pronunciation testing.** Ruled out by Sam on 21 July (task 22). The
app teaches how to pronounce; it does not grade it. Same for handwriting.

## Done

- **Task 07's copy pass** — 22 of 24 items, `e784135`. Two need Sam's wording.
- **`feat/e2e-tests` MERGED** into main at `d972902`. The suite is now **70 specs**,
  all passing. Run with `pnpm exec playwright test`. It runs against
  `next build && next start`, never `next dev` — Turbopack's HMR websocket does not
  complete its handshake against Playwright-driven Chromium and the page never
  hydrates.
- The three former `test.fail()` specs asserting task 01 **now pass**; task 01 was
  fixed structurally in `22c2aa5`.
- **`lists.json` untracked and gitignored** (`bd80912`). The local copy still holds
  the "test" list; delete it from the UI if you want it gone.
- Unit suite: **1223 tests**, tsc clean, as of `d4ef7e9`.

**Every commit from the 20–21 July overnight run is unsigned.** 1Password's SSH
signing agent needs interactive biometric confirmation and errors in a
non-interactive session. Re-sign if you want them signed.
