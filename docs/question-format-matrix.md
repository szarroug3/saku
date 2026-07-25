# Question Format Matrix By Entry Type

This file describes the concrete question formats by entry type and subtype.

Scope:
- Drill mode card forms (prompt source, direction, expected response, answer control)
- Full product possibilities (intended matrix), including forms not yet implemented
- Corpus-feasible possibilities, including explicit trivial cases marked as `No`
- Current product rule: if MC is not selected, typed forms that would require MC are dropped (not auto-converted)

## Terms

- `jp->en`: show Japanese, answer in English or kana reading (depends on form)
- `en->jp`: show English, answer in Japanese
- `typed`: text input
- `mc`: multiple choice
- `reading fact`: a fact whose answer is a pronunciation/reading
- `meaning fact`: a fact whose answer is a meaning/gloss
- `text prompt`: Japanese is shown in text
- `audio prompt`: Japanese is played
- Romaji typing policy: only kana entries use typed romaji; all other Japanese output rows use kana/kanji typing, not romaji input

Status labels:
- `Current`: implemented in the current engine
- `Planned`: included in full matrix, not implemented yet
- `By design`: intentionally excluded

---

## 1) Kana Entry (`kana:*`)

Kana entries have one reading fact.

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show kana glyph | `jp->en` | Romaji reading | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji"}` | `あ` -> type `a` |
| Audio: play kana pronunciation | `jp->jp` | Kana glyph | Yes | Yes | Planned | `japanese: {prompts: includes "audio", responses: includes "romaji"}` (requires kana audio implementation) | Hear `a` -> type/pick `あ` |
| Show romaji/English side | `en->jp` | Kana glyph | No | Yes | Current | `english: {answers: includes "mc"}` (MC-only; typed dropped) | Prompt `a` -> pick `あ` |
| Text: show kana glyph (self-copy) | `jp->jp` | Same kana glyph | No | No | By design | N/A (trivial self-copy excluded) | `あ` -> type `あ` |

---

## 2) Kanji Entry (`kanji:*`) and Radical Entry (`radical:*`)

Kanji/radical behavior shares the same question-type rules for meaning facts.

### 2.1 Meaning fact

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show kanji/radical glyph | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (MC-only; typed dropped per ambiguity rule) | `一` -> choose `one` |
| Audio: play canonical reading | `jp->en` | English meaning | No | No | By design | N/A (semantically incoherent: hear reading, answer definition) | Not generated |
| Show English meaning | `en->jp` | Japanese written form (glyph) | No | Yes | Current | `english: {answers: includes "mc"}` (MC-only; typed dropped—kanji glyphs untypeable) | Prompt `one` -> pick `一` |
| Text: show kanji/radical glyph (self-copy) | `jp->jp` | Same written form (glyph) | No | No | By design | N/A (trivial self-copy excluded) | `一` -> type `一` |

### 2.2 Reading fact (kanji only)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show kanji in anchor context | `jp->en` only | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji"}` (jp->en only per fixedDir constraint) | `生` (in `人生`) -> type `せい` |
| Audio: play anchor-word pronunciation | `jp->en` only | Reading | No | No | By design | N/A (cannot disambiguate which kanji+anchor reading fact is targeted) | Not generated |
| `en->jp` reading | N/A | N/A | N/A | N/A | By design | N/A (kanji reading facts have fixedDir="jp2en"; en->jp not generated) | Not generated |

---

## 3) Word Entry (`word:*`)

Words can have:
- meaning fact (all words)
- reading fact (non-kana words)

### 3.1 Kana-only words (example: `これ`)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show word | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (MC-only per ambiguity rule) | `これ` -> choose `this` |
| Audio: play word | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition"}` (MC-only; kana words are listenable) | Hear `これ` -> choose `this` |
| Show English meaning | `en->jp` | Written word form | Yes | Yes | Current | `english: {answers: includes "typed"/"mc"}` (kana-only words are typeable en->jp) | Prompt `this` -> type `これ` |
| Text: show kana-only word (self-copy) | `jp->jp` | Same written form | No | No | By design | N/A (trivial self-copy excluded) | `これ` -> type `これ` |

### 3.2 Single-kanji words (example: `人`)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (MC-only per ambiguity rule) | `人` -> choose `person` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition"}` (MC-only) | Hear `ひと` -> choose `person` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | `english: {answers: includes "mc"}` (MC-only; kanji glyph untypeable) | Prompt `person` -> pick `人` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji"}` (reading facts) | `人` -> type `ひと` |
| Audio: play word (reading fact) | `jp->jp` | Reading | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji"}` (reading facts) | Hear `ひと` -> type `ひと` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | `english: {answers: includes "typed"/"mc"}` (kana reading is typeable) | Prompt `person` -> type `ひと` |

