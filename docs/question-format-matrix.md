# Question Format Matrix By Entry Type

This file describes the concrete question formats by entry type and subtype.

Scope:
- Drill mode card forms (prompt source, direction, expected response, answer control)
- Full product possibilities (intended matrix), including forms not yet implemented
- Corpus-feasible possibilities, including explicit trivial cases marked as `No`
- Current product rule: a selected typed form that cannot be graded through the text input resolves to multiple choice. Selecting typed and MC together still yields one deduplicated MC form.

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
| Audio: play kana pronunciation | `jp->jp` | Kana glyph | Yes | Yes | Planned | `japanese: {prompts: includes "audio", responses: includes "romaji"}` (kana is not listenable; selecting audio will not generate this form) | Hear `a` -> type/pick `あ` |
| Show romaji/English side | `en->jp` | Kana glyph | No | Yes | Current | `english: {answers: includes "typed" or "mc"}` (typed resolves to the required MC control) | Prompt `a` -> pick `あ` |
| Text: show kana glyph (self-copy) | `jp->jp` | Same kana glyph | No | No | By design | N/A (trivial self-copy excluded) | `あ` -> type `あ` |

---

## 2) Kanji Entry (`kanji:*`) and Radical Entry (`radical:*`)

Kanji/radical behavior shares the same question-type rules for meaning facts.

### 2.1 Meaning fact

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show kanji/radical glyph | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (MC-only; typed dropped per ambiguity rule) | `一` -> choose `one` |
| Audio: play canonical reading | `jp->en` | English meaning | No | No | By design | N/A (semantically incoherent: hear reading, answer definition) | Not generated |
| Show English meaning | `en->jp` | Japanese written form (glyph) | No | Yes | Current | `english: {answers: includes "typed" or "mc"}` (typed resolves to MC because the glyph is not typeable through the kana input) | Prompt `one` -> pick `一` |
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
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | `english: {answers: includes "typed" or "mc"}` (typed resolves to MC for the kanji target) | Prompt `person` -> pick `人` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji"}` (reading facts) | `人` -> type `ひと` |
| Audio: play word (reading fact) | `jp->jp` | Reading | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji"}` (reading facts) | Hear `ひと` -> type `ひと` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | `english: {answers: includes "typed"/"mc"}` (kana reading is typeable) | Prompt `person` -> type `ひと` |

### 3.3 Multi-kanji words (example: `先生`)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (MC-only per ambiguity rule) | `先生` -> choose `teacher` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition"}` (MC-only) | Hear `せんせい` -> choose `teacher` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | `english: {answers: includes "typed" or "mc"}` (typed resolves to MC for the kanji target) | Prompt `teacher` -> pick `先生` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji"}` (reading facts) | `先生` -> type `せんせい` |
| Audio: play word (reading fact) | `jp->jp` | Reading | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji"}` (reading facts) | Hear `せんせい` -> type `せんせい` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | `english: {answers: includes "typed"/"mc"}` (kana reading is typeable) | Prompt `teacher` -> type `せんせい` |

### 3.4 Mixed kanji+kana words (example: `食べる`)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (MC-only per ambiguity rule) | `食べる` -> choose `to eat` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition"}` (MC-only) | Hear `たべる` -> choose `to eat` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | `english: {answers: includes "typed" or "mc"}` (typed resolves to MC for the mixed-script target) | Prompt `to eat` -> pick `食べる` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji"}` (reading facts) | `食べる` -> type `たべる` |
| Audio: play word (reading fact) | `jp->jp` | Reading | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji"}` (reading facts) | Hear `たべる` -> type `たべる` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | `english: {answers: includes "typed"/"mc"}` (kana reading is typeable) | Prompt `to eat` -> type `たべる` |

---

## 4) Sentence Cards (`sentence:*`)

