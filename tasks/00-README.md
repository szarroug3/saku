# Tasks

Findings from the audit rounds, turned into tracked work. Done cards live in
[`archive/`](archive/); this file's Active board is only what is still open.

As of the last update: **main is green — 1288 unit tests, 78 e2e, tsc clean.**
Every overnight/day commit is unsigned (1Password's signing agent needs
interactive biometric confirmation); re-sign if wanted.

---

## Active

| # | Status | Task | What it needs |
|---|---|---|---|
| 10 | **wiring, building** | Numbers and counters track | Agent adding a Library shelf AND wiring the scheduler so it is viewable + live. |
| 21 | **your edits applied, building extras** | Track intros + meta terms | Six cards updated to your voice pass. Agent adding Library definition items (JLPT, kana, romaji, …) and the combo→yōon relabel. |
| 22 | **extending** | Listening | Word types live. Agent adding a SENTENCE recognition listening type (hear → pick the meaning). |
| 12 | **answered, needs your go** | Grammar depth, keigo, pitch | Keigo revised to open EARLY (recognition-first). **Needs you:** final go + grammar-depth scope. |
| 20 | **building** | Data quality | Agent fixing items 1,2,5,7 + spot-fixing the worst of 3 (your recommendation, approved). |

## What's needed from you — 5 items

1. **10 · counters** — verify the built track, and rule on wiring it live.
2. **12 · keigo + pitch** — approve the recommended shapes (keigo track after
   transitivity; pitch display-only via Kanjium).
3. **20 · data quality** — rule on which items to fix vs accept.
4. **21 · track intros** — voice pass on the six draft cards.
5. **22 · listening** — voice pass on the labels; confirm the two calls I made.

**Ready to test in the running app:** the **sentence drills** (task 11, just
merged — Practice → mode "Build sentences") and the **kanji components** fix
(task 23 — Library → any kanji → "Made of" now shows 亻 not 化).

Lighter, non-blocking verify items (from the running server): the confusion-note
wording, the "needed another look" summary label, the per-card answer instructions,
and the particle rule card. All merged; spot-check when convenient.

---

## Archive — done and merged

Each links to its card in [`archive/`](archive/) with the merge commit.

| # | Task | Merge |
|---|---|---|
| 01 | [Reveal showed the prompt back](archive/01-p0-reveal-shows-prompt.md) | `22c2aa5` |
| 02 | [Romaji graded wrong](archive/02-p0-romaji-graded-wrong.md) | `9467e10` |
| 03 | [Accuracy pill mixed units](archive/03-p0-accuracy-units.md) | `0d8c36b` + `d4ef7e9` |
| 04 | [Corpus tagger mislabelled](archive/04-p0-corpus-tagger.md) | `a729b5f` |
| 05 | [〜てある on any verb](archive/05-p0-te-aru-any-verb.md) | `ea522c8` |
| 06 | [Conjugation policy too narrow](archive/06-p1-conjugation-policy.md) | `f84952a` |
| 07 | [Copy changes (24 items)](archive/07-copy-changes.md) | `e784135` + `52b6259` + `bc5104d` |
| 08 | [Test-suite hardening](archive/08-test-suite-gaps.md) | `cb50d74` |
| 09 | [Particle reading rule (は/へ/を)](archive/09-particle-reading-rule.md) | `3ed951f` |
| 11 | [Sentence production (assembly + substitution)](archive/11-sentence-production.md) | `ae03adf` |
| 13 | [Remove the draft flag](archive/13-remove-draft-flag.md) | `db993e0` |
| 14 | [Session bricks](archive/14-p0-session-bricks.md) | `abc454c` |
| 15 | [Nothing saved until session completes](archive/15-p0-progress-not-saved.md) | `4fb35f9` |
| 16 | [Quiz told you nothing](archive/16-p1-quiz-tells-you-nothing.md) | `36e421f` |
| 17 | [Shipped-data problems](archive/17-p1-shipped-data-problems.md) | `ffbc40d` |
| 18 | [Retry left no trace; summary math](archive/18-p1-retry-and-summary.md) | `a53a94e` |
| 19 | [en2jp kana answered itself](archive/19-p0-en2jp-kana-self-answering.md) | `379e519` |
| 23 | [Kanji "Made of" was wrong](archive/23-p0-kanji-components-wrong.md) | `09cd236` |

Plus, not carded: the **aggregate split** (`d603d4d`), the **voice-consistency
pass** (`bc5104d`), the **Japanese-accuracy fixes** (`a81f2fe`), and the
**katakana mnemonic images** (`fec4eab`, `2cb9949`, `eb85a9c`).

---

## Coverage and provenance

Every finding in `../TEST-FINDINGS.md` and the four second-round audits
(`../AUDIT-2-beginner.md`, `-regression.md`, `-japanese.md`, `-voice.md`) maps to a
card, done or active. `../OVERNIGHT.md` is the narrative of the 20–21 July run,
including the decisions made on Sam's behalf and the things that were gotten wrong.

## Not in here

**Mnemonic content.** Remaining mnemonic stories (ま, と, サ, ア, め and the katakana
gaps) are Sam's in-progress authoring. **を is still taught as "wo"** on
`/library/hiragana/wo` — recorded, and it is now a self-contradiction on one page
(it also says it sounds exactly like お). Left in the mnemonic set rather than the
queue.

**Speaking and pronunciation testing.** Ruled out (task 22): the app teaches how to
pronounce and does not grade it. Same for handwriting.

## Standing note

- **e2e suite: 78 specs**, run with `pnpm exec playwright test`. Runs against
  `next build && next start`, never `next dev` — Turbopack's dev worker crashes on
  this machine (it grabs the system's old Node, which predates `node:` builtins).
- **`lists.json`** untracked and gitignored (`bd80912`); a stray "test" list may
  still be in the local copy — clear it from the UI if unwanted.