### 3.3 Multi-kanji words (example: `先生`)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (MC-only per ambiguity rule) | `先生` -> choose `teacher` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition"}` (MC-only) | Hear `せんせい` -> choose `teacher` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | `english: {answers: includes "mc"}` (MC-only; kanji glyphs untypeable) | Prompt `teacher` -> pick `先生` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji"}` (reading facts) | `先生` -> type `せんせい` |
| Audio: play word (reading fact) | `jp->jp` | Reading | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji"}` (reading facts) | Hear `せんせい` -> type `せんせい` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | `english: {answers: includes "typed"/"mc"}` (kana reading is typeable) | Prompt `teacher` -> type `せんせい` |

### 3.4 Mixed kanji+kana words (example: `食べる`)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (MC-only per ambiguity rule) | `食べる` -> choose `to eat` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition"}` (MC-only) | Hear `たべる` -> choose `to eat` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | `english: {answers: includes "mc"}` (MC-only; kanji+kana glyph untypeable) | Prompt `to eat` -> pick `食べる` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji"}` (reading facts) | `食べる` -> type `たべる` |
| Audio: play word (reading fact) | `jp->jp` | Reading | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji"}` (reading facts) | Hear `たべる` -> type `たべる` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | `english: {answers: includes "typed"/"mc"}` (kana reading is typeable) | Prompt `to eat` -> type `たべる` |

---

## 4) Sentence Cards (`sentence:*`)

Sentence cards are for full-sentence prompts. Currently supported: grammar meaning facts with selection boards (definition recognition via MC). Intended future: kana typing for sentences with kanji.

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Sentence source (text) with kanji in sentence | `jp->jp` | Full sentence in kana | Yes | Yes | Planned | (Awaiting sentence-specific romaji grading; currently not generated) | `先生は学校へ行く。` -> type `せんせいはがっこうへいく。` |
| Sentence source (audio) with kanji in sentence | `jp->jp` | Full sentence in kana | Yes | Yes | Planned | (Awaiting sentence-specific romaji grading; currently not generated) | Hear `せんせいはがっこうへいく。` -> type `せんせいはがっこうへいく。` |
| Sentence source + Definition (text) | `jp->en` | Definition via selection board | No | Yes | Current | `sentence: {prompts: includes "text", responses: includes "definition"}` (grammar meaning facts only; MC-only) | `先生は学校へ行く。` -> choose `The teacher goes to school.` |
| Sentence source + Definition (audio) | `jp->en` | English meaning recognition | No | Yes | Current | `sentence: {prompts: includes "audio", responses: includes "definition"}` (grammar meaning facts; MC-only) | Hear `せんせいはがっこうへいく。` -> choose `The teacher goes to school.` |
| Sentence source (text) already in kana (self-copy) | `jp->jp` | Same full kana sentence | No | No | By design | N/A (trivial self-copy excluded) | `これはほんです。` -> type `これはほんです。` |

---

## 5) Grammar Pattern Entry (`grammar:*`)

Grammar rows here are only grammar-source behavior. Grammar meaning facts can also appear in sentence source (see Section 4).

### 5.1 Meaning fact

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Japanese source (text) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (meaning facts; MC-only) | `〜てから` -> choose `after doing X` |
| Japanese source (audio) | `jp->en` | English meaning | No | Yes | Planned | (Grammar not currently listenable; would require: `japanese: {prompts: includes "audio", responses: includes "definition"}`) | Hear `たべてから` -> choose `after doing X` |

### 5.2 Production fact

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Japanese source config (text card cue is English in this direction) | `en->jp` | Japanese production form | No | Yes | Current | `english: {answers: includes "mc"}` (grammar production facts; MC-only) | Prompt `after doing X (eat)` -> pick `食べてから` |
| Japanese source config (audio prompt is Japanese) | `jp->jp` | Japanese production form | No | Yes | Planned | (Not yet implemented; would use sentence source with grammar production) | Hear `たべる` cue -> pick `食べてから` |
| Japanese source (text self-copy of pattern label) | `jp->jp` | Same pattern text | No | No | By design | N/A (trivial self-copy excluded) | `〜てから` -> type `〜てから` |

---

## 6) Keigo / Verb Pair / Other Special Subjects