The Sentences settings card has independent Japanese and English subsections. Japanese prompts ask for an English definition or kana transcription. English prompts ask the learner to order Japanese chunks or choose the matching Japanese sentence. A setting is `Current` only when configuration, generation, presentation, and grading are all implemented.

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Sentence source (text) with kanji in sentence | `jp->jp` | Full sentence in kana | Yes | Yes | Planned | (Awaiting sentence-specific romaji grading; currently not generated) | `先生は学校へ行く。` -> type `せんせいはがっこうへいく。` |
| Sentence source (audio) with kanji in sentence | `jp->jp` | Full sentence in kana | Yes | Yes | Planned | (Awaiting sentence-specific romaji grading; currently not generated) | Hear `せんせいはがっこうへいく。` -> type `せんせいはがっこうへいく。` |
| Sentence source + Definition (text) | `jp->en` | English meaning recognition | No | Yes | Current | `sentence: {prompts: includes "text", responses: includes "definition"}` (grammar meaning facts; MC-only) | `先生は学校へ行く。` -> choose `The teacher goes to school.` |
| Sentence source + Definition (audio) | `jp->en` | English meaning recognition | No | Yes | Current | `sentence: {prompts: includes "audio", responses: includes "definition"}` (grammar meaning facts; MC-only) | Hear `せんせいはがっこうへいく。` -> choose `The teacher goes to school.` |
| Sentence source (text) already in kana (self-copy) | `jp->jp` | Same full kana sentence | No | No | By design | N/A (trivial self-copy excluded) | `これはほんです。` -> type `これはほんです。` |
| English sentence (text) | `en->jp` | Order Japanese chunks | Drag/order | No | Current | `sentence: {englishResponses: includes "ordering"}` plus the Sentences kind and a learned sentence rule | `Saku ate sushi.` -> order `サクは` / `寿司を` / `食べた。` |
| English sentence (text) | `en->jp` | Choose the matching Japanese sentence | No | Yes | Planned | The setting is stored, but the assembly screen does not generate this MC board yet | `Saku ate sushi.` -> choose `サクは寿司を食べた。` |

---

## 5) Grammar Pattern Entry (`grammar:*`)

Grammar rows here are only grammar-source behavior. Grammar meaning facts can also appear in sentence source (see Section 4).

### 5.1 Meaning fact

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Japanese source (text) | `jp->en` | English meaning | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (meaning facts; MC-only) | `〜てから` -> choose `after doing X` |
| Japanese source (audio) | `jp->en` | English meaning | No | Yes | Planned | `japanese: {prompts: includes "audio", responses: includes "definition"}` (grammar is not listenable; selecting audio will not generate this form) | Hear `たべてから` -> choose `after doing X` |

### 5.2 Production fact

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Japanese source config (text vehicle cue; answer is Japanese) | `jp->en` internal direction | Japanese production form | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji", answers: includes "typed" or "mc"}` | Prompt `行く` + `〜てから` -> type/pick `行ってから` |
| Japanese source config (audio prompt is Japanese) | `jp->jp` | Japanese production form | No | Yes | Planned | `sentence: {prompts: includes "audio", responses: includes ?}` (awaiting sentence source for grammar production; not yet implemented) | Hear `たべる` cue -> pick `食べてから` |
| Japanese source (text self-copy of pattern label) | `jp->jp` | Same pattern text | No | No | By design | N/A (trivial self-copy excluded) | `〜てから` -> type `〜てから` |

> **Note on "direction":** ask-forms models grammar production as `jp→en` with response `"romaji"` because the answer IS Japanese (a conjugated form) — `answerIsJapanese` is true, so `candidateDirs` returns `["jp2en"]`. The card looks like production (you produce Japanese), but the data model treats it as a `jp→en` "romaji" card. The `en→jp` English source does not generate grammar production forms.

---

## 6) Keigo / Verb Pair / Other Special Subjects

This section is corpus-first: what is possible for these subjects from the data model and content, even if not all rows are implemented yet.

### 6.1 Keigo (`keigo:*`) — corpus possibilities

