# Tasks

Findings from the audit rounds, turned into tracked work. Done cards live in
[`archive/`](archive/); this file's Active board is only what is still open.

As of the last update: **main is green — 1515 unit tests, 80 e2e, tsc clean.**
Every commit is unsigned (1Password's signing agent needs interactive biometric
confirmation); re-sign if wanted.

---

## Active — genuinely open work only

Two cards. Everything whose engineering is merged has moved to the archive; what
is left here is work that is not finished.

| # | Status | Task | What is actually open |
|---|---|---|---|
| 21 | **copy is open** | The new copy + the glossary | Every new feature shipped with DRAFT copy. The open work is a **voice pass** across the track intros, keigo, counters, pitch explainer, grammar glosses, terms, and listening labels — `../AUDIT-3-voice.md` ranks it. Plus: the glossary is being extended now, and cross-linking jargon to its Terms page is a follow-up. **Yours to pace.** |
| 12 | **grammar follow-up open** | Grammar depth | Keigo and pitch are done. The N3 grammar shipped 15 patterns, but the **12 clause-level recognition patterns only show in the Library — they are not drilled** until `scripts/ingest/grammar.py` is re-run to tag them. That re-tag, and any further N3 depth, is the open work. Correctness-sensitive, so paced and reviewed. |
| 23 | **art pass, not urgent** | [Mnemonic image tweaks](23-mnemonic-image-tweaks.md) | A full image-vs-story review of every kana drawing is done; the story/tag fixes it found are merged. What's left is a handful of **drawings** that read a little off (は, ん, よ, katakana イ/ワ, soft ナ/ル/ユ/サ) — redraw candidates for a later art pass. None blocking. |

## Small open decisions (loose ends, none blocking)

From the audits and my own flags — quick calls when you get to them:

- **Counters wording:** the graded answer says "one long **object**" but the
  teaching card says "one long **thing**" — pick one (voice audit).
- **Radical contradiction:** `why.ts` says most radicals *are* words; the track
  intro says a radical is "usually not a word you speak." Reconcile (voice audit).
- **Name pitch accent:** the app draws a pitch mark but never says "pitch accent"
  or what it is (beginner audit). A Terms entry is being added; decide if the mark
  itself should link to it.
- **Listening tuning:** `LISTEN_SHARE` (how often listening cards appear when on)
  and whether "hear it, type the romaji" should be gated behind the jp→en direction
  rather than forcing it. Both my calls, both easy to change.
- **The "taught now because…" repetition** across three track-intro cards, and the
  "X rather than Y" tic — structural voice tells (voice audit), fold into the pass.

## Voice pass — the biggest open thing

Nearly every string added this session is draft. The single most useful next
session is a voice pass, and `../AUDIT-3-voice.md` is the map: it ranks what most
breaks the "written by someone who went through it" voice, quotes each piece, and
proposes rewrites. Task 21 holds the track-intro drafts inline for marking.

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
| 10 | [Numbers and counters track](archive/10-counters-and-numbers.md) | `81023bd` |
| 11 | [Sentence production (assembly + substitution)](archive/11-sentence-production.md) | `ae03adf` |
| 13 | [Remove the draft flag](archive/13-remove-draft-flag.md) | `db993e0` |
| 14 | [Session bricks](archive/14-p0-session-bricks.md) | `abc454c` |
| 15 | [Nothing saved until session completes](archive/15-p0-progress-not-saved.md) | `4fb35f9` |
| 16 | [Quiz told you nothing](archive/16-p1-quiz-tells-you-nothing.md) | `36e421f` |
| 17 | [Shipped-data problems](archive/17-p1-shipped-data-problems.md) | `ffbc40d` |
| 18 | [Retry left no trace; summary math](archive/18-p1-retry-and-summary.md) | `a53a94e` |
| 19 | [en2jp kana answered itself](archive/19-p0-en2jp-kana-self-answering.md) | `379e519` |
| 20 | [Data quality (kanji meanings, non-words, anchors)](archive/20-p1-data-quality.md) | `0442e75` |
| 22 | [The four skills → listening built, speaking/writing ruled out](archive/22-the-four-skills.md) | `fc35d1b` + `517cc52` |
| 23 | [Kanji "Made of" was wrong](archive/23-p0-kanji-components-wrong.md) | `09cd236` |

**Bigger features merged this session (engineering done, some copy still draft — see task 21):**
sentence recognition listening, the **keigo track** (`517cc52`), the **N3 grammar
batch** (`dd5c677`), **pitch accent display** (`5e6a985`), and the **Terms
glossary + combo→yōon** (`59852b4`).

Plus, not carded: the **aggregate split** (`d603d4d`), the **voice-consistency
pass** (`bc5104d`), the **Japanese-accuracy fixes** (`a81f2fe`), the **katakana
mnemonic images** (`fec4eab`, `2cb9949`, `eb85a9c`), and two audit-3 bug fixes —
the **intransitive note on nouns** (`3d1e7e3`) and the **dead Library filter
chips** (`b084935`).

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