This section is corpus-first: what is possible for these subjects from the data model and content, even if not all rows are implemented yet.

### 6.1 Keigo (`keigo:*`) — corpus possibilities

Keigo sets contain Japanese forms plus role/register semantics, so both recognition and production are feasible.

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Japanese source (text) | `jp->en` | Meaning + register recognition | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (keigo meaning facts; MC-only) | `召し上がる` -> choose `eat / drink (honorific)` |
| Japanese source (audio) | `jp->en` | Meaning + register recognition | No | Yes | Planned | (Awaiting audio support; would use: `japanese: {prompts: includes "audio", responses: includes "definition"}`) | Hear `めしあがる` -> choose `eat / drink (honorific)` |
| English/register source (text) | `en->jp` | Keigo production form | No | Yes | Planned | (Would use: `english: {answers: includes "mc"}`; not yet implemented) | Prompt `eat / drink (honorific)` -> pick `召し上がる` |
| English/register source (audio is Japanese cue only) | `jp->jp` | Keigo production form | No | Yes | Planned | (Not yet implemented) | Hear plain cue `たべる` + honorific target -> pick `召し上がる` |
| Japanese source (text self-copy) | `jp->jp` | Same keigo form | No | No | By design | N/A (trivial self-copy excluded) | `召し上がる` -> type `召し上がる` |

### 6.2 Verb Pair / Transitivity (`transitivity:*`) — corpus possibilities

Verb-pair rows include English cues plus paired Japanese lemmas/readings, so disambiguation and recognition directions are both feasible.

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| English cue source (text) | `en->jp` | Choose correct pair member (intransitive vs transitive) | No | Yes | Current | `english: {answers: includes "mc"}` (transitivity facts have fixedDir="en2jp", mcOnly=true) | `The door opened.` -> pick `開く` |
| Japanese source (text) | `jp->en` | Meaning/usage recognition for shown pair member | No | Yes | Planned | (Awaiting implementation; would use: `japanese: {prompts: includes "text", responses: includes "definition"}`) | `開く` -> choose `to open (intransitive)` |
| Japanese source (audio) | `jp->en` | Meaning/usage recognition for heard pair member | No | Yes | Planned | (Awaiting implementation; would use: `japanese: {prompts: includes "audio", responses: includes "definition"}`) | Hear `ひらく` -> choose `to open (intransitive)` |
| English role source (text) | `en->jp` | Produce/select the correct Japanese pair member | No | Yes | Planned | (Alternative prompt phrasing for en->jp; awaiting implementation) | Prompt `open (something)` -> pick `開ける` |
| Japanese source (text self-copy) | `jp->jp` | Same verb form | No | No | By design | N/A (trivial self-copy excluded) | `開く` -> type `開く` |

### 6.3 Cross-cutting feasibility rules (corpus-level)

These apply across special subjects when deciding if a row is practical to ship.

| Rule | Applies to | Constraint | Status | Example |
|---|---|---|---|---|
| Japanese-audio policy | All audio rows | Audio cues should be Japanese audio only | Current policy | No English-audio -> Japanese rows |
| Typed feasibility for Japanese targets | `en->jp` production rows | Non-kana targets are usually MC-first unless kana-only entry mode is provided | Current | `召し上がる`/`開ける` rows are MC-first |
| Multi-answer English meaning filter | `jp->en` meaning/definition rows | If multiple English phrasings are valid, typed is disabled and the row is MC-only | Current policy | Sentence/word/grammar meaning rows use MC to avoid rejecting valid paraphrases |
| Romaji typing scope | All typed rows | Typed romaji is allowed only for kana entries; non-kana subjects type kana/kanji when Japanese output is required | Current policy | Kanji reading row types `せい`, not `sei` |
| Register/role disambiguation | Keigo/transitivity | Prompt must encode register or transitivity role to avoid ambiguous grading | Current | `honorific` vs `humble`, `open (itself)` vs `open (something)` |
| Corpus-backed examples | All planned rows | A row should have at least one corpus-backed cue/example path | Current | Plain-form cue `たべる` -> keigo target row |
| Trivial self-copy filter | All text->same-text rows | If prompt and target are effectively identical copy tasks, mark row as `No` | Current policy | `これ` -> type `これ` is marked trivial |

Practical result:
- Include rows that are feasible from corpus content and grading semantics, even if implementation is pending.
- Mark those rows as `Planned` until implemented.
- Mark feasible but trivial self-copy rows as `By design` with `Typed=No`, `MC=No`.
- Any row with multiple acceptable English answers is MC-only (`Typed=No`).