Keigo sets contain Japanese forms plus role/register semantics, so both recognition and production are feasible.

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Japanese source (text) | `jp->en` | Meaning + register recognition | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition"}` (keigo meaning facts; MC-only) | `召し上がる` -> choose `eat / drink (honorific)` |
| Japanese source (audio) | `jp->en` | Meaning + register recognition | No | Yes | Planned | `japanese: {prompts: includes "audio", responses: includes "definition"}` (keigo is not listenable; selecting audio will not generate this form) | Hear `めしあがる` -> choose `eat / drink (honorific)` |
| English/register source (text) | `en->jp` | Keigo production form | No | Yes | Planned | `english: {answers: includes "mc"}` (awaiting keigo production implementation; not yet emitted) | Prompt `eat / drink (honorific)` -> pick `召し上がる` |
| English/register source (audio is Japanese cue only) | `jp->jp` | Keigo production form | No | Yes | Planned | `sentence: {prompts: includes "audio", responses: ?}` (awaiting sentence source for keigo production with audio; not yet implemented) | Hear plain cue `たべる` + honorific target -> pick `召し上がる` |
| Japanese source (text self-copy) | `jp->jp` | Same keigo form | No | No | By design | N/A (trivial self-copy excluded) | `召し上がる` -> type `召し上がる` |

### 6.2 Verb Pair / Transitivity (`transitivity:*`) — corpus possibilities

Verb-pair rows include English cues plus paired Japanese lemmas/readings, so disambiguation and recognition directions are both feasible.

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| English cue source (text) | `en->jp` | Choose correct pair member (intransitive vs transitive) | No | Yes | Current | `english: {answers: includes "mc"}` (transitivity facts have fixedDir="en2jp", mcOnly=true) | `The door opened.` -> pick `開く` |
| Japanese source (text) | `jp->en` | Meaning/usage recognition for shown pair member | No | Yes | Planned | (Awaiting implementation; would use: `japanese: {prompts: includes "text", responses: includes "definition"}`) | `開く` -> choose `to open (intransitive)` |
| Japanese source (audio) | `jp->en` | Meaning/usage recognition for heard pair member | No | Yes | Planned | `japanese: {prompts: includes "audio", responses: includes "definition"}` (transitivity is not listenable; selecting audio will not generate this form) | Hear `ひらく` -> choose `to open (intransitive)` |
| English role source (text) | `en->jp` | Produce/select the correct Japanese pair member | No | Yes | Planned | `english: {answers: includes "mc"}` (alternative phrasing for transitivity en->jp; awaiting implementation of role-specific prompts) | Prompt `open (something)` -> pick `開ける` |
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
   - Grammar production facts: internally jp->en only because their answer is Japanese
   - Transitivity facts: en->jp only (fixedDir="en2jp")
   - Others: both directions available (both derived from settings)

5. **Answer control viable**:
   - MC-only constraints are enforced (meaning facts, kana en->jp, untypeable en->jp targets)
   - Typed only when typeable for that target
   - A typed intent that is not typeable resolves to the required MC control
   - Equivalent typed-forced-to-MC and explicit-MC forms are deduplicated

6. **Required-control resolution**: Forms intended as typed but forced to MC still appear as MC:
   - Example: Kana en->jp is always MC, so a typed-only English-source configuration still produces its MC card rather than an empty run

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

## Unreachable Rows: Planned Forms Blocked by Implementation

Some Planned rows cannot be reached even if the user selects the settings shown, because the underlying feature is not implemented. Selecting these settings will silently drop those forms:

| Blocked Row | Blocking Reason | Selecting This Setting | Does Not Generate | When Will It Be Unblocked? |
|---|---|---|---|---|
| Kana + Audio (jp→jp) | Kana entries have no audio form | `japanese: {prompts: includes "audio"}` | Kana audio forms | When kana audio support is implemented |
| Grammar Meaning + Audio (jp→en) | Grammar patterns are not listenable | `japanese: {prompts: includes "audio"}` | Grammar audio forms | When grammar audio support is added |
| Keigo Meaning + Audio (jp→en) | Keigo is not listenable | `japanese: {prompts: includes "audio"}` | Keigo audio forms | When keigo audio support is added |
| Transitivity Meaning + Audio (jp→en) | Transitivity is not listenable | `japanese: {prompts: includes "audio"}` | Transitivity audio forms | When transitivity audio support is added |
| Keigo Production (en→jp) | Keigo production not yet implemented | `english: {answers: includes "mc"}` | Keigo production forms | When keigo production feature ships |
| Transitivity Role Variant (en→jp) | Transitivity role prompts not yet implemented | `english: {answers: includes "mc"}` | Role-specific transitivity forms | When transitivity role variant is implemented |
| Grammar/Keigo Production + Audio (jp→jp) | Requires sentence source with production facts | `sentence: {prompts: includes "audio"}` | Grammar/keigo production audio | When sentence source supports these production types |
| Japanese Sentence + Kana | The sentence corpus does not carry an authoritative full-sentence kana answer | `sentence: {responses: includes "romaji"}` | Typed or MC kana-transcription forms | When sentence readings are stored or generated reliably |
| English Sentence + Choose Sentence | Assembly currently renders chunk ordering only | `sentence: {englishResponses: includes "selection"}` | Japanese-sentence MC boards | When the assembly screen gains a sentence-selection variant |

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
- Objective typed forms remain typed
- Forms that cannot be typed safely resolve to MC instead of disappearing
- Example: kana en->jp and kanji-word en->jp still render as MC

**If audio is not selected** (`prompts` does not include "audio"):
- Audio forms are dropped
- Text forms of the same row remain

**Planned features not yet implemented**:
- Sentence+romaji (typing full sentences in kana): awaiting distinct romaji grading
- English sentence selection: the setting exists, but the assembly quiz currently implements ordering only
- Grammar audio: awaiting audio support for patterns
- Keigo/transitivity production: awaiting implementation
- Other Planned rows in the matrix

**Real example**: If settings are:
```
japanese: { prompts: ["text"], responses: ["definition"], answers: ["mc"] }
english: { answers: ["mc"] }
```
Then visible forms are: jp->en meaning definitions (MC), en->jp glyphs (MC). No reading facts, no audio, no typed.

---

## Multiple Settings Paths to the Same Question Format

Some question formats in the matrix can be reached via multiple settings combinations. This is expected and correct — each combination produces a different FORM (different prompt type or answer control):

| Question Format | Reachable Via | Settings Path |
|---|---|---|
| Word meaning fact (jp→en text) | Text prompt only | `japanese: {prompts: includes "text", responses: includes "definition"}` |
| Word meaning fact (jp→en audio) | Audio prompt only | `japanese: {prompts: includes "audio", responses: includes "definition"}` |
| Word reading fact (jp→jp text) | Text prompt only | `japanese: {prompts: includes "text", responses: includes "romaji"}` |
| Word reading fact (jp→jp audio) | Audio prompt only | `japanese: {prompts: includes "audio", responses: includes "romaji"}` |
| Word reading fact (en→jp) | Any en→jp setting | `english: {answers: includes "typed" or "mc"}` |
| Grammar meaning fact (jp→en text) | Text prompt only | `japanese: {prompts: includes "text", responses: includes "definition"}` |
| Grammar meaning fact (jp→en audio) | Audio prompt only | `japanese: {prompts: includes "audio", responses: includes "definition"}` (blocked) |
| Grammar production fact (internal jp→en) | Japanese text + Romaji/Kana response | `japanese: {prompts: includes "text", responses: includes "romaji", answers: includes "typed" or "mc"}` |

The ask-forms.ts dedup logic ensures each resolved form appears exactly once in a coverage deck, even if multiple settings intents collapse to the same card.
