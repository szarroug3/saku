**Status: RECOMMENDATION for a tired Sam — say yes and I run it**

Sam asked for a single recommendation. Here it is, per item:

| item | what it is | my call |
|---|---|---|
| 1 | kanji meanings show metadata (子 = "11PM-1AM", counter/zodiac senses) | **FIX** — pattern-filter (counters, zodiac, radical-index senses). Robust, no per-kanji list. |
| 2 | engine generates non-words (し方, 来方) and grades them right | **FIX** — small per-recipe deny-list. |
| 3 | Tatoeba translation drift ~4-5% | **SPOT-FIX the worst only** — the subset where the translation teaches the wrong sense of the keyed word (グラス = drinking glass, not "glass"). Accept the rest as the cost of free corpus data. |
| 4 | 〜られる potential name | done (`a81f2fe`) |
| 5 | obscure reading anchors (出's しゅつ anchored to 供出) | **FIX** — prefer the lowest-beginnerRank anchor. Data already exists. |
| 6 | adjective ます-form rule | done (`a81f2fe`) |
| 7 | two authored glosses (詰まる, 生む/産む) | **FIX** — one-line edits each. |

**My recommendation: do 1, 2, 5, 7 (clear correctness wins, no judgement needed),
and spot-fix 3's worst subset.** All safe, all reversible. If Sam says "go" I
dispatch one agent for the lot.

---

## (original card below)
# P1 · Data-quality problems Sam has not ruled on

**Status: partly done, partly answered — Sam's data-source question answered below

## Sam asked: is there a better source than KANJIDIC, and can we stop coding exceptions?

**Short answer: keep KANJIDIC2 — it is the best free structured source for kanji
meanings, there is no cleaner one to switch to. But the FIX is not a per-kanji
exception list. It is pattern-based sense filtering, which is exhaustive by
construction and is the opposite of the brittle enumerated lists that have bitten
us.**

The metadata senses Sam objects to are STRUCTURALLY PATTERNED, not arbitrary:

| kind | example sense text | how to catch it |
|---|---|---|
| radical index | "radical (no. 47)" | already filtered (`RADICAL_INDEX_MEANING`) |
| counter | "counter for bows & stringed instruments" | senses matching /^counter for/ |
| zodiac / branch | "sign of the rat", "1st terrestrial branch" | a known finite set of 12+10 |
| clock hours | "11PM-1AM" | the branch senses carry these |

So the fix extends the EXISTING pattern-based filter (`RADICAL_INDEX_MEANING`
already works this way) to counters and zodiac senses. A regex/known-set filter
catches ALL counters and ALL zodiac senses, not a hand-picked 40. **That is what
makes it robust against "we missed things"** — the failure mode Sam is worried about
came from enumerating cases (the いる compound list missed 3 verbs; the old comps
missed 亻). Filtering by structural pattern cannot miss a case it was not told about,
because it is not told about cases at all.

Optional strengthening: cross-reference **Unihan's `kDefinition`** (one curated
primary definition per CJK character) as a signal for which sense is primary when
KANJIDIC's flat list is ambiguous. It is a helper, not a replacement — Unihan
occasionally includes the branch sense too.

## The through-line, since Sam raised the principle

This is the same lesson as tasks 6 and 23. **Prefer structural/authoritative rules
over enumerated exception lists everywhere:**
- Task 6: a hand-listed `gatesCompounds` exclusion missed 射る/鋳る/入る.
- Task 23: KRADFILE's flat list + a proposed 化→亻 remap → replaced with KanjiVG's
  structural hierarchy (depth 1), which cannot produce the wrong answer.
- Task 20 item 1: extend PATTERN filtering, do not enumerate 40 kanji.