---

## Global Rules That Filter Forms

A question format appears in the deck when ALL these conditions apply:

1. **Source enabled**: The appropriate source setting must have entries:
   - Japanese source (for jp->en and jp->jp forms): requires `japanese.prompts` or `japanese.responses` to be non-empty
   - English source (for en->jp forms): requires `english.answers` to be non-empty
   - Sentence source (for grammar meaning facts only): requires `sentence.prompts` or `sentence.responses` to be non-empty

2. **Response kind enabled**: The response type in the setting must match what the fact supports:
   - Meaning facts require: `responses.includes("definition")` (jp->en) or `english.answers` (en->jp)
   - Reading facts require: `responses.includes("romaji")` (jp->en) or `english.answers` (en->jp for reading en->jp)

3. **Prompt type supported**: Audio prompts only work on listenable facts:
   - Kana entries: text only (no audio)
   - Kanji entries: text only (no audio for meaning; audio kanji reading is not disambiguated)
   - Words: text and audio both supported
   - Sentences: text and audio both supported (for grammar meaning facts only)
   - Grammar patterns: text only (audio awaiting implementation)

4. **Direction allowed**: Some facts pin to one direction:
   - Kanji reading facts: jp->en only (fixedDir="jp2en")
   - Grammar production facts: en->jp only (fixedDir="en2jp")
   - Transitivity facts: en->jp only (fixedDir="en2jp")
   - Others: both directions available (both derived from settings)

5. **Answer control viable**:
   - MC-only constraints are enforced (meaning facts, kana en->jp, untypeable en->jp targets)
   - Typed only when typeable for that target
   - Product rule: if `answers` does not include "typed", forms that require typed are dropped
   - If `answers` does not include "mc", forms that require MC are dropped (resulting in fewer cards)

6. **No auto-upgrade**: Forms intent "typed" but forced to MC are dropped if MC is not selected:
   - Example: Kana en->jp is always MC (due to mcOnly constraint), so if only "typed" is selected, no kana en->jp card appears

7. **Script rule**: Typed romaji exists only for kana entries:
   - Kanji reading, word reading, and sentence kana typing all use kana characters, not romaji
   - Only kana glyphs can be answered with romaji input

8. **Triviality filter**: Text self-copy rows are explicitly excluded:
   - `あ` -> type `あ` (kana self-copy): not generated
   - `先生` -> type `先生` (word self-copy): not generated

9. **Ambiguity rule**: Multi-acceptable-answer rows force MC-only:
   - All meaning facts (English definitions): MC-only
   - Grammar meanings: MC-only
   - Keigo/transitivity meanings: MC-only
   - Reading facts (kana/romaji answers): typed allowed (objective, single answer)

---

## Why Current Runs May Show Fewer Cards Than This Matrix

The matrix shows all corpus-feasible forms for each entry type. A real deck will show fewer, based on settings:

**If Japanese source is off** (`japanese.prompts` and `japanese.responses` both empty):
- No jp->en or jp->jp forms are generated
- Example: meaning definitions, kanji readings, word readings—all disappear

**If English source is off** (`english.answers` empty):
- No en->jp forms are generated
- Example: kana en->jp MC, word en->jp en->jp typed—all disappear

**If typed is not selected** (`answers` does not include "typed"):
- Typed forms are dropped, but MC-only forms remain
- Example: if `japanese: {answers: ["mc"]}`, typed kana and word readings disappear
- Kana en->jp is already MC-only, so it remains (forced MC, not dropped)

**If MC is not selected** (`answers` does not include "mc"):
- MC-forced forms are dropped entirely (product rule)
- Example: if `japanese: {answers: ["typed"]}`, all meaning facts disappear, typed reading facts remain
- Kana en->jp: no form appears at all (it's always MC-forced)

**If audio is not selected** (`prompts` does not include "audio"):
- Audio forms are dropped
- Text forms of the same row remain

**Planned features not yet implemented**:
- Sentence+romaji (typing full sentences in kana): awaiting distinct romaji grading
- Grammar audio: awaiting audio support for patterns
- Keigo/transitivity production: awaiting implementation
- Other Planned rows in the matrix

**Real example**: If settings are:
```
japanese: { prompts: ["text"], responses: ["definition"], answers: ["mc"] }
english: { answers: ["mc"] }
```
Then visible forms are: jp->en meaning definitions (MC), en->jp glyphs (MC). No reading facts, no audio, no typed.