Where a case genuinely is a one-off (item 7's two authored glosses), a direct edit
is right. The rule is: enumerate only what is genuinely irregular; filter by pattern
everything that follows a pattern.

## Status of this card's items after other work

- **Item 4** (〜られる potential name) and **item 6** (adjective ます-form rule) were
  FIXED in `a81f2fe`. Verify and close them.
- **Item 2's** 〜に行く lead was fixed (`notOn` in `a81f2fe`), but the deeper
  non-word generation (し方, 来方 graded correct) is NOT fixed.
- Items 1, 3, 5, 7 remain.

(original status: unreviewed)**

## Open questions

- Which kanji senses count as metadata rather than meaning? Counter senses and zodiac senses are the clear cases; a sweep should list what changes before anything is applied.
- Tatoeba translation drift (~4-5%): accept it as the cost of free corpus data, or spot-fix the subset where the translation contradicts the word it is keyed to?

These were in `TEST-FINDINGS.md` but had no task. Recorded here so they are not
lost.

## 1 · 40 kanji show dictionary metadata as the taught meaning

1.9% of the 2,136 kanji carry KANJIDIC artifacts in their displayed top-3
meanings, and **that is the meaning fact the learner is quizzed on**.

- **子** is taught as "child · sign of the rat · **11PM-1AM**"
- **張**'s *first* meaning is "counter for bows & stringed instruments"
- **杯**'s first is "counter for cupfuls"
- **一** includes "one radical (no.1)"
- **川** includes "river or three-stroke river radical (no. 47)"

These are real KANJIDIC senses, presented flat with no ranking. The zodiac hour
sense of 子 is genuine but is not what 子 means to a learner.

The app already strips one class of this: `RADICAL_INDEX_MEANING` in `kanji.ts`
removes `radical (no. N)` entries, with a comment explaining it is a correctness
bug rather than a cosmetic one. **The same argument applies to the rest.**

**Fix:** extend that filtering. Counter senses, zodiac senses and radical-index
senses are metadata, not meanings. Sweep all 2,136 and report what changes before
applying, since some senses are legitimately the primary meaning.

## 2 · The engine can generate non-words and grade them correct

`/library/grammar/ni-iku` leads with **行く → 行きに行く**, which is not Japanese.
`vehiclesFor` (`src/lib/grammar/vehicles.ts:159`) keeps any vehicle that
"succeeds and transforms", with **no lexical check**, so:

- 〜方 can serve する → **し方** (the real word is 仕方)
- 〜方 can serve 来る → **来方**

Both are reachable as drill answers and **graded correct**.

The conjugation engine is otherwise sound — ~50,000 generated forms were checked
with zero structural drift. The problem is not the engine, it is that nothing
checks whether the output is a word that exists.

**Fix:** either exclude vehicles that produce non-words per recipe (a small
authored deny-list, since the set is small), or check generated output against the
12,553-word vocabulary where the result should be a real word. Establish which
recipes are affected first; the audit found two and did not sweep for more.

## 3 · Tatoeba translation drift, roughly 4-5%

Sampled across both the grammar corpus and the word examples:

- **グラス**「グラスは壊れやすいよ」 → "Glass is breakable". グラス is a drinking
  glass, not the material. This teaches the wrong sense of the very word it is
  keyed to.
- **前**「行く前に電話します」 → "I'll call **him**" (there is no 彼)
- **楽しい**「…だったでしょう」 → "I hope you had…" (でしょう is supposition)
- ~17 entries file-wide misanalyse 行った as 行う rather than 行く

These are upstream Tatoeba translations, faithfully ingested. The rate is an
estimate from a sample, not a full count.

**Fix options:** accept it as the cost of free corpus data and say so; or spot-fix
the ones where the translation contradicts the keyed word, which is the subset
that actively teaches something false. The グラス case is that subset.

## 4 · 〜られる is the display name for the potential form

Its own worked example is 行ける. The build rule and outputs are correct; the name
is wrong for godan verbs, where the potential is -eru rather than -られる.

**Fix:** name it by what it does rather than by one class's ending.

## 5 · Kanji reading anchors are often obscure

出's しゅつ is anchored to 供出 rather than 外出 or 出発; 名's みょう to 功名. The
readings are correct, but a beginner meets the anchor word before the reading, so
an obscure anchor makes a common reading feel rare.

**Fix:** prefer the anchor with the lowest `beginnerRank` among the words that
attest a reading. The data to do this already exists.

## 6 · Adjective build rules describe a form adjectives do not have

`src/lib/grammar/formula.ts:81` — `FORM_LABEL` is a flat `Form -> string` map with
no awareness of which host it is describing, so `stem` renders identically for
verbs and adjectives.

Live at `/library/grammar/sugiru` and `/library/grammar/sou-appearance`:

> "any **い-adjective** -> stem (**the ます-form minus ます**) + すぎる"

高い and 静か have no ます-form. The generated outputs are all correct
(高すぎる, 静かそう, よさそう); it is only the stated rule that is incoherent.
Four printed rows.

**Fix:** make `FORM_LABEL` host-aware, so `stem` reads "the ます-form minus ます"
for a verb and something true for an adjective (for い-adjectives, the stem is the
word minus い).

## 7 · Two vocabulary glosses worth a second look

- **詰まる** is glossed "The box filled up" (`transitivity.ts:364`). 詰まる is
  overwhelmingly "clogged" or "jammed", and 箱が詰まる is unnatural.
- **生む** is used where **産む** is standard, for childbirth (`transitivity.ts:329`).

Both are in the curated 69-pair table, so they are authored rather than ingested,
and a fix is a one-line edit each.
